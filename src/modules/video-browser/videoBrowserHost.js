// videoBrowserHost.js
// Aktiver Detailbereich: die offene Vollansicht (`vb.voll`), sonst das Detail des Ordners.
// Kommentare, Caption, Tags, Titel und Final-Leiste arbeiten über diese Zugriffe und laufen so
// in beiden Ansichten, ohne dass die Vollansicht die Auswahl des Ordners (`vb.sel`) anfasst.

import { resolveSelection } from './videoBrowserLogic.js';

export const detailRoot = (vb) => vb.voll?.root || vb.detailInner || null;

export const detailSel = (vb) => vb.voll?.sel || vb.sel;

export const detailPlayer = (vb) => (vb.voll ? vb.voll.player : vb.player) || null;

export const detailResolved = (vb) => resolveSelection(vb.tree, detailSel(vb));

/** Scrollbereich, in dem die Kommentare stehen. */
export const commentScroller = (vb) => (vb.voll
  ? vb.voll.root.querySelector('[data-vb-voll-scroll]')
  : vb.detailInner?.closest('.vb-detail')) || null;
