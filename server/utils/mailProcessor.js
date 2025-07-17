// server/utils/mailProcessor.js
import { fetchNewEmails } from './imapClient';
import { analyzeEmailWithAI } from './aiService';
import { sendEmail } from './emailSender';
import { getSupabaseAdminClient } from './supabaseAdmin';

export async function processNewIncomingEmails() {
  console.log('MAIL_PROCESSOR: Starting email processing cycle...');
  const config = useRuntimeConfig();
  const supabaseAdmin = getSupabaseAdminClient();

  try {
    const incomingRawEmails = await fetchNewEmails(config);
    console.log(`MAIL_PROCESSOR: Fetched ${incomingRawEmails.length} new emails from IMAP.`);

    for (const email of incomingRawEmails) {
      console.log(`\n--- MAIL_PROCESSOR: Processing email from "${email.from}" - Subject: "${email.subject.substring(0, Math.min(email.subject.length, 50))}..." ---`);
      let emailRecordId = null;

      try {
        // 1. Salva l'email raw nel database PRIMA di gestire gli allegati per ottenere l'ID
        // Inseriamo anche il default is_urgent=false qui per coerenza
        const { data: savedEmail, error: saveEmailError } = await supabaseAdmin.from('incoming_emails').insert([{
            sender: email.from,
            subject: email.subject,
            body_text: email.text,
            body_html: email.html,
            status: 'new',
            is_urgent: false, // Inseriamo il default iniziale di non urgente
        }]).select().single();

        if (saveEmailError) {
            console.error(`MAIL_PROCESSOR: ERROR saving new email to DB: ${saveEmailError.message}`);
            throw new Error(`Supabase save email error: ${saveEmailError.message}`);
        }
        emailRecordId = savedEmail.id;
        console.log(`MAIL_PROCESSOR: Email saved to DB with ID: ${emailRecordId}`);

        // --- INIZIO GESTIONE ALLEGATI: Ora che abbiamo emailRecordId ---
        if (email.attachments && email.attachments.length > 0) {
          console.log(`MAIL_PROCESSOR: Found ${email.attachments.length} attachments for email ID ${emailRecordId}. Attempting upload and metadata save.`);
          for (const attachment of email.attachments) {
            console.log(`MAIL_PROCESSOR: Processing attachment: ${attachment.filename || 'N/A'}, Type: ${attachment.contentType || 'N/A'}, Size: ${attachment.size || 0} bytes.`);
            
            if (!attachment.content || !(attachment.content instanceof Buffer) || attachment.content.length === 0) {
                console.warn(`MAIL_PROCESSOR: Attachment "${attachment.filename || 'N/A'}" has no valid content (or is empty). Skipping upload for this attachment.`);
                continue;
            }

            try {
              const uniqueFileIdentifier = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
              const storagePath = `${emailRecordId}/${uniqueFileIdentifier}_${attachment.filename}`;

              console.log(`MAIL_PROCESSOR: Attempting to upload "${attachment.filename}" to Storage at path: "email-attachments/${storagePath}"`);
              const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
                .from('email-attachments')
                .upload(storagePath, attachment.content, {
                  contentType: attachment.contentType,
                  upsert: true
                });

              if (uploadError) {
                console.error(`MAIL_PROCESSOR: ERROR uploading attachment "${attachment.filename}" for email ID ${emailRecordId}:`, uploadError.message);
                continue;
              }

              const publicUrlResult = supabaseAdmin.storage
                                .from('email-attachments')
                                .getPublicUrl(uploadData.path);

              const publicUrl = publicUrlResult.data?.publicUrl;
              if (!publicUrl) {
                  console.error(`MAIL_PROCESSOR: ERROR getting public URL for "${attachment.filename}":`, publicUrlResult.error?.message || 'Unknown error getting public URL.');
                  continue;
              }
              console.log(`MAIL_PROCESSOR: Attachment "${attachment.filename}" uploaded successfully. Public URL: ${publicUrl}`);

              const attachmentMetadataToSave = {
                email_id: emailRecordId,
                filename: attachment.filename || 'no-filename',
                mimetype: attachment.contentType || 'application/octet-stream',
                size: attachment.size || 0,
                storage_path: storagePath,
                public_url: publicUrl
              };

              console.log('MAIL_PROCESSOR: Data for email-attachments insert:', JSON.stringify(attachmentMetadataToSave, null, 2));

              console.log(`MAIL_PROCESSOR: Attempting to save attachment metadata for "${attachment.filename}" (email ID ${emailRecordId}).`);
              const { error: saveAttachError } = await supabaseAdmin.from('email-attachments').insert(attachmentMetadataToSave);

              if (saveAttachError) {
                console.error(`MAIL_PROCESSOR: ERROR saving attachment metadata for "${attachment.filename}" (email ID ${emailRecordId}):`, saveAttachError.message || saveAttachError);
              } else {
                console.log(`MAIL_PROCESSOR: Attachment metadata for "${attachment.filename}" saved to DB successfully.`);
              }

            } catch (uploadInnerError) {
              console.error(`MAIL_PROCESSOR: Unhandled error during attachment upload/save for "${attachment.filename || 'N/A'}" (email ID ${emailRecordId}):`, uploadInnerError.message || uploadInnerError);
            }
          }
        } else {
            console.log(`MAIL_PROCESSOR: No attachments found for email ID ${emailRecordId}.`);
        }
        // --- FINE GESTIONE ALLEGATI ---


        // 2. Continua con l'analisi AI
        console.log(`MAIL_PROCESSOR: Initiating AI analysis for email ID ${emailRecordId}...`);
        const aiResult = await analyzeEmailWithAI(email.from, email.subject, email.text || email.html);
        console.log(`MAIL_PROCESSOR: AI analysis complete for email ID ${emailRecordId}. Result: `, aiResult);

        // Determinare il nuovo stato basandosi sull'analisi AI
        let newStatus = 'manual_review'; // Default se l'AI non assegna
        if (aiResult.assigned_to_staff_id) {
            newStatus = 'analyzed'; // Assegnato dall'AI
        }
        
        // 3. Aggiorna l'email nel DB con i risultati dell'AI (status, assigned_to_staff_id, etc. e is_urgent)
        console.log(`MAIL_PROCESSOR: Updating email ID ${emailRecordId} in DB with AI results. New status: ${newStatus}, Is Urgent: ${aiResult.is_urgent}`);
        const { error: updateAIError } = await supabaseAdmin.from('incoming_emails').update({
            assigned_to_staff_id: aiResult.assigned_to_staff_id,
            ai_confidence_score: aiResult.ai_confidence_score,
            ai_reasoning: aiResult.ai_reasoning,
            status: newStatus,
            is_urgent: aiResult.is_urgent, // AGGIUNGI QUI is_urgent
        }).eq('id', emailRecordId);

        if (updateAIError) {
            console.error(`MAIL_PROCESSOR: ERROR updating email ID ${emailRecordId} with AI results: ${updateAIError.message}`);
            throw new Error(`Supabase AI update error: ${updateAIError.message}`);
        }
        console.log(`MAIL_PROCESSOR: AI analysis results successfully updated for email ID ${emailRecordId}.`);

        // 4. Inoltra l'email al destinatario suggerito dall'AI, se presente
        if (aiResult.assigned_to_staff_id && aiResult.assignedStaffEmail) {
            console.log(`MAIL_PROCESSOR: Attempting to forward email ID ${emailRecordId} to ${aiResult.assignedStaffEmail} (Assigned to: ${aiResult.assignedStaffName})...`);
            try {
                const { data: attachmentsToForward, error: fetchAttachError } = await supabaseAdmin
                    .from('email-attachments')
                    .select('filename, mimetype, storage_path')
                    .eq('email_id', emailRecordId);

                let sendgridAttachments = [];
                if (fetchAttachError) {
                    console.error(`MAIL_PROCESSOR: ERROR fetching attachments for forwarding (email ID ${emailRecordId}):`, fetchAttachError.message);
                } else if (attachmentsToForward && attachmentsToForward.length > 0) {
                    console.log(`MAIL_PROCESSOR: Found ${attachmentsToForward.length} attachments to prepare for forwarding.`);
                    for (const attachMeta of attachmentsToForward) {
                        try {
                            const { data: downloadedBlob, error: downloadError } = await supabaseAdmin.storage
                                .from('email-attachments')
                                .download(attachMeta.storage_path);

                            if (downloadError) {
                                console.error(`MAIL_PROCESSOR: ERROR downloading attachment "${attachMeta.filename}" for forwarding:`, downloadError.message);
                                continue;
                            }

                            if (!(downloadedBlob instanceof Blob)) {
                                console.error(`MAIL_PROCESSOR: Expected Blob, received different type for "${attachMeta.filename}". Skipping attachment preparation.`);
                                continue;
                            }

                            const arrayBuffer = await downloadedBlob.arrayBuffer();
                            const bufferContent = Buffer.from(arrayBuffer);
                            const contentBase64 = bufferContent.toString('base64');
                            
                            sendgridAttachments.push({
                                content: contentBase64,
                                filename: attachMeta.filename,
                                type: attachMeta.mimetype,
                                disposition: 'attachment',
                            });
                            console.log(`MAIL_PROCESSOR: Attachment "${attachMeta.filename}" prepared for SendGrid.`);

                        } catch (downloadOrEncodeError) {
                            console.error(`MAIL_PROCESSOR: ERROR preparing attachment "${attachMeta.filename}" for SendGrid:`, downloadOrEncodeError.message || downloadOrEncodeError);
                        }
                    }
                }
                
                await sendEmail(
                    aiResult.assignedStaffEmail,
                    email.from.split('<')[0].trim() || email.from,
                    email.from,
                    email.subject,
                    email.text || email.html,
                    aiResult.ai_reasoning,
                    sendgridAttachments // PASSIAMO GLI ALLEGATI QUI
                );

                const { error: forwardStatusError } = await supabaseAdmin.from('incoming_emails').update({
                    status: 'forwarded',
                }).eq('id', emailRecordId);

                if (forwardStatusError) {
                    console.error(`MAIL_PROCESSOR: ERROR updating status to 'forwarded' for ID ${emailRecordId}:`, forwardStatusError.message);
                } else {
                    console.log(`MAIL_PROCESSOR: Email ID ${emailRecordId} successfully forwarded to ${aiResult.assignedStaffEmail} and status updated to 'forwarded'.`);
                }

            } catch (forwardError) {
                console.error(`MAIL_PROCESSOR: ERROR forwarding email ID ${emailRecordId}:`, forwardError);
                await supabaseAdmin.from('incoming_emails').update({
                    status: 'forward_error',
                }).eq('id', emailRecordId);
                console.log(`MAIL_PROCESSOR: Status for email ID ${emailRecordId} updated to 'forward_error'.`);
            }
        } else {
            console.warn(`MAIL_PROCESSOR: Email ID ${emailRecordId} not assigned by AI or missing staff email. No forwarding attempted. Status remains '${newStatus}'.`);
        }

      } catch (innerError) {
        console.error(`MAIL_PROCESSOR: Critical ERROR processing single email (ID ${emailRecordId || 'N/A'}):`, innerError.message);
        if (emailRecordId) {
            console.log(`MAIL_PROCESSOR: Attempting to update email ID ${emailRecordId} status to 'processing_error'.`);
            await supabaseAdmin.from('incoming_emails').update({
                status: 'processing_error',
            }).eq('id', emailRecordId);
            console.log(`MAIL_PROCESSOR: Status for email ID ${emailRecordId} updated to 'processing_error'.`);
        }
      }
    }
  } catch (globalError) {
    console.error('MAIL_PROCESSOR: Global ERROR during email processing cycle:', globalError);
  }
  console.log('MAIL_PROCESSOR: Email processing cycle finished.');
}