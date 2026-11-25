// LegacyLinienValidate.test.js
// Geld- und Vertrags-Validierung, CSV-Bericht und Kontextaufbau der Altbestand-Migration.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { vergleiche } = require('../../scripts/legacy-linien/validate.cjs');
const { toCsv, parseCsv, berichtZeilen, KAMPAGNEN_SPALTEN } = require('../../scripts/legacy-linien/report.cjs');
const { planKampagne } = require('../../scripts/legacy-linien/planner.cjs');
const { baueKontexte, istAktiv } = require('../../scripts/legacy-linien-migration.js');

function messung(overrides = {}) {
  return {
    kampagne: { volumen: 1000, creator_budget: 800, is_completed: false },
    produktionen: [{ id: 'p1', budget: null }],
    koops: [
      { id: 'a', kampagne_id: 'k1', briefing_id: null, produktion_id: null, verkaufspreis_netto: 100, einkaufspreis_netto: 60, status: 'x', status_id: 's', vertrag_unterschrieben: false, videoanzahl: 1 },
    ],
    videos: [{ id: 'v1', kooperation_id: 'a', verkaufspreis_netto: 100, einkaufspreis_netto: 60 }],
    rechnungen: [{ id: 'r1', auftrag_id: 'au', netto: 50, vertrag_id: null }],
    vertraege: [{ id: 'vt', kampagne_id: 'k1', produktion_id: null, kooperation_id: 'a', typ: 'Creator' }],
    vertragKoopAnzahl: 1,
    ...overrides,
  };
}

function nachher(vor, aenderung = () => {}) {
  const n = JSON.parse(JSON.stringify(vor));
  n.koops[0].briefing_id = 'b1';
  n.koops[0].produktion_id = 'p1';
  n.vertraege[0].produktion_id = 'p1';
  aenderung(n);
  return n;
}

const erwartet = {
  koops: new Map([['a', { briefingId: 'b1', produktionId: 'p1' }]]),
  vertraege: new Map([['vt', 'p1']]),
};

describe('vergleiche', () => {
  it('akzeptiert eine saubere Zuordnung', () => {
    const vor = messung();
    expect(vergleiche(vor, nachher(vor), erwartet)).toEqual([]);
  });

  it('meldet geaenderte Preise, Rechnungen, Budgets und Topf', () => {
    const vor = messung();
    const fehler = vergleiche(vor, nachher(vor, n => {
      n.koops[0].verkaufspreis_netto = 101;
      n.rechnungen[0].netto = 49;
      n.produktionen[0].budget = 500;
      n.kampagne.creator_budget = 700;
      n.kampagne.is_completed = true;
    }), erwartet);
    const text = fehler.join('\n');
    expect(text).toContain('verkaufspreis_netto');
    expect(text).toContain('Rechnungen Auftrag au');
    expect(text).toContain('Budget');
    expect(text).toContain('creator_budget');
    expect(text).toContain('is_completed');
  });

  it('meldet Vertraege mit falscher Produktion, geaenderter Kooperation oder neuem vertrag_kooperation', () => {
    const vor = messung();
    const fehler = vergleiche(vor, nachher(vor, n => {
      n.vertraege[0].produktion_id = 'p-falsch';
      n.vertraege[0].kooperation_id = 'b';
      n.vertragKoopAnzahl = 2;
    }), erwartet);
    const text = fehler.join('\n');
    expect(text).toContain('erwartet p1');
    expect(text).toContain('kooperation_id geaendert');
    expect(text).toContain('vertrag_kooperation');
  });

  it('meldet Kooperationen ausserhalb des Plans und Linie ohne Produktion', () => {
    const vor = messung({
      koops: [
        { id: 'a', kampagne_id: 'k1', briefing_id: null, produktion_id: null, verkaufspreis_netto: 1, einkaufspreis_netto: 1, status: 'x', status_id: 's', vertrag_unterschrieben: false, videoanzahl: 1 },
        { id: 'b', kampagne_id: 'k1', briefing_id: null, produktion_id: 'p1', verkaufspreis_netto: 1, einkaufspreis_netto: 1, status: 'x', status_id: 's', vertrag_unterschrieben: false, videoanzahl: 1 },
      ],
    });
    const n = nachher(vor, x => { x.koops[1].briefing_id = 'b1'; x.koops[1].produktion_id = null; });
    const text = vergleiche(vor, n, erwartet).join('\n');
    expect(text).toContain('ausserhalb des Plans');
    expect(text).toContain('hat die Produktion verloren');
  });

  it('neue Produktionen duerfen kein Budget haben', () => {
    const vor = messung();
    const text = vergleiche(vor, nachher(vor, n => n.produktionen.push({ id: 'p2', budget: 10 })), erwartet).join('\n');
    expect(text).toContain('Neue Produktion p2 hat ein Budget');
  });

  it('bewusst liegengelassene Kooperationen ohne Produktion sind erlaubt', () => {
    const vor = messung();
    const n = JSON.parse(JSON.stringify(vor));
    expect(vergleiche(vor, n, { koopsOhneProduktion: ['a'] })).toEqual([]);
  });
});

