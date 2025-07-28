// server/utils/mailProcessor.js
import { fetchNewEmails } from './imapClient';
import { analyzeEmailWithAI, extractClientInfoWithAI } from './aiService';
import { sendEmail, sendFollowUpRequest } from './emailSender';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { upsertClient, getClient } from './clientManager';

async function findAwaitingConversationByEmail(supabaseAdmin, clientEmail) {
    // ... (invariato)
}

export async function processNewIncomingEmails() {
    console.log('CONVERSATION_PROCESSOR: Starting email processing cycle...');
    const config = useRuntimeConfig();
    const supabaseAdmin = getSupabaseAdminClient();

    try {
        const incomingRawEmails = await fetchNewEmails(config);
        console.log(`CONVERSATION_PROCESSOR: Fetched ${incomingRawEmails.length} new emails.`);

        for (const email of incomingRawEmails) {
            const fromAsString = email.from?.text || 'sconosciuto@sconosciuto.com';
            console.log(`\n--- Processing email from "${fromAsString}" ---`);

            try {
                const clientEmailFromHeader = fromAsString.match(/<(.+)>/)?.[1] || fromAsString;
                const currentMessageIdClean = (email.messageId || '').replace(/<|>/g, '');

                let conversationId = await findAwaitingConversationByEmail(supabaseAdmin, clientEmailFromHeader);

                if (conversationId) {
                    // ... (logica per le risposte, invariata)
                } else {
                    console.log(`It's a new conversation thread.`);
                    // Unica chiamata a upsert, dopo l'analisi AI
                    const aiResult = await analyzeEmailWithAI(fromAsString, email.subject, email.text || email.html);
                    const clientNameFromHeader = fromAsString.replace(/<.+>/, '').trim().replace(/"/g, '') || null;
                    await upsertClient(clientEmailFromHeader, aiResult.client_name || clientNameFromHeader, aiResult.client_phone_number, aiResult.client_city, null);

                    const updatedClient = await getClient(clientEmailFromHeader);
                    if (!updatedClient) throw new Error(`Failed to process client for ${clientEmailFromHeader}`);
                    
                    // --- LOGICA DI CONTROLLO MIGLIORATA ---
                    const missingFields = [];
                    // Un nome è considerato mancante se non c'è o non contiene uno spazio
                    if (!updatedClient.name || updatedClient.name.trim().indexOf(' ') === -1) {
                        missingFields.push("nome e cognome");
                    }
                    if (!updatedClient.phone_number) {
                        missingFields.push("numero di telefono");
                    }
                    if (!updatedClient.city) {
                        missingFields.push("comune/città");
                    }

                    const hasMissingInfo = missingFields.length > 0;
                    
                    // Aggiungiamo un log per il debug
                    console.log('DEBUG: Client data check:', {
                        name: updatedClient.name,
                        phone: updatedClient.phone_number,
                        city: updatedClient.city,
                        hasMissingInfo: hasMissingInfo,
                        missingFields: missingFields
                    });
                    // --- FINE LOGICA DI CONTROLLO ---

                    const { data: newConversation } = await supabaseAdmin.from('conversations').insert({
                        subject: email.subject,
                        client_id: updatedClient.id,
                        assigned_to_staff_id: aiResult.assigned_to_staff_id,
                        status: hasMissingInfo ? 'awaiting_client' : 'open'
                    }).select().single();
                    conversationId = newConversation.id;

                    await supabaseAdmin.from('incoming_emails').insert({
                        conversation_id: conversationId, sender: fromAsString, subject: email.subject,
                        body_text: email.text, body_html: email.html, reference: currentMessageIdClean,
                        sender_type: 'client', is_urgent: aiResult.is_urgent
                    });

                    if (hasMissingInfo) {
                        console.log(`Client ${clientEmailFromHeader} has missing info. Sending follow-up.`);
                        const missingInfoDescription = `Per assisterla al meglio, la preghiamo di fornirci: ${missingFields.join(', ')}.`;
                        
                        const sentFollowUp = await sendFollowUpRequest(clientEmailFromHeader, updatedClient.name, missingInfoDescription, currentMessageIdClean, email.subject);
                        
                        await supabaseAdmin.from('incoming_emails').insert({
                            conversation_id: conversationId, sender: 'Studio Commercialista', subject: sentFollowUp.subject,
                            body_text: sentFollowUp.body, sender_type: 'staff',
                            reference: (sentFollowUp.messageId || '').replace(/<|>/g, '')
                        });
                        await supabaseAdmin.from('clients').update({ follow_up_email_sent: true, follow_up_sent_at: new Date().toISOString() }).eq('id', updatedClient.id);
                    } else {
                        console.log(`Client ${clientEmailFromHeader} has all info. Forwarding to staff.`);
                        if (aiResult.assigned_to_staff_id && aiResult.assignedStaffEmail) {
                            await sendEmail(
                                aiResult.assignedStaffEmail, fromAsString.replace(/<.+>/, '').trim(),
                                clientEmailFromHeader, email.subject, email.text || email.html,
                                aiResult.ai_reasoning, [], conversationId
                            );
                        }
                    }
                }
            } catch (innerError) {
                console.error(`CONVERSATION_PROCESSOR: Critical ERROR processing single email:`, innerError.message, innerError.stack);
            }
        }
    } catch (globalError) {
        console.error('CONVERSATION_PROCESSOR: Global ERROR during cycle:', globalError);
    }
    console.log('CONVERSATION_PROCESSOR: Email processing cycle finished.');
}