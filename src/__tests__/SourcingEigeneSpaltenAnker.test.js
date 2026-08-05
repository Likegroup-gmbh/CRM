import { describe, it, expect } from 'vitest';
import {
  renderItemsTable,
  SOURCING_ANKER_SPALTEN,
  SOURCING_SPALTEN,
  SOURCING_SPALTEN_LABELS,
  DEAKTIVIERTE_SPALTEN
} from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';
import { EntityCustomColumnsManager } from '../core/customColumns/EntityCustomColumnsManager.js';
import { renderCustomHeaders } from '../core/customColumns/EntityCustomColumnRenderer.js';
import {
  orderCustomColumns,
  groupCustomColumnsByAnchor,
  makeCustomColumnId
} from '../core/customColumns/entityColumnUtils.js';

function spalte(id, name, position = 0) {
  return { id, name, field_type: 'text', visible_for_kunden: true, position };
}

/** Manager mit fest gesetzten Spalten und Reihenfolge, ohne Datenbank */
function manager(columns, order) {
  const mgr = new EntityCustomColumnsManager({
    parentType: 'sourcing',
    parentTable: 'creator_auswahl',
    anchorColumns: SOURCING_ANKER_SPALTEN,
    anchorLabels: SOURCING_SPALTEN_LABELS,
    disabledAnchors: DEAKTIVIERTE_SPALTEN
  });
  mgr.columns = columns;
  mgr.order = order;
  return mgr;
}

function tableDoc(customManager) {
  const html = renderItemsTable({
    isKunde: false,
    hiddenColumns: [],
    items: [{ id: 'i1' }],
    hasAnyItems: true,
    customManager
  });
  return new DOMParser().parseFromString(html, 'text/html');
}

/** Spaltenschluessel in DOM-Reihenfolge: cp-col-* oder custom:{uuid} */
function reihenfolge(nodes) {
  return Array.from(nodes)
    .map(el => el.dataset.customColId
      || Array.from(el.classList).find(c => c.startsWith('cp-col-')))
    .filter(Boolean);
}

describe('Sourcing – eigene Spalten mit Anker', () => {
  it('stellt eine verankerte Spalte direkt hinter die Standardspalte', () => {
    const mgr = manager(
      [spalte('a', 'Briefing')],
      [{ id: 'custom:a', after: 'cp-col-location' }]
    );
    const doc = tableDoc(mgr);
    const kopf = reihenfolge(doc.querySelectorAll('thead th'));
    const ab = kopf.indexOf('cp-col-location');

    expect(kopf[ab + 1]).toBe('custom:a');
    expect(kopf[ab + 2]).toBe('cp-col-mail');
  });

  it('setzt Kopf und Datenzeile an dieselbe Stelle', () => {
    const mgr = manager(
      [spalte('a', 'Briefing'), spalte('b', 'Deadline', 1)],
      [{ id: 'custom:a', after: 'cp-col-status' }, 'custom:b']
    );
    const doc = tableDoc(mgr);

    expect(reihenfolge(doc.querySelectorAll('tbody tr.item-row > td')))
      .toEqual(reihenfolge(doc.querySelectorAll('thead th')));
  });

  it('haengt Eintraege ohne Anker weiterhin ans Ende vor die Aktionen', () => {
    const mgr = manager([spalte('a', 'Briefing')], ['custom:a']);
    const kopf = reihenfolge(tableDoc(mgr).querySelectorAll('thead th'));

    expect(kopf[kopf.indexOf('cp-col-feedback') + 1]).toBe('custom:a');
    expect(kopf[kopf.length - 1]).toBe('cp-col-actions');
  });

  it('faellt bei entferntem Anker auf das Tabellenende zurueck', () => {
    const mgr = manager(
      [spalte('a', 'Briefing')],
      [{ id: 'custom:a', after: 'cp-col-gibt-es-nicht' }]
    );
    const kopf = reihenfolge(tableDoc(mgr).querySelectorAll('thead th'));

    expect(kopf[kopf.indexOf('cp-col-feedback') + 1]).toBe('custom:a');
  });

  it('zaehlt verankerte Spalten fuer den colspan mit', () => {
    const mgr = manager(
      [spalte('a', 'Briefing'), spalte('b', 'Deadline', 1)],
      [{ id: 'custom:a', after: 'cp-col-status' }, 'custom:b']
    );

    expect(mgr.visibleCount([], false)).toBe(2);
  });

  it('rendert jede Spalte genau einmal, egal ob mit oder ohne Anker', () => {
    const mgr = manager(
      [spalte('a', 'Briefing'), spalte('b', 'Deadline', 1)],
      [{ id: 'custom:a', after: 'cp-col-status' }, 'custom:b']
    );
    const kopf = reihenfolge(tableDoc(mgr).querySelectorAll('thead th'));

    expect(kopf.filter(c => c === 'custom:a')).toHaveLength(1);
    expect(kopf.filter(c => c === 'custom:b')).toHaveLength(1);
  });

  it('sperrt die Sticky-Spalten und die Aktionen als Anker', () => {
    for (const gesperrt of ['cp-col-drag', 'cp-col-bild', 'cp-col-name', 'cp-col-actions']) {
      expect(SOURCING_ANKER_SPALTEN).not.toContain(gesperrt);
    }
    expect(SOURCING_ANKER_SPALTEN.length).toBe(SOURCING_SPALTEN.length - 4);
  });
});

