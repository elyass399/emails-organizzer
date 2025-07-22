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
export async function upsertClient(email, clientName, phoneNumber, city, emailId) {
    const supabaseAdmin = getSupabaseAdminClient();
    console.log(`CLIENT_MANAGER: Upserting client for email: ${email}`);
    console.log(`CLIENT_MANAGER: Input data - Name: ${clientName}, Phone: ${phoneNumber}, City: ${city}`);

    try {
        const { data: existingClient, error: fetchError } = await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('email', email)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('CLIENT_MANAGER: Error fetching client:', fetchError.message);
            throw new Error(`Failed to fetch client: ${fetchError.message}`);
        }

        // CASO 1: IL CLIENTE ESISTE, AGGIORNIAMO I DATI
        if (existingClient) {
            console.log('CLIENT_MANAGER: Existing client found. Merging new data.');

            const updatePayload = {};
            let needsUpdate = false;

            // Unisci solo i dati nuovi e validi, sovrascrivendo i vecchi
            if (clientName && clientName !== existingClient.name) {
                updatePayload.name = clientName;
                needsUpdate = true;
            }
            if (phoneNumber && phoneNumber !== existingClient.phone_number) {
                updatePayload.phone_number = phoneNumber;
                needsUpdate = true;
            }
            if (city && city !== existingClient.city) {
                updatePayload.city = city;
                needsUpdate = true;
            }

            const isNowComplete = (updatePayload.name || existingClient.name) &&
                                  (updatePayload.phone_number || existingClient.phone_number) &&
                                  (updatePayload.city || existingClient.city);

            if (isNowComplete && existingClient.follow_up_email_sent) {
                console.log('CLIENT_MANAGER: All info now complete. Resetting follow-up flag.');
                updatePayload.follow_up_email_sent = false;
                updatePayload.follow_up_sent_at = null;
                updatePayload.follow_up_message_id = null; // Pulisce il message_id
                needsUpdate = true;
            }

            updatePayload.last_email_id = emailId;
            needsUpdate = true;

            if (needsUpdate) {
                console.log('CLIENT_MANAGER: Fields to update for existing client:', updatePayload);
                const { data, error: updateError } = await supabaseAdmin
                    .from('clients')
                    .update(updatePayload)
                    .eq('id', existingClient.id)
                    .select()
                    .single();

                if (updateError) throw new Error(`Failed to update client: ${updateError.message}`);
                console.log('CLIENT_MANAGER: Client updated successfully:', data);
                return data;
            } else {
                console.log('CLIENT_MANAGER: No new information to update.');
                return existingClient;
            }
        }
        // CASO 2: IL CLIENTE NON ESISTE, LO CREIAMO
        else {
            console.log('CLIENT_MANAGER: No existing client found. Inserting new client.');
            const clientDataToSave = {
                email: email,
                name: clientName,
                phone_number: phoneNumber,
                city: city,
                last_email_id: emailId,
                follow_up_email_sent: false,
            };
            
            const { data, error: insertError } = await supabaseAdmin
                .from('clients')
                .insert([clientDataToSave])
                .select()
                .single();

            if (insertError) throw new Error(`Failed to insert new client: ${insertError.message}`);
            console.log('CLIENT_MANAGER: New client inserted:', data);
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