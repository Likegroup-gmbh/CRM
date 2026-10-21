// Kopf, Budgetkacheln und Notizen der Auftragsdetails.

import { renderAgencyFeeCardHtml, renderKskCardHtml, calculateCreatorPaymentSummary, renderCreatorAnteilCardHtml } from '../../core/budget/EkVkAgencyFeeHelper.js';
import { renderAuftragNotizSection } from './AuftragDetailsNotiz.js';

// Rendere Auftragsdetails-Detailseite
export function render(detail) {
  window.setHeadline(`${detail.auftrag?.auftragsname || 'Auftragsdetails'} - Details`);
  
  const html = `
    <div class="content-section">
      ${detail.renderInformationen()}
    </div>
  `;

  window.setContentSafely(window.content, html);
}

// Rendere Informationen
export function renderInformationen(detail) {
  const num = (v) => v || v === 0 ? new Intl.NumberFormat('de-DE').format(v) : '-';
  const formatCurrency = (v) => {
    if (v === null || v === undefined) return '-';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
  };

  const auftragtype = detail.auftrag?.auftragtype || '-';
  const canViewInternalBudget = window.canSeePricing();
  const sanitize = (v) => window.validatorSystem?.sanitizeHtml(v) || v || '';

  const auftragsvolumen = parseFloat(detail.auftrag?.nettobetrag) || 0;
  const verbrauchtesBudget = detail.budgetSummary.verbrauchtesBudget || 0;
  const verfuegbaresBudget = detail.budgetSummary.verfuegbaresBudget || 0;
  const creatorAnteil = detail.budgetSummary.creatorAnteil || 0;
  const budgetPct = auftragsvolumen > 0 ? Math.min(100, Math.round((verbrauchtesBudget / auftragsvolumen) * 100)) : 0;
  const openPct = auftragsvolumen > 0 ? Math.max(0, 100 - budgetPct) : 0;

  const getBudgetColorClass = (pct) => {
    if (pct >= 90) return 'summary-progress-fill--danger';
    if (pct >= 75) return 'summary-progress-fill--warning';
    return '';
  };
  const getOpenBudgetColorClass = (pct) => {
    if (pct <= 10) return 'summary-progress-fill--danger';
    if (pct <= 25) return 'summary-progress-fill--warning';
    return 'summary-progress-fill--success';
  };

  const d = detail.details || {};
  const extraServices = Array.isArray(d.extra_services) ? d.extra_services : [];
  const validExtraServices = (d.extra_services_enabled !== false)
    ? extraServices.filter(s => s && typeof s.name === 'string' && s.name.trim())
    : [];

  const agencyFeeSummary = detail.budgetSummary.agencyFeeSummary || {};
  const creatorPayment = calculateCreatorPaymentSummary(creatorAnteil, detail.rechnungen);

  const zusatzleistungenCardsHtml = canViewInternalBudget
    ? validExtraServices.map(s => `
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(parseFloat(s.amount) || 0)}</div>
            <div class="summary-label">${sanitize(s.name)}</div>
          </div>
        `).join('')
    : '';

  const budgetCardVariant = detail.getBudgetCardVariant();

  // Influencer-Variante: festgelegtes Creatorbudget, Verbrauch ueber VK-Preise
  const creatorBudget = detail.budgetSummary.totalBudget || 0;
  const verbrauchtesCreatorBudget = detail.budgetSummary.usedVkBudget || 0;
  // Negativ = mehr VK gebucht als Creator-Budget vorhanden (ADR 0007).
  // creatorBudgetPct/offenesBudgetPct bleiben geklemmt, sie steuern nur den Balken.
  const offenesBudget = creatorBudget - verbrauchtesCreatorBudget;
  const creatorBudgetPct = creatorBudget > 0 ? Math.min(100, Math.round((verbrauchtesCreatorBudget / creatorBudget) * 100)) : 0;
  const offenesBudgetPct = creatorBudget > 0 ? Math.max(0, 100 - creatorBudgetPct) : 0;

  const budgetCardsHtml = budgetCardVariant === 'influencer' ? `
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(auftragsvolumen)}</div>
            <div class="summary-label">Gesamt Nettobetrag</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(creatorBudget)}</div>
            <div class="summary-label">Creatorbudget</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(verbrauchtesCreatorBudget)}</div>
            <div class="summary-label">Verbrauchtes Creatorbudget</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getBudgetColorClass(creatorBudgetPct)}"
                   style="width: ${creatorBudgetPct}%">
              </div>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(offenesBudget)}</div>
            <div class="summary-label">Offenes Creator Budget</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getOpenBudgetColorClass(offenesBudgetPct)}"
                   style="width: ${offenesBudgetPct}%">
              </div>
            </div>
          </div>
          ${renderKskCardHtml(agencyFeeSummary, formatCurrency)}
          ${renderAgencyFeeCardHtml(agencyFeeSummary, formatCurrency, { canSeePricing: true })}
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(detail.budgetSummary.extraKostenVkSum || 0)}</div>
            <div class="summary-label">Zusatzkosten</div>
          </div>
          ${zusatzleistungenCardsHtml}` : `
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(auftragsvolumen)}</div>
            <div class="summary-label">Auftragsvolumen</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(verfuegbaresBudget)}</div>
            <div class="summary-label">Verfügbares Budget</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getOpenBudgetColorClass(openPct)}"
                   style="width: ${openPct}%">
              </div>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(verbrauchtesBudget)}</div>
            <div class="summary-label">Verbrauchtes Budget</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getBudgetColorClass(budgetPct)}"
                   style="width: ${budgetPct}%">
              </div>
            </div>
          </div>
          ${renderCreatorAnteilCardHtml(creatorAnteil, creatorPayment, formatCurrency)}
          ${renderAgencyFeeCardHtml(agencyFeeSummary, formatCurrency, { canSeePricing: true })}
          ${renderKskCardHtml(agencyFeeSummary, formatCurrency)}
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(detail.budgetSummary.extraKostenVkSum || 0)}</div>
            <div class="summary-label">Zusatzkosten</div>
          </div>
          ${zusatzleistungenCardsHtml}`;

  return `
    <div class="detail-section">
      <!-- Budget-Kacheln -->
      <div class="auftragsdetails-summary">
        <div class="summary-cards">
          ${canViewInternalBudget ? budgetCardsHtml : ''}
          ${!canViewInternalBudget ? renderAgencyFeeCardHtml(agencyFeeSummary, formatCurrency, { canSeePricing: false }) : ''}
        </div>
      </div>

      ${canViewInternalBudget && d.abrechnung_hinweis ? `
      <div class="notice-box notice-info">
        <strong>Abrechnungshinweis (intern)</strong>
        ${sanitize(d.abrechnung_hinweis)}
      </div>
      ` : ''}

      <!-- Kategorien-Übersicht Tabelle -->
      ${detail.renderKategorienTable()}

      <!-- Zusatzleistungen -->
      ${detail.renderZusatzleistungenTable()}

      <!-- Kampagnen-Übersicht -->
      ${detail.renderKampagnenTable()}

      ${renderAuftragNotizSection()}

      <!-- Gebuchte Creator & Videos Cards -->
      <div class="auftragsdetails-summary u-mt-lg">
        <div class="summary-cards">
          <div class="summary-card">
            <div class="summary-value">${num(detail.budgetSummary.totalCreators)} von ${num(detail.budgetSummary.targetCreators)}</div>
            <div class="summary-label">Gebuchte Creator</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${num(detail.budgetSummary.totalVideos)} von ${num(detail.budgetSummary.targetVideos)}</div>
            <div class="summary-label">Gebuchte Videos</div>
          </div>
        </div>
      </div>

      <!-- Kooperationen & Videos -->
      <div class="detail-section">
        <h3 class="section-title section-title--spaced">Kooperationen & Videos</h3>
        ${detail.renderCreatorVideosTable()}
      </div>
    </div>
  `;
}

