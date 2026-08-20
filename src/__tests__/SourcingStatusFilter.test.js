import { describe, it, expect } from 'vitest';
import {
  renderAddSection, renderItemsTable,
  SOURCING_TABS, getSourcingTabForItem
} from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';
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

describe('Statusfilter in der Toolbar', () => {
  it('legt Status filtern als Submenu ins Plus-Dropdown', () => {
    const doc = parse(renderAddSection({ isKunde: false, statusFilter: ['Angefragt'] }));
    const submenu = doc.querySelector('.sourcing-status-filter-submenu');
    const dropdown = doc.querySelector('.toolbar-menu-dropdown');

    expect(submenu).not.toBeNull();
    expect(submenu.closest('.toolbar-menu-dropdown')).toBe(dropdown);
    expect(submenu.querySelector('.action-item.has-submenu').textContent).toContain('Status filtern');
    expect(submenu.querySelector('[data-status-tag="Angefragt"] .submenu-check')).not.toBeNull();
    expect(submenu.querySelector('[data-status-filter-reset]')).not.toBeNull();

    const shareBtn = doc.getElementById('btn-share-sourcing');
    expect(shareBtn.closest('.toolbar-menu-dropdown')).not.toBeNull();
  });

  it('rendert fuer Kunden kein Status-Submenu und kein Plus-Menü', () => {
    const doc = parse(renderAddSection({ isKunde: true }));

    expect(doc.querySelector('.sourcing-status-filter-submenu')).toBeNull();
    expect(doc.querySelector('.toolbar-menu')).toBeNull();
    expect(doc.getElementById('sourcing-status-filter-container')).toBeNull();
  });
});

describe('Empty-State bei aktivem Statusfilter', () => {
  const leererCtx = {
    items: [],
    hasAnyItems: true,
    isKunde: false,
    hiddenColumns: [],
    tabCounts: { alle: 0 }
  };

  it('nennt den Filter statt den Reiter', () => {
    const doc = parse(renderItemsTable({ ...leererCtx, activeTab: 'offen', statusFilter: ['Prio 1'] }));

    expect(doc.body.textContent).toContain('Keine Creator mit Status Prio 1 im Reiter "Offen"');
  });

  it('listet mehrere gewaehlte Status auf und laesst den Reiter bei "alle" weg', () => {
    const doc = parse(renderItemsTable({ ...leererCtx, activeTab: 'alle', statusFilter: ['On Hold', 'Gebucht'] }));

    expect(doc.body.textContent).toContain('Keine Creator mit Status On Hold oder Gebucht');
    expect(doc.body.textContent).not.toContain('Reiter');
  });

  it('faellt ohne Filter auf die Reiter-Meldung zurueck', () => {
    const doc = parse(renderItemsTable({ ...leererCtx, activeTab: 'gebucht', statusFilter: [] }));

    expect(doc.body.textContent).toContain('Keine Creator im Reiter "Gebucht"');
  });
});
