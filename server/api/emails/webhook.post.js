// File: server/api/emails/webhook.post.js

import { defineEventHandler, readBody, createError } from 'h3';
import { serverSupabaseClient } from '#supabase/server';
import { useRuntimeConfig } from '#imports';
import { $fetch } from 'ofetch';
import sgMail from '@sendgrid/mail';

// --- CONFIGURAZIONE ---
const config = useRuntimeConfig();
const GOOGLE_API_KEY = config.googleApiKey;
const SENDGRID_API_KEY = config.sendgridApiKey;
const SENDER_EMAIL = config.senderEmail; // L'email da cui inviamo (es. dispatcher@elyassrochdigmail.com)
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}`;

// Inizializza il client di SendGrid una sola volta
sgMail.setApiKey(SENDGRID_API_KEY);

// --- PROMPT PER L'INTELLIGENZA ARTIFICIALE ---
const PROMPT_EMAIL_TRIAGE = `
Sei un assistente AI super efficiente per uno studio di commercialisti. Il tuo compito è analizzare un'email in arrivo e assegnarla al dipartimento o alla persona più appropriata.

Ecco la lista del personale e delle loro responsabilità:
--- LISTA PERSONALE ---
{staff_list}
-----------------------

Analizza il seguente contenuto dell'email (mittente, oggetto e corpo) e determina quale persona/dipartimento è il più adatto a gestirla.

--- CONTENUTO EMAIL ---
Mittente: {email_from}
Oggetto: {email_subject}
Corpo: {email_body}
-----------------------

La tua risposta DEVE essere un oggetto JSON con il seguente formato, senza alcun testo aggiuntivo:
{
  "best_match_staff_id": "l'UUID del dipendente/dipartimento scelto dalla lista",
  "confidence_score": un numero da 0.0 (per niente sicuro) a 1.0 (molto sicuro),
  "reasoning": "Una breve frase che spiega perché hai scelto quel dipartimento."
}

