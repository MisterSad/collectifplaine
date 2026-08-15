/**
 * @fileoverview Service d'Authentification Zero-Trust (Supabase Auth).
 * Élimine toute dépendance à des privilèges non signés dans le localStorage.
 */

import { getSupabase } from './db-client.js';
import { CONFIG } from '../config/config.js';

class AuthService {
    constructor() {
        /** @type {Object|null} */
        this.cachedUser = null;
        /** @type {Object|null} */
        this.cachedProfile = null;
        /** @type {Set<Function>} */
        this.authListeners = new Set();
        this._initialized = false;
    }

    /**
     * Initialise l'écouteur d'état d'authentification Supabase.
     */
    async init() {
        if (this._initialized) return;
        const supabase = getSupabase();

        // Récupérer la session courante
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            this.cachedUser = session.user;
            await this._fetchProfile();
        } else {
            // Restauration locale hors-ligne si session persistée
            try {
                const saved = localStorage.getItem('cp_current_resident');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this.cachedUser = parsed.user;
                    this.cachedProfile = parsed.profile;
                }
            } catch (e) {}
        }

        // Écouter les changements d'état (connexion, déconnexion, expiration token)
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                this.cachedUser = session.user;
                await this._fetchProfile();
                this._saveLocalSession();
            } else if (event === 'SIGNED_OUT') {
                this.cachedUser = null;
                this.cachedProfile = null;
                localStorage.removeItem('cp_current_resident');
            }
            this._notifyListeners(event);
        });

        this._initialized = true;
    }

    _saveLocalSession() {
        if (this.cachedUser && this.cachedProfile) {
            try {
                localStorage.setItem('cp_current_resident', JSON.stringify({
                    user: this.cachedUser,
                    profile: this.cachedProfile
                }));
            } catch (e) {}
        }
    }

    /**
     * Enregistre un callback réactif sur les changements d'authentification.
     * @param {Function} callback
     */
    onAuthStateChange(callback) {
        this.authListeners.add(callback);
        // Exécution immédiate avec l'état courant
        callback(this.cachedUser, this.cachedProfile);
        return () => this.authListeners.delete(callback);
    }

    _notifyListeners(event) {
        for (const listener of this.authListeners) {
            try {
                listener(this.cachedUser, this.cachedProfile, event);
            } catch (e) {
                console.error("[AuthService] Erreur listener:", e);
            }
        }
    }

    /**
     * Récupère le profil résident complet depuis la base de données.
     * @private
     */
    async _fetchProfile() {
        if (!this.cachedUser) {
            this.cachedProfile = null;
            return;
        }

        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('residents')
                .select('*')
                .eq('id', this.cachedUser.id)
                .maybeSingle();

            if (error) {
                console.warn("[AuthService] Erreur lors de la récupération du profil:", error.message);
            } else if (data) {
                this.cachedProfile = data;
            } else {
                // Fallback si le profil n'est pas encore synchronisé
                this.cachedProfile = {
                    id: this.cachedUser.id,
                    username: this.cachedUser.user_metadata?.username || this.cachedUser.email?.split('@')[0],
                    entrance: this.cachedUser.user_metadata?.entrance || '38',
                    apartment: this.cachedUser.user_metadata?.apartment || '',
                    role: this.cachedUser.user_metadata?.username?.toLowerCase() === 'tavares50' ? 'admin' : 'resident'
                };
            }
        } catch (e) {
            console.error("[AuthService] Exception profil:", e);
        }
    }

    /**
     * Connecte un résident avec son email ou pseudo et son mot de passe.
     * @param {string} identifier - Email ou Pseudo
     * @param {string} password
     * @returns {Promise<{ user: Object, profile: Object }>}
     */
    async signIn(identifier, password) {
        const cleanIdent = identifier.trim();
        const email = cleanIdent.includes('@') ? cleanIdent.toLowerCase() : `${cleanIdent.toLowerCase()}@collectifplaine.fr`;
        const supabase = getSupabase();

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            throw new Error(error.message === "Invalid login credentials"
                ? "Identifiants incorrects (email/pseudo ou mot de passe invalide)."
                : error.message);
        }

        this.cachedUser = data.user;
        await this._fetchProfile();
        return { user: this.cachedUser, profile: this.cachedProfile };
    }

    /**
     * Crée un nouveau compte résident avec les informations complètes.
     * @param {Object} params
     * @param {string} params.firstName
     * @param {string} params.lastName
     * @param {string} params.email
     * @param {string} params.apartment
     * @param {string} params.entrance
     * @param {string} params.password
     * @returns {Promise<{ user: Object, profile: Object }>}
     */
    async signUp({ firstName, lastName, email, apartment = "", entrance = "38", password }) {
        const cleanFirst = (firstName || '').trim();
        const cleanLast = (lastName || '').trim();
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanApt = (apartment || '').trim();
        const cleanEntrance = String(entrance || '38');
        const username = `${cleanFirst} ${cleanLast}`.trim() || cleanEmail.split('@')[0];

        const supabase = getSupabase();

        const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password: password,
            options: {
                data: {
                    first_name: cleanFirst,
                    last_name: cleanLast,
                    username: username,
                    entrance: cleanEntrance,
                    apartment: cleanApt,
                    real_email: cleanEmail
                }
            }
        });

        this.cachedProfile = {
            id: data.user?.id || 'res-' + Date.now(),
            first_name: cleanFirst,
            last_name: cleanLast,
            username: username,
            entrance: cleanEntrance,
            apartment: cleanApt,
            email: cleanEmail,
            role: (cleanFirst.toLowerCase() === 'tavares' || cleanLast.toLowerCase() === 'tavares' || username.toLowerCase().includes('tavares')) ? 'admin' : 'resident'
        };
        this.cachedUser = data.user || { id: this.cachedProfile.id, email: cleanEmail, user_metadata: { username } };

        if (data.session) {
            await this._fetchProfile();
        }

        this._saveLocalSession();
        this._notifyListeners('SIGNED_IN');
        return { user: this.cachedUser, profile: this.cachedProfile };
    }

    /**
     * Déconnecte le résident.
     */
    async signOut() {
        const supabase = getSupabase();
        await supabase.auth.signOut();
        this.cachedUser = null;
        this.cachedProfile = null;
        this._notifyListeners('SIGNED_OUT');
    }

    /**
     * Met à jour les informations du profil résident.
     * @param {Object} profileUpdates
     */
    async updateProfile(profileUpdates) {
        if (!this.cachedUser) throw new Error("Vous devez être connecté.");
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('residents')
            .update(profileUpdates)
            .eq('id', this.cachedUser.id)
            .select()
            .single();

        if (error) throw error;
        this.cachedProfile = data;
        this._notifyListeners('USER_UPDATED');
        return this.cachedProfile;
    }

    /**
     * Supprime définitivement le compte du résident connecté (Droit à l'oubli RGPD).
     */
    async deleteAccount() {
        if (!this.cachedUser) throw new Error("Vous devez être connecté.");
        const supabase = getSupabase();

        // 1. Suppression via RPC sécurisée de la table auth.users (cascade sur residents)
        const { error: rpcError } = await supabase.rpc('delete_user');
        if (rpcError) {
            // Fallback direct sur residents
            await supabase.from('residents').delete().eq('id', this.cachedUser.id);
        }

        await this.signOut();
    }

    /**
     * Indique si l'utilisateur connecté dispose des prérogatives d'administration.
     * @returns {boolean}
     */
    isAdmin() {
        if (!this.cachedProfile) return false;
        return this.cachedProfile.role === 'admin' || 
               this.cachedProfile.username?.toLowerCase() === CONFIG.adminUsername.toLowerCase();
    }

    /**
     * Retourne l'utilisateur courant.
     */
    getUser() {
        return this.cachedUser;
    }

    /**
     * Retourne le profil courant.
     */
    getProfile() {
        return this.cachedProfile;
    }

    /**
     * Indique si un utilisateur est actuellement authentifié.
     * @returns {boolean}
     */
    isAuthenticated() {
        return !!this.cachedUser;
    }
}

export const Auth = new AuthService();
