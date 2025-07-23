// server/api/users.get.js
import { getSupabaseAdminClient } from '~/server/utils/supabaseAdmin';

export default defineEventHandler(async (event) => {
    const supabaseAdmin = getSupabaseAdminClient();

    try {
        // 1. Prendi tutti gli utenti registrati
        const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
        if (usersError) {
            console.error("Error fetching users from Supabase Auth:", usersError);
            throw createError({ statusCode: 500, statusMessage: usersError.message });
        }

        // 2. Prendi tutti gli ID degli utenti che sono già nello staff
        const { data: staff, error: staffError } = await supabaseAdmin
            .from('staff')
            .select('user_id');
        if (staffError) {
            console.error("Error fetching staff:", staffError);
            throw createError({ statusCode: 500, statusMessage: staffError.message });
        }
        
        const staffUserIds = staff.map(s => s.user_id).filter(id => id);

        // 3. Restituisci solo gli utenti che NON sono già nello staff
        const usersWithoutProfile = users.filter(u => !staffUserIds.includes(u.id));
        
        // Restituisci solo i campi che ci servono per il menu a tendina
        return usersWithoutProfile.map(u => ({ id: u.id, email: u.email }));

    } catch (error) {
        console.error("Unhandled error in /api/users:", error);
        // Assicurati di restituire un errore strutturato
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});