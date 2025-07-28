// server/api/emails/reply.post.js
import { defineEventHandler, readBody } from 'h3';
import sgMail from '@sendgrid/mail';
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const supabaseAdmin = getSupabaseAdminClient();
  sgMail.setApiKey(config.sendgridApiKey);

  const { conversationId, replyText, employeeEmail } = await readBody(event);

  if (!conversationId || !replyText || !employeeEmail) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fields for reply.' });
  }

  // 1. Recupera i dettagli della conversazione e l'ultima email per il threading
  const { data: conversation, error: convError } = await supabaseAdmin
    .from('conversations')
    .select(`*, client:client_id (email), last_email:incoming_emails (reference, subject)`)
    .eq('id', conversationId)
    .order('created_at', { referencedTable: 'incoming_emails', ascending: false })
    .limit(1, { referencedTable: 'incoming_emails' })
    .single();

  if (convError || !conversation) {
    throw createError({ statusCode: 404, statusMessage: 'Conversation not found.' });
  }

  const clientEmail = conversation.client.email;
  const lastMessage = conversation.last_email[0];
  const subject = lastMessage.subject.startsWith('Re: ') ? lastMessage.subject : `Re: ${lastMessage.subject}`;
  
  // 2. Invia l'email di risposta
  const msg = {
    to: clientEmail,
    from: { name: 'Studio Commercialista', email: config.senderEmail },
    subject: subject,
    text: replyText,
    headers: {}
  };

  if (lastMessage.reference) {
    const cleanMessageId = lastMessage.reference.replace(/<|>/g, '');
    msg.headers['In-Reply-To'] = `<${cleanMessageId}>`;
    msg.headers['References'] = `<${cleanMessageId}>`;
  }

  let sentMessageId = null;
  try {
    const response = await sgMail.send(msg);
    sentMessageId = response[0]?.headers['x-message-id'];
  } catch (error) {
    console.error("Error sending reply via SendGrid:", error.response?.body || error);
    throw createError({ statusCode: 500, statusMessage: 'Failed to send reply email.' });
  }

  // 3. Salva la risposta dello staff nel database
  const { error: saveReplyError } = await supabaseAdmin
    .from('incoming_emails')
    .insert({
        conversation_id: conversationId,
        sender: employeeEmail,
        subject: msg.subject,
        body_text: replyText,
        sender_type: 'staff',
        reference: sentMessageId
    });
    
  if (saveReplyError) {
    console.error("Failed to save staff reply to DB:", saveReplyError);
  }

  // 4. Aggiorna lo stato della conversazione
  await supabaseAdmin
    .from('conversations')
    .update({ status: 'awaiting_client' })
    .eq('id', conversationId);

  return { success: true, message: 'Reply sent successfully.' };
});