// Formatiere Ansprechpartner
export function formatAnsprechpartner(detail, ansprechpartner) {
  if (!ansprechpartner) return '-';
  const name = [ansprechpartner.vorname, ansprechpartner.nachname].filter(Boolean).join(' ');
  return ansprechpartner.email ? `${name} (${ansprechpartner.email})` : name;
}

// Berechne Progress-Prozentsatz für Videos/Creator
export function getProgressPercentage(detail, current, total) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

// Bestimme Farbe für Progress-Bar basierend auf Prozentsatz (Videos/Creator)
export function getProgressColorClass(detail, current, total) {
  if (!total || total <= 0) return '';
  const percentage = detail.getProgressPercentage(current, total);
  
  if (percentage >= 100) return 'summary-progress-fill--success';
  if (percentage >= 75) return 'summary-progress-fill--warning';
  return '';
}

// Berechne Budget Progress-Prozentsatz
export function getBudgetProgressPercentage(detail) {
  if (detail.getBudgetCardVariant() === 'influencer') {
    const creatorBudget = detail.budgetSummary.totalBudget || 0;
    if (creatorBudget <= 0) return 0;
    return Math.min(100, Math.round(((detail.budgetSummary.usedVkBudget || 0) / creatorBudget) * 100));
  }
  const auftragsvolumen = parseFloat(detail.auftrag?.nettobetrag) || 0;
  if (auftragsvolumen <= 0) return 0;
  return Math.min(100, Math.round(((detail.budgetSummary.verbrauchtesBudget || 0) / auftragsvolumen) * 100));
}

// Bestimme Farbe für Budget Progress-Bar
export function getBudgetProgressColorClass(detail) {
  const percentage = detail.getBudgetProgressPercentage();
  
  if (percentage >= 90) return 'summary-progress-fill--danger';
  if (percentage >= 75) return 'summary-progress-fill--warning';
  return '';
}
