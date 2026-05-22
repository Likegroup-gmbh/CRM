import { describe, it, expect } from 'vitest';
import {
  isFilledPrice,
  collectEkVkPriceRows,
  calculateEkVkTotals,
  calculateAgencyFeeSummary,
  resolveAgencyFeeForViewer,
  filterPaidKooperationen,
  renderAgencyFeeCardHtml,
  renderKskCardHtml,
} from '../core/budget/EkVkAgencyFeeHelper.js';

describe('isFilledPrice', () => {
  it('returns true for positive numbers', () => {
    expect(isFilledPrice(100)).toBe(true);
    expect(isFilledPrice('50.5')).toBe(true);
  });

  it('returns false for 0, null, undefined, empty string', () => {
    expect(isFilledPrice(0)).toBe(false);
    expect(isFilledPrice(null)).toBe(false);
    expect(isFilledPrice(undefined)).toBe(false);
    expect(isFilledPrice('')).toBe(false);
    expect(isFilledPrice(-10)).toBe(false);
  });
});

describe('collectEkVkPriceRows', () => {
  it('uses video-level when videos exist for a kooperation', () => {
    const koops = [{ id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 200 }];
    const videos = [
      { kooperation_id: 'k1', einkaufspreis_netto: 40, verkaufspreis_netto: 80 },
      { kooperation_id: 'k1', einkaufspreis_netto: 60, verkaufspreis_netto: 120 },
    ];
    const rows = collectEkVkPriceRows(koops, videos);
    expect(rows).toEqual([
      { ekNetto: 40, vkNetto: 80 },
      { ekNetto: 60, vkNetto: 120 },
    ]);
  });

  it('falls back to kooperation-level when no videos', () => {
    const koops = [{ id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 200 }];
    const rows = collectEkVkPriceRows(koops, []);
    expect(rows).toEqual([{ ekNetto: 100, vkNetto: 200 }]);
  });

  it('handles mixed: some koops with videos, some without', () => {
    const koops = [
      { id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 200 },
      { id: 'k2', einkaufspreis_netto: 50, verkaufspreis_netto: 80 },
    ];
    const videos = [{ kooperation_id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 200 }];
    const rows = collectEkVkPriceRows(koops, videos);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ ekNetto: 100, vkNetto: 200 });
    expect(rows[1]).toEqual({ ekNetto: 50, vkNetto: 80 });
  });
});

describe('calculateEkVkTotals', () => {
  it('sums EK, VK and calculates margin only for valid pairs (both > 0)', () => {
    const koops = [{ id: 'k1' }];
    const videos = [
      { kooperation_id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 200 },
      { kooperation_id: 'k1', einkaufspreis_netto: 50, verkaufspreis_netto: 80 },
    ];
    const result = calculateEkVkTotals(koops, videos);
    expect(result.ekSum).toBe(150);
    expect(result.vkSum).toBe(280);
    expect(result.marginSum).toBe(130);
  });

  it('ignores margin when EK is 0 and VK is set', () => {
    const koops = [{ id: 'k1', einkaufspreis_netto: 0, verkaufspreis_netto: 2000 }];
    const result = calculateEkVkTotals(koops, []);
    expect(result.ekSum).toBe(0);
    expect(result.vkSum).toBe(2000);
    expect(result.marginSum).toBe(0);
  });

  it('ignores margin when VK is null', () => {
    const koops = [{ id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: null }];
    const result = calculateEkVkTotals(koops, []);
    expect(result.marginSum).toBe(0);
  });

  it('returns zeros for empty data', () => {
    const result = calculateEkVkTotals([], []);
    expect(result).toEqual({ ekSum: 0, vkSum: 0, marginSum: 0, rows: [] });
  });
});

describe('calculateAgencyFeeSummary', () => {
  it('combines base fee and EK/VK margin', () => {
    const details = { agency_services_enabled: true, percentage_fee_enabled: true, percentage_fee_value: '500' };
    const koops = [{ id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 300 }];
    const result = calculateAgencyFeeSummary(details, koops, []);
    expect(result.baseFee).toBe(500);
    expect(result.ekVkMargin).toBe(200);
    expect(result.total).toBe(700);
    expect(result.showAgencyFeeCard).toBe(true);
  });

  it('shows card when only margin exists (no base fee)', () => {
    const details = {};
    const koops = [{ id: 'k1', einkaufspreis_netto: 100, verkaufspreis_netto: 300 }];
    const result = calculateAgencyFeeSummary(details, koops, []);
    expect(result.baseFee).toBe(0);
    expect(result.ekVkMargin).toBe(200);
    expect(result.total).toBe(200);
    expect(result.showAgencyFeeCard).toBe(true);
  });

  it('hides card when nothing contributes', () => {
    const details = {};
    const result = calculateAgencyFeeSummary(details, [], []);
    expect(result.showAgencyFeeCard).toBe(false);
  });

  it('shows KSK card when enabled and value > 0', () => {
    const details = { agency_services_enabled: true, ksk_enabled: true, ksk_value: '250' };
    const result = calculateAgencyFeeSummary(details, [], []);
    expect(result.showKskCard).toBe(true);
    expect(result.kskValue).toBe(250);
  });

  it('hides KSK card when value is 0', () => {
    const details = { agency_services_enabled: true, ksk_enabled: true, ksk_value: '0' };
    const result = calculateAgencyFeeSummary(details, [], []);
    expect(result.showKskCard).toBe(false);
  });
});

