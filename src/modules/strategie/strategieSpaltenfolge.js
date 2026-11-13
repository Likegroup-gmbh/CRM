// strategieSpaltenfolge.js
// Reihenfolge der beweglichen Konzept-Spalten.
//
// Gespeichert wird sie als column_order auf der Strategie: ein Array aus
// "col-…" und "custom:{uuid}". Null oder leer heisst Standardreihenfolge.
// #, Griff, Profil, Creator, Bild, Plattform und Aktionen stehen nicht in dem Array.

import { isCustomColumnId } from '../../core/customColumns/entityColumnUtils.js';
import { STRATEGIE_FIXED_COLUMNS } from './strategieColumns.js';

export function fixedSpaltenId(key) {
  return `col-${key}`;
}

export function fixedKeyAusId(id) {
  if (typeof id !== 'string' || !id.startsWith('col-')) return null;
  const key = id.slice(4);
  return STRATEGIE_FIXED_COLUMNS.some(col => col.key === key) ? key : null;
}

export function hatEigeneReihenfolge(columnOrder) {
  return Array.isArray(columnOrder) && columnOrder.length > 0;
}

/** Feste Spalten, die im Drawer gezogen werden. Profil und Creator bleiben links fest. */
export function standardBeweglicheSpalten() {
  return STRATEGIE_FIXED_COLUMNS
    .filter(col => col.key !== 'creator')
    .map(col => fixedSpaltenId(col.key));
}

function fuegeFehlendeEin(basis, fehlend, vorlage) {
  const result = [...basis];
  for (const id of fehlend) {
    const vorlageIndex = vorlage.indexOf(id);
    if (isCustomColumnId(id)) {
      let anchorId = null;
      for (let i = vorlageIndex - 1; i >= 0; i--) {
        if (!isCustomColumnId(vorlage[i])) {
          anchorId = vorlage[i];
          break;
        }
      }
      const anchorIdx = anchorId == null ? -1 : result.indexOf(anchorId);
      let insertAt = anchorIdx >= 0 ? anchorIdx + 1 : result.length;
      while (
        insertAt < result.length
        && isCustomColumnId(result[insertAt])
        && vorlage.indexOf(result[insertAt]) < vorlageIndex
      ) {
        insertAt++;
      }
      result.splice(insertAt, 0, id);
      continue;
    }

    const davor = new Set(vorlage.slice(0, vorlageIndex));
    let insertAt = 0;
    result.forEach((vorhanden, index) => {
      if (davor.has(vorhanden)) insertAt = index + 1;
    });
    result.splice(insertAt, 0, id);
  }
  return result;
}

/**
 * Bewegliche Spalten in Anzeige-Reihenfolge (Drawer und Tabelle).
 * @param {string[]|null} [columnOrder]
 * @param {string[]} [customColumnIds] "custom:{uuid}"
 */
export function baueStrategieSpaltenfolge({ columnOrder = null, customColumnIds = [] } = {}) {
  const eigene = (customColumnIds || []).filter(id => isCustomColumnId(id));
  const vorlage = [...standardBeweglicheSpalten(), ...eigene];
  if (!hatEigeneReihenfolge(columnOrder)) return vorlage;

  const erlaubt = new Set(vorlage);
  const gespeichert = [];
  const gesehen = new Set();
  for (const id of columnOrder) {
    if (!erlaubt.has(id) || gesehen.has(id)) continue;
    gespeichert.push(id);
    gesehen.add(id);
  }
  const fehlend = vorlage.filter(id => !gesehen.has(id));
  return fuegeFehlendeEin(gespeichert, fehlend, vorlage);
}

/**
 * Eigene Spalten in der flachen Folge auf eine neue Reihenfolge untereinander
 * ziehen. Ihre Plaetze zwischen den festen Spalten bleiben.
 */
export function uebernehmeEigeneReihenfolge(folge, eigeneIds) {
  const erlaubt = new Set(eigeneIds || []);
  const next = (folge || []).filter(id => !isCustomColumnId(id) || erlaubt.has(id));
  const slots = [];
  next.forEach((id, index) => {
    if (isCustomColumnId(id)) slots.push(index);
  });
  const rest = [];
  (eigeneIds || []).forEach((id, index) => {
    const slot = slots[index];
    if (slot == null) rest.push(id);
    else next[slot] = id;
  });
  return [...next, ...rest];
}

function schluesselDerZelle(el) {
  if (el?.dataset?.customColId) return el.dataset.customColId;
  return Array.from(el?.classList || []).find(cls => cls.startsWith('col-')) || null;
}

/** Zellen einer Zeile in die Folge bringen. Unbekannte Zellen bleiben bei ihrem Vorgaenger. */
export function ordneZellen(row, folge) {
  const cells = Array.from(row?.children || []);
  if (!cells.length || !folge?.length) return;

  const byKey = new Map();
  for (const cell of cells) {
    const key = schluesselDerZelle(cell);
    if (key && !byKey.has(key)) byKey.set(key, cell);
  }

  const ordered = [];
  const used = new Set();
  for (const id of folge) {
    const cell = byKey.get(id);
    if (!cell || used.has(cell)) continue;
    ordered.push(cell);
    used.add(cell);
  }

  for (const cell of cells) {
    if (used.has(cell)) continue;
    let insertAt = ordered.length;
    const idx = cells.indexOf(cell);
    for (let i = idx - 1; i >= 0; i--) {
      const pos = ordered.indexOf(cells[i]);
      if (pos >= 0) {
        insertAt = pos + 1;
        break;
      }
    }
    ordered.splice(insertAt, 0, cell);
    used.add(cell);
  }

  for (const cell of ordered) row.appendChild(cell);
}

export function ordneStrategieZeileHtml(rowHtml, folge) {
  const doc = new DOMParser().parseFromString(`<table><tbody>${rowHtml}</tbody></table>`, 'text/html');
  const tr = doc.querySelector('tr');
  if (!tr) return rowHtml;
  ordneZellen(tr, folge);
  return tr.outerHTML;
}

export function ordneStrategieTabellenHtml(html, folge) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const container = doc.querySelector('.table-container');
  if (!container) return html;
  const kopf = container.querySelector('thead tr');
  if (kopf) ordneZellen(kopf, folge);
  container.querySelectorAll('tbody tr.item-row').forEach(tr => ordneZellen(tr, folge));
  return container.outerHTML;
}
