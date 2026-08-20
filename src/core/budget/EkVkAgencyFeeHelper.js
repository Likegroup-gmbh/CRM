// EkVkAgencyFeeHelper.js
// Shared helper for Agency Fee calculation incl. EK/VK margin aggregation.

import { summeKskSelbstzahler, berechneKskBetrag, KSK_SATZ_PROZENT } from './kskSelbstzahler.js';

export function isFilledPrice(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0;
}

/**
 * Verfuegbares Creator-Budget (read-derived, wird nie persistiert):
 * Basis ist das gespeicherte creator_budget; KSK-Selbstzahler-Aufschlaege
 * werden aus dem KSK-Topf ins Creator-Budget umgebucht und erhoehen die Basis.
 */
export function berechneVerfuegbaresBudget(auftrag, kooperationen = []) {
  const basis = parseFloat(auftrag?.creator_budget ?? auftrag?.gesamt_budget ?? auftrag?.nettobetrag) || 0;
  const umgebucht = summeKskSelbstzahler(kooperationen);
  return { basis, umgebucht, verfuegbar: basis + umgebucht };
}

/**
 * Collects price rows at the same granularity as renderCreatorVideosTable:
 * - Video-level when videos exist for a kooperation
 * - Kooperation-level fallback otherwise
 *
 * @param {Array} kooperationen
 * @param {Array} videos - flat array of videos (caller flattens if needed)
 * @returns {{ ekNetto: number|null, vkNetto: number|null }[]}
 */
export function collectEkVkPriceRows(kooperationen, videos) {
  const rows = [];
  const videoList = Array.isArray(videos) ? videos : [];

  (kooperationen || []).forEach(koop => {
    const koopVideos = videoList.filter(v => v.kooperation_id === koop.id);

    if (koopVideos.length === 0) {
      rows.push({
        ekNetto: koop.einkaufspreis_netto ?? null,
        vkNetto: koop.verkaufspreis_netto ?? null,
      });
    } else {
      koopVideos.forEach(video => {
        rows.push({
          ekNetto: video.einkaufspreis_netto ?? null,
          vkNetto: video.verkaufspreis_netto ?? null,
        });
      });
    }
  });

  return rows;
}

/**
 * Calculates EK/VK totals and the valid margin (only rows where both > 0).
 */
export function calculateEkVkTotals(kooperationen, videos) {
  const rows = collectEkVkPriceRows(kooperationen, videos);

  let ekSum = 0;
  let vkSum = 0;
  let marginSum = 0;

  rows.forEach(row => {
    const ek = parseFloat(row.ekNetto) || 0;
    const vk = parseFloat(row.vkNetto) || 0;
    ekSum += ek;
    vkSum += vk;

    if (isFilledPrice(row.ekNetto) && isFilledPrice(row.vkNetto)) {
      marginSum += vk - ek;
    }
  });

  return { ekSum, vkSum, marginSum, rows };
}

/**
 * Full Agency Fee summary including base fee, EK/VK margin and visibility flags.
 */
export function calculateAgencyFeeSummary(details, kooperationen, videos, { variant } = {}) {
  const d = details || {};

  const baseFee = (d.agency_services_enabled && d.percentage_fee_enabled)
    ? (parseFloat(d.percentage_fee_value) || 0)
    : 0;

  const { ekSum, vkSum, marginSum } = calculateEkVkTotals(kooperationen, videos);

  const total = baseFee + marginSum;

  // KSK-Selbstzahler: umgebuchter Anteil aus dem KSK-Topf ins Creator-Budget
  const kskUmgebucht = summeKskSelbstzahler(kooperationen);

  // UGC traegt die KSK nicht manuell ein: sie wird immer aus dem
  // Creator-Anteil (EK-Summe) gerechnet. Influencer nutzt den manuellen Topf.
  const kskAuto = variant === 'ugc';
  const kskValue = kskAuto
    ? berechneKskBetrag(ekSum)
    : ((d.agency_services_enabled && d.ksk_enabled) ? (parseFloat(d.ksk_value) || 0) : 0);

  const showAgencyFeeCard = true;
  const showKskCard = kskAuto
    ? kskValue > 0
    : (d.agency_services_enabled && d.ksk_enabled && kskValue > 0);

  return { baseFee, ekVkMargin: marginSum, total, kskValue, kskUmgebucht, kskAuto, kskBasis: kskAuto ? ekSum : 0, showAgencyFeeCard, showKskCard, ekSum, vkSum };
}

