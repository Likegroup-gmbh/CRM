import { describe, it, expect } from 'vitest';
import {
  paketAuswahl, creatorOptionen, creatorAusZeile, emailsAusText, SKRIPT_FREIGEGEBEN
} from '../modules/skripte/skriptPaketModel.js';

const linda = { id: 'linda', vorname: 'Linda', nachname: 'L' };
const max = { id: 'max', vorname: 'Max', nachname: 'M' };

function zeile(id, status, creatorId) {
  return { id, status, creatorId, creator: creatorId === 'linda' ? linda : max };
}

describe('paketAuswahl', () => {
  const skripte = [
    zeile('a', SKRIPT_FREIGEGEBEN, 'linda'),
    zeile('b', 'entwurf', 'linda'),
    zeile('c', SKRIPT_FREIGEGEBEN, 'max'),
    zeile('d', 'final', 'linda')
  ];

  it('hakt beim ersten Teilen nur die freigegebenen Skripte des Creators an', () => {
    const auswahl = paketAuswahl({ skripte, creatorId: 'linda', hatZugang: false });
    expect(auswahl.eigene.map((s) => s.id)).toEqual(['a']);
    expect(auswahl.weitere.map((s) => s.id)).toEqual(['c']);
    expect(auswahl.checkedIds).toEqual(['a']);
  });

  it('hakt beim erneuten Öffnen nur die gespeicherte Mitgliedschaft an', () => {
    const auswahl = paketAuswahl({
      skripte,
      creatorId: 'linda',
      hatZugang: true,
      gespeichertIds: ['c']
    });
    expect(auswahl.checkedIds).toEqual(['c']);
  });

  it('lässt ein gespeichertes Skript angehakt, auch wenn der Creator gewechselt hat', () => {
    const auswahl = paketAuswahl({
      skripte,
      creatorId: 'linda',
      hatZugang: true,
      gespeichertIds: ['a', 'c']
    });
    expect(auswahl.checkedIds.sort()).toEqual(['a', 'c']);
    expect(auswahl.weitere.map((s) => s.id)).toEqual(['c']);
  });

  it('hakt ohne Creator alle freigegebenen Skripte der Kampagne an', () => {
    const auswahl = paketAuswahl({ skripte, creatorId: null, hatZugang: false });
    expect(auswahl.eigene.map((s) => s.id)).toEqual(['a', 'c']);
    expect(auswahl.weitere).toEqual([]);
    expect(auswahl.checkedIds).toEqual(['a', 'c']);
  });

  it('hält sich ohne Creator beim erneuten Öffnen an die gespeicherte Auswahl', () => {
    const auswahl = paketAuswahl({ skripte, creatorId: null, hatZugang: true, gespeichertIds: ['c'] });
    expect(auswahl.checkedIds).toEqual(['c']);
  });
});

describe('emailsAusText', () => {
  it('trennt an Komma, Semikolon, Leerzeichen und Zeilenumbruch', () => {
    expect(emailsAusText('a@x.de, b@x.de;c@x.de\nd@x.de e@x.de'))
      .toEqual(['a@x.de', 'b@x.de', 'c@x.de', 'd@x.de', 'e@x.de']);
  });

  it('nimmt die Adresse aus "Name <mail>", ohne Doppelte, klein geschrieben', () => {
    expect(emailsAusText('Max Muster <Max@Kunde.de>; max@kunde.de, kein-text'))
      .toEqual(['max@kunde.de']);
  });
});

describe('creatorOptionen', () => {
  it('listet jeden Creator mit mindestens einem Skript', () => {
    const namen = creatorOptionen([
      { creator: linda },
      { creator: linda },
      { creator: max },
      { creator: null }
    ]).map((c) => c.id);
    expect(namen).toEqual(['linda', 'max']);
  });
});

describe('creatorAusZeile', () => {
  it('nimmt den Creator am Casting, sonst die Kooperation', () => {
    expect(creatorAusZeile({
      strategie_item: { casting_eintrag: { creator: linda } },
      kooperation_videos: [{ kooperation: { creator: max } }]
    })?.id).toBe('linda');
    expect(creatorAusZeile({
      kooperation_videos: [{ kooperation: { creator: max } }]
    })?.id).toBe('max');
    expect(creatorAusZeile({})).toBeNull();
  });

  it('zeigt den geänderten Casting-Namen statt der Stammdaten', () => {
    const creator = creatorAusZeile({
      strategie_item: { casting_eintrag: { name: 'Linda neu', creator: linda } }
    });
    expect(creator.id).toBe('linda');
    expect(`${creator.vorname} ${creator.nachname}`.trim() || creator.name).toBe('Linda neu');
  });
});
