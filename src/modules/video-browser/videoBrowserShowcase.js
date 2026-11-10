// videoBrowserShowcase.js
// Controller-Teil der Showcase-Ansicht (zweite Darstellung im Videos-Tab, siehe CONTEXT.md "Showcase").
// Zustand am Controller (`vb`): view ('ordner' | 'showcase'), showcase ({ group, fmt, size, typ, tag }),
// scResult (Ergebnis von buildShowcase). Daten, Tags und Filter-Chips kommen aus dem Baum des
// Spaltenbrowsers. Der Showcase wird nur ein- und ausgeblendet, nichts wird unmountet.

import {
  DEFAULT_SHOWCASE,
  buildShowcase,
  showcaseFromSearch,
  sizePx,
  toggleChip
} from './videoBrowserLogic.js';
import { chipsHtml, gridHtml, showcaseShellHtml, summaryText, toolbarHtml, viewSwitchHtml } from './videoBrowserRenderShowcase.js';
import { createShowcaseMedia } from './videoBrowserShowcaseMedia.js';
import { closeShowcaseLightbox, openShowcaseLightbox } from './videoBrowserShowcaseLightbox.js';
import { downloadItems } from './videoBrowserDownload.js';
import { downloadMeta } from './videoBrowserActions.js';

/* ---- Aufbau ---- */

/** Vor dem Gerüst: Ansicht und Einstellungen aus der URL (Showcase-Links lassen sich weitergeben). */
export function initShowcaseState(vb) {
  const fromUrl = showcaseFromSearch(window.location.search);
  vb.showcase = fromUrl || { ...DEFAULT_SHOWCASE };
  vb.view = fromUrl ? 'showcase' : 'ordner';
  vb.scBox = null;
  vb.scResult = null;
  // Der Ansicht-Umschalter gehört in die Workflow-Tab-Zeile (rechter Slot), sonst in eine eigene Leiste
  vb.viewSlot = vb.pane.closest('.kampagne-detail-body')?.querySelector('[data-workflow-liste-slot]') || null;
}

/** HTML der Ansicht-Leiste im Gerüst. Mit Tab-Zeile leer, dort sitzt der Umschalter (mountShowcase). */
export const showcaseToolbarHtml = (vb) => (vb.viewSlot ? '' : toolbarHtml(vb.view));

/** HTML des Showcase-Bereichs (leer gerendert, Inhalte füllt `renderShowcase`). */
export const showcaseSectionHtml = (vb) => `
  <section class="vb-showcase" data-vb-showcase aria-label="Showcase"${vb.view === 'showcase' ? '' : ' hidden'}>
    ${showcaseShellHtml(vb.showcase, { canDownload: vb.canDownload })}
  </section>`;

/** Nach dem Gerüst und nach createMotion. */
export function mountShowcase(vb) {
  vb.scEl = vb.root.querySelector('[data-vb-showcase]');
  vb.scScrollEl = vb.scEl.querySelector('[data-vb-sc-scroll]');
  vb.scGridEl = vb.scEl.querySelector('[data-vb-sc-grid]');
  vb.scChipsEl = vb.scEl.querySelector('[data-vb-sc-chips]');
  vb.scSummaryEl = vb.scEl.querySelector('[data-vb-sc-summary]');
  vb.root.dataset.vbView = vb.view;
  vb.scMedia = createShowcaseMedia({ motion: vb.motion });

  // Umschalter in der Tab-Zeile: liegt außerhalb des Wurzelelements, braucht eigene delegierte Listener
  if (vb.viewSlot) {
    vb.viewSlot.innerHTML = viewSwitchHtml(vb.view);
    const click = (e) => { onShowcaseClick(vb, e); };
    const key = (e) => { onSegmentKeydown(vb, e); };
    vb.viewSlot.addEventListener('click', click);
    vb.viewSlot.addEventListener('keydown', key);
    vb.cleanups.push(() => {
      vb.viewSlot.removeEventListener('click', click);
      vb.viewSlot.removeEventListener('keydown', key);
    });
  }
  vb.viewEl = (vb.viewSlot || vb.root).querySelector('[data-vb-seg="view"]');

  // Hover per Delegation am Grid, nicht ein Listener je Kachel
  const over = (e) => vb.scMedia.onPointerOver(e);
  const out = (e) => vb.scMedia.onPointerOut(e);
  vb.scGridEl.addEventListener('pointerover', over);
  vb.scGridEl.addEventListener('pointerout', out);
  vb.cleanups.push(() => {
    vb.scGridEl.removeEventListener('pointerover', over);
    vb.scGridEl.removeEventListener('pointerout', out);
  });

  if (vb.view === 'showcase') renderShowcase(vb);

  // Indikatoren der Umschalter: nach dem Aufbau, nach dem Laden der Schrift und bei Resize neu setzen
  const resync = () => { if (!vb.destroyed && vb.root?.isConnected) syncSegments(vb, { animate: false }); };
  resync();
  document.fonts?.ready?.then(resync);
  window.addEventListener('resize', resync);
  vb.cleanups.push(() => window.removeEventListener('resize', resync));
}

