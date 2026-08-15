/**
 * @fileoverview Contrôleur d'interface pour le Wiki du Locataire (Recherche & Accordéons).
 */

import { WIKI_DATA } from './wiki.data.js';
import { sanitizeHTML } from '../../utils/security.js';

class WikiUIController {
    constructor() {
        this.selectedCategory = 'all';
        this.searchQuery = '';
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;

        this.renderArticles();
        this._bindEvents();
        this._initialized = true;
    }

    renderArticles() {
        const container = document.getElementById('wiki-articles-list');
        const noResults = document.getElementById('wiki-no-results');
        if (!container) return;

        let filtered = WIKI_DATA;

        // 1. Filtrer par catégorie
        if (this.selectedCategory !== 'all') {
            filtered = filtered.filter(a => a.category === this.selectedCategory);
        }

        // 2. Filtrer par recherche textuelle
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase().trim();
            filtered = filtered.filter(a => 
                a.title.toLowerCase().includes(q) ||
                a.summary.toLowerCase().includes(q) ||
                a.legislation.toLowerCase().includes(q) ||
                a.keywords.some(k => k.toLowerCase().includes(q))
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = '';
            if (noResults) noResults.classList.remove('hidden');
            return;
        }

        if (noResults) noResults.classList.add('hidden');

        let html = '';
        for (const art of filtered) {
            html += `
                <article class="wiki-card card glass" data-article-id="${art.id}">
                    <div class="wiki-card-header" data-action="toggle-accordion" data-id="${art.id}">
                        <div class="wiki-card-title-area">
                            <span class="wiki-law-badge">${sanitizeHTML(art.legislation)}</span>
                            <h3 class="wiki-card-title">${sanitizeHTML(art.title)}</h3>
                            <p class="wiki-card-summary">${sanitizeHTML(art.summary)}</p>
                        </div>
                        <button type="button" class="wiki-accordion-toggle" aria-label="Déplier l'article">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                    </div>
                    <div class="wiki-card-body hidden" id="wiki-body-${art.id}">
                        <div class="wiki-content-inner">
                            ${art.content}
                            ${art.actionText ? `
                                <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
                                    <a href="${art.actionLink || '#/incidents'}" class="btn btn-primary btn-sm">
                                        ${sanitizeHTML(art.actionText)} ➔
                                    </a>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </article>
            `;
        }

        container.innerHTML = html;
    }

    _bindEvents() {
        // Barre de recherche
        const searchInput = document.getElementById('wiki-search');
        const clearBtn = document.getElementById('wiki-search-clear');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                if (clearBtn) clearBtn.classList.toggle('hidden', !this.searchQuery);
                this.renderArticles();
            });
        }

        if (clearBtn && searchInput) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                this.searchQuery = '';
                clearBtn.classList.add('hidden');
                this.renderArticles();
            });
        }

        // Boutons filtres catégories
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedCategory = btn.getAttribute('data-category') || 'all';
                this.renderArticles();
            });
        });

        // Délégation clic accordéons
        document.addEventListener('click', (e) => {
            const header = e.target.closest('[data-action="toggle-accordion"]');
            if (!header) return;

            const artId = header.getAttribute('data-id');
            const body = document.getElementById(`wiki-body-${artId}`);
            const card = header.closest('.wiki-card');

            if (body && card) {
                const isHidden = body.classList.contains('hidden');
                body.classList.toggle('hidden', !isHidden);
                card.classList.toggle('expanded', isHidden);
            }
        });
    }
}

export const WikiUI = new WikiUIController();
