import { describe, expect, it } from 'vitest';
import {
  formatLeistungszeitraum,
  kampagneLeistungszeitraum,
  renderLeistungszeitraumCell
} from '../core/utils/leistungszeitraum.js';

describe('formatLeistungszeitraum', () => {
  it('kürzt den Start im selben Jahr', () => {
    expect(formatLeistungszeitraum('2026-03-01', '2026-05-31')).toBe('01.03. – 31.05.2026');
  });

  it('schreibt über den Jahreswechsel beide Jahre aus', () => {
    expect(formatLeistungszeitraum('2026-11-15', '2027-02-10')).toBe('15.11.2026 – 10.02.2027');
  });

  it('zeigt bei nur Start oder nur Ende das volle Datum', () => {
    expect(formatLeistungszeitraum('2026-03-01', null)).toBe('01.03.2026');
    expect(formatLeistungszeitraum(null, '2026-05-31')).toBe('31.05.2026');
  });

  it('liefert ohne Daten einen Strich', () => {
    expect(formatLeistungszeitraum(null, null)).toBe('-');
    expect(formatLeistungszeitraum('', 'kein-datum')).toBe('-');
  });
});

describe('kampagneLeistungszeitraum', () => {
  it('nimmt den Zeitraum des Auftrags', () => {
    const k = { auftrag: { start: '2026-03-01', ende: '2026-05-31' }, start: '2026-01-01', deadline: '2026-12-31' };
    expect(kampagneLeistungszeitraum(k)).toBe('01.03. – 31.05.2026');
  });

  it('fällt auf Start und Deadline der Kampagne zurück', () => {
    expect(kampagneLeistungszeitraum({ start: '2026-04-01', deadline: '2026-04-30' })).toBe('01.04. – 30.04.2026');
  });

  it('rendert eine Tabellenzelle', () => {
    expect(renderLeistungszeitraumCell({ start: '2026-04-01' })).toBe('<td class="col-leistungszeitraum">01.04.2026</td>');
  });
});
