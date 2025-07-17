// server/api/staff/[id].put.js

import { defineEventHandler, readBody, createError, getRouterParams } from 'h3';
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin';
import { extractSkillsFromText } from '../../utils/skillExtractor'; // GiÃƒÂ  esistente

export default defineEventHandler(async (event) => {
    console.log('*** API STAFF PUT: ENDPOINT RAGGIUNTO ***');
  const supabaseAdmin = getSupabaseAdminClient(); // Usa il client Supabase Admin
  const { id } = getRouterParams(event); // Ottiene l'ID dalla URL
  const body = await readBody(event);
  const { text_skills } = body; // Ci aspettiamo solo text_skills dal frontend

  console.log('API Staff PUT: Ricevuti dati per ID:', id, '-> text_skills:', text_skills ? text_skills.substring(0, 50) + '...' : 'N/A');


  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID dipendente mancante.' });
  }
  if (text_skills === undefined || text_skills === null || text_skills.trim() === '') {
    throw createError({ statusCode: 400, statusMessage: 'Il campo "Descrizione Competenze" non puÃƒÂ² essere vuoto.' });
  }

  try {
    // 1. Estrai le skills aggiornate dall'AI
    console.log('API Staff PUT: Chiamata a skillExtractor per text_skills:', text_skills ? text_skills.substring(0, 50) + '...' : 'N/A');
    const skills = await extractSkillsFromText(text_skills);
    console.log('API Staff PUT: Skills estratte dall\'AI:', skills);

    // 2. Aggiorna il record nel database
    const { data, error } = await supabaseAdmin
      .from('staff')
      .update({
        text_skills: text_skills,
        skills: skills,
      })
      .eq('id', id)
      .select() // Per ottenere il record aggiornato
      .single();

    if (error) {
      console.error('API Supabase staff update error:', error.message);
      throw createError({ statusCode: 500, statusMessage: `Errore durante l'aggiornamento del dipendente: ${error.message}` });
    }

    if (!data) {
      // Questo caso si verifica se l'ID non corrisponde a nessun record
      throw createError({ statusCode: 404, statusMessage: 'Dipendente non trovato.' });
    }

    console.log('API Staff PUT: Dipendente aggiornato con successo:', data);
    return { status: 'success', message: 'Dipendente aggiornato con successo!', data: data };
  } catch (e) {
    console.error('Errore nel processare la richiesta PUT per staff:', e);
    throw createError({ statusCode: e.statusCode || 500, statusMessage: e.statusMessage || 'Errore interno del server.' });
  }
});