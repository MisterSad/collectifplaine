/**
 * Collectif Plaine - Magasin de Données (Store Supabase Live)
 * Gère la persistance sécurisée dans le cloud Supabase (PostgreSQL, Storage)
 * L'authentification utilise une table personnalisée "residents".
 */
const Store = (() => {
    let _elevators = [];
    let _incidents = [];
    let _messages = [];
    let _petitions = [];
    let _polls = [];

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

            // 6. Récupérer les pétitions et signatures
            const { data: petitions, error: petError } = await supabase
                .from('petitions')
                .select('*, petition_signatures(*, residents(username, entrance, first_name, last_name))')
                .order('created_at', { ascending: false });

            if (petError) throw petError;

            // 7. Récupérer les scrutins (sondages / votes)
            const { data: polls, error: pollError } = await supabase
                .from('polls')
                .select('*, poll_votes(*)')
                .order('created_at', { ascending: false });

            if (pollError) throw pollError;

            // 8. Assigner l'état local
            _incidents = incidents || [];
            _messages = messages || [];
            _petitions = petitions || [];
            _polls = polls || [];
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

                // Calculate cumulative downtime in calendar days
                let downSince = null;
                const sortedHistory = [...elHistory].sort((a, b) => a.timestamp - b.timestamp);
                
                const downtimeDates = new Set();

                function addDatesToSet(startMs, endMs) {
                    const startDay = new Date(startMs);
                    startDay.setHours(0, 0, 0, 0);
                    const endDay = new Date(endMs);
                    endDay.setHours(0, 0, 0, 0);
                    
                    let currentDay = new Date(startDay.getTime());
                    while (currentDay <= endDay) {
                        // local time date string format YYYY-MM-DD
                        const year = currentDay.getFullYear();
                        const month = String(currentDay.getMonth() + 1).padStart(2, '0');
                        const day = String(currentDay.getDate()).padStart(2, '0');
                        downtimeDates.add(`${year}-${month}-${day}`);
                        currentDay.setDate(currentDay.getDate() + 1);
                    }
                }

                for (const event of sortedHistory) {
                    if (event.status !== 'en_service') {
                        if (downSince === null) downSince = event.timestamp;
                    } else {
                        if (downSince !== null) {
                            addDatesToSet(downSince, event.timestamp);
                            downSince = null;
                        }
                    }
                }
                
                // If currently down and we have a tracked downSince
                if (el.status !== 'en_service') {
                    if (downSince !== null) {
                        addDatesToSet(downSince, Date.now());
                    } else if (el.last_status_change) {
                        // Edge case: no prior history, but we know it's currently down since last_status_change
                        addDatesToSet(new Date(el.last_status_change).getTime(), Date.now());
                    }
                }

                const downtimeDays = downtimeDates.size;

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
            
            // Mettre en cache locale pour le mode hors-ligne
            try {
                localStorage.setItem("leclerc_asc_cached_elevators", JSON.stringify(_elevators));
                localStorage.setItem("leclerc_asc_cached_incidents", JSON.stringify(_incidents));
                localStorage.setItem("leclerc_asc_cached_messages", JSON.stringify(_messages));
                localStorage.setItem("leclerc_asc_cached_petitions", JSON.stringify(_petitions));
                localStorage.setItem("leclerc_asc_cached_polls", JSON.stringify(_polls));
            } catch (e) {
                console.error("Erreur de sauvegarde dans le cache local", e);
            }

            window.dispatchEvent(new CustomEvent("storeUpdated"));
        } catch (err) {
            console.warn("⚠️ Impossible de rafraîchir l'état depuis le serveur. Chargement du cache local.", err);
            
            try {
                const cachedElevators = localStorage.getItem("leclerc_asc_cached_elevators");
                const cachedIncidents = localStorage.getItem("leclerc_asc_cached_incidents");
                const cachedMessages = localStorage.getItem("leclerc_asc_cached_messages");
                const cachedPetitions = localStorage.getItem("leclerc_asc_cached_petitions");
                const cachedPolls = localStorage.getItem("leclerc_asc_cached_polls");
                
                if (cachedElevators) _elevators = JSON.parse(cachedElevators);
                if (cachedIncidents) _incidents = JSON.parse(cachedIncidents);
                if (cachedMessages) _messages = JSON.parse(cachedMessages);
                if (cachedPetitions) _petitions = JSON.parse(cachedPetitions);
                if (cachedPolls) _polls = JSON.parse(cachedPolls);
                
                window.dispatchEvent(new CustomEvent("storeUpdated"));
                
                if (cachedElevators) {
                    return; // Succès de chargement depuis le cache, ne pas lever d'erreur
                }
            } catch (cacheErr) {
                console.error("Erreur lors de la lecture du cache local", cacheErr);
            }
            throw err;
        }
    }

    // ── GESTION DE LA FILE DE SYNCHRONISATION HORS-LIGNE ──
    const SYNC_QUEUE_KEY = "leclerc_asc_sync_queue";

    function _getSyncQueue() {
        try {
            const queueStr = localStorage.getItem(SYNC_QUEUE_KEY);
            return queueStr ? JSON.parse(queueStr) : [];
        } catch (e) {
            console.error("Erreur lecture file de synchronisation", e);
            return [];
        }
    }

    function _saveSyncQueue(queue) {
        try {
            localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
        } catch (e) {
            console.error("Erreur écriture file de synchronisation", e);
        }
    }

    function _addToSyncQueue(action, payload) {
        const queue = _getSyncQueue();
        const item = {
            id: "sq_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now(),
            action: action,
            payload: payload,
            timestamp: Date.now()
        };
        queue.push(item);
        _saveSyncQueue(queue);

        if (typeof window !== "undefined" && window.showSystemToast) {
            window.showSystemToast(
                "Mode hors-ligne",
                "Votre action a été enregistrée localement et sera synchronisée dès le retour du réseau.",
                "OK"
            );
        }
    }

    function _setupNetworkListeners() {
        if (typeof window === "undefined") return;
        
        if (window._networkListenersAttached) return;
        window._networkListenersAttached = true;

        window.addEventListener("online", () => {
            console.log("🌐 [Network] Connexion réseau rétablie !");
            Store.syncOfflineData();
        });

        window.addEventListener("offline", () => {
            console.log("🌐 [Network] Connexion réseau coupée.");
            if (window.showSystemToast) {
                window.showSystemToast(
                    "Mode hors-ligne",
                    "Connexion perdue. L'application reste utilisable et vos actions seront synchronisées ultérieurement.",
                    "OK"
                );
            }
        });
    }

    return {
        /**
         * Initialise la connexion et effectue l'auto-seeding si la base est vide
         */
        async init() {
            _setupNetworkListeners();

            // Si hors ligne dès le départ, charger le cache et s'arrêter là
            if (!navigator.onLine) {
                console.log("📡 [Store] Démarrage hors-ligne détecté. Chargement des données locales...");
                try {
                    const cachedElevators = localStorage.getItem("leclerc_asc_cached_elevators");
                    const cachedIncidents = localStorage.getItem("leclerc_asc_cached_incidents");
                    const cachedMessages = localStorage.getItem("leclerc_asc_cached_messages");
                    const cachedPetitions = localStorage.getItem("leclerc_asc_cached_petitions");
                    const cachedPolls = localStorage.getItem("leclerc_asc_cached_polls");
                    
                    if (cachedElevators) _elevators = JSON.parse(cachedElevators);
                    if (cachedIncidents) _incidents = JSON.parse(cachedIncidents);
                    if (cachedMessages) _messages = JSON.parse(cachedMessages);
                    if (cachedPetitions) _petitions = JSON.parse(cachedPetitions);
                    if (cachedPolls) _polls = JSON.parse(cachedPolls);
                    
                    window.dispatchEvent(new CustomEvent("storeUpdated"));
                    return;
                } catch (e) {
                    console.error("Échec de chargement initial du cache local", e);
                }
            }

            try {
                _ensureSupabase();
                
                // 1. Charger les ascenseurs pour vérifier si la table est vide
                const { data: elevators, error } = await supabase
                    .from('elevators')
                    .select('id');

                if (error) throw error;

                // 2. Auto-seeding / Auto-migration : insérer les entrées de CONFIG.entrances absentes de Supabase
                const existingIds = new Set(elevators.map(el => String(el.id)));
                const missingEntrances = CONFIG.entrances.filter(ent => ent.hasElevator !== false && !existingIds.has(String(ent.id)));
                
                if (missingEntrances.length > 0) {
                    console.log(`🚀 [Supabase Seeding] Insertion des ${missingEntrances.length} nouvelles entrées manquantes...`);
                    const seedData = missingEntrances.map(ent => {
                        const initial = INITIAL_ELEVATOR_DATA.find(i => String(i.id) === String(ent.id));
                        return {
                            id: ent.id,
                            status: initial ? initial.status : "en_service",
                            last_status_change: new Date(initial ? initial.lastStatusChange : Date.now()).toISOString(),
                            maintenance_notes: initial ? initial.maintenanceNotes : ""
                        };
                    });
                    
                    try {
                        const { error: seedError } = await supabase
                            .from('elevators')
                            .insert(seedData);
                        if (seedError) {
                            console.warn("⚠️ Échec de l'auto-seeding (attendu si non connecté) :", seedError.message);
                        }
                    } catch (e) {
                        console.warn("⚠️ Erreur lors de l'auto-seeding :", e);
                    }
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
                
                // Lancer la synchro des données en attente au démarrage (si connecté)
                Store.syncOfflineData();
            } catch (err) {
                console.error("Erreur critique lors de l'initialisation Supabase.", err);
                throw err; // Propage l'erreur pour la gérer dans app.js
            }
        },

        async syncOfflineData() {
            if (!navigator.onLine) return;
            const queue = _getSyncQueue();
            if (queue.length === 0) return;

            console.log(`🔄 [Store] Début de la synchronisation de ${queue.length} actions hors-ligne...`);
            if (window.showSystemToast) {
                window.showSystemToast(
                    "Synchronisation",
                    `Synchronisation en arrière-plan de ${queue.length} action(s)...`,
                    ""
                );
            }

            let successCount = 0;
            let failureCount = 0;
            const newQueue = [];

            for (const item of queue) {
                try {
                    _ensureSupabase();
                    const { action, payload } = item;
                    
                    if (action === 'addReport') {
                        let publicPhotoUrl = null;
                        if (payload.rawReportData.photo) {
                            try {
                                const response = await fetch(payload.rawReportData.photo);
                                const blob = await response.blob();
                                const filePath = `reports/${payload.entranceId}/${payload.reportId}.jpg`;
                                const { error: uploadError } = await supabase.storage
                                    .from('elevator-photos')
                                    .upload(filePath, blob, {
                                        contentType: 'image/jpeg',
                                        cacheControl: '3600',
                                        upsert: true
                                    });
                                if (uploadError) throw uploadError;
                                const { data: { publicUrl } } = supabase.storage
                                    .from('elevator-photos')
                                    .getPublicUrl(filePath);
                                publicPhotoUrl = publicUrl;
                            } catch (e) {
                                console.error("Erreur d'upload de photo lors de la synchro :", e);
                            }
                        }

                        const { error: insertError } = await supabase
                            .from('reports')
                            .insert({
                                id: payload.reportId,
                                entrance: String(payload.entranceId),
                                type: String(payload.rawReportData.type),
                                description: Security.sanitizeHTML(String(payload.rawReportData.description).trim()),
                                user_display: payload.userDisplay,
                                photo_url: publicPhotoUrl,
                                created_at: new Date(payload.timestamp).toISOString()
                            });
                        if (insertError) throw insertError;

                        const { error: updateError } = await supabase
                            .from('elevators')
                            .update({
                                status: 'en_panne',
                                last_status_change: new Date(payload.timestamp).toISOString()
                            })
                            .eq('id', String(payload.entranceId));
                        if (updateError) console.error("Erreur mise à jour statut auto:", updateError);

                        const { error: histError } = await supabase
                            .from('histories')
                            .insert({
                                id: payload.historyId,
                                entrance: String(payload.entranceId),
                                status: 'en_panne',
                                notes: `Signalement de panne automatique suite au rapport de ${payload.userDisplay}`,
                                created_at: new Date(payload.timestamp).toISOString()
                            });
                        if (histError) console.error("Erreur historique auto:", histError);

                    } else if (action === 'deleteReport') {
                        const { error } = await supabase
                            .from('reports')
                            .delete()
                            .eq('id', String(payload.reportId));
                        if (error) throw error;

                    } else if (action === 'addIncident') {
                        let publicPhotoUrl = null;
                        if (payload.rawIncidentData.photo) {
                            try {
                                const response = await fetch(payload.rawIncidentData.photo);
                                const blob = await response.blob();
                                const filePath = `incidents/${payload.rawIncidentData.category}/${payload.incidentId}.jpg`;
                                const { error: uploadError } = await supabase.storage
                                    .from('elevator-photos')
                                    .upload(filePath, blob, {
                                        contentType: 'image/jpeg',
                                        cacheControl: '3600',
                                        upsert: true
                                    });
                                if (uploadError) throw uploadError;
                                const { data: { publicUrl } } = supabase.storage
                                    .from('elevator-photos')
                                    .getPublicUrl(filePath);
                                publicPhotoUrl = publicUrl;
                            } catch (e) {
                                console.error("Erreur upload photo incident synchro :", e);
                            }
                        }

                        const { error: insertError } = await supabase
                            .from('incidents')
                            .insert({
                                id: payload.incidentId,
                                entrance: String(payload.rawIncidentData.entrance),
                                category: String(payload.rawIncidentData.category),
                                description: Security.sanitizeHTML(String(payload.rawIncidentData.description).trim()),
                                user_display: payload.userDisplay,
                                photo_url: publicPhotoUrl,
                                status: 'nouveau',
                                created_at: new Date(payload.timestamp).toISOString()
                            });
                        if (insertError) throw insertError;

                    } else if (action === 'updateIncidentStatus') {
                        const { error } = await supabase
                            .from('incidents')
                            .update({
                                status: String(payload.newStatus)
                            })
                            .eq('id', String(payload.incidentId));
                        if (error) throw error;

                    } else if (action === 'updateIncident') {
                        const allowedFields = {};
                        if (payload.fields.status !== undefined) allowedFields.status = String(payload.fields.status);
                        if (payload.fields.description !== undefined) {
                            allowedFields.description = Security.sanitizeHTML(String(payload.fields.description).trim());
                        }
                        const { error } = await supabase
                            .from('incidents')
                            .update(allowedFields)
                            .eq('id', String(payload.incidentId));
                        if (error) throw error;

                    } else if (action === 'addMessage') {
                        const { error: insertError } = await supabase
                            .from('community_messages')
                            .insert({
                                id: payload.messageId,
                                entrance: payload.rawMessageData.entrance === 'tous' ? null : String(payload.rawMessageData.entrance),
                                type: String(payload.rawMessageData.type),
                                content: Security.sanitizeHTML(String(payload.rawMessageData.content).trim()),
                                author: payload.author,
                                created_at: new Date(payload.timestamp).toISOString()
                            });
                        if (insertError) throw insertError;

                    } else if (action === 'updateStatus') {
                        const { error: elError } = await supabase
                            .from('elevators')
                            .update({
                                status: payload.newStatus,
                                last_status_change: new Date(payload.timestamp).toISOString(),
                                maintenance_notes: payload.technicalNotes ? Security.sanitizeHTML(String(payload.technicalNotes).trim()) : ""
                            })
                            .eq('id', String(payload.entranceId));
                        if (elError) throw elError;

                        const statusLabels = {
                            "en_service": "Remise en service",
                            "en_maintenance": "Mise en maintenance",
                            "en_panne": "Signalement de panne / Arrêt"
                        };
                        const notes = payload.technicalNotes ? Security.sanitizeHTML(String(payload.technicalNotes).trim()) : "";
                        const historyNote = notes ? `${statusLabels[payload.newStatus]} : ${notes}` : `${statusLabels[payload.newStatus]} (changement d'état sans détails supplémentaires).`;

                        const { error: histError } = await supabase
                            .from('histories')
                            .insert({
                                id: payload.historyId,
                                entrance: String(payload.entranceId),
                                status: payload.newStatus,
                                notes: historyNote,
                                created_at: new Date(payload.timestamp).toISOString()
                            });
                        if (histError) throw histError;

                        if (payload.newStatus === "en_service") {
                            const { error: delError } = await supabase
                                .from('reports')
                                .delete()
                                .eq('entrance', String(payload.entranceId));
                            if (delError) console.error("Erreur suppression reports:", delError);
                        }

                    } else if (action === 'updateTenantProfile') {
                        const { username, entrance, apartment, firstName, lastName, notifications, phone, email } = payload;
                        const normalizedUser = Security.sanitizeHTML(String(username).trim());
                        const normalizedApartment = Security.sanitizeHTML(String(apartment).trim());
                        const cleanFirstName = Security.sanitizeHTML(String(firstName).trim());
                        const cleanLastName = Security.sanitizeHTML(String(lastName).trim());
                        const cleanPhone = Security.sanitizeHTML(String(phone).trim());
                        const cleanEmail = Security.sanitizeHTML(String(email).trim());

                        try {
                            const { error } = await supabase
                                .from('residents')
                                .update({
                                    entrance: String(entrance),
                                    apartment: normalizedApartment,
                                    first_name: cleanFirstName,
                                    last_name: cleanLastName,
                                    notifications: Boolean(notifications),
                                    phone: cleanPhone,
                                    email: cleanEmail
                                })
                                .ilike('username', normalizedUser);
                            if (error) throw error;
                        } catch (err) {
                            console.warn("Échec de mise à jour des colonnes de contact en synchro. Tentative de repli.", err);
                            try {
                                const { error: secondError } = await supabase
                                    .from('residents')
                                    .update({
                                        entrance: String(entrance),
                                        apartment: normalizedApartment,
                                        first_name: cleanFirstName,
                                        last_name: cleanLastName,
                                        notifications: Boolean(notifications)
                                    })
                                    .ilike('username', normalizedUser);
                                if (secondError) throw secondError;
                            } catch (fallbackErr) {
                                console.warn("Échec de mise à jour des colonnes de profil en synchro. Tentative de mise à jour restreinte d'origine.", fallbackErr);
                                const { error: fallbackError } = await supabase
                                    .from('residents')
                                    .update({
                                        entrance: String(entrance),
                                        apartment: normalizedApartment
                                    })
                                    .ilike('username', normalizedUser);
                                if (fallbackError) throw fallbackError;
                            }
                        }
                    }

                    successCount++;
                } catch (err) {
                    console.error(`❌ [Store] Échec de la synchronisation de l'action ${item.action}`, err);
                    failureCount++;
                    newQueue.push(item);
                }
            }

            _saveSyncQueue(newQueue);

            if (successCount > 0) {
                console.log(`✅ [Store] Synchronisation réussie pour ${successCount} action(s).`);
                if (window.showSystemToast) {
                    window.showSystemToast(
                        "Synchronisation réussie",
                        `${successCount} action(s) synchronisée(s) avec succès.`,
                        "OK"
                    );
                }
                try {
                    await _fetchAndAssembleState();
                } catch (e) {
                    console.error("Erreur de rafraîchissement post-synchro :", e);
                }
            }

            if (failureCount > 0) {
                console.warn(`⚠️ [Store] ${failureCount} action(s) n'ont pas pu être synchronisées.`);
                if (window.showSystemToast) {
                    window.showSystemToast(
                        "Synchronisation partielle",
                        `${failureCount} action(s) en attente de réseau ou de résolution.`,
                        "OK"
                    );
                }
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
            const loggedTenant = Security.getLoggedInTenant();
            if (!loggedTenant) {
                throw new Error("Accès refusé : Vous devez créer un compte locataire et être connecté pour signaler un incident.");
            }

            if (!navigator.onLine) {
                const reportId = "r_offline_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
                const historyId = "h_offline_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
                const userDisplay = `${loggedTenant.username} (Appt ${loggedTenant.apartment})`;
                
                _addToSyncQueue('addReport', {
                    entranceId,
                    rawReportData,
                    reportId,
                    historyId,
                    userDisplay,
                    timestamp: Date.now()
                });

                const elevator = _elevators.find(e => String(e.id) === String(entranceId));
                if (elevator) {
                    const localReport = {
                        id: reportId,
                        timestamp: Date.now(),
                        type: rawReportData.type,
                        description: Security.sanitizeHTML(String(rawReportData.description).trim()),
                        user: userDisplay,
                        photo: rawReportData.photo || null
                    };
                    elevator.tenantReports = elevator.tenantReports || [];
                    elevator.tenantReports.unshift(localReport);

                    if (elevator.status !== 'en_panne') {
                        elevator.status = 'en_panne';
                        elevator.lastStatusChange = Date.now();
                        const localHistory = {
                            id: historyId,
                            timestamp: Date.now(),
                            status: 'en_panne',
                            notes: `Signalement de panne automatique suite au rapport de ${userDisplay}`
                        };
                        elevator.history = elevator.history || [];
                        elevator.history.unshift(localHistory);
                    }
                }

                localStorage.setItem("leclerc_asc_cached_elevators", JSON.stringify(_elevators));
                window.dispatchEvent(new CustomEvent("storeUpdated"));
                return { id: reportId, photo: rawReportData.photo || null };
            }

            _ensureSupabase();

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
            if (!Security.getLoggedInTenant()) {
                throw new Error("Accès refusé : Vous devez être connecté pour supprimer un signalement.");
            }

            if (!navigator.onLine) {
                if (String(reportId).startsWith("r_offline_")) {
                    const queue = _getSyncQueue();
                    const updatedQueue = queue.filter(item => !(item.action === 'addReport' && item.payload.reportId === reportId));
                    _saveSyncQueue(updatedQueue);
                } else {
                    _addToSyncQueue('deleteReport', { entranceId, reportId });
                }

                const elevator = _elevators.find(e => String(e.id) === String(entranceId));
                if (elevator && elevator.tenantReports) {
                    elevator.tenantReports = elevator.tenantReports.filter(r => String(r.id) !== String(reportId));
                }

                localStorage.setItem("leclerc_asc_cached_elevators", JSON.stringify(_elevators));
                window.dispatchEvent(new CustomEvent("storeUpdated"));
                return true;
            }

            _ensureSupabase();

            const { error } = await supabase
                .from('reports')
                .delete()
                .eq('id', String(reportId));

            if (error) throw error;
            await _fetchAndAssembleState();
            return true;
        },

        async addIncident(rawIncidentData) {
            const loggedTenant = Security.getLoggedInTenant();
            if (!loggedTenant) {
                throw new Error("Accès refusé : Vous devez être connecté pour signaler un incident.");
            }

            if (!navigator.onLine) {
                const incidentId = "i_offline_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
                const userDisplay = `${loggedTenant.username} (Appt ${loggedTenant.apartment})`;

                _addToSyncQueue('addIncident', {
                    rawIncidentData,
                    incidentId,
                    userDisplay,
                    timestamp: Date.now()
                });

                const localIncident = {
                    id: incidentId,
                    entrance: String(rawIncidentData.entrance),
                    category: String(rawIncidentData.category),
                    description: Security.sanitizeHTML(String(rawIncidentData.description).trim()),
                    user_display: userDisplay,
                    photo_url: rawIncidentData.photo || null,
                    status: 'nouveau',
                    created_at: new Date().toISOString()
                };
                _incidents.unshift(localIncident);

                localStorage.setItem("leclerc_asc_cached_incidents", JSON.stringify(_incidents));
                window.dispatchEvent(new CustomEvent("storeUpdated"));
                return { id: incidentId };
            }

            _ensureSupabase();

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

        async updateIncidentStatus(incidentId, newStatus) {
            if (!Security.getLoggedInTenant()) {
                throw new Error("Accès refusé : Vous devez être connecté pour mettre à jour le statut d'un incident.");
            }

            if (!navigator.onLine) {
                _addToSyncQueue('updateIncidentStatus', { incidentId, newStatus });

                const incident = _incidents.find(i => String(i.id) === String(incidentId));
                if (incident) {
                    incident.status = String(newStatus);
                }

                localStorage.setItem("leclerc_asc_cached_incidents", JSON.stringify(_incidents));
                window.dispatchEvent(new CustomEvent("storeUpdated"));
                return true;
            }

            _ensureSupabase();

            const { error } = await supabase
                .from('incidents')
                .update({
                    status: String(newStatus)
                })
                .eq('id', String(incidentId));

            if (error) throw error;
            await _fetchAndAssembleState();
            return true;
        },

        async updateIncident(incidentId, fields) {
            if (!Security.getLoggedInTenant()) {
                throw new Error("Accès refusé : Vous devez être connecté pour modifier un incident.");
            }

            const allowedFields = {};
            if (fields.status !== undefined) allowedFields.status = String(fields.status);
            if (fields.description !== undefined) {
                allowedFields.description = Security.sanitizeHTML(String(fields.description).trim());
            }

            if (!navigator.onLine) {
                _addToSyncQueue('updateIncident', { incidentId, fields });

                const incident = _incidents.find(i => String(i.id) === String(incidentId));
                if (incident) {
                    if (fields.status !== undefined) incident.status = String(fields.status);
                    if (fields.description !== undefined) incident.description = allowedFields.description;
                }

                localStorage.setItem("leclerc_asc_cached_incidents", JSON.stringify(_incidents));
                window.dispatchEvent(new CustomEvent("storeUpdated"));
                return true;
            }

            _ensureSupabase();

            const { error } = await supabase
                .from('incidents')
                .update(allowedFields)
                .eq('id', String(incidentId));

            if (error) throw error;
            await _fetchAndAssembleState();
            return true;
        },

        async addMessage(rawMessageData) {
            const loggedTenant = Security.getLoggedInTenant();
            if (!loggedTenant) {
                throw new Error("Accès refusé : Vous devez être connecté pour publier un message.");
            }

            if (!navigator.onLine) {
                const messageId = "m_offline_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
                const author = `${loggedTenant.username} (Appt ${loggedTenant.apartment})`;

                _addToSyncQueue('addMessage', {
                    rawMessageData,
                    messageId,
                    author,
                    timestamp: Date.now()
                });

                const localMessage = {
                    id: messageId,
                    entrance: rawMessageData.entrance === 'tous' ? null : String(rawMessageData.entrance),
                    type: String(rawMessageData.type),
                    content: Security.sanitizeHTML(String(rawMessageData.content).trim()),
                    author: author,
                    created_at: new Date().toISOString()
                };
                _messages.unshift(localMessage);

                localStorage.setItem("leclerc_asc_cached_messages", JSON.stringify(_messages));
                window.dispatchEvent(new CustomEvent("storeUpdated"));
                return { id: messageId };
            }

            _ensureSupabase();

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
            if (!Security.getLoggedInTenant()) {
                throw new Error("Accès refusé : Vous devez être connecté pour mettre à jour le statut.");
            }

            if (!navigator.onLine) {
                const historyId = "h_offline_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
                const sanitizedNotes = technicalNotes ? Security.sanitizeHTML(String(technicalNotes).trim()) : "";

                _addToSyncQueue('updateStatus', {
                    entranceId,
                    newStatus,
                    technicalNotes,
                    historyId,
                    timestamp: Date.now()
                });

                const elevator = _elevators.find(e => String(e.id) === String(entranceId));
                if (elevator) {
                    elevator.status = newStatus;
                    elevator.lastStatusChange = Date.now();
                    elevator.maintenanceNotes = sanitizedNotes;

                    const statusLabels = {
                        "en_service": "Remise en service",
                        "en_maintenance": "Mise en maintenance",
                        "en_panne": "Signalement de panne / Arrêt"
                    };
                    const historyNote = sanitizedNotes ? `${statusLabels[newStatus]} : ${sanitizedNotes}` : `${statusLabels[newStatus]} (changement d'état sans détails supplémentaires).`;

                    const localHistory = {
                        id: historyId,
                        timestamp: Date.now(),
                        status: newStatus,
                        notes: historyNote
                    };
                    elevator.history = elevator.history || [];
                    elevator.history.unshift(localHistory);

                    if (newStatus === "en_service") {
                        elevator.tenantReports = [];
                    }
                }

                localStorage.setItem("leclerc_asc_cached_elevators", JSON.stringify(_elevators));
                window.dispatchEvent(new CustomEvent("storeUpdated"));
                return true;
            }

            _ensureSupabase();

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

        async registerTenant(username, password, entrance = "38", apartment = "") {
            _ensureSupabase();
            const normalizedUser = Security.sanitizeHTML(String(username).trim());
            const normalizedApartment = Security.sanitizeHTML(String(apartment).trim());

            // 1. Inscrire l'utilisateur dans Supabase Auth
            // On forme un e-mail factice basé sur le pseudo pour l'authentification
            const emailFake = `${normalizedUser.toLowerCase()}@collectifplaine.fr`;

            const { data, error: signUpError } = await supabase.auth.signUp({
                email: emailFake,
                password: password,
                options: {
                    data: {
                        entrance: String(entrance),
                        apartment: normalizedApartment
                    }
                }
            });

            if (signUpError) {
                if (signUpError.message.includes("already exists") || signUpError.message.includes("taken")) {
                    throw new Error("Ce pseudo est déjà utilisé par un autre résident.");
                }
                throw signUpError;
            }

            const authUser = data.user;
            if (!authUser) throw new Error("Erreur de création de compte résident.");

            // 2. Initialiser la session locale
            const tenant = {
                id: authUser.id,
                username: normalizedUser,
                entrance: String(entrance),
                apartment: normalizedApartment,
                first_name: "",
                last_name: "",
                notifications: false,
                phone: "",
                email: ""
            };
            Security.setTenantSession(tenant);
            return tenant;
        },

        async loginTenant(username, password) {
            _ensureSupabase();
            const normalizedUser = String(username).trim();
            const emailFake = `${normalizedUser.toLowerCase()}@collectifplaine.fr`;

            // 1. Connexion via Supabase Auth
            const { data, error: loginError } = await supabase.auth.signInWithPassword({
                email: emailFake,
                password: password
            });

            if (loginError) {
                throw new Error("Pseudo ou mot de passe incorrect.");
            }

            const authUser = data.user;
            if (!authUser) throw new Error("Utilisateur introuvable après connexion.");

            // 2. Charger les informations de profil complémentaires depuis la table residents
            const { data: dbResident, error: dbError } = await supabase
                .from('residents')
                .select('*')
                .eq('id', authUser.id)
                .maybeSingle();

            if (dbError) throw dbError;

            // Si pas encore de profil inséré par le trigger, on construit à partir des metadonnées
            const finalResident = dbResident || {
                id: authUser.id,
                username: normalizedUser,
                entrance: authUser.user_metadata?.entrance || "38",
                apartment: authUser.user_metadata?.apartment || "",
                first_name: "",
                last_name: "",
                notifications: false,
                phone: "",
                email: ""
            };

            let firstName = finalResident.first_name || "";
            let lastName = finalResident.last_name || "";
            let notifications = !!finalResident.notifications;
            let phone = finalResident.phone || "";
            let email = finalResident.email || "";

            // Charger depuis le localStorage individuellement si non présents en DB (pour compatibilité)
            try {
                const profileStr = localStorage.getItem(`leclerc_asc_tenant_profile_${normalizedUser}`);
                if (profileStr) {
                    const profile = JSON.parse(profileStr);
                    if (!firstName) firstName = profile.first_name || "";
                    if (!lastName) lastName = profile.last_name || "";
                    if (finalResident.notifications === undefined || finalResident.notifications === null) {
                        notifications = !!profile.notifications;
                    }
                    if (!phone) phone = profile.phone || "";
                    if (!email) email = profile.email || "";
                }
            } catch (e) {
                console.error("Erreur de lecture fallback localStorage", e);
            }

            const tenant = {
                id: finalResident.id || authUser.id,
                username: finalResident.username || normalizedUser,
                entrance: finalResident.entrance,
                apartment: finalResident.apartment,
                first_name: firstName,
                last_name: lastName,
                notifications: notifications,
                phone: phone,
                email: email
            };
            Security.setTenantSession(tenant);
            return tenant;
        },

        async updateTenantProfile(username, entrance, apartment, firstName = "", lastName = "", notifications = false, phone = "", email = "") {
            const normalizedUser = Security.sanitizeHTML(String(username).trim());
            const normalizedApartment = Security.sanitizeHTML(String(apartment).trim());
            const cleanFirstName = Security.sanitizeHTML(String(firstName).trim());
            const cleanLastName = Security.sanitizeHTML(String(lastName).trim());
            const cleanPhone = Security.sanitizeHTML(String(phone).trim());
            const cleanEmail = Security.sanitizeHTML(String(email).trim());

            if (!navigator.onLine) {
                _addToSyncQueue('updateTenantProfile', {
                    username,
                    entrance,
                    apartment,
                    firstName: cleanFirstName,
                    lastName: cleanLastName,
                    notifications,
                    phone: cleanPhone,
                    email: cleanEmail
                });

                const currentTenant = Security.getLoggedInTenant();
                if (currentTenant && currentTenant.username.toLowerCase() === normalizedUser.toLowerCase()) {
                    currentTenant.entrance = String(entrance);
                    currentTenant.apartment = normalizedApartment;
                    currentTenant.first_name = cleanFirstName;
                    currentTenant.last_name = cleanLastName;
                    currentTenant.notifications = Boolean(notifications);
                    currentTenant.phone = cleanPhone;
                    currentTenant.email = cleanEmail;
                    Security.setTenantSession(currentTenant);
                }

                localStorage.setItem(`leclerc_asc_tenant_profile_${username}`, JSON.stringify({
                    first_name: cleanFirstName,
                    last_name: cleanLastName,
                    notifications: Boolean(notifications),
                    phone: cleanPhone,
                    email: cleanEmail
                }));

                return { success: true, offline: true };
            }

            _ensureSupabase();

            let dbWarning = null;
            const tenantSession = Security.getLoggedInTenant();

            try {
                // Étape 1 : Essayer de tout sauvegarder en base (incluant téléphone et e-mail)
                const query = supabase.from('residents').update({
                    entrance: String(entrance),
                    apartment: normalizedApartment,
                    first_name: cleanFirstName,
                    last_name: cleanLastName,
                    notifications: Boolean(notifications),
                    phone: cleanPhone,
                    email: cleanEmail
                });

                if (tenantSession && tenantSession.id) {
                    query.eq('id', tenantSession.id);
                } else {
                    query.ilike('username', normalizedUser);
                }

                const { error } = await query;
                if (error) throw error;
            } catch (err) {
                console.warn("Échec de mise à jour des colonnes de contact. Tentative de repli sans téléphone/e-mail.", err);
                dbWarning = 'missing_columns';
                
                try {
                    // Étape 2 : Repli sans téléphone et e-mail (si ces colonnes n'existent pas encore en DB)
                    const fallbackQuery = supabase.from('residents').update({
                        entrance: String(entrance),
                        apartment: normalizedApartment,
                        first_name: cleanFirstName,
                        last_name: cleanLastName,
                        notifications: Boolean(notifications)
                    });

                    if (tenantSession && tenantSession.id) {
                        fallbackQuery.eq('id', tenantSession.id);
                    } else {
                        fallbackQuery.ilike('username', normalizedUser);
                    }

                    const { error: secondError } = await fallbackQuery;
                    if (secondError) throw secondError;
                } catch (fallbackErr) {
                    console.warn("Échec de mise à jour des colonnes de profil. Tentative de mise à jour restreinte d'origine.", fallbackErr);
                    
                    // Étape 3 : Repli restreint aux colonnes de base d'origine (entrée et appartement)
                    const basicQuery = supabase.from('residents').update({
                        entrance: String(entrance),
                        apartment: normalizedApartment
                    });

                    if (tenantSession && tenantSession.id) {
                        basicQuery.eq('id', tenantSession.id);
                    } else {
                        basicQuery.ilike('username', normalizedUser);
                    }

                    const { error: fallbackError } = await basicQuery;
                    if (fallbackError) throw fallbackError;
                }
            }

            // Mettre à jour la session locale
            const currentTenant = Security.getLoggedInTenant();
            if (currentTenant && currentTenant.username.toLowerCase() === normalizedUser.toLowerCase()) {
                currentTenant.entrance = String(entrance);
                currentTenant.apartment = normalizedApartment;
                currentTenant.first_name = cleanFirstName;
                currentTenant.last_name = cleanLastName;
                currentTenant.notifications = Boolean(notifications);
                currentTenant.phone = cleanPhone;
                currentTenant.email = cleanEmail;
                Security.setTenantSession(currentTenant);
            }
            return { success: true, warning: dbWarning };
        },

        async logoutTenant() {
            _ensureSupabase();
            try {
                await supabase.auth.signOut();
            } catch (err) {
                console.warn("Échec de déconnexion distante de Supabase Auth", err);
            }
            Security.logoutTenant();
            return true;
        },

        async deleteTenantAccount(username) {
            _ensureSupabase();
            const normalizedUser = String(username).trim();

            // 1. Essayer de supprimer l'utilisateur d'auth.users via RPC (cascade sur la table residents)
            try {
                await supabase.rpc('delete_user');
            } catch (err) {
                console.warn("Échec de suppression via RPC, tentative de suppression directe dans la table residents", err);
            }

            // 2. Supprimer directement de la table par sécurité / compatibilité
            const { error } = await supabase
                .from('residents')
                .delete()
                .ilike('username', normalizedUser);

            if (error) throw error;

            // 3. Nettoyer les données locales de profil et de session
            localStorage.removeItem(`leclerc_asc_tenant_profile_${normalizedUser}`);
            Security.logoutTenant();
            
            return true;
        },

        getPetitions() {
            return JSON.parse(JSON.stringify(_petitions));
        },

        getPolls() {
            return JSON.parse(JSON.stringify(_polls));
        },

        async createPetition(title, description) {
            const loggedTenant = Security.getLoggedInTenant();
            if (!loggedTenant || loggedTenant.username !== 'Tavares50') {
                throw new Error("Accès refusé : Seul l'administrateur peut effectuer cette action.");
            }

            _ensureSupabase();

            const { error } = await supabase
                .from('petitions')
                .insert({
                    title: Security.sanitizeHTML(String(title).trim()),
                    description: Security.sanitizeHTML(String(description).trim()),
                    created_by: loggedTenant.id
                });

            if (error) throw error;

            await _fetchAndAssembleState();
            return true;
        },

        async signPetition(petitionId) {
            const loggedTenant = Security.getLoggedInTenant();
            if (!loggedTenant) {
                throw new Error("Accès refusé : Vous devez être connecté pour signer une pétition.");
            }

            _ensureSupabase();

            const { error } = await supabase
                .from('petition_signatures')
                .insert({
                    petition_id: petitionId,
                    resident_id: loggedTenant.id
                });

            if (error) throw error;

            await _fetchAndAssembleState();
            return true;
        },

        async createPoll(title, description, type, options, endsAt) {
            const loggedTenant = Security.getLoggedInTenant();
            if (!loggedTenant || loggedTenant.username !== 'Tavares50') {
                throw new Error("Accès refusé : Seul l'administrateur peut effectuer cette action.");
            }

            _ensureSupabase();

            const { error } = await supabase
                .from('polls')
                .insert({
                    title: Security.sanitizeHTML(String(title).trim()),
                    description: Security.sanitizeHTML(String(description).trim()),
                    type: String(type),
                    options: options,
                    created_by: loggedTenant.id,
                    ends_at: new Date(endsAt).toISOString()
                });

            if (error) throw error;

            await _fetchAndAssembleState();
            return true;
        },

        async submitVote(pollId, optionIndex) {
            const loggedTenant = Security.getLoggedInTenant();
            if (!loggedTenant) {
                throw new Error("Accès refusé : Vous devez être connecté pour voter.");
            }

            _ensureSupabase();

            const { error } = await supabase
                .from('poll_votes')
                .insert({
                    poll_id: pollId,
                    resident_id: loggedTenant.id,
                    option_index: parseInt(optionIndex, 10)
                });

            if (error) throw error;

            await _fetchAndAssembleState();
            return true;
        }
    };
})();
