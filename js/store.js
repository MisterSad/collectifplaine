/**
 * Collectif Plaine - Magasin de Données (Store Supabase Live)
 * Gère la persistance sécurisée dans le cloud Supabase (PostgreSQL, Auth, Storage)
 */
const Store = (() => {
    // Variable locale pour stocker l'état assemblé des ascenseurs (compatibilité frontend)
    let _elevators = [];

    /**
     * Vérifie de manière robuste si le client Supabase est initialisé.
     * Lève une exception claire si un bloqueur de publicité ou Brave bloque le CDN.
     */
    function _ensureSupabase() {
        if (typeof supabase === 'undefined' || !supabase) {
            // Tentative d'initialisation tardive de secours (en cas de chargement asynchrone ou décalé du CDN/lib)
            if (window.supabase && window.supabase.createClient) {
                try {
                    const supabaseUrl = "https://iblfurgquymrcyzefwzy.supabase.co";
                    const supabaseKey = "sb_publishable_yweP1a-OQKW3-IYNxz1Prg_1Eg7b-0B";
                    supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
                    console.log("📡 [Store] Réinitialisation à la volée du client de base de données réussie.");
                    return;
                } catch (e) {
                    console.error("Échec de l'initialisation de secours :", e);
                }
            }
            throw new Error("Le client de base de données (Supabase) n'a pas pu être initialisé. Cela est généralement dû à un bloqueur de publicités (AdBlock/uBlock) ou un bouclier de navigateur (Brave Shields) bloquant le script CDN de Supabase. Veuillez désactiver votre bloqueur pour ce site et rafraîchir la page.");
        }
    }

    /**
     * Effectue le requêtage de Supabase et assemble l'objet local _elevators
     */
    async function _fetchAndAssembleState() {
        _ensureSupabase();
        try {
            // 1. Récupérer les ascenseurs
            const { data: elevators, error: elError } = await supabase
                .from('elevators')
                .select('*')
                .order('id', { ascending: true });
            
            if (elError) throw elError;

            // 2. Récupérer les signalements
            const { data: reports, error: repError } = await supabase
                .from('reports')
                .select('*')
                .order('created_at', { ascending: false });

            if (repError) throw repError;

            // 3. Récupérer l'historique d'entretien
            const { data: histories, error: histError } = await supabase
                .from('histories')
                .select('*')
                .order('created_at', { ascending: false });

            if (histError) throw histError;

            // 4. Assemblage au format de l'application
            _elevators = elevators.map(el => {
                const elReports = reports
                    ? reports.filter(r => r.entrance === el.id).map(r => ({
                        id: r.id,
                        timestamp: new Date(r.created_at).getTime(),
                        type: r.type,
                        description: r.description,
                        user: r.user_display,
                        photo: r.photo_url
                    }))
                    : [];

                const elHistory = histories
                    ? histories.filter(h => h.entrance === el.id).map(h => ({
                        id: h.id,
                        timestamp: new Date(h.created_at).getTime(),
                        status: h.status,
                        notes: h.notes
                    }))
                    : [];

                return {
                    id: el.id,
                    status: el.status,
                    lastStatusChange: new Date(el.last_status_change).getTime(),
                    maintenanceNotes: el.maintenance_notes || "",
                    tenantReports: elReports,
                    history: elHistory
                };
            });

        } catch (err) {
            console.error("Erreur d'assemblage de l'état depuis Supabase", err);
            throw err;
        }
    }

    return {
        /**
         * Initialise la connexion et effectue l'auto-seeding si la base est vide
         */
        async init() {
            _ensureSupabase();
            try {
                // 1. Synchroniser la session active de Supabase Auth
                const { data: { session } } = await supabase.auth.getSession();
                if (session && session.user) {
                    const meta = session.user.user_metadata;
                    Security.setTenantSession({
                        username: meta.username || session.user.email.split('@')[0],
                        entrance: meta.entrance || "",
                        apartment: meta.apartment || ""
                    });
                } else {
                    Security.logoutTenant();
                }

                // 2. Charger les ascenseurs pour vérifier si la table est vide
                const { data: elevators, error } = await supabase
                    .from('elevators')
                    .select('id');

                if (error) throw error;

                // 3. Auto-seeding si 0 lignes trouvées
                if (elevators.length === 0) {
                    console.log("🚀 [Supabase Seeding] Base vide. Seeding automatique des 9 entrées...");
                    const seedData = INITIAL_ELEVATOR_DATA.map(el => ({
                        id: el.id,
                        status: el.status,
                        last_status_change: new Date(el.lastStatusChange).toISOString(),
                        maintenance_notes: el.maintenanceNotes
                    }));
                    
                    const { error: seedError } = await supabase
                        .from('elevators')
                        .insert(seedData);

                    if (seedError) throw seedError;
                }

                // 4. Charger et assembler l'état
                await _fetchAndAssembleState();

            } catch (err) {
                console.error("Erreur d'initialisation du Store Supabase", err);
                throw err;
            }
        },

        /**
         * Récupère la liste complète des ascenseurs (copie profonde)
         */
        getElevators() {
            return JSON.parse(JSON.stringify(_elevators));
        },

        /**
         * Récupère un ascenseur spécifique par son numéro d'entrée
         */
        getElevatorById(id) {
            const elevator = _elevators.find(e => e.id === String(id));
            return elevator ? JSON.parse(JSON.stringify(elevator)) : null;
        },

        /**
         * Ajoute un signalement locataire dans PostgreSQL (et charge la photo sur Storage)
         */
        async addReport(entranceId, rawReportData) {
            const loggedTenant = Security.getLoggedInTenant();
            if (!loggedTenant) {
                throw new Error("Accès refusé : Vous devez créer un compte locataire et être connecté pour signaler un incident.");
            }

            const reportId = "r_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
            let publicPhotoUrl = null;

            // 1. Traitement de la photo si elle est fournie (Base64)
            if (rawReportData.photo) {
                try {
                    // Convertir le base64 en Blob pour le téléversement
                    const response = await fetch(rawReportData.photo);
                    const blob = await response.blob();
                    
                    const filePath = `reports/${entranceId}/${reportId}.jpg`;

                    // Téléverser l'image dans le bucket Supabase Storage
                    const { error: uploadError } = await supabase.storage
                        .from('elevator-photos')
                        .upload(filePath, blob, {
                            contentType: 'image/jpeg',
                            cacheControl: '3600',
                            upsert: false
                        });

                    if (uploadError) throw uploadError;

                    // Récupérer l'URL publique de la photo
                    const { data: { publicUrl } } = supabase.storage
                        .from('elevator-photos')
                        .getPublicUrl(filePath);
                    
                    publicPhotoUrl = publicUrl;

                } catch (err) {
                    console.error("Erreur de téléversement de la photo sur Supabase Storage", err);
                    throw new Error("Impossible de stocker la photo sur le serveur. " + err.message);
                }
            }

            // 2. Insérer le rapport dans la table reports PostgreSQL
            const userDisplay = `${loggedTenant.username} (Appt ${loggedTenant.apartment})`;
            const { error: insertError } = await supabase
                .from('reports')
                .insert({
                    id: reportId,
                    entrance: String(entranceId),
                    type: String(rawReportData.type),
                    description: Security.sanitizeHTML(String(rawReportData.description).trim()),
                    user_display: userDisplay,
                    photo_url: publicPhotoUrl
                });

            if (insertError) throw insertError;

            // 3. Rafraîchir l'état local
            await _fetchAndAssembleState();
            
            return { id: reportId, photo: publicPhotoUrl };
        },

        /**
         * Supprime un signalement locataire (Réservé à l'administrateur)
         */
        async deleteReport(entranceId, reportId) {
            if (!Security.isAdminLoggedIn()) {
                throw new Error("Accès refusé : Connexion administrateur requise.");
            }

            // 1. Supprimer le rapport de PostgreSQL
            const { error } = await supabase
                .from('reports')
                .delete()
                .eq('id', String(reportId));

            if (error) throw error;

            // 2. Rafraîchir l'état local
            await _fetchAndAssembleState();
            return true;
        },

        /**
         * Met à jour le statut et les notes techniques de l'ascenseur (Réservé à l'administrateur)
         */
        async updateStatus(entranceId, newStatus, technicalNotes) {
            if (!Security.isAdminLoggedIn()) {
                throw new Error("Accès refusé : Connexion administrateur requise.");
            }

            const sanitizedNotes = technicalNotes ? Security.sanitizeHTML(String(technicalNotes).trim()) : "";
            const historyId = "h_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();

            let historyNote = "";
            const statusLabels = {
                "en_service": "Remise en service",
                "en_maintenance": "Mise en maintenance",
                "en_panne": "Signalement de panne / Arrêt"
            };

            if (sanitizedNotes) {
                historyNote = `${statusLabels[newStatus]} : ${sanitizedNotes}`;
            } else {
                historyNote = `${statusLabels[newStatus]} (changement d'état sans détails supplémentaires).`;
            }

            // 1. Mettre à jour l'ascenseur
            const { error: elError } = await supabase
                .from('elevators')
                .update({
                    status: newStatus,
                    last_status_change: new Date().toISOString(),
                    maintenance_notes: sanitizedNotes
                })
                .eq('id', String(entranceId));

            if (elError) throw elError;

            // 2. Ajouter l'historique
            const { error: histError } = await supabase
                .from('histories')
                .insert({
                    id: historyId,
                    entrance: String(entranceId),
                    status: newStatus,
                    notes: historyNote
                });

            if (histError) throw histError;

            // 3. Si remise en service complète, supprimer automatiquement tous les signalements de panne en cours
            if (newStatus === "en_service") {
                const { error: delError } = await supabase
                    .from('reports')
                    .delete()
                    .eq('entrance', String(entranceId));
                
                if (delError) console.error("Erreur lors de la suppression des signalements résolus", delError);
            }

            // 4. Rafraîchir l'état local
            await _fetchAndAssembleState();
            return true;
        },

        /**
         * Récupère les statistiques globales
         */
        getStats() {
            const stats = {
                en_service: 0,
                en_maintenance: 0,
                en_panne: 0,
                total: _elevators.length
            };

            _elevators.forEach(e => {
                if (e.status === "en_service") stats.en_service++;
                else if (e.status === "en_maintenance") stats.en_maintenance++;
                else if (e.status === "en_panne") stats.en_panne++;
            });

            return stats;
        },

        // ---------------------------------------------------------
        // GESTION DES RESIDENTS (SUPABASE AUTH)
        // ---------------------------------------------------------

        /**
         * Inscrit un nouveau locataire dans Supabase Auth (via email virtuel)
         */
        async registerTenant(username, password, entrance, apartment) {
            _ensureSupabase();
            const normalizedUser = Security.sanitizeHTML(String(username).trim());
            const normalizedApartment = Security.sanitizeHTML(String(apartment).trim());
            const virtualEmail = `${normalizedUser.toLowerCase()}@collectifplaine.local`;

            // Inscrire l'utilisateur dans Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email: virtualEmail,
                password: password,
                options: {
                    data: {
                        username: normalizedUser,
                        entrance: String(entrance),
                        apartment: normalizedApartment
                    }
                }
            });

            if (error) {
                // Traduction conviviale de l'erreur d'unicité de Supabase
                if (error.message.includes("already registered")) {
                    throw new Error("Ce pseudo est déjà utilisé par un autre résident.");
                }
                throw error;
            }

            // Initialiser la session locale synchrone
            const tenant = {
                username: normalizedUser,
                entrance: String(entrance),
                apartment: normalizedApartment
            };
            Security.setTenantSession(tenant);
            return tenant;
        },

        /**
         * Authentifie un locataire existant avec Supabase Auth
         */
        async loginTenant(username, password) {
            _ensureSupabase();
            const normalizedUser = String(username).trim();
            const virtualEmail = `${normalizedUser.toLowerCase()}@collectifplaine.local`;

            const { data, error } = await supabase.auth.signInWithPassword({
                email: virtualEmail,
                password: password
            });

            if (error) {
                if (error.message.includes("Invalid login credentials")) {
                    throw new Error("Pseudo ou mot de passe incorrect.");
                }
                throw error;
            }

            // Récupérer les métadonnées de l'utilisateur
            const meta = data.user.user_metadata;
            const tenant = {
                username: meta.username || normalizedUser,
                entrance: meta.entrance || "",
                apartment: meta.apartment || ""
            };

            Security.setTenantSession(tenant);
            return tenant;
        },

        /**
         * Déconnecte le locataire actif
         */
        async logoutTenant() {
            _ensureSupabase();
            try {
                await supabase.auth.signOut();
            } catch (e) {
                console.error("Erreur de déconnexion réseau Supabase", e);
            }
            Security.logoutTenant();
        }
    };
})();