/**
 * Adjusts an agency fee summary for the current viewer role.
 * Kunden only see baseFee; interne Nutzer see baseFee + ekVkMargin.
 * Pure function — caller passes the boolean, no window access here.
 */
export function resolveAgencyFeeForViewer(summary, canSeePricing) {
  if (canSeePricing) return summary;
  return {
    ...summary,
    total: summary.baseFee,
    ekVkMargin: 0,
    showAgencyFeeCard: true,
  };
}

/**
 * Renders the Agency Fee breakdown lines (always both rows).
 */
export function renderAgencyFeeBreakdownHtml(summary, formatCurrency, { dataAttrs = false } = {}) {
  const baseAttr = dataAttrs ? ' data-summary-value="agentur-fee-base"' : '';
  const marginAttr = dataAttrs ? ' data-summary-value="agentur-fee-margin"' : '';

  return `
      <div class="summary-card-breakdown">
        <div class="summary-card-breakdown-line">
          <span>Festgelegt</span>
          <span${baseAttr}>${formatCurrency(summary.baseFee)}</span>
        </div>
        <div class="summary-card-breakdown-line">
          <span>EK/VK-Differenz</span>
          <span${marginAttr}>${formatCurrency(summary.ekVkMargin)}</span>
        </div>
      </div>`;
}

/**
 * Renders the Agency Fee summary card HTML.
 * @param {object} summary - from calculateAgencyFeeSummary
 * @param {function} formatCurrency
 * @param {{ dataAttrs?: boolean, canSeePricing?: boolean }} options
 */
export function renderAgencyFeeCardHtml(summary, formatCurrency, { dataAttrs = false, canSeePricing = true } = {}) {
  const resolved = resolveAgencyFeeForViewer(summary, canSeePricing);
  if (!resolved.showAgencyFeeCard) return '';

  const totalAttr = dataAttrs ? ' data-summary-value="agentur-fee-total"' : '';
  const cardAttr = dataAttrs ? ' data-summary-card="agentur-fee"' : '';

  return `
    <div class="summary-card"${cardAttr}>
      <div class="summary-value"${totalAttr}>${formatCurrency(resolved.total)}</div>
      <div class="summary-label">Agenturanteil</div>
      ${canSeePricing ? renderAgencyFeeBreakdownHtml(resolved, formatCurrency, { dataAttrs }) : ''}
    </div>`;
}

export function isCreatorKampagneInvoice(rechnung) {
  return !!rechnung && rechnung.rechnungstyp !== 'contracting';
}

/**
 * Summe nettobetrag aller bezahlten Kampagnen-Rechnungen (kein Contracting).
 */
export function sumPaidCreatorInvoices(rechnungen) {
  return (rechnungen || []).reduce((sum, r) => {
    if (!isCreatorKampagneInvoice(r)) return sum;
    if (r.status !== 'Bezahlt') return sum;
    return sum + (parseFloat(r.nettobetrag) || 0);
  }, 0);
}

/**
 * Bezahlt aus Rechnungen, Offen = Rest des gebuchten Creatoranteils.
 * Kooperationen ohne Rechnung gelten als offen.
 */
export function calculateCreatorPaymentSummary(creatorAnteil, rechnungen) {
  const share = parseFloat(creatorAnteil) || 0;
  const paid = sumPaidCreatorInvoices(rechnungen);
  return { paid, open: Math.max(0, share - paid) };
}

/**
 * Creator-Anteil Card mit Bezahlt/Offen-Breakdown (wie Agenturanteil).
 */
