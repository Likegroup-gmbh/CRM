// ColumnRegistry.js
// Single Source of Truth fuer alle Spalten-Definitionen der Kooperationstabelle.
// Feste Spalten + Custom Columns, Reihenfolge, Visibility.

import { VIDEO_FEEDBACK_FIELDS } from '../../../core/VideoFeedbackBuckets.js';

// Feste Spalten in Default-Reihenfolge.
// `id` = CSS-Klasse (col-*), `dataCol` = Resize-Handle-Referenz
const DEFAULT_COLUMNS = [
  { id: 'col-nr', label: 'Nr', dataCol: '0', configurable: false },
  { id: 'col-creator', label: 'Creator', dataCol: '1', configurable: false },
  { id: 'col-status', label: 'Status', dataCol: '1b', configurable: true },
  { id: 'col-tags', label: 'Tags', dataCol: '1c', configurable: true },
  { id: 'col-extra-kosten', label: 'Extra Kosten', dataCol: '1d', configurable: true },
  { id: 'col-vertrag', label: 'Vertrag', dataCol: '4', configurable: true },
  { id: 'col-nutzungsrechte', label: 'Nutzungsrechte', dataCol: '5', configurable: true },
  { id: 'col-start-datum', label: 'Erstellt', dataCol: '6', configurable: true },
  { id: 'col-videoanzahl', label: 'Videos', dataCol: '9', configurable: true },
  { id: 'col-video-nr', label: 'Video-Nr', dataCol: '10', configurable: true },
  { id: 'col-vk-video', label: 'Kosten', dataCol: '10b', configurable: true },
  { id: 'col-video-script-deadline', label: 'Script Deadline', dataCol: '10d', configurable: true },
  { id: 'col-video-content-deadline', label: 'Content Deadline', dataCol: '10e', configurable: true },
  { id: 'col-video-typ', label: 'Typ', dataCol: '10c', configurable: true },
  { id: 'col-thema', label: 'Thema', dataCol: '11', configurable: true },
  { id: 'col-idee-strategie', label: 'Idee/Strategie', dataCol: '11b', configurable: true },
  { id: 'col-organic-paid', label: 'Content/Art', dataCol: '12', configurable: true },
  { id: 'col-produkt', label: 'Produkte', dataCol: '13', configurable: true },
  { id: 'col-lieferadresse', label: 'Lieferadresse', dataCol: '14', configurable: true },
  { id: 'col-telefon', label: 'Telefonnummer', dataCol: '14b', configurable: true },
  { id: 'col-paket-tracking', label: 'Tracking', dataCol: '15', configurable: true },
  { id: 'col-drehort', label: 'Drehort', dataCol: '16', configurable: true },
  { id: 'col-link-skript', label: 'Link Skript / Briefing', dataCol: '17', configurable: true },
  { id: 'col-skript-freigegeben', label: 'Skript freigegeben', dataCol: '18', configurable: true },
  { id: 'col-video-name', label: 'Video-Name', dataCol: '18b', configurable: true },
  { id: 'col-link-content', label: 'Content', dataCol: '19', configurable: true },
  ...VIDEO_FEEDBACK_FIELDS.map((slot, idx) => ({
    id: slot.colClass,
    label: slot.label,
    dataCol: String(20 + idx),
    configurable: true,
    feedbackSlot: slot
  })),
  { id: 'col-freigabe', label: 'Freigabe', dataCol: '26', configurable: true },
  { id: 'col-caption', label: 'Caption', dataCol: '27', configurable: true },
  { id: 'col-finale-version', label: 'Finale Version', dataCol: '28', configurable: true },
  { id: 'col-posting-datum', label: 'Posting Datum', dataCol: '29', configurable: true },
  { id: 'col-actions', label: 'Aktionen', dataCol: '30', configurable: false }
];

const BUILTIN_MAP = new Map(DEFAULT_COLUMNS.map(c => [c.id, c]));

const CUSTOM_COL_PREFIX = 'custom:';

export function getDefaultColumnIds() {
  return DEFAULT_COLUMNS.map(c => c.id);
}

export function getBuiltinColumn(colId) {
  return BUILTIN_MAP.get(colId) || null;
}

export function isCustomColumnId(colId) {
  return typeof colId === 'string' && colId.startsWith(CUSTOM_COL_PREFIX);
}

export function extractCustomColumnUuid(colId) {
  return colId.slice(CUSTOM_COL_PREFIX.length);
}

export function makeCustomColumnId(uuid) {
  return `${CUSTOM_COL_PREFIX}${uuid}`;
}

/**
 * Liefert alle Spalten in der richtigen Reihenfolge.
 * Mischt feste und Custom Columns basierend auf der gespeicherten column_order.
 */