describe('Bericht und Kontext', () => {
  const roh = {
    kampagnen: [{ id: 'k1', kampagnenname: 'Demo', eigener_name: null, art_der_kampagne: [], auftrag_id: 'au', unternehmen_id: 'u', marke_id: null }],
    auftraege: [{ id: 'au', creator_budget: 1000, nettobetrag: 2000 }],
    produktionen: [{ id: 'p1', kampagne_id: 'k1', name: 'Demo', budget: null, created_at: '1' }],
    briefings: [],
    castings: [{ id: 'c1', name: 'Demo Casting', briefing_id: null, kampagne_id: 'k1', created_at: '1', updated_at: '2020-01-01T00:00:00Z' }],
    konzepte: [],
    castingItems: [],
    strategieItems: [],
    koops: [{ id: 'a', kampagne_id: 'k1', creator_id: 'cr', briefing_id: null, produktion_id: 'p1', created_at: '1', updated_at: '2020-01-01T00:00:00Z' }],
    tagTypen: [{ id: 't1', name: 'Sommer' }, { id: 't2', name: '2026' }],
    koopTags: [{ kooperation_id: 'a', tag_id: 't1' }, { kooperation_id: 'a', tag_id: 't2' }],
    videos: [],
    skripte: [],
    vertragKoops: [],
    vertraege: [],
  };

  it('baut Kontexte mit Tag-Namen und plant daraus', () => {
    const ctx = baueKontexte(roh).get('k1');
    expect(ctx.koops[0].tags).toEqual(['Sommer', '2026']);
    expect(ctx.kampagne.auftrag.creator_budget).toBe(1000);
    const plan = planKampagne(ctx);
    expect(plan.status).toBe('auto');
    expect(plan.produktionen[0]).toMatchObject({ id: 'p1', neu: false });
  });

  it('erkennt Kampagnen mit Aktivitaet in der letzten Stunde', () => {
    const ctx = baueKontexte(roh).get('k1');
    expect(istAktiv(ctx, Date.parse('2026-10-26T12:00:00Z'))).toBe(false);
    ctx.koops[0].updated_at = '2026-10-26T11:30:00Z';
    expect(istAktiv(ctx, Date.parse('2026-10-26T12:00:00Z'))).toBe(true);
  });

  it('schreibt CSV, die sich wieder einlesen laesst (Freigabe-Spalte)', () => {
    const plan = planKampagne(baueKontexte(roh).get('k1'));
    const { kampagnen, linien, koops } = berichtZeilen([plan], { casting: new Map([['c1', 'Demo Casting']]), konzept: new Map() });
    expect(linien[0].casting).toBe('Demo Casting');
    expect(koops).toHaveLength(1);
    kampagnen[0].freigabe = 'ja';
    const gelesen = parseCsv(toCsv(KAMPAGNEN_SPALTEN, kampagnen));
    expect(gelesen[0]).toMatchObject({ kampagne_id: 'k1', status: 'auto', freigabe: 'ja' });
  });
});
