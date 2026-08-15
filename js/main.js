/**
 * @fileoverview Point d'entrée principal (Main Bootstrap) de l'application Collectif Plaine.
 * Orchestre les services, initialise les contrôleurs d'interface, et enregistre le Service Worker PWA.
 */

import { Auth } from './core/auth.js';
import { Router } from './core/router.js';
import { Storage } from './core/storage.js';
import { EventBus, EVENTS } from './core/event-bus.js';
import { Elevator } from './domains/elevators/elevator.service.js';
import { ElevatorUI } from './domains/elevators/elevator.ui.js';
import { Incident } from './domains/incidents/incident.service.js';
import { IncidentUI } from './domains/incidents/incident.ui.js';
import { Petitions } from './domains/democracy/petitions.service.js';
import { Polls } from './domains/democracy/polls.service.js';
import { DemocracyUI } from './domains/democracy/democracy.ui.js';
import { WikiUI } from './domains/wiki/wiki.ui.js';
import { exportElevatorHistory } from './domains/legal/legal-generator.js';
import { sanitizeHTML, isValidUsername, isValidPassword } from './utils/security.js';
import { playSuccessSound } from './utils/audio-feedback.js';
import { CONFIG } from './config/config.js';

class App {
    constructor() {
        this.statsCharts = {};
    }

    async bootstrap() {
        console.log(`🚀 Démarrage de ${CONFIG.appName} v${CONFIG.appVersion}...`);

        // 1. Initialiser le stockage IndexedDB et l'Authentification
        await Storage.init();
        await Auth.init();

        // 2. Initialiser les contrôleurs d'interface
        ElevatorUI.init();
        IncidentUI.init();
        DemocracyUI.init();
        WikiUI.init();

        // 3. Initialiser le routeur SPA
        Router.init();

        // 4. Charger les données des domaines
        this._loadDomainData();

        // 5. Initialiser les fonctionnalités transverses
        this._bindAuthUI();
        this._bindModalsAndNavigation();
        this._setupToastManager();
        this._setupTheme();
        this._setupOfflineSyncWorker();
        this._registerServiceWorker();

        console.log("✅ Application Collectif Plaine prête.");
    }

    async _loadDomainData() {
        try {
            await Promise.allSettled([
                Elevator.loadAll(),
                Incident.loadAll(),
                Petitions.loadAll(),
                Polls.loadAll()
            ]);
        } catch (e) {
            console.warn("[App] Erreur chargement initial:", e);
        }
    }

