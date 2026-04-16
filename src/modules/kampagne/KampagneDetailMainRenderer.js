// KampagneDetailMainRenderer.js
// Haupt-Rendering für die Kampagnen-Detailseite (Page-Layout, Tabs, Skeleton)

import { KampagneUtils } from './KampagneUtils.js';
import { renderSummaryCards } from './KampagneDetailSummaryCards.js';
import { renderAnsprechpartner } from './KampagneDetailTabRenderers.js';
import { renderAuftragAmpel } from '../auftrag/logic/AuftragStatusUtils.js';

export function renderPageLoading() {
  return `
    <div class="table-loading-container" style="min-height: 300px;">
      <div class="table-loading-spinner"></div>
    </div>
  `;
}

export function renderNotFound() {
  window.setHeadline('Kampagne nicht gefunden');
  window.content.innerHTML = `
    <div class="error-message">
      <h2>Kampagne nicht gefunden</h2>
      <p>Die angeforderte Kampagne konnte nicht gefunden werden.</p>
    </div>
  `;
}

export function formatDeadlineBadge(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  let cls = 'tab-deadline';
  if (diffDays < 0) cls += ' tab-deadline--overdue';
  else if (diffDays <= 7) cls += ' tab-deadline--soon';
  const label = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `<span class="${cls}">bis ${label}</span>`;
}

/**
 * Rendert die komplette Detailseite.
 * @param {object} state - { kampagneData, koopBudgetSum, koopVideosUsed, koopCreatorsUsed, isKunde, kampagneId }
 */
export function renderMainPage(state) {
  const {
    kampagneData, koopBudgetSum, koopVideosUsed, koopCreatorsUsed,
    isKunde, kampagneId
  } = state;

  const canCreateKooperation = window.currentUser?.permissions?.kooperation?.can_edit || false;

  return `
    ${canCreateKooperation ? `
    <div class="page-header">
      <div class="page-header-right">
        <button id="btn-new-kooperation" class="primary-btn">Kooperation anlegen</button>
      </div>
    </div>
    ` : ''}

    <div class="content-section">
      ${renderSummaryCards(kampagneData, koopBudgetSum, koopVideosUsed, koopCreatorsUsed)}

      <div class="tab-navigation">
        <button class="tab-button active" data-tab="offen">
          Offen <span class="tab-count" id="tab-count-offen"></span>
        </button>
        <button class="tab-button" data-tab="abgeschlossen">
          Abgeschlossen <span class="tab-count" id="tab-count-abgeschlossen"></span>
        </button>
        <button class="tab-button" data-tab="alle">
          Alle <span class="tab-count" id="tab-count-alle"></span>
        </button>
        ${!isKunde ? `
        <button id="btn-column-visibility" class="secondary-btn" style="margin-left: auto;">
          Sichtbarkeit anpassen
        </button>` : ''}
      </div>

      <div class="tab-content">
        <div class="detail-section">
          <div id="kooperationen-videos-container"></div>
        </div>
      </div>
    </div>
  `;
}

