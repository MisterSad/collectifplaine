/**
 * @fileoverview Contrôleur d'interface pour le domaine Ascenseurs & Pannes.
 * Gère le rendu de la grille des 76 entrées, les modales de détails et de signalement.
 */

import { Elevator } from './elevator.service.js';
import { Auth } from '../../core/auth.js';
import { EventBus, EVENTS } from '../../core/event-bus.js';
import { sanitizeHTML, compressImage } from '../../utils/security.js';
import { timeAgo, formatDateFR } from '../../utils/date-helpers.js';
import { playSuccessSound, playAlertSound } from '../../utils/audio-feedback.js';
import { CONFIG, ELEVATOR_ISSUE_TYPES } from '../../config/config.js';

class ElevatorUIController {
    constructor() {
        this.selectedEntranceId = null;
        this.selectedPhotoBlob = null;
        this.historyChartInstance = null;
        this._initialized = false;
    }

    /**
     * Initialise les écouteurs du DOM et les souscriptions d'événements.
     */
    init() {
        if (this._initialized) return;

        // Souscriptions EventBus
        EventBus.on(EVENTS.ELEVATORS_UPDATED, (elevators) => {
            this.renderGrid(elevators);
            this.renderStatsSummary(elevators);
        });

        EventBus.on(EVENTS.REPORT_ADDED, () => {
            playAlertSound();
            EventBus.emit(EVENTS.TOAST_NOTIFY, {
                title: "Nouveau signalement",
                message: "Un nouveau dysfonctionnement d'ascenseur a été enregistré.",
                type: "warning"
            });
        });

        this._bindDOMEvents();
        this._populateEntranceSelects();
        this._initialized = true;
    }

