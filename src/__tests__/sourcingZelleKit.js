// Test-Helfer fuer die Casting-Zeile: rendert eine Zeile und liefert die Zelle.
// Die alten Plattform-Schluessel (cp-col-follower-ig, cp-col-preis-tt-video ...)
// stehen weiter in hidden_columns und stehen hier fuer die Plattformzeile der
// gemeinsamen Spalte - der Helfer gibt deren Inhalt zurueck.

import { renderItemRow } from '../modules/creator-auswahl/castingItemRow.js';

const PLATTFORMZEILE = {
  'cp-col-link-ig': ['cp-col-link', 'instagram'],
  'cp-col-link-tt': ['cp-col-link', 'tiktok'],
  'cp-col-follower-ig': ['cp-col-follower', 'instagram'],
  'cp-col-follower-tt': ['cp-col-follower', 'tiktok'],
  'cp-col-preis-reels': ['cp-col-preis-video', 'instagram'],
  'cp-col-preis-tt-video': ['cp-col-preis-video', 'tiktok'],
  'cp-col-preis-story': ['cp-col-story-preis', 'instagram'],
  'cp-col-preis-tt-story': ['cp-col-story-preis', 'tiktok']
};

export function renderZeile(ctx = {}, item = {}) {
  const html = renderItemRow({ isKunde: false, hiddenColumns: [], ...ctx }, { id: 'i1', ...item }, 0);
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

/** Zelle einer Spalte, bei Plattform-Schluesseln der Inhalt der Plattformzeile */
export function renderCell(columnClass, item, ctx = {}) {
  const doc = renderZeile(ctx, item);
  const ziel = PLATTFORMZEILE[columnClass];
  if (!ziel) return doc.querySelector(`td.${columnClass}`);
  return doc.querySelector(`td.${ziel[0]} .plattform-zeile[data-plattform="${ziel[1]}"] .plattform-zeile__inhalt`);
}
