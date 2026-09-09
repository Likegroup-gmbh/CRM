import { describe, it, expect } from 'vitest';
import { calculateDatenqualitaet, DATENQUALITAET_PRUEFUNGEN } from '../core/budget/datenqualitaet.js';

// Datenqualitaetsanzeige (PRD Schritt 9): findet Pflegemaengel, die
// Finanzzahlen verfaelschen, gruppiert nach Kampagne und sortiert nach
// betroffenem Geldvolumen. EK gleich VK ist ausdruecklich KEIN Mangel
// (Fee-Modell bei Influencer Marketing, siehe PRD).

const auftrag = (over = {}) => ({
  id: 'a1',
  auftragsname: 'Auftrag Eins',
  nettobetrag: 10000,
  auftragtype: 'UGC/Influencer',
  is_draft: false,
  ...over,
});

const block = (over = {}) => ({
  auftrag_id: 'a1',
  campaign_type: 'ugc_paid',
  umsatz_netto: 10000,
  ...over,
});

const kampagne = (over = {}) => ({
  id: 'k1',
  kampagnenname: 'Kampagne Eins',
  auftrag_id: 'a1',
  ...over,
});

const koop = (over = {}) => ({
  id: 'koop1',
  kampagne_id: 'k1',
  creator_id: 'c1',
  einkaufspreis_netto: 0,
  ksk_selbstzahler: false,
  ksk_betrag: 0,
  ...over,
});

const video = (over = {}) => ({
  id: 'v1',
  kooperation_id: 'koop1',
  einkaufspreis_netto: 400,
  verkaufspreis_netto: 800,
  kampagnenart: 'UGC Paid',
  titel: 'Video 1',
  ...over,
});

const rechnung = (over = {}) => ({
  id: 'r1',
  kooperation_id: 'koop1',
  auftrag_id: null,
  kampagne_id: null,
  nettobetrag: 1000,
  nettobetrag_steuerfrei: 0,
  gestellt_am: '2026-03-10',
  rechnung_nr: 'RE-1',
  ...over,
});

function mangelKeys(ergebnis, kampagneId = 'k1') {
  const gruppe = ergebnis.gruppen.find(g => g.kampagneId === kampagneId);
  return (gruppe?.maengel || []).map(m => m.pruefung);
}

