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

  const showAgencyFeeCard = total > 0;
  const showKskCard = d.agency_services_enabled && d.ksk_enabled && kskValue > 0;

  return { baseFee, ekVkMargin: marginSum, total, kskValue, showAgencyFeeCard, showKskCard, ekSum, vkSum };
}

/**
 * Renders the Agency Fee summary card HTML with breakdown lines.
 * @param {object} summary - from calculateAgencyFeeSummary
 * @param {function} formatCurrency
 */
export function renderAgencyFeeCardHtml(summary, formatCurrency) {
  if (!summary.showAgencyFeeCard) return '';

  const hasBase = summary.baseFee > 0;
  const hasMargin = summary.ekVkMargin !== 0;
  const showBreakdown = hasBase && hasMargin;

  let breakdownHtml = '';
  if (showBreakdown) {
    breakdownHtml = `
      <div class="summary-card-breakdown">
        <div class="summary-card-breakdown-line">
          <span>Festgelegt</span>
          <span>${formatCurrency(summary.baseFee)}</span>
        </div>
        <div class="summary-card-breakdown-line">
          <span>EK/VK-Differenz</span>
          <span>${formatCurrency(summary.ekVkMargin)}</span>
        </div>
      </div>`;
  }

  return `
    <div class="summary-card">
      <div class="summary-value">${formatCurrency(summary.total)}</div>
      <div class="summary-label">Agentur Fee</div>
      ${breakdownHtml}
    </div>`;
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
