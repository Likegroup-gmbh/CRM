// Berichtsstand.test.js
// Datenschicht der Berichtsstände (PRD Schritt 7, ADR 0006): Payload-Form,
// Sichern, Listen, Laden. Getestet wird das Ergebnis, nicht der Rechenweg.
import { describe, it, expect, vi } from 'vitest';
import {
  BERICHTSSTAND_VERSION,
  buildBerichtsstandPayload,
  saveBerichtsstand,
  fetchBerichtsstaende,
  fetchBerichtsstand,
} from '../modules/stakeholder/berichtsstandStore.js';

function mockSupabase({ insertResult, listResult, singleResult } = {}) {
  const insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve(insertResult || { data: null, error: null })),
    })),
  }));
  const select = vi.fn((cols) => ({
    order: vi.fn(() => Promise.resolve(listResult || { data: [], error: null })),
    eq: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve(singleResult || { data: null, error: null })),
    })),
  }));
  return { from: vi.fn(() => ({ insert, select })), _spies: { insert, select } };
}

describe('buildBerichtsstandPayload', () => {
  it('legt version, monatsauswertung und zahlungsstand in den Stand', () => {
    const monatsauswertung = { months: ['2026-03'], bereiche: { marge: {}, buchhaltung: {} } };
    const zahlungsstand = { kunden: { gestellt: 100 }, creator: { gestellt: 50 } };

    const payload = buildBerichtsstandPayload({ monatsauswertung, zahlungsstand });

    expect(payload.version).toBe(BERICHTSSTAND_VERSION);
    expect(payload.monatsauswertung).toEqual(monatsauswertung);
    expect(payload.zahlungsstand).toEqual(zahlungsstand);
  });

  it('ist JSON-rundlauffest (keine Funktionen/undefined im Snapshot)', () => {
    const payload = buildBerichtsstandPayload({
      monatsauswertung: { months: ['2026-03'], fn: () => 1, undef: undefined },
      zahlungsstand: { kunden: {} },
    });

    const roundtrip = JSON.parse(JSON.stringify(payload));
    expect(roundtrip).toEqual(payload);
    expect(roundtrip.monatsauswertung.fn).toBeUndefined();
    expect(roundtrip.monatsauswertung.undef).toBeUndefined();
  });
});

describe('saveBerichtsstand', () => {
  it('schreibt label, daten und created_by und gibt die Zeile zurück', async () => {
    const row = { id: 'b1', created_at: '2026-09-09T12:00:00Z', label: 'Investorenupdate September 2026' };
    const supabase = mockSupabase({ insertResult: { data: row, error: null } });
    const daten = { version: 1, monatsauswertung: {}, zahlungsstand: {} };

    const saved = await saveBerichtsstand(supabase, { label: row.label, daten, createdBy: 'user-1' });

    expect(supabase.from).toHaveBeenCalledWith('berichtsstand');
    expect(supabase._spies.insert).toHaveBeenCalledWith({
      label: row.label,
      daten,
      created_by: 'user-1',
    });
    expect(saved).toEqual(row);
  });

  it('wirft bei Fehler statt still zu versagen', async () => {
    const supabase = mockSupabase({ insertResult: { data: null, error: new Error('rls') } });
    await expect(saveBerichtsstand(supabase, { label: 'x', daten: {} })).rejects.toThrow('rls');
  });
});

describe('fetchBerichtsstaende', () => {
  it('listet neueste zuerst ohne den daten-Blob', async () => {
    const rows = [
      { id: 'b2', created_at: '2026-09-09T12:00:00Z', label: 'Neu' },
      { id: 'b1', created_at: '2026-08-09T12:00:00Z', label: 'Alt' },
    ];
    const supabase = mockSupabase({ listResult: { data: rows, error: null } });

    const list = await fetchBerichtsstaende(supabase);

    expect(supabase._spies.select).toHaveBeenCalledWith('id, created_at, label, created_by');
    expect(list).toEqual(rows);
  });

  it('liefert leere Liste statt null', async () => {
    const supabase = mockSupabase({ listResult: { data: null, error: null } });
    expect(await fetchBerichtsstaende(supabase)).toEqual([]);
  });
});

describe('fetchBerichtsstand', () => {
  it('laedt einen Stand inklusive daten', async () => {
    const row = { id: 'b1', created_at: '2026-09-09T12:00:00Z', label: 'Update', daten: { version: 1 } };
    const supabase = mockSupabase({ singleResult: { data: row, error: null } });

    const stand = await fetchBerichtsstand(supabase, 'b1');

    expect(stand).toEqual(row);
    expect(stand.daten.version).toBe(1);
  });
});