describe('Sourcing – eigene Spalte per Drop verankern', () => {
  /** Kopfzelle mit fester Breite, damit links/rechts entscheidbar ist */
  function th(klassen, dataset = {}) {
    const el = document.createElement('th');
    el.className = klassen;
    Object.assign(el.dataset, dataset);
    el.getBoundingClientRect = () => ({ left: 100, right: 200, width: 100, top: 0, height: 20 });
    return el;
  }

  function managerMitSpeicher(columns, order) {
    const mgr = manager(columns, order);
    mgr.dataLoader = { saveColumnOrder: async (o) => { mgr._gespeichert = o; } };
    return mgr;
  }

  const LINKS = 120;
  const RECHTS = 180;

  it('verankert die Spalte beim Drop auf die rechte Haelfte hinter der Standardspalte', async () => {
    const mgr = managerMitSpeicher([spalte('a', 'Briefing')], ['custom:a']);

    const geaendert = await mgr._reorderAnTh('custom:a', th('cp-col-location'), RECHTS);

    expect(geaendert).toBe(true);
    expect(mgr._gespeichert).toEqual([{ id: 'custom:a', after: 'cp-col-location' }]);
  });

  it('haengt beim Drop auf die linke Haelfte an die Gruppe der Spalte davor', async () => {
    const mgr = managerMitSpeicher([spalte('a', 'Briefing')], ['custom:a']);

    await mgr._reorderAnTh('custom:a', th('cp-col-mail'), LINKS);

    expect(mgr._gespeichert).toEqual([{ id: 'custom:a', after: 'cp-col-location' }]);
  });

  it('ordnet zwei Spalten innerhalb desselben Ankers um', async () => {
    const mgr = managerMitSpeicher(
      [spalte('a', 'A'), spalte('b', 'B', 1)],
      [{ id: 'custom:a', after: 'cp-col-status' }, { id: 'custom:b', after: 'cp-col-status' }]
    );

    await mgr._reorderAnTh(
      'custom:b',
      th('entity-custom-col-header', { customColId: 'custom:a' }),
      LINKS
    );

    expect(mgr._gespeichert).toEqual([
      { id: 'custom:b', after: 'cp-col-status' },
      { id: 'custom:a', after: 'cp-col-status' }
    ]);
  });

  it('loest den Anker, wenn auf eine Spalte am Tabellenende gezogen wird', async () => {
    const mgr = managerMitSpeicher(
      [spalte('a', 'A'), spalte('b', 'B', 1)],
      [{ id: 'custom:a', after: 'cp-col-status' }, 'custom:b']
    );

    await mgr._reorderAnTh(
      'custom:a',
      th('entity-custom-col-header', { customColId: 'custom:b' }),
      RECHTS
    );

    expect(mgr._gespeichert).toEqual(['custom:b', 'custom:a']);
  });

  it('speichert nichts, wenn die Spalte auf ihrer eigenen Position landet', async () => {
    const mgr = managerMitSpeicher(
      [spalte('a', 'A')],
      [{ id: 'custom:a', after: 'cp-col-status' }]
    );

    const geaendert = await mgr._reorderAnTh('custom:a', th('cp-col-status'), RECHTS);

    expect(geaendert).toBe(false);
    expect(mgr._gespeichert).toBeUndefined();
  });

  it('nimmt gesperrte Spalten nicht als Drop-Ziel an', () => {
    const mgr = manager([spalte('a', 'A')], ['custom:a']);

    expect(mgr._istDropZiel(th('cp-col-name col-sticky-2'))).toBe(false);
    expect(mgr._istDropZiel(th('col-actions cp-col-actions'))).toBe(false);
    expect(mgr._istDropZiel(th('cp-col-status'))).toBe(true);
    expect(mgr._istDropZiel(th('entity-custom-col-header', { customColId: 'custom:a' }))).toBe(true);
  });
});

