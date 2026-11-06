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
  it('beginnt ohne gespeicherte Folge mit Bild, Kurzbeschreibung, Matching', () => {
    expect(baueBeweglicheSpalten().slice(0, 3)).toEqual([
      'cp-col-bild', 'cp-col-notiz', 'cp-col-matching'
    ]);
  });

  it('setzt eine eigene Spalte hinter ihren Anker', () => {
    const folge = baueBeweglicheSpalten({
      customColumns: [spalte('a', 'cp-col-location')]
    });

    expect(folge[folge.indexOf('cp-col-location') + 1]).toBe('custom:a');
  });

  it('haelt eine gespeicherte Folge und haengt neue Spalten an der Vorlage ein', () => {
    const folge = baueBeweglicheSpalten({
      columnOrder: ['cp-col-status', 'cp-col-bild'],
      customColumns: [spalte('a', 'cp-col-status')]
    });

    expect(folge.slice(0, 3)).toEqual(['cp-col-status', 'custom:a', 'cp-col-bild']);
  });

  it('stellt Bild nur dann vor den Namen, wenn es vorn bleibt', () => {
    const mitBild = baueSourcingSpaltenfolge();
    expect(mitBild.slice(0, 4)).toEqual([
      'cp-col-drag', 'cp-col-bild', 'cp-col-name', 'cp-col-notiz'
    ]);

    const ohne = baueSourcingSpaltenfolge({
      columnOrder: ['cp-col-status', ...standardBeweglicheSpalten().filter(id => id !== 'cp-col-status')]
    });
    expect(ohne.slice(0, 4)).toEqual([
      'cp-col-drag', 'cp-col-name', 'cp-col-status', 'cp-col-bild'
    ]);
  });

  it('leitet den Anker aus der flachen Folge ab', () => {
    expect(ankerEintraegeAusFolge([
      'cp-col-bild', 'custom:a', 'cp-col-notiz', 'custom:b'
    ])).toEqual([
      { id: 'custom:a', after: 'cp-col-bild' },
      { id: 'custom:b', after: 'cp-col-notiz' }
    ]);
  });

  it('setzt eigene Spalten nach einem Kopf-Griff hinter den Anker, Standards bleiben', () => {
    const neu = ersetzeEigeneSpalten(
      ['cp-col-bild', 'cp-col-notiz', 'custom:a', 'cp-col-status'],
      [spalte('a', 'cp-col-status')]
    );

    expect(neu).toEqual(['cp-col-bild', 'cp-col-notiz', 'cp-col-status', 'custom:a']);
  });
});
