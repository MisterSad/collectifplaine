/**
 * Suivi pannes ascenseurs - Données de démarrage opérationnelles (Nettoyées)
 * Initialise l'ensemble des 9 entrées Leclerc à Cachan en état de service opérationnel, sans historique ni signalement actif.
 */
const INITIAL_ELEVATOR_DATA = [
    {
        id: "38",
        status: "en_service",
        lastStatusChange: Date.now(),
        maintenanceNotes: "",
        tenantReports: [],
        history: []
    },
    {
        id: "40",
        status: "en_service",
        lastStatusChange: Date.now(),
        maintenanceNotes: "",
        tenantReports: [],
        history: []
    },
    {
        id: "42",
        status: "en_service",
        lastStatusChange: Date.now(),
        maintenanceNotes: "",
        tenantReports: [],
        history: []
    },
    {
        id: "44",
        status: "en_service",
        lastStatusChange: Date.now(),
        maintenanceNotes: "",
        tenantReports: [],
        history: []
    },
    {
        id: "46",
        status: "en_service",
        lastStatusChange: Date.now(),
        maintenanceNotes: "",
        tenantReports: [],
        history: []
    },
    {
        id: "48",
        status: "en_service",
        lastStatusChange: Date.now(),
        maintenanceNotes: "",
        tenantReports: [],
        history: []
    },
    {
        id: "50",
        status: "en_service",
        lastStatusChange: Date.now(),
        maintenanceNotes: "",
        tenantReports: [],
        history: []
    },
    {
        id: "52",
        status: "en_service",
        lastStatusChange: Date.now(),
        maintenanceNotes: "",
        tenantReports: [],
        history: []
    }
];
