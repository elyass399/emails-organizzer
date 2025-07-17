// server/utils/aiService.js
import { useRuntimeConfig } from '#imports';
import { $fetch } from 'ofetch';
import { getSupabaseAdminClient } from './supabaseAdmin';

const config = useRuntimeConfig();
const GOOGLE_API_KEY = config.googleApiKey;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}`;

// MODIFICA QUI: AGGIUNTO L'ISTRUZIONE PER L'URGENZA AL PROMPT
const PROMPT_EMAIL_TRIAGE = `
Sei un assistente AI super efficiente per uno studio di commercialisti. Il tuo compito è analizzare un'email in arrivo e assegnarla al membro dello staff più appropriato.

Inoltre, devi determinare se l'email è URGENTE. Un'email è urgente se contiene parole come "urgente",  "ora", "subito", "immediato", "critico", "deadline", "scadenza", o se il contesto implica una richiesta che richiede attenzione immediata.

Ecco la lista del personale e delle loro responsabilità. Ogni membro ha un ID unico (UUID).
--- LISTA PERSONALE ---
{staff_list}
-----------------------

Analizza il seguente contenuto dell'email (mittente, oggetto e corpo) e determina:
1. Quale persona dello staff è il più adatto a gestirla.
2. Se l'email è urgente.

--- CONTENUTO EMAIL ---
Mittente: {email_from}
Oggetto: {email_subject}
Corpo: {email_body}
-----------------------

La tua risposta DEVE essere un oggetto JSON con il seguente formato, senza alcun testo aggiuntivo:
{
  "assigned_to_staff_id": "L'UUID ESATTO del dipendente scelto dalla LISTA PERSONALE sopra. Non inventare o alterare gli UUID. Se NESSUNO nella lista sembra appropriato o non sei sicuro, DEVI restituire null.",
  "ai_confidence_score": un numero da 0.0 (per niente sicuro) a 1.0 (molto sicuro),
  "ai_reasoning": "Una breve frase che spiega perché hai scelto quel dipendente/ufficio e se l'email è considerata urgente.",
  "is_urgent": true/false // Indica se l'email è urgente in base al contenuto.
}
`;

export async function analyzeEmailWithAI(sender, subject, body_text) {
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: staff, error: staffError } = await supabaseAdmin.from('staff').select('id, name, text_skills, skills, email');
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
            is_urgent: false, // DEFAULT SE NESSUN PERSONALE
        };
    }

    const staffListForPrompt = staff.map(s => {
      const skillsDescription = s.skills && s.skills.length > 0
        ? `Competenze: ${s.skills.join(', ')}`
        : `Descrizione: ${s.text_skills}`;
      return `ID: ${s.id}, Nome: ${s.name}, ${skillsDescription}, Email: ${s.email}`;
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

    // Converte aiResponse.is_urgent in un boolean effettivo
    const isUrgent = typeof aiResponse.is_urgent === 'boolean' ? aiResponse.is_urgent : false;


    console.log('AI_SERVICE: Staff search result:');
    console.log(`  AI suggested ID: ${aiResponse.assigned_to_staff_id}`);
    console.log(`  Match found in DB: ${!!bestMatchStaff}`);
    if (bestMatchStaff) {
        console.log(`  Matched Staff: Name=${bestMatchStaff.name}, Email=${bestMatchStaff.email}`);
    } else {
        console.warn('AI_SERVICE: No matching staff found in DB for the ID suggested by AI. assigned_to_staff_id will be NULL.');
    }
    console.log(`  Is Urgent: ${isUrgent}`); // NUOVO LOG

    console.log('AI_SERVICE: Final AI Result being returned:', {
        assigned_to_staff_id: finalAssignedId,
        ai_confidence_score: parseFloat(aiResponse.ai_confidence_score) || 0,
        ai_reasoning: aiResponse.ai_reasoning,
        assignedStaffEmail: bestMatchStaff?.email || null,
        assignedStaffName: bestMatchStaff?.name || null,
        is_urgent: isUrgent, // AGGIUNGI QUI LO STATO DI URGENZA
    });

    return {
        assigned_to_staff_id: finalAssignedId,
        ai_confidence_score: parseFloat(aiResponse.ai_confidence_score) || 0,
        ai_reasoning: aiResponse.ai_reasoning,
        assignedStaffEmail: bestMatchStaff?.email || null,
        assignedStaffName: bestMatchStaff?.name || null,
        is_urgent: isUrgent, // AGGIUNGI QUI LO STATO DI URGENZA
    };
}