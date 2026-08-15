/**
 * @fileoverview Contrôleur d'interface pour le domaine Ascenseurs & Pannes (Style Soft-Pill & Tracking 2026).
 * Gère le rendu des 8 ascenseurs de l'Avenue Division Leclerc, la recherche instantanée, les segmented pills et les modales.
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
        this.searchQuery = '';
        this.statusFilter = 'all';
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;

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

        // Rendu immédiat si les données sont déjà en mémoire
        const initialList = Elevator.getAll();
        if (initialList.length > 0) {
            this.renderGrid(initialList);
            this.renderStatsSummary(initialList);
        }

        this._initialized = true;
    }

    renderGrid(elevatorsList) {
        const grid = document.getElementById('elevators-grid') || document.getElementById('entrances-grid');
        if (!grid) return;

        const list = elevatorsList || Elevator.getAll();
        if (!list || list.length === 0) {
            grid.innerHTML = `
                <div class="loading-placeholder glass-card" style="padding: 2.5rem; text-align: center; grid-column: 1 / -1;">
                    <div style="display: inline-block; width: 28px; height: 28px; border: 3px solid var(--accent-primary); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 0.75rem;"></div>
                    <div style="font-size: 0.9rem; color: var(--text-muted); font-weight: 600;">Chargement des ascenseurs en direct...</div>
                </div>
            `;
            return;
        }

        // 1. Filtrage par statut
        let filtered = list;
        if (this.statusFilter !== 'all') {
            filtered = filtered.filter(e => e.status === this.statusFilter);
        }

        // 2. Filtrage par recherche
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase().trim();
            filtered = filtered.filter(e => 
                String(e.id).includes(q) ||
                `entrée ${e.id}`.toLowerCase().includes(q) ||
                `n° ${e.id}`.toLowerCase().includes(q)
            );
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="glass-card" style="padding: 3rem 1.5rem; text-align: center; grid-column: 1 / -1;">
                    <div style="width: 48px; height: 48px; border-radius: var(--radius-sm); background: var(--badge-purple-bg); color: var(--badge-purple-color); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </div>
                    <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.25rem;">Aucun ascenseur trouvé</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Essayez de modifier votre recherche ou réinitialisez les filtres.</div>
                </div>
            `;
            return;
        }

        // Tri : Pannes en premier, puis numéro d'entrée croissant
        const sorted = [...filtered].sort((a, b) => {
            const isBrokenA = a.status === 'en_panne' ? 0 : 1;
            const isBrokenB = b.status === 'en_panne' ? 0 : 1;
            if (isBrokenA !== isBrokenB) return isBrokenA - isBrokenB;
            return parseInt(a.id, 10) - parseInt(b.id, 10);
        });

        let html = '';
        for (const el of sorted) {
            const conf = CONFIG.entrances.find(e => String(e.id) === String(el.id)) || {
                label: `Entrée ${el.id}`,
                street: "Avenue Division Leclerc"
            };

            const isBroken = el.status === 'en_panne';
            const daysOffline = el.downtimeDays || 0;
            const lastChange = timeAgo(el.last_status_change);
            const reportCount = el.reports?.length || 0;

            html += `
                <div class="glass-card elevator-card ${isBroken ? 'card-broken-highlight' : 'card-functional-highlight'}" data-entrance="${sanitizeHTML(el.id)}" style="padding: 1.35rem; display: flex; flex-direction: column; justify-content: space-between; border-radius: var(--radius-card);">
                    
                    <!-- En-tête de tuile : Entrée & Statut Binaire Ultra-Clair -->
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.85rem;">
                            <div style="display: flex; align-items: center; gap: 0.85rem;">
                                <div class="badge-icon-box ${isBroken ? 'coral' : 'purple'}">
                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="5" y="3" width="14" height="18" rx="2" ry="2"/>
                                        <polyline points="9 10 12 7 15 10"/>
                                        <polyline points="9 14 12 17 15 14"/>
                                    </svg>
                                </div>
                                <div>
                                    <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary); font-family: var(--font-heading); line-height: 1.2;">
                                        Entrée N° ${sanitizeHTML(el.id)}
                                    </div>
                                    <div style="font-size: 0.775rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">
                                        ${sanitizeHTML(conf.street)}
                                    </div>
                                </div>
                            </div>
                            ${isBroken ? `
                                <span class="status-badge badge-broken" style="display: inline-flex; align-items: center; gap: 6px; padding: 0.35rem 0.75rem; font-weight: 800; font-size: 0.75rem;">
                                    <span class="pulse-dot"></span> EN PANNE
                                </span>
                            ` : `
                                <span class="status-badge badge-functional" style="display: inline-flex; align-items: center; gap: 5px; padding: 0.35rem 0.75rem; font-weight: 700; font-size: 0.75rem;">
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.8"><polyline points="20 6 9 17 4 12"/></svg> FONCTIONNE
                                </span>
                            `}
                        </div>

                        <!-- Corps de la tuile : Synthèse & Jours de panne -->
                        ${isBroken ? `
                            <div class="tile-breakdown-banner">
                                <div class="tile-breakdown-days">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    <span><strong>${daysOffline} jour${daysOffline > 1 ? 's' : ''}</strong> de panne</span>
                                </div>
                                <div class="tile-breakdown-reason">
                                    ${sanitizeHTML(el.maintenance_notes) || "Ascenseur immobilisé / Hors service"}
                                </div>
                                <div class="tile-breakdown-since">
                                    Depuis le ${formatDateFR(el.last_status_change)} (${lastChange})
                                </div>
                            </div>
                        ` : `
                            <div class="tile-nominal-banner">
                                <div class="tile-nominal-status">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                    <span>Ascenseur en service</span>
                                </div>
                                <div class="tile-nominal-sub">
                                    0 jour de panne actuel • Contrôlé ${lastChange}
                                </div>
                            </div>
                        `}
                    </div>

                    <!-- Pied de tuile : Signalements & Boutons d'Action -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px solid var(--border-color); flex-wrap: wrap; gap: 0.5rem;">
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
                            ${reportCount > 0 ? `<span style="color: var(--text-secondary);">${reportCount} signalement${reportCount > 1 ? 's' : ''}</span>` : '<span>Aucun problème signalé</span>'}
                        </div>

                        <div style="display: flex; gap: 0.4rem;">
                            <button type="button" class="btn-pill-dark" data-action="details" data-id="${sanitizeHTML(el.id)}" aria-label="Détails entrée ${el.id}">
                                Détails
                            </button>
                            ${!isBroken ? `
                                <button type="button" class="btn-pill-primary" style="padding: 0.55rem 1rem; font-size: 0.8rem; width: auto;" data-action="report" data-id="${sanitizeHTML(el.id)}" aria-label="Signaler panne entrée ${el.id}">
                                    Signaler
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        grid.innerHTML = html;
    }

    renderStatsSummary(elevators) {
        const total = elevators.length;
        const broken = elevators.filter(e => e.status === 'en_panne').length;
        const functional = total - broken;
        const totalDowntimeDays = elevators.reduce((acc, e) => acc + (e.downtimeDays || 0), 0);

        const statFunctional = document.getElementById('stat-functional');
        const statBroken = document.getElementById('stat-broken');
        const statDowntime = document.getElementById('stat-downtime');

        if (statFunctional) statFunctional.textContent = String(functional);
        if (statBroken) statBroken.textContent = String(broken);
        if (statDowntime) {
            statDowntime.textContent = totalDowntimeDays === 0 ? "0 jour de panne" : `${totalDowntimeDays} jour${totalDowntimeDays > 1 ? 's' : ''} d'arrêt`;
        }
    }

    openDetailsModal(entranceId) {
        const el = Elevator.getById(entranceId);
        if (!el) return;

        this.selectedEntranceId = entranceId;
        const modal = document.getElementById('details-modal');
        if (!modal) return;

        const isBroken = el.status === 'en_panne';
        const daysOffline = el.downtimeDays || 0;

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
            statusTextEl.textContent = isBroken ? 'En Panne (À l\'arrêt)' : 'En Service (Opérationnel)';
        }

        if (statusBadgeEl) {
            statusBadgeEl.className = 'status-indicator-large ' + (isBroken ? 'bg-broken' : 'bg-functional');
        }

        if (lastChangeEl) {
            lastChangeEl.textContent = `Dernière modification : ${timeAgo(el.last_status_change)}`;
        }

        if (downtimeEl) {
            if (isBroken) {
                downtimeEl.textContent = `${daysOffline} jour${daysOffline > 1 ? 's' : ''} de panne consécutifs`;
                downtimeEl.className = 'downtime-pill font-data alert-danger';
            } else {
                downtimeEl.textContent = "0 jour de panne actuel (Opérationnel)";
                downtimeEl.className = 'downtime-pill font-data alert-success';
            }
        }

        if (maintenanceBox && maintenanceDetails) {
            if (el.maintenance_notes) {
                maintenanceBox.classList.remove('hidden');
                maintenanceDetails.textContent = el.maintenance_notes;
            } else {
                maintenanceBox.classList.add('hidden');
            }
        }

        // Section Admin
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
            container.innerHTML = `<div class="no-data-msg" style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Aucun signalement récent enregistré pour cette entrée.</div>`;
            return;
        }

        let html = '';
        for (const rep of reports) {
            html += `
                <div class="report-item glass-card" style="padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
                    <div class="report-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <div class="report-meta">
                            <strong style="color: var(--text-primary); font-size: 0.85rem;">${sanitizeHTML(ELEVATOR_ISSUE_TYPES[rep.type] || rep.type)}</strong>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">Signalé par ${sanitizeHTML(rep.user || 'Voisin')}</div>
                        </div>
                        <span class="report-time" style="font-size: 0.725rem; color: var(--text-faint);">${timeAgo(rep.created_at)}</span>
                    </div>
                    <div class="report-content">
                        <p style="font-size: 0.825rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">${sanitizeHTML(rep.description)}</p>
                        ${rep.photo_url ? `
                            <div class="report-photo-thumb" style="background-image: url('${sanitizeHTML(rep.photo_url)}'); width: 80px; height: 80px; background-size: cover; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-top: 0.5rem; cursor: pointer;" data-action="zoom-photo" data-url="${sanitizeHTML(rep.photo_url)}"></div>
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
            timeline.innerHTML = `<div class="no-data-msg" style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Historique d'entretien non disponible.</div>`;
            return;
        }

        const sorted = [...history].sort((a, b) => new Date(b.created_at || b.timestamp).getTime() - new Date(a.created_at || a.timestamp).getTime());

        let html = '';
        for (const h of sorted.slice(0, 15)) {
            const markerClass = h.status === 'en_service' ? 'bg-functional' :
                                h.status === 'en_maintenance' ? 'bg-maintenance' : 'bg-broken';
            const title = h.status === 'en_service' ? 'Remise en service' :
                          h.status === 'en_maintenance' ? 'Intervention technique' : 'Arrêt / Panne constatée';

            const noteText = h.notes || h.details || '';

            html += `
                <div class="timeline-item" style="position: relative; padding-left: 1.5rem; margin-bottom: 1rem; border-left: 2px solid var(--border-color);">
                    <div class="timeline-marker ${markerClass}" style="position: absolute; left: -6px; top: 3px; width: 10px; height: 10px; border-radius: 50%;"></div>
                    <span class="timeline-date font-data" style="font-size: 0.725rem; color: var(--text-muted);">${formatDateFR(h.created_at || h.timestamp)}</span>
                    <div class="timeline-title" style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-top: 1px;">${title}</div>
                    ${noteText ? `<div class="timeline-desc" style="font-size: 0.775rem; color: var(--text-secondary); margin-top: 3px; line-height: 1.35;">${sanitizeHTML(noteText.replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/"))}</div>` : ''}
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

        const labels = [];
        const dataValues = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayStr = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
            labels.push(dayStr);
            dataValues.push(100);
        }

        const ctx = canvas.getContext('2d');
        this.historyChartInstance = new window.Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Disponibilité (%)',
                    data: dataValues,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.12)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointBackgroundColor: '#8b5cf6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 0, max: 110, display: false },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } }
                }
            }
        });
    }

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
        // Recherche instantanée
        const searchInput = document.getElementById('elevator-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderGrid();
            });
        }

        // Filtres par statut (Segmented Pill)
        document.querySelectorAll('.btn-filter-elevator, .segmented-pill-item[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-filter-elevator, .segmented-pill-item[data-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.statusFilter = btn.getAttribute('data-filter') || 'all';
                this.renderGrid();
            });
        });

        // Délégation de clics
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

        // Boutons de signalement
        const quickReportBtn = document.getElementById('quick-report-btn');
        const globalReportBtn = document.getElementById('btn-open-report-modal');
        if (quickReportBtn) quickReportBtn.addEventListener('click', () => this.openReportModal());
        if (globalReportBtn) globalReportBtn.addEventListener('click', () => this.openReportModal());

        // Soumission Formulaire Signalement
        const reportForm = document.getElementById('report-form');
        if (reportForm) {
            reportForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this._handleReportSubmit();
            });
        }

        // Capture et compression photo
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
                    alert("Erreur lors de la compression de l'image : " + err.message);
                }
            });
        }

        const removePhotoBtn = document.getElementById('btn-remove-photo');
        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', () => this._clearPhotoPreview());
        }

        // Formulaire Statut Admin
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