describe('orderCustomColumns mit Ankern', () => {
  it('liest Strings und Objekte gemischt und behaelt die Reihenfolge', () => {
    const cols = [spalte('a', 'A'), spalte('b', 'B', 1)];
    const geordnet = orderCustomColumns(cols, [
      { id: 'custom:b', after: 'cp-col-status' },
      'custom:a'
    ]);

    expect(geordnet.map(c => c.id)).toEqual(['b', 'a']);
    expect(geordnet[0]._anchor).toBe('cp-col-status');
    expect(geordnet[1]._anchor).toBeNull();
  });

  it('haengt nicht genannte Spalten nach position hinten an', () => {
    const cols = [spalte('a', 'A', 2), spalte('b', 'B', 1), spalte('c', 'C', 0)];
    const geordnet = orderCustomColumns(cols, [{ id: 'custom:a', after: 'cp-col-ek' }]);

    expect(geordnet.map(c => c.id)).toEqual(['a', 'c', 'b']);
  });

  it('gruppiert unbekannte Anker in den Rest', () => {
    const geordnet = orderCustomColumns(
      [spalte('a', 'A'), spalte('b', 'B', 1)],
      [{ id: 'custom:a', after: 'cp-col-ek' }, { id: 'custom:b', after: 'weg' }]
    );
    const { byAnchor, trailing } = groupCustomColumnsByAnchor(geordnet, SOURCING_ANKER_SPALTEN);

    expect(byAnchor.get('cp-col-ek').map(c => c.id)).toEqual(['a']);
    expect(trailing.map(c => c.id)).toEqual(['b']);
  });

  it('ignoriert doppelte Eintraege derselben Spalte', () => {
    const geordnet = orderCustomColumns(
      [spalte('a', 'A')],
      ['custom:a', { id: 'custom:a', after: 'cp-col-ek' }]
    );

    expect(geordnet).toHaveLength(1);
    expect(makeCustomColumnId(geordnet[0].id)).toBe('custom:a');
  });
});

