/**
 * @fileoverview Utilitaires de sécurité, assainissement XSS et validation des entrées.
 * Garantit la neutralisation des injections HTML/Script et la validation des données utilisateurs.
 */

import { CONFIG } from '../config/config.js';

/**
 * Assainit une chaîne de caractères en encodant les entités HTML dangereuses.
 * @param {string} str - Chaîne brute potentiellement non sécurisée
 * @returns {string} Chaîne sécurisée
 */
export function sanitizeHTML(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    return s.replace(/[&<>"'/]/g, m => map[m]);
}

/**
 * Crée un nœud textuel sécurisé dans le DOM sans passer par innerHTML.
 * @param {HTMLElement} parent
 * @param {string} text
 */
export function setTextContent(parent, text) {
    if (parent) {
        parent.textContent = text || '';
    }
}

/**
 * Valide un pseudonyme résident selon les règles de sécurité.
 * @param {string} username
 * @returns {boolean}
 */
export function isValidUsername(username) {
    if (typeof username !== 'string') return false;
    const clean = username.trim();
    // 3 à 20 caractères alphanumériques (accents français et tirets autorisés)
    const regex = /^[a-zA-Z0-9À-ÿ_\-]{3,20}$/;
    return regex.test(clean);
}

/**
 * Valide la robustesse d'un mot de passe (min 8 car., min 1 lettre et 1 chiffre).
 * @param {string} password
 * @returns {boolean}
 */
export function isValidPassword(password) {
    if (typeof password !== 'string') return false;
    if (password.length < 8) return false;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasLetter && hasNumber;
}

/**
 * Vérifie si un numéro d'entrée est répertorié dans la copropriété.
 * @param {string} entranceId
 * @returns {boolean}
 */
export function isValidEntrance(entranceId) {
    if (!entranceId) return false;
    return CONFIG.entrances.some(ent => String(ent.id) === String(entranceId));
}

/**
 * Compresse une image côté client pour respecter les quotas de stockage et accélérer le téléversement.
 * @param {File} file - Fichier image sélectionné
 * @param {number} [maxWidth=1200] - Largeur maximale en pixels
 * @param {number} [quality=0.8] - Qualité JPEG/WebP
 * @returns {Promise<Blob>}
 */
export async function compressImage(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            return reject(new Error("Le fichier fourni n'est pas une image valide."));
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error("Échec de la compression de l'image."));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => reject(new Error("Impossible de décoder l'image."));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
        reader.readAsDataURL(file);
    });
}
