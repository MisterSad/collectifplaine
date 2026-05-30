/**
 * Collectif Plaine - Client Supabase Live
 * Initialise la connexion avec votre instance cloud Supabase
 */
const supabaseUrl = "https://iblfurgquymrcyzefwzy.supabase.co";
const supabaseKey = "sb_publishable_yweP1a-OQKW3-IYNxz1Prg_1Eg7b-0B";

// Déclarer supabase en var globale pour éviter la Temporal Dead Zone (TDZ) si le chargement du CDN échoue ou est bloqué
var supabase = null;

function initSupabaseClient() {
    if (window.supabase && window.supabase.createClient) {
        try {
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            console.log("📡 [Client] Initialisation réussie de Supabase.");
            return true;
        } catch (err) {
            console.error("Erreur lors de l'initialisation du client Supabase :", err);
        }
    }
    return false;
}

// Essayer d'initialiser immédiatement
if (!initSupabaseClient()) {
    console.warn("⚠️ window.supabase non disponible immédiatement. Tentative de chargement dynamique...");
    
    // Essayer de charger dynamiquement à partir de multiples sources (local avec cache-busting, jsdelivr, unpkg)
    const sources = [
        "js/db-lib.js?v=" + Date.now(), 
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
        "https://unpkg.com/@supabase/supabase-js@2"
    ];
    
    let currentSourceIndex = 0;
    
    function loadNextScript() {
        if (currentSourceIndex >= sources.length) {
            console.error("❌ Impossible de charger le SDK Supabase à partir des sources locales ou CDN.");
            return;
        }
        
        const src = sources[currentSourceIndex];
        console.log(`📡 Tentative de chargement de Supabase depuis : ${src}`);
        
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => {
            console.log(`✅ SDK Supabase chargé avec succès depuis : ${src}`);
            if (initSupabaseClient()) {
                // Si l'initialisation réussit et que le store ou l'UI a déjà affiché l'erreur, on relance
                if (typeof Store !== 'undefined' && Store.init) {
                    Store.init()
                        .then(() => {
                            if (typeof renderDashboard !== 'undefined') renderDashboard();
                        })
                        .catch(err => console.error("Erreur de réinitialisation du Store:", err));
                }
            }
        };
        script.onerror = () => {
            console.warn(`⚠️ Échec du chargement depuis : ${src}`);
            currentSourceIndex++;
            loadNextScript();
        };
        
        document.head.appendChild(script);
    }
    
    loadNextScript();
}
