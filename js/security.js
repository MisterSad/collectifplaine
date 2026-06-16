/**
 * Suivi pannes ascenseurs - Module de Sécurité (Security by Design)
 * Gère l'assainissement XSS, la validation, le Rate Limiting, le RBAC et le hachage des mots de passe.
 */
const Security = (() => {
    // Clés de stockage sessionStorage / localStorage
    const TENANT_SESSION_KEY = "leclerc_asc_tenant_session";
    const RATE_LIMIT_KEY = "leclerc_asc_rate_limit";
    
    // Sel cryptographique fixe pour renforcer le hachage des mots de passe locataires
    const CRYPTO_SALT = "AmicaleLocatairesLeclercCachan2026_Salt$#@!";

    /**
     * Calcule le hash SHA-256 d'une chaîne de caractères via l'API Web Crypto native
     */
    async function _sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    return {
        /**
         * Assainit une chaîne pour empêcher les attaques XSS (Cross-Site Scripting)
         * Remplace les caractères HTML sensibles par leurs entités de sécurité
         */
        sanitizeHTML(str) {
            if (typeof str !== 'string') return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;');
        },

        /**
         * Calcule un hash sécurisé SHA-256 salé pour un mot de passe utilisateur
         * Utilise le pseudo de l'utilisateur comme sel dynamique secondaire,
         * ce qui garantit des hashes distincts pour deux mots de passe identiques.
         */
        async hashPassword(password, username) {
            if (!password || typeof password !== 'string') return '';
            const normalizedUser = String(username).toLowerCase().trim();
            // Combinaison : Mot de passe + Pseudo unique + Sel fixe
            const messageToHash = password + normalizedUser + CRYPTO_SALT;
            return await _sha256(messageToHash);
        },

        /**
         * Valide strictement les données du formulaire de signalement
         */
        validateReportInput(data) {
            const errors = [];
            
            // Validation de l'entrée (doit être un numéro d'entrée valide de la configuration)
            const entranceNum = parseInt(data.entrance, 10);
            const validEntrances = (typeof CONFIG !== 'undefined' && CONFIG.entrances)
                ? CONFIG.entrances.map(e => parseInt(e.id, 10))
                : [36, 38, 40, 42, 44, 46, 48, 50, 52]; // Repli de sécurité robuste
            if (!validEntrances.includes(entranceNum)) {
                errors.push("Le numéro d'entrée est invalide.");
            }

            // Validation du type de panne
            const validTypes = ['arrêt', 'portes', 'boutons', 'bruit', 'autre'];
            if (!validTypes.includes(data.type)) {
                errors.push("Le type de problème est invalide.");
            }

            // Validation de la description
            if (!data.description || typeof data.description !== 'string') {
                errors.push("La description du problème est obligatoire.");
            } else {
                const descLen = data.description.trim().length;
                if (descLen < 10) {
                    errors.push("La description doit faire au moins 10 caractères.");
                }
                if (descLen > 250) {
                    errors.push("La description ne doit pas dépasser 250 caractères.");
                }
            }

            // Validation de l'auteur (Pseudo obligatoire et pré-rempli)
            if (!data.user || typeof data.user !== 'string' || data.user.trim().length === 0) {
                errors.push("L'auteur du signalement est obligatoire.");
            } else {
                if (data.user.trim().length > 20) {
                    errors.push("Le pseudonyme ne doit pas dépasser 20 caractères.");
                }
                data.user = data.user.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
            }

            return {
                isValid: errors.length === 0,
                errors: errors
            };
        },

        /**
         * Valide les données de création de compte locataire
         */
        validateRegisterInput(data) {
            const errors = [];
            
            // Pseudo : lettres, chiffres, tirets, de 3 à 15 caractères
            const userRegex = /^[a-zA-Z0-9_-]{3,15}$/;
            if (!data.username || !userRegex.test(data.username)) {
                errors.push("Le pseudo doit faire entre 3 et 15 caractères et ne contenir que des lettres, chiffres, tirets ou underscores.");
            }

            // Mot de passe (min 8 caractères, au moins une lettre et un chiffre)
            if (!data.password || typeof data.password !== 'string') {
                errors.push("Le mot de passe est obligatoire.");
            } else {
                if (data.password.length < 8) {
                    errors.push("Le mot de passe doit faire au moins 8 caractères.");
                }
                const hasLetter = /[a-zA-Z]/.test(data.password);
                const hasNumber = /[0-9]/.test(data.password);
                if (!hasLetter || !hasNumber) {
                    errors.push("Le mot de passe doit contenir au moins une lettre et un chiffre.");
                }
            }

            return {
                isValid: errors.length === 0,
                errors: errors
            };
        },

        /**
         * Valide un fichier image chargé côté client (Sécurité Taille & Type)
         */
        validateImageFile(file) {
            if (!file) {
                return { isValid: true, error: null }; // Optionnel, donc valide si vide
            }
            
            // Validation du type MIME
            if (!file.type.startsWith("image/")) {
                return { isValid: false, error: "Le fichier sélectionné doit être une image (JPEG, PNG, WEBP, etc.)." };
            }
            
            // Validation de la taille (max 3 Mo)
            const maxSize = 3 * 1024 * 1024;
            if (file.size > maxSize) {
                return { isValid: false, error: "L'image sélectionnée est trop volumineuse (maximum 3 Mo autorisés)." };
            }
            
            return { isValid: true, error: null };
        },

        /**
         * Implémentation locale d'un Rate Limiter via un algorithme de Token Bucket
         */
        checkRateLimit() {
            const now = Date.now();
            const limitPeriod = 60 * 1000;
            const maxTokens = 3;
            const fillRate = limitPeriod / maxTokens;
            
            let bucketState = {
                tokens: maxTokens,
                lastUpdate: now
            };

            try {
                const saved = localStorage.getItem(RATE_LIMIT_KEY);
                if (saved) {
                    bucketState = JSON.parse(saved);
                }
            } catch (e) {
                console.error("Erreur de lecture du Rate Limiter", e);
            }

            const elapsed = now - bucketState.lastUpdate;
            const reloadedTokens = Math.floor(elapsed / fillRate);
            
            if (reloadedTokens > 0) {
                bucketState.tokens = Math.min(maxTokens, bucketState.tokens + reloadedTokens);
                bucketState.lastUpdate = now - (elapsed % fillRate);
            }

            if (bucketState.tokens <= 0) {
                const nextTokenTime = Math.ceil((fillRate - (now - bucketState.lastUpdate)) / 1000);
                return {
                    limited: true,
                    secondsToWait: Math.max(1, nextTokenTime)
                };
            }

            bucketState.tokens -= 1;
            bucketState.lastUpdate = now;
            
            try {
                localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(bucketState));
            } catch (e) {
                console.error("Erreur d'écriture du Rate Limiter", e);
            }

            return {
                limited: false,
                secondsToWait: 0
            };
        },



        // ---------------------------------------------------------
        // SECURE SESSION MANAGEMENT : LOCATAIRES (TENANTS)
        // ---------------------------------------------------------

        /**
         * Initialise la session du locataire en localStorage (persistant)
         */
        setTenantSession(tenant) {
            const sessionData = {
                username: tenant.username,
                entrance: tenant.entrance,
                apartment: tenant.apartment,
                first_name: tenant.first_name || "",
                last_name: tenant.last_name || "",
                notifications: !!tenant.notifications,
                phone: tenant.phone || "",
                email: tenant.email || "",
                loggedInAt: Date.now()
            };
            localStorage.setItem(TENANT_SESSION_KEY, JSON.stringify(sessionData));
        },

        /**
         * Récupère les données du locataire connecté ou null si hors ligne
         */
        getLoggedInTenant() {
            try {
                const session = localStorage.getItem(TENANT_SESSION_KEY);
                return session ? JSON.parse(session) : null;
            } catch (e) {
                console.error("Erreur de lecture de la session locataire", e);
                return null;
            }
        },

        /**
         * Déconnecte le locataire actif
         */
        logoutTenant() {
            localStorage.removeItem(TENANT_SESSION_KEY);
        }
    };
})();
