// Gemeinsame Helfer fuer die Tests der Casting-Tabelle (Zeile und ganze Tabelle als DOM).

import { renderItemRow } from '../modules/creator-auswahl/castingItemRow.js';
import { renderItemsTable } from '../modules/creator-auswahl/castingTableRender.js';

export function baseCtx(overrides = {}) {
  return { isKunde: false, hiddenColumns: [], ...overrides };
}

export function rowDoc(item = {}, ctx = {}) {
  const html = renderItemRow(baseCtx(ctx), { id: 'i1', ...item }, 0);
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

export function cell(columnClass, item = {}, ctx = {}) {
  return rowDoc(item, ctx).querySelector(`td.${columnClass}`);
}

export function tableDoc(items, ctx = {}) {
  const html = renderItemsTable(baseCtx({ items, hasAnyItems: items.length > 0, ...ctx }));
  return new DOMParser().parseFromString(html, 'text/html');
}
