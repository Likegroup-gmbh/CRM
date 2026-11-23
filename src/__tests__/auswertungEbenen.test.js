import { describe, expect, it } from 'vitest';
import { baueModell } from '../modules/auswertung/auswertungModell.js';
import { renderTabellenZeilen } from '../modules/auswertung/auswertungTabelle.js';

const ORGANIC = { id: 'l1', name: 'Organic' };
const PAID = { id: 'l2', name: 'Paid' };
const P1 = { id: 'p1', name: 'Q4 Slushi', linien: [ORGANIC, PAID] };
const P2 = { id: 'p2', name: 'Q4 Shorts', linien: [] };

const einheit = (id, produktion, linie) => ({
  id: `video:${id}`, art: 'video', label: `Video ${id}`, titel: `Hook ${id}`, erwartet: true,
  produktion: { id: produktion.id, name: produktion.name }, linie,
  creator: { id: `c-${id}`, name: `Creator ${id}` }, dateien: [], tags: { persona: [], ansatz: [], plattform: [] }
});

const post = (id, views) => ({
  id: `post-${id}`, einheitId: `video:${id}`, status: 'confirmed', plattform: 'tiktok', metrics: { views }
});

// c: Kooperation ohne Linie (V1), gehört zu jeder Linie der Produktion
const basis = {
  einheiten: [einheit('a', P1, ORGANIC), einheit('b', P1, PAID), einheit('c', P1, null), einheit('d', P2, null)],
  posts: [post('a', 100), post('b', 200), post('c', 50), post('d', 1000)],
  verbrauch: [
    { id: 'k1', produktionId: 'p1', briefingId: 'l1', betrag: 300 },
    { id: 'k2', produktionId: 'p1', briefingId: 'l2', betrag: 500 },
    { id: 'k3', produktionId: 'p2', briefingId: null, betrag: 1000 }
  ],
  produktionen: [P1, P2]
};

const ids = (modell) => modell.einheiten.map(e => e.id);

describe('Ebenen der Auswertung', () => {
  it('Linie: nur die Einheiten der Linie plus die ohne Linie, Verbrauch der Linie', () => {
    const m = baueModell(basis, { ebene: 'linie', produktionId: 'p1', linieId: 'l1' });
    expect(ids(m)).toEqual(['video:a', 'video:c']);
    expect(m.kennzahlen.aufrufe).toBe(150);
    expect(m.kennzahlen.verbrauch).toBe(300);
    expect(m.titel).toBe('Q4 Slushi · Organic');
    expect(m.mitLinien).toBe(false);
  });

  it('Produktion: alle Linien, die gewählte Linie filtert nicht', () => {
    const m = baueModell(basis, { ebene: 'produktion', produktionId: 'p1', linieId: 'l1' });
    expect(ids(m)).toEqual(['video:a', 'video:b', 'video:c']);
    expect(m.kennzahlen.aufrufe).toBe(350);
    expect(m.kennzahlen.verbrauch).toBe(800);
    expect(m.titel).toBe('Q4 Slushi · Alle Linien');
    expect(m.mitLinien).toBe(true);
  });

  it('Kampagne: alle Produktionen', () => {
    const m = baueModell(basis, { ebene: 'kampagne', produktionId: 'p1', linieId: 'l1' });
    expect(ids(m)).toHaveLength(4);
    expect(m.kennzahlen.aufrufe).toBe(1350);
    expect(m.kennzahlen.verbrauch).toBe(1800);
    expect(m.titel).toBe('Gesamte Kampagne');
    expect(m.mitLinien).toBe(false);
  });

  it('eine unbekannte Linie zeigt die ganze Produktion', () => {
    const m = baueModell(basis, { ebene: 'linie', produktionId: 'p1', linieId: 'weg' });
    expect(ids(m)).toEqual(['video:a', 'video:b', 'video:c']);
    expect(m.linie).toBeNull();
  });

  it('die Post-Zeile nennt auf Ebene Produktion die Linie, auf Ebene Kampagne die Produktion', () => {
    const produktion = renderTabellenZeilen(baueModell(basis, { ebene: 'produktion', produktionId: 'p1' }));
    expect(produktion).toContain('Organic');
    expect(produktion).toContain('Paid');

    const linie = renderTabellenZeilen(baueModell(basis, { ebene: 'linie', produktionId: 'p1', linieId: 'l1' }));
    expect(linie).not.toContain('Organic');

    const kampagne = renderTabellenZeilen(baueModell(basis, { ebene: 'kampagne' }));
    expect(kampagne).toContain('Q4 Shorts');
    expect(kampagne).not.toContain('Organic');
  });
});
