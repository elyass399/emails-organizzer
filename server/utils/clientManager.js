// server/utils/clientManager.js
import { getSupabaseAdminClient } from './supabaseAdmin';

/**
 * Gestisce l'upsert (insert o update) di un record cliente in modo robusto.
 * Se un cliente con l'email esiste, unisce i nuovi dati con quelli esistenti.
 * Resetta il flag 'follow_up_email_sent' se i dati vengono completati.
 *
 * @param {string} email L'email del cliente (obbligatoria).
 * @param {string|null} clientName Il nome del cliente estratto.
 * @param {string|null} phoneNumber Il numero di telefono estratto.
 * @param {string|null} city Il comune/città estratto.
 * @param {string} emailId L'ID dell'email che ha triggerato l'upsert.
 * @returns {Promise<object>} Il record cliente aggiornato o appena creato.
 */
// In server/utils/clientManager.js

/**
 * Gestisce l'upsert (insert o update) di un record cliente in modo robusto.
 * Se un cliente con l'email esiste, unisce i nuovi dati con quelli esistenti.
 * Resetta il flag 'follow_up_email_sent' se i dati vengono completati.
 *
 * @param {string} email L'email del cliente (obbligatoria).
 * @param {string|null} clientName Il nome del cliente estratto.
 * @param {string|null} phoneNumber Il numero di telefono estratto.
 * @param {string|null} city Il comune/città estratto.
 * @param {string} emailId L'ID dell'email che ha triggerato l'upsert.
 * @returns {Promise<object>} Il record cliente aggiornato o appena creato.
 */
// in server/utils/clientManager.js
export async function upsertClient(email, clientName, phoneNumber, city, emailId) {
    const supabaseAdmin = getSupabaseAdminClient();
    console.log(`CLIENT_MANAGER: Upserting client for email: ${email}`);
    
    try {
        const { data: existingClient, error: fetchError } = await supabaseAdmin
            .from('clients').select('*').eq('email', email).single();

        if (fetchError && fetchError.code !== 'PGRST116') throw new Error(`Failed to fetch client: ${fetchError.message}`);

        if (existingClient) {
            const updatePayload = {};
            if (clientName && clientName !== existingClient.name) updatePayload.name = clientName;
            if (phoneNumber && phoneNumber !== existingClient.phone_number) updatePayload.phone_number = phoneNumber;
            if (city && city !== existingClient.city) updatePayload.city = city;
            
            // --- MODIFICA QUI: Aggiorna last_email_id solo se fornito ---
            if (emailId) {
                updatePayload.last_email_id = emailId;
            }

            const isNowComplete = (updatePayload.name || existingClient.name) && (updatePayload.phone_number || existingClient.phone_number) && (updatePayload.city || existingClient.city);
            if (isNowComplete && existingClient.follow_up_email_sent) {
                updatePayload.follow_up_email_sent = false;
                updatePayload.follow_up_sent_at = null;
                updatePayload.follow_up_message_id = null;
            }
            
            if (Object.keys(updatePayload).length > 0) {
                const { data, error } = await supabaseAdmin.from('clients').update(updatePayload).eq('id', existingClient.id).select().single();
                if (error) throw new Error(`Failed to update client: ${error.message}`);
                return data;
            }
            return existingClient;

        } else {
            const clientDataToSave = {
                email: email, name: clientName, phone_number: phoneNumber,
                city: city, last_email_id: emailId, follow_up_email_sent: false,
            };
            const { data, error } = await supabaseAdmin.from('clients').insert([clientDataToSave]).select().single();
            if (error) throw new Error(`Failed to insert new client: ${error.message}`);
            return data;
        }

    } catch (e) {
        console.error('CLIENT_MANAGER: Unhandled error in upsertClient:', e);
        throw e;
    }
}

/**
 * Recupera un record cliente tramite email.
 * @param {string} email
 * @returns {Promise<object|null>} Il record cliente o null se non trovato.
 */
export async function getClient(email) {
    const supabaseAdmin = getSupabaseAdminClient();
    try {
        const { data, error } = await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('email', email)
            .single();
        if (error && error.code !== 'PGRST116') {
            console.error('CLIENT_MANAGER: Error getting client:', error.message);
            throw new Error(`Failed to get client: ${error.message}`);
        }
        return data;
    } catch (e) {
        console.error('CLIENT_MANAGER: Unhandled error in getClient:', e);
        throw e;
    }
}

export async function getClientByFollowUpMessageId(messageId) {
    const supabaseAdmin = getSupabaseAdminClient();
    try {
        const { data, error } = await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('follow_up_message_id', messageId)
            .single();
        if (error && error.code !== 'PGRST116') {
            console.error('CLIENT_MANAGER: Error getting client by follow_up_message_id:', error.message);
            throw new Error(`Failed to get client by follow_up_message_id: ${error.message}`);
        }
        return data;
    } catch (e) {
        console.error('CLIENT_MANAGER: Unhandled error in getClientByFollowUpMessageId:', e);
        throw e;
    }
}