export function destroyShowcase(vb) {
  void closeShowcaseLightbox(vb, { animate: false });
  vb.scMedia?.destroy();
  // Der Umschalter in der Tab-Zeile steht außerhalb des Panes: mit dem Tab verschwindet er auch
  if (vb.viewSlot) vb.viewEl?.remove();
}

/* ---- Rendern ---- */

/** Datenmenge neu berechnen und Zusammenfassung, Chips und Grid ersetzen. Die Umschalter bleiben stehen. */
export function renderShowcase(vb) {
  const sc = buildShowcase(vb.tree, vb.showcase, vb.raw?.tagTypen || []);
  vb.showcase = sc.state;
  vb.scResult = sc;

  const scroll = vb.scScrollEl.scrollTop;
  vb.scEl.style.setProperty('--tile', `${sizePx(sc.state.size)}px`);
  vb.scSummaryEl.textContent = sc.total ? summaryText(sc) : '';
  vb.scChipsEl.innerHTML = chipsHtml(sc);
  vb.scGridEl.innerHTML = gridHtml(sc, { catalog: vb.raw?.tagTypen || [], team: vb.team });
  vb.scScrollEl.scrollTop = scroll;

  const empty = !sc.list.length;
  vb.scEl.querySelectorAll('[data-vb-sc-download]').forEach((btn) => { btn.disabled = empty; });
  vb.scMedia.observe(vb.scGridEl, sc.list);
  vb._syncUrl();
}

/** Alle Umschalter an den Zustand angleichen. */
function syncSegments(vb, { animate, scope = vb.root }) {
  const values = { ...vb.showcase, view: vb.view };
  const groups = [...scope.querySelectorAll('[data-vb-seg]')];
  // Der Ansicht-Umschalter kann in der Tab-Zeile außerhalb des Wurzelelements stehen
  if (scope === vb.root && vb.viewEl && !groups.includes(vb.viewEl)) groups.push(vb.viewEl);
  groups.forEach((group) => {
    setSegment(vb, group, values[group.dataset.vbSeg], { animate });
  });
}

/** Radiogruppe umschalten, der Indikator gleitet (motion.tabIndicator). */
function setSegment(vb, group, value, { animate }) {
  if (!group || value === undefined) return;
  let changed = false;
  group.querySelectorAll('[data-vb-seg-opt]').forEach((opt) => {
    const on = opt.dataset.value === value;
    if (on && opt.getAttribute('aria-checked') !== 'true') changed = true;
    opt.setAttribute('aria-checked', String(on));
    opt.classList.toggle('active', on);
    opt.tabIndex = on ? 0 : -1;
  });
  vb.motion?.tabIndicator(group, { animate: animate && changed });
}

/* ---- Änderungen ---- */

/**
 * Einstellung ändern: Zustand merken, rendern, Kacheln per Flip in die neue Anordnung morphen.
 * Wechselt die Datenmenge (Inhalt), blenden die alten Kacheln aus und die neuen kommen gestaffelt herein.
 */
function changeState(vb, patch) {
  const gen = (vb._scSwap = (vb._scSwap || 0) + 1);
  if ('inhalt' in patch) {
    vb.showcase = { ...vb.showcase, ...patch };
    syncSegments(vb, { animate: true, scope: vb.scEl });
    const out = vb.motion?.swapOut(vb.scGridEl);
    const render = () => {
      // Inzwischen kam eine neuere Änderung (sie hat schon gerendert) oder die Ansicht ist weg
      if (vb.destroyed || gen !== vb._scSwap || vb.view !== 'showcase') return;
      renderShowcase(vb);
      vb.motion?.swapIn(vb.scEl);
    };
    if (out) void out.then(render);
    else render();
    return;
  }
  const before = vb.motion?.flipState(vb.scGridEl) || null;
  vb.showcase = { ...vb.showcase, ...patch };
  if (Object.keys(patch).length === 1 && 'size' in patch) {
    // Nur die Kachelbreite: dieselben Kacheln, kein Neuaufbau (Poster bleiben stehen)
    vb.scEl.style.setProperty('--tile', `${sizePx(vb.showcase.size)}px`);
    vb._syncUrl();
  } else {
    renderShowcase(vb);
  }
  syncSegments(vb, { animate: true, scope: vb.scEl });
  vb.motion?.flipFrom(before, vb.scGridEl);
}

