// server/api/clients.get.js

import { defineEventHandler } from 'h3';
import { getSupabaseAdminClient } from '../utils/supabaseAdmin'; // Usa il client admin per sicurezza e consistenza

export default defineEventHandler(async (event) => {
  const supabaseAdmin = getSupabaseAdminClient();

  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('id, created_at, email, name, phone_number, city, follow_up_email_sent, follow_up_sent_at') // Seleziona tutte le colonne pertinenti
    .order('created_at', { ascending: false }); // Ordina per data di creazione, i piÃ¹ recenti prima

  if (error) {
    console.error('Supabase clients fetch error:', error.message);
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return data;
});