describe('calculateDatenqualitaet', () => {
  it('meldet Videos ohne Einkaufspreis mit dem VK als betroffenem Volumen', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [auftrag()],
      blocks: [block()],
      kampagnen: [kampagne()],
      kooperationen: [koop()],
      videos: [
        video({ id: 'v1', einkaufspreis_netto: null, verkaufspreis_netto: 800 }),
        video({ id: 'v2', einkaufspreis_netto: 0, verkaufspreis_netto: 500 }),
        video({ id: 'v3', einkaufspreis_netto: 400, verkaufspreis_netto: 900 }),
      ],
    });

    const gruppe = ergebnis.gruppen.find(g => g.kampagneId === 'k1');
    const mangel = gruppe.maengel.find(m => m.pruefung === 'video_ohne_ek');
    expect(mangel.anzahl).toBe(2);
    expect(mangel.volumen).toBe(1300); // 800 + 500: am Video haengt der VK
    expect(mangel.details.map(d => d.id).sort()).toEqual(['v1', 'v2']);
    expect(ergebnis.proPruefung.video_ohne_ek.anzahl).toBe(2);
  });

  it('meldet Videos ohne Verkaufspreis mit dem EK als betroffenem Volumen', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [auftrag()],
      blocks: [block()],
      kampagnen: [kampagne()],
      kooperationen: [koop()],
      videos: [video({ id: 'v1', einkaufspreis_netto: 400, verkaufspreis_netto: null })],
    });

    const mangel = ergebnis.gruppen[0].maengel.find(m => m.pruefung === 'video_ohne_vk');
    expect(mangel.anzahl).toBe(1);
    expect(mangel.volumen).toBe(400);
  });

  it('meldet Kooperationen, deren erfasster Einkauf weniger als die Haelfte der Fakturierung deckt', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [auftrag()],
      blocks: [block()],
      kampagnen: [kampagne()],
      kooperationen: [koop()],
      videos: [video({ einkaufspreis_netto: 1000, verkaufspreis_netto: 2000 })],
      rechnungen: [rechnung({ nettobetrag: 3000 })],
    });

    const mangel = ergebnis.gruppen[0].maengel.find(m => m.pruefung === 'koop_kaum_einkauf');
    expect(mangel.anzahl).toBe(1);
    expect(mangel.volumen).toBe(2000); // Luecke: 3000 fakturiert - 1000 erfasst
    expect(mangel.details[0].extra).toEqual({ fakturiert: 3000, erfasst: 1000 });
  });

  it('meldet Kooperationen mit ausreichend erfasstem Einkauf nicht', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [auftrag()],
      blocks: [block()],
      kampagnen: [kampagne()],
      kooperationen: [koop()],
      videos: [video({ einkaufspreis_netto: 2000, verkaufspreis_netto: 3000 })],
      rechnungen: [rechnung({ nettobetrag: 2000 })],
    });

    expect(mangelKeys(ergebnis)).not.toContain('koop_kaum_einkauf');
  });

  it('meldet Videos ohne Kampagnenart nur in gemischten Auftraegen', () => {
    const gemischt = calculateDatenqualitaet({
      auftraege: [auftrag()],
      blocks: [
        block({ campaign_type: 'influencer' }),
        block({ campaign_type: 'ugc_paid' }),
      ],
      kampagnen: [kampagne()],
      kooperationen: [koop()],
      videos: [video({ kampagnenart: '  ' })],
    });
    expect(mangelKeys(gemischt)).toContain('video_ohne_kampagnenart');

    const einfach = calculateDatenqualitaet({
      auftraege: [auftrag()],
      blocks: [block()],
      kampagnen: [kampagne()],
      kooperationen: [koop()],
      videos: [video({ kampagnenart: null })],
    });
    expect(mangelKeys(einfach)).not.toContain('video_ohne_kampagnenart');
  });

  it('meldet Auftraege ohne Kampagnenart-Block mit dem Nettobetrag, Contracting ausgenommen', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [
        auftrag({ id: 'a1', nettobetrag: 50000 }),
        auftrag({ id: 'a2', auftragtype: 'Contracting', nettobetrag: 99999 }),
      ],
      blocks: [],
      kampagnen: [kampagne(), kampagne({ id: 'k2', auftrag_id: 'a2' })],
      kooperationen: [],
      videos: [],
    });

    const mangel = ergebnis.gruppen
      .find(g => g.kampagneId === 'k1')
      .maengel.find(m => m.pruefung === 'auftrag_ohne_block');
    expect(mangel.anzahl).toBe(1);
    expect(mangel.volumen).toBe(50000);
    // Contracting-Auftrag ohne Block ist kein Mangel (braucht keinen Block)
    expect(mangelKeys(ergebnis, 'k2')).not.toContain('auftrag_ohne_block');
  });

  it('meldet gemischte Auftraege ohne Block-Umsatz, aber nicht mit gepflegtem Block-Umsatz', () => {
    const ohneUmsatz = calculateDatenqualitaet({
      auftraege: [auftrag({ nettobetrag: 80000 })],
      blocks: [
        block({ campaign_type: 'influencer', umsatz_netto: null }),
        block({ campaign_type: 'ugc_paid', umsatz_netto: null }),
      ],
      kampagnen: [kampagne()],
    });
    const mangel = ohneUmsatz.gruppen[0].maengel.find(m => m.pruefung === 'gemischt_ohne_umsatz');
    expect(mangel.volumen).toBe(80000);

    const mitUmsatz = calculateDatenqualitaet({
      auftraege: [auftrag()],
      blocks: [
        block({ campaign_type: 'influencer', umsatz_netto: 6000 }),
        block({ campaign_type: 'ugc_paid', umsatz_netto: 4000 }),
      ],
      kampagnen: [kampagne()],
    });
    expect(mangelKeys(mitUmsatz)).not.toContain('gemischt_ohne_umsatz');
  });

  it('meldet Rechnungen mit Datum vor 2020 und ignoriert plausible oder fehlende Daten', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [auftrag()],
      blocks: [block()],
      kampagnen: [kampagne()],
      kooperationen: [koop()],
      videos: [video()],
      rechnungen: [
        rechnung({ id: 'r-alt', gestellt_am: '2019-05-01', nettobetrag: 1000, nettobetrag_steuerfrei: 200 }),
        rechnung({ id: 'r-ok', gestellt_am: '2026-01-15', nettobetrag: 5000 }),
        rechnung({ id: 'r-ohne', gestellt_am: null, nettobetrag: 7000 }),
      ],
    });

    const mangel = ergebnis.gruppen[0].maengel.find(m => m.pruefung === 'rechnung_unplausibel');
    expect(mangel.anzahl).toBe(1);
    expect(mangel.volumen).toBe(1200); // netto + steuerfrei
    expect(mangel.details[0].id).toBe('r-alt');
  });

  it('meldet offene Restbetraege nur bei Kooperationen mit mindestens einer Rechnung', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [auftrag()],
      blocks: [block()],
      kampagnen: [kampagne()],
      kooperationen: [koop(), koop({ id: 'koop2' })],
      videos: [
        video({ kooperation_id: 'koop1', einkaufspreis_netto: 5000 }),
        video({ id: 'v2', kooperation_id: 'koop2', einkaufspreis_netto: 7000 }),
      ],
      rechnungen: [rechnung({ nettobetrag: 2000 })],
    });

    const mangel = ergebnis.gruppen[0].maengel.find(m => m.pruefung === 'koop_restbetrag_offen');
    expect(mangel.anzahl).toBe(1);
    expect(mangel.volumen).toBe(3000); // 5000 Soll - 2000 fakturiert
    expect(mangel.details[0].id).toBe('koop1');
    // koop2 hat keine Rechnung -> noch nichts angefangen, kein Mangel
  });

  it('zaehlt auch eine 0-€-Rechnung als angefangene Fakturierung (Regel 8)', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [auftrag()],
      blocks: [block()],
      kampagnen: [kampagne()],
      kooperationen: [koop()],
      videos: [video({ einkaufspreis_netto: 5000 })],
      rechnungen: [rechnung({ nettobetrag: 0, nettobetrag_steuerfrei: 0 })],
    });

    // Eine Rechnung existiert -> die Fakturierung ist angefangen und der
    // offene Restbetrag wird gemeldet, auch wenn noch kein Euro geflossen ist.
    const mangel = ergebnis.gruppen[0].maengel.find(m => m.pruefung === 'koop_restbetrag_offen');
    expect(mangel.anzahl).toBe(1);
    expect(mangel.volumen).toBe(5000);
    // Die 50-%-Quote braucht eine positive Fakturierung als Nenner.
    expect(mangelKeys(ergebnis)).not.toContain('koop_kaum_einkauf');
  });

  it('zaehlt Mehrkampagnen-Auftraege in Karten und Summen nur einmal (Fallsicht)', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [auftrag({ nettobetrag: 10000 })],
      blocks: [], // -> auftrag_ohne_block
      kampagnen: [
        kampagne({ id: 'k1' }),
        kampagne({ id: 'k2', kampagnenname: 'Zwei' }),
      ],
    });

    // Gruppensicht: beide Kampagnen tragen denselben Auftrags-Befund.
    expect(mangelKeys(ergebnis, 'k1')).toContain('auftrag_ohne_block');
    expect(mangelKeys(ergebnis, 'k2')).toContain('auftrag_ohne_block');

    // Fallsicht: Karten und Summen zaehlen den Fall nur einmal.
    expect(ergebnis.proPruefung.auftrag_ohne_block.anzahl).toBe(1);
    expect(ergebnis.proPruefung.auftrag_ohne_block.volumen).toBe(10000);
    expect(ergebnis.summen.maengel).toBe(1);
    expect(ergebnis.summen.volumen).toBe(10000);

    // Die Gruppen-Summe darf hoeher liegen (Zuordnung auf beide Kampagnen).
    const summeGruppen = ergebnis.gruppen.reduce((s, g) => s + g.volumen, 0);
    expect(summeGruppen).toBe(20000);
  });

  it('gruppiert nach Kampagne, sammelt Waisen in "Ohne Kampagne" und sortiert nach Volumen', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [
        auftrag({ id: 'a1', nettobetrag: 1000 }),
        auftrag({ id: 'a2', auftragsname: 'Groß', nettobetrag: 90000 }),
        auftrag({ id: 'a3', auftragsname: 'Waise', nettobetrag: 5000 }),
      ],
      blocks: [], // alle drei ohne Block
      kampagnen: [kampagne({ id: 'k1', auftrag_id: 'a1' }), kampagne({ id: 'k2', auftrag_id: 'a2', kampagnenname: 'Zwei' })],
    });

    // Sortierung nach betroffenem Volumen: 90.000 (k2) vor 5.000 (Waise) vor 1.000 (k1)
    expect(ergebnis.gruppen.map(g => g.kampagneId)).toEqual(['k2', null, 'k1']);
    expect(ergebnis.gruppen[0].volumen).toBe(90000);
    expect(ergebnis.gruppen[1].name).toBe('Ohne Kampagne');
    expect(ergebnis.gruppen[2].volumen).toBe(1000);
  });

  it('berechnet den Pflegegrad als Anteil fehlerfreier gepruefter Einheiten', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [auftrag()],
      blocks: [block()],
      kampagnen: [kampagne()],
      kooperationen: [koop()],
      videos: [
        video({ id: 'v1' }),                                    // fehlerfrei
        video({ id: 'v2' }),                                    // fehlerfrei
        video({ id: 'v3', einkaufspreis_netto: null }),         // Mangel
        video({ id: 'v4', verkaufspreis_netto: null }),         // Mangel
      ],
    });

    const gruppe = ergebnis.gruppen[0];
    // Geprueft: 4 Videos + 1 Auftrag (hat Block, fehlerfrei). Kooperation
    // ohne Rechnung wird nicht geprueft.
    expect(gruppe.geprueft).toBe(5);
    expect(gruppe.fehlerfrei).toBe(3);
    expect(gruppe.pflegegrad).toBeCloseTo(0.6);
  });

  it('zeigt vollstaendig gepflegte Kampagnen mit Pflegegrad 1 und ohne Maengel', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [auftrag()],
      blocks: [block()],
      kampagnen: [kampagne()],
      kooperationen: [koop()],
      videos: [video()],
    });

    const gruppe = ergebnis.gruppen[0];
    expect(gruppe.maengel).toEqual([]);
    expect(gruppe.pflegegrad).toBe(1);
    expect(gruppe.volumen).toBe(0);
  });

  it('laesst Kampagnen ohne pruefbare Einheiten ganz weg', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [],
      kampagnen: [kampagne({ id: 'k-leer', auftrag_id: null })],
    });
    expect(ergebnis.gruppen).toEqual([]);
  });

  it('filtert Entwuerfe und ihre Videos, Kooperationen und Rechnungen heraus', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [auftrag()], // a1 ist der einzige gueltige Auftrag
      blocks: [block()],
      kampagnen: [kampagne(), kampagne({ id: 'k-draft', auftrag_id: 'a-draft' })],
      kooperationen: [koop(), koop({ id: 'koop-draft', kampagne_id: 'k-draft' })],
      videos: [
        video({ id: 'v-ok' }),
        video({ id: 'v-draft', kooperation_id: 'koop-draft', einkaufspreis_netto: null }),
      ],
      rechnungen: [rechnung({ id: 'r-draft', kooperation_id: 'koop-draft', gestellt_am: '2018-01-01' })],
    });

    expect(ergebnis.gruppen.find(g => g.kampagneId === 'k-draft')).toBeUndefined();
    expect(ergebnis.proPruefung.video_ohne_ek.anzahl).toBe(0);
    expect(ergebnis.proPruefung.rechnung_unplausibel.anzahl).toBe(0);
  });

  it('meldet EK gleich VK nicht — das Fee-Modell ist kein Datenmangel', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [auftrag()],
      blocks: [block()],
      kampagnen: [kampagne()],
      kooperationen: [koop()],
      videos: [video({ einkaufspreis_netto: 1000, verkaufspreis_netto: 1000 })],
    });

    const gruppe = ergebnis.gruppen[0];
    expect(gruppe.maengel).toEqual([]);
    expect(gruppe.pflegegrad).toBe(1);
  });

  it('deckt mit den Summen die Einzelbefunde ab (Vollstaendigkeit)', () => {
    const ergebnis = calculateDatenqualitaet({
      auftraege: [auftrag({ nettobetrag: 10000 })],
      blocks: [],
      kampagnen: [kampagne()],
      kooperationen: [koop()],
      videos: [video({ einkaufspreis_netto: null, verkaufspreis_netto: 800 })],
    });

    // Fallsicht: Summen und Pruefungs-Karten sind dedupliziert und decken sich.
    const summePruefungen = Object.values(ergebnis.proPruefung).reduce((s, p) => s + p.volumen, 0);
    expect(summePruefungen).toBe(ergebnis.summen.volumen);
    expect(ergebnis.summen.volumen).toBe(10000 + 800);

    // Bei genau einer Kampagne ist die Gruppensicht identisch zur Fallsicht.
    const summeGruppen = ergebnis.gruppen.reduce((s, g) => s + g.volumen, 0);
    expect(summeGruppen).toBe(ergebnis.summen.volumen);

    // Alle acht Pruefungen sind auch ohne Befund im Ergebnis praesent
    expect(Object.keys(ergebnis.proPruefung).sort()).toEqual(Object.keys(DATENQUALITAET_PRUEFUNGEN).sort());
  });
});