/** Rects der Dateien in der Inhalte-Spalte: Startpunkte für den Einflug (A1). */
function measureColumnRects(vb) {
  const rects = new Map();
  vb.colsEl?.querySelectorAll('.vb-col--3 .vb-row[data-id]').forEach((row) => {
    const lead = row.querySelector('.vb-row__lead') || row;
    rects.set(row.dataset.id, lead.getBoundingClientRect());
  });
  return rects;
}

export function setView(vb, view) {
  if (view === vb.view) return;
  setSegment(vb, vb.viewEl, view, { animate: true });
  if (view === 'showcase') {
    const fromRects = measureColumnRects(vb);
    vb.player?.pause?.();
    vb._closeTagField();
    vb.view = 'showcase';
    vb.root.dataset.vbView = 'showcase';
    vb.scEl.hidden = false;
    renderShowcase(vb);
    // Die Umschalter des Showcase waren ausgeblendet: Indikatoren jetzt ohne Animation setzen
    syncSegments(vb, { animate: false, scope: vb.scEl });
    vb.motion?.showcaseIn(vb.scEl, fromRects);
  } else {
    void closeShowcaseLightbox(vb, { animate: false });
    vb.scMedia?.stopHover();
    vb.view = 'ordner';
    vb.root.dataset.vbView = 'ordner';
    vb.scEl.hidden = true;
    // Erstaufbau des Spaltenbrowsers, die Auswahl bleibt erhalten
    vb._render({ fromDepth: 0, detailAnimate: true });
    vb._syncUrl();
  }
}

/* ---- Aktionen ---- */

async function downloadAll(vb, button) {
  if (!vb.canDownload || button.disabled) return;
  const entries = (vb.scResult?.list || []).filter(e => e.item.asset?.file_path || e.item.asset?.file_url);
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    await downloadItems(entries, (entry) => downloadMeta(vb, entry.koop));
  } catch (err) {
    console.error('VideoBrowser: Showcase-Download fehlgeschlagen', err);
    vb.toast('error', 'Download fehlgeschlagen.');
  } finally {
    button.disabled = !vb.scResult?.list?.length;
    button.removeAttribute('aria-busy');
  }
}

/* ---- Events (aus videoBrowserEvents.js) ---- */

/** Klick-Routing. @returns {boolean} true, wenn der Klick dem Showcase gehörte */
export function onShowcaseClick(vb, e) {
  const opt = e.target.closest('[data-vb-seg-opt]');
  if (opt) {
    const id = opt.closest('[data-vb-seg]').dataset.vbSeg;
    const { value } = opt.dataset;
    if (id === 'view') setView(vb, value);
    else if (vb.showcase[id] !== value) changeState(vb, { [id]: value });
    return true;
  }

  const chip = e.target.closest('[data-vb-sc-filter]');
  if (chip) {
    const id = chip.dataset.vbScFilter;
    changeState(vb, toggleChip(vb.showcase, id));
    vb.scChipsEl.querySelector(`[data-vb-sc-filter="${id.replace(/["\\]/g, '\\$&')}"]`)?.focus({ preventScroll: true });
    return true;
  }
  if (e.target.closest('[data-vb-sc-filter-clear]')) {
    changeState(vb, { typ: null, tag: null });
    return true;
  }

  const tile = e.target.closest('[data-vb-sc-tile]');
  if (tile) {
    openShowcaseLightbox(vb, { index: Number(tile.dataset.index) });
    return true;
  }
  const download = e.target.closest('[data-vb-sc-download]');
  if (download) {
    void downloadAll(vb, download);
    return true;
  }
  return false;
}

/** Pfeiltasten in einer Radiogruppe (Roving Tabindex, Auswahl beim Fokus). @returns {boolean} */
export function onSegmentKeydown(vb, e) {
  const opt = e.target.closest?.('[data-vb-seg-opt]');
  if (!opt) return false;
  const opts = [...opt.closest('[data-vb-seg]').querySelectorAll('[data-vb-seg-opt]')];
  const i = opts.indexOf(opt);
  let next = -1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % opts.length;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + opts.length) % opts.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = opts.length - 1;
  if (next < 0) return false;
  e.preventDefault();
  opts[next].focus();
  opts[next].click();
  return true;
}