describe('Sourcing – Positionsmenue getMoveTargets / moveColumnTo', () => {
  function managerMitSpeicher(columns, order) {
    const mgr = manager(columns, order);
    mgr.dataLoader = { saveColumnOrder: async (o) => { mgr._gespeichert = o; } };
    return mgr;
  }

  it('liefert Ziele in Tabellenreihenfolge ohne die Spalte selbst', () => {
    const mgr = manager(
      [spalte('a', 'Event Preise'), spalte('b', 'Briefing', 1)],
      [{ id: 'custom:a', after: 'cp-col-pricing' }, 'custom:b']
    );

    const targets = mgr.getMoveTargets('custom:a', { hiddenColumns: [] });
    const values = targets.map(t => t.value);

    expect(values).toContain('anchor:cp-col-pricing');
    expect(values).toContain('anchor:cp-col-status');
    expect(values).toContain('custom:b');
    expect(values).toContain('end');
    expect(values).not.toContain('custom:a');

    // Anker vor dem zugehörigen Custom-Eintrag, End vor trailing Customs
    expect(values.indexOf('anchor:cp-col-status')).toBeLessThan(values.indexOf('anchor:cp-col-pricing'));
    expect(values.indexOf('anchor:cp-col-pricing')).toBeLessThan(values.indexOf('end'));
    expect(values.indexOf('end')).toBeLessThan(values.indexOf('custom:b'));
  });

  it('markiert die aktuelle Position als active', () => {
    const mgr = manager(
      [spalte('a', 'Event Preise')],
      [{ id: 'custom:a', after: 'cp-col-pricing' }]
    );

    const targets = mgr.getMoveTargets('custom:a');
    const active = targets.filter(t => t.active);

    expect(active).toHaveLength(1);
    expect(active[0].value).toBe('anchor:cp-col-pricing');
    expect(active[0].label).toBe('Hinter Gesamtpreis');
  });

  it('laesst ausgeblendete und deaktivierte Anker weg', () => {
    const mgr = manager([spalte('a', 'A')], ['custom:a']);
    const targets = mgr.getMoveTargets('custom:a', {
      hiddenColumns: ['cp-col-mail', 'cp-col-telefon']
    });
    const values = targets.map(t => t.value);

    expect(values).not.toContain('anchor:cp-col-mail');
    expect(values).not.toContain('anchor:cp-col-telefon');
    expect(values).not.toContain('anchor:cp-col-ek');
    expect(values).not.toContain('anchor:cp-col-vk');
    expect(values).toContain('anchor:cp-col-pricing');
  });

  it('moveColumnTo(anchor) schreibt after in die Reihenfolge', async () => {
    const mgr = managerMitSpeicher([spalte('a', 'Event Preise')], ['custom:a']);

    const geaendert = await mgr.moveColumnTo('custom:a', 'anchor:cp-col-pricing');

    expect(geaendert).toBe(true);
    expect(mgr._gespeichert).toEqual([{ id: 'custom:a', after: 'cp-col-pricing' }]);
  });

  it('moveColumnTo(end) setzt den Anker auf null', async () => {
    const mgr = managerMitSpeicher(
      [spalte('a', 'A')],
      [{ id: 'custom:a', after: 'cp-col-status' }]
    );

    await mgr.moveColumnTo('custom:a', 'end');

    expect(mgr._gespeichert).toEqual(['custom:a']);
  });

  it('moveColumnTo(custom) sortiert zwei Spalten am selben Anker', async () => {
    const mgr = managerMitSpeicher(
      [spalte('a', 'A'), spalte('b', 'B', 1)],
      [{ id: 'custom:a', after: 'cp-col-status' }, { id: 'custom:b', after: 'cp-col-status' }]
    );

    await mgr.moveColumnTo('custom:a', 'custom:b');

    expect(mgr._gespeichert).toEqual([
      { id: 'custom:b', after: 'cp-col-status' },
      { id: 'custom:a', after: 'cp-col-status' }
    ]);
  });

  it('speichert nichts, wenn das Ziel die aktuelle Position ist', async () => {
    const mgr = managerMitSpeicher(
      [spalte('a', 'A')],
      [{ id: 'custom:a', after: 'cp-col-status' }]
    );

    const geaendert = await mgr.moveColumnTo('custom:a', 'anchor:cp-col-status');

    expect(geaendert).toBe(false);
    expect(mgr._gespeichert).toBeUndefined();
  });
});

describe('Sourcing – Hand-Griff im Header-Renderer', () => {
  it('rendert Hand-Griff fuer interne Nutzer, th selbst ist nicht draggable', () => {
    const html = renderCustomHeaders(
      [spalte('a', 'Event Preise')],
      [],
      false
    );

    expect(html).toContain('entity-custom-col-grip');
    expect(html).toContain('data-custom-col-grip="custom:a"');
    expect(html).toContain('draggable="true"');
    expect(html).toContain('viewBox="0 0 256 256"');
    expect(html).toContain('Event Preise');
    // Nur der Griff ist draggable, nicht das th
    expect(html).not.toMatch(/<th[^>]*draggable="true"/);
  });

  it('laesst den Griff fuer Kunden weg', () => {
    const html = renderCustomHeaders(
      [spalte('a', 'Event Preise')],
      [],
      true
    );

    expect(html).not.toContain('entity-custom-col-grip');
    expect(html).toContain('Event Preise');
    expect(html).not.toContain('draggable="true"');
  });
});
