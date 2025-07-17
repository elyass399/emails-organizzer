// server/api/staff.get.js

import { defineEventHandler } from 'h3';
import { serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);

  const { data, error } = await supabase
    // Modifica qui: seleziona le nuove colonne
    .from('staff')
    .select('id, name, email, text_skills, skills') // Aggiungi text_skills e skills
    .order('name', { ascending: true });

  if (error) {
    console.error('Supabase staff fetch error:', error.message);
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return data;
});