# Journal des Modifications — Collectif Plaine (CHANGELOG)

Toutes les modifications notables apportées à ce projet sont documentées dans ce fichier.
Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et ce projet adhère à la [Gestion Sémantique de Version](https://semver.org/lang/fr/).

---

## [2.0.0] — 2026-08-15
### 🛡️ Sécurité & Architecture Zero-Trust (Standards 2026)

#### ✨ Ajouté
- **Architecture ES Modules Native :** Découpage complet du code en 22 modules ES6 spécialisés (`js/config/`, `js/core/`, `js/domains/`, `js/utils/`).
- **Gestionnaire de Stockage IndexedDB (`js/core/storage.js`) :**
  - Remplacement du `localStorage` pour la mise en cache des photos et de la file d'attente hors-ligne (`sync_queue`, `photos_cache`, `app_cache`).
  - Éradication totale des risques d'exception `QuotaExceededError`.
- **Bus d'Événements Asynchrone (`js/core/event-bus.js`) :** Découplage strict entre les flux de données et le rendu UI via un système Pub/Sub typé.
- **Routeur SPA Découplé (`js/core/router.js`) :** Gestion des fragments d'URL (`#/ascenseurs`, `#/incidents`, `#/petitions`, `#/stats`, `#/compte`) avec protection d'accès administrateur.
- **Contrôle d'Accès par Rôle (RBAC) :**
  - Ajout de la colonne `role text NOT NULL DEFAULT 'resident'` (`CHECK IN ('resident', 'admin')`) sur `public.residents`.
  - Attribution du rôle `admin` au compte administrateur `Tavares50`.
- **28 Politiques Row-Level Security (RLS) Durcies :**
  - Protection des données à caractère personnel (RGPD) : téléphones et emails privés ne sont plus accessibles au public.
  - Verrouillage anti-BOLA/IDOR : suppression et modification de signalements (`reports`, `incidents`) restreintes à l'auteur ou à un administrateur.
  - Droits de création et gestion de pétitions/scrutins réservés aux administrateurs.
- **Indexation Optimale PostgreSQL :** Création des index sur clés étrangères et critères de tri chronologique (`created_at DESC`, `entrance`, `status`).
- **Calcul Précis des Heures d'Indisponibilité :** Calcul mathématique exact des durées d'arrêt en heures (`downtimeHours`) et en jours (`downtimeDays`) sans arrondi journalier abusif.
- **Périmètre Résidence Restreint à l'Avenue Division Leclerc :** Annuaire et tables de données configurés pour les 8 immeubles de l'Avenue de la Division Leclerc (entrées 38, 40, 42, 44, 46, 48, 50, 52).
- **Documentation Complète 2026 :** Création des fichiers [`AGENTS.md`](file:///Users/andrevieira/Documents/GitHub/COLLECTIF%20PLAINE/AGENTS.md), [`ARCHITECTURE.md`](file:///Users/andrevieira/Documents/GitHub/COLLECTIF%20PLAINE/ARCHITECTURE.md) et [`CHANGELOG.md`](file:///Users/andrevieira/Documents/GitHub/COLLECTIF%20PLAINE/CHANGELOG.md).

#### 🔒 Corrigé (Vulnérabilités Audit SEV-01 à SEV-15)
- **SEV-01 & SEV-02 :** Fuite de données personnelles et failles BOLA corrigées via les migrations SQL `20260815_01` et `20260815_02`.
- **SEV-03 :** Usurpation locale de session éliminée. L'état d'authentification dépend exclusivement des jetons JWT émis par Supabase Auth.
- **SEV-04 :** Suppression de l'auto-seeding destructif client qui réinitialisait les 76 entrées à chaque chargement.
- **SEV-05 :** Correction du fallback Service Worker (`sw.js`) pour garantir l'affichage hors-ligne de `/index.html`.
- **SEV-06 :** Élimination de la cascade de 7 requêtes séquentielles au profit d'un requêtage parallélisé avec `Promise.allSettled`.
- **SEV-07 :** Remplacement de l'incrémentation journalière arbitraire par un calcul chronologique à la minute près.
- **SEV-08 & SEV-10 :** Assainissement strict anti-XSS (`sanitizeHTML()`) et suppression de tous les gestionnaires `onclick` inline dans `index.html` (CSP conforme).
- **SEV-09 :** Correction du déclencheur `handle_new_user()` dans PostgreSQL pour éviter les violations de clé primaire lors des inscriptions.
- **SEV-11 :** Gestion propre du cycle de vie des graphiques Chart.js (destruction systématique de l'instance précédente avant réinstanciation).
- **SEV-13 :** Migration du stockage d'images vers IndexedDB et compression automatique côté client via Canvas API.
- **SEV-12 & SEV-14 :** Éradication définitive des fichiers monolithiques géants `app.js` (3 247 lignes) et `store.js` (1 552 lignes).

#### 🗑️ Supprimé
- `js/app.js` (Monolithe 3 247 lignes)
- `js/store.js` (Monolithe 1 552 lignes)
- `js/security.js` (Remplacé par `js/utils/security.js`)
- `js/mockData.js` (Remplacé par `js/config/mockData.js`)
- `js/wikiData.js` (Remplacé par `js/domains/wiki/wiki.data.js`)
- `js/db-client.js` (Remplacé par `js/core/db-client.js`)
- `js/legal-generator.js` (Remplacé par `js/domains/legal/legal-generator.js`)
- `js/config.js` (Remplacé par `js/config/config.js`)

---

## [1.0.0] — 2026-06-22
### 🚀 Version Initiale PWA & Supabase

#### ✨ Ajouté
- Déploiement initial de la Progressive Web App (PWA) avec manifeste et Service Worker.
- Suivi du statut des 76 ascenseurs de la résidence Leclerc à Cachan.
- Formulaire de signalement de pannes avec prise de photo.
- Module de gestion des incidents pour les parties communes.
- Module Démocratie avec création de pétitions et sondages.
- Guide du locataire (Wiki) avec résumé des lois et décrets.
- Générateur PDF de lettres de mise en demeure via jsPDF.
- Intégration backend avec Supabase (PostgreSQL, Realtime, Storage).

---

## 🔮 Feuille de Route Prévisionnelle (Roadmap)
- **v2.1.0 :** Notifications Push Web (WebPush API) pour alerter les résidents dès qu'un ascenseur de leur bâtiment est en panne ou réparé.
- **v2.2.0 :** Export CSV & Excel certifié des statistiques annuelles pour les assemblées générales de copropriété.
- **v2.3.0 :** Traduction multilingue (FR / EN / ES / PT) pour les résidents allophones.
