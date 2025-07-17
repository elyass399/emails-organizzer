// File: server/api/emails/process.post.js

import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3';
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'; // CAMBIATO: Usa il client Admin
import { analyzeEmailWithAI } from '../../utils/aiService'; // Funzione centralizzata per l'analisi AI
import { sendEmail } from '../../utils/emailSender';     // Funzione centralizzata per l'invio email

export default defineEventHandler(async (event) => {
  const supabaseAdmin = getSupabaseAdminClient(); // Usa il client Supabase Admin
  const body = await readBody(event);
  const { sender, subject, body_text } = body;

  console.log('API Manual Process POST: Ricevuti dati ->', { sender, subject: subject ? subject.substring(0, 50) + '...' : 'N/A' });

  if (!sender || !subject || !body_text) {
    throw createError({ statusCode: 400, statusMessage: 'Mittente, oggetto o corpo email mancanti.' });
  }

  let emailRecordId = null; // ID dell'email nel DB, per aggiornamenti successivi

  try {
    // 1. Salva l'email nel database con stato 'new'
    const { data: savedEmail, error: saveError } = await supabaseAdmin.from('incoming_emails').insert([{ // CAMBIATO: usa supabaseAdmin
        sender: sender,
        subject: subject,
        body_text: body_text,
        // body_html: null, // Non abbiamo HTML dal form manuale, quindi null
        status: 'new',
    }]).select().single();

    if (saveError) {
        console.error('API Supabase save error (process.post):', saveError.message);
        throw createError({ statusCode: 500, statusMessage: `Errore durante il salvataggio dell'email: ${saveError.message}` });
    }
    emailRecordId = savedEmail.id;
    console.log(`API Manual Process POST: Manual email saved to DB with ID: ${emailRecordId}`);

    // 2. Analisi AI
    console.log(`API Manual Process POST: Avvio analisi AI per email ID ${emailRecordId}...`);
    const aiResult = await analyzeEmailWithAI(sender, subject, body_text);
    console.log(`API Manual Process POST: Risultato analisi AI per ID ${emailRecordId}:`, aiResult);
    
    // 3. Aggiorna l'email nel DB con i risultati dell'AI
    const newStatus = aiResult.assigned_to_staff_id ? 'analyzed' : 'manual_review';
    const { error: updateError } = await supabaseAdmin.from('incoming_emails').update({ // CAMBIATO: usa supabaseAdmin
        assigned_to_staff_id: aiResult.assigned_to_staff_id,
        ai_confidence_score: aiResult.ai_confidence_score,
        ai_reasoning: aiResult.ai_reasoning,
        status: newStatus,
    }).eq('id', emailRecordId);

    if (updateError) {
        console.error('API Supabase AI update error (process.post):', updateError.message);
        throw createError({ statusCode: 500, statusMessage: `Errore durante l'aggiornamento AI dell'email: ${updateError.message}` });
    }
    console.log(`API Manual Process POST: AI analysis updated for manual email ID ${emailRecordId}. Assigned to staff: ${aiResult.assigned_to_staff_id || 'N/A'}`);

    // 4. Se l'AI ha assegnato e trovato un'email, inoltra l'email
    let assignedStaffMember = null;
    if (aiResult.assigned_to_staff_id && aiResult.assignedStaffEmail) {
        try {
            console.log(`API Manual Process POST: Tentativo di inoltro email ID ${emailRecordId} a ${aiResult.assignedStaffEmail}...`);
            await sendEmail(
                aiResult.assignedStaffEmail,
                sender.split('<')[0].trim() || sender, // Nome dal mittente originale
                sender, // Email mittente originale
                subject,
                body_text, // Invia il testo originale
                aiResult.ai_reasoning
            );
            // Aggiorna lo stato a 'forwarded'
            await supabaseAdmin.from('incoming_emails').update({ // CAMBIATO: usa supabaseAdmin
                status: 'forwarded'
            }).eq('id', emailRecordId);

            assignedStaffMember = { 
                id: aiResult.assigned_to_staff_id, 
                name: aiResult.assignedStaffName, 
                email: aiResult.assignedStaffEmail 
            };
            console.log(`API Manual Process POST: Manual email ID ${emailRecordId} successfully forwarded to ${aiResult.assignedStaffEmail}`);

        } catch (forwardError) {
            console.error('API Error during manual email forwarding (process.post):', forwardError);
            // Aggiorna lo stato a 'forward_error'
            await supabaseAdmin.from('incoming_emails').update({ // CAMBIATO: usa supabaseAdmin
                status: 'forward_error'
            }).eq('id', emailRecordId);
            throw createError({ statusCode: 500, statusMessage: `Errore durante l'inoltro dell'email: ${forwardError.message}` });
        }
    } else {
        console.warn(`API Manual Process POST: Manual email ID ${emailRecordId} not assigned by AI or missing staff email. Status set to 'manual_review'.`);
        // Lo stato Ã¨ giÃ  'manual_review' dal passo precedente
    }

    setResponseStatus(event, 200);
    return { 
      status: 'success',
      message: 'Email processata e assegnata con successo.', 
      assignment: assignedStaffMember, 
      emailRecord: savedEmail 
    };

  } catch (error) {
    console.error('Unhandled error in process.post.js:', error);
    // Se c'Ã¨ un errore e emailRecordId Ã¨ noto, prova ad aggiornare lo stato a 'processing_error'
    if (emailRecordId) {
        await supabaseAdmin.from('incoming_emails').update({ // CAMBIATO: usa supabaseAdmin
            status: 'processing_error',
            // error_message: error.message // Se hai un campo per i messaggi di errore
        }).eq('id', emailRecordId);
    }
    setResponseStatus(event, error.statusCode || 500);
    return { 
        status: 'error',
        message: error.statusMessage || 'Si Ã¨ verificato un errore imprevisto.',
        details: error.message // Per dettagli nell'errore frontend
    };
  }
});