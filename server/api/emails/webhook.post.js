// File: server/api/emails/webhook.post.js

import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'; // CAMBIATO: Usa il client Admin
import { analyzeEmailWithAI } from '../../utils/aiService'; // Funzione centralizzata per l'analisi AI
import { sendEmail } from '../../utils/emailSender';     // Funzione centralizzata per l'invio email

export default defineEventHandler(async (event) => {
    const supabaseAdmin = getSupabaseAdminClient(); // Usa il client Supabase Admin
    const payload = await readBody(event); // Il payload del webhook (es. da SendGrid Inbound Parse)

    // Estrai i dati dal payload (questi campi sono comuni nei webhook di parsing email)
    const senderRaw = payload.from || ''; 
    const senderEmail = senderRaw.match(/<(.+)>/)?.[1] || senderRaw; // Estrae solo l'email da "Nome <email@example.com>"
    const senderName = senderRaw.replace(/<.+>/, '').trim() || senderEmail;
    const subject = payload.subject || 'Nessun Oggetto';
    const body_text = payload.text || payload.html || 'Corpo email vuoto.';
    const body_html = payload.html || null;

    console.log('Webhook POST: Ricevuti dati ->', { senderEmail, subject: subject ? subject.substring(0, 50) + '...' : 'N/A' });


    if (!senderEmail) {
      console.warn("Webhook ricevuto senza mittente valido. Ignorato.");
      setResponseStatus(event, 200); // Importante rispondere 200 OK per evitare re-invii da webhook
      return { status: "ignored", message: "Payload incompleto, email ignorata."};
    }

    let emailRecordId = null;

    try {
        // 1. Salva l'email nel database con stato 'new'
        const { data: savedEmail, error: saveError } = await supabaseAdmin.from('incoming_emails').insert([{ // CAMBIATO: usa supabaseAdmin
            sender: senderEmail,
            subject: subject, 
            body_text: body_text, 
            body_html: body_html,
            status: 'new',
        }]).select().single();
        
        if (saveError) {
            console.error('Webhook Supabase save error (webhook.post):', saveError.message);
            throw new Error(`Errore Supabase (insert): ${saveError.message}`); // Rilancia per cattura successiva
        }
        emailRecordId = savedEmail.id;
        console.log(`Webhook POST: Email saved to DB with ID: ${emailRecordId}`);

        // 2. Analisi AI
        console.log(`Webhook POST: Avvio analisi AI per email ID ${emailRecordId}...`);
        const aiResult = await analyzeEmailWithAI(senderEmail, subject, body_text);
        console.log(`Webhook POST: Risultato analisi AI per ID ${emailRecordId}:`, aiResult);

        // 3. Aggiorna l'email nel DB con i risultati dell'AI
        const newStatus = aiResult.assigned_to_staff_id ? 'analyzed' : 'manual_review';
        const { error: updateError } = await supabaseAdmin.from('incoming_emails').update({ // CAMBIATO: usa supabaseAdmin
            assigned_to_staff_id: aiResult.assigned_to_staff_id,
            ai_confidence_score: aiResult.ai_confidence_score,
            ai_reasoning: aiResult.ai_reasoning,
            status: newStatus,
        }).eq('id', emailRecordId);

        if (updateError) {
            console.error('Webhook Supabase AI update error (webhook.post):', updateError.message);
            throw new Error(`Errore Supabase (update AI): ${updateError.message}`);
        }
        console.log(`Webhook POST: AI analysis updated for webhook email ID ${emailRecordId}. Assigned to staff: ${aiResult.assigned_to_staff_id || 'N/A'}`);

        // 4. Inoltra l'email al dipendente corretto
        if (aiResult.assigned_to_staff_id && aiResult.assignedStaffEmail) {
            try {
                console.log(`Webhook POST: Tentativo di inoltro email ID ${emailRecordId} a ${aiResult.assignedStaffEmail}...`);
                await sendEmail(
                    aiResult.assignedStaffEmail,
                    senderName,
                    senderEmail,
                    subject,
                    body_text, // O body_html se preferisci, a seconda di sendEmail
                    aiResult.ai_reasoning
                );
                // Aggiorna lo stato a 'forwarded'
                await supabaseAdmin.from('incoming_emails').update({ // CAMBIATO: usa supabaseAdmin
                    status: 'forwarded'
                }).eq('id', emailRecordId);
                console.log(`Webhook POST: Email ID ${emailRecordId} successfully forwarded to ${aiResult.assignedStaffEmail}`);

            } catch (forwardError) {
                console.error('Webhook Error during email forwarding (webhook.post):', forwardError);
                // Aggiorna lo stato a 'forward_error'
                await supabaseAdmin.from('incoming_emails').update({ // CAMBIATO: usa supabaseAdmin
                    status: 'forward_error'
                }).eq('id', emailRecordId);
                throw forwardError; // Rilancia l'errore per il catch generale
            }
        } else {
            console.warn(`Webhook POST: Email ID ${emailRecordId} not assigned by AI or missing staff email. Status set to 'manual_review'.`);
            // Lo stato Ã¨ giÃ  'manual_review'
        }

        setResponseStatus(event, 200); // Sempre 200 OK per i webhook che hanno elaborato il messaggio
        return { status: 'success', message: `Email da ${senderEmail} processata e assegnata.` };

    } catch (error) {
        console.error('Unhandled error in webhook.post.js:', error);
        // Se c'Ã¨ un errore e emailRecordId Ã¨ noto, prova ad aggiornare lo stato a 'processing_error'
        if (emailRecordId) {
            await supabaseAdmin.from('incoming_emails').update({ // CAMBIATO: usa supabaseAdmin
                status: 'processing_error',
                // error_message: error.message // Se hai un campo per i messaggi di errore
            }).eq('id', emailRecordId);
        }
        setResponseStatus(event, 200); // **IMPORTANTE:** Rispondi sempre 200 OK ai webhook per evitare re-invii continui, anche in caso di errore interno.
        return { status: 'error', message: `Errore interno durante l'elaborazione del webhook: ${error.message}` };
    }
});