Se NESSUNO sembra appropriato, rispondi con l'ID della "Segreteria Generale" o del dipartimento di default e un confidence_score basso.
`;

// --- FUNZIONI HELPER ---

/**
 * Chiama l'API di Google Gemini per analizzare il testo.
 * @param {string} prompt Il prompt completo da inviare a Gemini.
 * @returns {Promise<object>} La risposta JSON parsata dall'AI.
 */
async function callGemini(prompt) {
    try {
        const response = await $fetch.raw(GEMINI_API_URL, {
            method: 'POST', body: { contents: [{ parts: [{ text: prompt }] }] }
        });
        const responseData = response._data;
        if (!responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error('Risposta non valida o malformata da Gemini');
        }
        const rawJson = responseData.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(rawJson);
    } catch (e) {
        console.error("Errore chiamata Gemini:", e.message);
        throw createError({ statusCode: 500, statusMessage: 'Errore durante l\'analisi AI dell\'email.' });
    }
}

/**
 * Usa SendGrid per inoltrare l'email al dipartimento competente.
 * @param {string} to Indirizzo email del destinatario (il dipartimento).
 * @param {string} fromName Nome del mittente originale.
 * @param {string} fromAddress Indirizzo email del mittente originale.
 * @param {string} subject Oggetto dell'email originale.
 * @param {string} originalBody Corpo dell'email originale.
 * @param {string} aiReasoning Motivazione dell'AI per l'assegnazione.
 */
async function forwardEmailWithSendGrid(to, fromName, fromAddress, subject, originalBody, aiReasoning) {
  const htmlBody = `
    <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 16px; border-radius: 8px;">
      <p><strong>Questa email è stata smistata automaticamente dal sistema AI.</strong></p>
      <p style="background-color: #f5f5f5; padding: 12px; border-radius: 4px;">
        <strong>Motivazione AI:</strong> <em>${aiReasoning}</em>
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
      <h3>Email Originale</h3>
      <p><strong>Da:</strong> ${fromName} <${fromAddress}></p>
      <p><strong>Oggetto:</strong> ${subject}</p>
      <div style="border-left: 3px solid #ccc; padding-left: 1em; margin-top: 1em; color: #555;">
        <pre style="white-space: pre-wrap; font-family: inherit;">${originalBody}</pre>
      </div>
    </div>
  `;

  const msg = {
    to: to,
    from: SENDER_EMAIL, // Usa l'email configurata nelle variabili d'ambiente
    subject: `[Smistato da AI] ${subject}`,
    html: htmlBody,
    replyTo: fromAddress, // Permette di rispondere direttamente al cliente
  };

  try {
    await sgMail.send(msg);
    console.log(`Email inoltrata con successo a ${to}`);
  } catch (error) {
    console.error("Errore durante l'inoltro con SendGrid:", error.response?.body || error.message);
    // Non blocchiamo il flusso per questo, ma logghiamo l'errore.
  }
}

// --- HANDLER PRINCIPALE DEL WEBHOOK ---

export default defineEventHandler(async (event) => {
    // SendGrid invia i dati come 'multipart/form-data'. readBody di Nuxt/H3 lo gestisce.
    const payload = await readBody(event);

    // Estrai i dati dal payload di SendGrid
    const senderRaw = payload.from || ''; 
    const senderEmail = senderRaw.match(/<(.+)>/)?.[1] || senderRaw;
    const senderName = senderRaw.replace(/<.+>/, '').trim() || senderEmail;
    const subject = payload.subject || 'Nessun Oggetto';
    const body_text = payload.text || payload.html || 'Corpo email vuoto.';

    if (!senderEmail) {
      console.warn("Webhook ricevuto senza mittente valido. Ignorato.");
      return { message: "Payload incompleto, email ignorata."};
    }

    const supabase = await serverSupabaseClient(event);

    // 1. Recupera la lista del personale da Supabase
    const { data: staff, error: staffError } = await supabase.from('staff').select('id, name, responsibilities, email');
    if (staffError) throw createError({ statusCode: 500, statusMessage: `Errore Supabase (staff): ${staffError.message}` });
    if (!staff || staff.length === 0) throw createError({ statusCode: 500, statusMessage: 'Nessun personale configurato nel database.' });
    
    // 2. Prepara e chiama l'AI
    const staffListForPrompt = staff.map(s => `- ID: ${s.id}, Nome: ${s.name}, Competenze: ${s.responsibilities}`).join('\n');
    const finalPrompt = PROMPT_EMAIL_TRIAGE
        .replace('{staff_list}', staffListForPrompt)
        .replace('{email_from}', senderRaw)
        .replace('{email_subject}', subject)
        .replace('{email_body}', body_text.substring(0, 4000)); // Limita la lunghezza per sicurezza

    const aiResponse = await callGemini(finalPrompt);
    
    // 3. Salva l'email e l'analisi su Supabase
    const { data: savedEmail, error: saveError } = await supabase.from('incoming_emails').insert([{
        sender: senderEmail,
        subject: subject, 
        body_text: body_text, 
        status: 'assigned',
        assigned_to_staff_id: aiResponse.best_match_staff_id,
        ai_confidence_score: aiResponse.confidence_score,
        ai_reasoning: aiResponse.reasoning
    }]).select().single();
    
    if (saveError) throw createError({ statusCode: 500, statusMessage: `Errore Supabase (insert): ${saveError.message}` });
    
    // 4. Inoltra l'email al dipartimento corretto
    const assignedStaffMember = staff.find(s => s.id === aiResponse.best_match_staff_id);
    if (assignedStaffMember && assignedStaffMember.email) {
        await forwardEmailWithSendGrid(
            assignedStaffMember.email,
            senderName,
            senderEmail,
            subject,
            body_text,
            aiResponse.reasoning
        );
    } else {
        console.warn(`Nessun indirizzo email trovato per lo staff ${assignedStaffMember?.name} (ID: ${aiResponse.best_match_staff_id}). Impossibile inoltrare.`);
    }

    // Rispondi a SendGrid con 200 OK per confermare la ricezione
    event.res.statusCode = 200;
    return { status: 'success', message: `Email da ${senderEmail} processata e assegnata a ${assignedStaffMember?.name || 'sconosciuto'}.` };
});