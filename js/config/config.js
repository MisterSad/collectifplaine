/**
 * @fileoverview Configuration globale et immuable de l'application Collectif Plaine.
 * Définit l'annuaire des 8 entrées de l'Avenue de la Division Leclerc et les constantes métier.
 */

/**
 * @typedef {Object} EntranceConfig
 * @property {string} id - Identifiant unique de l'entrée (ex: "38", "50")
 * @property {string} label - Libellé complet de l'adresse
 * @property {string} street - Nom de la rue ou de l'avenue
 * @property {string} shortLabel - Libellé raccourci pour l'affichage (ex: "N° 38")
 * @property {boolean} hasElevator - Présence d'un ascenseur dans la cage d'escalier
 */

export const CONFIG = Object.freeze({
    appName: "Collectif Plaine",
    appVersion: "2.0.0",
    storageBucket: "reports_photos",
    adminUsername: "Tavares50",
    maxPhotoSizeMB: 3,
    syncIntervalMs: 30000,
    
    /** @type {EntranceConfig[]} */
    entrances: [
        { id: "38", label: "38 avenue Division Leclerc", street: "Avenue Division Leclerc", shortLabel: "N° 38", hasElevator: true },
        { id: "40", label: "40 avenue Division Leclerc", street: "Avenue Division Leclerc", shortLabel: "N° 40", hasElevator: true },
        { id: "42", label: "42 avenue Division Leclerc", street: "Avenue Division Leclerc", shortLabel: "N° 42", hasElevator: true },
        { id: "44", label: "44 avenue Division Leclerc", street: "Avenue Division Leclerc", shortLabel: "N° 44", hasElevator: true },
        { id: "46", label: "46 avenue Division Leclerc", street: "Avenue Division Leclerc", shortLabel: "N° 46", hasElevator: true },
        { id: "48", label: "48 avenue Division Leclerc", street: "Avenue Division Leclerc", shortLabel: "N° 48", hasElevator: true },
        { id: "50", label: "50 avenue Division Leclerc", street: "Avenue Division Leclerc", shortLabel: "N° 50", hasElevator: true },
        { id: "52", label: "52 avenue Division Leclerc", street: "Avenue Division Leclerc", shortLabel: "N° 52", hasElevator: true }
    ]
});

/**
 * Mappage des catégories d'incidents avec libellés et icônes.
 */
export const INCIDENT_CATEGORIES = Object.freeze({
    porte: { label: "Porte bloquée / ne ferme plus", icon: "🚪" },
    vigik: { label: "Lecteur VIGIK / Interphone en panne", icon: "🔑" },
    proprete: { label: "Propreté / Encombrants", icon: "🧹" },
    chauffage: { label: "Chauffage / Eau Chaude", icon: "🔥" },
    eclairage: { label: "Éclairage défectueux", icon: "💡" },
    securite: { label: "Sécurité / Nuisance", icon: "🛡️" },
    autre: { label: "Autre incident", icon: "⚠️" }
});

/**
 * Types de dysfonctionnements d'ascenseur.
 */
export const ELEVATOR_ISSUE_TYPES = Object.freeze({
    arrêt: "Hors service / Arrêt complet",
    portes: "Problème d'ouverture/fermeture des portes",
    boutons: "Boutons ou cabine inactifs",
    bruit: "Bruit anormal ou vibrations inquiétantes",
    autre: "Autre anomalie"
});
