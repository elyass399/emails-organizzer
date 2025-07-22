// server/utils/skillExtractor.js
import { useRuntimeConfig } from '#imports';
import { $fetch } from 'ofetch';

const config = useRuntimeConfig();
const GOOGLE_API_KEY = config.googleApiKey;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`;

const PROMPT_SKILL_EXTRACTION = `
Sei un assistente AI specializzato nell'estrazione di competenze da una descrizione testuale.
Data la seguente descrizione di un dipendente/ufficio, estrai le singole competenze e restituiscile come un array JSON di stringhe.
Non includere nessun altro testo oltre all'array JSON.

Esempio di input: "Gestisce la contabilitÃ  generale, la fatturazione, e si occupa delle dichiarazioni fiscali. Conosce bene Excel e SAP."
Esempio di output: ["contabilitÃ  generale", "fatturazione", "dichiarazioni fiscali", "Excel", "SAP"]

Testo da analizzare:
"""
{text_skills_description}
"""
`;

export async function extractSkillsFromText(text_skills_description) {
  console.log("SKILL_EXTRACTOR: Inizio estrazione skills per:", text_skills_description ? text_skills_description.substring(0, Math.min(text_skills_description.length, 50)) + '...' : 'testo vuoto');

  if (!text_skills_description || text_skills_description.trim() === '') {
    console.warn("SKILL_EXTRACTOR: Testo competenze vuoto. Ritorno array vuoto.");
    return [];
  }

  const finalPrompt = PROMPT_SKILL_EXTRACTION.replace('{text_skills_description}', text_skills_description.trim());
  console.log("SKILL_EXTRACTOR: Prompt finale per Gemini (parziale):", finalPrompt.substring(0, Math.min(finalPrompt.length, 200)) + '...');

  try {
    const response = await $fetch.raw(GEMINI_API_URL, {
      method: 'POST',
      body: { contents: [{ parts: [{ text: finalPrompt }] }] },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const responseData = response._data;
    const rawResponseText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawResponseText) {
      console.warn("SKILL_EXTRACTOR: Gemini non ha restituito contenuto testuale valido nel campo atteso.");
      return [];
    }
    
    console.log("SKILL_EXTRACTOR: Risposta testuale raw da Gemini (parziale):", rawResponseText.substring(0, Math.min(rawResponseText.length, 500)) + '...');

    // MIGLIORAMENTO CHIAVE: Tentativo di estrazione del blocco JSON usando regex piÃ¹ robusta
    const jsonMatch = rawResponseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/); // Cattura anche senza 'json' dopo i backticks
    let jsonString = '';
    if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1].trim();
        console.log("SKILL_EXTRACTOR: Blocco JSON markdown trovato e estratto.");
    } else {
        // Fallback: se non trova il blocco ```...```, prova a parsare l'intera risposta
        console.warn("SKILL_EXTRACTOR: Blocco JSON markdown non trovato. Tentativo di parsing dell'intera risposta come JSON.");
        jsonString = rawResponseText.trim();
    }

    console.log("SKILL_EXTRACTOR: JSON grezzo (probabile) estratto per parsing:", jsonString.substring(0, Math.min(jsonString.length, 200)) + '...');

    let skillsArray = [];
    try {
        skillsArray = JSON.parse(jsonString);
    } catch (parseError) {
        console.error("SKILL_EXTRACTOR: Errore nel parsing JSON:", parseError);
        console.error("SKILL_EXTRACTOR: Stringa JSON malformata ricevuta:", jsonString);
        return []; // Restituisce array vuoto in caso di JSON invalido
    }

    if (!Array.isArray(skillsArray)) {
        console.warn("SKILL_EXTRACTOR: L'AI ha restituito un non-array per le skills dopo il parsing. Ritorno array vuoto.");
        return [];
    }

    const cleanedSkills = skillsArray.map(skill => String(skill).trim()).filter(skill => skill.length > 0);
    console.log("SKILL_EXTRACTOR: Skills estratte e pulite (Final):", cleanedSkills);
    return cleanedSkills;

  } catch (e) {
    console.error("SKILL_EXTRACTOR: Errore durante la chiamata Gemini per l'estrazione delle skills:", e);
    // In caso di errore AI/rete, restituisci un array vuoto per non bloccare l'operazione
    return []; 
  }
}