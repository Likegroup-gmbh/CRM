import { describe, expect, it } from 'vitest';
import {
  basisName,
  briefingTitel,
  geistProduktionName,
  lineNames
} from '../modules/produktion/produktionNames.js';

describe('lineNames', () => {
  it('hängt Casting und Konzept an den Briefing-Titel', () => {
    expect(lineNames('Neuer Süßer Senf 2.0')).toEqual({
      produktion: 'Neuer Süßer Senf 2.0',
      casting: 'Neuer Süßer Senf 2.0 Casting',
      konzept: 'Neuer Süßer Senf 2.0 Konzept'
    });
  });

  it('liefert leere Namen ohne Titel', () => {
    expect(lineNames('  ')).toEqual({ produktion: '', casting: '', konzept: '' });
  });
});

describe('basisName', () => {
  it('nimmt den Kampagnennamen, nicht den eigenen Namen', () => {
    expect(basisName({ kampagnenname: 'Projekt A', eigener_name: 'Egal' })).toBe('Projekt A');
  });

  it('fällt ohne Kampagnennamen auf den eigenen Namen zurück', () => {
    expect(basisName({ eigener_name: ' Eigen ' })).toBe('Eigen');
    expect(basisName(null)).toBe('');
  });
});

describe('briefingTitel', () => {
  it('ist ohne Zusatz die Basis', () => {
    expect(briefingTitel('Projekt A', '')).toBe('Projekt A');
  });

  it('hängt den Zusatz an', () => {
    expect(briefingTitel('Projekt A', ' Serum ')).toBe('Projekt A – Serum');
  });

  it('liefert ohne Basis nur den Zusatz', () => {
    expect(briefingTitel('', 'Serum')).toBe('Serum');
  });
});

describe('geistProduktionName', () => {
  it('nummeriert hinter der Basis', () => {
    expect(geistProduktionName('Projekt A', 2)).toBe('Projekt A – Produktion 2');
  });

  it('funktioniert ohne Basis', () => {
    expect(geistProduktionName('', 1)).toBe('Produktion 1');
  });
});
