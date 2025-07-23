import { defineEventHandler, readBody } from 'h3';
import sgMail from '@sendgrid/mail';
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const supabaseAdmin = getSupabaseAdminClient();
  sgMail.setApiKey(config.sendgridApiKey);

  const { originalEmailId, replyText, employeeEmail } = await readBody(event);

  if (!originalEmailId || !replyText || !employeeEmail) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields for reply.' });
  }

  // 1. Recupera i dettagli dell'email originale per sapere a chi rispondere.
  const { data: originalEmail, error: fetchError } = await supabaseAdmin
    .from('incoming_emails')
    .select('sender, subject, reference')
    .eq('id', originalEmailId)
    .single();

  if (fetchError || !originalEmail) {
    throw createError({ statusCode: 404, statusMessage: 'Original email not found.' });
  }

  // 2. Invia l'email di risposta usando SendGrid
  const msg = {
    to: originalEmail.sender, // Rispondi al mittente originale
    from: {
        name: 'Studio Commercialista', // Puoi personalizzarlo
        email: config.senderEmail, // La tua email di invio verificata
    },
    subject: `Re: ${originalEmail.subject}`,
    text: replyText, // Il testo inserito dal dipendente
    headers: {
      'In-Reply-To': `<${originalEmail.reference}>`,
      'References': `<${originalEmail.reference}>`
    }
  };

  try {
    await sgMail.send(msg);
  } catch (error) {
    console.error("Error sending reply via SendGrid:", error.response?.body || error);
    throw createError({ statusCode: 500, statusMessage: 'Failed to send reply email.' });
  }

  // 3. Salva la risposta inviata nel database per tener traccia della conversazione
  const { error: saveReplyError } = await supabaseAdmin
    .from('incoming_emails') // Usiamo la stessa tabella per semplicità
    .insert({
        sender: employeeEmail, // Il mittente è il dipendente/studio
        subject: msg.subject,
        body_text: replyText,
        status: 'replied_by_staff', // Un nuovo stato per le risposte
        // Associa questa risposta all'email originale (richiede modifica allo schema DB)
        // Per ora, lo omettiamo, ma sarebbe ideale avere un campo 'parent_email_id'
    });
    
  if (saveReplyError) {
    // Non blocchiamo l'utente per questo, ma logghiamo l'errore
    console.error("Failed to save staff reply to DB:", saveReplyError);
  }

  // 4. (Opzionale) Aggiorna lo stato dell'email originale a "answered"
  await supabaseAdmin
    .from('incoming_emails')
    .update({ status: 'answered' })
    .eq('id', originalEmailId);


  return { success: true, message: 'Reply sent successfully.' };
});