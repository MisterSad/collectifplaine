/**
 * Collectif Plaine - Client Supabase Live
 * Initialise la connexion avec votre instance cloud Supabase
 */
const supabaseUrl = "https://iblfurgquymrcyzefwzy.supabase.co";
const supabaseKey = "sb_publishable_yweP1a-OQKW3-IYNxz1Prg_1Eg7b-0B";

// Déclarer supabase en var globale pour éviter la Temporal Dead Zone (TDZ) si le chargement du CDN échoue ou est bloqué
var supabase = null;

try {
    if (window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    } else {
        console.error("Le SDK Supabase (window.supabase) n'est pas disponible. Cela est souvent causé par un bloqueur de publicités ou de scripts (AdBlock, uBlock, Brave Shields) bloquant le CDN Supabase.");
    }
} catch (err) {
    console.error("Erreur lors de l'initialisation du client Supabase :", err);
}
