/**
 * @fileoverview Gestionnaire de stockage robuste basé sur IndexedDB.
 * Permet le stockage sécurisé des photos en attente et de la file de synchronisation hors-ligne,
 * sans risquer l'exception QuotaExceededError du localStorage (plafonné à 5 Mo).
 */

const DB_NAME = "collectif_plaine_db";
const DB_VERSION = 1;

class StorageService {
    constructor() {
        /** @type {IDBDatabase|null} */
        this.db = null;
        this._initPromise = null;
    }

    /**
     * Initialise la base de données IndexedDB.
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        if (this.db) return this.db;
        if (this._initPromise) return this._initPromise;

        this._initPromise = new Promise((resolve, reject) => {
            if (typeof window === 'undefined' || !window.indexedDB) {
                console.warn("[Storage] IndexedDB non supporté, mode dégradé.");
                return resolve(null);
            }

            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 1. File d'attente des opérations hors-ligne (Queue)
                if (!db.objectStoreNames.contains('sync_queue')) {
                    db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
                }

                // 2. Cache d'images / Blobs hors-ligne
                if (!db.objectStoreNames.contains('photos_cache')) {
                    db.createObjectStore('photos_cache', { keyPath: 'id' });
                }

                // 3. Cache d'état applicatif
                if (!db.objectStoreNames.contains('app_cache')) {
                    db.createObjectStore('app_cache', { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("[Storage] Erreur ouverture IndexedDB:", event.target.error);
                resolve(null); // Fallback tolérant
            };
        });

        return this._initPromise;
    }

    /**
     * Ajoute une opération dans la file de synchronisation hors-ligne.
     * @param {Object} item
     * @returns {Promise<number>}
     */
    async addToSyncQueue(item) {
        await this.init();
        if (!this.db) {
            // Fallback localStorage basique
            const q = this._getFallbackQueue();
            q.push({ ...item, id: Date.now() });
            localStorage.setItem('collectif_sync_fallback', JSON.stringify(q));
            return Date.now();
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['sync_queue'], 'readwrite');
            const store = tx.objectStore('sync_queue');
            const req = store.add({ ...item, queuedAt: Date.now() });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Récupère tous les éléments de la file de synchronisation.
     * @returns {Promise<Array<Object>>}
     */
    async getSyncQueue() {
        await this.init();
        if (!this.db) return this._getFallbackQueue();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['sync_queue'], 'readonly');
            const store = tx.objectStore('sync_queue');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Supprime un élément de la file de synchronisation par son ID.
     * @param {number} id
     */
    async removeFromSyncQueue(id) {
        await this.init();
        if (!this.db) {
            const q = this._getFallbackQueue().filter(i => i.id !== id);
            localStorage.setItem('collectif_sync_fallback', JSON.stringify(q));
            return;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['sync_queue'], 'readwrite');
            const store = tx.objectStore('sync_queue');
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Enregistre un instantané de cache applicatif.
     * @param {string} key
     * @param {*} value
     */
    async setCache(key, value) {
        await this.init();
        if (!this.db) {
            try {
                localStorage.setItem(`cp_cache_${key}`, JSON.stringify(value));
            } catch (e) {}
            return;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['app_cache'], 'readwrite');
            const store = tx.objectStore('app_cache');
            const req = store.put({ key, value, timestamp: Date.now() });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Récupère un instantané de cache.
     * @param {string} key
     * @returns {Promise<*>}
     */
    async getCache(key) {
        await this.init();
        if (!this.db) {
            try {
                const item = localStorage.getItem(`cp_cache_${key}`);
                return item ? JSON.parse(item) : null;
            } catch (e) {
                return null;
            }
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['app_cache'], 'readonly');
            const store = tx.objectStore('app_cache');
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
            req.onerror = () => reject(req.error);
        });
    }

    _getFallbackQueue() {
        try {
            const item = localStorage.getItem('collectif_sync_fallback');
            return item ? JSON.parse(item) : [];
        } catch (e) {
            return [];
        }
    }
}

export const Storage = new StorageService();
