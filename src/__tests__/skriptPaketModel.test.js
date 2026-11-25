import { describe, it, expect } from 'vitest';
import {
  paketAuswahl, creatorOptionen, creatorenAusZeile, creatorenText
} from '../modules/skripte/skriptPaketModel.js';
import { emailsAusText } from '../core/components/shareEmailField.js';

const linda = { id: 'linda', vorname: 'Linda', nachname: 'L' };
const max = { id: 'max', vorname: 'Max', nachname: 'M' };

function zeile(id, status, creatorId) {
  return { id, status, creatorId, creator: creatorId === 'linda' ? linda : max };
}

describe('paketAuswahl', () => {
  const skripte = [
    zeile('a', 'freigegeben', 'linda'),
    zeile('b', 'entwurf', 'linda'),
    zeile('c', 'freigegeben', 'max'),
    zeile('d', 'final', 'linda'),
    zeile('e', 'archiviert', 'linda')
  ];

  it('hakt beim ersten Teilen alle Skripte des Creators in jedem Status an, außer archivierte', () => {
    const auswahl = paketAuswahl({ skripte, creatorId: 'linda', hatZugang: false });
    expect(auswahl.eigene.map((s) => s.id)).toEqual(['a', 'b', 'd', 'e']);
    expect(auswahl.weitere.map((s) => s.id)).toEqual(['c']);
    expect(auswahl.checkedIds).toEqual(['a', 'b', 'd']);
  });

  it('lässt ein gespeichertes archiviertes Skript angehakt', () => {
    const auswahl = paketAuswahl({ skripte, creatorId: 'linda', hatZugang: true, gespeichertIds: ['e'] });
    expect(auswahl.checkedIds).toEqual(['e']);
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

  it('hakt ohne Creator alle Skripte der Kampagne an, außer archivierte', () => {
    const auswahl = paketAuswahl({ skripte, creatorId: null, hatZugang: false });
    expect(auswahl.eigene.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(auswahl.weitere).toEqual([]);
    expect(auswahl.checkedIds).toEqual(['a', 'b', 'c', 'd']);
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

describe('creatorenAusZeile', () => {
  const ids = (row) => creatorenAusZeile(row).map((c) => c.id);

  it('nimmt die Creator der Videos, sonst den am Casting', () => {
    expect(ids({
      strategie_item: { casting_eintrag: { creator: linda } },
      kooperation_videos: [{ kooperation: { creator: max } }]
    })).toEqual(['max']);
    expect(ids({ strategie_item: { casting_eintrag: { creator: linda } } })).toEqual(['linda']);
    expect(ids({})).toEqual([]);
  });

  it('listet bei einem geteilten Skript alle, die Hauptbesetzung vorn', () => {
    expect(ids({
      strategie_item: { casting_eintrag: { creator: linda } },
      kooperation_videos: [
        { kooperation: { creator: max } },
        { kooperation: { creator: linda } },
        { kooperation: { creator: max } }
      ]
    })).toEqual(['linda', 'max']);
  });

  it('zeigt den geänderten Casting-Namen statt der Stammdaten', () => {
    const [creator] = creatorenAusZeile({
      strategie_item: { casting_eintrag: { name: 'Linda neu', creator: linda } },
      kooperation_videos: [{ kooperation: { creator: linda } }]
    });
    expect(creator.id).toBe('linda');
    expect(`${creator.vorname} ${creator.nachname}`.trim() || creator.name).toBe('Linda neu');
  });
});

describe('Paket mit geteiltem Skript', () => {
  const geteilt = { id: 'g', status: 'final', creatorIds: ['linda', 'max'], creators: [linda, max], creator: linda };

  it('zählt das Skript bei jedem seiner Creator zu den eigenen', () => {
    expect(paketAuswahl({ skripte: [geteilt], creatorId: 'max' }).eigene.map((s) => s.id)).toEqual(['g']);
    expect(paketAuswahl({ skripte: [geteilt], creatorId: 'linda' }).eigene.map((s) => s.id)).toEqual(['g']);
  });

  it('bietet jeden Creator als Option an und nennt alle Namen', () => {
    expect(creatorOptionen([geteilt]).map((c) => c.id)).toEqual(['linda', 'max']);
    expect(creatorenText(geteilt)).toBe('Linda L, Max M');
  });
});
