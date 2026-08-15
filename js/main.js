/**
 * @fileoverview Point d'entrée principal (Main Bootstrap) de l'application Collectif Plaine 100% Mobile.
 * Orchestre les services, initialise les contrôleurs d'interface, le carrousel d'onboarding tactile et les formulaires.
 */

import { Auth } from './core/auth.js';
import { Router } from './core/router.js';
import { Storage } from './core/storage.js';
import { Onboarding } from './core/onboarding.js';
import { EventBus, EVENTS } from './core/event-bus.js';
import { Elevator } from './domains/elevators/elevator.service.js';
import { ElevatorUI } from './domains/elevators/elevator.ui.js';
import { Incident } from './domains/incidents/incident.service.js';
import { IncidentUI } from './domains/incidents/incident.ui.js';
import { sanitizeHTML, isValidPassword } from './utils/security.js';
import { playSuccessSound, playAlertSound } from './utils/audio-feedback.js';
import { CONFIG } from './config/config.js';

class App {
    constructor() {
        this.statsCharts = {};
    }

    async bootstrap() {
        console.log(`[App] Démarrage de ${CONFIG.appName} Mobile v${CONFIG.appVersion}...`);

        // 1. Initialiser le stockage IndexedDB et l'Authentification
        await Storage.init();
        await Auth.init();

        // 2. Initialiser l'Onboarding swipeable
        Onboarding.init();

        // 3. Initialiser les contrôleurs de domaine
        ElevatorUI.init();
        IncidentUI.init();

        // 4. Initialiser le routeur SPA Mobile
        Router.init();

        // 5. Charger les données en arrière-plan
        this._loadDomainData();

        // 6. Initialiser les fonctionnalités transverses
        this._bindAuthUI();
        this._bindModalsAndActions();
        this._setupToastManager();
        this._setupTheme();
        this._setupOfflineSyncWorker();
        this._registerServiceWorker();

        console.log("[App] Application Mobile Collectif Plaine prête.");
    }

    async _loadDomainData() {
        try {
            await Promise.allSettled([
                Elevator.loadAll(),
                Incident.loadAll()
            ]);
        } catch (e) {
            console.warn("[App] Erreur chargement initial:", e);
        }
    }

