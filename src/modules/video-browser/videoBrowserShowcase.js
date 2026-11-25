// videoBrowserShowcase.js
// Controller-Teil der Showcase-Ansicht (erste Darstellung und Standard im Videos-Tab, siehe CONTEXT.md
// "Showcase"). Zustand am Controller (`vb`): showcase ({ inhalt, group, status, size, typ, tag }), scResult
// (Ergebnis von buildShowcase). Daten, Tags und Filter-Chips kommen aus dem Baum des Spaltenbrowsers. Den
// Wechsel der Ansicht steuert videoBrowserView.js; der Showcase wird nur ein- und ausgeblendet, nichts wird
// unmountet. Ein Klick auf eine Kachel öffnet die Vollansicht (videoBrowserVollansicht.js).

import {
  DEFAULT_SHOWCASE,
  buildShowcase,
  isAusstehend,
  showcaseFromSearch,
  showcaseSummary,
  sizePx,
  statusCounts,
  toggleChip
} from './videoBrowserLogic.js';
import { chipsHtml, gridHtml, showcaseShellHtml, toolbarHtml } from './videoBrowserRenderShowcase.js';
import { kachelText, showcaseTreffer, sucheBegriffe, trifft } from './videoBrowserSuche.js';
import { sucheFeldHtml, zeigeLeer, zeigeTreffer } from './videoBrowserSucheAnsicht.js';
import { createShowcaseMedia } from './videoBrowserShowcaseMedia.js';
import { closeVollansicht, openVollansicht, syncVollansicht } from './videoBrowserVollansicht.js';
import { bindAusstehendDrop, paintAusstehendUploads } from './videoBrowserShowcaseUpload.js';
import { downloadItems } from './videoBrowserDownload.js';
import { downloadMeta } from './videoBrowserActions.js';
import { creatorLinkErstellen, produktionLinkButton } from './videoBrowserAblage.js';
import { VB_SEG_ATTR } from './videoBrowserRenderParts.js';
import { onSegmentKeydown as segmentKeydown, setSegmentValue } from '../../core/components/SegmentSwitch.js';

/* ---- Aufbau ---- */

/**
 * Vor dem Gerüst: Einstellungen aus der URL (Showcase-Links lassen sich weitergeben).
 * @returns {boolean} true, wenn die URL den Showcase meint
 */
export function initShowcaseState(vb) {
  const fromUrl = showcaseFromSearch(window.location.search);
  vb.showcase = fromUrl || { ...DEFAULT_SHOWCASE };
  vb.scResult = null;
  return !!fromUrl;
}

/** HTML der Ansicht-Leiste im Gerüst. Mit Tab-Zeile leer, dort sitzen Suche und Umschalter (mountView). */
export const showcaseToolbarHtml = (vb) => (vb.viewSlot ? '' : toolbarHtml(vb.view, sucheFeldHtml()));

/** HTML des Showcase-Bereichs (leer gerendert, Inhalte füllt `renderShowcase`). */
export const showcaseSectionHtml = (vb) => `
  <section class="vb-showcase" data-vb-showcase aria-label="Showcase"${vb.view === 'showcase' ? '' : ' hidden'}>
    ${showcaseShellHtml(vb.showcase, { canDownload: vb.canDownload, team: vb.team })}
  </section>`;

/** Nach dem Gerüst, nach createMotion und nach dem Ansicht-Umschalter (mountView). */
export function mountShowcase(vb) {
  vb.scEl = vb.root.querySelector('[data-vb-showcase]');
  vb.scScrollEl = vb.scEl.querySelector('[data-vb-sc-scroll]');
  vb.scGridEl = vb.scEl.querySelector('[data-vb-sc-grid]');
  vb.scChipsEl = vb.scEl.querySelector('[data-vb-sc-chips]');
  vb.scSummaryEl = vb.scEl.querySelector('[data-vb-sc-summary]');
  vb.scTeilenEl = vb.scEl.querySelector('[data-vb-sc-teilen]');
  vb.scMedia = createShowcaseMedia({ motion: vb.motion });

  // Hover per Delegation am Grid, nicht ein Listener je Kachel
  const over = (e) => vb.scMedia.onPointerOver(e);
  const out = (e) => vb.scMedia.onPointerOut(e);
  vb.scGridEl.addEventListener('pointerover', over);
  vb.scGridEl.addEventListener('pointerout', out);
  vb.cleanups.push(() => {
    vb.scGridEl.removeEventListener('pointerover', over);
    vb.scGridEl.removeEventListener('pointerout', out);
  });
  if (vb.canUpload) bindAusstehendDrop(vb);

  if (vb.view === 'showcase') renderShowcase(vb);

  // Indikatoren der Umschalter: nach dem Aufbau, nach dem Laden der Schrift und bei Resize neu setzen
  const resync = () => { if (!vb.destroyed && vb.root?.isConnected) syncSegments(vb, { animate: false }); };
  resync();
  document.fonts?.ready?.then(resync);
  window.addEventListener('resize', resync);
  vb.cleanups.push(() => window.removeEventListener('resize', resync));
}

