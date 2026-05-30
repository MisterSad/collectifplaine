/**
 * Suivi pannes ascenseurs - Données initiales de simulation
 * Fournit un ensemble de données réalistes pour les 9 entrées de la Division Leclerc.
 */
const INITIAL_ELEVATOR_DATA = [
    {
        id: "36",
        status: "en_service",
        lastStatusChange: Date.now() - (12 * 24 * 60 * 60 * 1000), // 12 jours
        maintenanceNotes: "",
        tenantReports: [],
        history: [
            {
                id: "h36_1",
                timestamp: Date.now() - (12 * 24 * 60 * 60 * 1000),
                status: "en_service",
                notes: "Remise en service après remplacement des galets de guidage de cabine par Schindler."
            },
            {
                id: "h36_2",
                timestamp: Date.now() - (13 * 24 * 60 * 60 * 1000),
                status: "en_maintenance",
                notes: "Intervention Schindler : Remplacement préventif des galets de guidage."
            }
        ]
    },
    {
        id: "38",
        status: "en_panne",
        lastStatusChange: Date.now() - (1 * 24 * 60 * 60 * 1000), // 1 jour
        maintenanceNotes: "Technicien Otis contacté par le syndic hier. Attente du diagnostic technique.",
        tenantReports: [
            {
                id: "r38_1",
                timestamp: Date.now() - (1 * 24 * 60 * 60 * 1000),
                type: "portes",
                description: "Les portes se ferment à moitié puis se réouvrent sans arrêt au rez-de-chaussée.",
                user: "Marc_Appt12"
            },
            {
                id: "r38_2",
                timestamp: Date.now() - (20 * 60 * 60 * 1000),
                type: "arrêt",
                description: "Ascenseur complètement bloqué au rez-de-chaussée avec les portes ouvertes maintenant.",
                user: "Sarah88"
            }
        ],
        history: [
            {
                id: "h38_1",
                timestamp: Date.now() - (1 * 24 * 60 * 60 * 1000),
                status: "en_panne",
                notes: "Signalisations multiples de dysfonctionnement des portes. Ascenseur mis hors service."
            },
            {
                id: "h38_2",
                timestamp: Date.now() - (15 * 24 * 60 * 60 * 1000),
                status: "en_service",
                notes: "Réparation de la carte électronique d'asservissement des portes par Otis."
            }
        ]
    },
    {
        id: "40",
        status: "en_service",
        lastStatusChange: Date.now() - (3 * 24 * 60 * 60 * 1000), // 3 jours
        maintenanceNotes: "",
        tenantReports: [],
        history: [
            {
                id: "h40_1",
                timestamp: Date.now() - (3 * 24 * 60 * 60 * 1000),
                status: "en_service",
                notes: "Remise en service de l'ascenseur après dépannage sur le frein d'arrêt."
            },
            {
                id: "h40_2",
                timestamp: Date.now() - (4 * 24 * 60 * 60 * 1000),
                status: "en_panne",
                notes: "Ascenseur arrêté : blocage mécanique signalé. Frein bloqué."
            }
        ]
    },
    {
        id: "42",
        status: "en_maintenance",
        lastStatusChange: Date.now() - (4 * 60 * 60 * 1000), // 4 heures
        maintenanceNotes: "Visite de maintenance trimestrielle obligatoire + changement des ampoules de cabine. Intervenant : Kone.",
        tenantReports: [],
        history: [
            {
                id: "h42_1",
                timestamp: Date.now() - (4 * 60 * 60 * 1000),
                status: "en_maintenance",
                notes: "Début de la maintenance trimestrielle périodique réglementaire."
            }
        ]
    },
    {
        id: "44",
        status: "en_service",
        lastStatusChange: Date.now() - (45 * 24 * 60 * 60 * 1000), // 45 jours
        maintenanceNotes: "",
        tenantReports: [],
        history: [
            {
                id: "h44_1",
                timestamp: Date.now() - (45 * 24 * 60 * 60 * 1000),
                status: "en_service",
                notes: "Révision annuelle complète validée sans anomalies."
            }
        ]
    },
    {
        id: "46",
        status: "en_service",
        lastStatusChange: Date.now() - (25 * 24 * 60 * 60 * 1000), // 25 jours
        maintenanceNotes: "",
        tenantReports: [],
        history: [
            {
                id: "h46_1",
                timestamp: Date.now() - (25 * 24 * 60 * 60 * 1000),
                status: "en_service",
                notes: "Nettoyage des contacts de bouton cabine et remise en route."
            },
            {
                id: "h46_2",
                timestamp: Date.now() - (26 * 24 * 60 * 60 * 1000),
                status: "en_panne",
                notes: "Boutons du 3ème et 4ème étage inopérants."
            }
        ]
    },
    {
        id: "48",
        status: "en_service",
        lastStatusChange: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 jours
        maintenanceNotes: "",
        tenantReports: [],
        history: [
            {
                id: "h48_1",
                timestamp: Date.now() - (30 * 24 * 60 * 60 * 1000),
                status: "en_service",
                notes: "Remise en service suite à coupure d'électricité générale de la rue."
            }
        ]
    },
    {
        id: "50",
        status: "en_panne",
        lastStatusChange: Date.now() - (6 * 60 * 60 * 1000), // 6 heures
        maintenanceNotes: "Notification transmise automatiquement au prestataire de service de l'immeuble.",
        tenantReports: [
            {
                id: "r50_1",
                timestamp: Date.now() - (6 * 60 * 60 * 1000),
                type: "arrêt",
                description: "L'ascenseur est bloqué au 5e étage. On entend la ventilation mais il ne bouge pas si on appuie.",
                user: "Locataire5e"
            }
        ],
        history: [
            {
                id: "h50_1",
                timestamp: Date.now() - (6 * 60 * 60 * 1000),
                status: "en_panne",
                notes: "Premier signalement locataire reçu. Notification envoyée au technicien."
            }
        ]
    },
    {
        id: "52",
        status: "en_service",
        lastStatusChange: Date.now() - (18 * 24 * 60 * 60 * 1000), // 18 jours
        maintenanceNotes: "",
        tenantReports: [],
        history: [
            {
                id: "h52_1",
                timestamp: Date.now() - (18 * 24 * 60 * 60 * 1000),
                status: "en_service",
                notes: "Changement de la serrure de porte palière au RDC."
            }
        ]
    }
];
