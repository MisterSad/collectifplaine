/**
 * Collectif Plaine - Magasin de Données (Store Supabase Live)
 * Gère la persistance sécurisée dans le cloud Supabase (PostgreSQL, Auth, Storage)
 */
const Store = (() => {
    // Variable locale pour stocker l'état assemblé des ascenseurs (compatibilité frontend)
    let _elevators = [];
    let _users = [];
    let _isLocalMode = false;

    // Charger les utilisateurs locaux depuis localStorage
    try {
        const storedUsers = localStorage.getItem("leclerc_asc_users_local");
        _users = storedUsers ? JSON.parse(storedUsers) : [];
    } catch (e) {
        console.error("Erreur de lecture de _users locaux", e);
    }

    function _loadLocalElevatorsState() {
        try {
            const data = localStorage.getItem("leclerc_asc_elevators_local");
            if (data) {
                _elevators = JSON.parse(data);
            } else {
                _elevators = JSON.parse(JSON.stringify(INITIAL_ELEVATOR_DATA));
                _saveLocalElevatorsState();
            }
        } catch (e) {
            console.error("Erreur de chargement de l'état local", e);
            _elevators = JSON.parse(JSON.stringify(INITIAL_ELEVATOR_DATA));
        }
    }

    function _saveLocalElevatorsState() {
        try {
            localStorage.setItem("leclerc_asc_elevators_local", JSON.stringify(_elevators));
        } catch (e) {
            console.error("Erreur d'écriture de l'état local", e);
        }
    }

    /**
     * Vérifie de manière robuste si le client Supabase est initialisé.
     * Lève une exception claire si un bloqueur de publicité ou Brave bloque le CDN.
     */
    function _ensureSupabase() {
        if (_isLocalMode) return; // Si nous sommes en mode local hors-ligne de secours, ne rien bloquer

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
        if (_isLocalMode) {
            _loadLocalElevatorsState();
            return;
        }
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
            _isLocalMode = false; // Tenter de se reconnecter à Supabase en direct
            try {
                _ensureSupabase();
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

                // Masquer le bandeau local si la connexion réussit
                const banner = document.getElementById("admin-banner");
                if (banner && banner.classList.contains("local-mode-active")) {
                    banner.classList.add("hidden");
                    banner.classList.remove("local-mode-active");
                }

                console.log("📡 [Store] Connexion Cloud Supabase opérationnelle.");

            } catch (err) {
                console.warn("📡 [Store Fallback] Supabase indisponible ou bloqué. Passage en Mode Local Hors-ligne.", err);
                _isLocalMode = true;
                
                // Charger l'état local
                _loadLocalElevatorsState();
                
                // Restaurer la session locale si elle existe
                const localTenant = Security.getLoggedInTenant();
                if (localTenant) {
                    Security.setTenantSession(localTenant);
                } else {
                    Security.logoutTenant();
                }

                // Afficher un bandeau informatif premium discret dans l'en-tête
                setTimeout(() => {
                    const banner = document.getElementById("admin-banner");
                    if (banner) {
                        banner.innerHTML = `⚠️ Mode Local Hors-ligne activé (Supabase est bloqué ou inaccessible). Les données sont conservées localement dans votre navigateur.`;
                        banner.className = "admin-banner local-mode-active";
                        banner.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
                        banner.style.color = "#ffffff";
                        banner.classList.remove("hidden");
                    }
                }, 500);
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

            if (_isLocalMode) {
                const el = _elevators.find(e => e.id === String(entranceId));
                if (!el) throw new Error("Ascenseur introuvable");
                
                const userDisplay = `${loggedTenant.username} (Appt ${loggedTenant.apartment})`;
                const newReport = {
                    id: reportId,
                    timestamp: Date.now(),
                    type: String(rawReportData.type),
                    description: Security.sanitizeHTML(String(rawReportData.description).trim()),
                    user: userDisplay,
                    photo: rawReportData.photo || null
                };
                
                el.tenantReports.unshift(newReport);
                _saveLocalElevatorsState();
                return { id: reportId, photo: rawReportData.photo || null };
            }

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

            if (_isLocalMode) {
                const el = _elevators.find(e => e.id === String(entranceId));
                if (el) {
                    el.tenantReports = el.tenantReports.filter(r => r.id !== String(reportId));
                    _saveLocalElevatorsState();
                }
                return true;
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

            if (_isLocalMode) {
                const el = _elevators.find(e => e.id === String(entranceId));
                if (!el) throw new Error("Ascenseur introuvable");
                
                el.status = newStatus;
                el.lastStatusChange = Date.now();
                el.maintenanceNotes = sanitizedNotes;
                
                el.history.unshift({
                    id: historyId,
                    timestamp: Date.now(),
                    status: newStatus,
                    notes: historyNote
                });
                
                if (newStatus === "en_service") {
                    el.tenantReports = [];
                }
                
                _saveLocalElevatorsState();
                return true;
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

            if (_isLocalMode) {
                const exists = _users.some(u => u.username.toLowerCase() === normalizedUser.toLowerCase());
                if (exists) {
                    throw new Error("Ce pseudo est déjà utilisé par un autre résident.");
                }

                const passwordHash = await Security.hashPassword(password, normalizedUser);
                const newUser = {
                    username: normalizedUser,
                    entrance: String(entrance),
                    apartment: normalizedApartment,
                    passwordHash: passwordHash
                };

                _users.push(newUser);
                try {
                    localStorage.setItem("leclerc_asc_users_local", JSON.stringify(_users));
                } catch (e) {
                    console.error("Erreur d'écriture de _users", e);
                }

                Security.setTenantSession(newUser);
                return newUser;
            }

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

            if (_isLocalMode) {
                const user = _users.find(u => u.username.toLowerCase() === normalizedUser.toLowerCase());
                if (!user) {
                    throw new Error("Pseudo ou mot de passe incorrect.");
                }

                const calculatedHash = await Security.hashPassword(password, user.username);
                if (calculatedHash !== user.passwordHash) {
                    throw new Error("Pseudo ou mot de passe incorrect.");
                }

                Security.setTenantSession(user);
                return user;
            }

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
            if (_isLocalMode) {
                Security.logoutTenant();
                return;
            }
            try {
                await supabase.auth.signOut();
            } catch (e) {
                console.error("Erreur de déconnexion réseau Supabase", e);
            }
            Security.logoutTenant();
        }
    };
})();
