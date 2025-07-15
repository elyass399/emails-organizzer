// server/utils/aiService.js
import { useRuntimeConfig } from '#imports';
import { $fetch } from 'ofetch';
// Usiamo il client admin per fetch staff
import { getSupabaseAdminClient } from './supabaseAdmin'; 

const config = useRuntimeConfig();
const GOOGLE_API_KEY = config.googleApiKey;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}`;

const PROMPT_EMAIL_TRIAGE = `
Sei un assistente AI super efficiente per uno studio di commercialisti. Il tuo compito è analizzare un'email in arrivo e assegnarla al membro dello staff più appropriato.

Ecco la lista del personale e delle loro responsabilità:
--- LISTA PERSONALE ---
{staff_list}
-----------------------

Analizza il seguente contenuto dell'email (mittente, oggetto e corpo) e determina quale persona dello staff è il più adatto a gestirla.

--- CONTENUTO EMAIL ---
Mittente: {email_from}
Oggetto: {email_subject}
Corpo: {email_body}
-----------------------

La tua risposta DEVE essere un oggetto JSON con il seguente formato, senza alcun testo aggiuntivo:
{
  "assigned_to_staff_id": "l'UUID del dipendente scelto dalla lista. Se NESSUNO sembra appropriato, lascia null o l'UUID di un dipendente generico per 'segreteria generale' se ne hai uno predefinito.",
  "ai_confidence_score": un numero da 0.0 (per niente sicuro) a 1.0 (molto sicuro),
  "ai_reasoning": "Una breve frase che spiega perché hai scelto quel dipendente/ufficio. Esempio: 'L'email menziona problemi di accesso al software, che è di competenza del Supporto Tecnico.'"
}
`;

export async function analyzeEmailWithAI(sender, subject, body_text) {
    const supabaseAdmin = getSupabaseAdminClient(); // Usa il client admin
    const { data: staff, error: staffError } = await supabaseAdmin.from('staff').select('id, name, responsibilities, email'); // Selezioniamo anche email
    if (staffError) {
        console.error('Error fetching staff for AI:', staffError.message);
        throw new Error('Impossibile caricare il personale per l\'analisi AI.');
    }
    if (!staff || staff.length === 0) {
        console.warn('Nessun personale configurato nel database per l\'analisi AI.');
        return {
            assigned_to_staff_id: null,
            ai_confidence_score: 0.1,
            ai_reasoning: "Nessun personale configurato per l'assegnazione.",
        };
    }

    const staffListForPrompt = staff.map(s => `ID: ${s.id}, Nome: ${s.name}, Responsabilità: ${s.responsibilities}, Email: ${s.email}`).join('\n');
    const finalPrompt = PROMPT_EMAIL_TRIAGE
        .replace('{staff_list}', staffListForPrompt)
        .replace('{email_from}', sender)
        .replace('{email_subject}', subject)
        .replace('{email_body}', body_text.substring(0, 4000));

    let aiResponse;
    try {
        const response = await $fetch.raw(GEMINI_API_URL, {
            method: 'POST', body: { contents: [{ parts: [{ text: finalPrompt }] }] }
        });
        const responseData = response._data;
        if (!responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Risposta non valida o malformata da Gemini');
        }
        const rawJson = responseData.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
        aiResponse = JSON.parse(rawJson);
    } catch (e) {
        console.error("Errore chiamata Gemini:", e.message);
        throw new Error(`Errore durante l'analisi AI dell'email: ${e.message}`);
    }
    
    // Valida l'ID dello staff suggerito
    const bestMatchStaff = staff.find(s => s.id === aiResponse.assigned_to_staff_id);
    const finalAssignedId = bestMatchStaff ? aiResponse.assigned_to_staff_id : null;

    return {
        assigned_to_staff_id: finalAssignedId,
        ai_confidence_score: parseFloat(aiResponse.ai_confidence_score) || 0,
        ai_reasoning: aiResponse.ai_reasoning,
        assignedStaffEmail: bestMatchStaff?.email || null, 
        assignedStaffName: bestMatchStaff?.name || null,
    };
}