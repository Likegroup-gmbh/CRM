import { describe, it, expect } from 'vitest';
import {
  ankerEintraegeAusFolge,
  baueBeweglicheSpalten,
  baueSourcingSpaltenfolge,
  ersetzeEigeneSpalten,
  standardBeweglicheSpalten
} from '../modules/creator-auswahl/sourcingSpaltenfolge.js';

function spalte(id, anchor) {
  return { id, _anchor: anchor, name: id };
}

describe('Sourcing-Spaltenfolge', () => {
  it('beginnt ohne gespeicherte Folge mit Link, Follower, Engagement', () => {
    expect(baueBeweglicheSpalten().slice(0, 3)).toEqual([
      'cp-col-link', 'cp-col-follower', 'cp-col-engagement'
    ]);
  });

  it('setzt eine eigene Spalte hinter ihren Anker', () => {
    const folge = baueBeweglicheSpalten({
      customColumns: [spalte('a', 'cp-col-location')]
    });

    expect(folge[folge.indexOf('cp-col-location') + 1]).toBe('custom:a');
  });

  it('haelt eine gespeicherte Folge, laesst die alte Bild-Spalte weg und haengt neue Spalten an der Vorlage ein', () => {
    const folge = baueBeweglicheSpalten({
      columnOrder: ['cp-col-status', 'cp-col-bild', 'cp-col-link'],
      customColumns: [spalte('a', 'cp-col-status')]
    });

    expect(folge.slice(0, 3)).toEqual(['cp-col-status', 'custom:a', 'cp-col-link']);
    expect(folge).not.toContain('cp-col-bild');
  });

  it('stellt den Namen fest hinter Drag, auch bei eigener Reihenfolge', () => {
    expect(baueSourcingSpaltenfolge().slice(0, 3)).toEqual([
      'cp-col-drag', 'cp-col-name', 'cp-col-link'
    ]);

    const umsortiert = baueSourcingSpaltenfolge({
      columnOrder: ['cp-col-status', ...standardBeweglicheSpalten().filter(id => id !== 'cp-col-status')]
    });
    expect(umsortiert.slice(0, 3)).toEqual(['cp-col-drag', 'cp-col-name', 'cp-col-status']);
  });

  it('setzt eigene Spalten hinter der frueheren Bild-Spalte direkt hinter den Namen', () => {
    const folge = baueSourcingSpaltenfolge({
      customColumns: [spalte('alt', 'cp-col-bild'), spalte('neu', 'cp-col-name')]
    });

    expect(folge.slice(0, 4)).toEqual(['cp-col-drag', 'cp-col-name', 'custom:neu', 'custom:alt']);
  });

  it('leitet den Anker aus der flachen Folge ab, vorn ist es der Name', () => {
    expect(ankerEintraegeAusFolge([
      'custom:a', 'cp-col-notiz', 'custom:b'
    ])).toEqual([
      { id: 'custom:a', after: 'cp-col-name' },
      { id: 'custom:b', after: 'cp-col-notiz' }
    ]);
  });

  it('setzt eigene Spalten nach einem Kopf-Griff hinter den Anker, Standards bleiben', () => {
    const neu = ersetzeEigeneSpalten(
      ['cp-col-notiz', 'custom:a', 'cp-col-matching', 'cp-col-status'],
      [spalte('a', 'cp-col-status')]
    );

    expect(neu).toEqual(['cp-col-notiz', 'cp-col-matching', 'cp-col-status', 'custom:a']);
  });
});
