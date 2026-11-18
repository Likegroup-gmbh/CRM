// Filter und Sortierungen der Kooperationen-Tabelle in der Produktion.
// Der KampagneDetailStore filtert mit diesen Definitionen (getFiltered), die
// Filterspalte zeigt sie an. Kooperationen haben keine manuelle Reihenfolge,
// die Sortierung läuft weiter über sortKooperationen.

import { createTableFilter } from '../../core/filterColumn/tableFilterColumn.js';
import { optionsFromRows } from '../../core/filterColumn/filterRows.js';
import { customColumnFilterDefs, customColumnFilterGroup } from '../../core/filterColumn/customColumnFilters.js';

export const KOOP_FILTER_KEY = 'koop';
export const DEFAULT_KOOPERATION_SORT = 'created_desc';

export const KAMPAGNE_KOOPERATION_SORT_OPTIONS = Object.freeze([
  { value: 'name_asc', label: 'A-Z' },
  { value: 'name_desc', label: 'Z-A' },
  { value: 'created_desc', label: 'Neueste zuerst' },
  { value: 'created_asc', label: 'Älteste zuerst' },
  { value: 'posting_asc', label: 'GoLive früheste zuerst' },
  { value: 'posting_desc', label: 'GoLive späteste zuerst' },
  { value: 'content_deadline_asc', label: 'Content-Deadline früheste zuerst' },
  { value: 'content_deadline_desc', label: 'Content-Deadline späteste zuerst' }
]);

const toNumber = (raw) => {
  const n = raw == null || raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
};

export function koopStatusName(koop) {
  return koop?.status_name || koop?.status_ref?.name || '';
}

function videoValues(store, koop, field) {
  return (store?.videos?.[koop.id] || []).map((video) => video?.[field]).filter(Boolean);
}

function vkSumme(store, koop) {
  const preise = (store?.videos?.[koop.id] || []).map((video) => toNumber(video?.verkaufspreis_netto)).filter((n) => n != null);
  return preise.length ? preise.reduce((sum, n) => sum + n, 0) : null;
}

function creatorName(store, koop) {
  return store?.getKoopCreatorName ? store.getKoopCreatorName(koop) : '';
}

/** Wert einer eigenen Spalte; Video-Spalten liefern die Werte aller Videos der Kooperation. */
function customValue(store, koop, col) {
  if (col.entity_type === 'video') {
    return (store?.videos?.[koop.id] || []).map((video) => store.getCustomColumnValue(video.id, col.id));
  }
  return store?.getCustomColumnValue?.(koop.id, col.id);
}

/**
 * @param {{ store: object, isKunde?: boolean, hiddenColumns?: string[] }} ctx
 * Ohne isKunde liefert die Funktion alle Filter (der Store filtert damit).
 */
export function kooperationFilterDefs({ store, isKunde = false, hiddenColumns = [] } = {}) {
  const koops = store?.kooperationen || [];
  const defs = [
    {
      id: 'status', label: 'Status', type: 'multiSelect',
      options: (store?.getAvailableStatuses?.() || []).map((name) => ({ value: name, label: name })),
      get: koopStatusName
    },
    {
      id: 'tag', label: 'Tags', type: 'multiSelect',
      options: (store?.getAvailableTags?.() || []).map((name) => ({ value: name, label: name })),
      get: (koop) => koop._tags || []
    },
    {
      id: 'creator', label: 'Creator', type: 'multiSelect',
      options: optionsFromRows(koops, (koop) => creatorName(store, koop)),
      get: (koop) => creatorName(store, koop)
    },
    {
      id: 'golive', label: 'GoLive', type: 'dateRange',
      get: (koop) => {
        const tage = videoValues(store, koop, 'posting_datum');
        return tage.length ? tage : koop.posting_datum;
      }
    },
    {
      id: 'content_deadline', label: 'Content-Deadline', type: 'dateRange',
      get: (koop) => videoValues(store, koop, 'content_deadline')
    },
    {
      id: 'ek', label: 'EK gesamt (€)', type: 'numberRange', teamOnly: true,
      get: (koop) => toNumber(koop.einkaufspreis_gesamt)
    },
    {
      id: 'vk', label: 'VK der Videos (€)', type: 'numberRange', teamOnly: true,
      get: (koop) => vkSumme(store, koop)
    }
  ];
  // Eigene Spalten der Kampagne sehen Kunden wie alle übrigen nicht ausgeblendeten Spalten.
  const eigene = customColumnFilterDefs(
    store?.customColumns || [],
    (koop, col) => customValue(store, koop, col),
    { isKunde, hiddenColumns, kundenSichtbar: () => true }
  );
  return [...(isKunde ? defs.filter((def) => !def.teamOnly) : defs), ...eigene];
}