export function destroyShowcase(vb) {
  vb.scMedia?.destroy();
}

/* ---- Rendern ---- */

const downloadbar = (list) => list.filter(e => e.item.asset?.file_path || e.item.asset?.file_url);

/**
 * Status-Umschalter: Anzahl je Option (`data-count`, CSS zeigt sie) und gesperrt bei "Nur final".
 * Die Zähler ändern die Breite der Optionen, deshalb springt der Thumb an die gewählte nach.
 */
function paintStatusSegment(vb, sc) {
  const group = vb.scEl.querySelector('[data-vb-seg="status"]');
  if (!group) return;
  const field = group.closest('.segment-field') || group;
  const aus = sc.state.inhalt !== 'aktuell';
  field.classList.toggle('is-off', aus);
  field.toggleAttribute('inert', aus);
  group.setAttribute('aria-disabled', String(aus));
  group.querySelectorAll('[data-value]').forEach((opt) => {
    if (opt.dataset.value === 'alle' || aus) delete opt.dataset.count;
    else opt.dataset.count = String(sc.statusCounts[opt.dataset.value] ?? 0);
  });
  vb.motion?.tabIndicator(group, { animate: false });
}

/** Produktions-Link in der Leiste: hängt am Baum. Bleibt derselbe Knopf stehen, behält er seinen Busy-Zustand. */
function paintTeilen(vb) {
  const html = produktionLinkButton({ team: vb.team, produktionId: vb.detail?.produktionId || null, tree: vb.tree }, { text: true });
  if (!vb.scTeilenEl || vb._scTeilen === html) return;
  vb._scTeilen = html;
  vb.scTeilenEl.innerHTML = html;
}

/**
 * Datenmenge neu berechnen und Chips und Grid ersetzen, danach die Textsuche anwenden. Die Umschalter
 * bleiben stehen. `scResult.alle` ist die gerenderte Liste, `scResult.list` die Treffer daraus.
 */
export function renderShowcase(vb) {
  const sc = buildShowcase(vb.tree, vb.showcase, vb.raw?.tagTypen || []);
  vb.showcase = sc.state;
  vb.scResult = { ...sc, alle: sc.list };

  const scroll = vb.scScrollEl.scrollTop;
  vb.scEl.style.setProperty('--tile', `${sizePx(sc.state.size)}px`);
  vb.scChipsEl.innerHTML = chipsHtml(sc);
  vb.scGridEl.innerHTML = gridHtml(sc, { catalog: vb.raw?.tagTypen || [], team: vb.team, canUpload: vb.canUpload, tree: vb.tree });
  paintTeilen(vb);
  sucheShowcase(vb);
  vb.scScrollEl.scrollTop = scroll;

  vb.scMedia.observe(vb.scGridEl, vb.scResult.alle);
  paintAusstehendUploads(vb);
  syncVollansicht(vb);
  vb._syncUrl();
}

/**
 * Textsuche auf das Grid: Kacheln ohne Treffer und Gruppen ohne Kachel blenden aus (mit `animate` per Flip).
 * Anzeigeliste, Indizes der Kacheln, Zusammenfassung, Gruppenzähler, Status-Zähler und Download folgen
 * den Treffern. Rendert nichts neu, die Poster bleiben stehen.
 */
export function sucheShowcase(vb, { animate = false } = {}) {
  const sc = vb.scResult;
  const grid = vb.scGridEl;
  if (!sc || !grid) return;
  const catalog = vb.raw?.tagTypen || [];
  const hit = showcaseTreffer(sc.alle, vb.suche, catalog);
  const tiles = [...grid.querySelectorAll('[data-vb-sc-tile]')];
  if (tiles.length !== sc.alle.length) return;

  let n = 0;
  tiles.forEach((tile, i) => {
    if (hit[i]) tile.dataset.index = String(n++);
    else delete tile.dataset.index;
  });
  sc.list = sc.alle.filter((_, i) => hit[i]);
  const begriffe = sucheBegriffe(vb.suche);
  sc.statusCounts = statusCounts(sc.statusBasis.filter(e => trifft(kachelText(e, catalog), begriffe)));

  const pos = new Map(tiles.map((t, i) => [t, i]));
  grid.querySelectorAll('[data-vb-sc-group]').forEach((section) => {
    const count = section.querySelector('.vb-sc-group__count');
    if (!count) return;
    const k = [...section.querySelectorAll('[data-vb-sc-tile]')].map(t => pos.get(t))
      .filter(i => hit[i] && !isAusstehend(sc.alle[i].item)).length;
    count.textContent = `${k} ${k === 1 ? 'Inhalt' : 'Inhalte'}`;
  });

  vb.scSummaryEl.textContent = sc.total ? showcaseSummary(sc.list) : '';
  paintStatusSegment(vb, sc);
  const empty = !downloadbar(sc.list).length;
  vb.scEl.querySelectorAll('[data-vb-sc-download]').forEach((btn) => { btn.disabled = empty; });

  zeigeTreffer(vb, tiles.map((el, i) => ({ el, sichtbar: hit[i], gruppe: el.closest('[data-vb-sc-group]') })), { animate });
  zeigeLeer(vb, grid, sc.alle.length && !sc.list.length ? vb.suche : null);
}

