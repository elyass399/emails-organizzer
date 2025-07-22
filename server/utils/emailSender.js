// server/utils/emailSender.js
import sgMail from '@sendgrid/mail';
import { useRuntimeConfig } from '#imports';

const config = useRuntimeConfig();
sgMail.setApiKey(config.sendgridApiKey);

// AGGIUNTA DI UN NUOVO PARAMETRO 'attachments'
export async function sendEmail(to, fromName, fromAddress, subject, originalBody, aiReasoning, attachments =  []) {
  const SENDER_EMAIL = config.senderEmail;

  const htmlBody = `
    <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 16px; border-radius: 8px;">
      <p><strong>Questa email ÃƒÂ¨ stata smistata automaticamente dal sistema AI.</strong></p>
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
    from: SENDER_EMAIL,
    subject: `[Smistato da AI] ${subject}`,
    html: htmlBody,
    replyTo: fromAddress,
    attachments: attachments
  };

  try {
    await sgMail.send(msg);
    console.log(`Email inoltrata con successo a ${to} tramite SendGrid.`);
  } catch (error) {
    console.error("Errore durante l'inoltro con SendGrid:", error.response?.body || error.message);
    if (error.response?.body?.errors) {
        error.response.body.errors.forEach(e => console.error(`SendGrid Error Detail: ${e.message}`));
    }
    throw error;
  }
}

/**
 * Invia un'email di follow-up e restituisce i suoi dettagli per salvarli nel DB.
 * @returns {Promise<{messageId: string, subject: string, body: string}>}
 */
export async function sendFollowUpRequest(toEmail, clientName, missingInfoDescription, clientid, originalReference = null) {
    const SENDER_EMAIL = config.senderEmail;

    // --- MODIFICA QUI: Definiamo subject e body come variabili ---
    const subject = `Richiesta Informazioni Aggiuntive - Studio Commercialista`;
    const htmlBody = `
      <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 16px; border-radius: 8px;">
        <p>Gentile ${clientName || 'Cliente'},</p>
        <p>Abbiamo ricevuto la sua richiesta.</p>
        <p>${missingInfoDescription}</p>
        <p>La preghiamo di rispondere a questa email fornendoci i dati richiesti per poterla assistere al meglio.</p>
        <p>Grazie per la sua collaborazione.</p>
        <p>Cordiali saluti,<br/>Il team dello Studio Commercialista</p>
        <!-- ID Cliente per tracciamento: ${clientid} -->
      </div>
    `;

    const msg = {
        to: toEmail,
        from: SENDER_EMAIL,
        subject: subject,
        html: htmlBody,
    };
    if (originalReference) {
        msg.headers = {
          'In-Reply-To': `<${originalReference}>`,
          'References': `<${originalReference}>`
        };
    }

    try {
        const response = await sgMail.send(msg);
        console.log(`EMAIL_SENDER: Follow-up email sent successfully to ${toEmail}.`);
        
        // Estrae il message-id di SendGrid per il tracciamento
        const messageId = response[0]?.headers['x-message-id'];
        if (!messageId) {
          console.warn('EMAIL_SENDER: Could not extract x-message-id from SendGrid response.');
        }

        // --- MODIFICA QUI: Restituisce un oggetto con tutti i dettagli ---
        return {
            messageId: messageId || `local-${Date.now()}`, // Fallback in caso di problemi
            subject: subject,
            body: htmlBody
        };

    } catch (error) {
        console.error("EMAIL_SENDER: Error sending follow-up email with SendGrid:", error.response?.body || error.message);
        if (error.response?.body?.errors) {
            error.response.body.errors.forEach(e => console.error(`SendGrid Error Detail: ${e.message}`));
        }
        throw error;
    }
}