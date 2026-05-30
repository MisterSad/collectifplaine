/**
 * Suivi pannes ascenseurs - Magasin de Données (Store)
 * Gère la persistance locale sécurisée, les opérations CRUD, les comptes utilisateurs et l'application des contrôles d'accès.
 */
const Store = (() => {
    const ELEVATOR_STORAGE_KEY = "leclerc_asc_data_v1";
    const USER_STORAGE_KEY = "leclerc_asc_users_v1";

    // Variables d'état interne
    let _elevators = [];
    let _users = [];

    /**
     * Charge les données depuis le localStorage ou initialise avec le jeu de données mock
     */
    function _loadState() {
        // 1. Charger les ascenseurs
        try {
            const data = localStorage.getItem(ELEVATOR_STORAGE_KEY);
            if (data) {
                _elevators = JSON.parse(data);
            } else {
                _elevators = [...INITIAL_ELEVATOR_DATA];
                _saveElevatorsState();
            }
        } catch (e) {
            console.error("Erreur d'accès au localStorage (ascenseurs), chargement par défaut", e);
            _elevators = [...INITIAL_ELEVATOR_DATA];
        }

        // 2. Charger les utilisateurs (comptes locataires)
        try {
            const usersData = localStorage.getItem(USER_STORAGE_KEY);
            if (usersData) {
                _users = JSON.parse(usersData);
            } else {
                // Comptes de test pré-configurés (Mot de passe : voisin123)
                _users = [
                    {
                        username: "Marc40",
                        entrance: "40",
                        apartment: "12",
                        passwordHash: "bb14a0eae2e70754e08ce2f42aefe3ca7ec5f2f36afa23b8ee9f20a927ccd3ff"
                    },
                    {
                        username: "Sarah48",
                        entrance: "48",
                        apartment: "4B",
                        passwordHash: "37d93c1adfa447d633445724cd3a21dbd8a0d9b4641adce52fc2bda0e16cee70"
                    }
                ];
                _saveUsersState();
            }
        } catch (e) {
            console.error("Erreur d'accès au localStorage (utilisateurs), chargement par défaut", e);
            _users = [];
        }
    }

    /**
     * Sauvegarde l'état actuel des ascenseurs dans le localStorage
     */
    function _saveElevatorsState() {
        try {
            localStorage.setItem(ELEVATOR_STORAGE_KEY, JSON.stringify(_elevators));
            window.dispatchEvent(new CustomEvent("storeUpdated"));
        } catch (e) {
            console.error("Impossible de sauvegarder l'état des ascenseurs", e);
        }
    }

    /**
     * Sauvegarde l'état actuel des utilisateurs dans le localStorage
     */
    function _saveUsersState() {
        try {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(_users));
            window.dispatchEvent(new CustomEvent("usersUpdated"));
        } catch (e) {
            console.error("Impossible de sauvegarder l'état des utilisateurs", e);
        }
    }

    // Initialisation immédiate au chargement du script
    _loadState();

    return {
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
         * Ajoute un signalement locataire pour un ascenseur spécifique
         * (Action réservée aux locataires connectés - Security by Design)
         */
        addReport(entranceId, rawReportData) {
            // 1. Contrôle d'Accès : Exiger qu'un locataire soit connecté
            const loggedTenant = Security.getLoggedInTenant();
            if (!loggedTenant) {
                throw new Error("Accès refusé : Vous devez créer un compte locataire et être connecté pour signaler un incident.");
            }

            // 2. Assainir et préparer les données
            const reportData = {
                entrance: String(entranceId),
                type: String(rawReportData.type),
                description: Security.sanitizeHTML(String(rawReportData.description).trim()),
                // Liaison forte avec le pseudo unique de la session active + appartement
                user: `${loggedTenant.username} (Appt ${loggedTenant.apartment})`,
                photo: rawReportData.photo || null
            };

            // 3. Valider strictement les données au niveau du Store
            const validation = Security.validateReportInput(reportData);
            if (!validation.isValid) {
                throw new Error("Validation échouée : " + validation.errors.join(" | "));
            }

            // 4. Trouver l'ascenseur
            const elevatorIndex = _elevators.findIndex(e => e.id === reportData.entrance);
            if (elevatorIndex === -1) {
                throw new Error("Entrée introuvable.");
            }

            // 5. Créer le signalement
            const newReport = {
                id: "r_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now(),
                timestamp: Date.now(),
                type: reportData.type,
                description: reportData.description,
                user: reportData.user,
                photo: reportData.photo
            };

            // Squelette & Trace pour la future migration Supabase Storage
            if (reportData.photo) {
                console.group("🚀 [Supabase Migration] Préparation upload photo de panne");
                console.log("Étape 1: Création du chemin d'accès unique sécurisé...");
                const fileExt = "jpg"; // Compilée sous format JPEG compressé par canvas
                const filePath = `reports/${reportData.entrance}/${newReport.id}.${fileExt}`;
                console.log(`Chemin généré : "${filePath}"`);
                
                console.log("Étape 2: Simulation de l'appel API Supabase Storage...");
                console.log(`Code futur :
  // Convertir le base64 en Blob si nécessaire
  const response = await fetch(photoBase64);
  const blob = await response.blob();
  
  // Téléverser dans Supabase Storage
  const { data, error } = await supabase.storage
    .from('elevator-photos')
    .upload('${filePath}', blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false
    });
  if (error) throw error;
  
  // Obtenir l'URL publique
  const { publicUrl } = supabase.storage.from('elevator-photos').getPublicUrl('${filePath}').data;`);
                
                console.log("Étape 3: Succès simulé. Actuellement stocké en local (Base64 compressé dans localStorage).");
                console.groupEnd();
            }

            // 6. Mettre à jour l'état
            _elevators[elevatorIndex].tenantReports.unshift(newReport);
            
            _saveElevatorsState();
            return newReport;
        },

        /**
         * Supprime un signalement locataire (Action réservée à l'administrateur)
         */
        deleteReport(entranceId, reportId) {
            if (!Security.isAdminLoggedIn()) {
                throw new Error("Accès refusé : Connexion administrateur requise.");
            }

            const elevatorIndex = _elevators.findIndex(e => e.id === String(entranceId));
            if (elevatorIndex === -1) {
                throw new Error("Entrée introuvable.");
            }

            const reports = _elevators[elevatorIndex].tenantReports;
            const reportIndex = reports.findIndex(r => r.id === String(reportId));
            
            if (reportIndex === -1) {
                throw new Error("Signalement introuvable.");
            }

            reports.splice(reportIndex, 1);
            
            _saveElevatorsState();
            return true;
        },

        /**
         * Met à jour le statut et les notes d'un ascenseur (Action réservée à l'administrateur)
         */
        updateStatus(entranceId, newStatus, technicalNotes) {
            if (!Security.isAdminLoggedIn()) {
                throw new Error("Accès refusé : Connexion administrateur requise.");
            }

            const elevatorIndex = _elevators.findIndex(e => e.id === String(entranceId));
            if (elevatorIndex === -1) {
                throw new Error("Entrée introuvable.");
            }

            const allowedStatuses = ["en_service", "en_maintenance", "en_panne"];
            if (!allowedStatuses.includes(newStatus)) {
                throw new Error("Statut invalide.");
            }

            const sanitizedNotes = technicalNotes ? Security.sanitizeHTML(String(technicalNotes).trim()) : "";

            const elevator = _elevators[elevatorIndex];
            elevator.status = newStatus;
            elevator.lastStatusChange = Date.now();
            elevator.maintenanceNotes = sanitizedNotes;

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

            elevator.history.unshift({
                id: "h_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now(),
                timestamp: Date.now(),
                status: newStatus,
                notes: historyNote
            });

            if (newStatus === "en_service") {
                elevator.tenantReports = [];
            }

            _saveElevatorsState();
            return true;
        },

        /**
         * Récupère les statistiques de fonctionnement globales
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
        // GESTION DES UTILISATEURS (COMPTES LOCATAIRES)
        // ---------------------------------------------------------

        /**
         * Inscrit un nouveau locataire dans la base locale (localStorage)
         */
        async registerTenant(username, password, entrance, apartment) {
            const normalizedUser = Security.sanitizeHTML(String(username).trim());
            const normalizedApartment = Security.sanitizeHTML(String(apartment).trim());
            
            const registerData = {
                username: normalizedUser,
                password,
                entrance: String(entrance),
                apartment: normalizedApartment
            };

            // 1. Validation de schéma stricte
            const validation = Security.validateRegisterInput(registerData);
            if (!validation.isValid) {
                throw new Error("Validation échouée : " + validation.errors.join(" | "));
            }

            // 2. Vérification de l'unicité (insensible à la casse)
            const exists = _users.some(u => u.username.toLowerCase() === normalizedUser.toLowerCase());
            if (exists) {
                throw new Error("Ce pseudo est déjà utilisé par un autre résident.");
            }

            // 3. Hachage sécurisé du mot de passe
            const passwordHash = await Security.hashPassword(password, normalizedUser);

            // 4. Stockage
            const newUser = {
                username: normalizedUser,
                entrance: registerData.entrance,
                apartment: normalizedApartment,
                passwordHash: passwordHash
            };

            _users.push(newUser);
            _saveUsersState();

            // 5. Création automatique de session active
            Security.setTenantSession(newUser);
            return newUser;
        },

        /**
         * Authentifie un locataire existant et active sa session
         */
        async loginTenant(username, password) {
            const normalizedUser = String(username).trim();
            
            if (!normalizedUser || !password) {
                throw new Error("Veuillez saisir votre pseudo et votre mot de passe.");
            }

            // 1. Trouver l'utilisateur (insensible à la casse)
            const user = _users.find(u => u.username.toLowerCase() === normalizedUser.toLowerCase());
            if (!user) {
                throw new Error("Pseudo ou mot de passe incorrect.");
            }

            // 2. Calculer le hash du mot de passe fourni
            const calculatedHash = await Security.hashPassword(password, user.username);

            // 3. Comparer les hashes
            if (calculatedHash !== user.passwordHash) {
                throw new Error("Pseudo ou mot de passe incorrect.");
            }

            // 4. Initialiser la session
            Security.setTenantSession(user);
            return user;
        }
    };
})();
