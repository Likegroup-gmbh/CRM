import { describe, it, expect } from 'vitest';
import { auftragJahr, jahresanteile, teilrechnungJahr } from '../core/budget/teilrechnungJahr.js';

// Jahreszuordnung des Investor-Dashboards: Jahr einer Teilrechnung =
// min(max(rechnung_gestellt_am, start), ende), in Europe/Berlin.

const RABONA = { id: 'rab', nettobetrag: 120000, start: '2025-10-01', ende: '2026-09-30' };

function monatsraten(auftragId, daten, betrag) {
  return daten.map((datum, i) => ({
    id: `${auftragId}-${i + 1}`,
    auftrag_id: auftragId,
    position: i + 1,
    nettobetrag: betrag,
    rechnung_gestellt: false,
    rechnung_gestellt_am: datum,
  }));
}

const summeAnteile = zeilen => zeilen.reduce((s, z) => s + z.anteil, 0);

describe('teilrechnungJahr', () => {
  it('nimmt das gepflegte Datum auch bei noch nicht gestellten Raten', () => {
    const tr = { position: 4, rechnung_gestellt: false, rechnung_gestellt_am: '2026-02-22' };
    expect(teilrechnungJahr(tr, RABONA)).toBe(2026);
  });

  it('zieht eine Vorab-Rechnung ins Startjahr', () => {
    const auftrag = { start: '2026-01-01', ende: '2026-12-31' };
    const tr = { position: 1, rechnung_gestellt: true, rechnung_gestellt_am: '2025-11-20' };
    expect(teilrechnungJahr(tr, auftrag)).toBe(2026);
  });

  it('haelt eine Rate nach dem Laufzeitende im Laufzeitjahr', () => {
    const auftrag = { start: '2026-11-01', ende: '2026-12-31' };
    const tr = { position: 2, rechnung_gestellt_am: '2027-01-15' };
    expect(teilrechnungJahr(tr, auftrag)).toBe(2026);
  });

  it('setzt Raten ohne Datum auf start + (position - 1) Monate', () => {
    const auftrag = { start: '2026-10-01' };
    expect(teilrechnungJahr({ position: 3 }, auftrag)).toBe(2026);
    expect(teilrechnungJahr({ position: 4 }, auftrag)).toBe(2027);
  });

  it('klemmt den Fallback ohne Datum ebenfalls auf ende', () => {
    const auftrag = { start: '2026-10-01', ende: '2026-12-31' };
    expect(teilrechnungJahr({ position: 6 }, auftrag)).toBe(2026);
  });

  it('nimmt ohne position den Index als Position', () => {
    const auftrag = { start: '2026-12-01' };
    expect(teilrechnungJahr({}, auftrag, 0)).toBe(2026);
    expect(teilrechnungJahr({}, auftrag, 1)).toBe(2027);
  });

  it('klemmt ohne ende nicht nach oben', () => {
    const auftrag = { start: '2026-07-01' };
    expect(teilrechnungJahr({ rechnung_gestellt_am: '2027-03-01' }, auftrag)).toBe(2027);
  });

  it('ignoriert ein ende vor start (Tippfehler im Jahr)', () => {
    const auftrag = { start: '2026-05-13', ende: '0026-12-11' };
    expect(teilrechnungJahr({ rechnung_gestellt_am: '2026-06-01' }, auftrag)).toBe(2026);
    expect(teilrechnungJahr({ position: 1 }, auftrag)).toBe(2026);
  });

  it('nimmt created_at als start, wenn start fehlt', () => {
    const auftrag = { start: null, created_at: '2026-07-21T09:00:00Z' };
    expect(teilrechnungJahr({ rechnung_gestellt_am: '2025-12-01' }, auftrag)).toBe(2026);
    expect(auftragJahr(auftrag)).toBe(2026);
  });

  it('bestimmt das Jahr in Berlin, nicht in UTC', () => {
    const auftrag = { start: '2025-06-01' };
    // 31.12.2025 23:30 UTC ist in Berlin schon der 1.1.2026.
    expect(teilrechnungJahr({ rechnung_gestellt_am: '2025-12-31T23:30:00Z' }, auftrag)).toBe(2026);
    expect(teilrechnungJahr({ rechnung_gestellt_am: '2025-12-31T22:30:00Z' }, auftrag)).toBe(2025);
  });
});

