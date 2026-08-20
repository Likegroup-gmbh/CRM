// DashboardKundeTutorial.js
// Mini-Tutorial-Link für Kunden (nach Registrierung)

import { KUNDE_ALLOWED_SLUGS, ARTICLE_DISPLAY_OVERRIDES } from '../education/EducationConstants.js';
import { icon } from '../../core/icons/IconSystem.js';

const TUTORIAL_SLUG = KUNDE_ALLOWED_SLUGS[0];
const TUTORIAL = ARTICLE_DISPLAY_OVERRIDES[TUTORIAL_SLUG];

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Rendert die Tutorial-Karte nur für freigeschaltete Kunden.
 * @returns {string} HTML oder leerer String
 */
export function renderKundeTutorialBlock() {
  if (typeof window.isKunde !== 'function' || !window.isKunde()) {
    return '';
  }

  const url = `/education/${TUTORIAL_SLUG}`;

  return `
    <a href="${url}" class="dashboard-section dashboard-kunde-tutorial" data-route="${url}">
      <span class="dashboard-kunde-tutorial__icon" aria-hidden="true">
        ${icon('book-open')}
      </span>
      <span class="dashboard-kunde-tutorial__text">
        <span class="dashboard-section__title dashboard-kunde-tutorial__title">${escapeHtml(TUTORIAL.title)}</span>
        <span class="dashboard-kunde-tutorial__desc">${escapeHtml(TUTORIAL.short_description)}</span>
      </span>
    </a>
  `;
}
