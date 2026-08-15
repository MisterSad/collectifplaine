/**
 * @fileoverview Initialisation et gestionnaire singleton du client Supabase.
 * Évite les fuites de mémoire et les chargements CDN non conformes CSP.
 */

const SUPABASE_URL = "https://iblfurgquymrcyzefwzy.supabase.co";
const SUPABASE_KEY = "sb_publishable_yweP1a-OQKW3-IYNxz1Prg_1Eg7b-0B";

let supabaseClient = null;

/**
 * Initialise ou retourne l'instance active du client Supabase.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabase() {
    if (supabaseClient) {
        return supabaseClient;
    }

    // Le bundle Supabase est chargé localement via js/db-lib.js (window.supabase)
    const factory = window.supabase?.createClient;
    if (typeof factory !== 'function') {
        console.error("[DB Client] SDK Supabase non disponible dans l'environnement global (window.supabase).");
        throw new Error("SDK Supabase manquant");
    }

    supabaseClient = factory(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    });

    return supabaseClient;
}
