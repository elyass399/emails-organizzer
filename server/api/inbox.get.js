// File: server/api/inbox.get.js

import { defineEventHandler } from 'h3';
import { serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);

  const { data, error } = await supabase
    .from('incoming_emails')
    .select(`
      id, created_at, sender, subject, body_text, status,
      ai_confidence_score, ai_reasoning,
      staff:assigned_to_staff_id ( id, name, email )
    `)
    .order('created_at', { ascending: false });

  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  return data;
});