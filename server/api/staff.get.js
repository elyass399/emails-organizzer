// server/api/staff.get.js
import { defineEventHandler } from 'h3';
import { serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);

  const { data, error } = await supabase
    .from('staff')
    // MODIFICATO QUI: Seleziona i nuovi campi
    .select('id, first_name, last_name, email, text_skills, skills, role') 
    .order('first_name', { ascending: true });

  if (error) {
    console.error('Supabase staff fetch error:', error.message);
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return data;
});