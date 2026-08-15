/**
 * @fileoverview Service Métier : Gestion des ascenseurs, pannes et calculs de disponibilité.
 * Élimine le requêtage en cascade et calcule le temps d'arrêt réel à la minute près.
 */

import { getSupabase } from '../../core/db-client.js';
import { Storage } from '../../core/storage.js';
import { EventBus, EVENTS } from '../../core/event-bus.js';
import { Auth } from '../../core/auth.js';
import { CONFIG } from '../../config/config.js';
import { getInitialElevatorsMock } from '../../config/mockData.js';

class ElevatorService {
    constructor() {
        /** @type {Map<string, Object>} */
        this.elevators = new Map();
        this.realtimeChannel = null;
    }

    /**
     * Initialise et charge les ascenseurs.
     * @returns {Promise<Array<Object>>}
     */
    async loadAll() {
        const validIds = new Set(CONFIG.entrances.map(e => String(e.id)));

        // 1. Tenter de charger le cache local pour un rendu instantané
        const cached = await Storage.getCache('elevators_state');
        if (cached && Array.isArray(cached) && cached.length > 0) {
            const validCached = cached.filter(el => validIds.has(String(el.id)));
            if (validCached.length > 0) {
                this.elevators.clear();
                validCached.forEach(el => this.elevators.set(String(el.id), el));
                EventBus.emit(EVENTS.ELEVATORS_UPDATED, this.getAll());
            }
        }

        if (!navigator.onLine) {
            if (this.elevators.size === 0) {
                getInitialElevatorsMock().forEach(el => this.elevators.set(String(el.id), el));
            }
            return this.getAll();
        }

        try {
            const supabase = getSupabase();

            // Parallélisation des 3 requêtes nécessaires
            const [
                { data: dbElevators, error: elError },
                { data: dbReports, error: repError },
                { data: dbHistories, error: histError }
            ] = await Promise.all([
                supabase.from('elevators').select('*').order('id', { ascending: true }),
                supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(200),
                supabase.from('histories').select('*').order('created_at', { ascending: false }).limit(300)
            ]);

            if (elError) throw elError;

            // Assemblage des ascenseurs (uniquement les entrées configurées)
            const rawList = dbElevators && dbElevators.length > 0 ? dbElevators : getInitialElevatorsMock();
            const baseList = rawList.filter(el => validIds.has(String(el.id)));
            const reportsList = dbReports || [];
            const historiesList = dbHistories || [];

            this.elevators.clear();

            for (const el of baseList) {
                const idStr = String(el.id);
                const elReports = reportsList.filter(r => String(r.entrance) === idStr);
                const elHistory = historiesList.filter(h => String(h.entrance) === idStr);

                const metrics = this._calculatePreciseDowntime(elHistory, el.status, el.last_status_change);

                const assembled = {
                    id: idStr,
                    status: el.status || 'en_service',
                    last_status_change: (el.status === 'en_panne' && metrics.downSince) ? metrics.downSince : (el.last_status_change || new Date().toISOString()),
                    maintenance_notes: el.maintenance_notes || '',
                    reports: elReports,
                    history: elHistory,
                    downtimeDays: metrics.downtimeDays
                };

                this.elevators.set(idStr, assembled);
            }

            // Sauvegarde de l'état assemblé en cache
            await Storage.setCache('elevators_state', this.getAll());
            EventBus.emit(EVENTS.ELEVATORS_UPDATED, this.getAll());

            this._setupRealtime();

            return this.getAll();
        } catch (e) {
            console.error("[ElevatorService] Erreur chargement ascenseurs:", e);
            if (this.elevators.size === 0) {
                getInitialElevatorsMock().forEach(el => this.elevators.set(String(el.id), el));
            }
            return this.getAll();
        }
    }

    /**
     * Retourne la liste ordonnée des ascenseurs.
     * @returns {Array<Object>}
     */
    getAll() {
        return Array.from(this.elevators.values());
    }

    /**
     * Retourne un ascenseur par son identifiant d'entrée.
     * @param {string} entranceId
     * @returns {Object|null}
     */
    getById(entranceId) {
        return this.elevators.get(String(entranceId)) || null;
    }

    /**
     * Calcule le temps d'arrêt réel en heures et jours décimaux.
     * @private
     */
    _calculatePreciseDowntime(history, currentStatus, lastStatusChange) {
        let totalDowntimeMs = 0;
        let downSince = null;

        // Trier par ordre chronologique croissant
        const sorted = [...history].sort((a, b) => {
            const tA = a.timestamp || new Date(a.created_at).getTime();
            const tB = b.timestamp || new Date(b.created_at).getTime();
            return tA - tB;
        });

        for (const evt of sorted) {
            const evtTime = evt.timestamp || new Date(evt.created_at).getTime();
            if (evt.status !== 'en_service') {
                if (downSince === null) downSince = evtTime;
            } else if (downSince !== null) {
                totalDowntimeMs += (evtTime - downSince);
                downSince = null;
            }
        }

        // Si actuellement en panne
        if (currentStatus !== 'en_service') {
            const start = downSince !== null ? downSince : (lastStatusChange ? new Date(lastStatusChange).getTime() : Date.now());
            totalDowntimeMs += Math.max(0, Date.now() - start);
        }

        // Calcul du nombre de jours de panne
        const downtimeDays = Math.max(0, Math.floor(totalDowntimeMs / (1000 * 60 * 60 * 24)));

        return { 
            totalDowntimeMs, 
            downtimeDays, 
            downSince: downSince !== null ? new Date(downSince).toISOString() : null 
        };
    }

