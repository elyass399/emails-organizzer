// server/utils/mailProcessor.js
import { fetchNewEmails } from './imapClient';
import { analyzeEmailWithAI, extractClientInfoWithAI } from './aiService';
import { sendEmail, sendFollowUpRequest } from './emailSender';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { upsertClient, getClient } from './clientManager';

const MAX_FOLLOW_UP_RETRIES = 2;

export async function processNewIncomingEmails() {
  console.log('MAIL_PROCESSOR: Starting email processing cycle...');
  const config = useRuntimeConfig();
  const supabaseAdmin = getSupabaseAdminClient();

  try {
    const incomingRawEmails = await fetchNewEmails(config);
    console.log(`MAIL_PROCESSOR: Fetched ${incomingRawEmails.length} new emails from IMAP.`);

    for (const email of incomingRawEmails) {
      console.log(`\n--- MAIL_PROCESSOR: Processing email from "${email.from}" - Subject: "${email.subject.substring(0, 50)}..." ---`);
      let emailRecordId = null;

      try {
        const { data: savedEmail, error: saveEmailError } = await supabaseAdmin.from('incoming_emails').insert([{
            sender: email.from,
            subject: email.subject,
            body_text: email.text,
            body_html: email.html,
            status: 'new', is_urgent: false, reference: email.messageId
        }]).select().single();

        if (saveEmailError) throw new Error(`Supabase save email error: ${saveEmailError.message}`);
        emailRecordId = savedEmail.id;
        console.log(`MAIL_PROCESSOR: Email (IN) saved to DB with ID: ${emailRecordId}`);

        const originalMessageID = email.messageId;
        const clientEmailFromHeader = email.from.match(/<(.+)>/)?.[1] || email.from;

        const repliedClient = await getClient(clientEmailFromHeader);
        const isFollowUpReply = repliedClient && repliedClient.follow_up_email_sent === true;

        if (isFollowUpReply) {
            console.log(`MAIL_PROCESSOR: Handling follow-up reply for ${repliedClient.email}.`);
            const extractedInfo = await extractClientInfoWithAI(email.text || email.html);
            
            const updatedClient = await upsertClient(
                repliedClient.email, extractedInfo.client_name,
                extractedInfo.client_phone_number, extractedInfo.client_city,
                emailRecordId
            );

            await supabaseAdmin.from('incoming_emails').update({ status: 'processed_follow_up', ai_reasoning: `Risposta a follow-up email. Dati cliente aggiornati.` }).eq('id', emailRecordId);
            console.log(`MAIL_PROCESSOR: Follow-up reply for ${repliedClient.email} processed.`);

            const stillMissingInfo = !updatedClient.name || !updatedClient.phone_number || !updatedClient.city;
            const retries = updatedClient.follow_up_retries || 0;

            if (stillMissingInfo && retries < MAX_FOLLOW_UP_RETRIES) {
                console.log(`MAIL_PROCESSOR: Client ${repliedClient.email} replied but info is still missing. Sending another follow-up.`);
                
                let missingFields = [];
                if (!updatedClient.name) missingFields.push("il suo nome completo");
                if (!updatedClient.phone_number) missingFields.push("il suo numero di telefono");
                if (!updatedClient.city) missingFields.push("il suo comune/città");
                const missingInfoDescription = `La ringraziamo per la sua risposta. Per procedere, ci mancano ancora: ${missingFields.join(', ')}.`;
                
                // --- MODIFICA QUI: Cattura i dettagli dell'email inviata ---
                const sentEmailDetails = await sendFollowUpRequest(clientEmailFromHeader, updatedClient.name || 'Cliente', missingInfoDescription, updatedClient.id, originalMessageID);

                // --- MODIFICA QUI: Salva l'email di follow-up inviata nel DB ---
                await supabaseAdmin.from('incoming_emails').insert([{
                    sender: config.senderEmail, // La nostra email
                    subject: sentEmailDetails.subject,
                    body_html: sentEmailDetails.body,
                    status: 'follow_up_sent', // Stato speciale per le email in uscita
                    ai_reasoning: `Tentativo di follow-up #${retries + 1}. Mancano: ${missingFields.join(', ')}.`
                }]);
                console.log('MAIL_PROCESSOR: Outgoing follow-up email record saved to DB.');

                await supabaseAdmin.from('clients').update({
                    follow_up_email_sent: true,
                    follow_up_sent_at: new Date().toISOString(),
                    follow_up_message_id: sentEmailDetails.messageId,
                    follow_up_retries: retries + 1
                }).eq('id', updatedClient.id);
                console.log(`MAIL_PROCESSOR: Follow-up retry #${retries + 1} sent to ${clientEmailFromHeader}.`);
            }
            continue;
        }

        // --- GESTIONE NUOVE EMAIL ---
        console.log(`MAIL_PROCESSOR: Initiating AI analysis for new email ID ${emailRecordId}...`);
        const aiResult = await analyzeEmailWithAI(email.from, email.subject, email.text || email.html);

        const clientNameFromEmail = email.from.replace(/<.+>/, '').trim().replace(/"/g, '') || null;
        const updatedClientOnFirstGo = await upsertClient(
            clientEmailFromHeader, aiResult.client_name || clientNameFromEmail,
            aiResult.client_phone_number, aiResult.client_city, emailRecordId
        ); 

        const hasMissingInfo = !updatedClientOnFirstGo.name || !updatedClientOnFirstGo.phone_number || !updatedClientOnFirstGo.city;
        if (hasMissingInfo && !updatedClientOnFirstGo.follow_up_email_sent) {
            let missingFields = [];
            if (!updatedClientOnFirstGo.name) missingFields.push("nome completo");
            if (!updatedClientOnFirstGo.phone_number) missingFields.push("numero di telefono");
            if (!updatedClientOnFirstGo.city) missingFields.push("comune/città");
            
            const missingInfoDescription = `Per poterla assistere al meglio, la preghiamo di fornirci: ${missingFields.join(', ')}.`;
            
            // --- MODIFICA QUI: Cattura i dettagli dell'email inviata ---
            const sentEmailDetails = await sendFollowUpRequest(clientEmailFromHeader, updatedClientOnFirstGo.name || 'Cliente', missingInfoDescription, updatedClientOnFirstGo.id, originalMessageID);

            // --- MODIFICA QUI: Salva l'email di follow-up inviata nel DB ---
            await supabaseAdmin.from('incoming_emails').insert([{
                sender: config.senderEmail, // La nostra email
                subject: sentEmailDetails.subject,
                body_html: sentEmailDetails.body,
                status: 'follow_up_sent', // Stato speciale
                ai_reasoning: `Primo follow-up inviato. Mancano: ${missingFields.join(', ')}.`
            }]);
            console.log('MAIL_PROCESSOR: Outgoing follow-up email record saved to DB.');

            await supabaseAdmin.from('clients').update({
                follow_up_email_sent: true,
                follow_up_sent_at: new Date().toISOString(),
                follow_up_message_id: sentEmailDetails.messageId,
                follow_up_retries: 1
            }).eq('id', updatedClientOnFirstGo.id);
            console.log(`MAIL_PROCESSOR: First follow-up email sent to ${clientEmailFromHeader}.`);
        }

        const newStatus = aiResult.assigned_to_staff_id ? 'analyzed' : 'manual_review';
        await supabaseAdmin.from('incoming_emails').update({
            assigned_to_staff_id: aiResult.assigned_to_staff_id,
            ai_confidence_score: aiResult.ai_confidence_score,
            ai_reasoning: aiResult.ai_reasoning,
            status: newStatus,
            is_urgent: aiResult.is_urgent,
        }).eq('id', emailRecordId);
        
        if (aiResult.assigned_to_staff_id && aiResult.assignedStaffEmail) {
            // Logica di inoltro
        }

      } catch (innerError) {
        console.error(`MAIL_PROCESSOR: Critical ERROR processing single email (ID ${emailRecordId || 'N/A'}):`, innerError.message);
        if (emailRecordId) await supabaseAdmin.from('incoming_emails').update({ status: 'processing_error' }).eq('id', emailRecordId);
      }
    }
  } catch (globalError) {
    console.error('MAIL_PROCESSOR: Global ERROR during email processing cycle:', globalError);
  }
  console.log('MAIL_PROCESSOR: Email processing cycle finished.');
}