/**
 * Vollansicht ab einer Kachel (index) oder einem Link (sel): blättert durch die Anzeigeliste,
 * beim Schließen zieht das Grid nach, wenn sich etwas geändert hat.
 */
export function openShowcaseVollansicht(vb, { index = null, sel = null } = {}) {
  openVollansicht(vb, {
    quelle: 'showcase',
    list: vb.scResult?.list || [],
    index,
    sel,
    onClose: ({ dirty }) => { if (dirty && vb.view === 'showcase') renderShowcase(vb); }
  });
}

/** Alle Umschalter an den Zustand angleichen (auch Umfang im Kalender, videoBrowserKalender.js). */
function syncSegments(vb, { animate, scope = vb.root }) {
  const values = { ...vb.showcase, umfang: vb.kalender?.umfang, view: vb.view };
  const groups = [...scope.querySelectorAll('[data-vb-seg]')];
  // Der Ansicht-Umschalter kann in der Tab-Zeile außerhalb des Wurzelelements stehen
  if (scope === vb.root && vb.viewEl && !groups.includes(vb.viewEl)) groups.push(vb.viewEl);
  groups.forEach((group) => {
    setSegment(vb, group, values[group.dataset.vbSeg], { animate });
  });
}

/** Radiogruppe umschalten, der Indikator gleitet (motion.tabIndicator). */
export function setSegment(vb, group, value, { animate }) {
  if (!group || value === undefined) return;
  const changed = setSegmentValue(group, value, { attr: VB_SEG_ATTR });
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
      // "Nur final" setzt den Status auf "Alle" zurück (reconcileState): der Thumb folgt
      syncSegments(vb, { animate: true, scope: vb.scEl });
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

/** Rects der Dateien in der Inhalte-Spalte: Startpunkte für den Einflug (A1). Nur aus der Ordner-Ansicht sinnvoll. */
export function measureColumnRects(vb) {
  const rects = new Map();
  vb.colsEl?.querySelectorAll('.vb-col--3 .vb-row[data-id]').forEach((row) => {
    const lead = row.querySelector('.vb-row__lead') || row;
    rects.set(row.dataset.id, lead.getBoundingClientRect());
  });
  return rects;
}

/** Einblenden (videoBrowserView.setView hat `vb.view` schon gesetzt). */
export function showShowcase(vb, fromRects = new Map()) {
  vb.scEl.hidden = false;
  renderShowcase(vb);
  // Die Umschalter des Showcase waren ausgeblendet: Indikatoren jetzt ohne Animation setzen
  syncSegments(vb, { animate: false, scope: vb.scEl });
  vb.motion?.showcaseIn(vb.scEl, fromRects);
}

export function hideShowcase(vb) {
  closeVollansicht(vb, { instant: true });
  vb.scMedia?.stopHover();
  vb.scEl.hidden = true;
}

/* ---- Aktionen ---- */

async function downloadAll(vb, button) {
  if (!vb.canDownload || button.disabled) return;
  const entries = downloadbar(vb.scResult?.list || []);
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    await downloadItems(entries, (entry) => downloadMeta(vb, entry.koop));
  } catch (err) {
    console.error('VideoBrowser: Showcase-Download fehlgeschlagen', err);
    vb.toast('error', 'Download fehlgeschlagen.');
  } finally {
    button.disabled = !downloadbar(vb.scResult?.list || []).length;
    button.removeAttribute('aria-busy');
  }
}

/* ---- Events (aus videoBrowserEvents.js) ---- */

/** Klick-Routing. @returns {boolean} true, wenn der Klick dem Showcase gehörte */
export function onShowcaseClick(vb, e) {
  // Nur die Umschalter im Showcase; den Ansicht-Umschalter bedient videoBrowserView.js
  const opt = e.target.closest('[data-vb-seg-opt]');
  if (opt && vb.scEl?.contains(opt)) {
    const id = opt.closest('[data-vb-seg]').dataset.vbSeg;
    const { value } = opt.dataset;
    if (vb.showcase[id] !== value) changeState(vb, { [id]: value });
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
    changeState(vb, { status: 'alle', typ: null, tag: null });
    return true;
  }

  const tile = e.target.closest('[data-vb-sc-tile]');
  if (tile) {
    openShowcaseVollansicht(vb, { index: Number(tile.dataset.index) });
    return true;
  }
  const download = e.target.closest('[data-vb-sc-download]');
  if (download) {
    void downloadAll(vb, download);
    return true;
  }
  const creatorLink = e.target.closest('[data-vb-creatorlink]');
  if (creatorLink) {
    void creatorLinkErstellen(vb, creatorLink);
    return true;
  }
  return false;
}

/** Pfeiltasten in einer Radiogruppe (Roving Tabindex, Auswahl beim Fokus). @returns {boolean} */
export function onSegmentKeydown(vb, e) {
  return segmentKeydown(e, { attr: VB_SEG_ATTR });
}
