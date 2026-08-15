/**
 * @fileoverview Fonctions utilitaires de manipulation temporelle et calculs de durées.
 */

/**
 * Renvoie une chaîne représentant le temps écoulé de façon lisible ("à l'instant", "il y a 5 min", "il y a 2h", etc.)
 * @param {string|number|Date} dateInput
 * @returns {string}
 */
export function timeAgo(dateInput) {
    if (!dateInput) return "Date inconnue";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "Date invalide";

    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "À l'instant";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Il y a ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `Il y a ${days}j`;

    const months = Math.floor(days / 30);
    if (months < 12) return `Il y a ${months} mois`;

    const years = Math.floor(days / 365);
    return `Il y a ${years} an${years > 1 ? 's' : ''}`;
}

/**
 * Formate une date en format français lisible (ex: "15 août 2026 à 14:30")
 * @param {string|number|Date} dateInput
 * @param {boolean} [includeTime=true]
 * @returns {string}
 */
export function formatDateFR(dateInput, includeTime = true) {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "";

    const options = {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
    };

    return new Intl.DateTimeFormat('fr-FR', options).format(date);
}

/**
 * Formate une date en format compact ISO (YYYY-MM-DD)
 * @param {Date} date
 * @returns {string}
 */
export function toISODateString(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
