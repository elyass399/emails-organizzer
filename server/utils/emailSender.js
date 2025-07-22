// server/utils/emailSender.js
import sgMail from '@sendgrid/mail';
import { useRuntimeConfig } from '#imports';

const config = useRuntimeConfig();
sgMail.setApiKey(config.sendgridApiKey);

// AGGIUNTA DI UN NUOVO PARAMETRO 'attachments'
export async function sendEmail(to, fromName, fromAddress, subject, originalBody, aiReasoning, attachments =  []) {
  const SENDER_EMAIL = config.senderEmail; // L'email verificata in SendGrid (test@aitaky.it)

  const htmlBody = `
    <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 16px; border-radius: 8px;">
      <p><strong>Questa email Ã¨ stata smistata automaticamente dal sistema AI.</strong></p>
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
    from: SENDER_EMAIL, // Usa l'email configurata in .env e verificata in SendGrid
    subject: `[Smistato da AI] ${subject}`,
    html: htmlBody,
    replyTo: fromAddress, // Permette di rispondere direttamente al cliente originale
    attachments: attachments // PASSIAMO GLI ALLEGATI A SENDGRID QUI
  };

  try {
    await sgMail.send(msg);
    console.log(`Email inoltrata con successo a ${to} tramite SendGrid.`);
  } catch (error) {
    console.error("Errore durante l'inoltro con SendGrid:", error.response?.body || error.message);
    // Puoi anche loggare dettagli specifici se l'errore Ã¨ un SendGridError (es. allegati troppo grandi)
    if (error.response && error.response.body && error.response.body.errors) {
        error.response.body.errors.forEach(e => console.error(`SendGrid Error Detail: ${e.message}`));
    }
    throw error; // Rilancia l'errore per gestirlo nel chiamante
  }
}

// NUOVA FUNZIONE PER L'EMAIL DI FOLLOW-UP
export async function sendFollowUpRequest(toEmail, clientName, missingInfoDescription , clientid, originalReference = null) {
    const SENDER_EMAIL = config.senderEmail; // L'email verificata in SendGrid

    const subject = `Richiesta Informazioni Aggiuntive - Studio Commercialista`;
    const htmlBody = `
  <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 16px; border-radius: 8px;">
    <p>Gentile ${clientName || 'Cliente'},</p>
    <p>Abbiamo ricevuto la sua email e la stiamo processando.</p>
    <p>Per poterla assistere al meglio e completare la sua richiesta in modo efficiente, avremmo bisogno di alcune informazioni aggiuntive:</p>
    <p><strong>${missingInfoDescription}</strong></p>
    <p>La preghiamo di rispondere a questa email fornendoci le informazioni richieste.</p>
    <p>Grazie per la sua collaborazione.</p>
    <p>Cordiali saluti,<br/>Il team dello Studio Commercialista</p>
  </div>
`;

    const msg = {
        to: toEmail,
        from: SENDER_EMAIL,
        subject: subject,
        html: htmlBody,
        // Non impostiamo replyTo qui per evitare loop, ma il cliente può rispondere direttamente
    };
    if (originalReference) {
        const originalMessageId = originalReference;
        msg.headers = {
          'In-Reply-To': originalMessageId,
          'References': originalMessageId
        };
    }
    try {
        await sgMail.send(msg);
        console.log(`EMAIL_SENDER: Follow-up email sent successfully to ${toEmail}.`);
    } catch (error) {
        console.error("EMAIL_SENDER: Error sending follow-up email with SendGrid:", error.response?.body || error.message);
        if (error.response && error.response.body && error.response.body.errors) {
            error.response.body.errors.forEach(e => console.error(`SendGrid Error Detail: ${e.message}`));
        }
        throw error;
    }
}