describe('resolveAgencyFeeForViewer', () => {
  it('returns summary unchanged for internal users (canSeePricing=true)', () => {
    const summary = { baseFee: 500, ekVkMargin: 200, total: 700, showAgencyFeeCard: true };
    const result = resolveAgencyFeeForViewer(summary, true);
    expect(result).toBe(summary);
  });

  it('reduces to baseFee for Kunden (canSeePricing=false)', () => {
    const summary = { baseFee: 500, ekVkMargin: 200, total: 700, showAgencyFeeCard: true };
    const result = resolveAgencyFeeForViewer(summary, false);
    expect(result.total).toBe(500);
    expect(result.ekVkMargin).toBe(0);
    expect(result.showAgencyFeeCard).toBe(true);
  });

  it('hides card for Kunden when baseFee is 0', () => {
    const summary = { baseFee: 0, ekVkMargin: 200, total: 200, showAgencyFeeCard: true };
    const result = resolveAgencyFeeForViewer(summary, false);
    expect(result.total).toBe(0);
    expect(result.showAgencyFeeCard).toBe(false);
  });
});

describe('renderAgencyFeeCardHtml', () => {
  const fmt = (v) => `${v} €`;

  it('returns empty string when card should not show', () => {
    const summary = { showAgencyFeeCard: false, baseFee: 0, ekVkMargin: 0, total: 0 };
    expect(renderAgencyFeeCardHtml(summary, fmt)).toBe('');
  });

  it('renders breakdown even when only base fee', () => {
    const summary = { showAgencyFeeCard: true, baseFee: 500, ekVkMargin: 0, total: 500 };
    const html = renderAgencyFeeCardHtml(summary, fmt);
    expect(html).toContain('500 €');
    expect(html).toContain('Agentur Fee');
    expect(html).toContain('Festgelegt');
    expect(html).toContain('EK/VK-Differenz');
    expect(html).toContain('0 €');
  });

  it('renders breakdown even when only EK/VK margin', () => {
    const summary = { showAgencyFeeCard: true, baseFee: 0, ekVkMargin: 200, total: 200 };
    const html = renderAgencyFeeCardHtml(summary, fmt);
    expect(html).toContain('Festgelegt');
    expect(html).toContain('0 €');
    expect(html).toContain('EK/VK-Differenz');
    expect(html).toContain('200 €');
  });

  it('renders with breakdown when both base and margin', () => {
    const summary = { showAgencyFeeCard: true, baseFee: 500, ekVkMargin: 200, total: 700 };
    const html = renderAgencyFeeCardHtml(summary, fmt);
    expect(html).toContain('700 €');
    expect(html).toContain('Festgelegt');
    expect(html).toContain('500 €');
    expect(html).toContain('EK/VK-Differenz');
    expect(html).toContain('200 €');
  });

  it('shows only baseFee without breakdown for Kunden (canSeePricing=false)', () => {
    const summary = { showAgencyFeeCard: true, baseFee: 500, ekVkMargin: 200, total: 700 };
    const html = renderAgencyFeeCardHtml(summary, fmt, { canSeePricing: false });
    expect(html).toContain('500 €');
    expect(html).toContain('Agentur Fee');
    expect(html).not.toContain('Festgelegt');
    expect(html).not.toContain('EK/VK-Differenz');
  });

  it('returns empty for Kunden when baseFee is 0 (even with margin)', () => {
    const summary = { showAgencyFeeCard: true, baseFee: 0, ekVkMargin: 200, total: 200 };
    const html = renderAgencyFeeCardHtml(summary, fmt, { canSeePricing: false });
    expect(html).toBe('');
  });
});

describe('filterPaidKooperationen', () => {
  it('includes only kooperationen with Bezahlt status', () => {
    const koops = [{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }];
    const videos = [
      { kooperation_id: 'k1', einkaufspreis_netto: 100 },
      { kooperation_id: 'k2', einkaufspreis_netto: 200 },
      { kooperation_id: 'k3', einkaufspreis_netto: 300 },
    ];
    const statusMap = { k1: 'Bezahlt', k2: 'Offen', k3: 'Bezahlt' };
    const result = filterPaidKooperationen(koops, videos, statusMap);
    expect(result.kooperationen).toHaveLength(2);
    expect(result.kooperationen.map(k => k.id)).toEqual(['k1', 'k3']);
    expect(result.videos).toHaveLength(2);
    expect(result.videos.map(v => v.kooperation_id)).toEqual(['k1', 'k3']);
  });

  it('excludes kooperationen without any rechnung', () => {
    const koops = [{ id: 'k1' }, { id: 'k2' }];
    const videos = [{ kooperation_id: 'k1' }, { kooperation_id: 'k2' }];
    const statusMap = { k1: 'Bezahlt' };
    const result = filterPaidKooperationen(koops, videos, statusMap);
    expect(result.kooperationen).toHaveLength(1);
    expect(result.kooperationen[0].id).toBe('k1');
    expect(result.videos).toHaveLength(1);
  });

  it('returns empty arrays when no kooperation is paid', () => {
    const koops = [{ id: 'k1' }];
    const videos = [{ kooperation_id: 'k1' }];
    const result = filterPaidKooperationen(koops, videos, { k1: 'Offen' });
    expect(result.kooperationen).toHaveLength(0);
    expect(result.videos).toHaveLength(0);
  });

  it('handles empty/null inputs gracefully', () => {
    const result = filterPaidKooperationen(null, null, null);
    expect(result.kooperationen).toEqual([]);
    expect(result.videos).toEqual([]);
  });
});

describe('renderKskCardHtml', () => {
  const fmt = (v) => `${v} €`;

  it('returns empty string when card should not show', () => {
    expect(renderKskCardHtml({ showKskCard: false, kskValue: 0 }, fmt)).toBe('');
  });

  it('renders KSK card with value', () => {
    const html = renderKskCardHtml({ showKskCard: true, kskValue: 250 }, fmt);
    expect(html).toContain('250 €');
    expect(html).toContain('KSK');
  });
});
