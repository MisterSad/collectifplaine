/**
 * Collectif Plaine - Client Supabase Live
 * Initialise la connexion avec votre instance cloud Supabase
 */
const supabaseUrl = "https://iblfurgquymrcyzefwzy.supabase.co";
const supabaseKey = "sb_publishable_yweP1a-OQKW3-IYNxz1Prg_1Eg7b-0B";

// Vérification de la disponibilité du SDK Supabase
if (typeof window.supabase === "undefined") {
    console.error("Le SDK Supabase n'a pas pu être chargé. Assurez-vous d'importer le CDN dans index.html.");
}

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
