/**
 * @fileoverview Service Métier : Gestion du registre des incidents et dysfonctionnements collectifs.
 */

import { getSupabase } from '../../core/db-client.js';
import { Storage } from '../../core/storage.js';
import { EventBus, EVENTS } from '../../core/event-bus.js';
import { Auth } from '../../core/auth.js';
import { CONFIG } from '../../config/config.js';

class IncidentService {
    constructor() {
        /** @type {Array<Object>} */
        this.incidents = [];
        this.realtimeChannel = null;
    }

    /**
     * Charge les incidents récents depuis le cache ou la base de données.
     * @returns {Promise<Array<Object>>}
     */
    async loadAll() {
        const cached = await Storage.getCache('incidents_state');
        if (cached && Array.isArray(cached) && cached.length > 0) {
            this.incidents = cached;
            EventBus.emit(EVENTS.INCIDENTS_UPDATED, this.incidents);
        }

        if (!navigator.onLine) {
            return this.incidents;
        }

        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('incidents')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            this.incidents = data || [];
            await Storage.setCache('incidents_state', this.incidents);
            EventBus.emit(EVENTS.INCIDENTS_UPDATED, this.incidents);

            this._setupRealtime();
            return this.incidents;
        } catch (e) {
            console.error("[IncidentService] Erreur chargement incidents:", e);
            return this.incidents;
        }
    }

    /**
     * Retourne la liste des incidents en mémoire.
     * @returns {Array<Object>}
     */
    getAll() {
        return this.incidents;
    }

    /**
     * Crée un nouvel incident.
     * @param {Object} data
     * @param {string} data.category
     * @param {string} data.entrance
     * @param {string} data.description
     * @param {Blob|null} [data.photoBlob]
     * @returns {Promise<Object>}
     */
    async createIncident({ category, entrance, description, photoBlob = null }) {
        const incidentId = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const user = Auth.getUser();
        const profile = Auth.getProfile();
        const authorName = profile?.username || "Résident";

        let photoUrl = null;

        if (photoBlob && navigator.onLine) {
            try {
                const supabase = getSupabase();
                const fileName = `incidents/${incidentId}.jpg`;
                const { error: uploadErr } = await supabase.storage
                    .from(CONFIG.storageBucket)
                    .upload(fileName, photoBlob, { contentType: 'image/jpeg', upsert: true });

                if (!uploadErr) {
                    const { data: publicData } = supabase.storage
                        .from(CONFIG.storageBucket)
                        .getPublicUrl(fileName);
                    photoUrl = publicData?.publicUrl || null;
                }
            } catch (err) {
                console.warn("[IncidentService] Échec upload photo:", err);
            }
        }

        const newIncident = {
            id: incidentId,
            category: category,
            entrance: entrance || "tous",
            description: description,
            photo_url: photoUrl,
            status: "nouveau",
            user: authorName,
            created_by: user?.id || null,
            created_at: new Date().toISOString()
        };

        if (!navigator.onLine) {
            await Storage.addToSyncQueue({
                action: 'CREATE_INCIDENT',
                payload: newIncident,
                hasPhoto: !!photoBlob
            });
            this.incidents.unshift(newIncident);
            EventBus.emit(EVENTS.INCIDENTS_UPDATED, this.incidents);
            return newIncident;
        }

        const supabase = getSupabase();
        const { error: insertErr } = await supabase.from('incidents').insert([newIncident]);
        if (insertErr) throw insertErr;

        this.incidents.unshift(newIncident);
        await Storage.setCache('incidents_state', this.incidents);
        EventBus.emit(EVENTS.INCIDENTS_UPDATED, this.incidents);

        return newIncident;
    }

    /**
     * Met à jour le statut d'un incident existant.
     * @param {string} incidentId
     * @param {'nouveau'|'en_cours'|'resolu'} newStatus
     * @param {string} notes
     */
    async updateStatus(incidentId, newStatus, notes) {
        if (!navigator.onLine) {
            await Storage.addToSyncQueue({
                action: 'UPDATE_INCIDENT_STATUS',
                payload: { id: incidentId, status: newStatus, notes }
            });
        } else {
            const supabase = getSupabase();
            const { error } = await supabase
                .from('incidents')
                .update({
                    status: newStatus,
                    description: notes ? notes : undefined
                })
                .eq('id', incidentId);

            if (error) throw error;
        }

        const item = this.incidents.find(i => i.id === incidentId);
        if (item) {
            item.status = newStatus;
            if (notes) item.description = notes;
            EventBus.emit(EVENTS.INCIDENTS_UPDATED, this.incidents);
        }
    }

    _setupRealtime() {
        if (this.realtimeChannel || !navigator.onLine) return;

        try {
            const supabase = getSupabase();
            this.realtimeChannel = supabase.channel('realtime:incidents')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, (payload) => {
                    if (payload.eventType === 'INSERT') {
                        if (!this.incidents.some(i => i.id === payload.new.id)) {
                            this.incidents.unshift(payload.new);
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const index = this.incidents.findIndex(i => i.id === payload.new.id);
                        if (index !== -1) {
                            this.incidents[index] = payload.new;
                        }
                    } else if (payload.eventType === 'DELETE') {
                        this.incidents = this.incidents.filter(i => i.id !== payload.old.id);
                    }
                    EventBus.emit(EVENTS.INCIDENTS_UPDATED, this.incidents);
                })
                .subscribe();
        } catch (e) {
            console.warn("[IncidentService] Erreur realtime:", e);
        }
    }
}

export const Incident = new IncidentService();
