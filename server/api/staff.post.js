import { defineEventHandler, readBody } from 'h3';
import { getSupabaseAdminClient } from '../utils/supabaseAdmin';
import { extractSkillsFromText } from '../utils/skillExtractor';

export default defineEventHandler(async (event) => {
  const supabaseAdmin = getSupabaseAdminClient();
  const { name, text_skills, user_id } = await readBody(event); // Modificato: ora riceviamo user_id

  if (!name || !text_skills || !user_id) {
    throw createError({ statusCode: 400, statusMessage: 'Nome, competenze e utente sono obbligatori.' });
  }
  
  // Opzionale: controlla se l'utente esiste in auth.users
  const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
  if (userError || !user) {
    throw createError({ statusCode: 404, statusMessage: "L'utente selezionato non esiste." });
  }

  const skills = await extractSkillsFromText(text_skills);

  const { data, error } = await supabaseAdmin
    .from('staff')
    .insert({
      name: name,
      email: user.user.email, // Prendiamo l'email dall'utente di Supabase Auth
      text_skills: text_skills,
      skills: skills,
      user_id: user_id, // Salviamo il collegamento
      role: 'staff' // Impostiamo il ruolo di default
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Errore di unicità
      throw createError({ statusCode: 409, statusMessage: 'Questo utente è già stato aggiunto allo staff.' });
    }
    console.error('API Supabase staff insert error:', error.message);
    throw createError({ statusCode: 500, statusMessage: `Errore durante l'aggiunta: ${error.message}` });
  }

  return { status: 'success', data: data };
});