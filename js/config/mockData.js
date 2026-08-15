/**
 * @fileoverview Données de secours de test (mock) pour initialiser l'application en mode hors-ligne.
 */

import { CONFIG } from './config.js';

/**
 * Génère les états par défaut pour tous les ascenseurs configurés.
 * @returns {Array<Object>}
 */
export function getInitialElevatorsMock() {
    return CONFIG.entrances
        .filter(ent => ent.hasElevator !== false)
        .map(ent => ({
            id: ent.id,
            status: "en_service",
            last_status_change: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
            maintenance_notes: "",
            reports: [],
            history: [
                {
                    id: `h_init_${ent.id}`,
                    entrance: ent.id,
                    status: "en_service",
                    timestamp: Date.now() - 3600000 * 24 * 7,
                    created_at: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
                    user: "Système",
                    details: "État nominal initial"
                }
            ],
            downtimeDays: 0
        }));
}