    /**
     * Soumet un nouveau signalement de panne avec téléversement sécurisé de photo.
     * @param {Object} reportData
     * @param {string} reportData.entrance
     * @param {string} reportData.type
     * @param {string} reportData.description
     * @param {Blob|null} [reportData.photoBlob]
     * @param {string} [reportData.user]
     */
    async submitReport({ entrance, type, description, photoBlob = null, user = "" }) {
        const idStr = String(entrance);
        const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const userProfile = Auth.getProfile();
        const authorName = user.trim() || userProfile?.username || "Voisin Anonyme";
        const userId = Auth.getUser()?.id || null;

        let photoUrl = null;

        // 1. Upload photo si connectivité en ligne
        if (photoBlob && navigator.onLine) {
            try {
                const supabase = getSupabase();
                const fileName = `elevators/${idStr}/${reportId}.jpg`;
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
                console.warn("[ElevatorService] Échec upload photo:", err);
            }
        }

        const newReport = {
            id: reportId,
            entrance: idStr,
            type: type,
            description: description,
            photo_url: photoUrl,
            user: authorName,
            user_id: userId,
            created_at: new Date().toISOString()
        };

        // 2. Si hors-ligne, mise en file IndexedDB
        if (!navigator.onLine) {
            await Storage.addToSyncQueue({
                action: 'CREATE_REPORT',
                payload: newReport,
                hasPhoto: !!photoBlob
            });

            // Mise à jour optimiste locale
            this._applyLocalReport(newReport);
            return newReport;
        }

        // 3. Insertion en base de données Supabase
        const supabase = getSupabase();
        const { error: insertErr } = await supabase.from('reports').insert([newReport]);
        if (insertErr) throw insertErr;

        // 4. Mettre à jour l'ascenseur en panne
        await this.updateStatus(idStr, 'en_panne', `Signalement : ${type} - ${description}`);

        this._applyLocalReport(newReport);
        return newReport;
    }

    /**
     * Met à jour le statut d'un ascenseur (service, maintenance, panne).
     * @param {string} entranceId
     * @param {'en_service'|'en_maintenance'|'en_panne'} newStatus
     * @param {string} [notes=""]
     */
    async updateStatus(entranceId, newStatus, notes = "") {
        const idStr = String(entranceId);
        const now = new Date().toISOString();

        if (navigator.onLine) {
            const supabase = getSupabase();
            const { error: elErr } = await supabase
                .from('elevators')
                .update({
                    status: newStatus,
                    last_status_change: now,
                    maintenance_notes: notes
                })
                .eq('id', idStr);

            if (elErr) throw elErr;

            // Ajout d'une entrée d'historique
            const histItem = {
                entrance: idStr,
                status: newStatus,
                created_at: now,
                user: Auth.getProfile()?.username || "Résident",
                details: notes
            };
            await supabase.from('histories').insert([histItem]);
        } else {
            await Storage.addToSyncQueue({
                action: 'UPDATE_STATUS',
                payload: { entrance: idStr, status: newStatus, notes, timestamp: now }
            });
        }

        // Mise à jour locale
        const el = this.elevators.get(idStr);
        if (el) {
            el.status = newStatus;
            el.last_status_change = now;
            if (notes) el.maintenance_notes = notes;
            EventBus.emit(EVENTS.ELEVATORS_UPDATED, this.getAll());
        }
    }

    _applyLocalReport(report) {
        const el = this.elevators.get(String(report.entrance));
        if (el) {
            el.reports.unshift(report);
            el.status = 'en_panne';
            el.last_status_change = report.created_at;
            EventBus.emit(EVENTS.REPORT_ADDED, report);
            EventBus.emit(EVENTS.ELEVATORS_UPDATED, this.getAll());
        }
    }

    /**
     * Initialise l'écouteur WebSockets Supabase Realtime de manière économique.
     * @private
     */
    _setupRealtime() {
        if (this.realtimeChannel || !navigator.onLine) return;

        try {
            const supabase = getSupabase();
            this.realtimeChannel = supabase.channel('realtime:elevators')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (payload) => {
                    const newRep = payload.new;
                    if (newRep) {
                        this._applyLocalReport(newRep);
                    }
                })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'elevators' }, (payload) => {
                    const updated = payload.new;
                    if (updated) {
                        const el = this.elevators.get(String(updated.id));
                        if (el) {
                            el.status = updated.status;
                            el.last_status_change = updated.last_status_change;
                            el.maintenance_notes = updated.maintenance_notes;
                            EventBus.emit(EVENTS.ELEVATORS_UPDATED, this.getAll());
                        }
                    }
                })
                .subscribe();
        } catch (e) {
            console.warn("[ElevatorService] Erreur abonnement realtime:", e);
        }
    }
}

export const Elevator = new ElevatorService();
