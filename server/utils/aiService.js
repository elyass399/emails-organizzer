// server/utils/aiService.js
import { useRuntimeConfig } from '#imports';
import { $fetch } from 'ofetch';
import { getSupabaseAdminClient } from './supabaseAdmin';

const config = useRuntimeConfig();
const GOOGLE_API_KEY = config.googleApiKey;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`;

const PROMPT_EMAIL_TRIAGE = `
Sei un assistente AI super efficiente per uno studio di commercialisti. Il tuo compito ÃƒÆ’Ã‚Â¨ analizzare un'email in arrivo e assegnarla al membro dello staff piÃƒÆ’Ã‚Â¹ appropriato.

Inoltre, devi determinare se l'email ÃƒÆ’Ã‚Â¨ URGENTE. Un'email ÃƒÆ’Ã‚Â¨ urgente se contiene parole come "urgente",  "ora", "subito", "immediato", "critico", "deadline", "scadenza", o se il contesto implica una richiesta che richiede attenzione immediata.

Infine, devi estrarre le informazioni di contatto del mittente come nome completo, numero di telefono e comune, se presenti nel corpo dell'email.

Ecco la lista del personale e delle loro responsabilitÃƒÆ’Ã‚Â . Ogni membro ha un ID unico (UUID).
--- LISTA PERSONALE ---
{staff_list}
-----------------------

Analizza il seguente contenuto dell'email (mittente, oggetto e corpo) e determina:
1.Se nella mail trovi un commento html con dentro un tag span, prendi il contenuto del tag span e usalo come clientid. Se non lo trovi, procedi coi punti sotto, altrimenti restituisci l'oggetto JSON con clientid, telefono e comune che trovi analizzando il corpo della mail. Se trovi tutto, restituisci e metti nell'oggetto un indice 'followUpDone' settato a 1, altrimenti metti 'followUpDone' a 2 se manca qualche campo.
2. Quale persona dello staff ÃƒÆ’Ã‚Â¨ il piÃƒÆ’Ã‚Â¹ adatto a gestirla.
3. Se l'email ÃƒÆ’Ã‚Â¨ urgente.
4. Se il nome completo del mittente ÃƒÆ’Ã‚Â¨ presente.
5. Se il numero di telefono del mittente ÃƒÆ’Ã‚Â¨ presente.
6. Se il comune/cittÃƒÆ’Ã‚Â  del mittente ÃƒÆ’Ã‚Â¨ presente.

--- CONTENUTO EMAIL ---
Mittente: {email_from}
Oggetto: {email_subject}
Corpo: {email_body}
-----------------------

La tua risposta DEVE essere un oggetto JSON con il seguente formato, senza alcun testo aggiuntivo:
{
  "assigned_to_staff_id": "L'UUID ESATTO del dipendente scelto dalla LISTA PERSONALE sopra. Non inventare o alterare gli UUID. Se NESSUNO nella lista sembra appropriato o non sei sicuro, DEVI restituire null.",
  "ai_confidence_score": un numero da 0.0 (per niente sicuro) a 1.0 (molto sicuro),
  "ai_reasoning": "Una breve frase che spiega perchÃƒÆ’Ã‚Â© hai scelto quel dipendente/ufficio e se l'email ÃƒÆ’Ã‚Â¨ considerata urgente.",
  "is_urgent": true/false, // Indica se l'email ÃƒÆ’Ã‚Â¨ urgente in base al contenuto.
  "client_name": "Il nome completo del mittente estratto dal corpo dell'email, se presente. Restituisci null se non trovato.", // NUOVO
  "client_phone_number": "Il numero di telefono estratto dal corpo dell'email, se presente. Restituisci null se non trovato.",
  "client_city": "Il comune o la cittÃƒÆ’Ã‚Â  estratti dal corpo dell'email, se presenti. Restituisci null se non trovato."
}
`;

// --- PROMPT CORRETTA E SPECIFICA PER L'ESTRAZIONE ---
const PROMPT_INFOS_EXTRACTION =`
Sei un assistente AI il cui unico compito Ã¨ estrarre informazioni di contatto da un testo.
Analizza il seguente corpo dell'email e estrai nome, numero di telefono e comune/cittÃ  del mittente.

