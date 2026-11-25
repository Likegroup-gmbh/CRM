// Filter und Sortierungen der Konzept-Tabelle (Videoideen) für die Filterspalte.
// Kunden bekommen nur Filter auf Spalten, die sie sehen; Persona und Status nur das Team.
// Videoidee-Vorschläge filtert und sortiert die Spalte nicht.

import { createTableFilter } from '../../core/filterColumn/tableFilterColumn.js';
import { customColumnFilterDefs, customColumnFilterGroup } from '../../core/filterColumn/customColumnFilters.js';
import { optionsFromRows } from '../../core/filterColumn/filterRows.js';
import { STRATEGIE_PRIO_OPTIONS, getStrategiePrio } from './strategiePrioOptions.js';
import { FUNNEL_LABELS, FUNNEL_WERTE, getStrategieFunnel } from './strategieFunnelOptions.js';
import { getStrategiePersona, personaLabel } from './strategiePersonaOptions.js';
import { getStrategieVideolaenge } from './strategieVideolaenge.js';
import { isFixedColumnVisible, buildColumnContext } from './strategieColumns.js';

export const KONZEPT_FILTER_KEY = 'konzept';
const OHNE_KATEGORIE = 'Ohne Kategorie';
const OHNE = '__ohne__';
const PRIO_RANG = Object.freeze({ prio_1: 1, prio_2: 2, offen: 3, nicht_umsetzen: 4 });

export function creatorNameOf(item) {
  const eintrag = item?.casting_eintrag;
  if (item?.creator_auswahl_item_id) {
    return eintrag?.name
      || (eintrag?.creator ? `${eintrag.creator.vorname || ''} ${eintrag.creator.nachname || ''}`.trim() : '')
      || '';
  }
  if (item?.creator) return `${item.creator.vorname || ''} ${item.creator.nachname || ''}`.trim();
  return item?.creator_name || '';
}

function dauerOf(item) {
  const iv = getStrategieVideolaenge(item);
  return iv ? (iv.von ?? iv.bis ?? null) : null;
}

function mitOhne(options, label) {
  return [...options, { value: OHNE, label }];
}

const leerOder = (value) => (value ? value : OHNE);

/**
 * @param {{ items?: Array, teilbereiche?: string[], isKunde?: boolean, hiddenColumns?: string[],
 *   columnContext?: object, personaById?: Map, customManager?: object }} ctx
 */
export function konzeptFilterDefs({
  items = [], teilbereiche = [], isKunde = false, hiddenColumns = [], columnContext = null, personaById = new Map(),
  customManager = null
} = {}) {
  const sichtbar = (key) => isFixedColumnVisible(hiddenColumns, key, columnContext);
  const kategorien = [...new Set([...teilbereiche, ...items.map((item) => item.teilbereich || OHNE_KATEGORIE)])];
  if (!kategorien.includes(OHNE_KATEGORIE)) kategorien.push(OHNE_KATEGORIE);

  const defs = [
    {
      id: 'kategorie', label: 'Kategorie', type: 'multiSelect',
      options: kategorien.map((name) => ({ value: name, label: name })),
      get: (item) => item.teilbereich || OHNE_KATEGORIE
    },
    {
      id: 'prio', label: 'Prio', type: 'multiSelect', column: 'prio',
      options: STRATEGIE_PRIO_OPTIONS.map(({ value, label }) => ({ value, label })),
      get: getStrategiePrio
    },
    {
      id: 'umgesetzt', label: 'Umsetzen', type: 'boolean', column: 'umgesetzt',
      get: (item) => !!item.video_umgesetzt
    },
    {
      id: 'status', label: 'Skript freigegeben', type: 'boolean', column: 'status', teamOnly: true,
      get: (item) => !!item.skript_freigabe
    },
    {
      id: 'creator', label: 'Creator', type: 'multiSelect', column: 'creator',
      options: mitOhne(optionsFromRows(items, creatorNameOf), 'Ohne Creator'),
      get: (item) => leerOder(creatorNameOf(item))
    },
    {
      id: 'produkt', label: 'Produkt', type: 'multiSelect', column: 'produkt',
      options: mitOhne(optionsFromRows(items, (item) => (item.produkt_id
        ? { value: item.produkt_id, label: item.produkt?.name || 'Unbekannt' }
        : null)), 'Ohne Produkt'),
      get: (item) => leerOder(item.produkt_id)
    },
    {
      id: 'persona', label: 'Persona', type: 'multiSelect', column: 'persona', teamOnly: true,
      options: mitOhne([...personaById.values()].map((persona) => ({ value: persona.id, label: personaLabel(persona) })), 'Ohne Persona'),
      get: (item) => leerOder(getStrategiePersona(item))
    },
    {
      id: 'funnel', label: 'Funnel-Stufe', type: 'multiSelect', column: 'funnel',
      options: mitOhne(FUNNEL_WERTE.map((value) => ({ value, label: FUNNEL_LABELS[value] })), 'Keine Stufe'),
      get: (item) => leerOder(getStrategieFunnel(item))
    },
    {
      id: 'dauer', label: 'Dauer (Sekunden)', type: 'numberRange', column: 'dauer',
      get: dauerOf
    },
    {
      id: 'art', label: 'Art', type: 'multiSelect',
      options: [{ value: 'referenz', label: 'Videoreferenz' }, { value: 'idee', label: 'Idee' }],
      get: (item) => (item.video_link ? 'referenz' : 'idee')
    }
  ];
  const eigene = customColumnFilterDefs(
    customManager?.getOrderedColumns?.() || [],
    (item, col) => customManager.getValue(item.id, col.id),
    { isKunde, hiddenColumns }
  );
  return [
    ...defs.filter((def) => !(isKunde && def.teamOnly) && (!def.column || sichtbar(def.column))),
    ...eigene
  ];
}

