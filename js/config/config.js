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
    porte: { 
        label: "Porte bloquée / ne ferme plus", 
        iconSvg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M14 12v.01"/></svg>` 
    },
    vigik: { 
        label: "Lecteur VIGIK / Interphone en panne", 
        iconSvg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 3-9.5 9.5M15.5 7.5l3 3M14 10l2 2"/></svg>` 
    },
    proprete: { 
        label: "Propreté / Encombrants", 
        iconSvg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>` 
    },
    chauffage: { 
        label: "Chauffage / Eau Chaude", 
        iconSvg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5 0-1.63-1.65-2.92-2.5-4.5-.85 1.58-2.5 2.87-2.5 4.5Z"/><path d="M12 22a7.5 7.5 0 0 0 7.5-7.5c0-4.14-5-9.5-7.5-11.5C9.5 5 4.5 10.36 4.5 14.5A7.5 7.5 0 0 0 12 22Z"/></svg>` 
    },
    eclairage: { 
        label: "Éclairage défectueux", 
        iconSvg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>` 
    },
    securite: { 
        label: "Sécurité / Nuisance", 
        iconSvg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>` 
    },
    autre: { 
        label: "Autre incident", 
        iconSvg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>` 
    }
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
