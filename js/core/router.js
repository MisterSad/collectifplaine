/**
 * @fileoverview Routeur SPA Mobile basé sur le fragment de hachage (#/route).
 * Gère l'affichage dynamique des vues 100% Mobile, l'Onboarding immersif et la synchronisation de la TabBar.
 */

import { EventBus, EVENTS } from './event-bus.js';
import { Auth } from './auth.js';

const ROUTE_MAP = {
    'onboarding': { panelId: 'tab-onboarding', title: 'Bienvenue', fullscreen: true },
    'ascenseurs': { panelId: 'tab-ascenseurs', altId: 'tab-elevators', title: 'Ascenseurs' },
    'incidents': { panelId: 'tab-incidents', title: 'Incidents Communs' },
    'stats': { panelId: 'tab-stats', title: 'Tableau de Bord', adminOnly: true },
    'compte': { panelId: 'tab-compte', title: 'Espace Résident' }
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
        let targetRoute = rawHash;

        // Si aucun hash n'est fourni
        if (!targetRoute) {
            if (!Auth.isAuthenticated()) {
                const onboardingDone = localStorage.getItem('cp_onboarding_completed') === 'true';
                targetRoute = onboardingDone ? 'compte' : 'onboarding';
            } else {
                targetRoute = 'ascenseurs';
            }
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
        const targetPanel = document.getElementById(config.panelId) || (config.altId ? document.getElementById(config.altId) : null);
        if (targetPanel) {
            targetPanel.classList.remove('hidden');
            requestAnimationFrame(() => targetPanel.classList.add('active'));
        }

        // 3. Mettre à jour le titre de l'en-tête mobile
        const headerTitle = document.getElementById('mobile-header-title') || document.getElementById('top-bar-title');
        if (headerTitle) {
            headerTitle.textContent = config.title;
        }

        // 4. Mettre à jour la navigation mobile (TabBar)
        document.querySelectorAll('.mobile-link').forEach(link => {
            const href = link.getAttribute('href') || '';
            const linkRoute = href.replace(/^#\/?/, '');
            link.classList.toggle('active', linkRoute === routeName);
        });

        // 5. Gestion du mode plein écran (Onboarding)
        const isFullscreen = config.fullscreen === true;
        document.body.classList.toggle('fullscreen-mode', isFullscreen);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

export const Router = new RouterService();
