// server/api/staff.post.js

import { defineEventHandler, readBody, createError } from 'h3';
import { getSupabaseAdminClient } from '../utils/supabaseAdmin';

export default defineEventHandler(async (event) => {
  const supabaseAdmin = getSupabaseAdminClient();
  const body = await readBody(event);
  const { name, email, responsibilities } = body;

  if (!name || !email || !responsibilities) {
    throw createError({ statusCode: 400, statusMessage: 'Nome, email e responsabilità sono campi obbligatori.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('staff')
      .insert({
        name: name,
        email: email,
        responsibilities: responsibilities,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase staff insert error:', error.message);
      
      let statusMessage = `Errore durante l'aggiunta del dipendente: ${error.message}`;
      // Intercetta l'errore di violazione di unicitÃ  (codice PostgreSQL 23505)
      if (error.code === '23505' && error.message.includes('staff_email_key')) {
        statusMessage = 'Un dipendente/ufficio con questa email esiste già. Si prega di usare un\'email unica.';
      }
      
      throw createError({ statusCode: 500, statusMessage: statusMessage });
    }

    return { status: 'success', message: 'Dipendente aggiunto con successo!', data: data };
  } catch (e) {
    console.error('Errore nel processare la richiesta POST per staff:', e);
    throw createError({ statusCode: e.statusCode || 500, statusMessage: e.statusMessage || 'Errore interno del server.' });
  }
});