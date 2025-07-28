// server/api/conversations.get.js
import { defineEventHandler, getQuery } from 'h3';
import { serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);
  const queryParams = getQuery(event);

  let query = supabase
    .from('conversations')
    .select(`
      id, subject, status, updated_at,
      client:client_id!left ( id, email, name ),
      staff:assigned_to_staff_id!left ( id, first_name, last_name ),
      last_message:incoming_emails ( sender, body_text )
    `)
    .order('created_at', { referencedTable: 'incoming_emails', ascending: false })
    .limit(1, { referencedTable: 'incoming_emails' })
    .order('updated_at', { ascending: false });

  // Applica i filtri dalla query
  if (queryParams.status && queryParams.status !== 'all') {
    query = query.eq('status', queryParams.status);
  } else {
    // Default: mostra 'open' e 'awaiting_client' se nessun filtro di stato è specificato
    query = query.in('status', ['open', 'awaiting_client']);
  }

  if (queryParams.staffId && queryParams.staffId !== 'all') {
    query = query.eq('assigned_to_staff_id', queryParams.staffId);
  }

  if (queryParams.startDate) {
    query = query.gte('updated_at', queryParams.startDate);
  }

  if (queryParams.endDate) {
    const endDate = new Date(queryParams.endDate);
    endDate.setDate(endDate.getDate() + 1); // Aggiunge un giorno per includere tutta la data di fine
    query = query.lt('updated_at', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
      console.error('API conversations.get.js error:', error.message);
      throw createError({ statusCode: 500, statusMessage: error.message });
  }
  
  const formattedData = data.map(conv => ({
    ...conv,
    last_message: conv.last_message[0] || { sender: 'N/A', body_text: 'Nessun messaggio.' }
  }));

  return formattedData;
});