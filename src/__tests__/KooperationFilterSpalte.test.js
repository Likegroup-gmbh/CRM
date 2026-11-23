import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KampagneDetailStore } from '../modules/kampagne/KampagneDetailStore.js';
import { renderMainPage } from '../modules/kampagne/KampagneDetailMainRenderer.js';
import {
  kooperationFilterDefs,
  kooperationSorts,
  syncKooperationFilter,
  mountKooperationFilter,
  resetKooperationFilter
} from '../modules/kampagne/kooperationFilterSpalte.js';

function buildStore() {
  const store = new KampagneDetailStore('kamp-1');
  store.setKooperationen([
    { id: 'k1', creator: { vorname: 'Anna', nachname: 'A' }, status_name: 'Gebucht', _tags: ['Juli'], einkaufspreis_gesamt: 500, created_at: '2026-01-01' },
    { id: 'k2', creator: { vorname: 'Ben', nachname: 'B' }, status_name: 'Angefragt', _tags: ['August'], einkaufspreis_gesamt: 1500, created_at: '2026-02-01' },
    { id: 'k3', creator: { vorname: 'Cem', nachname: 'C' }, status_name: 'Gebucht', _tags: [], posting_datum: '2026-05-10', created_at: '2026-03-01' }
  ]);
  store.setVideos({
    k1: [{ id: 'v1', posting_datum: '2026-04-01', content_deadline: '2026-03-20', verkaufspreis_netto: 800 }],
    k2: [
      { id: 'v2', posting_datum: '2026-06-01', verkaufspreis_netto: 1000 },
      { id: 'v3', posting_datum: '2026-07-15', verkaufspreis_netto: 1200 }
    ]
  });
  return store;
}

const ids = (list) => list.map((koop) => koop.id);

describe('kooperationFilterDefs', () => {
  it('blendet EK und VK für Kunden aus', () => {
    const store = buildStore();
    expect(kooperationFilterDefs({ store }).map((def) => def.id)).toEqual(
      ['status', 'tag', 'creator', 'golive', 'content_deadline', 'ek', 'vk']
    );
    expect(kooperationFilterDefs({ store, isKunde: true }).map((def) => def.id)).not.toEqual(
      expect.arrayContaining(['ek'])
    );
    expect(kooperationFilterDefs({ store, isKunde: true }).some((def) => def.id === 'vk')).toBe(false);
  });

  it('übernimmt die bisherigen Sortierungen', () => {
    expect(kooperationSorts().map((sort) => sort.id)).toContain('created_desc');
    expect(kooperationSorts()).toHaveLength(8);
  });
});

describe('KampagneDetailStore mit Filterspalte', () => {
  it('filtert über Status, Tags, Termine und Preise', () => {
    const store = buildStore();
    store.setColumnFilters({ status: ['Gebucht'] });
    expect(ids(store.getFiltered('alle'))).toEqual(['k1', 'k3']);

    store.setColumnFilters({ golive: { from: '2026-07-01' } });
    expect(ids(store.getFiltered('alle'))).toEqual(['k2']);

    store.setColumnFilters({ golive: { from: '2026-05-01', to: '2026-05-31' } });
    expect(ids(store.getFiltered('alle'))).toEqual(['k3']);

    store.setColumnFilters({ vk: { min: '2000' } });
    expect(ids(store.getFiltered('alle'))).toEqual(['k2']);

    store.setColumnFilters({ ek: { max: '1000' }, tag: ['Juli'] });
    expect(ids(store.getFiltered('alle'))).toEqual(['k1']);
  });

  it('filtert über eigene Spalten, bei Video-Spalten über die Werte aller Videos', () => {
    const store = buildStore();
    store.setCustomColumns([
      { id: 'cc1', name: 'Kanal', field_type: 'dropdown', entity_type: 'video', dropdownOptions: [{ label: 'Story' }, { label: 'Reel' }] },
      { id: 'cc2', name: 'Rechnung da', field_type: 'boolean', entity_type: 'kooperation' }
    ]);
    store.setCustomColumnValues({ v3: { cc1: 'Story' }, v1: { cc1: 'Reel' }, k3: { cc2: 'true' } });

    const defs = kooperationFilterDefs({ store, hiddenColumns: [] });
    expect(defs.filter((def) => def.id.startsWith('custom_')).map((def) => def.label)).toEqual(['Kanal', 'Rechnung da']);
    expect(kooperationFilterDefs({ store, hiddenColumns: ['custom:cc2'] }).some((def) => def.id === 'custom_cc2')).toBe(false);

    store.setColumnFilters({ custom_cc1: ['Story'] });
    expect(ids(store.getFiltered('alle'))).toEqual(['k2']);
    store.setColumnFilters({ custom_cc2: true });
    expect(ids(store.getFiltered('alle'))).toEqual(['k3']);
  });

  it('meldet Tag-Änderungen an die Summary-Karten, sonst nicht', () => {
    const store = buildStore();
    const onTags = vi.fn();
    store.on('tags-filter-changed', onTags);
    store.setColumnFilters({ status: ['Gebucht'] });
    expect(onTags).not.toHaveBeenCalled();
    store.setColumnFilters({ status: ['Gebucht'], tag: ['Juli'] });
    expect(onTags).toHaveBeenCalledWith(['Juli']);
    expect(store.hasActiveFilters()).toBe(true);
    store.destroy();
    expect(store.columnFilters).toEqual({});
  });
});

