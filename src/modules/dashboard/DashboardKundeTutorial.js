// DashboardKundeTutorial.js
// Mini-Tutorial-Link für Kunden (nach Registrierung)

import { KUNDE_ALLOWED_SLUGS, ARTICLE_DISPLAY_OVERRIDES } from '../education/EducationConstants.js';

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
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
      </span>
      <span class="dashboard-kunde-tutorial__text">
        <span class="dashboard-section__title dashboard-kunde-tutorial__title">${escapeHtml(TUTORIAL.title)}</span>
        <span class="dashboard-kunde-tutorial__desc">${escapeHtml(TUTORIAL.short_description)}</span>
      </span>
    </a>
  `;
}
