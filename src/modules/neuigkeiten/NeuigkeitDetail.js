// NeuigkeitDetail.js - Einzelner Update-Post (/neuigkeiten/:slug)
// Step-by-Step mit Screenshots, Markdown-Inhalt wie bei Education.

import { NeuigkeitenService } from './NeuigkeitenService.js';
import { renderMarkdown } from '../../core/markdownRenderer.js';
import { icon } from '../../core/icons/IconSystem.js';

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const neuigkeitDetail = {
  neuigkeit: null,

  async init(slug) {
    if (typeof window.isInternal !== 'function' || !window.isInternal()) {
      window.navigateTo('/dashboard');
      return;
    }

    if (!slug) {
      window.navigateTo('/neuigkeiten');
      return;
    }

    try {
      this.neuigkeit = await NeuigkeitenService.loadBySlug(slug);
    } catch (err) {
      console.error('❌ NeuigkeitDetail: Laden fehlgeschlagen:', err);
      this.neuigkeit = null;
    }

    if (!this.neuigkeit) {
      window.setHeadline('Update nicht gefunden');
      window.setContentSafely(window.content, this.renderNotFound());
      this.bindBackButton();
      return;
    }

    window.setHeadline(this.neuigkeit.titel);
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel(this.neuigkeit.titel);
    }

    this.render();
    this.bindBackButton();
  },

  render() {
    const n = this.neuigkeit;
    const datum = n.published_at
      ? new Date(n.published_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
      : '';
    const schritte = Array.isArray(n.schritte) ? n.schritte : [];

    const html = `
      <div class="neuigkeit-detail">
        <div class="neuigkeit-detail__header">
          <span class="neuigkeit-detail__datum">${datum}</span>
          <h1 class="neuigkeit-detail__titel">${escapeHtml(n.titel)}</h1>
          ${n.teaser ? `<p class="neuigkeit-detail__teaser">${escapeHtml(n.teaser)}</p>` : ''}
        </div>

        ${n.inhalt ? `
          <div class="md-content">
            ${renderMarkdown(n.inhalt)}
          </div>
        ` : ''}

        ${schritte.length > 0 ? `
          <div class="neuigkeit-schritte">
            <h2 class="neuigkeit-schritte__title">So geht's</h2>
            <ol class="neuigkeit-schritte__list">
              ${schritte.map((s, i) => this.renderSchritt(s, i)).join('')}
            </ol>
          </div>
        ` : ''}

        <div class="neuigkeit-detail__footer">
          <button class="mdc-btn mdc-btn--secondary" id="btn-back-to-neuigkeiten">
            ${icon('arrow-left')}
            Alle Updates
          </button>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  },

  renderSchritt(schritt, index) {
    const screenshotUrl = NeuigkeitenService.screenshotUrl(schritt.screenshot_path);
    return `
      <li class="neuigkeit-schritt">
        <div class="neuigkeit-schritt__kopf">
          <span class="neuigkeit-schritt__nummer">${index + 1}</span>
          <span class="neuigkeit-schritt__titel">${escapeHtml(schritt.titel)}</span>
        </div>
        <p class="neuigkeit-schritt__text">${escapeHtml(schritt.text)}</p>
        ${screenshotUrl ? `
          <img
            src="${screenshotUrl}"
            alt="Screenshot: ${escapeHtml(schritt.titel)}"
            class="neuigkeit-schritt__screenshot"
            loading="lazy"
          >
        ` : ''}
      </li>
    `;
  },

  renderNotFound() {
    return `
      <div class="education-not-found">
        ${icon('exclamation-circle')}
        <h2>Update nicht gefunden</h2>
        <p>Das gesuchte Update existiert nicht oder wurde entfernt.</p>
        <button class="mdc-btn" id="btn-back-to-neuigkeiten">
          Alle Updates
        </button>
      </div>
    `;
  },

  bindBackButton() {
    const backBtn = document.getElementById('btn-back-to-neuigkeiten');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.navigateTo('/neuigkeiten');
      });
    }
  },

  destroy() {
    this.neuigkeit = null;
  }
};
