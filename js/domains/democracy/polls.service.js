/**
 * @fileoverview Service Métier : Gestion des sondages et scrutins démocratiques de la résidence.
 */

import { getSupabase } from '../../core/db-client.js';
import { Storage } from '../../core/storage.js';
import { EventBus, EVENTS } from '../../core/event-bus.js';
import { Auth } from '../../core/auth.js';

class PollsService {
    constructor() {
        /** @type {Array<Object>} */
        this.polls = [];
    }

    /**
     * Charge les scrutins et sondages.
     * @returns {Promise<Array<Object>>}
     */
    async loadAll() {
        const cached = await Storage.getCache('polls_state');
        if (cached && Array.isArray(cached) && cached.length > 0) {
            this.polls = cached;
            EventBus.emit(EVENTS.POLLS_UPDATED, this.polls);
        }

        if (!navigator.onLine) return this.polls;

        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('polls')
                .select('*, poll_votes(*)')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.polls = (data || []).map(p => {
                const votes = p.poll_votes || [];
                const totalVotes = votes.length;

                // Calcul des votes par option
                const optionsStats = {};
                let optionsArr = [];
                try {
                    optionsArr = typeof p.options === 'string' ? JSON.parse(p.options) : p.options;
                } catch (e) {
                    optionsArr = Array.isArray(p.options) ? p.options : ['Oui', 'Non'];
                }

                optionsArr.forEach(opt => {
                    const count = votes.filter(v => v.selected_option === opt).length;
                    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    optionsStats[opt] = { count, percent };
                });

                return {
                    ...p,
                    options: optionsArr,
                    total_votes: totalVotes,
                    votes_stats: optionsStats,
                    votes: votes
                };
            });

            await Storage.setCache('polls_state', this.polls);
            EventBus.emit(EVENTS.POLLS_UPDATED, this.polls);
            return this.polls;
        } catch (e) {
            console.error("[PollsService] Erreur chargement scrutins:", e);
            return this.polls;
        }
    }

    getAll() {
        return this.polls;
    }

    /**
     * Crée un nouveau scrutin ou sondage (Action réservée admin).
     * @param {Object} data
     * @param {string} data.title
     * @param {string} data.description
     * @param {string[]} data.options
     * @param {string} [data.type="sondage"]
     * @param {string} [data.endsAt]
     */
    async createPoll({ title, description, options, type = "sondage", endsAt = null }) {
        if (!Auth.isAdmin()) {
            throw new Error("Action réservée aux administrateurs de l'amicale.");
        }

        const user = Auth.getUser();
        const supabase = getSupabase();

        const newPoll = {
            title: title.trim(),
            description: description.trim(),
            poll_type: type,
            options: options,
            status: 'active',
            ends_at: endsAt,
            created_by: user.id
        };

        const { data, error } = await supabase
            .from('polls')
            .insert([newPoll])
            .select()
            .single();

        if (error) throw error;

        await this.loadAll();
        return data;
    }

    /**
     * Enregistre le vote d'un résident pour une option donnée.
     * @param {string} pollId
     * @param {string} selectedOption
     */
    async vote(pollId, selectedOption) {
        const user = Auth.getUser();
        if (!user) throw new Error("Vous devez être connecté pour voter.");

        const supabase = getSupabase();
        const { error } = await supabase
            .from('poll_votes')
            .insert([{
                poll_id: pollId,
                resident_id: user.id,
                selected_option: selectedOption
            }]);

        if (error) {
            if (error.code === '23505' || error.message.includes('unique')) {
                throw new Error("Vous avez déjà voté pour ce scrutin.");
            }
            throw error;
        }

        await this.loadAll();
    }
}

export const Polls = new PollsService();
