// server/utils/emailSender.js
import sgMail from '@sendgrid/mail';
import { useRuntimeConfig } from '#imports';

/**
 * Inoltra un'email analizzata a un membro dello staff, includendo un link per rispondere dall'app.
 * @param {string} to - L'email del membro dello staff.
 * @param {string} fromName - Il nome del mittente originale.
 * @param {string} fromAddress - L'email del mittente originale.
 * @param {string} subject - L'oggetto dell'email originale.
 * @param {string} originalBody - Il corpo dell'email originale.
 * @param {string} aiReasoning - La motivazione fornita dall'AI.
 * @param {Array} attachments - Eventuali allegati da inoltrare.
 * @param {string} conversationId - L'UUID della conversazione, usato per creare il link.
 */
export async function sendEmail(to, fromName, fromAddress, subject, originalBody, aiReasoning, attachments = [], conversationId) {
  const config = useRuntimeConfig();
  const SENDER_EMAIL = config.senderEmail;
  const APP_BASE_URL = config.public.baseUrl;

  sgMail.setApiKey(config.sendgridApiKey);

  // Costruisce il link dinamico che porta direttamente alla conversazione nell'app
  const conversationLink = `${APP_BASE_URL}/?conversation_id=${conversationId}`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; border: 1px solid #e2e8f0; padding: 24px; border-radius: 8px; max-width: 600px; margin: auto; background-color: #ffffff; color: #1a202c;">
      <p style="background-color: #f1f5f9; padding: 12px; border-radius: 6px; border-left: 4px solid #4f46e5; margin: 0 0 24px 0;">
        <strong>Motivazione AI:</strong> <em>${aiReasoning}</em>
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${conversationLink}" target="_blank" style="background-color: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">
          Apri e Rispondi dall'App
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      
      <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Email Originale</h3>
      <p style="margin: 4px 0;"><strong>Da:</strong> ${fromName} <${fromAddress}></p>
      <p style="margin: 4px 0;"><strong>Oggetto:</strong> ${subject}</p>
      
      <div style="border: 1px solid #e2e8f0; padding: 16px; margin-top: 16px; border-radius: 6px; background-color: #f8fafc;">
        <pre style="white-space: pre-wrap; font-family: inherit; font-size: 14px; color: #475569; margin: 0;">${originalBody}</pre>
      </div>
    </div>
  `;

  const msg = {
    to: to,
    from: SENDER_EMAIL,
    subject: `[Smistato da AI] ${subject}`,
    html: htmlBody,
    replyTo: fromAddress,
    attachments: attachments
  };

  try {
    await sgMail.send(msg);
    console.log(`Email inoltrata con successo a ${to} con link di risposta.`);
  } catch (error) {
    console.error("Errore durante l'inoltro con SendGrid:", error.response?.body || error.message);
    throw error;
  }
}

/**
 * Invia un'email di follow-up come RISPOSTA a un'email esistente per richiedere informazioni mancanti.
 * @param {string} toEmail L'email del cliente.
 * @param {string} clientName Il nome del cliente (può essere null).
 * @param {string} missingInfoDescription La descrizione dei dati mancanti.
 * @param {string} originalMessageId L'ID del messaggio originale a cui rispondere.
 * @param {string} originalSubject L'oggetto del messaggio originale.
 * @returns {Promise<object>} Un oggetto con i dettagli dell'email inviata.
 */
export async function sendFollowUpRequest(toEmail, clientName, missingInfoDescription, originalMessageId, originalSubject) {
  const config = useRuntimeConfig();
  const SENDER_EMAIL = config.senderEmail;
  sgMail.setApiKey(config.sendgridApiKey);
  
  const subject = `Re: ${originalSubject}`;
  const bodyText = `Gentile ${clientName || 'Cliente'},
In riferimento alla sua email riguardo "${originalSubject}", la ringraziamo per averci contattato.

${missingInfoDescription}

La preghiamo di rispondere direttamente a questa email fornendoci i dati richiesti.
Grazie per la sua collaborazione.

Cordiali saluti,
Il team dello Studio Commercialista`;

    const msg = {
        to: toEmail,
        from: {
            name: 'Studio Commercialista',
            email: SENDER_EMAIL,
        },
        subject: subject,
        text: bodyText,
        headers: {}
    };

    if (originalMessageId) {
        const cleanMessageId = originalMessageId.replace(/<|>/g, '');
        msg.headers['In-Reply-To'] = `<${cleanMessageId}>`;
        msg.headers['References'] = `<${cleanMessageId}>`;
    }

    try {
        const response = await sgMail.send(msg);
        console.log(`EMAIL_SENDER: Follow-up email sent successfully to ${toEmail}.`);
        const messageId = response[0]?.headers['x-message-id'];
        return { 
            messageId: messageId || `local-${Date.now()}`, 
            subject: subject, 
            body: bodyText 
        };
    } catch (error) {
        console.error("EMAIL_SENDER: Error sending follow-up email with SendGrid:", error.response?.body || error.message);
        throw error;
    }
}


/**
 * Invia un'email di benvenuto che invita l'utente ad andare sulla pagina di reset password.
 * @param {string} toEmail - L'email del nuovo membro dello staff.
 * @param {string} firstName - Il nome del nuovo membro dello staff.
 * @param {string} resetPageLink - Il link alla pagina /reset-password.
 */
export async function sendWelcomeInviteEmail(toEmail, firstName, resetPageLink) {
  const config = useRuntimeConfig();
  const SENDER_EMAIL = config.senderEmail;
  sgMail.setApiKey(config.sendgridApiKey);

  const subject = `Benvenuto nel team, ${firstName}! Imposta il tuo account.`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; border: 1px solid #e2e8f0; padding: 24px; border-radius: 8px; max-width: 600px; margin: auto; background-color: #ffffff; color: #1a202c;">
      <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">Benvenuto a bordo, ${firstName}!</h2>
      <p>Il tuo account è stato creato sulla nostra piattaforma di gestione email.</p>
      <p>Per completare la configurazione e accedere, devi impostare una password. Clicca sul pulsante qui sotto per andare alla pagina di impostazione password, dove dovrai inserire la tua email per ricevere un link sicuro.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetPageLink}" target="_blank" style="background-color: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">
          Imposta la tua Password
        </a>
      </div>
      <p style="font-size: 12px; color: #64748b; text-align: center;">Questo pulsante ti porterà alla pagina dove potrai richiedere il link per creare la tua password.</p>
    </div>
  `;

  const msg = {
    to: toEmail,
    from: {
      name: 'Admin - Piattaforma Gestione Email',
      email: SENDER_EMAIL
    },
    subject: subject,
    html: htmlBody,
  };

  try {
    await sgMail.send(msg);
    console.log(`Email di invito (step 1) inviata con successo a ${toEmail}.`);
  } catch (error) {
    console.error("Errore invio email di invito:", error.response?.body || error.message);
    // Non rilanciare l'errore per non bloccare la risposta all'admin, ma loggalo.
  }
}