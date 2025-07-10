// server/utils/mailProcessor.js
import { fetchNewEmails } from './imapClient';
import { analyzeEmailWithAI } from './aiService';
import { sendEmail } from './emailSender';
import { getSupabaseAdminClient } from './supabaseAdmin';

export async function processNewIncomingEmails() {
  console.log('Starting email processing cycle...');
  const config = useRuntimeConfig();
  const supabaseAdmin = getSupabaseAdminClient();

  try {
    // 1. Leggi le nuove email dalla casella IMAP
    const incomingRawEmails = await fetchNewEmails(config);
    console.log(`Fetched ${incomingRawEmails.length} new emails from IMAP.`);

    for (const email of incomingRawEmails) {
      console.log(`Processing email from ${email.from} - Subject: ${email.subject}`);
      let emailRecordId = null; // Per tenere traccia dell'ID nel DB

      try {
        // 2. Salva l'email raw nel database
        const { data: savedEmail, error: saveError } = await supabaseAdmin.from('incoming_emails').insert([{
            sender: email.from,
            subject: email.subject,
            body_text: email.text,
            body_html: email.html,
            status: 'new',
            // created_at sarà impostato automaticamente dal default del DB
        }]).select().single();

        if (saveError) throw new Error(`Supabase save error: ${saveError.message}`);
        emailRecordId = savedEmail.id;
        console.log(`Email saved to DB with ID: ${emailRecordId}`);

        // 3. Analizza l'email con l'AI (Gemini)
        const aiResult = await analyzeEmailWithAI(email.from, email.subject, email.text || email.html);
        
        // 4. Aggiorna l'email nel DB con i risultati dell'AI
        const { error: updateError } = await supabaseAdmin.from('incoming_emails').update({
            assigned_to_staff_id: aiResult.assigned_to_staff_id,
            ai_confidence_score: aiResult.ai_confidence_score,
            ai_reasoning: aiResult.ai_reasoning,
            status: aiResult.assigned_to_staff_id ? 'analyzed' : 'manual_review', // Se l'AI non assegna, richiede revisione manuale
        }).eq('id', emailRecordId);

        if (updateError) throw new Error(`Supabase AI update error: ${updateError.message}`);
        console.log(`AI analysis updated for email ID ${emailRecordId}. Assigned to staff: ${aiResult.assigned_to_staff_id || 'N/A'}`);

        // 5. Inoltra l'email al destinatario suggerito dall'AI
        if (aiResult.assigned_to_staff_id && aiResult.assignedStaffEmail) {
            try {
                await sendEmail(
                    aiResult.assignedStaffEmail,
                    email.from.split('<')[0].trim() || email.from, // Nome del mittente
                    email.from, // Indirizzo email del mittente originale
                    email.subject,
                    email.text || email.html, // Invia il testo o l'HTML originale
                    aiResult.ai_reasoning
                );

                // Aggiorna lo stato a 'forwarded' nel DB
                const { error: forwardStatusError } = await supabaseAdmin.from('incoming_emails').update({
                    status: 'forwarded',
                    // Non ci sono campi forwarded_to_email o forwarded_at nel tuo DB schema
                }).eq('id', emailRecordId);

                if (forwardStatusError) console.error(`Error updating forwarded status for ID ${emailRecordId}:`, forwardStatusError.message);
                console.log(`Email ID ${emailRecordId} successfully forwarded to ${aiResult.assignedStaffEmail}`);

            } catch (forwardError) {
                console.error(`Error forwarding email ID ${emailRecordId}:`, forwardError);
                // Aggiorna lo stato a 'forward_error' nel DB
                await supabaseAdmin.from('incoming_emails').update({
                    status: 'forward_error',
                    // Potresti aggiungere un campo 'error_details' per salvare l'errore completo
                }).eq('id', emailRecordId);
            }
        } else {
            console.warn(`Email ID ${emailRecordId} not assigned by AI or missing staff email. Status set to 'manual_review'.`);
        }

      } catch (innerError) {
        console.error(`Error processing single email (ID ${emailRecordId || 'N/A'}):`, innerError);
        // Se si verifica un errore prima di salvare l'email o durante il primo salvataggio,
        // emailRecordId potrebbe essere null. Gestisci di conseguenza.
        if (emailRecordId) {
            await supabaseAdmin.from('incoming_emails').update({
                status: 'processing_error',
                // error_message: innerError.message, // Se aggiungi un campo per i messaggi di errore
            }).eq('id', emailRecordId);
        }
      }
    }
  } catch (globalError) {
    console.error('Global error during email processing cycle:', globalError);
  }
  console.log('Email processing cycle finished.');
}