describe('Filterspalte in der Produktion', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/produktion/p1?tab=kooperationen');
    window.canFeature = (key) => key === 'kampagneTableFilter';
    window.canCreate = () => false;
    window.isKunde = () => false;
    window.isInternal = () => true;
    window.validatorSystem = { sanitizeHtml: (text) => text, sanitizeUrl: (url) => url };
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.canFeature;
  });

  function renderDetail(detail) {
    document.body.innerHTML = renderMainPage({
      kampagneData: { kampagnenname: 'K' },
      mode: 'workflow',
      activeWorkflow: 'kooperationen',
      kooperationFilter: detail.koopFilter
    });
    mountKooperationFilter(detail);
  }

  it('ersetzt die Menüs „Status filtern“, „Tags filtern“ und „Sortierung“ durch die Spalte', () => {
    const detail = { mode: 'workflow', store: buildStore(), currentView: 'table', kooperationenVideoTable: { refilter: vi.fn() } };
    syncKooperationFilter(detail);
    renderDetail(detail);

    expect(document.body.textContent).not.toContain('Status filtern');
    expect(document.querySelector('[data-sort-submenu]')).toBeNull();
    expect(document.querySelector('[data-chrome="kooperationen"] #koop-filter-toggle')).not.toBeNull();
    const layout = document.querySelector('[data-filter-layout="koop"]');
    expect(layout.classList.contains('is-column-collapsed')).toBe(true);
    expect(layout.querySelector('#kooperationen-videos-container')).not.toBeNull();
    expect(layout.querySelector('input[name="koop-sort"]').value).toBe('created_desc');
  });

  it('übernimmt Werte aus der URL in den Store und setzt sie zurück', () => {
    window.history.replaceState(null, '', '/produktion/p1?koop.status=Gebucht&koop.sort=name_asc');
    const detail = { mode: 'workflow', store: buildStore(), currentView: 'table', kooperationenVideoTable: { refilter: vi.fn() } };
    syncKooperationFilter(detail);
    expect(detail.store.columnFilters).toEqual({ status: ['Gebucht'] });
    expect(detail.store.kooperationSort).toBe('name_asc');

    renderDetail(detail);
    resetKooperationFilter(detail);
    expect(detail.store.columnFilters).toEqual({});
    expect(window.location.search).not.toContain('koop.status');
  });

  it('bleibt ohne kampagneTableFilter und außerhalb der Produktion aus', () => {
    window.canFeature = () => false;
    const ohneRecht = { mode: 'workflow', store: buildStore() };
    expect(syncKooperationFilter(ohneRecht)).toBeNull();

    window.canFeature = () => true;
    const kampagne = { mode: 'overview', store: buildStore() };
    expect(syncKooperationFilter(kampagne)).toBeNull();
  });
});
