// server/api/staff.get.js

import { defineEventHandler } from 'h3';
import { serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);

  const { data, error } = await supabase
    .from('staff')
    .select('id, name, email, responsibilities')
    .order('name', { ascending: true });

  if (error) {
    console.error('Supabase staff fetch error:', error.message);
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return data;
});