import { defineEventHandler, getRouterParams, readBody } from 'h3';
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
    const user = await serverSupabaseUser(event);
    const supabase = await serverSupabaseClient(event);
    const { id: conversationId } = getRouterParams(event);
    const body = await readBody(event); // Leggiamo il corpo della richiesta

    if (!user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }
    if (!conversationId) {
        throw createError({ statusCode: 400, statusMessage: 'Missing conversation ID' });
    }
    if (!body || !body.status) {
        throw createError({ statusCode: 400, statusMessage: 'Missing status in request body' });
    }

    // Prepara i dati da aggiornare
    const updateData = {
        status: body.status // es. 'closed'
    };

    // Se viene passato anche lo stato di risoluzione, lo aggiungiamo
    if (body.resolution) {
        updateData.resolution_status = body.resolution; // es. 'resolved'
    }

    const { data, error } = await supabase
        .from('conversations')
        .update(updateData) // Aggiorna con i nuovi dati
        .eq('id', conversationId)
        .select()
        .single();

    if (error) {
        console.error('Error updating conversation:', error);
        throw createError({ statusCode: 500, statusMessage: 'Could not update conversation' });
    }

    return { success: true, message: 'Conversation updated successfully', conversation: data };
});