export function getOrderedColumns(store) {
  const customColumns = store?.customColumns || [];
  const savedOrder = store?.columnOrder;

  if (!savedOrder || savedOrder.length === 0) {
    return buildDefaultOrderWithCustom(customColumns);
  }

  const result = [];
  const usedIds = new Set();

  for (const colId of savedOrder) {
    if (isCustomColumnId(colId)) {
      const uuid = extractCustomColumnUuid(colId);
      const cc = customColumns.find(c => c.id === uuid);
      if (cc) {
        result.push(toColumnEntry(cc));
        usedIds.add(colId);
      }
    } else {
      const builtin = BUILTIN_MAP.get(colId);
      if (builtin) {
        result.push({ ...builtin, isCustom: false });
        usedIds.add(colId);
      }
    }
  }

  // Feste Spalten die nicht in savedOrder waren (z.B. neu hinzugefuegt):
  // an ihrer Default-Position einfuegen (direkt hinter dem naechsten
  // vorangehenden Default-Nachbarn), damit Header und hart codierte
  // Body-Zellen zusammenpassen.
  for (let defIdx = 0; defIdx < DEFAULT_COLUMNS.length; defIdx++) {
    const col = DEFAULT_COLUMNS[defIdx];
    if (usedIds.has(col.id)) continue;

    let insertIdx = -1;
    for (let prev = defIdx - 1; prev >= 0; prev--) {
      const prevIdx = result.findIndex(c => c.id === DEFAULT_COLUMNS[prev].id);
      if (prevIdx >= 0) {
        insertIdx = prevIdx + 1;
        break;
      }
    }
    if (insertIdx < 0) {
      const actionsIdx = result.findIndex(c => c.id === 'col-actions');
      insertIdx = actionsIdx >= 0 ? actionsIdx : result.length;
    }
    result.splice(insertIdx, 0, { ...col, isCustom: false });
    usedIds.add(col.id);
  }

  // Custom Columns die nicht in savedOrder waren (neu angelegt)
  for (const cc of customColumns) {
    const ccId = makeCustomColumnId(cc.id);
    if (!usedIds.has(ccId)) {
      const actionsIdx = result.findIndex(c => c.id === 'col-actions');
      if (actionsIdx >= 0) {
        result.splice(actionsIdx, 0, toColumnEntry(cc));
      } else {
        result.push(toColumnEntry(cc));
      }
    }
  }

  return result;
}

function buildDefaultOrderWithCustom(customColumns) {
  const result = DEFAULT_COLUMNS.map(c => ({ ...c, isCustom: false }));

  if (customColumns.length === 0) return result;

  // Custom Columns vor "Aktionen" einfuegen
  const actionsIdx = result.findIndex(c => c.id === 'col-actions');
  const insertIdx = actionsIdx >= 0 ? actionsIdx : result.length;
  const sorted = [...customColumns].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  for (let i = 0; i < sorted.length; i++) {
    result.splice(insertIdx + i, 0, toColumnEntry(sorted[i]));
  }

  return result;
}

function toColumnEntry(customCol) {
  return {
    id: makeCustomColumnId(customCol.id),
    uuid: customCol.id,
    label: customCol.name,
    dataCol: `cc-${customCol.id.slice(0, 8)}`,
    configurable: true,
    isCustom: true,
    fieldType: customCol.field_type,
    entityType: customCol.entity_type,
    visibleForKunden: customCol.visible_for_kunden,
    dropdownOptions: customCol._dropdownOptions || []
  };
}

/**
 * Soll diese Spalte sichtbar sein?
 * Zentralisiert die Logik aus isColumnVisibleForCustomer.
 */
export function isColumnVisible(colId, hiddenColumns, isKunde) {
  // Nr, Creator und Status immer sichtbar
  if (colId === 'col-nr' || colId === 'col-creator' || colId === 'col-status') return true;

  // Kosten/EK-Video/Aktionen/Vertrag fuer Kunden nie sichtbar
  if (isKunde) {
    if (colId === 'col-kosten' || colId === 'col-ek-video') return false;
    if (colId === 'col-actions' || colId === 'col-vertrag') return false;
  }

  // Aktionen immer fuer Nicht-Kunden sichtbar
  if (colId === 'col-actions') return true;

  // Custom Columns: Kunden-Sichtbarkeit pruefen
  if (isCustomColumnId(colId)) {
    // hiddenColumns Check gilt auch fuer Custom Cols
    return !hiddenColumns.includes(colId);
  }

  return !hiddenColumns.includes(colId);
}

/**
 * Liefert die konfigurierbaren Spalten fuer den VisibilityDrawer.
 */
export function getConfigurableColumns(store) {
  return getOrderedColumns(store).filter(c => c.configurable);
}

/**
 * Baut ein neues columnOrder-Array wenn eine Custom Column hinzugefuegt wird.
 * Fuegt vor col-actions ein.
 */
export function buildColumnOrderWithNewCustom(currentOrder, customColumnId) {
  const ccId = makeCustomColumnId(customColumnId);
  const order = currentOrder && currentOrder.length > 0
    ? [...currentOrder]
    : getDefaultColumnIds();

  const actionsIdx = order.indexOf('col-actions');
  if (actionsIdx >= 0) {
    order.splice(actionsIdx, 0, ccId);
  } else {
    order.push(ccId);
  }
  return order;
}

/**
 * Entfernt eine Custom Column aus dem columnOrder-Array.
 */
export function removeFromColumnOrder(currentOrder, customColumnId) {
  const ccId = makeCustomColumnId(customColumnId);
  if (!currentOrder) return null;
  return currentOrder.filter(id => id !== ccId);
}

export { DEFAULT_COLUMNS, CUSTOM_COL_PREFIX };