function renderInfoCards(kampagneData, koopBudgetSum, isKunde) {
  return `
    <div class="detail-card">
      <h3 class="section-title">Kampagnen-Informationen</h3>
      <div class="detail-grid-2">
        <div class="detail-item">
          <label>Kampagnenname:</label>
          <span>${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(kampagneData))}</span>
        </div>
        ${kampagneData.eigener_name ? `
        <div class="detail-item">
          <label>Auto-generiert:</label>
          <span class="text-muted">${window.validatorSystem.sanitizeHtml(kampagneData.kampagnenname || '-')}</span>
        </div>` : ''}
        <div class="detail-item">
          <label>Art der Kampagne:</label>
          <span>${KampagneUtils.formatArray(kampagneData.kampagne_art_typen)}</span>
        </div>
        <div class="detail-item">
          <label>Kampagnen-Nummer:</label>
          <span>${kampagneData.kampagnen_nummer || '-'}</span>
        </div>
        <div class="detail-item">
          <label>Start:</label>
          <span>${KampagneUtils.formatDate(kampagneData.start)}</span>
        </div>
        <div class="detail-item">
          <label>Drehort:</label>
          <span>${window.validatorSystem.sanitizeHtml(kampagneData.drehort || '-')}</span>
        </div>
        <div class="detail-item">
          <label>Creator Anzahl:</label>
          <span>${kampagneData.creatoranzahl || 0}</span>
        </div>
        <div class="detail-item">
          <label>Video Anzahl:</label>
          <span>${kampagneData.videoanzahl || 0}</span>
        </div>
      </div>
    </div>

    <div class="detail-card">
      <h3 class="section-title">Deadlines</h3>
      <div class="detail-grid">
        <div class="detail-item"><label>Briefing:</label><span>${KampagneUtils.formatDate(kampagneData.deadline_briefing)}</span></div>
        <div class="detail-item"><label>Strategie:</label><span>${KampagneUtils.formatDate(kampagneData.deadline_strategie)}</span></div>
        <div class="detail-item"><label>Skripte:</label><span>${KampagneUtils.formatDate(kampagneData.deadline_skripte)}</span></div>
        <div class="detail-item"><label>Sourcing:</label><span>${KampagneUtils.formatDate(kampagneData.deadline_creator_sourcing)}</span></div>
        <div class="detail-item"><label>Video Produktion:</label><span>${KampagneUtils.formatDate(kampagneData.deadline_video_produktion)}</span></div>
        <div class="detail-item"><label>Post Produktion:</label><span>${KampagneUtils.formatDate(kampagneData.deadline_post_produktion)}</span></div>
      </div>
    </div>

    <div class="detail-card">
      <h3 class="section-title">Budget</h3>
      <div class="detail-item">
        <label>Budget Info:</label>
        <span>${window.validatorSystem.sanitizeHtml(kampagneData.budget_info || '-')}</span>
      </div>
    </div>

    <div class="detail-card">
      <h3 class="section-title">Unternehmen</h3>
      <div class="detail-item"><label>Firmenname:</label><span>${window.validatorSystem.sanitizeHtml(kampagneData.unternehmen?.firmenname || 'Unbekannt')}</span></div>
      <div class="detail-item"><label>Webseite:</label><span>${kampagneData.unternehmen?.webseite ? `<a href="${kampagneData.unternehmen.webseite}" target="_blank">${kampagneData.unternehmen.webseite}</a>` : '-'}</span></div>
      <div class="detail-item"><label>Branche:</label><span>${window.validatorSystem.sanitizeHtml(kampagneData.unternehmen?.branche_id || '-')}</span></div>
    </div>

    <div class="detail-card">
      <h3 class="section-title">Marke</h3>
      <div class="detail-item"><label>Markenname:</label><span>${window.validatorSystem.sanitizeHtml(kampagneData.marke?.markenname || 'Unbekannt')}</span></div>
      <div class="detail-item"><label>Webseite:</label><span>${kampagneData.marke?.webseite ? `<a href="${kampagneData.marke.webseite}" target="_blank">${kampagneData.marke.webseite}</a>` : '-'}</span></div>
    </div>

    <div class="detail-card">
      <h3 class="section-title">Auftrag</h3>
      <div class="detail-item"><label>Auftragsname:</label><span>${window.validatorSystem.sanitizeHtml(kampagneData.auftrag?.auftragsname || 'Unbekannt')}</span></div>
      <div class="detail-item"><label>Status:</label><span>${renderAuftragAmpel(kampagneData.auftrag?.status)}</span></div>
      <div class="detail-item"><label>Gesamt Budget:</label><span>${KampagneUtils.formatCurrency(kampagneData.auftrag?.gesamt_budget)}${koopBudgetSum ? ` (aufgebraucht: ${KampagneUtils.formatCurrency(koopBudgetSum)})` : ''}</span></div>
      <div class="detail-item"><label>Creator Budget:</label><span>${KampagneUtils.formatCurrency(kampagneData.auftrag?.creator_budget)}${koopBudgetSum ? ` (aufgebraucht: ${KampagneUtils.formatCurrency(koopBudgetSum)})` : ''}</span></div>
    </div>

    <div class="detail-card">
      <h3 class="section-title">Ansprechpartner</h3>
      <div class="detail-item">
        ${renderAnsprechpartner(kampagneData.ansprechpartner)}
      </div>
    </div>
  `;
}
