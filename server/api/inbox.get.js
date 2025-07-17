// File: server/api/inbox.get.js

import { defineEventHandler } from 'h3';
import { serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);

  const { data, error } = await supabase
    .from('incoming_emails') // Assicurati sia il nome corretto (con underscore o trattino se quotato)
    .select(`
  id, created_at, sender, subject, body_text, status, is_urgent,
  ai_confidence_score, ai_reasoning,
  staff:assigned_to_staff_id ( id, name, email, text_skills, skills ),
  attachments:email-attachments ( filename, mimetype, size, public_url )
`)
    .order('created_at', { ascending: false });

  if (error) {
      console.error('API inbox.get.js error:', error.message);
      throw createError({ statusCode: 500, statusMessage: error.message });
  }
  return data;
});