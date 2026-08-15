/**
 * @fileoverview Contrôleur d'interface pour le registre des incidents des parties communes (Standards 2026).
 */

import { Incident } from './incident.service.js';
import { Auth } from '../../core/auth.js';
import { EventBus, EVENTS } from '../../core/event-bus.js';
import { sanitizeHTML, compressImage } from '../../utils/security.js';
import { timeAgo, formatDateFR } from '../../utils/date-helpers.js';
import { playSuccessSound } from '../../utils/audio-feedback.js';
import { INCIDENT_CATEGORIES } from '../../config/config.js';

class IncidentUIController {
    constructor() {
        this.selectedCategoryFilter = 'all';
        this.selectedPhotoBlob = null;
        this.currentUpdatingIncidentId = null;
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;

        EventBus.on(EVENTS.INCIDENTS_UPDATED, (incidents) => {
            this.renderFeed(incidents);
        });

        this._bindEvents();
        this._initialized = true;
    }

    /**
     * Affiche le flux des incidents avec filtrage dynamique.
     * @param {Array<Object>} [incidentsList]
     */
    renderFeed(incidentsList) {
        const feed = document.getElementById('incidents-feed');
        if (!feed) return;

        const list = incidentsList || Incident.getAll();
        const filtered = this.selectedCategoryFilter === 'all' 
            ? list 
            : list.filter(i => i.category === this.selectedCategoryFilter);

        if (filtered.length === 0) {
            feed.innerHTML = `
                <div class="card glass center-text" style="padding: 3rem 1rem; border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-success); margin-bottom: 0.75rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <h3 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.25rem;">Aucun incident signalé</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">Les parties communes ne présentent aucune anomalie dans cette catégorie.</p>
                </div>
            `;
            return;
        }

        let html = '';
        for (const inc of filtered) {
            const catInfo = INCIDENT_CATEGORIES[inc.category] || { label: inc.category || "Autre", icon: "⚠️" };
            const statusClass = inc.status === 'resolu' ? 'incident-badge-repare' :
                                inc.status === 'en_cours' ? 'incident-badge-encours' : 'incident-badge-nouveau';
            const statusText = inc.status === 'resolu' ? 'Résolu' :
                               inc.status === 'en_cours' ? 'En cours' : 'Nouveau';

            const entranceLabel = inc.entrance === 'tous' ? 'Espaces Communs / Espaces Verts' : `Bâtiment ${sanitizeHTML(inc.entrance)}`;
            const canUpdate = Auth.isAdmin() || (inc.created_by && inc.created_by === Auth.getUser()?.id);

            html += `
                <div class="card glass-card report-item" style="margin-bottom: 1rem; padding: 1.25rem; border-radius: var(--radius-lg);" data-incident-id="${sanitizeHTML(inc.id)}">
                    <div class="report-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                        <div>
                            <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-primary); text-transform: uppercase; letter-spacing: 0.05em;">
                                ${catInfo.icon} ${sanitizeHTML(catInfo.label)}
                            </span>
                            <h4 style="margin: 0.2rem 0 0; font-size: 1.05rem; color: var(--text-primary); font-weight: 700;">
                                ${entranceLabel}
                            </h4>
                        </div>
                        <span class="incident-badge ${statusClass}">${statusText}</span>
                    </div>

                    <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0.75rem;">
                        ${sanitizeHTML(inc.description)}
                    </p>

                    ${inc.photo_url ? `
                        <div class="report-photo-thumb" style="background-image: url('${sanitizeHTML(inc.photo_url)}'); height: 180px; background-size: cover; background-position: center; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 0.75rem; cursor: pointer; position: relative;" data-action="zoom-lightbox" data-url="${sanitizeHTML(inc.photo_url)}" data-caption="Incident - ${entranceLabel}">
                            <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.65); color: white; padding: 3px 8px; border-radius: var(--radius-pill); font-size: 0.7rem; display: flex; align-items: center; gap: 4px;">
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Agrandir
                            </div>
                        </div>
                    ` : ''}

                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 0.65rem; font-size: 0.75rem; color: var(--text-muted); flex-wrap: wrap; gap: 0.5rem;">
                        <span>Signalé par <strong>${sanitizeHTML(inc.user || 'Voisin')}</strong> • ${timeAgo(inc.created_at)}</span>
                        ${canUpdate ? `
                            <button type="button" class="btn btn-secondary btn-sm" data-action="update-incident" data-id="${sanitizeHTML(inc.id)}" data-status="${sanitizeHTML(inc.status || 'nouveau')}" data-desc="${sanitizeHTML(inc.description || '')}">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                Actualiser
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        feed.innerHTML = html;
    }

    openIncidentModal() {
        const modal = document.getElementById('incident-modal');
        if (!modal) return;

        const form = document.getElementById('incident-form');
        if (form) form.reset();

        const errBox = document.getElementById('incident-error-msg');
        const succBox = document.getElementById('incident-success-msg');
        if (errBox) errBox.classList.add('hidden');
        if (succBox) succBox.classList.add('hidden');

        this.selectedPhotoBlob = null;
        const previewContainer = document.getElementById('incident-photo-preview-container');
        if (previewContainer) previewContainer.classList.add('hidden');

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    }

