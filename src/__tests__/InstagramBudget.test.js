import { describe, it, expect } from 'vitest';
import {
  parseAppUsage,
  sanitizeUsage,
  pagingPlan,
  budgetDecision,
  PAGE_TIGHT,
  DEFER_AT
} from '../../netlify/functions/_shared/instagram-budget.js';

describe('Instagram-Kontingent', () => {
  it('liest X-App-Usage und verwirft Muell', () => {
    expect(parseAppUsage('{"call_count":12,"total_time":40,"total_cputime":7}')).toEqual({
      call_count: 12,
      total_time: 40,
      total_cputime: 7
    });
    expect(parseAppUsage('')).toBeNull();
    expect(parseAppUsage('nope')).toBeNull();
    expect(parseAppUsage('{"call_count":0,"total_time":0,"total_cputime":0}')).toBeNull();
  });

  it('nimmt vom Client nur die drei Prozentfelder', () => {
    expect(sanitizeUsage({ total_time: 60, access_token: 'x' })).toEqual({
      call_count: 0,
      total_time: 60,
      total_cputime: 0
    });
    expect(sanitizeUsage(null)).toBeNull();
  });

  it('drosselt die Seitenzahl, je voller das Kontingent ist', () => {
    expect(pagingPlan(null).maxPages).toBe(3);
    expect(pagingPlan({ total_time: 20 }).maxPages).toBe(3);
    expect(pagingPlan({ call_count: 55 }).maxPages).toBe(2);
    expect(pagingPlan({ total_time: PAGE_TIGHT }).maxPages).toBe(1);
    expect(pagingPlan({ total_cputime: 100 }).maxPages).toBe(1);
  });

  it('weicht kurz vor dem Anschlag auf den Pool aus und fragt neue Creator nicht mehr an', () => {
    const hot = { total_time: DEFER_AT };
    expect(budgetDecision({ usage: hot, hasPool: true, force: false })).toBe('pool');
    expect(budgetDecision({ usage: hot, hasPool: false, force: false })).toBe('defer');
    expect(budgetDecision({ usage: hot, hasPool: false, force: true })).toBe('fetch');
    expect(budgetDecision({ usage: { total_time: 40 }, hasPool: false, force: false })).toBe('fetch');
    expect(budgetDecision({ usage: null, hasPool: false, force: false })).toBe('fetch');
  });
});
