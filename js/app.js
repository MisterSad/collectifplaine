/**
 * Suivi pannes ascenseurs - Contrôleur d'interface utilisateur (UI)
 * Orchestre les événements, manipule le DOM de manière sécurisée et gère les modales.
 */
document.addEventListener("DOMContentLoaded", () => {
    // ---------------------------------------------------------
    // 1. CACHE DES ELEMENTS DU DOM
    // ---------------------------------------------------------
    
    // Éléments Globaux
    const themeToggle = document.getElementById("theme-toggle");
    const authHeaderArea = document.getElementById("auth-header-area");
    const adminBanner = document.getElementById("admin-banner");
    
    // Modale : Auth Locataire
    const authModal = document.getElementById("auth-modal");
    const authLoginForm = document.getElementById("auth-login-form");
    const authRegisterForm = document.getElementById("auth-register-form");
    const modalTabLogin = document.getElementById("modal-tab-login");
    const modalTabRegister = document.getElementById("modal-tab-register");
    const authErrorMsg = document.getElementById("auth-error-msg");
    const authSuccessMsg = document.getElementById("auth-success-msg");
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
    
    // Nouveaux Modules (Incidents & Entraide)
    const quickIncidentBtn = document.getElementById("quick-incident-btn");
    const quickMessageBtn = document.getElementById("quick-message-btn");
    
    const incidentModal = document.getElementById("incident-modal");
    const incidentForm = document.getElementById("incident-form");
    const incidentErrorMsg = document.getElementById("incident-error-msg");
    const incidentSuccessMsg = document.getElementById("incident-success-msg");
    const incidentsFeed = document.getElementById("incidents-feed");

    const messageModal = document.getElementById("message-modal");
    const messageForm = document.getElementById("message-form");
    const messageErrorMsg = document.getElementById("message-error-msg");
    const messageSuccessMsg = document.getElementById("message-success-msg");
    const messagesFeed = document.getElementById("messages-feed");
    
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
            "arrêt": "🔴 Arrêt complet",
            "portes": "🚪 Problème de portes",
            "boutons": "🎛️ Boutons inactifs",
            "bruit": "🔊 Bruit ou vibration",
            "autre": "❓ Autre problème"
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
        const savedTheme = localStorage.getItem("theme") || "dark";
        document.documentElement.setAttribute("data-theme", savedTheme);
    }

    themeToggle.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    });

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
                    <div class="card-summary-msg color-danger">⚠️ Ascenseur à l'arrêt</div>
                    <div class="card-summary-desc">${elevator.maintenanceNotes || "Panne en cours de diagnostic."}</div>
                `;
            } else if (elevator.status === "en_maintenance") {
                statusSummaryHtml = `
                    <div class="card-summary-msg color-warning">🛠️ Travaux en cours</div>
                    <div class="card-summary-desc">${elevator.maintenanceNotes || "Opération de maintenance périodique."}</div>
                `;
            } else {
                // En service
                if (reportCount > 0) {
                    statusSummaryHtml = `
                        <div class="card-summary-msg color-warning">⚠️ Dysfonctionnements signalés</div>
                        <div class="card-summary-desc">${reportCount} signalement${reportCount > 1 ? 's' : ''} actif${reportCount > 1 ? 's' : ''}.</div>
                    `;
                } else {
                    statusSummaryHtml = `
                        <div class="card-summary-msg color-success">🟢 Fonctionnement normal</div>
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
                    <button class="btn btn-primary btn-report-card" data-id="${elevator.id}">
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
        renderMessages();
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
            "porte": "🚪", "vigik": "🔑", "proprete": "🚮", 
            "chauffage": "🌡️", "eclairage": "💡", "securite": "⚠️", "autre": "❓"
        };

        incidents.forEach(incident => {
            const el = document.createElement("div");
            el.className = "report-item";
            
            const badgeClass = incident.status === 'resolu' ? 'badge-functional' : 'badge-broken';
            const badgeText = incident.status === 'resolu' ? 'Résolu' : 'En cours';

            el.innerHTML = `
                <div class="report-header">
                    <div class="report-meta">
                        <strong>${categoryIcons[incident.category] || "❓"} ${incident.entrance !== 'tous' ? 'Bâtiment ' + incident.entrance : 'Espaces Communs'}</strong>
                        <span class="report-author">${incident.user_display}</span>
                    </div>
                    <span class="report-time">${formatTimeAgo(new Date(incident.created_at).getTime())}</span>
                </div>
                <div class="report-content">
                    <p>${incident.description}</p>
                </div>
                ${incident.photo_url ? `<div class="report-photo-thumb" style="background-image: url('${incident.photo_url}'); cursor:pointer;" onclick="window.openLightbox('${incident.photo_url}')" title="Agrandir la photo"></div>` : ""}
                <div style="margin-top:0.75rem; display:flex; justify-content:space-between; align-items:center;">
                    <span class="status-badge ${badgeClass}" style="font-size:0.7rem; padding:2px 6px;">${badgeText}</span>
                </div>
            `;
            incidentsFeed.appendChild(el);
        });
    }

    /**
     * Rendu des Messages d'Entraide
     */
    function renderMessages() {
        if (!messagesFeed) return;
        const messages = Store.getMessages();
        messagesFeed.innerHTML = "";

        if (messages.length === 0) {
            messagesFeed.innerHTML = `<div class="loading-placeholder">Soyez le premier à publier un message !</div>`;
            return;
        }

        const typeLabels = {
            "annonce": "📌 Annonce",
            "entraide": "🤝 Entraide",
            "alerte": "🚨 Alerte"
        };

        messages.forEach(msg => {
            const el = document.createElement("div");
            el.className = "card glass";
            el.style.marginBottom = "1rem";
            el.style.padding = "1.25rem";
            
            el.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                    <div>
                        <span class="status-badge" style="background-color:rgba(255,255,255,0.1); color:var(--text-primary); margin-bottom:0.5rem; display:inline-block; font-size:0.75rem;">${typeLabels[msg.type]}</span>
                        <h4 style="margin:0; font-size:1rem;">${msg.author}</h4>
                        <span class="report-time" style="font-size:0.75rem;">${formatTimeAgo(new Date(msg.created_at).getTime())} ${msg.entrance ? '• Bât. ' + msg.entrance : ''}</span>
                    </div>
                </div>
                <p style="margin:0; line-height:1.5; color:var(--text-secondary);">${msg.content}</p>
            `;
            messagesFeed.appendChild(el);
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

        console.log(`📡 [Realtime] Abonnement aux alertes et mises à jour de pannes...`);

        realtimeChannel = supabase
            .channel('public:db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, async payload => {
                console.log("📡 [Realtime] Signalement modifié :", payload);
                
                // Si c'est un nouveau rapport pour l'entrée du locataire, on affiche une alerte
                if (payload.eventType === 'INSERT' && String(payload.new.entrance) === String(tenant.entrance)) {
                    triggerNotification(payload.new);
                }
                
                // Rafraîchir l'état global pour mettre à jour les tuiles (statistiques, badges)
                await Store.init();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'elevators' }, async payload => {
                console.log("📡 [Realtime] Statut d'ascenseur modifié :", payload);
                // Rafraîchir l'état global
                await Store.init();
            })
            .subscribe((status) => {
                console.log(`📡 [Realtime] Statut d'abonnement : ${status}`);
            });
    }

    function unsubscribeFromRealtimeNotifications() {
        if (realtimeChannel) {
            console.log("📡 [Realtime] Désabonnement du canal temps réel...");
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
            <div class="toast-icon">🚨</div>
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
        notificationList.innerHTML = "";
        
        const unreadCount = notificationsList.filter(n => n.unread).length;
        
        // Mettre à jour le badge de la cloche
        if (unreadCount > 0) {
            notificationBadge.textContent = unreadCount;
            notificationBadge.classList.remove("hidden");
        } else {
            notificationBadge.classList.add("hidden");
        }

        if (notificationsList.length === 0) {
            notificationList.innerHTML = `<div class="notification-empty">Aucune alerte active</div>`;
            return;
        }

        notificationsList.forEach(notif => {
            const item = document.createElement("div");
            item.className = `notification-item ${notif.unread ? 'unread' : ''}`;
            item.innerHTML = `
                <div class="notification-item-icon">🚨</div>
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
                notificationDropdown.classList.add("hidden");
                notificationDropdown.setAttribute("aria-hidden", "true");
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
            openAuthModal();
            authErrorMsg.textContent = "ℹ️ Veuillez vous connecter ou créer un compte résident pour pouvoir signaler une panne.";
            authErrorMsg.classList.remove("hidden");
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
            showReportError(`⚠️ Trop de signalements consécutifs. Par sécurité contre le spam, veuillez patienter ${limiter.secondsToWait} secondes avant de soumettre un nouveau signalement.`);
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
                authModal.classList.remove("hidden");
                authModal.setAttribute("aria-hidden", "false");
                return;
            }
            incidentModal.classList.remove("hidden");
            incidentModal.setAttribute("aria-hidden", "false");
            incidentForm.reset();
            incidentErrorMsg.classList.add("hidden");
            incidentSuccessMsg.classList.add("hidden");
        });
    }

    if (quickMessageBtn) {
        quickMessageBtn.addEventListener("click", () => {
            if (!Security.getLoggedInTenant()) {
                authModal.classList.remove("hidden");
                authModal.setAttribute("aria-hidden", "false");
                return;
            }
            messageModal.classList.remove("hidden");
            messageModal.setAttribute("aria-hidden", "false");
            messageForm.reset();
            messageErrorMsg.classList.add("hidden");
            messageSuccessMsg.classList.add("hidden");
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

    // Soumission Formulaire Message
    if (messageForm) {
        messageForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            messageErrorMsg.classList.add("hidden");
            messageSuccessMsg.classList.add("hidden");

            const type = document.getElementById("message-type").value;
            const entrance = document.getElementById("message-entrance").value;
            const content = document.getElementById("message-content").value;

            const submitBtn = messageForm.querySelector("button[type='submit']");
            submitBtn.disabled = true;

            try {
                await Store.addMessage({
                    type,
                    entrance,
                    content
                });
                
                messageSuccessMsg.textContent = "Message publié avec succès.";
                messageSuccessMsg.classList.remove("hidden");
                
                setTimeout(() => {
                    closeModal(messageModal);
                    submitBtn.disabled = false;
                }, 1500);
            } catch (err) {
                messageErrorMsg.textContent = err.message;
                messageErrorMsg.classList.remove("hidden");
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
                        <span class="report-item-user">Par : ${report.user}</span>
                        <span>${formatTimeAgo(report.timestamp)}</span>
                    </div>
                    <div class="report-item-body">
                        <strong>${formatIssueType(report.type)}</strong> • ${report.description}
                        ${photoHtml}
                    </div>
                    <div class="report-item-footer" style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                        <button class="btn btn-secondary btn-sm btn-upvote" data-report-id="${report.id}">
                            👍 Moi aussi <span class="upvote-count" style="margin-left:4px; font-weight:bold;">0</span>
                        </button>
                        ${deleteBtnHtml}
                    </div>
                `;

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
    function renderAuthHeader() {
        authHeaderArea.innerHTML = "";
        
        const tenant = Security.getLoggedInTenant();

        if (tenant) {
            const firstLetter = tenant.username.charAt(0).toUpperCase();
            authHeaderArea.innerHTML = `
                <div class="user-profile-badge" title="Connecté en tant que résident">
                    <span class="user-avatar">${firstLetter}</span>
                    <span>${tenant.username} (Appt ${tenant.apartment})</span>
                </div>
                <button id="tenant-logout-btn" class="btn btn-secondary btn-sm" aria-label="Se déconnecter">
                    <span>Déconnexion</span>
                </button>
            `;
            
            document.getElementById("tenant-logout-btn").addEventListener("click", async () => {
                await Store.logoutTenant();
                renderAuthHeader();
                renderDashboard();
                if (activeDetailsEntranceId && !detailsModal.classList.contains("hidden")) {
                    openDetailsModal(activeDetailsEntranceId);
                }
            });
        } else {
            authHeaderArea.innerHTML = `
                <button id="tenant-login-btn" class="btn btn-primary btn-sm" aria-label="Connexion Espace Locataire">
                    <span>Connexion Résident</span>
                </button>
            `;
            
            document.getElementById("tenant-login-btn").addEventListener("click", () => {
                openAuthModal();
            });
        }
    }

    /**
     * Ouvre la modale d'authentification locataire
     */
    function openAuthModal() {
        authLoginForm.reset();
        authRegisterForm.reset();
        authErrorMsg.classList.add("hidden");
        authSuccessMsg.classList.add("hidden");
        modalTabLogin.click(); // Par défaut sur Connexion
        openModal(authModal);
    }

    // Basculement d'onglets Connexion / Inscription dans la modale
    modalTabLogin.addEventListener("click", () => {
        modalTabLogin.classList.add("active");
        modalTabRegister.classList.remove("active");
        authLoginForm.classList.remove("hidden");
        authRegisterForm.classList.add("hidden");
        authErrorMsg.classList.add("hidden");
        authSuccessMsg.classList.add("hidden");
    });

    modalTabRegister.addEventListener("click", () => {
        modalTabRegister.classList.add("active");
        modalTabLogin.classList.remove("active");
        authRegisterForm.classList.remove("hidden");
        authLoginForm.classList.add("hidden");
        authErrorMsg.classList.add("hidden");
        authSuccessMsg.classList.add("hidden");
    });

    // Formulaire de Connexion Locataire
    authLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        authErrorMsg.classList.add("hidden");
        authSuccessMsg.classList.add("hidden");

        const username = document.getElementById("auth-login-username").value;
        const password = document.getElementById("auth-login-password").value;

        try {
            await Store.loginTenant(username, password);
            
            authSuccessMsg.textContent = `Ravi de vous revoir, ${username} ! Connexion réussie...`;
            authSuccessMsg.classList.remove("hidden");
            
            const submitBtn = authLoginForm.querySelector("button[type='submit']");
            submitBtn.disabled = true;

            setTimeout(() => {
                closeModal(authModal);
                submitBtn.disabled = false;
                renderAuthHeader();
                renderDashboard();
                
                // Activer les notifications en temps réel
                requestDesktopNotificationPermission();
                subscribeToRealtimeNotifications();

                if (activeDetailsEntranceId && !detailsModal.classList.contains("hidden")) {
                    openDetailsModal(activeDetailsEntranceId);
                }
            }, 1500);
        } catch (err) {
            authErrorMsg.textContent = err.message;
            authErrorMsg.classList.remove("hidden");
        }
    });

    // Formulaire d'Inscription Locataire
    authRegisterForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        authErrorMsg.classList.add("hidden");
        authSuccessMsg.classList.add("hidden");

        const username = document.getElementById("auth-register-username").value;
        const entrance = document.getElementById("auth-register-entrance").value;
        const apartment = document.getElementById("auth-register-apartment").value;
        const password = document.getElementById("auth-register-password").value;

        try {
            await Store.registerTenant(username, password, entrance, apartment);
            
            authSuccessMsg.textContent = "Votre compte locataire a été créé avec succès ! Bienvenue...";
            authSuccessMsg.classList.remove("hidden");
            
            const submitBtn = authRegisterForm.querySelector("button[type='submit']");
            submitBtn.disabled = true;

            setTimeout(() => {
                closeModal(authModal);
                submitBtn.disabled = false;
                renderAuthHeader();
                renderDashboard();
                
                // Activer les notifications en temps réel
                requestDesktopNotificationPermission();
                subscribeToRealtimeNotifications();

                if (activeDetailsEntranceId && !detailsModal.classList.contains("hidden")) {
                    openDetailsModal(activeDetailsEntranceId);
                }
            }, 1500);
        } catch (err) {
            authErrorMsg.textContent = err.message;
            authErrorMsg.classList.remove("hidden");
        }
    });



    // ---------------------------------------------------------
    // 6. GESTION DE LA NAVIGATION PAR ONGLETS (TABS)
    // ---------------------------------------------------------
    const tabLinks = document.querySelectorAll(".tab-link");
    const tabContentPanels = document.querySelectorAll(".tab-content-panel");

    tabLinks.forEach(link => {
        link.addEventListener("click", () => {
            const targetTabId = link.dataset.tab;
            
            if (link.classList.contains("active")) return;

            tabLinks.forEach(t => {
                t.classList.remove("active");
                t.setAttribute("aria-selected", "false");
            });

            link.classList.add("active");
            link.setAttribute("aria-selected", "true");

            tabContentPanels.forEach(panel => {
                panel.classList.add("hidden");
            });

            const targetPanel = document.getElementById(targetTabId);
            if (targetPanel) {
                targetPanel.classList.remove("hidden");
            }

            if (targetTabId === "tab-elevators") {
                renderDashboard();
            } else if (targetTabId === "tab-juridique") {
                // Pré-remplissage du formulaire juridique si l'utilisateur est connecté
                const tenant = Security.getLoggedInTenant();
                if (tenant) {
                    const entranceSelect = document.getElementById("legal-entrance");
                    const apartmentInput = document.getElementById("legal-apartment");
                    
                    if (entranceSelect && !entranceSelect.value) {
                        // Chercher l'option correspondant à l'entrée du locataire
                        Array.from(entranceSelect.options).forEach(opt => {
                            if (opt.value === String(tenant.entrance) || opt.text.includes(tenant.entrance)) {
                                entranceSelect.value = opt.value;
                            }
                        });
                    }
                    if (apartmentInput && !apartmentInput.value) {
                        apartmentInput.value = tenant.apartment || "";
                    }
                }
            }
        });
    });

    // ---------------------------------------------------------
    // EVENEMENTS DU CENTRE DE NOTIFICATIONS
    // ---------------------------------------------------------

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

    btnClearNotifications.addEventListener("click", (e) => {
        e.stopPropagation();
        notificationsList = [];
        renderNotificationsList();
        notificationDropdown.classList.add("hidden");
        notificationDropdown.setAttribute("aria-hidden", "true");
    });

    document.addEventListener("click", (e) => {
        if (!notificationDropdown.classList.contains("hidden") && 
            !notificationDropdown.contains(e.target) && 
            !notificationBellBtn.contains(e.target)) {
            notificationDropdown.classList.add("hidden");
            notificationDropdown.setAttribute("aria-hidden", "true");
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
        renderAuthHeader();
        
        try {
            // Afficher un loader visuel temporaire premium
            entrancesGrid.innerHTML = `
                <div class="loading-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; color: var(--text-muted);">
                    <div style="font-size: 2rem; margin-bottom: 1rem; animation: pulse 1.5s infinite;">📡</div>
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
                    ⚠️ Impossible de se connecter à la base de données. L'application est actuellement indisponible. Veuillez vérifier votre connexion ou désactiver vos bloqueurs de publicité pour ce site.
                </div>
            `;
        }
    }

    // Démarrage initial de l'application
    initApp();

    // Enregistrement du Service Worker (PWA)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('[Service Worker] Enregistré avec succès. Scope:', registration.scope);
                })
                .catch(error => {
                    console.log('[Service Worker] Échec de l\'enregistrement:', error);
                });
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

    // Formulaire de génération légale
    const legalForm = document.getElementById("legal-form");
    if (legalForm) {
        legalForm.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const formData = {
                firstname: document.getElementById("legal-firstname").value,
                lastname: document.getElementById("legal-lastname").value,
                entrance: document.getElementById("legal-entrance").value,
                apartment: document.getElementById("legal-apartment").value
            };
            
            window.LegalGenerator.generateMiseEnDemeure(formData);
        });
    }
});
