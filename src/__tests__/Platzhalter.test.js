import { describe, expect, it } from 'vitest';
import {
  HINWEIS_CREATOR_BUDGET,
  HINWEIS_LINIE,
  HINWEIS_PRODUKTION,
  HINWEIS_PRODUKTION_OHNE_BUDGET,
  HINWEIS_VIDEOS,
  deckenStandAus,
  hinweisTexte,
  istPlatzhalter,
  kooperationsname,
  linienHinweis,
  naechsteKooperationsnummer,
  offenePlatzhalterAnzahl,
  pruefeDecke
} from '../modules/kooperation/platzhalter.js';

const stand = deckenStandAus({
  kontingentVideos: 8,
  creatorBudget: 1000,
  produktionen: [{ id: 'p1', budget: null }]
});

function pruefung(extra) {
  return pruefeDecke({
    koop: { id: 'ph', creator_id: null, produktion_id: 'p1', videoanzahl: 2, ...extra?.koop },
    videosDieser: extra?.videosDieser || [{ verkaufspreis_netto: 100 }],
    koops: extra?.koops || [
      { id: 'ph', creator_id: null, produktion_id: 'p1', videoanzahl: 2 },
      { id: 'gebucht', creator_id: 'c1', produktion_id: 'p1', videoanzahl: 3 }
    ],
    videosByKoopId: extra?.videosByKoopId || { gebucht: [{ verkaufspreis_netto: 400 }] },
    stand: extra?.stand || stand
  });
}

describe('Platzhalter', () => {
  it('erkennt nur Zeilen, deren Creator ausdrücklich leer ist', () => {
    expect(istPlatzhalter({ id: 'a', creator_id: null })).toBe(true);
    expect(istPlatzhalter({ id: 'a', creator_id: '' })).toBe(true);
    expect(istPlatzhalter({ id: 'a', creator_id: 'c1' })).toBe(false);
    expect(istPlatzhalter({ id: 'a' })).toBe(false);
    expect(offenePlatzhalterAnzahl([
      { creator_id: null },
      { creator_id: 'c1' },
      { id: 'alt' }
    ])).toBe(1);
  });

  it('warnt, wenn Videos oder Preis nicht in den Rest der gebuchten Zeilen passen', () => {
    const eng = pruefung({
      koop: { videoanzahl: 6 },
      videosDieser: [{ verkaufspreis_netto: 700 }],
      videosByKoopId: { gebucht: [{ verkaufspreis_netto: 400 }] }
    });
    expect(eng.video).toBe(true);
    expect(eng.preis).toBe(true);
    expect(eng.text).toContain(HINWEIS_VIDEOS);
    expect(eng.text).toContain(HINWEIS_CREATOR_BUDGET);
  });

  it('lässt einen zweiten Platzhalter denselben Rest betreffen', () => {
    const koops = [
      { id: 'a', creator_id: null, produktion_id: 'p1', videoanzahl: 9 },
      { id: 'b', creator_id: null, produktion_id: 'p1', videoanzahl: 9 }
    ];
    const texte = hinweisTexte(koops, { a: [], b: [] }, stand);
    expect(texte.get('a')).toBe(HINWEIS_VIDEOS);
    expect(texte.get('b')).toBe(HINWEIS_VIDEOS);
  });

  it('prüft den Verkaufspreis gegen das Produktionsbudget', () => {
    const ergebnis = pruefung({
      stand: deckenStandAus({
        kontingentVideos: 0,
        produktionen: [{ id: 'p1', budget: 500 }]
      }),
      videosDieser: [{ verkaufspreis_netto: 200 }],
      videosByKoopId: { gebucht: [{ verkaufspreis_netto: 400 }] }
    });
    expect(ergebnis.text).toBe(HINWEIS_PRODUKTION);
  });

  it('blockt Preise, wenn die eigene Produktion kein Budget hat und eine andere schon', () => {
    const ergebnis = pruefung({
      stand: deckenStandAus({
        kontingentVideos: 0,
        produktionen: [{ id: 'p1', budget: null }, { id: 'p2', budget: 1000 }]
      }),
      videosDieser: [{ verkaufspreis_netto: 10 }]
    });
    expect(ergebnis.text).toBe(HINWEIS_PRODUKTION_OHNE_BUDGET);
  });

  it('prüft ohne Produktion keinen Verkaufspreis', () => {
    const ergebnis = pruefung({
      koop: { produktion_id: null, videoanzahl: 1 },
      videosDieser: [{ verkaufspreis_netto: 99999 }]
    });
    expect(ergebnis.preis).toBe(false);
    expect(ergebnis.text).toBe('');
  });

  it('nennt die Linie nur, wenn Creator und Briefing übereinstimmen', () => {
    const koops = [
      { id: 'alt', creator_id: 'c1', briefing_id: 'b1' },
      { id: 'andere', creator_id: 'c1', briefing_id: 'b2' }
    ];
    expect(linienHinweis(koops, { creatorId: 'c1', briefingId: 'b1', ausserId: 'ph' })).toBe(HINWEIS_LINIE);
    expect(linienHinweis(koops, { creatorId: 'c1', briefingId: 'b2', ausserId: 'andere' })).toBe('');
    expect(linienHinweis(koops, { creatorId: 'c1', briefingId: null, ausserId: 'ph' })).toBe('');
  });

  it('baut den Namen aus der nächsten freien Nummer', () => {
    expect(naechsteKooperationsnummer(['Mia 1/5', 'Platzhalter', 'Max 2/5'])).toBe(3);
    expect(naechsteKooperationsnummer(['Platzhalter'])).toBe(2);
    expect(kooperationsname('Max Mustermann', 2, 5)).toBe('Max Mustermann 2/5');
  });
});
