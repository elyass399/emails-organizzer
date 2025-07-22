// server/utils/emailSender.js
import sgMail from '@sendgrid/mail';
import { useRuntimeConfig } from '#imports';

const config = useRuntimeConfig();
sgMail.setApiKey(config.sendgridApiKey);

export async function sendEmail(to, fromName, fromAddress, subject, originalBody, aiReasoning, attachments = []) {
    // ... questa funzione non cambia
}

/**
 * Invia un'email di follow-up come risposta a un'email precedente.
 * @param {string} toEmail - L'email del cliente.
 * @param {string} clientName - Il nome del cliente.
 * @param {string} missingInfoDescription - La descrizione delle info mancanti.
 * @param {string} clientId - L'ID del cliente per tracciamento interno.
 * @param {string | null} originalMessageId - Il Message-ID dell'email a cui rispondere.
 * @param {string} originalSubject - Il soggetto dell'email a cui rispondere.
 * @returns {Promise<{messageId: string, subject: string, body: string}>}
 */
export async function sendFollowUpRequest(toEmail, clientName, missingInfoDescription, clientId, originalMessageId = null, originalSubject = 'la sua richiesta') {
    const SENDER_EMAIL = config.senderEmail;

    // --- MODIFICA CHIAVE QUI: Il soggetto ora include "Re:" + soggetto originale ---
    const subject = `Re: ${originalSubject}`;
    
    const htmlBody = `
      <div style="font-family: sans-serif; font-size: 14px; color: #333;">
        <p>Gentile ${clientName || 'Cliente'},</p>
        <p>In riferimento alla sua email riguardo "${originalSubject}", la ringraziamo per averci contattato.</p>
        <p>${missingInfoDescription}</p>
        <p>La preghiamo di rispondere direttamente a questa email fornendoci i dati richiesti.</p>
        <p>Grazie per la sua collaborazione.</p>
        <p>Cordiali saluti,<br/>Il team dello Studio Commercialista</p>
        <!-- ID Cliente: ${clientId} -->
      </div>
    `;

    const msg = {
        to: toEmail,
        from: {
            name: 'Studio Commercialista', // Nome mittente personalizzato
            email: SENDER_EMAIL,
        },
        subject: subject,
        html: htmlBody,
        headers: {}
    };

    if (originalMessageId) {
        console.log(`EMAIL_SENDER: Setting In-Reply-To and References to: ${originalMessageId}`);
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
            body: htmlBody
        };

    } catch (error) {
        console.error("EMAIL_SENDER: Error sending follow-up email with SendGrid:", error.response?.body || error.message);
        throw error;
    }
}