export const KOOPERATION_FILTER_GROUPS = Object.freeze([
  { id: 'basic', label: 'Status und Tags', expanded: true, filters: ['status', 'tag', 'creator'] },
  { id: 'termine', label: 'Termine', expanded: true, filters: ['golive', 'content_deadline'] },
  { id: 'preise', label: 'Preise', expanded: false, filters: ['ek', 'vk'] }
]);

export function kooperationFilterGroups(defs) {
  return [...KOOPERATION_FILTER_GROUPS, ...customColumnFilterGroup(defs)];
}

export function kooperationSorts() {
  return KAMPAGNE_KOOPERATION_SORT_OPTIONS.map(({ value, label }) => ({ id: value, label }));
}

export function createKooperationTableFilter(ctx) {
  const filters = kooperationFilterDefs(ctx);
  return createTableFilter({
    key: KOOP_FILTER_KEY,
    filters,
    groups: kooperationFilterGroups(filters),
    sorts: kooperationSorts(),
    defaultSort: DEFAULT_KOOPERATION_SORT
  });
}

/**
 * Filterspalte der KampagneDetail (nur Produktion, nur mit kampagneTableFilter)
 * anlegen oder an die geladenen Kooperationen angleichen; schreibt Auswahl und
 * Sortierung in den Store.
 */
export function syncKooperationFilter(detail) {
  const store = detail.store;
  const erlaubt = detail.mode === 'workflow' && !!store && (window.canFeature?.('kampagneTableFilter') ?? false);
  if (!erlaubt) {
    destroyKooperationFilter(detail);
    return null;
  }
  const ctx = {
    store,
    isKunde: !!window.isKunde?.(),
    hiddenColumns: detail.kooperationenVideoTable?.hiddenColumns || detail.kampagneData?.video_table_hidden_columns || []
  };
  if (detail.koopFilter) {
    const filters = kooperationFilterDefs(ctx);
    detail.koopFilter.setFilters(filters, kooperationFilterGroups(filters));
  } else {
    detail.koopFilter = createKooperationTableFilter(ctx);
  }
  store.setColumnFilters(detail.koopFilter.getValues());
  store.setKooperationSort(detail.koopFilter.getSort());
  return detail.koopFilter;
}

function refreshKooperationen(detail) {
  if (detail.currentView === 'kanban') detail.kanbanBoard?.render();
  else detail.kooperationenVideoTable?.refilter();
}

/** Nach jedem Rendern der Seite: Spalte füllen und an Store und Ansicht hängen. */
export function mountKooperationFilter(detail) {
  const filter = detail.koopFilter;
  if (!filter) return;
  filter.mount({
    root: document.getElementById('workflow-pane-kooperationen'),
    toggleRoot: document.querySelector('.kampagne-tab-chrome[data-chrome="kooperationen"]'),
    onChange: ({ values, sort }) => {
      detail.store?.setColumnFilters(values);
      detail.store?.setKooperationSort(sort);
      refreshKooperationen(detail);
    }
  });
}

/** Leerzustand „Filter zurücksetzen“: Spaltenwerte leeren, Spalte neu zeichnen. */
export function resetKooperationFilter(detail) {
  detail.store?.setColumnFilters({});
  if (!detail.koopFilter) return;
  detail.koopFilter.setValues({});
  mountKooperationFilter(detail);
}

export function destroyKooperationFilter(detail) {
  detail.koopFilter?.destroy();
  detail.koopFilter = null;
}
