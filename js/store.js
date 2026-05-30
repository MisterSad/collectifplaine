/**
 * Collectif Plaine - Magasin de Données (Store Supabase Live)
 * Gère la persistance sécurisée dans le cloud Supabase (PostgreSQL, Storage)
 * L'authentification utilise une table personnalisée "residents".
 */
const Store = (() => {
    let _elevators = [];
    let _incidents = [];
    let _messages = [];

    /**
     * Vérifie de manière robuste si le client Supabase est initialisé.
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
            throw new Error("Le client de base de données (Supabase) n'a pas pu être initialisé. Assurez-vous d'être connecté à internet et désactivez vos bloqueurs de publicité.");
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

            // 4. Récupérer les autres incidents
            const { data: incidents, error: incError } = await supabase
                .from('incidents')
                .select('*')
                .order('created_at', { ascending: false });

            if (incError) throw incError;

            // 5. Récupérer les messages du tableau d'affichage
            const { data: messages, error: msgError } = await supabase
                .from('community_messages')
                .select('*')
                .order('created_at', { ascending: false });

            if (msgError) throw msgError;

            // 6. Assemblage au format de l'application
            _incidents = incidents || [];
            _messages = messages || [];
            _elevators = elevators.map(el => {
                const elReports = reports
                    ? reports.filter(r => String(r.entrance) === String(el.id)).map(r => ({
                        id: r.id,
                        timestamp: new Date(r.created_at).getTime(),
                        type: r.type,
                        description: r.description,
                        user: r.user_display,
                        photo: r.photo_url
                    }))
                    : [];

                    const elHistory = histories
                    ? histories.filter(h => String(h.entrance) === String(el.id)).map(h => ({
                        id: h.id,
                        timestamp: new Date(h.created_at).getTime(),
                        status: h.status,
                        notes: h.notes
                    }))
                    : [];

                // Calculate cumulative downtime
                let downtimeMs = 0;
                let downSince = null;
                const sortedHistory = [...elHistory].sort((a, b) => a.timestamp - b.timestamp);
                
                for (const event of sortedHistory) {
                    if (event.status !== 'en_service') {
                        if (downSince === null) downSince = event.timestamp;
                    } else {
                        if (downSince !== null) {
                            downtimeMs += (event.timestamp - downSince);
                            downSince = null;
                        }
                    }
                }
                
                // If currently down and we have a tracked downSince
                if (el.status !== 'en_service') {
                    if (downSince !== null) {
                        downtimeMs += (Date.now() - downSince);
                    } else if (el.last_status_change) {
                        // Edge case: no prior history, but we know it's currently down since last_status_change
                        downtimeMs += (Date.now() - new Date(el.last_status_change).getTime());
                    }
                }

                const downtimeDays = Math.floor(downtimeMs / (1000 * 60 * 60 * 24));

                return {
                    id: el.id,
                    status: el.status,
                    lastStatusChange: new Date(el.last_status_change).getTime(),
                    maintenanceNotes: el.maintenance_notes || "",
                    tenantReports: elReports,
                    history: elHistory,
                    downtimeDays: downtimeDays
                };
            });
            
            // Notifier l'application que les données ont été mises à jour
            window.dispatchEvent(new CustomEvent("storeUpdated"));
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
            try {
                _ensureSupabase();
                
                // 1. Charger les ascenseurs pour vérifier si la table est vide
                const { data: elevators, error } = await supabase
                    .from('elevators')
                    .select('id');

                if (error) throw error;

                // 2. Auto-seeding si 0 lignes trouvées
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

                // 3. Charger et assembler l'état
                await _fetchAndAssembleState();

                // Masquer le bandeau local s'il existe (nettoyage UI)
                const banner = document.getElementById("admin-banner");
                if (banner && banner.classList.contains("local-mode-active")) {
                    banner.classList.add("hidden");
                    banner.classList.remove("local-mode-active");
                }

                console.log("📡 [Store] Connexion Cloud Supabase opérationnelle.");
            } catch (err) {
                console.error("Erreur critique lors de l'initialisation Supabase.", err);
                throw err; // Propage l'erreur pour la gérer dans app.js
            }
        },

        getElevators() {
            return JSON.parse(JSON.stringify(_elevators));
        },

        getIncidents() {
            return JSON.parse(JSON.stringify(_incidents));
        },

        getMessages() {
            return JSON.parse(JSON.stringify(_messages));
        },

        getElevatorById(id) {
            const elevator = _elevators.find(e => e.id === String(id));
            return elevator ? JSON.parse(JSON.stringify(elevator)) : null;
        },

        async addReport(entranceId, rawReportData) {
            _ensureSupabase();
            const loggedTenant = Security.getLoggedInTenant();
            if (!loggedTenant) {
                throw new Error("Accès refusé : Vous devez créer un compte locataire et être connecté pour signaler un incident.");
            }

            const reportId = "r_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
            let publicPhotoUrl = null;

            // 1. Traitement de la photo si elle est fournie
            if (rawReportData.photo) {
                try {
                    const response = await fetch(rawReportData.photo);
                    const blob = await response.blob();
                    
                    const filePath = `reports/${entranceId}/${reportId}.jpg`;

                    const { error: uploadError } = await supabase.storage
                        .from('elevator-photos')
                        .upload(filePath, blob, {
                            contentType: 'image/jpeg',
                            cacheControl: '3600',
                            upsert: false
                        });

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('elevator-photos')
                        .getPublicUrl(filePath);
                    
                    publicPhotoUrl = publicUrl;
                } catch (err) {
                    console.error("Erreur de téléversement de la photo", err);
                    throw new Error("Impossible de stocker la photo. " + err.message);
                }
            }

            // 2. Insérer le rapport dans PostgreSQL
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

            // 3. Passer automatiquement l'ascenseur en panne
            const elevator = this.getElevatorById(entranceId);
            if (elevator && elevator.status !== 'en_panne') {
                const historyId = "h_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
                const historyNote = `Signalement de panne automatique suite au rapport de ${userDisplay}`;
                
                const { error: updateError } = await supabase
                    .from('elevators')
                    .update({
                        status: 'en_panne',
                        last_status_change: new Date().toISOString()
                    })
                    .eq('id', String(entranceId));
                    
                if (updateError) console.error("Erreur mise à jour statut auto:", updateError);

                const { error: histError } = await supabase
                    .from('histories')
                    .insert({
                        id: historyId,
                        entrance: String(entranceId),
                        status: 'en_panne',
                        notes: historyNote
                    });
                    
                if (histError) console.error("Erreur historique auto:", histError);
            }

            await _fetchAndAssembleState();
            return { id: reportId, photo: publicPhotoUrl };
        },

        async deleteReport(entranceId, reportId) {
            _ensureSupabase();
            if (!Security.getLoggedInTenant()) {
                throw new Error("Accès refusé : Vous devez être connecté pour supprimer un signalement.");
            }

            const { error } = await supabase
                .from('reports')
                .delete()
                .eq('id', String(reportId));

            if (error) throw error;
            await _fetchAndAssembleState();
            return true;
        },

        async addIncident(rawIncidentData) {
            _ensureSupabase();
            const loggedTenant = Security.getLoggedInTenant();
            if (!loggedTenant) {
                throw new Error("Accès refusé : Vous devez être connecté pour signaler un incident.");
            }

            const incidentId = "i_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
            let publicPhotoUrl = null;

            if (rawIncidentData.photo) {
                try {
                    const response = await fetch(rawIncidentData.photo);
                    const blob = await response.blob();
                    const filePath = `incidents/${rawIncidentData.category}/${incidentId}.jpg`;

                    const { error: uploadError } = await supabase.storage
                        .from('elevator-photos') // On réutilise le même bucket de stockage pour l'instant
                        .upload(filePath, blob, {
                            contentType: 'image/jpeg',
                            cacheControl: '3600',
                            upsert: false
                        });

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('elevator-photos')
                        .getPublicUrl(filePath);
                    
                    publicPhotoUrl = publicUrl;
                } catch (err) {
                    console.error("Erreur de téléversement photo incident", err);
                }
            }

            const userDisplay = `${loggedTenant.username} (Appt ${loggedTenant.apartment})`;
            const { error: insertError } = await supabase
                .from('incidents')
                .insert({
                    id: incidentId,
                    entrance: String(rawIncidentData.entrance),
                    category: String(rawIncidentData.category),
                    description: Security.sanitizeHTML(String(rawIncidentData.description).trim()),
                    user_display: userDisplay,
                    photo_url: publicPhotoUrl,
                    status: 'nouveau'
                });

            if (insertError) throw insertError;
            await _fetchAndAssembleState();
            return { id: incidentId };
        },

        async addMessage(rawMessageData) {
            _ensureSupabase();
            const loggedTenant = Security.getLoggedInTenant();
            if (!loggedTenant) {
                throw new Error("Accès refusé : Vous devez être connecté pour publier un message.");
            }

            const messageId = "m_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
            const author = `${loggedTenant.username} (Appt ${loggedTenant.apartment})`;

            const { error: insertError } = await supabase
                .from('community_messages')
                .insert({
                    id: messageId,
                    entrance: rawMessageData.entrance === 'tous' ? null : String(rawMessageData.entrance),
                    type: String(rawMessageData.type),
                    content: Security.sanitizeHTML(String(rawMessageData.content).trim()),
                    author: author
                });

            if (insertError) throw insertError;
            await _fetchAndAssembleState();
            return { id: messageId };
        },

        async updateStatus(entranceId, newStatus, technicalNotes) {
            _ensureSupabase();
            if (!Security.getLoggedInTenant()) {
                throw new Error("Accès refusé : Vous devez être connecté pour mettre à jour le statut.");
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

            const { error: elError } = await supabase
                .from('elevators')
                .update({
                    status: newStatus,
                    last_status_change: new Date().toISOString(),
                    maintenance_notes: sanitizedNotes
                })
                .eq('id', String(entranceId));

            if (elError) throw elError;

            const { error: histError } = await supabase
                .from('histories')
                .insert({
                    id: historyId,
                    entrance: String(entranceId),
                    status: newStatus,
                    notes: historyNote
                });

            if (histError) throw histError;

            if (newStatus === "en_service") {
                const { error: delError } = await supabase
                    .from('reports')
                    .delete()
                    .eq('entrance', String(entranceId));
                
                if (delError) console.error("Erreur lors de la suppression des signalements résolus", delError);
            }

            await _fetchAndAssembleState();
            return true;
        },

        getStats() {
            const stats = { en_service: 0, en_maintenance: 0, en_panne: 0, total: _elevators.length, total_downtime: 0 };
            _elevators.forEach(e => {
                if (e.status === "en_service") stats.en_service++;
                else if (e.status === "en_maintenance") stats.en_maintenance++;
                else if (e.status === "en_panne") stats.en_panne++;
                
                if (e.downtimeDays) {
                    stats.total_downtime += e.downtimeDays;
                }
            });
            return stats;
        },

        // ---------------------------------------------------------
        // GESTION DES RESIDENTS (SUPABASE TABLE 'residents')
        // ---------------------------------------------------------

        async registerTenant(username, password, entrance, apartment) {
            _ensureSupabase();
            const normalizedUser = Security.sanitizeHTML(String(username).trim());
            const normalizedApartment = Security.sanitizeHTML(String(apartment).trim());

            // 1. Vérifier si le pseudo existe déjà dans Supabase
            const { data: existingUser, error: searchError } = await supabase
                .from('residents')
                .select('username')
                .ilike('username', normalizedUser)
                .maybeSingle();
                
            if (searchError) throw searchError;
            if (existingUser) {
                throw new Error("Ce pseudo est déjà utilisé par un autre résident.");
            }

            // 2. Hacher le mot de passe localement avant envoi
            const passwordHash = await Security.hashPassword(password, normalizedUser);
            const userId = "u_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();

            // 3. Insérer le nouvel utilisateur dans la table
            const { error: insertError } = await supabase
                .from('residents')
                .insert({
                    id: userId,
                    username: normalizedUser,
                    password_hash: passwordHash,
                    entrance: String(entrance),
                    apartment: normalizedApartment
                });

            if (insertError) throw insertError;

            // 4. Initialiser la session locale
            const tenant = {
                username: normalizedUser,
                entrance: String(entrance),
                apartment: normalizedApartment
            };
            Security.setTenantSession(tenant);
            return tenant;
        },

        async loginTenant(username, password) {
            _ensureSupabase();
            const normalizedUser = String(username).trim();

            // 1. Rechercher l'utilisateur
            const { data: user, error } = await supabase
                .from('residents')
                .select('*')
                .ilike('username', normalizedUser)
                .maybeSingle();

            if (error) throw error;
            if (!user) {
                throw new Error("Pseudo ou mot de passe incorrect.");
            }

            // 2. Vérifier le mot de passe
            const calculatedHash = await Security.hashPassword(password, user.username);
            if (calculatedHash !== user.password_hash) {
                throw new Error("Pseudo ou mot de passe incorrect.");
            }

            // 3. Initialiser la session
            const tenant = {
                username: user.username,
                entrance: user.entrance,
                apartment: user.apartment
            };
            Security.setTenantSession(tenant);
            return tenant;
        },

        async logoutTenant() {
            Security.logoutTenant();
        }
    };
})();
