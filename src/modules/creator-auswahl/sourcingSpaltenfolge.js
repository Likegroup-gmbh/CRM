// sourcingSpaltenfolge.js
// Reihenfolge der beweglichen Casting-Spalten.
//
// Gespeichert wird sie als column_order auf der Liste: ein Array aus
// "cp-col-…" und "custom:{uuid}". Null oder leer heisst Standardreihenfolge.
// Drag, Name und Aktionen stehen nicht in dem Array – die bleiben fest.
// Bild bleibt nur dann in der linken Sticky-Gruppe, wenn es weiter die erste
// bewegliche Spalte ist. Sonst scrollt es mit.

import {
  groupCustomColumnsByAnchor,
  isCustomColumnId,
  makeCustomColumnId,
  toOrderEntry
} from '../../core/customColumns/entityColumnUtils.js';
import {
  ANKER_ALIASE,
  DEAKTIVIERTE_SPALTEN,
  SOURCING_ANKER_SPALTEN,
  SOURCING_SPALTEN
} from './sourcingSpaltenKatalog.js';

const FEST_LINKS = new Set(['cp-col-drag', 'cp-col-name']);
const FEST_RECHTS = 'cp-col-actions';

export function hatEigeneReihenfolge(columnOrder) {
  return Array.isArray(columnOrder) && columnOrder.length > 0;
}

/** Standardspalten, die im Drawer "Tabelle anpassen" stehen. */
export function standardBeweglicheSpalten() {
  return SOURCING_SPALTEN.filter(col =>
    !FEST_LINKS.has(col) && col !== FEST_RECHTS && !DEAKTIVIERTE_SPALTEN.includes(col)
  );
}

/**
 * Anker fuer die flache Folge. Bild ist dabei, damit eine eigene Spalte
 * direkt hinter dem Bild (und damit hinter dem fixierten Namen) liegen kann.
 * Der Griff im Tabellenkopf nimmt Bild weiter nicht an – dort wuerde eine
 * Spalte in die Sticky-Gruppe rutschen.
 */
export function sourcingOrderAnchors() {
  return [
    'cp-col-bild',
    ...SOURCING_ANKER_SPALTEN.filter(col => !DEAKTIVIERTE_SPALTEN.includes(col))
  ];
}

/** Eigene Spalten hinter ihren Anker in die Standardfolge einsetzen. */
export function fuegeEigeneSpaltenEin(standards, customColumns) {
  const grouped = groupCustomColumnsByAnchor(customColumns || [], sourcingOrderAnchors());
  const out = [];
  for (const std of standards) {
    out.push(std);
    for (const col of grouped.byAnchor.get(std) || []) {
      out.push(makeCustomColumnId(col.id));
    }
  }
  for (const col of grouped.trailing) out.push(makeCustomColumnId(col.id));
  return out;
}

