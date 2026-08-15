/**
 * @fileoverview Contrôleur d'interface pour le domaine Démocratie (Pétitions, Scrutins et Votes).
 */

import { Petitions } from './petitions.service.js';
import { Polls } from './polls.service.js';
import { Auth } from '../../core/auth.js';
import { EventBus, EVENTS } from '../../core/event-bus.js';
import { sanitizeHTML } from '../../utils/security.js';
import { timeAgo, formatDateFR } from '../../utils/date-helpers.js';
import { playSuccessSound } from '../../utils/audio-feedback.js';
import { exportPetitionSignatures } from '../legal/legal-generator.js';

class DemocracyUIController {
    constructor() {
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;

        EventBus.on(EVENTS.PETITIONS_UPDATED, (petitions) => this.renderPetitions(petitions));
        EventBus.on(EVENTS.POLLS_UPDATED, (polls) => this.renderPolls(polls));
        EventBus.on(EVENTS.AUTH_STATE_CHANGED, () => this.updateAdminControls());

        this._bindEvents();
        this.updateAdminControls();
        this._initialized = true;
    }

    updateAdminControls() {
        const isAdmin = Auth.isAdmin();

        const btnCreatePet = document.getElementById('btn-create-petition-trigger');
        const btnCreatePoll = document.getElementById('btn-create-poll-trigger');

        if (btnCreatePet) btnCreatePet.classList.toggle('hidden', !isAdmin);
        if (btnCreatePoll) btnCreatePoll.classList.toggle('hidden', !isAdmin);
    }

