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
      console.log(`\n--- MAIL_PROCESSOR: Processing email from "${email.from}" with subject: "${email.subject}" ---`);
      
      try {
        const clientEmailFromHeader = email.from.match(/<(.+)>/)?.[1] || email.from;
        const client = await getClient(clientEmailFromHeader);
        const isFollowUpReply = client && client.follow_up_email_sent === true;

        // --- STRUTTURA IF/ELSE DEFINITIVA PER SEPARARE I PERCORSI ---
        if (isFollowUpReply) {
            // --- PERCORSO 1: È UNA RISPOSTA A FOLLOW-UP ---
            // Questa email non verrà salvata né mostrata in dashboard.
            console.log(`MAIL_PROCESSOR: Handling as a follow-up reply for ${client.email}.`);
            
            console.log("MAIL_PROCESSOR: Cleaning reply body before AI extraction...");
            const replyOnlyText = (email.text || "").split(/\n>|On .* wrote:|Il giorno .* ha scritto:/)[0].trim();
            console.log(`MAIL_PROCESSOR: Cleaned text for AI: "${replyOnlyText}"`);
            
            const extractedInfo = await extractClientInfoWithAI(replyOnlyText);
            
            const updatedClient = await upsertClient(
                client.email, extractedInfo.client_name,
                extractedInfo.client_phone_number, extractedInfo.client_city,
                null // Non c'è un record email principale da associare a questa risposta
            );

            console.log(`MAIL_PROCESSOR: Client data updated for ${client.email}.`);

            const stillMissingInfo = !updatedClient.name || !updatedClient.phone_number || !updatedClient.city;
            const retries = updatedClient.follow_up_retries || 0;

            if (stillMissingInfo && retries < MAX_FOLLOW_UP_RETRIES) {
                // Logica per inviare un altro follow-up (sollecito)
                console.log(`MAIL_PROCESSOR: Client ${client.email} replied but info is still missing. Sending another follow-up.`);
                // ... (il codice per inviare il sollecito va qui)
            }
            // Fine del percorso. Non si fa altro, il ciclo for passerà alla prossima email.
            
        } else {
            // --- PERCORSO 2: È UN'EMAIL NUOVA ---
            // Solo queste email verranno salvate e potenzialmente mostrate in dashboard.
            console.log(`MAIL_PROCESSOR: Handling as a new email. Saving to DB...`);
            
            const { data: savedEmail, error: saveEmailError } = await supabaseAdmin.from('incoming_emails').insert([{
                sender: email.from,
                subject: email.subject,
                body_text: email.text,
                body_html: email.html,
                status: 'new', is_urgent: false, reference: email.messageId
            }]).select().single();

            if (saveEmailError) throw new Error(`Supabase save email error: ${saveEmailError.message}`);
            const emailRecordId = savedEmail.id;
            console.log(`MAIL_PROCESSOR: New email saved to DB with ID: ${emailRecordId}`);

            const aiResult = await analyzeEmailWithAI(email.from, email.subject, email.text || email.html);
            const clientNameFromEmail = email.from.replace(/<.+>/, '').trim().replace(/"/g, '') || null;
            const updatedClient = await upsertClient(
                clientEmailFromHeader, aiResult.client_name || clientNameFromEmail,
                aiResult.client_phone_number, aiResult.client_city, emailRecordId
            );

            const hasMissingInfo = !updatedClient.name || !updatedClient.phone_number || !updatedClient.city;
            if (hasMissingInfo && !updatedClient.follow_up_email_sent) {
                // Logica per inviare il primo follow-up
                console.log(`MAIL_PROCESSOR: New client has missing info. Sending first follow-up.`);
                 // ... (il codice per inviare il primo follow-up va qui)
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
                console.log(`MAIL_PROCESSOR: Forwarding email to ${aiResult.assignedStaffEmail}...`);
                // await sendEmail(...);
                await supabaseAdmin.from('incoming_emails').update({ status: 'forwarded' }).eq('id', emailRecordId);
            }
        }

      } catch (innerError) {
        console.error(`MAIL_PROCESSOR: Critical ERROR processing single email:`, innerError.message, innerError.stack);
      }
    }
  } catch (globalError) {
    console.error('MAIL_PROCESSOR: Global ERROR during email processing cycle:', globalError);
  }
  console.log('MAIL_PROCESSOR: Email processing cycle finished.');
}