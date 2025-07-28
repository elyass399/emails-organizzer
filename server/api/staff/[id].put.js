// server/api/staff/[id].put.js

// --- MODIFICA QUI ---
// Abbiamo separato gli import. `serverSupabaseUser` ora viene da '#supabase/server'.
import { defineEventHandler, readBody, getRouterParams } from 'h3';
import { serverSupabaseUser } from '#supabase/server';
// --- FINE MODIFICA ---

import { getSupabaseAdminClient } from '../../utils/supabaseAdmin';
import { extractSkillsFromText } from '../../utils/skillExtractor';

export default defineEventHandler(async (event) => {
    const supabaseAdmin = getSupabaseAdminClient();
    const { id: staffIdToUpdate } = getRouterParams(event); // ID del profilo da aggiornare
    const user = await serverSupabaseUser(event); // Utente autenticato che fa la richiesta

    // 1. Sicurezza: Controlla che ci sia un utente autenticato
    if (!user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    // 2. Sicurezza: Controlla che l'utente stia modificando il proprio profilo staff
    const { data: userStaffProfile, error: profileError } = await supabaseAdmin
        .from('staff')
        .select('id, role')
        .eq('user_id', user.id)
        .single();
    
    if (profileError || !userStaffProfile) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden: No staff profile found for this user.' });
    }
    
    // Un utente può modificare se stesso, un admin può modificare chiunque
    if (userStaffProfile.id !== staffIdToUpdate && userStaffProfile.role !== 'admin') {
         throw createError({ statusCode: 403, statusMessage: 'Forbidden: You can only update your own profile.' });
    }

    // 3. Leggi il body e prepara l'aggiornamento
    const body = await readBody(event);
    const { first_name, last_name, text_skills } = body;

    const updatePayload = {};

    if (first_name) updatePayload.first_name = first_name;
    if (last_name) updatePayload.last_name = last_name;
    
    // Solo se text_skills è presente, ricalcola le skills
    if (text_skills !== undefined && text_skills !== null) {
        if (text_skills.trim() === '') {
            throw createError({ statusCode: 400, statusMessage: 'Il campo "Descrizione Competenze" non può essere vuoto.' });
        }
        updatePayload.text_skills = text_skills;
        updatePayload.skills = await extractSkillsFromText(text_skills);
    }
    
    if (Object.keys(updatePayload).length === 0) {
        return { status: 'noop', message: 'Nessun dato da aggiornare.' };
    }
    
    // 4. Esegui l'aggiornamento
    const { data, error } = await supabaseAdmin
      .from('staff')
      .update(updatePayload)
      .eq('id', staffIdToUpdate)
      .select()
      .single();

    if (error) {
      console.error('API Supabase staff update error:', error.message);
      throw createError({ statusCode: 500, statusMessage: `Errore durante l'aggiornamento: ${error.message}` });
    }

    if (!data) {
      throw createError({ statusCode: 404, statusMessage: 'Profilo staff non trovato.' });
    }

    return { status: 'success', message: 'Profilo aggiornato con successo!', data: data };
});