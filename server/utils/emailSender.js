// server/utils/emailSender.js
import sgMail from '@sendgrid/mail';
import { useRuntimeConfig } from '#imports';

const config = useRuntimeConfig();
sgMail.setApiKey(config.sendgridApiKey);

export async function sendEmail(to, fromName, fromAddress, subject, originalBody, aiReasoning) {
  const SENDER_EMAIL = config.senderEmail; // L'email verificata in SendGrid (test@aitaky.it)

  const htmlBody = `
    <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 16px; border-radius: 8px;">
      <p><strong>Questa email è stata smistata automaticamente dal sistema AI.</strong></p>
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
  };

  try {
    await sgMail.send(msg);
    console.log(`Email inoltrata con successo a ${to} tramite SendGrid.`);
  } catch (error) {
    console.error("Errore durante l'inoltro con SendGrid:", error.response?.body || error.message);
    throw error; // Rilancia l'errore per gestirlo nel chiamante
  }
}