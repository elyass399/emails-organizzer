// server/api/staff.post.js

import { defineEventHandler, readBody, createError } from 'h3';
import { getSupabaseAdminClient } from '../utils/supabaseAdmin';
import { extractSkillsFromText } from '../utils/skillExtractor'; // Importa il nuovo servizio

export default defineEventHandler(async (event) => {
  const supabaseAdmin = getSupabaseAdminClient();
  const body = await readBody(event);
  const { name, email, text_skills } = body; 

  console.log('API Staff POST: Ricevuti dati ->', { name, email, text_skills: text_skills ? text_skills.substring(0, 50) + '...' : 'N/A' });

  if (!name || !email || !text_skills || text_skills.trim() === '') { // Aggiorna la validazione
    throw createError({ statusCode: 400, statusMessage: 'Nome, email e descrizione competenze sono campi obbligatori e non possono essere vuoti.' });
  }

  try {
    // Estrai le skills dall'AI
    console.log('API Staff POST: Chiamata a skillExtractor per text_skills:', text_skills ? text_skills.substring(0, 50) + '...' : 'N/A');
    const skills = await extractSkillsFromText(text_skills);
    console.log('API Staff POST: Skills estratte dall\'AI:', skills);

    const { data, error } = await supabaseAdmin
      .from('staff')
      .insert({
        name: name,
        email: email,
        text_skills: text_skills, // Inserisci il testo originale
        skills: skills,          // Inserisci l'array estratto
      })
      .select()
      .single();

    if (error) {
      console.error('API Supabase staff insert error:', error.message);
      
      let statusMessage = `Errore durante l'aggiunta del dipendente: ${error.message}`;
      if (error.code === '23505' && error.message.includes('staff_email_key')) {
        statusMessage = 'Un dipendente/ufficio con questa email esiste giÃ . Si prega di usare un\'email unica.';
      }
      
      throw createError({ statusCode: 500, statusMessage: statusMessage });
    }

    console.log('API Staff POST: Dipendente aggiunto con successo:', data);
    return { status: 'success', message: 'Dipendente aggiunto con successo!', data: data };
  } catch (e) {
    console.error('Errore nel processare la richiesta POST per staff:', e);
    throw createError({ statusCode: e.statusCode || 500, statusMessage: e.statusMessage || 'Errore interno del server.' });
  }
});