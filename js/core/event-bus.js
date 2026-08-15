/**
 * @fileoverview Bus d'événements asynchrone découplé (Pub/Sub).
 * Permet aux services de communiquer sans couplage direct.
 */

class EventBusService {
    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this.listeners = new Map();
    }

    /**
     * S'abonne à un événement.
     * @param {string} eventName
     * @param {Function} callback
     * @returns {Function} Fonction de désabonnement
     */
    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        this.listeners.get(eventName).add(callback);

        return () => this.off(eventName, callback);
    }

    /**
     * Se désabonne d'un événement.
     * @param {string} eventName
     * @param {Function} callback
     */
    off(eventName, callback) {
        if (this.listeners.has(eventName)) {
            this.listeners.get(eventName).delete(callback);
        }
    }

    /**
     * Émet un événement avec des données associées.
     * @param {string} eventName
     * @param {*} [data]
     */
    emit(eventName, data) {
        if (!this.listeners.has(eventName)) return;

        for (const callback of this.listeners.get(eventName)) {
            try {
                callback(data);
            } catch (err) {
                console.error(`[EventBus] Erreur lors du traitement de "${eventName}":`, err);
            }
        }
    }
}

export const EventBus = new EventBusService();

/**
 * Constantes d'événements normalisées
 */
export const EVENTS = Object.freeze({
    AUTH_STATE_CHANGED: 'auth:state_changed',
    ELEVATORS_UPDATED: 'elevators:updated',
    REPORT_ADDED: 'reports:added',
    INCIDENTS_UPDATED: 'incidents:updated',
    PETITIONS_UPDATED: 'petitions:updated',
    POLLS_UPDATED: 'polls:updated',
    ROUTE_CHANGED: 'router:route_changed',
    TOAST_NOTIFY: 'ui:toast',
    NETWORK_ONLINE: 'network:online',
    NETWORK_OFFLINE: 'network:offline'
});
