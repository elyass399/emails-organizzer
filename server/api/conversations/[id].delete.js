import { defineEventHandler, getRouterParams } from 'h3';
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
    const user = await serverSupabaseUser(event);
    const supabase = await serverSupabaseClient(event);
    const { id: conversationId } = getRouterParams(event);

    // Sicurezza: solo gli utenti autenticati possono eliminare
    if (!user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    // Aggiungi un controllo per assicurarti che solo gli admin possano eliminare (più sicuro)
    const { data: staffProfile } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (!staffProfile || staffProfile.role !== 'admin') {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden: Admin privileges required to delete.' });
    }

    if (!conversationId) {
        throw createError({ statusCode: 400, statusMessage: 'Missing conversation ID' });
    }

    // Elimina la conversazione. Grazie a ON DELETE CASCADE, verranno eliminati anche i messaggi associati.
    const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

    if (error) {
        console.error('Error deleting conversation:', error);
        throw createError({ statusCode: 500, statusMessage: 'Could not delete conversation' });
    }

    return { success: true, message: 'Conversation deleted successfully' };
});