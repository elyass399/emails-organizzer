// File: server/api/inbox.get.js

import { defineEventHandler } from 'h3';
import { serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);

  // --- MODIFICA QUI ---
  // Aggiungiamo un filtro alla query per recuperare solo le email
  // che hanno un valore nella colonna 'assigned_to_staff_id'.
  // Questo esclude automaticamente le email in revisione manuale,
  // gli errori e le email di follow-up che non hanno un'assegnazione.
  const { data, error } = await supabase
    .from('incoming_emails')
    .select(`
      id, created_at, sender, subject, body_text, status, is_urgent,
      ai_confidence_score, ai_reasoning,
      staff:assigned_to_staff_id ( id, name, email, text_skills, skills ),
      attachments:email-attachments ( filename, mimetype, size, public_url )
    `)
    // FILTRO PRINCIPALE: Mostra solo se 'assigned_to_staff_id' NON è NULLO
    .not('assigned_to_staff_id', 'is', null) 
    // Secondo filtro (opzionale ma consigliato): escludiamo esplicitamente
    // i nostri follow-up inviati per non vederli nella posta in arrivo.
    .neq('status', 'follow_up_sent')
    .order('created_at', { ascending: false });

  if (error) {
      console.error('API inbox.get.js error:', error.message);
      throw createError({ statusCode: 500, statusMessage: error.message });
  }

  // Il frontend riceverà solo la lista delle email già filtrate.
  return data;
});