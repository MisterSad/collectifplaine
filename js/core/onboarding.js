/**
 * @fileoverview Gestionnaire d'Onboarding Mobile avec Swipe tactile droite-gauche (Standards 2026).
 * Supporte le glissement tactile (touch events) et pointeur (pointer/mouse drag).
 */

import { Router } from './router.js';
import { EventBus, EVENTS } from './event-bus.js';

class OnboardingController {
    constructor() {
        this.currentSlide = 0;
        this.totalSlides = 4;
        this.startX = 0;
        this.currentX = 0;
        this.isDragging = false;
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;

        this.track = document.getElementById('onboarding-track');
        this.dots = document.querySelectorAll('.onboarding-dot');
        this.nextBtn = document.getElementById('onboarding-next-btn');
        this.skipBtn = document.getElementById('onboarding-skip-btn');
        this.container = document.getElementById('onboarding-container');

        if (!this.track || !this.container) return;

        this._bindEvents();
        this._updateSlide(0);
        this._initialized = true;
    }

    /**
     * Vérifie si l'onboarding a déjà été vu.
     * @returns {boolean}
     */
    isCompleted() {
        return localStorage.getItem('cp_onboarding_completed') === 'true';
    }

    /**
     * Marque l'onboarding comme terminé et navigue vers la connexion/inscription.
     */
    complete() {
        localStorage.setItem('cp_onboarding_completed', 'true');
        Router.navigate('compte');
    }

    /**
     * Réinitialise et ouvre l'onboarding.
     */
    restart() {
        this.currentSlide = 0;
        this._updateSlide(0);
        Router.navigate('onboarding');
    }

    _bindEvents() {
        // Bouton Suivant / Commencer
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => {
                if (this.currentSlide < this.totalSlides - 1) {
                    this.goToSlide(this.currentSlide + 1);
                } else {
                    this.complete();
                }
            });
        }

        // Bouton Passer
        if (this.skipBtn) {
            this.skipBtn.addEventListener('click', () => {
                this.complete();
            });
        }

        // Clic sur les points de pagination
        this.dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                this.goToSlide(index);
            });
        });

        // ── GESTION TACTILE DU SWIPE (Touch Events) ──
        this.container.addEventListener('touchstart', (e) => {
            this.startX = e.touches[0].clientX;
            this.currentX = this.startX;
            this.isDragging = true;
            this.track.style.transition = 'none';
        }, { passive: true });

        this.container.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            this.currentX = e.touches[0].clientX;
            const diffX = this.currentX - this.startX;
            const baseOffset = -this.currentSlide * 100;
            // Résistance aux extrémités
            const resistance = (this.currentSlide === 0 && diffX > 0) || (this.currentSlide === this.totalSlides - 1 && diffX < 0) ? 0.3 : 1;
            const offsetPercent = baseOffset + (diffX / this.container.offsetWidth) * 100 * resistance;
            this.track.style.transform = `translateX(${offsetPercent}%)`;
        }, { passive: true });

        this.container.addEventListener('touchend', () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.track.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
            const diffX = this.currentX - this.startX;
            const threshold = 45; // seuil de 45px pour déclencher le swipe

            if (diffX < -threshold && this.currentSlide < this.totalSlides - 1) {
                // Swipe gauche -> slide suivant
                this.goToSlide(this.currentSlide + 1);
            } else if (diffX > threshold && this.currentSlide > 0) {
                // Swipe droite -> slide précédent
                this.goToSlide(this.currentSlide - 1);
            } else {
                // Retour au slide courant
                this._updateSlide(this.currentSlide);
            }
        });

        // Support souris (Glisser-déposer sur émulateur)
        let isMouseDown = false;
        this.container.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            this.startX = e.clientX;
            this.currentX = this.startX;
            this.track.style.transition = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            this.currentX = e.clientX;
            const diffX = this.currentX - this.startX;
            const baseOffset = -this.currentSlide * 100;
            const offsetPercent = baseOffset + (diffX / this.container.offsetWidth) * 100;
            this.track.style.transform = `translateX(${offsetPercent}%)`;
        });

        window.addEventListener('mouseup', () => {
            if (!isMouseDown) return;
            isMouseDown = false;
            this.track.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
            const diffX = this.currentX - this.startX;
            if (diffX < -45 && this.currentSlide < this.totalSlides - 1) {
                this.goToSlide(this.currentSlide + 1);
            } else if (diffX > 45 && this.currentSlide > 0) {
                this.goToSlide(this.currentSlide - 1);
            } else {
                this._updateSlide(this.currentSlide);
            }
        });
    }

    goToSlide(index) {
        if (index < 0 || index >= this.totalSlides) return;
        this.currentSlide = index;
        this._updateSlide(index);
    }

    _updateSlide(index) {
        if (!this.track) return;
        this.track.style.transform = `translateX(-${index * 100}%)`;

        // Mise à jour des points de progression
        this.dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });

        // Texte du bouton suivant / terminer
        if (this.nextBtn) {
            if (index === this.totalSlides - 1) {
                this.nextBtn.innerHTML = `<span>Rejoindre le Collectif</span> <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
            } else {
                this.nextBtn.innerHTML = `<span>Suivant</span> <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
            }
        }
    }
}

export const Onboarding = new OnboardingController();