export function renderCreatorAnteilCardHtml(creatorAnteil, payment, formatCurrency, { dataAttrs = false, label = 'Creator-Anteil' } = {}) {
  const total = parseFloat(creatorAnteil) || 0;
  const paid = parseFloat(payment?.paid) || 0;
  const open = parseFloat(payment?.open) || 0;
  const totalAttr = dataAttrs ? ' data-summary-value="creator-anteil-total"' : '';
  const paidAttr = dataAttrs ? ' data-summary-value="creator-anteil-paid"' : '';
  const openAttr = dataAttrs ? ' data-summary-value="creator-anteil-open"' : '';
  const cardAttr = dataAttrs ? ' data-summary-card="creator-anteil"' : '';

  return `
    <div class="summary-card"${cardAttr}>
      <div class="summary-value"${totalAttr}>${formatCurrency(total)}</div>
      <div class="summary-label">${label}</div>
      <div class="summary-card-breakdown">
        <div class="summary-card-breakdown-line">
          <span>Bezahlt</span>
          <span${paidAttr}>${formatCurrency(paid)}</span>
        </div>
        <div class="summary-card-breakdown-line">
          <span>Offen</span>
          <span${openAttr}>${formatCurrency(open)}</span>
        </div>
      </div>
    </div>`;
}

/**
 * Filters kooperationen + videos to only those with a paid invoice.
 * @param {Array} kooperationen
 * @param {Array} videos
 * @param {Object} rechnungStatusMap - { kooperation_id: status }
 * @returns {{ kooperationen: Array, videos: Array }}
 */
export function filterPaidKooperationen(kooperationen, videos, rechnungStatusMap) {
  const paidIds = new Set(
    Object.entries(rechnungStatusMap || {})
      .filter(([, status]) => status === 'Bezahlt')
      .map(([id]) => id)
  );
  return {
    kooperationen: (kooperationen || []).filter(k => paidIds.has(k.id)),
    videos: (videos || []).filter(v => paidIds.has(v.kooperation_id)),
  };
}

/**
 * Renders the KSK summary card HTML.
 * Zeigt bei KSK-Selbstzahler-Kooperationen den ins Creator-Budget
 * umgebuchten Anteil und warnt, wenn der Topf ueberschritten ist.
 */
export function renderKskCardHtml(summary, formatCurrency) {
  if (!summary.showKskCard) return '';

  if (summary.kskAuto) {
    const satzAnzeige = String(KSK_SATZ_PROZENT).replace('.', ',');
    return `
    <div class="summary-card">
      <div class="summary-value">${formatCurrency(summary.kskValue)}</div>
      <div class="summary-label">KSK</div>
      <div class="summary-card-breakdown">
        <div class="summary-card-breakdown-line">
          <span>${satzAnzeige} % vom Creator-Anteil</span>
          <span>${formatCurrency(parseFloat(summary.kskBasis) || 0)}</span>
        </div>
      </div>
    </div>`;
  }

  const umgebucht = parseFloat(summary.kskUmgebucht) || 0;
  const verbleibend = (parseFloat(summary.kskValue) || 0) - umgebucht;
  const ueberschritten = verbleibend < 0;

  const breakdown = umgebucht > 0 ? `
      <div class="summary-card-breakdown">
        <div class="summary-card-breakdown-line">
          <span>Umgebucht (Selbstzahler)</span>
          <span>${formatCurrency(umgebucht)}</span>
        </div>
        <div class="summary-card-breakdown-line"${ueberschritten ? ' style="color: #dc2626; font-weight: 600;"' : ''}>
          <span>Verbleibend</span>
          <span>${formatCurrency(verbleibend)}</span>
        </div>
        ${ueberschritten ? '<div class="summary-card-breakdown-line" style="color: #dc2626;"><span>⚠ KSK-Topf überschritten</span><span></span></div>' : ''}
      </div>` : '';

  return `
    <div class="summary-card">
      <div class="summary-value">${formatCurrency(summary.kskValue)}</div>
      <div class="summary-label">KSK</div>
      ${breakdown}
    </div>`;
}