export const KONZEPT_FILTER_GROUPS = Object.freeze([
  { id: 'basic', label: 'Bewertung und Kategorie', expanded: true, filters: ['kategorie', 'prio', 'umgesetzt', 'status'] },
  { id: 'inhalt', label: 'Inhalt', expanded: true, filters: ['creator', 'produkt', 'persona', 'funnel', 'dauer', 'art'] }
]);

export function konzeptFilterGroups(defs) {
  return [...KONZEPT_FILTER_GROUPS, ...customColumnFilterGroup(defs)];
}

export function konzeptSorts() {
  return [
    { id: 'manuell', label: 'Manuell' },
    { id: 'prio', label: 'Prio', type: 'number', get: (item) => PRIO_RANG[getStrategiePrio(item)] },
    { id: 'creator', label: 'Creator, A–Z', get: creatorNameOf },
    { id: 'dauer', label: 'Dauer, kürzeste zuerst', type: 'number', get: dauerOf },
    { id: 'neu', label: 'Neueste zuerst', type: 'date', direction: 'desc', get: (item) => item.created_at }
  ];
}

export function createKonzeptTableFilter(ctx = {}) {
  const filters = konzeptFilterDefs(ctx);
  return createTableFilter({
    key: KONZEPT_FILTER_KEY,
    filters,
    groups: konzeptFilterGroups(filters),
    sorts: konzeptSorts(),
    defaultSort: 'manuell'
  });
}

/** Legt die Filterspalte der StrategieDetail an oder gleicht ihre Optionen mit den Items ab. */
export function syncKonzeptTableFilter(detail) {
  const ctx = {
    items: (detail.items || []).filter((item) => !item.ist_vorschlag),
    teilbereiche: detail.getTeilbereicheFromStrategie?.() || [],
    isKunde: !!detail.isKunde,
    hiddenColumns: detail.hiddenColumns || [],
    columnContext: detail.columnContext ? detail.columnContext() : buildColumnContext(detail.strategie, detail.items),
    personaById: detail.personaById || new Map(),
    customManager: detail.customColumns || null
  };
  if (!detail.tableFilter) {
    detail.tableFilter = createKonzeptTableFilter(ctx);
    return detail.tableFilter;
  }
  const filters = konzeptFilterDefs(ctx);
  detail.tableFilter.setFilters(filters, konzeptFilterGroups(filters));
  return detail.tableFilter;
}
