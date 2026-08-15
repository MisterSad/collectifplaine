# Guide des Agents IA — Collectif Plaine (Standards 2026)

Bienvenue sur le projet **Collectif Plaine**. Ce document fournit l'ensemble des directives, principes d'ingénierie, garde-fous de sécurité et protocoles nécessaires pour qu'un agent IA ou un développeur puisse étendre ou maintenir cette application sans introduire de régression ni de faille de sécurité.

---

## 1. Vue d'Ensemble & Mission du Projet

- **Projet :** Collectif Plaine (*Hub d'Action Collective & Suivi Technique des Locataires*)
- **Périmètre :** Résidence Division Leclerc (Bâtiments 38 à 52) à Cachan (Bailleur social *Valdévy*).
- **Fonctionnalités Clés :**
  1. Suivi en direct et historique des pannes des 8 ascenseurs (Avenue Division Leclerc).
  2. Registre et signalement des incidents des parties communes (portes, propreté, chauffage, éclairage).
  3. Démocratie participative (Pétitions collectives certifiées & Scrutins/Votes de résidents).
  4. Wiki juridique interactif (Loi du 6 juillet 1989, Décret charges récupérables, etc.).
  5. Générateur automatique de lettres de mise en demeure et rapports PDF probants.
  6. Mode PWA Offline-First (Navigation et signalements garantis sans connexion réseau).

---

## 2. Règles d'Or pour les Agents IA (Doctrine Zero-Trust)

> [!CAUTION]
> **RÈGLE 1 : Zéro état de privilège client (`localStorage`)**
> Ne JAMAIS stocker ou vérifier un rôle ou une permission d'administration dans le `localStorage`. Tout privilège (comme le statut `admin`) doit être vérifié via le jeton JWT signé émis par `supabase.auth` et la colonne `role` de la table `residents`.

> [!IMPORTANT]
> **RÈGLE 2 : Protection stricte des données personnelles (RGPD)**
> Les coordonnées privées des résidents (téléphones mobiles, adresses e-mails réelles) ne doivent **jamais** être rendues accessibles publiquement via des requêtes REST ou des politiques RLS permissives.

> [!WARNING]
> **RÈGLE 3 : Interdiction formelle des fichiers monolithiques ("God Files")**
> Ne recréez jamais de fichier centralisant plusieurs responsabilités. Tout nouveau domaine métier doit être isolé dans `js/domains/<nom-du-domaine>/` sous la forme :
> - `<domaine>.service.js` : Requêtage DB, règles métier, calculs purs.
> - `<domaine>.ui.js` : Rendu du DOM, gestion des modales, formulaires et interactions.

> [!TIP]
> **RÈGLE 4 : Stockage hors-ligne volumineux = IndexedDB uniquement**
> Le `localStorage` est plafonné à 5 Mo et provoque des exceptions `QuotaExceededError`. Tout stockage d'images ou de file de synchronisation (`sync_queue`) doit impérativement utiliser le service `Storage` basé sur **IndexedDB** (`js/core/storage.js`).

> [!NOTE]
> **RÈGLE 5 : Sécurité CSP & Pas d'événements inline**
> La Politique de Sécurité du Contenu (CSP) interdit les attributs `onclick="..."`, `onchange="..."` dans le HTML. Utilisez toujours la délégation d'événements avec `addEventListener` et des attributs `data-action="..."`.

---

## 3. Arborescence Modulaire du Projet

```text
COLLECTIF PLAINE/
├── supabase/
│   └── migrations/                 # Migrations SQL versionnées (DDL & RLS)
├── css/
│   ├── variables.css               # Design System (Thèmes Clair / Sombre OLED, tokens)
│   ├── main.css                    # Layout global, Sidebar Desktop, TopBar
│   ├── components.css              # Boutons, Cards, Badges, Modales, Formulaires
│   └── mobile.css                  # Responsive & Bottom Navigation Mobile PWA
├── js/
│   ├── config/
│   │   ├── config.js               # Annuaire immuable des 8 entrées Leclerc & constantes
│   │   └── mockData.js             # Données de secours initiales hors-ligne
│   ├── core/
│   │   ├── db-client.js            # Initialisation singleton Supabase Client
│   │   ├── auth.js                 # Service d'authentification Zero-Trust (JWT)
│   │   ├── storage.js              # Abstraction IndexedDB (Queue offline & photos)
│   │   ├── event-bus.js            # Bus Pub/Sub d'événements découplé
│   │   └── router.js               # Routeur SPA par fragment d'URL (#/route)
│   ├── domains/
│   │   ├── elevators/              # Domaine Ascenseurs & Pannes
│   │   ├── incidents/              # Domaine Registre des Incidents Communs
│   │   ├── democracy/              # Domaine Pétitions & Scrutins/Votes
│   │   ├── wiki/                   # Domaine Guides & Droit du Locataire
│   │   └── legal/                  # Génération PDF (jsPDF)
│   ├── utils/
│   │   ├── security.js             # Assainissement XSS, validations, compression photo
│   │   ├── date-helpers.js         # Formatage temporel relatif & dates FR
│   │   └── audio-feedback.js       # Synthèse sonore Web Audio API
│   ├── main.js                     # Point d'entrée ES Modules (Bootstrap applicatif)
│   ├── db-lib.js                   # Bundle local du SDK Supabase
│   ├── chart.min.js                # Chart.js
│   └── jspdf.umd.min.js            # jsPDF
├── sw.js                           # Service Worker PWA (Cache & Offline résilient)
├── index.html                      # Layout sémantique (CSP renforcée)
├── flyer.html                      # Support de communication imprimable A4
├── AGENTS.md                       # Guide d'ingénierie pour les agents IA
├── ARCHITECTURE.md                 # Architecture système et modèle de données
└── CHANGELOG.md                    # Journal des modifications et évolutions
```

---

## 4. Commandes & Scripts Utiles

```bash
# Démarrer le serveur web local (Port 3000)
npm start

# Vérifier la syntaxe de l'ensemble des modules JS
npm run check
```

---

## 5. Comment Ajouter une Nouvelle Fonctionnalité

1. **Si modification de base de données requise :**
   - Créer un fichier de migration dans `supabase/migrations/YYYYMMDD_nom_de_la_migration.sql`.
   - Toujours inclure `ENABLE ROW LEVEL SECURITY;` et définir explicitement les politiques `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
   - Ajouter les index nécessaires pour les clés étrangères et colonnes de tri/filtrage.
2. **Créer le service de domaine :**
   - Dans `js/domains/<domaine>/<domaine>.service.js`, implémenter les méthodes CRUD, la mise en cache via `Storage` et l'émission d'événements via `EventBus`.
3. **Créer le contrôleur d'interface :**
   - Dans `js/domains/<domaine>/<domaine>.ui.js`, gérer le rendu DOM en assainissant systématiquement les entrées avec `sanitizeHTML()`.
4. **Enregistrer dans `main.js` & `sw.js` :**
   - Initialiser le contrôleur dans `App.bootstrap()`.
   - Ajouter le nouveau chemin de fichier dans `ASSETS_TO_CACHE` dans `sw.js` et incrémenter la version du cache (`CACHE_NAME`).
