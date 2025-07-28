import { serverSupabaseUser } from '#supabase/server';
import { getSupabaseAdminClient } from '~/server/utils/supabaseAdmin';
import { extractSkillsFromText } from '~/server/utils/skillExtractor';
import { sendWelcomeInviteEmail } from '~/server/utils/emailSender';

export default defineEventHandler(async (event) => {
  const adminUser = await serverSupabaseUser(event);
  const supabaseAdmin = getSupabaseAdminClient();
  const config = useRuntimeConfig();

  if (!adminUser) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
  
  const { data: adminStaff } = await supabaseAdmin.from('staff').select('role').eq('user_id', adminUser.id).single();
  if (adminStaff?.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: Admin privileges required.' });
  }

  const { first_name, last_name, email, text_skills, role } = await readBody(event);
  if (!email || !first_name || !last_name || !role) {
    throw createError({ statusCode: 400, statusMessage: 'Dati incompleti.' });
  }

  const tempPassword = Math.random().toString(36).slice(-12);
  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError) {
    if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
      throw createError({ statusCode: 409, statusMessage: `L'utente con email ${email} esiste già.` });
    }
    console.error('CRITICAL: Error creating user:', createError);
    throw createError({ statusCode: 500, statusMessage: `Errore durante la creazione dell'utente: ${createError.message}` });
  }
  
  const newUser = createData.user;

  const skills = await extractSkillsFromText(text_skills);
  const { error: staffInsertError } = await supabaseAdmin.from('staff').insert({
    user_id: newUser.id,
    email: email,
    first_name,
    last_name,
    text_skills,
    skills,
    role,
  });

  if (staffInsertError) {
    await supabaseAdmin.auth.admin.deleteUser(newUser.id);
    throw createError({ statusCode: 500, statusMessage: `Errore creazione profilo staff: ${staffInsertError.message}` });
  }

  // Punta alla pagina /forgot-password per iniziare il flusso
  const resetPageLink = `${config.public.baseUrl}/forgot-password`;
  await sendWelcomeInviteEmail(email, first_name, resetPageLink);
  
  return { success: true, message: 'Utente creato con successo. Verrà inviata un\'email con le istruzioni per impostare la password.' };
});