describe('jahresanteile', () => {
  it('verteilt Rabona 3/9 auf 2025 und 2026', () => {
    const raten = monatsraten('rab', [
      '2025-10-20', '2025-11-24', '2025-12-18', '2026-02-22', '2026-03-06', '2026-03-15',
      '2026-04-26', '2026-06-13', '2026-06-13', '2026-08-06', '2026-08-06', '2026-09-20',
    ], 10000);

    const zeilen = jahresanteile(RABONA, raten);

    expect(zeilen.map(z => z.jahr)).toEqual([2025, 2026]);
    expect(zeilen[0].anteil).toBeCloseTo(0.25, 10);
    expect(zeilen[1].anteil).toBeCloseTo(0.75, 10);
    expect(zeilen[0].teilrechnungIds).toEqual(['rab-1', 'rab-2', 'rab-3']);
    expect(zeilen[1].teilrechnungIds).toHaveLength(9);
  });

  it('mischt datierte und undatierte Raten nach Position', () => {
    const auftrag = { id: 'mix', nettobetrag: 4000, start: '2026-11-01' };
    const raten = [
      { id: 't1', position: 1, nettobetrag: 1000, rechnung_gestellt_am: '2026-11-10' },
      { id: 't2', position: 2, nettobetrag: 1000, rechnung_gestellt_am: null },
      { id: 't3', position: 3, nettobetrag: 2000, rechnung_gestellt_am: null },
    ];
    const zeilen = jahresanteile(auftrag, raten);
    expect(zeilen).toEqual([
      { jahr: 2026, anteil: 0.5, teilrechnungIds: ['t1', 't2'] },
      { jahr: 2027, anteil: 0.5, teilrechnungIds: ['t3'] },
    ]);
  });

  it('sortiert nach position, nicht nach Lieferreihenfolge', () => {
    const auftrag = { id: 's', nettobetrag: 2000, start: '2026-12-01' };
    const raten = [
      { id: 'zwei', position: 2, nettobetrag: 500 },
      { id: 'eins', position: 1, nettobetrag: 1500 },
    ];
    const zeilen = jahresanteile(auftrag, raten);
    expect(zeilen.find(z => z.jahr === 2026).teilrechnungIds).toEqual(['eins']);
    expect(zeilen.find(z => z.jahr === 2026).anteil).toBeCloseTo(0.75, 10);
  });

  it('liefert ohne Teilrechnungen eine Zeile im Startjahr', () => {
    expect(jahresanteile({ start: '2026-03-01' }, [])).toEqual([
      { jahr: 2026, anteil: 1, teilrechnungIds: [] },
    ]);
  });

  it('liefert bei Summe 0 eine Zeile im Startjahr mit allen Raten', () => {
    const raten = [
      { id: 'n1', position: 1, nettobetrag: 0, rechnung_gestellt_am: '2027-02-01' },
      { id: 'n2', position: 2, nettobetrag: 0 },
    ];
    expect(jahresanteile({ start: '2026-03-01' }, raten)).toEqual([
      { jahr: 2026, anteil: 1, teilrechnungIds: ['n1', 'n2'] },
    ]);
  });

  it('haengt Raten ohne Betrag in einem Jahr ohne Zeile an die groesste Zeile', () => {
    const auftrag = { start: '2026-07-01' };
    const raten = [
      { id: 'a', position: 1, nettobetrag: 3000, rechnung_gestellt_am: '2026-08-01' },
      { id: 'b', position: 2, nettobetrag: 1000, rechnung_gestellt_am: '2027-01-10' },
      { id: 'leer', position: 3, nettobetrag: 0, rechnung_gestellt_am: '2028-01-10' },
    ];
    const zeilen = jahresanteile(auftrag, raten);
    expect(zeilen.map(z => z.jahr)).toEqual([2026, 2027]);
    expect(zeilen[0].teilrechnungIds).toEqual(['a', 'leer']);
  });

  it('summiert die Anteile eines Auftrags immer zu 1', () => {
    const auftrag = { start: '2026-07-01', ende: '2027-07-30' };
    const raten = monatsraten('jun', [
      '2026-09-20', '2026-09-20', '2026-10-18', '2026-11-20', '2026-11-20', '2026-12-20',
      '2027-01-20', '2027-02-20', '2027-03-20', '2027-04-20', '2027-05-20', '2027-06-20',
    ], 30980);
    expect(summeAnteile(jahresanteile(auftrag, raten))).toBeCloseTo(1, 12);
  });
});
