// NeuigkeitenPage.js - Archiv-Liste aller Update-Posts (/neuigkeiten)
// Nur intern: Guard wie bei Education, RLS ist die eigentliche Barriere.

import { NeuigkeitenService } from './NeuigkeitenService.js';
import { resolveEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDatum(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export const neuigkeitenPage = {
  neuigkeiten: [],

  async init() {
    window.setHeadline('Was ist neu');

    if (typeof window.isInternal !== 'function' || !window.isInternal()) {
      window.navigateTo('/dashboard');
      return;
    }

    await this.loadData();
    this.render();
    this.bindEvents();
  },

  async loadData() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        return;
      }
      this.neuigkeiten = await NeuigkeitenService.loadAll();
    } catch (error) {
      console.error('❌ Fehler beim Laden der Neuigkeiten:', error);
      this.neuigkeiten = [];
    }
  },

  render() {
    const html = `
      <div class="neuigkeiten-page">
        ${this.neuigkeiten.length > 0 ? `
          <div class="education-grid">
            ${this.neuigkeiten.map(n => this.renderCard(n)).join('')}
          </div>
        ` : resolveEmptyState({
          hasActiveFilters: false,
          states: {
            default: { icon: 'document', title: 'Noch keine Updates', text: 'Sobald ein Deploy etwas Sichtbares bringt, steht es hier.', actions: [] }
          }
        }, 'default')}
      </div>
    `;

    window.setContentSafely(window.content, html);
  },

  renderCard(n) {
    return `
      <article class="education-card" data-slug="${escapeHtml(n.slug)}">
        <div class="education-card-header">
          <span class="education-card-category">
            ${icon('speaker-wave')}
            Update
          </span>
          <span class="education-card-date">${formatDatum(n.published_at)}</span>
        </div>
        <h3 class="education-card-title">${escapeHtml(n.titel)}</h3>
        <p class="education-card-description">${escapeHtml(n.teaser || '')}</p>
        <div class="education-card-footer">
          <span class="education-card-link">
            Ansehen
            ${icon('arrow-right')}
          </span>
        </div>
      </article>
    `;
  },

  bindEvents() {
    document.querySelectorAll('.education-card').forEach(card => {
      card.addEventListener('click', () => {
        const slug = card.dataset.slug;
        if (slug) {
          window.navigateTo(`/neuigkeiten/${slug}`);
        }
      });
    });
  },

  destroy() {
    this.neuigkeiten = [];
  }
};
