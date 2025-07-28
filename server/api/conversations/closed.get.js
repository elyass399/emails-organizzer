import { defineEventHandler } from 'h3';
import { serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);

  // Query per ottenere le conversazioni chiuse, ordinate per data di aggiornamento più recente
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id,
      subject,
      status,
      resolution_status,
      updated_at,
      client:client_id!left ( id, email, name ),
      staff:assigned_to_staff_id!left ( id, first_name, last_name )
    `)
    .eq('status', 'closed')
    .order('updated_at', { ascending: false });

  if (error) {
      console.error('API closed.get.js error:', error.message);
      throw createError({ statusCode: 500, statusMessage: error.message });
  }
  
  return data;
});