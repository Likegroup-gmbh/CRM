import { describe, it, expect } from 'vitest';
import { renderAddSection, renderItemsTable } from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';
import {
  SOURCING_STATUS_FILTER_TAGS,
  SOURCING_STATUS_OPTIONS,
  matchesStatusFilter,
  getSourcingStatus
} from '../modules/creator-auswahl/sourcingStatusOptions.js';

function parse(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('SOURCING_STATUS_FILTER_TAGS', () => {
  it('bietet alle Status ausser "Offen" an', () => {
    expect([...SOURCING_STATUS_FILTER_TAGS]).toEqual([
      'Angefragt', 'In Verhandlung', 'Zusage', 'On Hold', 'Buchen', 'Prio 1', 'Prio 2', 'Absage'
    ]);
  });

  it('nutzt exakt die Beschriftungen aus dem Status-Select', () => {
    const labelsAusSelect = SOURCING_STATUS_OPTIONS
      .filter(o => o.value !== 'offen')
      .map(o => o.label);

    expect([...SOURCING_STATUS_FILTER_TAGS].sort()).toEqual(labelsAusSelect.sort());
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
    expect(matchesStatusFilter({ zusage: true }, ['Zusage'])).toBe(true);
    expect(matchesStatusFilter({ on_hold: true }, ['On Hold'])).toBe(true);
    expect(matchesStatusFilter({ gebucht: true }, ['Buchen'])).toBe(true);
    expect(matchesStatusFilter({ prio_1: true }, ['Prio 1'])).toBe(true);
    expect(matchesStatusFilter({ prio_2: true }, ['Prio 2'])).toBe(true);
    expect(matchesStatusFilter({ absage: true }, ['Absage'])).toBe(true);
  });

  it('schliesst Items ohne das gesuchte Flag aus', () => {
    expect(matchesStatusFilter({ prio_2: true }, ['Prio 1'])).toBe(false);
    expect(matchesStatusFilter({}, ['Buchen'])).toBe(false);
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
    expect(matchesStatusFilter(gebuchtePrio, ['Buchen'])).toBe(true);
  });
});

describe('Statusfilter in der Toolbar', () => {
  it('rendert den Container vor dem Teilen-Button', () => {
    const doc = parse(renderAddSection({ isKunde: false }));
    const container = doc.getElementById('sourcing-status-filter-container');

    expect(container).not.toBeNull();
    expect(container.parentElement.classList.contains('add-item-actions-right')).toBe(true);
    expect(container.nextElementSibling.id).toBe('btn-share-sourcing');
  });

  it('rendert fuer Kunden keinen Filter-Container', () => {
    const doc = parse(renderAddSection({ isKunde: true }));

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
    const doc = parse(renderItemsTable({ ...leererCtx, activeTab: 'alle', statusFilter: ['On Hold', 'Buchen'] }));

    expect(doc.body.textContent).toContain('Keine Creator mit Status On Hold oder Buchen');
    expect(doc.body.textContent).not.toContain('Reiter');
  });

  it('faellt ohne Filter auf die Reiter-Meldung zurueck', () => {
    const doc = parse(renderItemsTable({ ...leererCtx, activeTab: 'gebucht', statusFilter: [] }));

    expect(doc.body.textContent).toContain('Keine Creator im Reiter "Gebucht"');
  });
});