function fuegeFehlendeEin(basis, fehlend, vorlage) {
  const result = [...basis];
  for (const id of fehlend) {
    const vorlageIndex = vorlage.indexOf(id);
    if (isCustomColumnId(id)) {
      // Neue eigene Spalte bleibt am Anker, auch wenn daneben schon umsortiert wurde.
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

    // Neue Standardspalte: hinter den am weitesten rechts schon stehenden
    // Vorgaenger aus der Vorlage, damit eine gespeicherte Nachbarschaft bleibt.
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
 * @param {Array<{id: string, _anchor?: string|null}>} [customColumns]
 */
export function baueBeweglicheSpalten({ columnOrder = null, customColumns = [] } = {}) {
  const vorlage = fuegeEigeneSpaltenEin(standardBeweglicheSpalten(), customColumns);
  if (!hatEigeneReihenfolge(columnOrder)) return vorlage;

  const erlaubt = new Set(vorlage);
  const gespeichert = [];
  const gesehen = new Set();
  for (const gespeicherteId of columnOrder) {
    // Alte Plattform-Spalten stehen jetzt in der gemeinsamen Spalte: an der Stelle der ersten bleiben
    const id = ANKER_ALIASE[gespeicherteId] || gespeicherteId;
    if (!erlaubt.has(id) || gesehen.has(id)) continue;
    gespeichert.push(id);
    gesehen.add(id);
  }
  const fehlend = vorlage.filter(id => !gesehen.has(id));
  return fuegeFehlendeEin(gespeichert, fehlend, vorlage);
}

/**
 * Volle Tabellenreihenfolge inklusive der festen Spalten.
 * Bild steht nur dann zwischen Drag und Name, wenn es die erste bewegliche
 * Spalte ist. Sonst rueckt der Name nach und Bild scrollt mit den anderen.
 */
export function baueSourcingSpaltenfolge({
  columnOrder = null,
  customColumns = [],
  includeDrag = true,
  includeActions = true
} = {}) {
  const beweglich = baueBeweglicheSpalten({ columnOrder, customColumns });
  const bildVorne = beweglich[0] === 'cp-col-bild';
  const scroll = bildVorne ? beweglich.slice(1) : beweglich;
  const folge = [];
  if (includeDrag) folge.push('cp-col-drag');
  if (bildVorne) folge.push('cp-col-bild');
  folge.push('cp-col-name');
  folge.push(...scroll);
  if (includeActions) folge.push(FEST_RECHTS);
  return folge;
}

/** Dieselbe Rollenregel wie im Tabellenmarkup: Drag und Aktionen nur, wenn sie gerendert werden. */
export function spaltenfolgeFuerKontext(ctx) {
  const canWrite = !ctx?.isKunde && (ctx?.canEdit ?? true);
  const hasActions = !ctx?.isKunde && ((ctx?.canCreate ?? true) || (ctx?.canDelete ?? true));
  return baueSourcingSpaltenfolge({
    columnOrder: ctx?.columnOrder,
    customColumns: ctx?.customManager?.getOrderedColumns?.() || [],
    includeDrag: canWrite,
    includeActions: hasActions
  });
}

/**
 * Eigene Spalten nach einem Kopf-Griff neu in die gespeicherte Folge setzen.
 * Die Reihenfolge der Standardspalten bleibt, die eigenen rutschen hinter
 * ihren aktuellen Anker.
 */
export function ersetzeEigeneSpalten(folge, customColumns) {
  const standards = (folge || []).filter(id => !isCustomColumnId(id));
  return fuegeEigeneSpaltenEin(standards, customColumns);
}

/** Anker-Eintraege fuer custom_column_order, abgeleitet aus der flachen Folge. */
export function ankerEintraegeAusFolge(folge) {
  const anchors = new Set(sourcingOrderAnchors());
  const entries = [];
  let lastAnchor = null;
  for (const id of folge || []) {
    if (!isCustomColumnId(id)) {
      if (anchors.has(id)) lastAnchor = id;
      continue;
    }
    entries.push(toOrderEntry(id, lastAnchor));
  }
  return entries;
}

function schluesselDerZelle(el) {
  return el.dataset.customColId
    || Array.from(el.classList).find(cls => cls.startsWith('cp-col-'))
    || null;
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

export function ordneSourcingZeileHtml(rowHtml, folge) {
  const doc = new DOMParser().parseFromString(`<table><tbody>${rowHtml}</tbody></table>`, 'text/html');
  const tr = doc.querySelector('tr');
  if (!tr) return rowHtml;
  ordneZellen(tr, folge);
  return tr.outerHTML;
}

export function ordneSourcingTabellenHtml(html, folge) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const container = doc.querySelector('.table-container');
  if (!container) return html;
  const kopf = container.querySelector('thead tr');
  if (kopf) ordneZellen(kopf, folge);
  container.querySelectorAll('tbody tr.item-row').forEach(tr => ordneZellen(tr, folge));
  return container.outerHTML;
}