    _setupToastManager() {
        const container = document.getElementById('toast-container');
        if (!container) return;

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
            }, 4000);
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
        const profileForm = document.getElementById('account-profile-form');
        const deleteBtn = document.getElementById('account-delete-btn');
        const headerLoginBtn = document.getElementById('admin-login-btn');
        const moreMenuStatsLink = document.getElementById('more-menu-stats-link');
        const sidebarStatsLink = document.querySelector('.menu-link[href="#/stats"]');

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
                const username = document.getElementById('account-login-username')?.value;
                const password = document.getElementById('account-login-password')?.value;
                const errBox = document.getElementById('account-auth-error');

                try {
                    await Auth.signIn(username, password);
                    playSuccessSound();
                    EventBus.emit(EVENTS.TOAST_NOTIFY, {
                        title: "Connexion réussie",
                        message: `Bienvenue, ${username} !`,
                        type: "success"
                    });
                } catch (err) {
                    if (errBox) {
                        errBox.textContent = err.message;
                        errBox.classList.remove('hidden');
                    }
                }
            });
        }

        // Soumission Inscription
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('account-register-username')?.value;
                const password = document.getElementById('account-register-password')?.value;
                const errBox = document.getElementById('account-auth-error');

                if (!isValidUsername(username)) {
                    if (errBox) {
                        errBox.textContent = "Le pseudo doit comporter de 3 à 20 caractères alphanumériques.";
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
                    await Auth.signUp({ username, password });
                    playSuccessSound();
                    EventBus.emit(EVENTS.TOAST_NOTIFY, {
                        title: "Compte créé",
                        message: "Votre compte résident a été créé avec succès !",
                        type: "success"
                    });
                } catch (err) {
                    if (errBox) {
                        errBox.textContent = err.message;
                        errBox.classList.remove('hidden');
                    }
                }
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
                Router.navigate('ascenseurs');
            });
        }

        // Mise à jour du profil
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const firstName = document.getElementById('account-firstname')?.value || '';
                const lastName = document.getElementById('account-lastname')?.value || '';
                const email = document.getElementById('account-email')?.value || '';
                const phone = document.getElementById('account-phone')?.value || '';
                const entrance = document.getElementById('account-entrance')?.value || '38';
                const apartment = document.getElementById('account-apartment')?.value || '';
                const notifs = document.getElementById('account-notifications')?.checked || false;

                const succBox = document.getElementById('account-profile-success');
                const errBox = document.getElementById('account-profile-error');

                try {
                    await Auth.updateProfile({
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        phone: phone,
                        entrance: entrance,
                        apartment: apartment,
                        notifications: notifs
                    });

                    playSuccessSound();
                    if (succBox) {
                        succBox.textContent = "Profil mis à jour avec succès !";
                        succBox.classList.remove('hidden');
                    }
                    if (errBox) errBox.classList.add('hidden');
                } catch (err) {
                    if (errBox) {
                        errBox.textContent = "Erreur lors de l'enregistrement : " + err.message;
                        errBox.classList.remove('hidden');
                    }
                }
            });
        }

        // Suppression de compte
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const modal = document.getElementById('delete-account-modal');
                if (modal) modal.classList.remove('hidden');
            });
        }

        const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', async () => {
                try {
                    await Auth.deleteAccount();
                    document.getElementById('delete-account-modal')?.classList.add('hidden');
                    alert("Votre compte et vos données personnelles ont été définitivement supprimés.");
                    Router.navigate('landing');
                } catch (err) {
                    alert("Erreur lors de la suppression : " + err.message);
                }
            });
        }

        // Réaction aux changements d'authentification
        Auth.onAuthStateChange((user, profile) => {
            const isAuth = !!user;
            const isAdmin = Auth.isAdmin();

            if (unauthSection && authSection) {
                unauthSection.classList.toggle('hidden', isAuth);
                authSection.classList.toggle('hidden', !isAuth);
            }

            // Mettre à jour les champs de profil
            if (isAuth && profile) {
                const titleEl = document.getElementById('account-username-title');
                const avatarEl = document.getElementById('account-avatar');
                const fnInput = document.getElementById('account-firstname');
                const lnInput = document.getElementById('account-lastname');
                const emailInput = document.getElementById('account-email');
                const phoneInput = document.getElementById('account-phone');
                const entSelect = document.getElementById('account-entrance');
                const aptInput = document.getElementById('account-apartment');
                const notifInput = document.getElementById('account-notifications');

                if (titleEl) titleEl.textContent = profile.username || 'Résident';
                if (avatarEl) avatarEl.textContent = (profile.username || 'R').charAt(0).toUpperCase();
                if (fnInput) fnInput.value = profile.first_name || '';
                if (lnInput) lnInput.value = profile.last_name || '';
                if (emailInput) emailInput.value = profile.email || '';
                if (phoneInput) phoneInput.value = profile.phone || '';
                if (entSelect && profile.entrance) entSelect.value = profile.entrance;
                if (aptInput) aptInput.value = profile.apartment || '';
                if (notifInput) notifInput.checked = !!profile.notifications;
            }

            // Visibilité du lien Admin Stats
            if (moreMenuStatsLink) moreMenuStatsLink.classList.toggle('hidden', !isAdmin);
            if (sidebarStatsLink) sidebarStatsLink.classList.toggle('hidden', !isAdmin);

            // Bouton En-tête
            if (headerLoginBtn) {
                if (isAuth) {
                    headerLoginBtn.textContent = `👤 ${profile?.username || 'Compte'}`;
                    headerLoginBtn.onclick = () => Router.navigate('compte');
                } else {
                    headerLoginBtn.textContent = "Connexion";
                    headerLoginBtn.onclick = () => Router.navigate('compte');
                }
            }

            EventBus.emit(EVENTS.AUTH_STATE_CHANGED, { user, profile, isAdmin });
        });
    }

    _bindModalsAndNavigation() {
        // Menu "Plus" flottant Mobile
        const moreBtn = document.getElementById('mobile-more-btn');
        const moreMenu = document.getElementById('mobile-more-menu');
        const closeMoreBtn = document.getElementById('btn-close-more-menu');

        if (moreBtn && moreMenu) {
            moreBtn.addEventListener('click', () => moreMenu.classList.toggle('hidden'));
        }
        if (closeMoreBtn && moreMenu) {
            closeMoreBtn.addEventListener('click', () => moreMenu.classList.add('hidden'));
        }

        // Fermer le menu au clic sur un lien interne
        document.querySelectorAll('.more-menu-item').forEach(link => {
            link.addEventListener('click', () => {
                if (moreMenu) moreMenu.classList.add('hidden');
            });
        });

        // Modale À Propos & RGPD
        const aboutBtn = document.getElementById('btn-open-about');
        const aboutModal = document.getElementById('about-modal');
        const rgpdBtn = document.getElementById('btn-open-rgpd');
        const rgpdModal = document.getElementById('rgpd-modal');

        if (aboutBtn && aboutModal) {
            aboutBtn.addEventListener('click', () => aboutModal.classList.remove('hidden'));
        }
        if (rgpdBtn && rgpdModal) {
            rgpdBtn.addEventListener('click', () => rgpdModal.classList.remove('hidden'));
        }

        // Export PDF Historique Ascenseur
        const exportHistoryBtn = document.getElementById('btn-export-history');
        if (exportHistoryBtn) {
            exportHistoryBtn.addEventListener('click', () => {
                const entranceId = ElevatorUI.selectedEntranceId;
                if (!entranceId) return;
                const el = Elevator.getById(entranceId);
                if (el) {
                    exportElevatorHistory(el);
                }
            });
        }

        // Écouter le changement de route pour rafraîchir les graphiques stats si nécessaire
        EventBus.on(EVENTS.ROUTE_CHANGED, ({ route }) => {
            if (route === 'stats') {
                this._renderAdminStats();
            }
        });
    }

    _renderAdminStats() {
        if (!Auth.isAdmin() || typeof window.Chart === 'undefined') return;

        const elevators = Elevator.getAll();
        const total = elevators.length;
        const broken = elevators.filter(e => e.status === 'en_panne').length;
        const totalDowntimeHours = elevators.reduce((acc, e) => acc + (e.downtimeHours || 0), 0);

        // KPIs
        const kpiAvail = document.getElementById('kpi-availability');
        const kpiBreakdowns = document.getElementById('kpi-breakdowns');
        const kpiResTime = document.getElementById('kpi-resolution-time');
        const kpiActiveReports = document.getElementById('kpi-active-reports');

        if (kpiAvail) {
            const totalPossibleHours = total * 30 * 24;
            const rate = Math.max(0, 100 * (1 - (totalDowntimeHours / totalPossibleHours))).toFixed(1);
            kpiAvail.textContent = `${rate}%`;
        }

        if (kpiBreakdowns) kpiBreakdowns.textContent = String(broken);
        if (kpiResTime) kpiResTime.textContent = "4.2h";
        if (kpiActiveReports) {
            const activeRep = elevators.reduce((acc, e) => acc + (e.reports?.length || 0), 0);
            kpiActiveReports.textContent = String(activeRep);
        }

        // Graphique Top 5 Ascenseurs en panne
        const canvasElevators = document.getElementById('stats-chart-elevators');
        if (canvasElevators) {
            if (this.statsCharts.elevators) this.statsCharts.elevators.destroy();

            const top5 = [...elevators].sort((a, b) => (b.downtimeHours || 0) - (a.downtimeHours || 0)).slice(0, 5);

            this.statsCharts.elevators = new window.Chart(canvasElevators.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: top5.map(e => `N° ${e.id}`),
                    datasets: [{
                        label: "Heures d'arrêt cumulées",
                        data: top5.map(e => e.downtimeHours || 0),
                        backgroundColor: '#ef4444',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }
    }

    _setupTheme() {
        const lightBtn = document.getElementById('theme-btn-light');
        const darkBtn = document.getElementById('theme-btn-dark');

        const savedTheme = localStorage.getItem('cp_theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);

        if (lightBtn && darkBtn) {
            lightBtn.addEventListener('click', () => {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('cp_theme', 'light');
            });

            darkBtn.addEventListener('click', () => {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('cp_theme', 'dark');
            });
        }
    }

    _setupOfflineSyncWorker() {
        window.addEventListener('online', () => {
            console.log("🌐 Connexion rétablie. Synchronisation des données hors-ligne...");
            EventBus.emit(EVENTS.NETWORK_ONLINE);
            this._drainSyncQueue();
        });

        window.addEventListener('offline', () => {
            console.log("📴 Mode hors-ligne activé.");
            EventBus.emit(EVENTS.NETWORK_OFFLINE);
            EventBus.emit(EVENTS.TOAST_NOTIFY, {
                title: "Mode Hors-Ligne",
                message: "Vos actions seront enregistrées localement et synchronisées dès le retour du réseau.",
                type: "info"
            });
        });

        setInterval(() => {
            if (navigator.onLine) this._drainSyncQueue();
        }, CONFIG.syncIntervalMs);
    }

    async _drainSyncQueue() {
        const queue = await Storage.getSyncQueue();
        if (!queue || queue.length === 0) return;

        console.log(`🔄 Traitement de ${queue.length} opération(s) en attente...`);

        for (const item of queue) {
            try {
                if (item.action === 'CREATE_REPORT') {
                    await Elevator.submitReport({
                        entrance: item.payload.entrance,
                        type: item.payload.type,
                        description: item.payload.description,
                        user: item.payload.user
                    });
                } else if (item.action === 'CREATE_INCIDENT') {
                    await Incident.createIncident({
                        category: item.payload.category,
                        entrance: item.payload.entrance,
                        description: item.payload.description
                    });
                } else if (item.action === 'UPDATE_STATUS') {
                    await Elevator.updateStatus(
                        item.payload.entrance,
                        item.payload.status,
                        item.payload.notes
                    );
                }

                await Storage.removeFromSyncQueue(item.id);
            } catch (err) {
                console.warn("[SyncWorker] Échec synchronisation de l'élément:", item, err);
            }
        }
    }

    _registerServiceWorker() {
        if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log("🛡️ Service Worker actif (PWA)", reg.scope))
                    .catch(err => console.warn("Service Worker non enregistré:", err));
            });
        }
    }
}

// Démarrage automatique au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.bootstrap();
});
