// server/utils/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';
import { useRuntimeConfig } from '#imports';

let supabaseAdminClient;

export function getSupabaseAdminClient() {
  if (!supabaseAdminClient) {
    const config = useRuntimeConfig();
    if (!config.public.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error('Missing Supabase URL or Service Role Key in runtimeConfig for admin client.');
    }
    // Usa la SERVICE_ROLE_KEY per operazioni lato server con più permessi
    supabaseAdminClient = createClient(config.public.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false, // Non persistere la sessione per un client server-side
      },
    });
  }
  return supabaseAdminClient;
}