import { describe, it, expect, vi } from 'vitest';
import {
  applyFinalisiertFilter,
  isFinalisiert,
  isFinalAuftrag,
  FINAL_AUFTRAG_OR_FILTER
} from '../core/finalisiert.js';

function mockQuery() {
  const calls = { eq: [], or: [] };
  const query = {
    eq: vi.fn((col, val) => {
      calls.eq.push([col, val]);
      return query;
    }),
    or: vi.fn((expr) => {
      calls.or.push(expr);
      return query;
    })
  };
  return { query, calls };
}

describe('finalisiert', () => {
  it('isFinalisiert: nur is_draft === true faellt raus', () => {
    expect(isFinalisiert({ is_draft: true })).toBe(false);
    expect(isFinalisiert({ is_draft: false })).toBe(true);
    expect(isFinalisiert({ is_draft: null })).toBe(true);
    expect(isFinalisiert({})).toBe(true);
    expect(isFinalAuftrag({ is_draft: true })).toBe(false);
  });

  it('Briefing und Vertrag: eq is_draft false', () => {
    for (const table of ['campaign_briefings', 'vertraege']) {
      const { query, calls } = mockQuery();
      const result = applyFinalisiertFilter(query, table);
      expect(result).toBe(query);
      expect(calls.eq).toEqual([['is_draft', false]]);
      expect(calls.or).toEqual([]);
    }
  });

  it('Auftrag: null oder false (Altbestand)', () => {
    const { query, calls } = mockQuery();
    applyFinalisiertFilter(query, 'auftrag');
    expect(calls.or).toEqual([FINAL_AUFTRAG_OR_FILTER]);
    expect(calls.eq).toEqual([]);
  });

  it('andere Tabelle: no-op', () => {
    const { query, calls } = mockQuery();
    expect(applyFinalisiertFilter(query, 'personas')).toBe(query);
    expect(calls.eq).toEqual([]);
    expect(calls.or).toEqual([]);
  });
});
