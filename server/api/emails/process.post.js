// File: server/api/emails/process.post.js

import { defineEventHandler, readBody, createError } from 'h3';
import { serverSupabaseClient } from '#supabase/server';
import { useRuntimeConfig } from '#imports';
import { $fetch } from 'ofetch';

const config = useRuntimeConfig();
const GOOGLE_API_KEY = config.googleApiKey;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}`;

const PROMPT_EMAIL_TRIAGE = `
Sei un assistente AI super efficiente per uno studio di commercialisti. Il tuo compito è analizzare un'email in arrivo e assegnarla al dipartimento o alla persona più appropriata.

Ecco la lista del personale e delle loro responsabilità:
--- LISTA PERSONALE ---
{staff_list}
-----------------------

Analizza il seguente contenuto dell'email (oggetto e corpo) e determina quale persona/dipartimento è il più adatto a gestirla.

--- CONTENUTO EMAIL ---
Oggetto: {email_subject}
Corpo: {email_body}
-----------------------

La tua risposta DEVE essere un oggetto JSON con il seguente formato, senza alcun testo aggiuntivo:
{
  "best_match_staff_id": "l'UUID del dipendente/dipartimento scelto dalla lista",
  "confidence_score": un numero da 0.0 (per niente sicuro) a 1.0 (molto sicuro),
  "reasoning": "Una breve frase che spiega perché hai scelto quel dipartimento. Esempio: 'L'email menziona problemi di accesso al software, che è di competenza del Supporto Tecnico.'"
}

Se NESSUNO sembra appropriato, rispondi con l'ID della "Segreteria Generale" o del dipartimento di default e un confidence_score basso.
`;

async function callGemini(prompt) {
    const response = await $fetch.raw(GEMINI_API_URL, {
        method: 'POST', body: { contents: [{ parts: [{ text: prompt }] }] }
    });
    const responseData = response._data;
    if (!responseData.candidates?.[0]) throw new Error('Risposta non valida da Gemini');
    return responseData.candidates[0].content.parts[0].text;
}

export default defineEventHandler(async (event) => {
    const supabase = await serverSupabaseClient(event);
    const body = await readBody(event);
    const { sender, subject, body_text } = body;
    if (!subject || !body_text) throw createError({ statusCode: 400, statusMessage: 'Oggetto o corpo email mancanti.' });

    const { data: staff, error: staffError } = await supabase.from('staff').select('id, name, responsibilities');
    if (staffError) throw createError({ statusCode: 500, statusMessage: staffError.message });
    if (!staff || staff.length === 0) throw createError({ statusCode: 500, statusMessage: 'Nessun personale configurato nel database.' });

    const staffListForPrompt = staff.map(s => `ID: ${s.id}, Nome: ${s.name}, Competenze: ${s.responsibilities}`).join('\n');
    const finalPrompt = PROMPT_EMAIL_TRIAGE.replace('{staff_list}', staffListForPrompt).replace('{email_subject}', subject).replace('{email_body}', body_text.substring(0, 3000));

    let aiResponse;
    try {
        const rawResponse = await callGemini(finalPrompt);
        aiResponse = JSON.parse(rawResponse.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) {
        throw createError({ statusCode: 500, statusMessage: 'Errore durante l\'analisi AI dell\'email.' });
    }
    
    const { data: savedEmail, error: saveError } = await supabase.from('incoming_emails').insert([{
        sender, subject, body_text, status: 'assigned',
        assigned_to_staff_id: aiResponse.best_match_staff_id,
        ai_confidence_score: aiResponse.confidence_score,
        ai_reasoning: aiResponse.reasoning
    }]).select().single();
    
    if (saveError) throw createError({ statusCode: 500, statusMessage: saveError.message });
    
    const assignedStaffMember = staff.find(s => s.id === aiResponse.best_match_staff_id);
    console.log(`Email da ${sender} assegnata a ${assignedStaffMember?.name}`);
    return { message: 'Email processata e assegnata con successo.', assignment: assignedStaffMember, emailRecord: savedEmail };
});