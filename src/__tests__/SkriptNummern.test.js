// Tests fuer die abgeleitete Skript-Nummer pro Konzept.
import { describe, it, expect } from 'vitest';
import { berechneSkriptNummern, mitSkriptNummern, skriptNrLabel } from '../modules/skripte/skriptNummern.js';

const item = (id, sortierung, extra = {}) => ({
  id, strategie_id: 'k1', sortierung, skript_freigabe: true, nicht_umsetzen: false, ist_vorschlag: false, ...extra
});

describe('berechneSkriptNummern', () => {
  it('nummeriert freigegebene Ideen nach sortierung ab 1', () => {
    const nr = berechneSkriptNummern([item('b', 2), item('a', 1), item('c', 3)]);
    expect(nr.get('a')).toBe(1);
    expect(nr.get('b')).toBe(2);
    expect(nr.get('c')).toBe(3);
  });

  it('zaehlt Vorschlaege, nicht umzusetzende und nicht freigegebene Ideen nicht', () => {
    const nr = berechneSkriptNummern([
      item('a', 1, { ist_vorschlag: true }),
      item('b', 2, { nicht_umsetzen: true }),
      item('c', 3, { skript_freigabe: false }),
      item('d', 4)
    ]);
    expect(nr.has('a')).toBe(false);
    expect(nr.has('b')).toBe(false);
    expect(nr.has('c')).toBe(false);
    expect(nr.get('d')).toBe(1);
  });

  it('gibt Ideen mit vorhandenem Skript immer eine Nummer', () => {
    const nr = berechneSkriptNummern([item('a', 1), item('b', 2, { skript_freigabe: false })], ['b']);
    expect(nr.get('a')).toBe(1);
    expect(nr.get('b')).toBe(2);
  });

  it('nummeriert je Konzept getrennt', () => {
    const nr = berechneSkriptNummern([item('a', 5), item('x', 1, { strategie_id: 'k2' })]);
    expect(nr.get('a')).toBe(1);
    expect(nr.get('x')).toBe(1);
  });

  it('sortiert Ideen ohne sortierung ans Ende', () => {
    const nr = berechneSkriptNummern([item('a', null), item('b', 1)]);
    expect(nr.get('b')).toBe(1);
    expect(nr.get('a')).toBe(2);
  });
});

describe('mitSkriptNummern / skriptNrLabel', () => {
  it('haengt skript_nr an, null ohne Videoidee', () => {
    const out = mitSkriptNummern(
      [{ id: 's1', strategie_item: { id: 'a' } }, { id: 's2' }],
      new Map([['a', 3]])
    );
    expect(out[0].skript_nr).toBe(3);
    expect(out[1].skript_nr).toBeNull();
    expect(skriptNrLabel(out[0])).toBe('Skript 3');
    expect(skriptNrLabel(out[1])).toBe('');
  });
});