    /**
     * Rendu complet de la grille des ascenseurs dans #elevators-grid.
     * @param {Array<Object>} [elevatorsList]
     */
    renderGrid(elevatorsList) {
        const grid = document.getElementById('elevators-grid');
        if (!grid) return;

        const list = elevatorsList || Elevator.getAll();
        if (list.length === 0) {
            grid.innerHTML = `<div class="loading-placeholder">Aucun ascenseur répertorié.</div>`;
            return;
        }

        // Tri : les ascenseurs en panne et en maintenance en premier
        const sorted = [...list].sort((a, b) => {
            const priority = { en_panne: 0, en_maintenance: 1, en_service: 2 };
            const pDiff = (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
            if (pDiff !== 0) return pDiff;
            return parseInt(a.id, 10) - parseInt(b.id, 10);
        });

        let html = '';
        for (const el of sorted) {
            const conf = CONFIG.entrances.find(e => String(e.id) === String(el.id)) || {
                label: `Entrée ${el.id}`,
                street: "Division Leclerc"
            };

            const statusClass = el.status === 'en_service' ? 'badge-functional' :
                                el.status === 'en_maintenance' ? 'badge-maintenance' : 'badge-broken';

            const statusLabel = el.status === 'en_service' ? 'En Service' :
                                el.status === 'en_maintenance' ? 'En Maintenance' : 'En Panne';

            const lastChange = timeAgo(el.last_status_change);
            const reportCount = el.reports?.length || 0;

            html += `
                <div class="elevator-card" data-entrance="${sanitizeHTML(el.id)}">
                    <div class="card-header">
                        <div class="entrance-label">
                            <span class="title">N° ${sanitizeHTML(el.id)}</span>
                            <span class="road">${sanitizeHTML(conf.street)}</span>
                        </div>
                        <span class="status-badge ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="card-content">
                        <div class="card-summary-msg">
                            ${el.status === 'en_service' ? 'Fonctionnement nominal' : (sanitizeHTML(el.maintenance_notes) || 'Arrêt signalé par les résidents')}
                        </div>
                        <div class="time-since">Statut mis à jour ${lastChange}</div>
                        ${reportCount > 0 ? `<div class="report-counter-tag">⚠️ ${reportCount} signalement${reportCount > 1 ? 's' : ''}</div>` : ''}
                    </div>
                    <div class="card-actions">
                        <button type="button" class="btn btn-secondary btn-sm btn-view-details" data-action="details" data-id="${sanitizeHTML(el.id)}">
                            Historique
                        </button>
                        ${el.status === 'en_service' ? `
                            <button type="button" class="btn btn-report btn-sm btn-report-card" data-action="report" data-id="${sanitizeHTML(el.id)}">
                                Signaler panne
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        grid.innerHTML = html;
    }

    /**
     * Met à jour les compteurs du résumé KPI en haut de page.
     * @param {Array<Object>} elevators
     */
    renderStatsSummary(elevators) {
        const total = elevators.length;
        const broken = elevators.filter(e => e.status === 'en_panne').length;
        const maintenance = elevators.filter(e => e.status === 'en_maintenance').length;
        const functional = elevators.filter(e => e.status === 'en_service').length;

        const statTotal = document.getElementById('stat-total-elevators');
        const statFunctional = document.getElementById('stat-functional-elevators');
        const statMaintenance = document.getElementById('stat-maintenance-elevators');
        const statBroken = document.getElementById('stat-broken-elevators');

        if (statTotal) statTotal.textContent = String(total);
        if (statFunctional) statFunctional.textContent = String(functional);
        if (statMaintenance) statMaintenance.textContent = String(maintenance);
        if (statBroken) statBroken.textContent = String(broken);
    }

    /**
     * Ouvre la modale de détails pour un ascenseur donné.
     * @param {string} entranceId
     */
    openDetailsModal(entranceId) {
        const el = Elevator.getById(entranceId);
        if (!el) return;

        this.selectedEntranceId = entranceId;
        const modal = document.getElementById('details-modal');
        if (!modal) return;

        const entranceNumEl = document.getElementById('details-entrance-num');
        const statusTextEl = document.getElementById('details-status-text');
        const statusBadgeEl = document.getElementById('details-status-badge');
        const lastChangeEl = document.getElementById('details-last-change');
        const downtimeEl = document.getElementById('details-downtime');
        const maintenanceBox = document.getElementById('maintenance-info-box');
        const maintenanceDetails = document.getElementById('maintenance-details');
        const adminSection = document.getElementById('admin-actions-section');

        if (entranceNumEl) entranceNumEl.textContent = el.id;

        if (statusTextEl) {
            statusTextEl.textContent = el.status === 'en_service' ? 'En Service (Opérationnel)' :
                                       el.status === 'en_maintenance' ? 'En Maintenance (Technicien prévenu)' : 'En Panne (Hors Service)';
        }

        if (statusBadgeEl) {
            statusBadgeEl.className = 'status-indicator-large ' + (
                el.status === 'en_service' ? 'bg-functional' :
                el.status === 'en_maintenance' ? 'bg-maintenance' : 'bg-broken'
            );
        }

        if (lastChangeEl) {
            lastChangeEl.textContent = `Mis à jour ${timeAgo(el.last_status_change)}`;
        }

        if (downtimeEl) {
            downtimeEl.textContent = `Cumul d'arrêt récent : ${el.downtimeHours} heures (${el.downtimeDays} jours)`;
        }

        if (maintenanceBox && maintenanceDetails) {
            if (el.maintenance_notes) {
                maintenanceBox.classList.remove('hidden');
                maintenanceDetails.textContent = el.maintenance_notes;
            } else {
                maintenanceBox.classList.add('hidden');
            }
        }

        // Afficher la section d'administration si rôle admin
        if (adminSection) {
            if (Auth.isAdmin()) {
                adminSection.classList.remove('hidden');
                const selectStatus = document.getElementById('admin-select-status');
                const notesInput = document.getElementById('admin-maintenance-notes');
                if (selectStatus) selectStatus.value = el.status;
                if (notesInput) notesInput.value = el.maintenance_notes || '';
            } else {
                adminSection.classList.add('hidden');
            }
        }

        this._renderModalReports(el.reports || []);
        this._renderModalTimeline(el.history || []);
        this._renderHistoryChart(el.history || []);

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    }

    _renderModalReports(reports) {
        const container = document.getElementById('tenant-reports-list');
        if (!container) return;

        if (reports.length === 0) {
            container.innerHTML = `<div class="no-data-msg">Aucun signalement récent pour cet ascenseur.</div>`;
            return;
        }

        let html = '';
        for (const rep of reports) {
            html += `
                <div class="report-item">
                    <div class="report-header">
                        <div class="report-meta">
                            <strong>${sanitizeHTML(ELEVATOR_ISSUE_TYPES[rep.type] || rep.type)}</strong>
                            <span class="report-author">Par ${sanitizeHTML(rep.user || 'Voisin')}</span>
                        </div>
                        <span class="report-time">${timeAgo(rep.created_at)}</span>
                    </div>
                    <div class="report-content">
                        <p>${sanitizeHTML(rep.description)}</p>
                        ${rep.photo_url ? `
                            <div class="report-photo-thumb" style="background-image: url('${sanitizeHTML(rep.photo_url)}'); cursor: pointer;" data-action="zoom-photo" data-url="${sanitizeHTML(rep.photo_url)}"></div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    _renderModalTimeline(history) {
        const timeline = document.getElementById('history-timeline');
        if (!timeline) return;

        if (history.length === 0) {
            timeline.innerHTML = `<div class="no-data-msg">Historique indisponible.</div>`;
            return;
        }

        const sorted = [...history].sort((a, b) => new Date(b.created_at || b.timestamp).getTime() - new Date(a.created_at || a.timestamp).getTime());

        let html = '';
        for (const h of sorted.slice(0, 15)) {
            const markerClass = h.status === 'en_service' ? 'bg-functional' :
                                h.status === 'en_maintenance' ? 'bg-maintenance' : 'bg-broken';
            const title = h.status === 'en_service' ? 'Remise en service' :
                          h.status === 'en_maintenance' ? 'Intervention / Diagnostic' : 'Panne constatée';

            html += `
                <div class="timeline-item">
                    <div class="timeline-marker ${markerClass}"></div>
                    <span class="timeline-date">${formatDateFR(h.created_at || h.timestamp)}</span>
                    <div class="timeline-title">${title}</div>
                    ${h.details ? `<div class="timeline-desc">${sanitizeHTML(h.details)}</div>` : ''}
                </div>
            `;
        }

        timeline.innerHTML = html;
    }

    _renderHistoryChart(history) {
        const canvas = document.getElementById('history-chart');
        if (!canvas || typeof window.Chart === 'undefined') return;

        if (this.historyChartInstance) {
            this.historyChartInstance.destroy();
            this.historyChartInstance = null;
        }

        // Agréger les états sur les 7 derniers jours
        const labels = [];
        const dataValues = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayStr = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
            labels.push(dayStr);
            dataValues.push(1); // 1 = 100% fonctionnel par défaut
        }

        const ctx = canvas.getContext('2d');
        this.historyChartInstance = new window.Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Disponibilité',
                    data: dataValues,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 0, max: 1.2, display: false },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    /**
     * Ouvre la modale de signalement de panne.
     * @param {string} [presetEntrance]
     */
    openReportModal(presetEntrance = "") {
        const modal = document.getElementById('report-modal');
        if (!modal) return;

        const form = document.getElementById('report-form');
        if (form) form.reset();

        const errorBox = document.getElementById('report-error-msg');
        const successBox = document.getElementById('report-success-msg');
        if (errorBox) errorBox.classList.add('hidden');
        if (successBox) successBox.classList.add('hidden');

        const entranceSelect = document.getElementById('report-entrance');
        if (entranceSelect && presetEntrance) {
            entranceSelect.value = String(presetEntrance);
        }

        const userField = document.getElementById('report-user');
        if (userField) {
            const profile = Auth.getProfile();
            userField.value = profile?.username || '';
        }

        this._clearPhotoPreview();

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    }

    _clearPhotoPreview() {
        this.selectedPhotoBlob = null;
        const previewContainer = document.getElementById('report-photo-preview-container');
        const previewImg = document.getElementById('report-photo-preview');
        const fileInput = document.getElementById('report-photo');

        if (previewContainer) previewContainer.classList.add('hidden');
        if (previewImg) previewImg.src = '';
        if (fileInput) fileInput.value = '';
    }

    _populateEntranceSelects() {
        const selects = [
            document.getElementById('report-entrance'),
            document.getElementById('account-entrance'),
            document.getElementById('incident-entrance')
        ];

        const validEntrances = CONFIG.entrances;

        for (const sel of selects) {
            if (!sel) continue;
            // Conserver les options statiques par défaut
            const firstOption = sel.firstElementChild;
            sel.innerHTML = '';
            if (firstOption) sel.appendChild(firstOption);

            for (const ent of validEntrances) {
                const opt = document.createElement('option');
                opt.value = ent.id;
                opt.textContent = `${ent.shortLabel} — ${ent.label}`;
                sel.appendChild(opt);
            }
        }
    }

    _bindDOMEvents() {
        // Délégation d'événements sur la grille des ascenseurs
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.getAttribute('data-action');
            const id = target.getAttribute('data-id');

            if (action === 'details' && id) {
                this.openDetailsModal(id);
            } else if (action === 'report') {
                this.openReportModal(id || "");
            } else if (action === 'zoom-photo') {
                const url = target.getAttribute('data-url');
                if (url && window.openLightbox) window.openLightbox(url);
            }
        });

        // Fermeture des modales
        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-backdrop').forEach(m => {
                    m.classList.add('hidden');
                    m.setAttribute('aria-hidden', 'true');
                });
            });
        });

        // Bouton global de signalement
        const globalReportBtn = document.getElementById('btn-open-report-modal');
        if (globalReportBtn) {
            globalReportBtn.addEventListener('click', () => this.openReportModal());
        }

        // Soumission du formulaire de signalement
        const reportForm = document.getElementById('report-form');
        if (reportForm) {
            reportForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this._handleReportSubmit();
            });
        }

        // Gestion de la photo de signalement avec compression
        const photoInput = document.getElementById('report-photo');
        if (photoInput) {
            photoInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                try {
                    this.selectedPhotoBlob = await compressImage(file);
                    const previewContainer = document.getElementById('report-photo-preview-container');
                    const previewImg = document.getElementById('report-photo-preview');
                    if (previewContainer && previewImg) {
                        previewImg.src = URL.createObjectURL(this.selectedPhotoBlob);
                        previewContainer.classList.remove('hidden');
                    }
                } catch (err) {
                    alert("Erreur lors du traitement de l'image : " + err.message);
                }
            });
        }

        const removePhotoBtn = document.getElementById('btn-remove-photo');
        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', () => this._clearPhotoPreview());
        }

        // Formulaire d'administration de statut
        const adminStatusForm = document.getElementById('admin-status-form');
        if (adminStatusForm) {
            adminStatusForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!this.selectedEntranceId) return;

                const statusSelect = document.getElementById('admin-select-status');
                const notesInput = document.getElementById('admin-maintenance-notes');

                const newStatus = statusSelect?.value || 'en_service';
                const notes = notesInput?.value || '';

                try {
                    await Elevator.updateStatus(this.selectedEntranceId, newStatus, notes);
                    playSuccessSound();
                    EventBus.emit(EVENTS.TOAST_NOTIFY, {
                        title: "Statut mis à jour",
                        message: `L'ascenseur N° ${this.selectedEntranceId} a été actualisé.`,
                        type: "success"
                    });
                    this.openDetailsModal(this.selectedEntranceId);
                } catch (err) {
                    alert("Erreur lors de la mise à jour : " + err.message);
                }
            });
        }
    }

    async _handleReportSubmit() {
        const entranceSelect = document.getElementById('report-entrance');
        const typeSelect = document.getElementById('report-type');
        const descInput = document.getElementById('report-desc');
        const userInput = document.getElementById('report-user');
        const submitBtn = document.getElementById('submit-report-btn');
        const errorBox = document.getElementById('report-error-msg');
        const successBox = document.getElementById('report-success-msg');

        if (!entranceSelect?.value || !typeSelect?.value || !descInput?.value.trim()) {
            if (errorBox) {
                errorBox.textContent = "Veuillez renseigner tous les champs obligatoires (*).";
                errorBox.classList.remove('hidden');
            }
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Envoi en cours...";
        }

        try {
            await Elevator.submitReport({
                entrance: entranceSelect.value,
                type: typeSelect.value,
                description: descInput.value.trim(),
                photoBlob: this.selectedPhotoBlob,
                user: userInput?.value || ""
            });

            playSuccessSound();
            if (successBox) {
                successBox.textContent = "Votre signalement a été enregistré avec succès !";
                successBox.classList.remove('hidden');
            }
            if (errorBox) errorBox.classList.add('hidden');

            setTimeout(() => {
                document.getElementById('report-modal')?.classList.add('hidden');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Envoyer le signalement";
                }
            }, 1200);
        } catch (err) {
            if (errorBox) {
                errorBox.textContent = "Erreur lors de l'envoi : " + err.message;
                errorBox.classList.remove('hidden');
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Envoyer le signalement";
            }
        }
    }
}

export const ElevatorUI = new ElevatorUIController();
