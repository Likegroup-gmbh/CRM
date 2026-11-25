// videoBrowserView.js
// Ansicht des Videos-Tabs: Showcase (videoBrowserShowcase.js, Standard), Ordner (Spaltenbrowser) und
// Kalender (videoBrowserKalender.js), umschaltbar über "Showcase | Ordner | Kalender". Alle drei hängen im
// selben Gerüst und werden nur ein- und ausgeblendet. Hier liegen Umschalter, Wechsel und der URL-Abgleich.

import {
  EMPTY_SELECTION,
  ansichtFromSearch,
  kalenderToSearch,
  koopGroupToSearch,
  ordnerToSearch,
  selectionToSearch,
  showcaseToSearch
} from './videoBrowserLogic.js';
import { koopGroupParam } from './videoBrowserKoopState.js';
import { viewSwitchHtml } from './videoBrowserRenderShowcase.js';
import {
  destroyShowcase,
  hideShowcase,
  initShowcaseState,
  measureColumnRects,
  mountShowcase,
  onSegmentKeydown,
  openShowcaseVollansicht,
  renderShowcase,
  setSegment,
  showShowcase,
  showcaseSectionHtml,
  showcaseToolbarHtml
} from './videoBrowserShowcase.js';
import {
  destroyKalender,
  hideKalender,
  initKalenderState,
  kalenderSectionHtml,
  mountKalender,
  onKalenderClick,
  reloadKalender,
  showKalender
} from './videoBrowserKalender.js';
import { closeVollansicht, vollansichtSel } from './videoBrowserVollansicht.js';
import { sucheFeldHtml } from './videoBrowserSucheAnsicht.js';
import { initSuche, mountSuche } from './videoBrowserSucheFeld.js';

export const VIEWS = ['showcase', 'ordner', 'kalender'];

/**
 * Auswahl, Gruppierung der Spalte 0 und die Einstellungen der offenen Ansicht in die URL spiegeln,
 * fremde Parameter bleiben. Showcase, Kalender und Ordner teilen sich `ansicht`, daher diese Reihenfolge.
 */
export function writeUrl(sel, { showcase = null, kalender = null, ordner = false, koopGroup = null } = {}) {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  let search = selectionToSearch(window.location.search, sel);
  search = ordnerToSearch(kalenderToSearch(showcaseToSearch(search, showcase), kalender), ordner);
  search = koopGroupToSearch(search, koopGroup);
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
}

/** Im Showcase steht eine Auswahl nur in der URL, solange die Vollansicht offen ist. */
function urlSelection(vb) {
  if (vb.view !== 'showcase') return vb.sel;
  return vollansichtSel(vb) || EMPTY_SELECTION;
}

export function syncViewUrl(vb) {
  writeUrl(urlSelection(vb), {
    showcase: vb.view === 'showcase' ? vb.showcase : null,
    kalender: vb.view === 'kalender' ? vb.kalender : null,
    ordner: vb.view === 'ordner',
    koopGroup: koopGroupParam(vb, vb._zeigeLinie())
  });
}

/**
 * Vor dem Gerüst: Ansicht aus der URL, Ort des Umschalters. Eine Auswahl im Showcase-Link
 * ist die Vollansicht: sie öffnet nach dem Aufbau, der Ordner startet ohne Auswahl.
 */
export function initView(vb) {
  initShowcaseState(vb);
  initKalenderState(vb);
  initSuche(vb);
  vb.view = ansichtFromSearch(window.location.search);
  vb.vollStart = null;
  if (vb.view === 'showcase' && vb.sel.kooperationId) {
    vb.vollStart = vb.sel;
    vb.sel = { ...EMPTY_SELECTION };
  }
  // Der Umschalter gehört in die Workflow-Tab-Zeile (rechter Slot), sonst in eine eigene Leiste
  vb.viewSlot = vb.pane.closest('.kampagne-detail-body')?.querySelector('[data-workflow-liste-slot]') || null;
}

export const viewToolbarHtml = (vb) => showcaseToolbarHtml(vb);

export const viewSectionsHtml = (vb) => `${showcaseSectionHtml(vb)}${kalenderSectionHtml(vb)}`;

/** Nach dem Gerüst und nach createMotion. */
export function mountView(vb) {
  vb.root.dataset.vbView = vb.view;
  // Suche und Umschalter in der Tab-Zeile: liegen außerhalb des Wurzelelements, brauchen eigene Listener
  if (vb.viewSlot) {
    vb.viewSlot.innerHTML = `${sucheFeldHtml()}${viewSwitchHtml(vb.view)}`;
    const click = (e) => { onViewClick(vb, e); };
    const key = (e) => { onSegmentKeydown(vb, e); };
    vb.viewSlot.addEventListener('click', click);
    vb.viewSlot.addEventListener('keydown', key);
    vb.cleanups.push(() => {
      vb.viewSlot.removeEventListener('click', click);
      vb.viewSlot.removeEventListener('keydown', key);
    });
  }
  vb.viewEl = (vb.viewSlot || vb.root).querySelector('[data-vb-seg="view"]');
  mountSuche(vb, vb.viewSlot || vb.root);
  mountShowcase(vb);
  mountKalender(vb);
  if (vb.vollStart) openShowcaseVollansicht(vb, { sel: vb.vollStart });
  vb.vollStart = null;
}

/** Nach einem Neuladen der Daten: die offene Ansicht nachziehen (im Showcase samt Vollansicht). */
export function refreshView(vb) {
  if (vb.view === 'showcase') renderShowcase(vb);
  else if (vb.view === 'kalender') void reloadKalender(vb);
  else vb.voll?.refresh();
}

export function destroyView(vb) {
  closeVollansicht(vb, { instant: true });
  destroyShowcase(vb);
  destroyKalender(vb);
  // Suche und Umschalter in der Tab-Zeile stehen außerhalb des Panes: mit dem Tab verschwinden sie auch
  if (vb.viewSlot) {
    vb.viewEl?.remove();
    vb.sucheEl?.remove();
  }
}

export function setView(vb, view) {
  if (!VIEWS.includes(view) || view === vb.view || !vb.root) return;
  const from = vb.view;
  setSegment(vb, vb.viewEl, view, { animate: true });
  // Einflug in den Showcase nur aus dem Spaltenbrowser, dort stehen die Dateien
  const fromRects = from === 'ordner' && view === 'showcase' ? measureColumnRects(vb) : new Map();
  if (from === 'ordner') {
    vb.player?.pause?.();
    vb._closeTagField();
  } else if (from === 'showcase') {
    hideShowcase(vb);
  } else {
    hideKalender(vb);
  }
  vb.view = view;
  vb.root.dataset.vbView = view;
  if (view === 'showcase') showShowcase(vb, fromRects);
  else if (view === 'kalender') void showKalender(vb);
  // Erstaufbau des Spaltenbrowsers, die Auswahl bleibt erhalten
  else vb._render({ fromDepth: 0, detailAnimate: true });
  vb._syncLayout();
  vb._syncUrl();
}

/** Klicks auf den Ansicht-Umschalter und im Kalender. Vor onShowcaseClick prüfen. */
export function onViewClick(vb, e) {
  const opt = e.target.closest?.('[data-vb-seg="view"] [data-vb-seg-opt]');
  if (opt) {
    setView(vb, opt.dataset.value);
    return true;
  }
  return onKalenderClick(vb, e);
}