--- CORPO EMAIL ---
{email_body}
--------------------

La tua risposta DEVE essere un oggetto JSON con il seguente formato, senza alcun testo aggiuntivo:
{
  "client_name": "Il nome completo del mittente se trovato, altrimenti null.",
  "client_phone_number": "Il numero di telefono se trovato, altrimenti null.",
  "client_city": "Il comune o la cittÃ  se trovati, altrimenti null."
}
`;

/**
 * NUOVA FUNZIONE: Estrae solo le informazioni del cliente da un'email.
 * PiÃ¹ leggera ed economica, da usare per le risposte ai follow-up.
 * @param {string} body_text - Il corpo dell'email da analizzare.
 * @returns {Promise<object>} Un oggetto con { client_name, client_phone_number, client_city }.
 */
export async function extractClientInfoWithAI(body_text) {
    const finalPrompt = PROMPT_INFOS_EXTRACTION.replace('{email_body}', body_text ? body_text.substring(0, 4000) : 'No body text provided');
    const defaultResponse = { client_name: null, client_phone_number: null, client_city: null };

    try {
        console.log('AI_SERVICE (Info Extraction): Sending request to Gemini...');
        const response = await $fetch.raw(GEMINI_API_URL, {
            method: 'POST',
            body: { contents: [{ parts: [{ text: finalPrompt }] }] },
            headers: { 'Content-Type': 'application/json' },
        });

        const responseData = response._data;
        const rawResponseText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawResponseText) {
            console.error('AI_SERVICE (Info Extraction): Gemini did not return valid text content.');
            return defaultResponse;
        }
        
        console.log('AI_SERVICE (Info Extraction): Raw text response from Gemini:', rawResponseText);

        const jsonMatch = rawResponseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        let jsonString = jsonMatch ? jsonMatch[1].trim() : rawResponseText.trim();
        
        const extractedData = JSON.parse(jsonString);
        console.log('AI_SERVICE (Info Extraction): Parsed AI response JSON:', extractedData);

        return {
            client_name: extractedData.client_name || null,
            client_phone_number: extractedData.client_phone_number || null,
            client_city: extractedData.client_city || null,
        };

    } catch (e) {
        console.error("AI_SERVICE (Info Extraction): Error calling Gemini API or parsing JSON:", e.message);
        return defaultResponse; // Restituisce un oggetto vuoto in caso di errore
    }
}


export async function analyzeEmailWithAI(sender, subject, body_text) {
    const supabaseAdmin = getSupabaseAdminClient();
    
    // --- FIX #1: Seleziona i campi 'first_name' e 'last_name' invece di 'name' ---
    const { data: staff, error: staffError } = await supabaseAdmin.from('staff').select('id, first_name, last_name, text_skills, skills, email');
    
    if (staffError) {
        console.error('AI_SERVICE: Error fetching staff for AI:', staffError.message);
        throw new Error('Impossibile caricare il personale per l\'analisi AI.');
    }
    if (!staff || staff.length === 0) {
        console.warn('AI_SERVICE: Nessun personale configurato nel database per l\'analisi AI.');
        return {
            assigned_to_staff_id: null,
            ai_confidence_score: 0.1,
            ai_reasoning: "Nessun personale configurato per l'assegnazione.",
            assignedStaffEmail: null,
            assignedStaffName: null,
            is_urgent: false, 
            client_name: null,
            client_phone_number: null,
            client_city: null,
        };
    }

    const staffListForPrompt = staff.map(s => {
      const skillsDescription = s.skills && s.skills.length > 0
        ? `Competenze: ${s.skills.join(', ')}`
        : `Descrizione: ${s.text_skills}`;
      
      // --- FIX #2: Usa 'first_name' e 'last_name' per costruire il nome completo ---
      return `ID: ${s.id}, Nome: ${s.first_name} ${s.last_name}, ${skillsDescription}, Email: ${s.email}`;
    }).join('\n');

    const finalPrompt = PROMPT_EMAIL_TRIAGE
        .replace('{staff_list}', staffListForPrompt)
        .replace('{email_from}', sender)
        .replace('{email_subject}', subject)
        .replace('{email_body}', body_text ? body_text.substring(0, 4000) : 'No body text provided');

    let aiResponse;
    try {
        console.log('AI_SERVICE: Sending request to Gemini...');
        const response = await $fetch.raw(GEMINI_API_URL, {
            method: 'POST',
            body: { contents: [{ parts: [{ text: finalPrompt }] }] },
            headers: { 'Content-Type': 'application/json' },
        });
        const responseData = response._data;
        const rawResponseText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('AI_SERVICE: Gemini response received:', rawResponseText);
        if (!rawResponseText) {
            console.error('AI_SERVICE: Gemini did not return valid text content.');
            throw new Error('Risposta non valida o malformata da Gemini: contenuto testuale mancante.');
        }

        console.log('AI_SERVICE: Raw text response from Gemini (partial):', rawResponseText.substring(0, Math.min(rawResponseText.length, 500)) + '...');

        const jsonMatch = rawResponseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        let jsonString = '';
        if (jsonMatch && jsonMatch[1]) {
            jsonString = jsonMatch[1].trim();
            console.log('AI_SERVICE: JSON block extracted via regex.');
        } else {
            console.warn('AI_SERVICE: No markdown JSON block found. Attempting to parse entire response as JSON.');
            jsonString = rawResponseText.trim();
        }

        try {
            aiResponse = JSON.parse(jsonString);
            console.log('AI_SERVICE: Parsed AI response JSON:', JSON.stringify(aiResponse));
            console.log(`AI_SERVICE: Extracted client data - Name: ${aiResponse.client_name}, Phone: ${aiResponse.client_phone_number}, City: ${aiResponse.client_city}`);
        } catch (parseError) {
            console.error('AI_SERVICE: Error parsing JSON from Gemini:', parseError);
            console.error('AI_SERVICE: Malformed JSON string received:', jsonString);
            throw new Error(`Risposta AI malformata: ${parseError.message}`);
        }

    } catch (e) {
        console.error("AI_SERVICE: Error calling Gemini API:", e.message);
        throw new Error(`Errore durante l'analisi AI dell'email: ${e.message}`);
    }

    const bestMatchStaff = staff.find(s => s.id === aiResponse.assigned_to_staff_id);
    const finalAssignedId = bestMatchStaff ? aiResponse.assigned_to_staff_id : null;

    const isUrgent = typeof aiResponse.is_urgent === 'boolean' ? aiResponse.is_urgent : false;
    const clientName = aiResponse.client_name && String(aiResponse.client_name).trim() !== '' ? String(aiResponse.client_name).trim() : null;
    const clientPhoneNumber = aiResponse.client_phone_number && String(aiResponse.client_phone_number).trim() !== '' ? String(aiResponse.client_phone_number).trim() : null;
    const clientCity = aiResponse.client_city && String(aiResponse.client_city).trim() !== '' ? String(aiResponse.client_city).trim() : null;

    // --- FIX #3: Costruisci il nome completo per il risultato finale ---
    const assignedStaffName = bestMatchStaff ? `${bestMatchStaff.first_name} ${bestMatchStaff.last_name}` : null;
   
    console.log('AI_SERVICE: Final AI Result being returned:', {
        assigned_to_staff_id: finalAssignedId,
        ai_confidence_score: parseFloat(aiResponse.ai_confidence_score) || 0,
        ai_reasoning: aiResponse.ai_reasoning,
        assignedStaffEmail: bestMatchStaff?.email || null,
        assignedStaffName: assignedStaffName,
        is_urgent: isUrgent,
        client_name: clientName,
        client_phone_number: clientPhoneNumber,
        client_city: clientCity,
    });

    return {
        assigned_to_staff_id: finalAssignedId,
        ai_confidence_score: parseFloat(aiResponse.ai_confidence_score) || 0,
        ai_reasoning: aiResponse.ai_reasoning,
        assignedStaffEmail: bestMatchStaff?.email || null,
        assignedStaffName: assignedStaffName,
        is_urgent: isUrgent,
        client_name: clientName,
        client_phone_number: clientPhoneNumber,
        client_city: clientCity,
    };
}