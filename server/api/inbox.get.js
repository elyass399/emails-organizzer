// server/api/inbox.get.js
import { defineEventHandler } from 'h3';
import { serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);

  const { data, error } = await supabase
    .from('incoming_emails')
    .select(`
      id,
      created_at,
      sender,
      subject,
      body_text,
      status,
      is_urgent,
      ai_confidence_score,
      assigned_to_staff_id, 
      staff:assigned_to_staff_id ( id, first_name, last_name, email ),
      attachments:email-attachments ( filename, mimetype, size, public_url )
    `)
    .not('assigned_to_staff_id', 'is', null) 
    .neq('status', 'follow_up_sent')
    .order('created_at', { ascending: false });

  if (error) {
      console.error('API inbox.get.js error:', error.message);
      throw createError({ statusCode: 500, statusMessage: error.message });
  }
  
  return data;
});