    /**
     * Rendu de la liste des pétitions collectives.
     * @param {Array<Object>} [list]
     */
    renderPetitions(list) {
        const container = document.getElementById('petitions-list-container');
        if (!container) return;

        const petitions = list || Petitions.getAll();
        if (petitions.length === 0) {
            container.innerHTML = `
                <div class="card glass center-text" style="padding: 3rem 1rem;">
                    <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">✍️</div>
                    <h3 style="font-size: 1.1rem; color: var(--text-primary);">Aucune pétition en cours</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">Les initiatives collectives et requêtes apparaîtront ici.</p>
                </div>
            `;
            return;
        }

        const currentUserId = Auth.getUser()?.id;

        let html = '';
        for (const pet of petitions) {
            const count = pet.signatures_count || 0;
            const target = pet.target_signatures || 50;
            const percent = Math.min(100, Math.round((count / target) * 100));
            const hasSigned = pet.signatures?.some(s => s.resident_id === currentUserId);

            html += `
                <div class="card glass" style="margin-bottom: 1.5rem; padding: 1.5rem;" data-petition-id="${sanitizeHTML(pet.id)}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem;">
                        <h3 style="margin: 0; font-size: 1.2rem; color: var(--text-primary); font-weight: 800;">
                            ${sanitizeHTML(pet.title)}
                        </h3>
                        <span class="assoc-badge">${count} / ${target} signatures</span>
                    </div>

                    <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 1.25rem;">
                        ${sanitizeHTML(pet.description)}
                    </p>

                    <!-- Jauge de progression -->
                    <div style="background: var(--bg-tertiary); height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 1.25rem; border: 1px solid var(--border-color);">
                        <div style="background: var(--accent-gradient); width: ${percent}%; height: 100%; transition: width 0.4s ease;"></div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                        <span style="font-size: 0.78rem; color: var(--text-muted);">Lancée ${timeAgo(pet.created_at)}</span>

                        <div style="display: flex; gap: 0.5rem;">
                            ${Auth.isAdmin() ? `
                                <button type="button" class="btn btn-secondary btn-sm" data-action="export-petition-pdf" data-id="${sanitizeHTML(pet.id)}">
                                    📄 Exporter PDF
                                </button>
                            ` : ''}

                            ${hasSigned ? `
                                <span class="badge-functional" style="padding: 0.4rem 0.8rem; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">
                                    ✓ Signée
                                </span>
                            ` : `
                                <button type="button" class="btn btn-primary btn-sm" data-action="sign-petition" data-id="${sanitizeHTML(pet.id)}">
                                    ✍️ Signer la pétition
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    /**
     * Rendu de la liste des scrutins et sondages.
     * @param {Array<Object>} [list]
     */
    renderPolls(list) {
        const container = document.getElementById('polls-list-container');
        if (!container) return;

        const polls = list || Polls.getAll();
        if (polls.length === 0) {
            container.innerHTML = `
                <div class="card glass center-text" style="padding: 3rem 1rem;">
                    <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📊</div>
                    <h3 style="font-size: 1.1rem; color: var(--text-primary);">Aucun scrutin actif</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">Les votes et consultations de l'amicale seront affichés ici.</p>
                </div>
            `;
            return;
        }

        const currentUserId = Auth.getUser()?.id;

        let html = '';
        for (const poll of polls) {
            const hasVoted = poll.votes?.some(v => v.resident_id === currentUserId);
            const userVote = poll.votes?.find(v => v.resident_id === currentUserId)?.selected_option;

            html += `
                <div class="card glass" style="margin-bottom: 1.5rem; padding: 1.5rem;" data-poll-id="${sanitizeHTML(poll.id)}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem;">
                        <h3 style="margin: 0; font-size: 1.2rem; color: var(--text-primary); font-weight: 800;">
                            ${sanitizeHTML(poll.title)}
                        </h3>
                        <span class="incident-badge ${poll.poll_type === 'vote_resolution' ? 'incident-badge-encours' : 'badge-functional'}">
                            ${poll.poll_type === 'vote_resolution' ? 'Vote Résolution' : 'Sondage'}
                        </span>
                    </div>

                    <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.25rem;">
                        ${sanitizeHTML(poll.description)}
                    </p>

                    <!-- Options de vote et résultats -->
                    <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.25rem;">
                        ${poll.options.map(opt => {
                            const stat = poll.votes_stats?.[opt] || { count: 0, percent: 0 };
                            const isSelected = userVote === opt;

                            return `
                                <div style="border: 1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}; border-radius: var(--radius-md); padding: 0.75rem 1rem; position: relative; overflow: hidden; background: ${isSelected ? 'var(--accent-primary-dim)' : 'var(--bg-tertiary)'};">
                                    <!-- Barre d'avancement de pourcentage -->
                                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${stat.percent}%; background: rgba(37, 99, 235, 0.12); z-index: 0;"></div>

                                    <div style="position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">
                                            ${isSelected ? '✓ ' : ''}${sanitizeHTML(opt)}
                                        </span>
                                        <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-muted);">
                                            ${stat.percent}% (${stat.count} vote${stat.count > 1 ? 's' : ''})
                                        </span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 1rem; flex-wrap: wrap; gap: 0.75rem;">
                        <span style="font-size: 0.78rem; color: var(--text-muted);">Total : <strong>${poll.total_votes || 0}</strong> participant(s)</span>

                        ${hasVoted ? `
                            <span style="font-size: 0.8rem; color: var(--color-success); font-weight: 700;">
                                ✓ Votre vote est enregistré
                            </span>
                        ` : `
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                ${poll.options.map(opt => `
                                    <button type="button" class="btn btn-secondary btn-sm" data-action="vote-poll" data-poll-id="${sanitizeHTML(poll.id)}" data-option="${sanitizeHTML(opt)}">
                                        Voter : ${sanitizeHTML(opt)}
                                    </button>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    _bindEvents() {
        // Déclencheurs création formulaire
        const btnPet = document.getElementById('btn-create-petition-trigger');
        const cardPet = document.getElementById('petition-creator-card');
        const cancelPet = document.getElementById('btn-cancel-petition');

        if (btnPet && cardPet) {
            btnPet.addEventListener('click', () => cardPet.classList.toggle('hidden'));
        }
        if (cancelPet && cardPet) {
            cancelPet.addEventListener('click', () => cardPet.classList.add('hidden'));
        }

        const btnPoll = document.getElementById('btn-create-poll-trigger');
        const cardPoll = document.getElementById('poll-creator-card');
        const cancelPoll = document.getElementById('btn-cancel-poll');

        if (btnPoll && cardPoll) {
            btnPoll.addEventListener('click', () => cardPoll.classList.toggle('hidden'));
        }
        if (cancelPoll && cardPoll) {
            cancelPoll.addEventListener('click', () => cardPoll.classList.add('hidden'));
        }

        // Formulaire création pétition
        const petForm = document.getElementById('petition-create-form');
        if (petForm) {
            petForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = document.getElementById('petition-title')?.value;
                const desc = document.getElementById('petition-desc')?.value;

                if (!title || !desc) return;
                try {
                    await Petitions.createPetition({ title, description: desc });
                    playSuccessSound();
                    EventBus.emit(EVENTS.TOAST_NOTIFY, {
                        title: "Pétition publiée",
                        message: "La pétition est désormais ouverte aux signatures.",
                        type: "success"
                    });
                    petForm.reset();
                    cardPet?.classList.add('hidden');
                } catch (err) {
                    alert("Erreur : " + err.message);
                }
            });
        }

        // Formulaire création scrutin
        const pollForm = document.getElementById('poll-create-form');
        if (pollForm) {
            pollForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = document.getElementById('poll-title')?.value;
                const desc = document.getElementById('poll-desc')?.value;
                const type = document.getElementById('poll-type')?.value;
                const optionsStr = document.getElementById('poll-options')?.value;
                const endsAt = document.getElementById('poll-ends-at')?.value;

                if (!title || !desc || !optionsStr) return;

                const optionsArr = optionsStr.split(',').map(s => s.trim()).filter(Boolean);
                if (optionsArr.length < 2) {
                    alert("Veuillez renseigner au moins 2 choix possibles.");
                    return;
                }

                try {
                    await Polls.createPoll({
                        title,
                        description: desc,
                        type,
                        options: optionsArr,
                        endsAt: endsAt ? new Date(endsAt).toISOString() : null
                    });
                    playSuccessSound();
                    EventBus.emit(EVENTS.TOAST_NOTIFY, {
                        title: "Scrutin publié",
                        message: "Le vote est ouvert aux résidents.",
                        type: "success"
                    });
                    pollForm.reset();
                    cardPoll?.classList.add('hidden');
                } catch (err) {
                    alert("Erreur : " + err.message);
                }
            });
        }

        // Délégation clics pour signature & vote
        document.addEventListener('click', async (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.getAttribute('data-action');

            if (action === 'sign-petition') {
                const petitionId = target.getAttribute('data-id');
                if (!petitionId) return;

                try {
                    await Petitions.signPetition(petitionId);
                    playSuccessSound();
                    EventBus.emit(EVENTS.TOAST_NOTIFY, {
                        title: "Signature enregistrée",
                        message: "Merci pour votre soutien collectif.",
                        type: "success"
                    });
                } catch (err) {
                    alert(err.message);
                }
            } else if (action === 'vote-poll') {
                const pollId = target.getAttribute('data-poll-id');
                const option = target.getAttribute('data-option');
                if (!pollId || !option) return;

                try {
                    await Polls.vote(pollId, option);
                    playSuccessSound();
                    EventBus.emit(EVENTS.TOAST_NOTIFY, {
                        title: "Vote pris en compte",
                        message: `Vous avez voté pour "${option}".`,
                        type: "success"
                    });
                } catch (err) {
                    alert(err.message);
                }
            } else if (action === 'export-petition-pdf') {
                const petitionId = target.getAttribute('data-id');
                const pet = Petitions.getAll().find(p => p.id === petitionId);
                if (pet) {
                    exportPetitionSignatures(pet);
                }
            }
        });
    }
}

export const DemocracyUI = new DemocracyUIController();