    openUpdateModal(id, currentStatus, currentDesc) {
        this.currentUpdatingIncidentId = id;
        const modal = document.getElementById('update-incident-modal');
        if (!modal) return;

        const statusSelect = document.getElementById('update-incident-status');
        const descInput = document.getElementById('update-incident-description');
        const idHidden = document.getElementById('update-incident-id');

        if (idHidden) idHidden.value = id;
        if (statusSelect) statusSelect.value = currentStatus || 'nouveau';
        if (descInput) descInput.value = currentDesc || '';

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    }

    _bindEvents() {
        // Boutons de création d'incident
        const openBtn1 = document.getElementById('btn-open-incident-modal');
        const openBtn2 = document.getElementById('quick-incident-btn');
        if (openBtn1) openBtn1.addEventListener('click', () => this.openIncidentModal());
        if (openBtn2) openBtn2.addEventListener('click', () => this.openIncidentModal());

        // Filtres par catégorie
        document.querySelectorAll('.incident-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.incident-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedCategoryFilter = btn.getAttribute('data-category') || 'all';
                this.renderFeed();
            });
        });

        // Photo de l'incident
        const photoInput = document.getElementById('incident-photo-input');
        const cameraBtn = document.getElementById('btn-incident-camera');
        if (cameraBtn && photoInput) {
            cameraBtn.addEventListener('click', () => photoInput.click());
        }

        if (photoInput) {
            photoInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                try {
                    this.selectedPhotoBlob = await compressImage(file);
                    const previewContainer = document.getElementById('incident-photo-preview-container');
                    const previewImg = document.getElementById('incident-photo-preview');
                    if (previewContainer && previewImg) {
                        previewImg.src = URL.createObjectURL(this.selectedPhotoBlob);
                        previewContainer.classList.remove('hidden');
                    }
                } catch (err) {
                    alert("Erreur photo : " + err.message);
                }
            });
        }

        const removePhotoBtn = document.getElementById('btn-remove-incident-photo');
        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', () => {
                this.selectedPhotoBlob = null;
                const previewContainer = document.getElementById('incident-photo-preview-container');
                if (previewContainer) previewContainer.classList.add('hidden');
                if (photoInput) photoInput.value = '';
            });
        }

        // Soumission incident
        const incidentForm = document.getElementById('incident-form');
        if (incidentForm) {
            incidentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this._handleSubmit();
            });
        }

        // Mise à jour de statut
        const updateForm = document.getElementById('update-incident-form');
        if (updateForm) {
            updateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = this.currentUpdatingIncidentId;
                const status = document.getElementById('update-incident-status')?.value || 'nouveau';
                const desc = document.getElementById('update-incident-description')?.value || '';

                if (!id) return;
                try {
                    await Incident.updateStatus(id, status, desc);
                    playSuccessSound();
                    EventBus.emit(EVENTS.TOAST_NOTIFY, {
                        title: "Incident actualisé",
                        message: "L'état de l'incident a été enregistré.",
                        type: "success"
                    });
                    document.getElementById('update-incident-modal')?.classList.add('hidden');
                } catch (err) {
                    alert("Erreur mise à jour : " + err.message);
                }
            });
        }

        // Délégation clics
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.getAttribute('data-action');
            if (action === 'update-incident') {
                const id = target.getAttribute('data-id');
                const status = target.getAttribute('data-status');
                const desc = target.getAttribute('data-desc');
                this.openUpdateModal(id, status, desc);
            } else if (action === 'zoom-lightbox') {
                const url = target.getAttribute('data-url');
                const caption = target.getAttribute('data-caption');
                this._openLightbox(url, caption);
            }
        });

        // Fermeture Lightbox
        const closeLightboxBtn = document.getElementById('btn-close-lightbox');
        if (closeLightboxBtn) {
            closeLightboxBtn.addEventListener('click', () => {
                const lb = document.getElementById('lightbox-modal');
                if (lb) lb.classList.add('hidden');
            });
        }
    }

    _openLightbox(url, caption = "") {
        const modal = document.getElementById('lightbox-modal');
        const img = document.getElementById('lightbox-img');
        const captionEl = document.getElementById('lightbox-caption');

        if (!modal || !img) return;

        img.src = url;
        if (captionEl) captionEl.textContent = caption || "Photo d'incident";

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    }

    async _handleSubmit() {
        const category = document.getElementById('incident-category')?.value;
        const entrance = document.getElementById('incident-entrance')?.value || 'tous';
        const description = document.getElementById('incident-description')?.value?.trim();
        const errBox = document.getElementById('incident-error-msg');
        const succBox = document.getElementById('incident-success-msg');

        if (!category || !description) {
            if (errBox) {
                errBox.textContent = "Veuillez renseigner la catégorie et la description.";
                errBox.classList.remove('hidden');
            }
            return;
        }

        try {
            await Incident.createIncident({
                category,
                entrance,
                description,
                photoBlob: this.selectedPhotoBlob
            });

            playSuccessSound();
            if (succBox) {
                succBox.textContent = "Incident signalé avec succès !";
                succBox.classList.remove('hidden');
            }
            if (errBox) errBox.classList.add('hidden');

            setTimeout(() => {
                document.getElementById('incident-modal')?.classList.add('hidden');
            }, 1200);
        } catch (err) {
            if (errBox) {
                errBox.textContent = "Erreur lors du signalement : " + err.message;
                errBox.classList.remove('hidden');
            }
        }
    }
}

export const IncidentUI = new IncidentUIController();
