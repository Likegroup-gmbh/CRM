// videoBrowserView.js
// Ansicht des Videos-Tabs: Ordner (Spaltenbrowser), Showcase (videoBrowserShowcase.js) und Kalender
// (videoBrowserKalender.js), umschaltbar über "Ordner | Showcase | Kalender". Alle drei hängen im selben
// Gerüst und werden nur ein- und ausgeblendet. Hier liegen Umschalter, Wechsel und der URL-Abgleich.

import {
  kalenderToSearch,
  koopGroupToSearch,
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

export const VIEWS = ['ordner', 'showcase', 'kalender'];

/**
 * Auswahl, Gruppierung der Spalte 0 und die Einstellungen der offenen Ansicht in die URL spiegeln,
 * fremde Parameter bleiben. kalenderToSearch nach showcaseToSearch: beide teilen sich `ansicht`.
 */
export function writeUrl(sel, { showcase = null, kalender = null, koopGroup = null } = {}) {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  let search = selectionToSearch(window.location.search, sel);
  search = kalenderToSearch(showcaseToSearch(search, showcase), kalender);
  search = koopGroupToSearch(search, koopGroup);
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
}

export function syncViewUrl(vb) {
  writeUrl(vb.sel, {
    showcase: vb.view === 'showcase' ? vb.showcase : null,
    kalender: vb.view === 'kalender' ? vb.kalender : null,
    koopGroup: koopGroupParam(vb, vb._zeigeLinie())
  });
}

/** Vor dem Gerüst: Ansicht aus der URL, Ort des Umschalters. */
export function initView(vb) {
  const showcase = initShowcaseState(vb);
  const kalender = initKalenderState(vb);
  vb.view = kalender ? 'kalender' : (showcase ? 'showcase' : 'ordner');
  // Der Umschalter gehört in die Workflow-Tab-Zeile (rechter Slot), sonst in eine eigene Leiste
  vb.viewSlot = vb.pane.closest('.kampagne-detail-body')?.querySelector('[data-workflow-liste-slot]') || null;
}

export const viewToolbarHtml = (vb) => showcaseToolbarHtml(vb);

export const viewSectionsHtml = (vb) => `${showcaseSectionHtml(vb)}${kalenderSectionHtml(vb)}`;

/** Nach dem Gerüst und nach createMotion. */
export function mountView(vb) {
  vb.root.dataset.vbView = vb.view;
  // Umschalter in der Tab-Zeile: liegt außerhalb des Wurzelelements, braucht eigene delegierte Listener
  if (vb.viewSlot) {
    vb.viewSlot.innerHTML = viewSwitchHtml(vb.view);
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
  mountShowcase(vb);
  mountKalender(vb);
}

/** Nach einem Neuladen der Daten: die offene Ansicht nachziehen. */
export function refreshView(vb) {
  if (vb.view === 'showcase') renderShowcase(vb);
  else if (vb.view === 'kalender') void reloadKalender(vb);
}

export function destroyView(vb) {
  destroyShowcase(vb);
  destroyKalender(vb);
  // Der Umschalter in der Tab-Zeile steht außerhalb des Panes: mit dem Tab verschwindet er auch
  if (vb.viewSlot) vb.viewEl?.remove();
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
