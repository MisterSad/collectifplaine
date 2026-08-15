/**
 * @fileoverview Service Métier : Gestion des pétitions collectives et des signatures citoyennes.
 */

import { getSupabase } from '../../core/db-client.js';
import { Storage } from '../../core/storage.js';
import { EventBus, EVENTS } from '../../core/event-bus.js';
import { Auth } from '../../core/auth.js';

class PetitionsService {
    constructor() {
        /** @type {Array<Object>} */
        this.petitions = [];
    }

    /**
     * Charge les pétitions actives.
     * @returns {Promise<Array<Object>>}
     */
    async loadAll() {
        const cached = await Storage.getCache('petitions_state');
        if (cached && Array.isArray(cached) && cached.length > 0) {
            this.petitions = cached;
            EventBus.emit(EVENTS.PETITIONS_UPDATED, this.petitions);
        }

        if (!navigator.onLine) return this.petitions;

        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('petitions')
                .select('*, petition_signatures(*, residents(username, entrance, first_name, last_name))')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.petitions = (data || []).map(p => ({
                ...p,
                signatures_count: p.petition_signatures?.length || 0,
                signatures: p.petition_signatures || []
            }));

            await Storage.setCache('petitions_state', this.petitions);
            EventBus.emit(EVENTS.PETITIONS_UPDATED, this.petitions);
            return this.petitions;
        } catch (e) {
            console.error("[PetitionsService] Erreur chargement pétitions:", e);
            return this.petitions;
        }
    }

    getAll() {
        return this.petitions;
    }

    /**
     * Crée une nouvelle pétition (Action réservée à l'administrateur).
     * @param {Object} data
     * @param {string} data.title
     * @param {string} data.description
     * @param {number} [data.targetSignatures=50]
     */
    async createPetition({ title, description, targetSignatures = 50 }) {
        if (!Auth.isAdmin()) {
            throw new Error("Action réservée aux administrateurs de l'amicale.");
        }

        const user = Auth.getUser();
        const supabase = getSupabase();

        const newPetition = {
            title: title.trim(),
            description: description.trim(),
            target_signatures: targetSignatures,
            status: 'active',
            created_by: user.id
        };

        const { data, error } = await supabase
            .from('petitions')
            .insert([newPetition])
            .select()
            .single();

        if (error) throw error;

        await this.loadAll();
        return data;
    }

    /**
     * Signe une pétition pour le résident connecté.
     * @param {string} petitionId
     */
    async signPetition(petitionId) {
        const user = Auth.getUser();
        if (!user) throw new Error("Vous devez être connecté pour signer cette pétition.");

        const supabase = getSupabase();
        const { error } = await supabase
            .from('petition_signatures')
            .insert([{
                petition_id: petitionId,
                resident_id: user.id
            }]);

        if (error) {
            if (error.code === '23505' || error.message.includes('unique')) {
                throw new Error("Vous avez déjà signé cette pétition.");
            }
            throw error;
        }

        await this.loadAll();
    }
}

export const Petitions = new PetitionsService();
