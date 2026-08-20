// Tests fuer die Versions-Nummerierungslogik (v2 vs. v2.1).
// Die Logik entscheidet: neue Hauptversion (bei Arbeit an der neuesten
// Version) oder Unterversion (bei Arbeit an einer aelteren Version).

import { describe, it, expect } from 'vitest';
import { planeVersionsRows } from '../modules/skripte/versionsNummerierung.js';

const skript = { id: 's1', titel: 'T', hook: 'H', hauptteil: 'M', cta: 'C' };
const alt = { titel: 'alt', hook: 'alt', hauptteil: 'alt', cta: 'alt' };

describe('planeVersionsRows', () => {
  it('erste Version ueberhaupt: v1 ohne Lazy-Snapshot', () => {
    const { rows, neu } = planeVersionsRows({ versionen: [], skript });
    expect(neu).toEqual({ version_nr: 1, sub_nr: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0].version_nr).toBe(1);
    expect(rows[0].sub_nr).toBe(0);
    expect(rows[0].hook).toBe('H');
  });

  it('Bestandsskript ohne Versionen: lazy v1 (alter Stand) + v2 (neuer Stand)', () => {
    const { rows, neu } = planeVersionsRows({ versionen: [], skript, vorherigerStand: alt });
    expect(neu).toEqual({ version_nr: 2, sub_nr: 0 });
    expect(rows).toHaveLength(2);
    expect(rows[0].version_nr).toBe(1);
    expect(rows[0].aenderung_beschreibung).toBe('Ausgangsversion');
    expect(rows[0].hook).toBe('alt');
    expect(rows[1].version_nr).toBe(2);
    expect(rows[1].hook).toBe('H');
  });

  it('Arbeit an der neuesten Hauptversion -> neue Hauptversion', () => {
    const versionen = [{ version_nr: 1, sub_nr: 0 }, { version_nr: 2, sub_nr: 0 }];
    const { rows, neu } = planeVersionsRows({
      versionen, skript, aktiveVersion: { version_nr: 2, sub_nr: 0 }
    });
    expect(neu).toEqual({ version_nr: 3, sub_nr: 0 });
    expect(rows).toHaveLength(1);
  });

  it('Arbeit an einer aelteren Hauptversion -> Unterversion v2.x', () => {
    const versionen = [{ version_nr: 1, sub_nr: 0 }, { version_nr: 2, sub_nr: 0 }, { version_nr: 4, sub_nr: 0 }];
    const { rows, neu } = planeVersionsRows({
      versionen, skript, aktiveVersion: { version_nr: 2, sub_nr: 0 }
    });
    expect(neu).toEqual({ version_nr: 2, sub_nr: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0].version_nr).toBe(2);
    expect(rows[0].sub_nr).toBe(1);
  });

  it('Arbeit an einer Unterversion -> naechste Unterversion derselben Hauptversion', () => {
    const versionen = [
      { version_nr: 2, sub_nr: 0 },
      { version_nr: 2, sub_nr: 1 },
      { version_nr: 3, sub_nr: 0 }
    ];
    const { neu } = planeVersionsRows({
      versionen, skript, aktiveVersion: { version_nr: 2, sub_nr: 1 }
    });
    expect(neu).toEqual({ version_nr: 2, sub_nr: 2 });
  });

  it('Unterversionen anderer Hauptversionen beeinflussen maxSub nicht', () => {
    const versionen = [
      { version_nr: 2, sub_nr: 0 },
      { version_nr: 3, sub_nr: 0 },
      { version_nr: 3, sub_nr: 5 }
    ];
    const { neu } = planeVersionsRows({
      versionen, skript, aktiveVersion: { version_nr: 2, sub_nr: 0 }
    });
    expect(neu).toEqual({ version_nr: 2, sub_nr: 1 });
  });

  it('ohne aktiveVersion-Angabe -> neue Hauptversion', () => {
    const versionen = [{ version_nr: 1, sub_nr: 0 }];
    const { neu } = planeVersionsRows({ versionen, skript });
    expect(neu).toEqual({ version_nr: 2, sub_nr: 0 });
  });

  it('Beschreibung und userId landen in der neuen Row', () => {
    const { rows } = planeVersionsRows({
      versionen: [{ version_nr: 1, sub_nr: 0 }], skript,
      beschreibung: 'Hook neu', userId: 'u1'
    });
    expect(rows[0].aenderung_beschreibung).toBe('Hook neu');
    expect(rows[0].created_by).toBe('u1');
    expect(rows[0].skript_id).toBe('s1');
  });

  it('fehlende Sektions-Felder werden als null gesnapshottet', () => {
    const duenn = { id: 's1', hook: 'nur Hook' };
    const { rows } = planeVersionsRows({ versionen: [], skript: duenn });
    expect(rows[0].hook).toBe('nur Hook');
    expect(rows[0].hauptteil).toBeNull();
    expect(rows[0].cta).toBeNull();
    expect(rows[0].hook_visuell).toBeNull();
  });
});
