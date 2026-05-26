// EkVkAgencyFeeHelper.js
// Shared helper for Agency Fee calculation incl. EK/VK margin aggregation.

export function isFilledPrice(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0;
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
export function calculateAgencyFeeSummary(details, kooperationen, videos) {
  const d = details || {};

  const baseFee = (d.agency_services_enabled && d.percentage_fee_enabled)
    ? (parseFloat(d.percentage_fee_value) || 0)
    : 0;

  const kskValue = (d.agency_services_enabled && d.ksk_enabled)
    ? (parseFloat(d.ksk_value) || 0)
    : 0;

  const { ekSum, vkSum, marginSum } = calculateEkVkTotals(kooperationen, videos);

  const total = baseFee + marginSum;

  const showAgencyFeeCard = true;
  const showKskCard = d.agency_services_enabled && d.ksk_enabled && kskValue > 0;

  return { baseFee, ekVkMargin: marginSum, total, kskValue, showAgencyFeeCard, showKskCard, ekSum, vkSum };
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
      <div class="summary-label">Agentur Fee</div>
      ${canSeePricing ? renderAgencyFeeBreakdownHtml(resolved, formatCurrency, { dataAttrs }) : ''}
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
 */
export function renderKskCardHtml(summary, formatCurrency) {
  if (!summary.showKskCard) return '';

  return `
    <div class="summary-card">
      <div class="summary-value">${formatCurrency(summary.kskValue)}</div>
      <div class="summary-label">KSK</div>
    </div>`;
}
