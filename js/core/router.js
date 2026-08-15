/**
 * @fileoverview Routeur SPA basé sur le fragment de hachage (#/route).
 * Gère l'affichage dynamique des vues et la synchronisation de l'état de navigation mobile/desktop.
 */

import { EventBus, EVENTS } from './event-bus.js';
import { Auth } from './auth.js';

const ROUTE_MAP = {
    'landing': { panelId: 'tab-landing', title: 'Accueil' },
    'ascenseurs': { panelId: 'tab-ascenseurs', title: 'Ascenseurs' },
    'incidents': { panelId: 'tab-incidents', title: 'Incidents' },
    'petitions': { panelId: 'tab-petitions', title: 'Pétitions Collectives' },
    'votes': { panelId: 'tab-votes', title: 'Sondages & Votes' },
    'guides': { panelId: 'tab-guides', title: 'Guides & Aide Pratique' },
    'charges': { panelId: 'tab-charges', title: 'Audit des Charges' },
    'stats': { panelId: 'tab-stats', title: 'Statistiques Admin', adminOnly: true },
    'compte': { panelId: 'tab-compte', title: 'Mon Compte' }
};

class RouterService {
    constructor() {
        this.currentRoute = 'ascenseurs';
        this._initialized = false;
    }

    /**
     * Initialise les écouteurs d'URL et active la route initiale.
     */
    init() {
        if (this._initialized) return;

        window.addEventListener('hashchange', () => this._handleHashChange());
        this._handleHashChange();
        this._initialized = true;
    }

    /**
     * Navigue par programmation vers une route donnée.
     * @param {string} routeName
     */
    navigate(routeName) {
        const clean = routeName.replace(/^#\/?/, '');
        window.location.hash = `#/${clean}`;
    }

    /**
     * Traite le changement de fragment d'URL.
     * @private
     */
    _handleHashChange() {
        const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
        let targetRoute = rawHash || 'ascenseurs';

        // Si l'utilisateur n'est pas connecté et arrive sans hash spécifique
        if (!rawHash && !Auth.isAuthenticated()) {
            targetRoute = 'landing';
        }

        const routeConfig = ROUTE_MAP[targetRoute] || ROUTE_MAP['ascenseurs'];

        // Protection de la route admin
        if (routeConfig.adminOnly && !Auth.isAdmin()) {
            console.warn("[Router] Accès refusé à la route admin:", targetRoute);
            this.navigate('ascenseurs');
            return;
        }

        this.currentRoute = targetRoute;
        this._renderActiveRoute(targetRoute, routeConfig);
        EventBus.emit(EVENTS.ROUTE_CHANGED, { route: targetRoute, config: routeConfig });
    }

    /**
     * Met à jour le DOM pour afficher le panneau actif.
     * @private
     */
    _renderActiveRoute(routeName, config) {
        // 1. Masquer tous les panneaux
        document.querySelectorAll('.page-panel').forEach(panel => {
            panel.classList.add('hidden');
            panel.classList.remove('active');
        });

        // 2. Afficher le panneau ciblé
        const targetPanel = document.getElementById(config.panelId);
        if (targetPanel) {
            targetPanel.classList.remove('hidden');
            // Timeout léger pour déclencher l'animation CSS
            requestAnimationFrame(() => targetPanel.classList.add('active'));
        }

        // 3. Mettre à jour le titre de l'en-tête principal
        const topBarTitle = document.getElementById('top-bar-title');
        if (topBarTitle) {
            topBarTitle.textContent = config.title;
        }

        // 4. Mettre à jour la navigation Desktop
        document.querySelectorAll('.menu-link').forEach(link => {
            const href = link.getAttribute('href') || '';
            const linkRoute = href.replace(/^#\/?/, '');
            link.classList.toggle('active', linkRoute === routeName);
        });

        // 5. Mettre à jour la navigation Mobile
        document.querySelectorAll('.mobile-link').forEach(link => {
            const href = link.getAttribute('href') || '';
            const linkRoute = href.replace(/^#\/?/, '');
            link.classList.toggle('active', linkRoute === routeName);
        });

        // 6. Gestion de la visibilité des menus selon la landing page
        const isLanding = routeName === 'landing';
        document.body.classList.toggle('unauth-layout', isLanding);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

export const Router = new RouterService();