    _setupToastManager() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        EventBus.on(EVENTS.TOAST_NOTIFY, ({ title, message, type = 'info' }) => {
            const toast = document.createElement('div');
            toast.className = `toast-alert toast-${type} glass`;
            toast.innerHTML = `
                <div class="toast-title">${sanitizeHTML(title)}</div>
                <div class="toast-body">${sanitizeHTML(message)}</div>
            `;

            container.appendChild(toast);

            setTimeout(() => {
                toast.classList.add('toast-fade-out');
                setTimeout(() => toast.remove(), 300);
            }, 3500);
        });
    }

    _bindAuthUI() {
        const unauthSection = document.getElementById('account-unauthenticated-section');
        const authSection = document.getElementById('account-authenticated-section');
        const loginForm = document.getElementById('account-login-form');
        const registerForm = document.getElementById('account-register-form');
        const tabLogin = document.getElementById('account-tab-login');
        const tabRegister = document.getElementById('account-tab-register');
        const logoutBtn = document.getElementById('account-logout-btn');
        const restartOnboardingBtn = document.getElementById('btn-restart-onboarding');

        // Onglets Connexion / Inscription
        if (tabLogin && tabRegister && loginForm && registerForm) {
            tabLogin.addEventListener('click', () => {
                tabLogin.classList.add('active');
                tabRegister.classList.remove('active');
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
            });

            tabRegister.addEventListener('click', () => {
                tabRegister.classList.add('active');
                tabLogin.classList.remove('active');
                registerForm.classList.remove('hidden');
                loginForm.classList.add('hidden');
            });
        }

        // Soumission Connexion
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const identifier = document.getElementById('account-login-username')?.value;
                const password = document.getElementById('account-login-password')?.value;
                const errBox = document.getElementById('account-auth-error');

                if (!identifier || !password) {
                    if (errBox) {
                        errBox.textContent = "Veuillez saisir votre email ou identifiant et mot de passe.";
                        errBox.classList.remove('hidden');
                    }
                    return;
                }

                try {
                    await Auth.signIn(identifier, password);
                    playSuccessSound();
                    EventBus.emit(EVENTS.TOAST_NOTIFY, {
                        title: "Connexion réussie",
                        message: "Bienvenue sur le hub Collectif Plaine !",
                        type: "success"
                    });
                    Router.navigate('ascenseurs');
                } catch (err) {
                    if (errBox) {
                        errBox.textContent = err.message;
                        errBox.classList.remove('hidden');
                    }
                }
            });
        }

        // Soumission Inscription Complète
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const firstName = document.getElementById('reg-firstname')?.value;
                const lastName = document.getElementById('reg-lastname')?.value;
                const email = document.getElementById('reg-email')?.value;
                const apartment = document.getElementById('reg-apartment')?.value;
                const entrance = document.getElementById('reg-entrance')?.value;
                const password = document.getElementById('reg-password')?.value;
                const errBox = document.getElementById('account-auth-error');

                if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !apartment?.trim() || !entrance || !password) {
                    if (errBox) {
                        errBox.textContent = "Veuillez renseigner l'ensemble des champs obligatoires.";
                        errBox.classList.remove('hidden');
                    }
                    return;
                }

                if (!isValidPassword(password)) {
                    if (errBox) {
                        errBox.textContent = "Le mot de passe doit comporter au moins 8 caractères, une lettre et un chiffre.";
                        errBox.classList.remove('hidden');
                    }
                    return;
                }

                try {
                    await Auth.signUp({
                        firstName,
                        lastName,
                        email,
                        apartment,
                        entrance,
                        password
                    });

                    playSuccessSound();
                    EventBus.emit(EVENTS.TOAST_NOTIFY, {
                        title: "Bienvenue dans le Collectif !",
                        message: "Votre compte résident a été créé avec succès.",
                        type: "success"
                    });
                    Router.navigate('ascenseurs');
                } catch (err) {
                    if (errBox) {
                        errBox.textContent = err.message;
                        errBox.classList.remove('hidden');
                    }
                }
            });
        }

        // Revoir l'Onboarding
        if (restartOnboardingBtn) {
            restartOnboardingBtn.addEventListener('click', () => {
                Onboarding.restart();
            });
        }

        // Déconnexion
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await Auth.signOut();
                EventBus.emit(EVENTS.TOAST_NOTIFY, {
                    title: "Déconnexion",
                    message: "Vous avez été déconnecté.",
                    type: "info"
                });
                Router.navigate('compte');
            });
        }

        // Réaction aux changements d'authentification
        Auth.onAuthStateChange((user, profile) => {
            const isAuth = !!(user || profile);
            const isAdmin = Auth.isAdmin();

            if (unauthSection && authSection) {
                unauthSection.classList.toggle('hidden', isAuth);
                authSection.classList.toggle('hidden', !isAuth);
            }

            // Mettre à jour l'affichage du profil
            if (isAuth && profile) {
                const titleEl = document.getElementById('account-username-title');
                const avatarEl = document.getElementById('account-avatar');
                const entranceEl = document.getElementById('account-display-entrance');
                const aptEl = document.getElementById('account-display-apartment');
                const emailEl = document.getElementById('account-display-email');
                const roleBadge = document.getElementById('account-badge-role');

                const fullName = (profile.first_name && profile.last_name) ? `${profile.first_name} ${profile.last_name}` : (profile.username || 'Résident');

                if (titleEl) titleEl.textContent = fullName;
                if (avatarEl) avatarEl.textContent = fullName.charAt(0).toUpperCase();
                if (entranceEl) entranceEl.textContent = `${profile.entrance} avenue Division Leclerc (N° ${profile.entrance})`;
                if (aptEl) aptEl.textContent = profile.apartment || 'Non renseigné';
                if (emailEl) emailEl.textContent = profile.email || user.email || 'Non renseigné';
                if (roleBadge) {
                    roleBadge.textContent = isAdmin ? 'Administrateur Collectif' : 'Locataire Résident';
                    roleBadge.className = isAdmin ? 'status-badge badge-broken' : 'status-badge badge-functional';
                }
            }

            EventBus.emit(EVENTS.AUTH_STATE_CHANGED, { user, profile, isAdmin });
        });
    }

    _bindModalsAndActions() {
        // Modale d'incident
        const openIncidentBtn = document.getElementById('btn-open-incident-modal');
        const incidentModal = document.getElementById('incident-modal');
        if (openIncidentBtn && incidentModal) {
            openIncidentBtn.addEventListener('click', () => {
                incidentModal.classList.remove('hidden');
                incidentModal.setAttribute('aria-hidden', 'false');
            });
        }

        // Modale de signalement ascenseur
        const openReportBtn = document.getElementById('btn-open-report-modal');
        if (openReportBtn) {
            openReportBtn.addEventListener('click', () => ElevatorUI.openReportModal());
        }

        // Fermeture générique des modales
        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-backdrop').forEach(m => {
                    m.classList.add('hidden');
                    m.setAttribute('aria-hidden', 'true');
                });
            });
        });
    }

    _setupTheme() {
        const toggleBtn = document.getElementById('mobile-theme-toggle');

        const applyTheme = (theme) => {
            const finalTheme = theme === 'light' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', finalTheme);
            localStorage.setItem('cp_theme', finalTheme);

            if (toggleBtn) {
                toggleBtn.innerHTML = finalTheme === 'dark'
                    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
                    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
            }
        };

        const currentTheme = localStorage.getItem('cp_theme') || 'dark';
        applyTheme(currentTheme);

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const nowTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                applyTheme(nowTheme);
            });
        }
    }

    _setupOfflineSyncWorker() {
        window.addEventListener('online', () => {
            console.log("[Network] Connexion rétablie. Synchronisation des données...");
            EventBus.emit(EVENTS.NETWORK_ONLINE);
        });

        window.addEventListener('offline', () => {
            console.log("[Network] Mode hors-ligne activé.");
            EventBus.emit(EVENTS.NETWORK_OFFLINE);
            EventBus.emit(EVENTS.TOAST_NOTIFY, {
                title: "Mode Hors-ligne",
                message: "Les fonctionnalités de consultation et de signalement restent actives.",
                type: "warning"
            });
        });
    }

    _registerServiceWorker() {
        if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => console.log("[SW] Service Worker actif:", reg.scope))
                    .catch(err => console.warn("[SW] SW non actif en local:", err.message));
            });
        }
    }
}

// Bootstrap au chargement du DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new App();
        app.bootstrap();
    });
} else {
    const app = new App();
    app.bootstrap();
}
