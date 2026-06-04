/**
 * Suivi pannes ascenseurs - Contrôleur d'interface utilisateur (UI)
 * Orchestre les événements, manipule le DOM de manière sécurisée et gère les modales.
 */
document.addEventListener("DOMContentLoaded", () => {
    // ---------------------------------------------------------
    // 1. CACHE DES ELEMENTS DU DOM
    // ---------------------------------------------------------
    
    // Éléments Globaux
    const adminBanner = document.getElementById("admin-banner");
    
    // Onglet Mon Compte
    const tabCompte = document.getElementById("tab-compte");
    const accountUnauthSection = document.getElementById("account-unauthenticated-section");
    const accountAuthSection = document.getElementById("account-authenticated-section");
    
    const accountLoginForm = document.getElementById("account-login-form");
    const accountRegisterForm = document.getElementById("account-register-form");
    const accountTabLogin = document.getElementById("account-tab-login");
    const accountTabRegister = document.getElementById("account-tab-register");
    const accountAuthError = document.getElementById("account-auth-error");
    const accountAuthSuccess = document.getElementById("account-auth-success");

    const accountProfileForm = document.getElementById("account-profile-form");
    const accountProfileError = document.getElementById("account-profile-error");
    const accountProfileSuccess = document.getElementById("account-profile-success");
    const accountLogoutBtn = document.getElementById("account-logout-btn");
    const accountDeleteBtn = document.getElementById("account-delete-btn");
    const deleteAccountModal = document.getElementById("delete-account-modal");
    const btnConfirmDelete = document.getElementById("btn-confirm-delete");
    const btnOpenAbout = document.getElementById("btn-open-about");
    const aboutModal = document.getElementById("about-modal");
    const btnOpenRgpd = document.getElementById("btn-open-rgpd");
    const rgpdModal = document.getElementById("rgpd-modal");
    const entrancesGrid = document.getElementById("entrances-grid");
    
    // Stats Widgets
    const statFunctional = document.getElementById("stat-functional");
    const statMaintenance = document.getElementById("stat-maintenance");
    const statBroken = document.getElementById("stat-broken");
    const statDowntime = document.getElementById("stat-downtime");
    
    // Boutons d'actions principaux
    const quickReportBtn = document.getElementById("quick-report-btn");
    
    // Modale : Signalement
    const reportModal = document.getElementById("report-modal");
    const reportForm = document.getElementById("report-form");
    const reportEntranceSelect = document.getElementById("report-entrance");
    const reportDescriptionText = document.getElementById("report-desc");
    const charCountSpan = document.getElementById("char-count");
    const reportErrorMsg = document.getElementById("report-error-msg");
    const reportSuccessMsg = document.getElementById("report-success-msg");
    
    // Modale : Détails
    const detailsModal = document.getElementById("details-modal");
    const detailsEntranceNum = document.getElementById("details-entrance-num");
    const detailsStatusBox = document.getElementById("details-status-box");
    const detailsStatusBadge = document.getElementById("details-status-badge");
    const detailsStatusText = document.getElementById("details-status-text");
    const detailsLastChange = document.getElementById("details-last-change");
    const detailsDowntime = document.getElementById("details-downtime");
    const maintenanceInfoBox = document.getElementById("maintenance-info-box");
    const maintenanceDetails = document.getElementById("maintenance-details");
    const tenantReportsList = document.getElementById("tenant-reports-list");
    const historyTimeline = document.getElementById("history-timeline");
    
    // Modale : Détails - Section Actions
    const adminActionsSection = document.getElementById("admin-actions-section");
    const adminStatusForm = document.getElementById("admin-status-form");
    const adminEntranceIdInput = document.getElementById("admin-entrance-id");
    const adminSelectStatus = document.getElementById("admin-select-status");
    const adminMaintenanceNotes = document.getElementById("admin-maintenance-notes");
    
    const quickIncidentBtn = document.getElementById("quick-incident-btn");
    
    const incidentModal = document.getElementById("incident-modal");
    const incidentForm = document.getElementById("incident-form");
    const incidentErrorMsg = document.getElementById("incident-error-msg");
    const incidentSuccessMsg = document.getElementById("incident-success-msg");
    const incidentsFeed = document.getElementById("incidents-feed");

    
    // Formulaire Signalement - Éléments Photo
    const reportPhotoInput = document.getElementById("report-photo");
    const photoPreviewContainer = document.getElementById("report-photo-preview-container");
    const photoPreviewImg = document.getElementById("report-photo-preview");
    const btnRemovePhoto = document.getElementById("btn-remove-photo");

    // Modale Zoom Photo (Lightbox)
    const lightboxModal = document.getElementById("lightbox-modal");
    const lightboxImg = document.getElementById("lightbox-img");
    const lightboxCaption = document.getElementById("lightbox-caption");
    const btnCloseLightbox = document.getElementById("btn-close-lightbox");

    // Centre de Notifications (Cloche)
    const notificationBellBtn = document.getElementById("notification-bell-btn");
    const notificationBadge = document.getElementById("notification-badge");
    const notificationDropdown = document.getElementById("notification-dropdown");
    const btnClearNotifications = document.getElementById("btn-clear-notifications");
    const notificationList = document.getElementById("notification-list");
    const toastContainer = document.getElementById("toast-container");

    // Boutons de fermeture de modales
    const closeModalButtons = document.querySelectorAll(".btn-close-modal");

    // Variable pour suivre l'entrée actuellement sélectionnée dans la modale détails
    let activeDetailsEntranceId = null;
    let selectedPhotoData = null; // Stocke la photo compressée et horodatée (Base64 dataURL)
    let notificationsList = []; // Historique de session des alertes reçues
    let realtimeChannel = null; // Référence de connexion realtime

    // ---------------------------------------------------------
    // 2. UTILITAIRES DE FORMATTAGE (AFFICHAGE)
    // ---------------------------------------------------------

    /**
     * Calcule le temps écoulé depuis un timestamp pour un rendu lisible en français
     */
    function formatTimeAgo(timestamp) {
        if (!timestamp) return "indéterminé";
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / (60 * 1000));
        const hours = Math.floor(diff / (60 * 60 * 1000));
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));

        if (mins < 1) return "à l'instant";
        if (mins < 60) return `il y a ${mins} min`;
        if (hours < 24) return `il y a ${hours} h`;
        return `il y a ${days} jour${days > 1 ? 's' : ''}`;
    }

    /**
     * Traduit le type de panne en libellé convivial
     */
    function formatIssueType(type) {
        const types = {
            "arrêt": "Arrêt complet",
            "portes": "Problème de portes",
            "boutons": "Boutons inactifs",
            "bruit": "Bruit ou vibration",
            "autre": "Autre problème"
        };
        return types[type] || type;
    }

    /**
     * Traduit le statut interne en libellé d'affichage
     */
    function formatStatusLabel(status) {
        const labels = {
            "en_service": "En Service",
            "en_maintenance": "En Maintenance",
            "en_panne": "En Panne"
        };
        return labels[status] || status;
    }

    // ---------------------------------------------------------
    // 3. LOGIQUE D'AFFICHAGE DU THEME (CLAIR/SOMBRE)
    // ---------------------------------------------------------

    function initTheme() {
        document.documentElement.setAttribute("data-theme", "dark");
    }

    // ---------------------------------------------------------
    // 4. RENDU DYNAMIQUE DE L'INTERFACE PRINCIPALE
    // ---------------------------------------------------------

    /**
     * Met à jour le tableau de bord : les statistiques et la grille d'ascenseurs
     */
    function renderDashboard() {
        const elevators = Store.getElevators();
        const stats = Store.getStats();
        const tenant = Security.getLoggedInTenant();

        // 1. Remplissage des statistiques
        statFunctional.textContent = stats.en_service;
        statMaintenance.textContent = stats.en_maintenance;
        statBroken.textContent = stats.en_panne;
        statDowntime.textContent = stats.total_downtime ? `${stats.total_downtime} j` : "0 j";

        // 2. Nettoyage de la grille
        entrancesGrid.innerHTML = "";

        if (elevators.length === 0) {
            entrancesGrid.innerHTML = `<div class="loading-placeholder">Aucune entrée configurée.</div>`;
            return;
        }

        // 3. Rendu de chaque ascenseur
        elevators.forEach(elevator => {
            const card = document.createElement("div");
            card.className = "elevator-card glass";
            card.setAttribute("role", "button");
            card.setAttribute("aria-label", `Ascenseur entrée ${elevator.id}, statut actuel : ${formatStatusLabel(elevator.status)}`);
            card.dataset.id = elevator.id;

            // Déterminer la classe de badge de statut correspondante
            let badgeClass = "badge-functional";
            let statusText = "En Service";
            
            if (elevator.status === "en_maintenance") {
                badgeClass = "badge-maintenance";
                statusText = "Maintenance";
            } else if (elevator.status === "en_panne") {
                badgeClass = "badge-broken";
                statusText = "En Panne";
            }

            // Nombre de signalements actifs des locataires
            const reportCount = elevator.tenantReports.length;
            let statusSummaryHtml = "";

            if (elevator.status === "en_panne") {
                statusSummaryHtml = `
                    <div class="card-summary-msg color-danger"><span class="status-indicator-dot bg-danger"></span>Ascenseur à l'arrêt</div>
                    <div class="card-summary-desc">${elevator.maintenanceNotes || "Panne en cours de diagnostic."}</div>
                `;
            } else if (elevator.status === "en_maintenance") {
                statusSummaryHtml = `
                    <div class="card-summary-msg color-warning"><span class="status-indicator-dot bg-warning"></span>Travaux en cours</div>
                    <div class="card-summary-desc">${elevator.maintenanceNotes || "Opération de maintenance périodique."}</div>
                `;
            } else {
                // En service
                if (reportCount > 0) {
                    statusSummaryHtml = `
                        <div class="card-summary-msg color-warning"><span class="status-indicator-dot bg-warning"></span>Dysfonctionnements signalés</div>
                        <div class="card-summary-desc">${reportCount} signalement${reportCount > 1 ? 's' : ''} actif${reportCount > 1 ? 's' : ''}.</div>
                    `;
                } else {
                    statusSummaryHtml = `
                        <div class="card-summary-msg color-success"><span class="status-indicator-dot bg-success"></span>Fonctionnement normal</div>
                        <div class="card-summary-desc">Aucun incident signalé récemment.</div>
                    `;
                }
            }

            // Génération du badge de signalement (si applicable)
            const reportBadgeHtml = (reportCount > 0 && elevator.status !== "en_panne") 
                ? `<div class="report-counter-tag">${reportCount} signalement${reportCount > 1 ? 's' : ''}</div>` 
                : "";

            // Structure interne de la carte
            card.innerHTML = `
                <div class="card-header">
                    <div class="entrance-label">
                        <span class="title">N° ${elevator.id}</span>
                        <span class="road">Avenue Division Leclerc</span>
                    </div>
                    <span class="status-badge ${badgeClass}">${statusText}</span>
                </div>
                <div class="card-content">
                    ${statusSummaryHtml}
                    ${reportBadgeHtml}
                </div>
                <div class="card-actions">
                    <button class="btn btn-secondary btn-view-details" data-id="${elevator.id}">
                        Historique
                    </button>
                    <button class="btn btn-report btn-report-card" data-id="${elevator.id}">
                        Signaler
                    </button>
                </div>
            `;

            // Ajout au DOM
            entrancesGrid.appendChild(card);

            // Événement clic sur la carte globale (ouvre les détails par défaut)
            card.addEventListener("click", (e) => {
                // Empêcher l'ouverture si on clique sur un bouton spécifique à l'intérieur
                if (e.target.closest("button")) return;
                openDetailsModal(elevator.id);
            });
        });

        document.querySelectorAll(".btn-report-card").forEach(btn => {
            btn.addEventListener("click", () => {
                openReportModal(btn.dataset.id);
            });
        });

        document.querySelectorAll(".btn-view-details").forEach(btn => {
            btn.addEventListener("click", () => {
                openDetailsModal(btn.dataset.id);
            });
        });

        renderIncidents();
    }

    /**
     * Rendu des Incidents
     */
    function renderIncidents() {
        if (!incidentsFeed) return;
        const incidents = Store.getIncidents();
        incidentsFeed.innerHTML = "";

        if (incidents.length === 0) {
            incidentsFeed.innerHTML = `<div class="loading-placeholder">Aucun incident signalé pour le moment.</div>`;
            return;
        }

                const categoryIcons = {
            "porte": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="icon-inline" style="margin-right:6px; vertical-align:middle; color:var(--accent-primary);"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M9 3v18"/><circle cx="14" cy="12" r="1"/></svg>`,
            "vigik": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="icon-inline" style="margin-right:6px; vertical-align:middle; color:var(--accent-primary);"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3M17 6l3 3"/></svg>`,
            "proprete": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="icon-inline" style="margin-right:6px; vertical-align:middle; color:var(--accent-primary);"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
            "chauffage": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="icon-inline" style="margin-right:6px; vertical-align:middle; color:var(--accent-primary);"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`,
            "eclairage": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="icon-inline" style="margin-right:6px; vertical-align:middle; color:var(--accent-primary);"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A7 7 0 0 0 4 8c0 1 .5 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
            "securite": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="icon-inline" style="margin-right:6px; vertical-align:middle; color:var(--color-danger);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
            "autre": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="icon-inline" style="margin-right:6px; vertical-align:middle; color:var(--text-muted);"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
        };

        incidents.forEach(incident => {
            const el = document.createElement("div");
            el.className = "report-item";
            
            const badgeClass = incident.status === 'resolu' ? 'badge-functional' : 'badge-broken';
            const badgeText = incident.status === 'resolu' ? 'Résolu' : 'En cours';

            el.innerHTML = `
                <div class="report-header">
                    <div class="report-meta">
                        <strong>${categoryIcons[incident.category] || `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" class="icon-inline"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`} ${incident.entrance !== 'tous' ? 'Bâtiment ' + incident.entrance : 'Espaces Communs'}</strong>
                        <span class="report-author"></span>
                    </div>
                    <span class="report-time">${formatTimeAgo(new Date(incident.created_at).getTime())}</span>
                </div>
                <div class="report-content">
                    <p></p>
                </div>
                ${incident.photo_url ? `<div class="report-photo-thumb" style="background-image: url('${incident.photo_url}'); cursor:pointer;" onclick="window.openLightbox('${incident.photo_url}')" title="Agrandir la photo"></div>` : ""}
                <div style="margin-top:0.75rem; display:flex; justify-content:space-between; align-items:center;">
                    <span class="status-badge ${badgeClass}" style="font-size:0.7rem; padding:2px 6px;">${badgeText}</span>
                </div>
            `;
            el.querySelector(".report-author").textContent = incident.user_display;
            el.querySelector(".report-content p").textContent = incident.description;
            incidentsFeed.appendChild(el);
        });
    }


    // Export pour le onclick depuis le DOM HTML sur les images d'incident
    window.openLightbox = (url) => {
        if (!lightboxImg) return;
        lightboxImg.src = url;
        lightboxModal.classList.remove("hidden");
        lightboxModal.setAttribute("aria-hidden", "false");
    };

    // ---------------------------------------------------------
    // 5. GESTION DES MODALES (OUVERTURE & FERMETURE)
    // ---------------------------------------------------------

    function openModal(modalElement) {
        modalElement.classList.remove("hidden");
        modalElement.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden"; // Empêcher le scroll sous-jacent
        
        // Focus sur le premier élément interactif ou de fermeture pour l'accessibilité
        const focusable = modalElement.querySelector("input, select, textarea, button, [tabindex]");
        if (focusable) focusable.focus();
    }

    function closeModal(modalElement) {
        modalElement.classList.add("hidden");
        modalElement.setAttribute("aria-hidden", "true");
        document.body.style.overflow = ""; // Rétablir le scroll
        
        // Vider les messages d'erreur et succès éventuels
        const errorMsg = modalElement.querySelector(".alert-box.alert-danger");
        const successMsg = modalElement.querySelector(".alert-box.alert-success");
        if (errorMsg) errorMsg.classList.add("hidden");
        if (successMsg) successMsg.classList.add("hidden");
    }

    // Associer la fermeture globale pour tous les boutons `.btn-close-modal`
    closeModalButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const modal = e.target.closest(".modal-backdrop");
            if (modal) closeModal(modal);
        });
    });

    // Clic sur l'arrière-plan d'une modale pour la fermer
    document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) {
                closeModal(backdrop);
            }
        });
    });

    // Touche Echap pour fermer les modales ouvertes
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const openModalElement = document.querySelector(".modal-backdrop:not(.hidden)");
            if (openModalElement) {
                closeModal(openModalElement);
            }
        }
    });

    // ---------------------------------------------------------
    // HANDELEURS DE PHOTOS ET LIGHTBOX (HORODATAGE & SÉCURITÉ)
    // ---------------------------------------------------------

    function resetPhotoUpload() {
        selectedPhotoData = null;
        reportPhotoInput.value = "";
        photoPreviewImg.src = "";
        photoPreviewContainer.classList.add("hidden");
    }

    function processAndTimestampPhoto(file) {
        const validation = Security.validateImageFile(file);
        if (!validation.isValid) {
            showReportError(validation.error);
            resetPhotoUpload();
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                // Redimensionnement proportionnel intelligent (max 1024px)
                const maxDim = 1024;
                let width = img.width;
                let height = img.height;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");

                ctx.drawImage(img, 0, 0, width, height);

                // Incrustation de la barre d'horodatage indélébile
                const barHeight = Math.max(32, Math.round(height * 0.06));
                ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
                ctx.fillRect(0, height - barHeight, width, barHeight);

                // Texte de l'horodatage
                const fontSize = Math.max(11, Math.round(barHeight * 0.4));
                ctx.font = `600 ${fontSize}px 'Inter', system-ui, -apple-system, sans-serif`;
                ctx.fillStyle = "#ffffff";
                
                // Timestamp à droite
                ctx.textAlign = "right";
                ctx.textBaseline = "middle";
                const dateStr = new Date().toLocaleString("fr-FR", {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
                ctx.fillText(`Collectif Plaine • ${dateStr}`, width - Math.max(10, Math.round(width * 0.02)), height - (barHeight / 2));

                // Signature à gauche
                ctx.textAlign = "left";
                ctx.fillStyle = "#a78bfa"; // Couleur violette douce
                ctx.fillText("📷 PREUVE CERTIFIÉE", Math.max(10, Math.round(width * 0.02)), height - (barHeight / 2));

                // Compression JPEG (0.75) pour réduire la taille en localStorage
                selectedPhotoData = canvas.toDataURL("image/jpeg", 0.75);

                // Aperçu
                photoPreviewImg.src = selectedPhotoData;
                photoPreviewContainer.classList.remove("hidden");
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function openLightbox(src, caption) {
        lightboxImg.src = src;
        lightboxCaption.textContent = caption;
        openModal(lightboxModal);
    }

    // Abonnements événementiels photos
    reportPhotoInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
            processAndTimestampPhoto(e.target.files[0]);
        }
    });

    btnRemovePhoto.addEventListener("click", () => {
        resetPhotoUpload();
    });

    btnCloseLightbox.addEventListener("click", () => {
        closeModal(lightboxModal);
        lightboxImg.src = "";
        lightboxCaption.textContent = "";
    });

    // ---------------------------------------------------------
    // SYSTEME DE NOTIFICATIONS TEMPS REEL (SUPABASE REALTIME & TOASTS)
    // ---------------------------------------------------------

    function requestDesktopNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log(`Permission de notification système : ${permission}`);
            });
        }
    }

    function subscribeToRealtimeNotifications() {
        // Se désabonner d'abord si un canal est actif
        unsubscribeFromRealtimeNotifications();

        const tenant = Security.getLoggedInTenant();
        if (!tenant) return;

        console.log(`[Realtime] Abonnement aux alertes et mises à jour de pannes...`);

        realtimeChannel = supabase
            .channel('public:db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, async payload => {
                console.log("[Realtime] Signalement modifié :", payload);
                
                // Si c'est un nouveau rapport pour l'entrée du locataire, on affiche une alerte
                if (payload.eventType === 'INSERT' && String(payload.new.entrance) === String(tenant.entrance)) {
                    triggerNotification(payload.new);
                }
                
                // Rafraîchir l'état global pour mettre à jour les tuiles (statistiques, badges)
                await Store.init();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'elevators' }, async payload => {
                console.log("[Realtime] Statut d'ascenseur modifié :", payload);
                // Rafraîchir l'état global
                await Store.init();
            })
            .subscribe((status) => {
                console.log(`[Realtime] Statut d'abonnement : ${status}`);
            });
    }

    function unsubscribeFromRealtimeNotifications() {
        if (realtimeChannel) {
            console.log("[Realtime] Désabonnement du canal temps réel...");
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
    }

    function triggerNotification(report) {
        const notifId = report.id;
        
        // 1. Ajouter l'alerte à l'historique local
        const newNotif = {
            id: notifId,
            type: report.type,
            description: report.description,
            entrance: report.entrance,
            user: report.user_display,
            timestamp: Date.now(),
            unread: true
        };
        
        notificationsList.unshift(newNotif);
        renderNotificationsList();

        // 2. Émettre un signal sonore de notification douce synthétisé par le Web Audio API
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // Note Ré5 (alerte douce)
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.35);
            osc.stop(audioCtx.currentTime + 0.4);
        } catch (e) {
            console.warn("L'alerte sonore n'a pas pu être jouée", e);
        }

        // 3. Déclencher le Toast In-App
        showInAppToast(report);

        // 4. Déclencher la notification système (Bureau) si l'application est en arrière-plan
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
            try {
                new Notification(`Collectif Plaine - Alerte Entrée ${report.entrance}`, {
                    body: `Un incident de type "${formatIssueType(report.type)}" a été signalé par un voisin : ${report.description}`,
                    tag: notifId,
                    requireInteraction: false
                });
            } catch (err) {
                console.error("Erreur d'envoi de la notification système", err);
            }
        }
    }

    function showInAppToast(report) {
        const toast = document.createElement("div");
        toast.className = "toast-alert";
        toast.setAttribute("role", "alert");
        toast.innerHTML = `
            <div class="toast-icon" style="color:var(--color-danger);"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div class="toast-content" style="cursor: pointer;">
                <div class="toast-title">Alerte Entrée ${report.entrance}</div>
                <div class="toast-body">Nouveau signalement "<strong>${formatIssueType(report.type)}</strong>" par un voisin. Cliquez pour voir.</div>
            </div>
            <button class="toast-close" aria-label="Fermer la notification">&times;</button>
        `;

        // Le clic sur le corps du Toast ouvre directement les détails de la panne
        toast.querySelector(".toast-content").addEventListener("click", () => {
            openDetailsModal(report.entrance);
            toast.remove();
        });

        // Clic sur la fermeture
        toast.querySelector(".toast-close").addEventListener("click", (e) => {
            e.stopPropagation();
            // Animation de sortie
            toast.style.opacity = "0";
            toast.style.transform = "translateX(50px)";
            setTimeout(() => {
                toast.remove();
            }, 300);
        });

        toastContainer.appendChild(toast);

        // Disparition automatique après 7 secondes
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = "0";
                toast.style.transform = "translateX(50px)";
                setTimeout(() => {
                    if (toast.parentNode) toast.remove();
                }, 300);
            }
        }, 7000);
    }

    function renderNotificationsList() {
        if (!notificationList) return;
        notificationList.innerHTML = "";
        
        const unreadCount = notificationsList.filter(n => n.unread).length;
        
        // Mettre à jour le badge de la cloche
        if (notificationBadge) {
            if (unreadCount > 0) {
                notificationBadge.textContent = unreadCount;
                notificationBadge.classList.remove("hidden");
            } else {
                notificationBadge.classList.add("hidden");
            }
        }

        if (notificationsList.length === 0) {
            notificationList.innerHTML = `<div class="notification-empty">Aucune alerte active</div>`;
            return;
        }

        notificationsList.forEach(notif => {
            const item = document.createElement("div");
            item.className = `notification-item ${notif.unread ? 'unread' : ''}`;
            item.innerHTML = `
                <div class="notification-item-icon" style="color:var(--color-danger);"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
                <div class="notification-item-content">
                    <div class="notification-item-title">Alerte Entrée ${notif.entrance}</div>
                    <div class="notification-item-desc">Signalement de type "<strong>${formatIssueType(notif.type)}</strong>" : ${notif.description}</div>
                    <span class="notification-item-time">${formatTimeAgo(notif.timestamp)} • Par ${notif.user}</span>
                </div>
            `;

            // Clic sur une alerte : la marque comme lue et ouvre les détails de l'ascenseur
            item.addEventListener("click", () => {
                notif.unread = false;
                openDetailsModal(notif.entrance);
                renderNotificationsList();
                if (notificationDropdown) {
                    notificationDropdown.classList.add("hidden");
                    notificationDropdown.setAttribute("aria-hidden", "true");
                }
            });

            notificationList.appendChild(item);
        });
    }

    // ---------------------------------------------------------
    // MODALE : SIGNALEMENT DE PANNE
    // ---------------------------------------------------------

    function openReportModal(entranceId = "") {
        const tenant = Security.getLoggedInTenant();
        if (!tenant) {
            window.location.hash = "#/compte";
            setTimeout(() => {
                if (accountAuthError) {
                    accountAuthError.textContent = "ℹ️ Veuillez vous connecter ou créer un compte résident pour pouvoir signaler une panne.";
                    accountAuthError.classList.remove("hidden");
                }
            }, 100);
            return;
        }

        reportForm.reset();
        resetPhotoUpload();
        charCountSpan.textContent = "0";
        
        const reportUserField = document.getElementById("report-user");
        if (reportUserField) {
            reportUserField.value = tenant.username;
            reportUserField.disabled = true;
        }

        if (entranceId) {
            reportEntranceSelect.value = entranceId;
        } else {
            reportEntranceSelect.value = tenant.entrance;
        }
        
        reportErrorMsg.classList.add("hidden");
        reportSuccessMsg.classList.add("hidden");
        openModal(reportModal);
    }

    // Gestion du compteur de caractères temps réel
    reportDescriptionText.addEventListener("input", () => {
        const len = reportDescriptionText.value.length;
        charCountSpan.textContent = len;
        
        if (len >= 250) {
            charCountSpan.classList.add("color-danger");
        } else {
            charCountSpan.classList.remove("color-danger");
        }
    });

    // Événement clic pour le bouton global de signalement
    quickReportBtn.addEventListener("click", () => {
        openReportModal();
    });

    // Traitement du formulaire de signalement
    reportForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        reportErrorMsg.classList.add("hidden");
        reportSuccessMsg.classList.add("hidden");

        const entrance = reportEntranceSelect.value;
        const type = document.getElementById("report-type").value;
        const description = reportDescriptionText.value;
        
        // 1. Validation de premier niveau (côté client UX)
        if (!entrance) {
            showReportError("Veuillez sélectionner le numéro d'entrée concerné.");
            return;
        }
        if (!type) {
            showReportError("Veuillez sélectionner le type de problème constaté.");
            return;
        }
        if (description.trim().length < 10) {
            showReportError("La description du problème doit faire au moins 10 caractères.");
            return;
        }

        // 2. Contrôle anti-spam (Rate Limiting)
        const limiter = Security.checkRateLimit();
        if (limiter.limited) {
            showReportError(`Trop de signalements consécutifs. Par sécurité contre le spam, veuillez patienter ${limiter.secondsToWait} secondes avant de soumettre un nouveau signalement.`);
            return;
        }

        // 3. Soumission au store
        try {
            // Affichage d'un indicateur de chargement sur le bouton
            const submitBtn = reportForm.querySelector("button[type='submit']");
            const originalText = submitBtn.textContent;
            submitBtn.textContent = "Téléversement en cours...";
            submitBtn.disabled = true;

            // Le pseudo de l'auteur est récupéré de manière sécurisée côté Store pour éviter toute usurpation
            await Store.addReport(entrance, { type, description, photo: selectedPhotoData });
            
            // Affichage succès
            reportSuccessMsg.textContent = "Votre signalement a été enregistré avec succès. Merci pour votre aide !";
            reportSuccessMsg.classList.remove("hidden");
            
            // Réinitialiser le formulaire photo
            resetPhotoUpload();
            
            // Rafraîchir l'affichage local
            renderDashboard();

            setTimeout(() => {
                closeModal(reportModal);
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }, 1800);
            
        } catch (err) {
            showReportError("Une erreur est survenue lors de l'enregistrement : " + err.message);
            const submitBtn = reportForm.querySelector("button[type='submit']");
            submitBtn.disabled = false;
        }
    });

    function showReportError(msg) {
        reportErrorMsg.textContent = msg;
        reportErrorMsg.classList.remove("hidden");
        reportErrorMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // Nouveaux boutons pour ouvrir les modales
    if (quickIncidentBtn) {
        quickIncidentBtn.addEventListener("click", () => {
            if (!Security.getLoggedInTenant()) {
                window.location.hash = "#/compte";
                setTimeout(() => {
                    if (accountAuthError) {
                        accountAuthError.textContent = "ℹ️ Veuillez vous connecter ou créer un compte résident pour pouvoir signaler un incident.";
                        accountAuthError.classList.remove("hidden");
                    }
                }, 100);
                return;
            }
            incidentModal.classList.remove("hidden");
            incidentModal.setAttribute("aria-hidden", "false");
            incidentForm.reset();
            
            // Choisir le bâtiment du résident par défaut
            const tenant = Security.getLoggedInTenant();
            if (tenant && tenant.entrance) {
                document.getElementById("incident-entrance").value = tenant.entrance;
            }
            
            incidentErrorMsg.classList.add("hidden");
            incidentSuccessMsg.classList.add("hidden");
        });
    }


    // Soumission Formulaire Incident
    if (incidentForm) {
        incidentForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            incidentErrorMsg.classList.add("hidden");
            incidentSuccessMsg.classList.add("hidden");

            const category = document.getElementById("incident-category").value;
            const entrance = document.getElementById("incident-entrance").value;
            const description = document.getElementById("incident-description").value;

            const submitBtn = incidentForm.querySelector("button[type='submit']");
            submitBtn.disabled = true;

            try {
                await Store.addIncident({
                    category,
                    entrance,
                    description,
                    photo: null // Simplification: no photo for general incidents yet
                });
                
                incidentSuccessMsg.textContent = "Incident signalé avec succès.";
                incidentSuccessMsg.classList.remove("hidden");
                
                setTimeout(() => {
                    closeModal(incidentModal);
                    submitBtn.disabled = false;
                }, 1500);
            } catch (err) {
                incidentErrorMsg.textContent = err.message;
                incidentErrorMsg.classList.remove("hidden");
                submitBtn.disabled = false;
            }
        });
    }


    // ---------------------------------------------------------
    // MODALE : DÉTAILS DE L'ASCENSEUR
    // ---------------------------------------------------------

    function openDetailsModal(entranceId) {
        activeDetailsEntranceId = entranceId;
        const elevator = Store.getElevatorById(entranceId);
        
        if (!elevator) {
            console.error("Aucune donnée trouvée pour l'ascenseur entrée :", entranceId);
            return;
        }

        const tenant = Security.getLoggedInTenant();

        // 1. Renseigner l'en-tête
        detailsEntranceNum.textContent = elevator.id;

        // 2. Renseigner l'état actuel principal
        detailsStatusBadge.className = "status-indicator-large";
        let statusText = "En Service";

        if (elevator.status === "en_maintenance") {
            detailsStatusBadge.classList.add("bg-maintenance");
            statusText = "En Maintenance";
        } else if (elevator.status === "en_panne") {
            detailsStatusBadge.classList.add("bg-broken");
            statusText = "En Panne (Hors Service)";
        } else {
            detailsStatusBadge.classList.add("bg-functional");
            statusText = "En Service (Opérationnel)";
        }

        detailsStatusText.textContent = statusText;
        detailsLastChange.textContent = `Dernier changement de statut : ${formatTimeAgo(elevator.lastStatusChange)}`;
        detailsDowntime.textContent = elevator.downtimeDays > 0 ? `Pannes cumulées : ${elevator.downtimeDays} jour(s)` : "";

        // 3. Bloc de maintenance active
        if ((elevator.status === "en_maintenance" || elevator.status === "en_panne") && elevator.maintenanceNotes) {
            maintenanceDetails.textContent = elevator.maintenanceNotes;
            maintenanceInfoBox.classList.remove("hidden");
        } else {
            maintenanceInfoBox.classList.add("hidden");
        }

        // 4. Liste des signalements des locataires
        tenantReportsList.innerHTML = "";
        if (elevator.tenantReports.length === 0) {
            tenantReportsList.innerHTML = `<p class="no-data-msg">Aucun signalement en cours pour cette entrée.</p>`;
        } else {
            elevator.tenantReports.forEach(report => {
                const item = document.createElement("div");
                item.className = "report-item";
                
                // Bouton de suppression pour tout locataire connecté
                const deleteBtnHtml = tenant 
                    ? `<button class="btn-delete-report" data-report-id="${report.id}">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" class="btn-icon-left">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        Supprimer le signalement
                       </button>` 
                    : "";

                const photoHtml = report.photo 
                    ? `<div class="report-photo-thumb-container">
                        <img class="report-thumbnail" src="${report.photo}" alt="Preuve de panne" title="Cliquer pour zoomer">
                       </div>`
                    : "";

                item.innerHTML = `
                    <div class="report-item-header">
                        <span class="report-item-user"></span>
                        <span>${formatTimeAgo(report.timestamp)}</span>
                    </div>
                    <div class="report-item-body">
                        <strong>${formatIssueType(report.type)}</strong> • <span class="report-desc-text"></span>
                        ${photoHtml}
                    </div>
                    <div class="report-item-footer" style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                        <button class="btn btn-secondary btn-sm btn-upvote" data-report-id="${report.id}">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-inline" style="margin-right:4px; vertical-align:middle;"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> Moi aussi <span class="upvote-count" style="margin-left:4px; font-weight:bold;">0</span>
                        </button>
                        ${deleteBtnHtml}
                    </div>
                `;

                item.querySelector(".report-item-user").textContent = `Par : ${report.user}`;
                item.querySelector(".report-desc-text").textContent = report.description;

                if (report.photo) {
                    item.querySelector(".report-thumbnail").addEventListener("click", () => {
                        const dateStr = new Date(report.timestamp).toLocaleString("fr-FR");
                        openLightbox(report.photo, `${formatIssueType(report.type)} • Signalée par ${report.user} le ${dateStr}`);
                    });
                }

                // Attacher l'action (suppression de signalement) accessible à tout locataire
                if (tenant) {
                    item.querySelector(".btn-delete-report").addEventListener("click", async () => {
                        if (confirm("Voulez-vous vraiment supprimer ce signalement ?")) {
                            try {
                                await Store.deleteReport(elevator.id, report.id);
                                renderDashboard();
                                openDetailsModal(elevator.id);
                            } catch (err) {
                                alert("Erreur de suppression : " + err.message);
                            }
                        }
                    });
                }

                // Gestion du bouton "Moi aussi" (Simulation locale en attendant la base de données)
                const upvoteBtn = item.querySelector(".btn-upvote");
                const countSpan = item.querySelector(".upvote-count");
                const upvotesKey = `upvotes_${report.id}`;
                let currentCount = parseInt(localStorage.getItem(upvotesKey) || "0", 10);
                countSpan.textContent = currentCount > 0 ? currentCount : "";
                
                upvoteBtn.addEventListener("click", () => {
                    const hasVoted = localStorage.getItem(`voted_${report.id}`);
                    if (!hasVoted) {
                        currentCount++;
                        localStorage.setItem(upvotesKey, currentCount);
                        localStorage.setItem(`voted_${report.id}`, "true");
                        countSpan.textContent = currentCount;
                        upvoteBtn.classList.add("color-primary");
                    } else {
                        alert("Vous avez déjà confirmé ce signalement.");
                    }
                });

                tenantReportsList.appendChild(item);
            });
        }

        // 5. Ligne de vie / Historique (Timeline) & Graphique
        historyTimeline.innerHTML = "";
        
        // Rendu du Graphique (Chart.js)
        const ctx = document.getElementById('history-chart');
        if (ctx) {
            // Nettoyer l'ancien graphique s'il existe
            if (window.elevatorChart) {
                window.elevatorChart.destroy();
            }

            if (!elevator.history || elevator.history.length === 0) {
                ctx.parentElement.style.display = 'none'; // Cacher le canvas si pas de données
            } else {
                ctx.parentElement.style.display = 'block';
                
                // Préparation des données pour le graphique : Taux de disponibilité (simplifié pour démo)
                // On crée des points sur les 30 derniers jours
                const labels = [];
                const dataPoints = [];
                const now = Date.now();
                const oneDay = 24 * 60 * 60 * 1000;
                
                for(let i = 29; i >= 0; i--) {
                    const d = new Date(now - i * oneDay);
                    labels.push(d.getDate() + "/" + (d.getMonth() + 1));
                    // Pour simplifier, on simule une disponibilité de 100% avec des chutes selon l'historique
                    // Dans un vrai cas, on calculerait l'état exact pour chaque jour basé sur elevator.history
                    let uptime = 100;
                    elevator.history.forEach(h => {
                        const hDate = new Date(h.timestamp);
                        if (hDate.getDate() === d.getDate() && hDate.getMonth() === d.getMonth()) {
                            if (h.status !== 'en_service') uptime = 0; // Panne ce jour-là
                        }
                    });
                    dataPoints.push(uptime);
                }

                window.elevatorChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: '% Disponibilité',
                            data: dataPoints,
                            borderColor: '#a78bfa',
                            backgroundColor: 'rgba(167, 139, 250, 0.2)',
                            fill: true,
                            tension: 0.3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true, max: 100 } },
                        plugins: { legend: { display: false } }
                    }
                });
            }
        }
        if (!elevator.history || elevator.history.length === 0) {
            historyTimeline.innerHTML = `<p class="no-data-msg">Aucun historique disponible.</p>`;
        } else {
            elevator.history.forEach(log => {
                const logItem = document.createElement("div");
                logItem.className = "timeline-item";

                let markerColor = "bg-functional";
                if (log.status === "en_maintenance") markerColor = "bg-maintenance";
                else if (log.status === "en_panne") markerColor = "bg-broken";

                logItem.innerHTML = `
                    <div class="timeline-marker ${markerColor}"></div>
                    <div class="timeline-date">${new Date(log.timestamp).toLocaleString('fr-FR')}</div>
                    <div class="timeline-title">${formatStatusLabel(log.status)}</div>
                    <div class="timeline-desc">${log.notes}</div>
                `;
                historyTimeline.appendChild(logItem);
            });
        }

        // 6. Section de mise à jour de statut (accessible aux locataires)
        if (tenant) {
            adminEntranceIdInput.value = elevator.id;
            adminSelectStatus.value = elevator.status;
            adminMaintenanceNotes.value = elevator.maintenanceNotes || "";
            adminActionsSection.classList.remove("hidden");
        } else {
            adminActionsSection.classList.add("hidden");
        }

        // Enfin, afficher la modale détails
        openModal(detailsModal);
    }

    // Traitement du formulaire de mise à jour de statut
    adminStatusForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const id = adminEntranceIdInput.value;
        const newStatus = adminSelectStatus.value;
        const notes = adminMaintenanceNotes.value;

        try {
            await Store.updateStatus(id, newStatus, notes);
            
            // Message flash de confirmation
            alert(`Mise à jour effectuée avec succès pour l'entrée ${id}.`);
            
            // Actualiser l'affichage
            renderDashboard();
            openDetailsModal(id);
            openDetailsModal(id);
        } catch (err) {
            alert("Erreur de modification du statut : " + err.message);
        }
    });

    // ---------------------------------------------------------
    // 5.8 SYSTEME D'AUTHENTIFICATION DE L'AMICALE (LOCATAIRES & PRO)
    // ---------------------------------------------------------

    /**
     * Rendu dynamique de la zone d'authentification dans l'en-tête (Header)
     */
    function getTenantInitials(tenant) {
        if (!tenant) return "";
        try {
            const profileStr = localStorage.getItem(`leclerc_asc_tenant_profile_${tenant.username}`);
            if (profileStr) {
                const profile = JSON.parse(profileStr);
                const first = (profile.first_name || "").trim().charAt(0).toUpperCase();
                const last = (profile.last_name || "").trim().charAt(0).toUpperCase();
                if (first && last) return first + last;
                if (first) return first;
                if (last) return last;
            }
        } catch (e) {
            console.error("Erreur lecture initiales", e);
        }
        return tenant.username.substring(0, 2).toUpperCase();
    }

    function renderAccountNav() {
        const sidebarIcon = document.getElementById("sidebar-account-icon");
        const mobileIcon = document.getElementById("mobile-account-icon");

        const sidebarSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const mobileSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        
        if (sidebarIcon) sidebarIcon.innerHTML = sidebarSvg;
        if (mobileIcon) mobileIcon.innerHTML = mobileSvg;
    }

    function renderAuthHeader() {
        renderAccountNav();
    }

    function refreshAccountTab(showWelcomeMessage = false) {
        accountAuthError.classList.add("hidden");
        accountAuthSuccess.classList.add("hidden");
        accountProfileError.classList.add("hidden");
        accountProfileSuccess.classList.add("hidden");

        const tenant = Security.getLoggedInTenant();
        if (tenant) {
            accountUnauthSection.classList.add("hidden");
            accountAuthSection.classList.remove("hidden");

            // Update title
            document.getElementById("account-username-title").textContent = tenant.username;
            
            // Generate avatar initials
            const initials = getTenantInitials(tenant);
            const avatarEl = document.getElementById("account-avatar");
            if (avatarEl) {
                avatarEl.textContent = initials;
            }

            // Populate profile inputs
            document.getElementById("account-apartment").value = tenant.apartment || "";
            document.getElementById("account-entrance").value = tenant.entrance || "";

            let firstName = tenant.first_name || "";
            let lastName = tenant.last_name || "";
            let notifications = !!tenant.notifications;

            // Fallback en localStorage si non renseigné dans la session (pour compatibilité)
            if (!firstName && !lastName) {
                try {
                    const profileStr = localStorage.getItem(`leclerc_asc_tenant_profile_${tenant.username}`);
                    if (profileStr) {
                        const profile = JSON.parse(profileStr);
                        firstName = profile.first_name || "";
                        lastName = profile.last_name || "";
                        notifications = !!profile.notifications;
                    }
                } catch (e) {
                    console.error(e);
                }
            }

            document.getElementById("account-firstname").value = firstName;
            document.getElementById("account-lastname").value = lastName;
            document.getElementById("account-notifications").checked = notifications;

            if (showWelcomeMessage) {
                accountProfileSuccess.textContent = "Bienvenue ! Veuillez renseigner votre Prénom, Nom, Entrée et Logement pour finaliser votre inscription.";
                accountProfileSuccess.classList.remove("hidden");
            }
        } else {
            accountUnauthSection.classList.remove("hidden");
            accountAuthSection.classList.add("hidden");
            // Reset forms
            accountLoginForm.reset();
            accountRegisterForm.reset();
            // Default tab: login
            accountTabLogin.click();
        }
    }

    // Basculement d'onglets Connexion / Inscription dans le panneau Compte
    if (accountTabLogin && accountTabRegister) {
        accountTabLogin.addEventListener("click", () => {
            accountTabLogin.classList.add("active");
            accountTabRegister.classList.remove("active");
            accountLoginForm.classList.remove("hidden");
            accountRegisterForm.classList.add("hidden");
            accountAuthError.classList.add("hidden");
            accountAuthSuccess.classList.add("hidden");
            accountTabLogin.style.color = "inherit";
            accountTabRegister.style.color = "var(--text-muted)";
        });

        accountTabRegister.addEventListener("click", () => {
            accountTabRegister.classList.add("active");
            accountTabLogin.classList.remove("active");
            accountRegisterForm.classList.remove("hidden");
            accountLoginForm.classList.add("hidden");
            accountAuthError.classList.add("hidden");
            accountAuthSuccess.classList.add("hidden");
            accountTabRegister.style.color = "inherit";
            accountTabLogin.style.color = "var(--text-muted)";
        });
    }

    // Formulaire de Connexion Locataire
    if (accountLoginForm) {
        accountLoginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            accountAuthError.classList.add("hidden");
            accountAuthSuccess.classList.add("hidden");

            const username = document.getElementById("account-login-username").value.trim();
            const password = document.getElementById("account-login-password").value;

            try {
                await Store.loginTenant(username, password);
                
                accountAuthSuccess.textContent = `Ravi de vous revoir, ${username} ! Connexion réussie...`;
                accountAuthSuccess.classList.remove("hidden");
                
                const submitBtn = accountLoginForm.querySelector("button[type='submit']");
                submitBtn.disabled = true;

                setTimeout(() => {
                    submitBtn.disabled = false;
                    renderAccountNav();
                    renderDashboard();
                    
                    // Instantly refresh profile section
                    refreshAccountTab();
                    
                    // Activer les notifications en temps réel
                    requestDesktopNotificationPermission();
                    subscribeToRealtimeNotifications();

                    if (activeDetailsEntranceId && !detailsModal.classList.contains("hidden")) {
                        openDetailsModal(activeDetailsEntranceId);
                    }
                }, 1500);
            } catch (err) {
                accountAuthError.textContent = err.message;
                accountAuthError.classList.remove("hidden");
            }
        });
    }

    // Formulaire d'Inscription Locataire
    if (accountRegisterForm) {
        accountRegisterForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            accountAuthError.classList.add("hidden");
            accountAuthSuccess.classList.add("hidden");

            const username = document.getElementById("account-register-username").value.trim();
            const password = document.getElementById("account-register-password").value;

            try {
                // Register with temporary default entrance '36' and empty apartment
                await Store.registerTenant(username, password, "36", "");
                
                accountAuthSuccess.textContent = "Votre compte locataire a été créé avec succès ! Bienvenue...";
                accountAuthSuccess.classList.remove("hidden");
                
                const submitBtn = accountRegisterForm.querySelector("button[type='submit']");
                submitBtn.disabled = true;

                setTimeout(() => {
                    submitBtn.disabled = false;
                    renderAccountNav();
                    renderDashboard();
                    
                    // Instantly refresh profile section and show welcome message
                    refreshAccountTab(true);
                    
                    // Activer les notifications en temps réel
                    requestDesktopNotificationPermission();
                    subscribeToRealtimeNotifications();

                    if (activeDetailsEntranceId && !detailsModal.classList.contains("hidden")) {
                        openDetailsModal(activeDetailsEntranceId);
                    }
                }, 1500);
            } catch (err) {
                accountAuthError.textContent = err.message;
                accountAuthError.classList.remove("hidden");
            }
        });
    }



    // ---------------------------------------------------------
    // 6. SPA ROUTER & FLUID PAGE TRANSITIONS
    // ---------------------------------------------------------
    
    const pageRouteMap = {
        "#/accueil": "tab-accueil",
        "#/ascenseurs": "tab-elevators",
        "#/incidents": "tab-incidents",
        "#/charges": "tab-charges",
        "#/compte": "tab-compte"
    };

    const pageTitles = {
        "#/accueil": "Accueil",
        "#/ascenseurs": "Ascenseurs",
        "#/incidents": "Incidents",
        "#/charges": "Charges",
        "#/compte": "Mon Compte"
    };

    function handleRouting() {
        const hash = window.location.hash || "#/accueil";
        const targetPanelId = pageRouteMap[hash];

        if (!targetPanelId) {
            // Redirection vers l'accueil si le hash est inconnu
            window.location.hash = "#/accueil";
            return;
        }

        const targetPanel = document.getElementById(targetPanelId);
        if (!targetPanel) return;

        // 1. Mettre à jour les classes actives sur les menus (Sidebar et Bottom Bar)
        const allLinks = document.querySelectorAll(".menu-link, .mobile-link");
        allLinks.forEach(link => {
            const linkHash = link.getAttribute("href");
            if (linkHash === hash) {
                link.classList.add("active");
                link.setAttribute("aria-selected", "true");
            } else {
                link.classList.remove("active");
                link.setAttribute("aria-selected", "false");
            }
        });

        // 2. Mettre à jour le titre dans la barre supérieure
        const currentPageTitleEl = document.getElementById("current-page-title");
        if (currentPageTitleEl) {
            currentPageTitleEl.textContent = pageTitles[hash] || "Collectif Plaine";
        }

        // 3. Fluid Page Transition Animation
        const allPanels = document.querySelectorAll(".page-panel");
        let activePanel = null;

        allPanels.forEach(panel => {
            if (panel.classList.contains("active")) {
                activePanel = panel;
            }
        });

        if (activePanel && activePanel !== targetPanel) {
            // Effet de fondu sortant du panneau actif actuel
            activePanel.classList.remove("active");
            
            // Masquage retardé pour permettre la fin de l'effet d'opacité
            setTimeout(() => {
                activePanel.classList.add("hidden");
                targetPanel.classList.remove("hidden");
                // Déclencher l'entrée du nouveau panneau
                setTimeout(() => {
                    targetPanel.classList.add("active");
                }, 20);
            }, 150);
        } else {
            // Premier chargement ou aucun panneau actif préalable
            allPanels.forEach(panel => {
                panel.classList.remove("active");
                panel.classList.add("hidden");
            });
            targetPanel.classList.remove("hidden");
            setTimeout(() => {
                targetPanel.classList.add("active");
            }, 20);
        }

        // 4. Initialisations et rafraîchissements spécifiques aux pages
        if (targetPanelId === "tab-elevators") {
            renderDashboard();
        } else if (targetPanelId === "tab-compte") {
            refreshAccountTab();
        }
    }

    // Écouter les changements de hash du navigateur
    // Soumission Formulaire Profil Locataire
    if (accountProfileForm) {
        accountProfileForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            accountProfileError.classList.add("hidden");
            accountProfileSuccess.classList.add("hidden");

            const tenant = Security.getLoggedInTenant();
            if (!tenant) return;

            const firstName = document.getElementById("account-firstname").value.trim();
            const lastName = document.getElementById("account-lastname").value.trim();
            const entrance = document.getElementById("account-entrance").value;
            const apartment = document.getElementById("account-apartment").value.trim();
            const notifications = document.getElementById("account-notifications").checked;

            const submitBtn = accountProfileForm.querySelector("button[type='submit']");
            submitBtn.disabled = true;

            try {
                // 1. Mettre à jour la table des résidents
                await Store.updateTenantProfile(tenant.username, entrance, apartment, firstName, lastName, notifications);

                // 2. Enregistrer les informations locales (Nom, Prenom, pref notif)
                const profileData = {
                    first_name: firstName,
                    last_name: lastName,
                    notifications: notifications
                };
                localStorage.setItem(`leclerc_asc_tenant_profile_${tenant.username}`, JSON.stringify(profileData));

                accountProfileSuccess.textContent = "Profil locataire mis à jour avec succès !";
                accountProfileSuccess.classList.remove("hidden");

                // Gérer l'abonnement aux notifications locales si cochées
                if (notifications) {
                    requestDesktopNotificationPermission();
                }

                setTimeout(() => {
                    submitBtn.disabled = false;
                    renderAccountNav();
                    renderDashboard();
                    refreshAccountTab();
                }, 1200);
            } catch (err) {
                accountProfileError.textContent = err.message;
                accountProfileError.classList.remove("hidden");
                submitBtn.disabled = false;
            }
        });
    }

    if (accountLogoutBtn) {
        accountLogoutBtn.addEventListener("click", async () => {
            await Store.logoutTenant();
            renderAccountNav();
            renderDashboard();
            refreshAccountTab();
            if (activeDetailsEntranceId && !detailsModal.classList.contains("hidden")) {
                openDetailsModal(activeDetailsEntranceId);
            }
        });
    }

    if (accountDeleteBtn) {
        accountDeleteBtn.addEventListener("click", () => {
            if (deleteAccountModal) openModal(deleteAccountModal);
        });
    }

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", async () => {
            const tenant = Security.getLoggedInTenant();
            if (!tenant) return;

            btnConfirmDelete.disabled = true;
            try {
                // 1. Supprimer le compte de la base de données et nettoyer le cache local
                await Store.deleteTenantAccount(tenant.username);
                
                // 2. Fermer la modale
                if (deleteAccountModal) closeModal(deleteAccountModal);
                
                // 3. Se désabonner du canal temps réel
                unsubscribeFromRealtimeNotifications();
                
                // 4. Mettre à jour l'interface utilisateur
                renderAccountNav();
                renderDashboard();
                refreshAccountTab();

                if (activeDetailsEntranceId && !detailsModal.classList.contains("hidden")) {
                    openDetailsModal(activeDetailsEntranceId);
                }

                // 5. Afficher un toast système informatif en français
                showSystemToast(
                    "Compte supprimé",
                    "Votre compte résident a été supprimé de la base de données de manière définitive."
                );
            } catch (err) {
                console.error("Erreur de suppression de compte", err);
                alert("Une erreur est survenue lors de la suppression de votre compte : " + err.message);
            } finally {
                btnConfirmDelete.disabled = false;
            }
        });
    }

    if (btnOpenAbout) {
        btnOpenAbout.addEventListener("click", () => {
            if (aboutModal) openModal(aboutModal);
        });
    }

    if (btnOpenRgpd) {
        btnOpenRgpd.addEventListener("click", () => {
            if (rgpdModal) openModal(rgpdModal);
        });
    }

    window.addEventListener("hashchange", handleRouting);

    // ---------------------------------------------------------
    // EVENEMENTS DU CENTRE DE NOTIFICATIONS
    // ---------------------------------------------------------

    if (notificationBellBtn && notificationDropdown) {
        notificationBellBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            
            const isHidden = notificationDropdown.classList.contains("hidden");
            
            if (isHidden) {
                notificationDropdown.classList.remove("hidden");
                notificationDropdown.setAttribute("aria-hidden", "false");
                
                // Marquer toutes les alertes comme lues à l'ouverture
                notificationsList.forEach(n => n.unread = false);
                renderNotificationsList();
            } else {
                notificationDropdown.classList.add("hidden");
                notificationDropdown.setAttribute("aria-hidden", "true");
            }
        });
    }

    if (btnClearNotifications && notificationDropdown) {
        btnClearNotifications.addEventListener("click", (e) => {
            e.stopPropagation();
            notificationsList = [];
            renderNotificationsList();
            notificationDropdown.classList.add("hidden");
            notificationDropdown.setAttribute("aria-hidden", "true");
        });
    }

    document.addEventListener("click", (e) => {
        if (notificationDropdown && notificationBellBtn) {
            if (!notificationDropdown.classList.contains("hidden") && 
                !notificationDropdown.contains(e.target) && 
                !notificationBellBtn.contains(e.target)) {
                notificationDropdown.classList.add("hidden");
                notificationDropdown.setAttribute("aria-hidden", "true");
            }
        }
    });

    // ---------------------------------------------------------
    // 7. INITIALISATION & ABONNEMENTS ÉVÉNEMENTIELS
    // ---------------------------------------------------------
    
    window.addEventListener("storeUpdated", () => {
        renderDashboard();
    });

    async function initApp() {
        initTheme();
        populateAllEntrancesDropdowns();
        handleRouting();
        renderAuthHeader();
        
        try {
            // Afficher un loader visuel temporaire premium
            entrancesGrid.innerHTML = `
                <div class="loading-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; color: var(--text-muted);">
                    <div style="font-size: 2rem; margin-bottom: 1rem; color: var(--color-danger);"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                    <div>Connexion en cours à Supabase...</div>
                </div>
            `;
            
            // Charger les ascenseurs depuis le cloud Supabase
            await Store.init();
            
            renderDashboard();

            // S'abonner aux alertes temps réel si l'utilisateur est déjà connecté en session
            if (Security.getLoggedInTenant()) {
                subscribeToRealtimeNotifications();
            }
        } catch (err) {
            console.error("Erreur d'initialisation Supabase", err);
            entrancesGrid.innerHTML = `
                <div class="alert-box alert-danger" style="margin-top: 1.5rem;">
                    Impossible de se connecter à la base de données. L'application est actuellement indisponible. Veuillez vérifier votre connexion ou désactiver vos bloqueurs de publicité pour ce site.
                </div>
            `;
        }
    }

    // Démarrage initial de l'application
    initApp();

    // Système de Toast Système (générique)
    function showSystemToast(title, body, actionText = "", onAction = null) {
        const toast = document.createElement("div");
        toast.className = "toast-alert";
        toast.setAttribute("role", "alert");
        toast.innerHTML = `
            <div class="toast-icon" style="color:var(--accent-primary);"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
            <div class="toast-content" style="${onAction ? 'cursor: pointer;' : ''}">
                <div class="toast-title">${title}</div>
                <div class="toast-body">${body} ${actionText ? `<strong style="color:var(--accent-primary); text-decoration:underline; margin-left:5px;">${actionText}</strong>` : ''}</div>
            </div>
            <button class="toast-close" aria-label="Fermer la notification">&times;</button>
        `;

        if (onAction) {
            toast.querySelector(".toast-content").addEventListener("click", () => {
                onAction();
                toast.remove();
            });
        }

        toast.querySelector(".toast-close").addEventListener("click", (e) => {
            e.stopPropagation();
            toast.style.opacity = "0";
            toast.style.transform = "translateX(50px)";
            setTimeout(() => {
                toast.remove();
            }, 300);
        });

        toastContainer.appendChild(toast);
    }

    // Enregistrement du Service Worker (PWA) avec détection active des mises à jour
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('[Service Worker] Enregistré avec succès. Scope:', registration.scope);
                    
                    // Écouter s'il y a une mise à jour en attente
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // Une mise à jour est prête, on propose de recharger
                                    showSystemToast(
                                        "Mise à jour disponible",
                                        "Une nouvelle version de l'application est disponible.",
                                        "Recharger",
                                        () => {
                                            newWorker.postMessage({ action: 'skipWaiting' });
                                            setTimeout(() => window.location.reload(), 1000);
                                        }
                                    );
                                }
                            });
                        }
                    });
                })
                .catch(error => {
                    console.log('[Service Worker] Échec de l\'enregistrement:', error);
                });
        });

        // Rechargement automatique de l'application quand un nouveau service worker prend le contrôle
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    }

    // Boutons d'export et générateur légal
    const btnExportHistory = document.getElementById("btn-export-history");
    if (btnExportHistory) {
        btnExportHistory.addEventListener("click", () => {
            if (activeDetailsEntranceId) {
                window.LegalGenerator.exportElevatorHistory(activeDetailsEntranceId);
            }
        });
    }

    /**
     * Génère dynamiquement les options de toutes les listes déroulantes de bâtiments
     */
    function populateAllEntrancesDropdowns() {
        if (typeof CONFIG === "undefined" || !CONFIG.entrances) {
            console.error("CONFIG ou CONFIG.entrances est introuvable.");
            return;
        }

        const dropdowns = [
            { id: "report-entrance", prefix: "N° ", suffix: " - Leclerc" },
            { id: "account-entrance", prefix: "Entrée ", suffix: "" },
            { id: "incident-entrance", prefix: "", suffix: "" }
        ];

        dropdowns.forEach(cfg => {
            const select = document.getElementById(cfg.id);
            if (!select) return;

            // Conserver les options par défaut ou spéciales (value vide ou 'tous')
            const defaultOption = select.querySelector("option[disabled]");
            const globalOption = select.querySelector("option[value='tous']");

            select.innerHTML = "";
            if (defaultOption) {
                select.appendChild(defaultOption);
            }

            CONFIG.entrances.forEach(ent => {
                const opt = document.createElement("option");
                opt.value = ent.id;
                opt.textContent = `${cfg.prefix}${ent.label || ent.id}${cfg.suffix}`;
                select.appendChild(opt);
            });

            if (globalOption) {
                select.appendChild(globalOption);
            }
        });
    }
});
