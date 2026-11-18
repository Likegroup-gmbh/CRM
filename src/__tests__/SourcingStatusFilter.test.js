import { describe, it, expect } from 'vitest';
import { renderAddSection, renderItemsTable } from '../modules/creator-auswahl/castingTableRender.js';
import { SOURCING_TABS, getSourcingTabForItem } from '../modules/creator-auswahl/sourcingTabs.js';
import {
  SOURCING_STATUS_FILTER_TAGS,
  SOURCING_STATUS_OPTIONS,
  KUNDEN_FEEDBACK_OPTIONS,
  matchesStatusFilter,
  getSourcingStatus,
  buildSourcingStatusUpdates
} from '../modules/creator-auswahl/sourcingStatusOptions.js';

function parse(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('SOURCING_TABS', () => {
  it('startet mit "Alle" und fuehrt dann die sieben Prozess-Stufen', () => {
    expect(SOURCING_TABS.map(t => t.key)).toEqual([
      'alle', 'offen', 'angefragt', 'on_hold', 'in_verhandlung', 'absage', 'zusage', 'gebucht'
    ]);
    expect(SOURCING_TABS.map(t => t.label)).toEqual([
      'Alle', 'Offen', 'Angefragt', 'On Hold', 'In Verhandlung', 'Abgesagt', 'Zusage', 'Gebucht'
    ]);
  });

  it('mappt ein Item auf seinen Prozess-Status, Feedback-Flags spielen keine Rolle', () => {
    expect(getSourcingTabForItem({})).toBe('offen');
    expect(getSourcingTabForItem({ angefragt: true })).toBe('angefragt');
    expect(getSourcingTabForItem({ on_hold: true })).toBe('on_hold');
    expect(getSourcingTabForItem({ in_verhandlung: true })).toBe('in_verhandlung');
    expect(getSourcingTabForItem({ absage: true })).toBe('absage');
    expect(getSourcingTabForItem({ zusage: true })).toBe('zusage');
    expect(getSourcingTabForItem({ gebucht: true })).toBe('gebucht');

    // Prio und Abgelehnt sind Kundenfeedback und aendern den Reiter nicht
    expect(getSourcingTabForItem({ prio_1: true })).toBe('offen');
    expect(getSourcingTabForItem({ abgelehnt: true })).toBe('offen');
    expect(getSourcingTabForItem({ angefragt: true, prio_1: true })).toBe('angefragt');
  });
});

describe('SOURCING_STATUS_FILTER_TAGS', () => {
  it('bietet alle Prozess-Stufen ausser "Offen" plus das Kundenfeedback an', () => {
    expect([...SOURCING_STATUS_FILTER_TAGS]).toEqual([
      'Angefragt', 'In Verhandlung', 'Preis zugesagt', 'Zusage', 'On Hold', 'Gebucht', 'Abgesagt',
      'Prio 1', 'Prio 2', 'Abgelehnt'
    ]);
  });

  it('nutzt exakt die Beschriftungen der beiden Selects', () => {
    const labelsAusSelects = [
      ...SOURCING_STATUS_OPTIONS.filter(o => o.value !== 'offen').map(o => o.label),
      ...KUNDEN_FEEDBACK_OPTIONS.filter(o => o.value !== '').map(o => o.label)
    ];

    expect([...SOURCING_STATUS_FILTER_TAGS].sort()).toEqual(labelsAusSelects.sort());
  });
});

describe('matchesStatusFilter', () => {
  it('laesst ohne Auswahl alles durch', () => {
    expect(matchesStatusFilter({}, [])).toBe(true);
    expect(matchesStatusFilter({}, null)).toBe(true);
    expect(matchesStatusFilter({}, undefined)).toBe(true);
    expect(matchesStatusFilter({ prio_1: true }, [])).toBe(true);
  });

  it('bildet jeden Tag auf sein Boolean-Feld ab', () => {
    expect(matchesStatusFilter({ angefragt: true }, ['Angefragt'])).toBe(true);
    expect(matchesStatusFilter({ in_verhandlung: true }, ['In Verhandlung'])).toBe(true);
    expect(matchesStatusFilter({ preis_zugesagt: true }, ['Preis zugesagt'])).toBe(true);
    expect(matchesStatusFilter({ zusage: true }, ['Zusage'])).toBe(true);
    expect(matchesStatusFilter({ on_hold: true }, ['On Hold'])).toBe(true);
    expect(matchesStatusFilter({ gebucht: true }, ['Gebucht'])).toBe(true);
    expect(matchesStatusFilter({ absage: true }, ['Abgesagt'])).toBe(true);
    expect(matchesStatusFilter({ prio_1: true }, ['Prio 1'])).toBe(true);
    expect(matchesStatusFilter({ prio_2: true }, ['Prio 2'])).toBe(true);
    expect(matchesStatusFilter({ abgelehnt: true }, ['Abgelehnt'])).toBe(true);
  });

  it('schliesst Items ohne das gesuchte Flag aus', () => {
    expect(matchesStatusFilter({ prio_2: true }, ['Prio 1'])).toBe(false);
    expect(matchesStatusFilter({}, ['Gebucht'])).toBe(false);
    expect(matchesStatusFilter({ absage: true }, ['Abgelehnt'])).toBe(false);
    expect(matchesStatusFilter(null, ['On Hold'])).toBe(false);
  });

  it('verknuepft mehrere Tags mit oder', () => {
    const auswahl = ['On Hold', 'Prio 1'];
    expect(matchesStatusFilter({ on_hold: true }, auswahl)).toBe(true);
    expect(matchesStatusFilter({ prio_1: true }, auswahl)).toBe(true);
    expect(matchesStatusFilter({ gebucht: true }, auswahl)).toBe(false);
  });

  it('findet ein Item unter allen gesetzten Flags, nicht nur unter dem angezeigten Status', () => {
    const gebuchtePrio = { prio_1: true, gebucht: true };

    expect(getSourcingStatus(gebuchtePrio)).toBe('gebucht');
    expect(matchesStatusFilter(gebuchtePrio, ['Prio 1'])).toBe(true);
    expect(matchesStatusFilter(gebuchtePrio, ['Gebucht'])).toBe(true);
  });

  it('ueberlebt das Kundenfeedback einen Statuswechsel und bleibt filterbar', () => {
    // Der Prozess-Select schreibt nur Prozess-Flags - Prio und Abgelehnt
    // gehoeren zur anderen Spalte und duerfen nicht mit zurueckgenommen werden
    const item = { prio_1: true, angefragt: true };
    const updates = buildSourcingStatusUpdates('gebucht');
    Object.assign(item, updates);

    expect(item.prio_1).toBe(true);
    expect(item.gebucht).toBe(true);
    expect(matchesStatusFilter(item, ['Prio 1'])).toBe(true);
    expect(matchesStatusFilter(item, ['Gebucht'])).toBe(true);
  });
});

describe('Filter-Button in der Toolbar', () => {
  it('setzt den Button der Filterspalte neben die Suche, das Plus-Menü hat keinen Statusfilter mehr', () => {
    const doc = parse(renderAddSection({
      isKunde: false,
      canCreate: true,
      filterToggleHtml: '<button id="casting-filter-toggle"></button>'
    }));

    expect(doc.getElementById('casting-filter-toggle')).not.toBeNull();
    expect(doc.querySelector('.sourcing-status-filter-submenu')).toBeNull();
    expect(doc.getElementById('btn-share-sourcing').closest('.toolbar-menu-dropdown')).not.toBeNull();
  });

  it('zeigt Kunden den Filter-Button, aber kein Plus-Menü', () => {
    const doc = parse(renderAddSection({ isKunde: true, filterToggleHtml: '<button id="casting-filter-toggle"></button>' }));

    expect(doc.getElementById('casting-filter-toggle')).not.toBeNull();
    expect(doc.querySelector('.toolbar-menu')).toBeNull();
  });
});

describe('Empty-State bei aktiven Filtern', () => {
  const leererCtx = {
    items: [],
    hasAnyItems: true,
    isKunde: false,
    hiddenColumns: [],
    tabCounts: { alle: 0 }
  };

  it('nennt die Filter und den Reiter', () => {
    const doc = parse(renderItemsTable({ ...leererCtx, activeTab: 'offen', filterActive: true }));

    expect(doc.body.textContent).toContain('Keine Creator für die gewählten Filter im Reiter "Offen"');
  });

  it('laesst den Reiter bei "alle" weg', () => {
    const doc = parse(renderItemsTable({ ...leererCtx, activeTab: 'alle', filterActive: true }));

    expect(doc.body.textContent).toContain('Keine Creator für die gewählten Filter');
    expect(doc.body.textContent).not.toContain('Reiter');
  });

  it('faellt ohne Filter auf die Reiter-Meldung zurueck', () => {
    const doc = parse(renderItemsTable({ ...leererCtx, activeTab: 'gebucht', filterActive: false }));

    expect(doc.body.textContent).toContain('Keine Creator im Reiter "Gebucht"');
  });
});
