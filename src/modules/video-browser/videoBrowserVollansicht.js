// videoBrowserVollansicht.js
// Vollansicht einer Kachel bzw. Datei (CONTEXT.md "Vollansicht"): Player mit allen Controls,
// Video-Kommentare und Details mit Verknüpfungen nebeneinander. Basis ist die MediaLightbox
// (Overlay, Esc, Pfeiltasten). Zustand liegt in `vb.voll`, solange sie offen ist; der aktive
// Detailbereich (videoBrowserHost.js) zeigt dann auf sie, die Auswahl des Ordners bleibt.
//   Showcase  blättert durch die Anzeigeliste, Ausstehende Videos eingeschlossen; URL mit Auswahl
//   Ordner    blättert durch die Dateien desselben Ordners; beim Schließen folgt die Auswahl

import { MediaLightbox } from '../../core/media/MediaLightbox.js';
import { saveWiedergabeMessung } from './VideoBrowserAdapter.js';
import { formatTime } from '../../core/media/mediaPlayerIcons.js';
import { mountPlayer } from './VideoBrowserPlayer.js';
import { SHOWCASE_RATIO, isAusstehend, istHochgeladen } from './videoBrowserShowcaseLogic.js';
import { fitFrame, resolveSelection, validateSelection } from './videoBrowserLogic.js';
import { detailResolved } from './videoBrowserHost.js';
import { highlightComment, syncPinTime } from './videoBrowserComments.js';
import { commitRename } from './videoBrowserRename.js';
import { finalBarHtml } from './videoBrowserRenderItem.js';
import { commentsOf } from './videoBrowserRenderComments.js';
import { paintAusstehendUploads, uploadZiel } from './videoBrowserShowcaseUpload.js';
import { bodyHtml, feedbackCount, feedbackHtml, headHtml } from './videoBrowserVollansichtRender.js';
import { vollDetailsHtml } from './videoBrowserVollansichtDetails.js';
import { bindVollansichtEvents } from './videoBrowserVollansichtEvents.js';
import { activeChip } from '../kampagne/linienScope.js';

const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const exitFs = () => { if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); };

const NARROW = 768;

const px = (el, ...props) => {
  const cs = getComputedStyle(el);
  return props.reduce((sum, prop) => sum + (parseFloat(cs[prop]) || 0), 0);
};

/** Auswahl einer Kachel. Ausstehende Videos haben weder Ordner noch Datei. */
export function selOf({ koop, row, item }) {
  if (isAusstehend(item)) return { kooperationId: koop.id, videoId: row.id, folderId: null, itemId: null };
  const folder = row.folders.find(f => f.items.some(i => i.id === item.id));
  return { kooperationId: koop.id, videoId: row.id, folderId: folder?.id || null, itemId: item.id };
}

/** Schlüssel einer Kachel im Grid (`data-item-id`). */
const tileKey = (sel) => sel.itemId || `ausstehend:${sel.videoId}`;
const sameKey = (a, b) => a.videoId === b.videoId && (a.itemId || null) === (b.itemId || null);

export const vollansichtSel = (vb) => vb.voll?.sel || null;

function vollCtx(vb) {
  return {
    ...vb._ctx(), sel: vb.voll.sel, resolved: detailResolved(vb), idPrefix: 'vb-voll', ohneAdManager: true,
    flowLinie: activeChip(vb.detail, 'videos')
  };
}

/** Die Steuerung liegt im Bild: der Rahmen darf die ganze Bühne nutzen. */
function maxFrameHeight(root) {
  const stage = root.querySelector('[data-vb-voll-stage]');
  if (!stage || window.innerWidth < NARROW) return Math.max(220, Math.round(window.innerHeight * 0.6));
  return Math.max(220, stage.clientHeight - px(stage, 'paddingTop', 'paddingBottom'));
}

/**
 * Die Bühne ist so breit wie das Bild und die Lightbox so breit wie ihr Inhalt. Die Obergrenze kommt
 * deshalb vom Overlay (abzüglich der Seitenspalten), nie von der Bühne selbst.
 */
function maxFrameWidth(root) {
  const stage = root.querySelector('[data-vb-voll-stage]');
  if (!stage) return window.innerWidth;
  const pad = px(stage, 'paddingLeft', 'paddingRight');
  if (window.innerWidth < NARROW) return stage.clientWidth - pad;
  const overlay = root.closest('.media-lightbox-overlay');
  const box = overlay ? overlay.clientWidth - px(overlay, 'paddingLeft', 'paddingRight') : window.innerWidth;
  const boxMax = parseFloat(getComputedStyle(root.querySelector('[data-vb-voll]') || root).getPropertyValue('--vb-voll-max-w')) || box;
  const side = root.querySelector('.vb-voll__side')?.offsetWidth || 0;
  return Math.max(220, Math.min(box, boxMax) - side - pad);
}

/**
 * Ausstehendes Video: die Bühne ist so groß wie der Rahmen eines Players in SHOWCASE_RATIO (gleiche
 * Rechnung wie playerLayout.js). Sonst ändert sich die Breite der Lightbox beim Blättern.
 */
function sizeAusstehend(st) {
  const el = st.root?.querySelector('.vb-voll-aus');
  if (!el) return;
  const { w, h } = fitFrame(SHOWCASE_RATIO, Math.max(120, maxFrameWidth(st.root)), maxFrameHeight(st.root));
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
}

function fillDuration(st) {
  const fill = () => {
    const dur = st.player?.getDuration?.();
    const el = st.root?.querySelector('[data-vb-prop-duration]');
    if (el && dur > 0) el.textContent = formatTime(dur);
  };
  fill();
  st.player?.whenReady?.().then(fill);
}

function showTab(st, tab) {
  st.tab = tab;
  const root = st.root?.querySelector('[data-vb-voll]');
  if (!root) return;
  root.dataset.tab = tab;
  root.querySelectorAll('[data-vb-voll-tab]').forEach((btn) => {
    const on = btn.dataset.vbVollTab === tab;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
  });
}

function mount(vb, st, root) {
  st.root = root;
  const ctx = vollCtx(vb);
  const { koop, row, item } = ctx.resolved;
  st.sourceId = item?.asset?.source_asset_id || null;
  const host = root.querySelector('[data-vb-player-host]');
  if (item && host) {
    st.player = mountPlayer(host, {
      item,
      ratio: item.ratio,
      comments: commentsOf(row, item),
      motion: vb.motion,
      autoplay: true,
      maxHeight: () => maxFrameHeight(root),
      maxWidth: () => maxFrameWidth(root),
      onTime: (sec) => syncPinTime(vb, sec, item.id),
      onMarker: (commentId) => {
        showTab(st, 'feedback');
        highlightComment(vb, commentId);
      },
      onMessung: (messung) => saveWiedergabeMessung(messung, { team: vb.team })
    });
    fillDuration(st);
  } else {
    sizeAusstehend(st);
  }
  if (st.live) st.live.textContent = `${st.index + 1} von ${st.keys.length}: ${item?.name || row.label}, ${koop.name}`;
  if (st.first) {
    st.first = false;
    root.querySelector('[data-vb-voll]')?.focus({ preventScroll: true });
  }
  paintAusstehendUploads(vb);
}

/** Erst offene Eingaben speichern (Titel), dann den Fokus aus dem Overlay nehmen (Caption speichert beim Blur). */
async function leaveFields(vb, st, { wait = true } = {}) {
  if (vb.renaming && wait) await commitRename(vb);
  vb._closeTagField?.();
  const active = document.activeElement;
  if (active && st.box.overlay?.contains(active)) active.blur?.();
}

async function go(vb, st, sel, dir = 0) {
  await leaveFields(vb, st);
  if (vb.voll !== st) return;
  st.dir = dir;
  st.sel = sel;
  await st.box.update();
  vb._syncUrl();
}

function step(vb, st, delta) {
  if (st.keys.length < 2) return;
  st.index = (st.index + delta + st.keys.length) % st.keys.length;
  void go(vb, st, st.keys[st.index], delta);
}

/** Kachel schon hochgeladen (Upload fertig): auf die erste Datei der jüngsten Runde wechseln. */
function ersteDatei(sel, row) {
  const loops = row.folders.filter(f => f.kind === 'schleife' && f.items.length);
  const folder = loops[loops.length - 1] || row.folders.find(f => f.kind === 'final' && f.items.length);
  const item = folder?.items[0];
  return item ? { ...sel, folderId: folder.id, itemId: item.id } : null;
}

/** Regionen neu, Player bleibt. Ein Feld mit Fokus wird nicht überschrieben. */
function patch(vb, st) {
  const ctx = vollCtx(vb);
  const { row, item } = ctx.resolved;
  const root = st.root;
  const region = (name) => root.querySelector(`[data-vb-voll-region="${name}"]`);
  const frei = (el) => el && !el.contains(document.activeElement);

  if (!vb.renaming) region('head').innerHTML = headHtml(ctx, { index: st.index, total: st.keys.length });
  const final = region('final');
  if (final) {
    const hadFocus = final.contains(document.activeElement);
    final.innerHTML = finalBarHtml(ctx);
    if (hadFocus) final.querySelector('[data-vb-final-toggle], [data-vb-kunde-freigeben]')?.focus({ preventScroll: true });
  }
  const details = region('details');
  if (frei(details) && !vb.tagField && !vb.captionEdit) {
    details.innerHTML = vollDetailsHtml(ctx);
    fillDuration(st);
  }
  const feedback = region('feedback');
  if (frei(feedback)) feedback.innerHTML = feedbackHtml(ctx);
  root.querySelectorAll('[data-vb-tab-count]').forEach((el) => { el.textContent = String(feedbackCount(ctx)); });
  if (item) st.player?.setMarkers(commentsOf(row, item));
  paintAusstehendUploads(vb);
}

/** Nach jeder Änderung am Baum: Datei weg, Ausstehend jetzt mit Datei oder nur neue Werte. */
function refresh(vb, st) {
  if (vb.destroyed || vb.voll !== st || !st.root) return;
  const { row, item } = resolveSelection(vb.tree, st.sel);
  if (!row) { void closeVollansicht(vb, { instant: true }); return; }
  if (st.sel.itemId && !item) {
    // Finale Datei entfernt: zurück auf ihre Quelle, sonst auf die erste Datei des Videos
    const quelle = st.sourceId ? findIn(row, st.sourceId) : null;
    const next = quelle ? { ...st.sel, folderId: quelle.folderId, itemId: st.sourceId } : ersteDatei(st.sel, row);
    if (!next) { void closeVollansicht(vb, { instant: true }); return; }
    void go(vb, st, next);
    return;
  }
  if (!st.sel.itemId && istHochgeladen(row)) {
    const next = ersteDatei(st.sel, row);
    if (next) { void go(vb, st, next); return; }
  }
  st.sourceId = item?.asset?.source_asset_id || null;
  patch(vb, st);
}

function findIn(row, itemId) {
  for (const folder of row.folders) if (folder.items.some(i => i.id === itemId)) return { folderId: folder.id };
  return null;
}

/** Nach jedem Rendern des Showcase: Navigation auf die neue Anzeigeliste, dann nachziehen. */
export function syncVollansicht(vb) {
  const st = vb.voll;
  if (!st || st.quelle !== 'showcase') return;
  const keys = (vb.scResult?.list || []).map(selOf);
  const index = keys.findIndex(k => sameKey(k, st.sel));
  if (index >= 0) {
    st.keys = keys;
    st.index = index;
  }
  refresh(vb, st);
}

/**
 * @param {object} vb Controller
 * @param {{ quelle: 'showcase'|'ordner', list: Array<{ koop, row, item }>, index?: number|null,
 *           sel?: object|null, onClose?: (info: { dirty: boolean, sel: object }) => void }} opts
 *        sel: Start über eine Auswahl (Link); fehlt sie in der Liste, öffnet nur diese eine Kachel
 */
export function openVollansicht(vb, { quelle, list, index = null, sel = null, onClose = null }) {
  let keys = (list || []).map(selOf);
  let start = index ?? 0;
  if (sel) {
    start = keys.findIndex(k => sameKey(k, sel));
    if (start < 0) {
      const valid = validateSelection(sel, vb.tree);
      if (!valid.videoId) return;
      keys = [valid.itemId ? valid : { ...valid, folderId: null, itemId: null }];
      start = 0;
    }
  }
  if (!keys.length) return;
  if (vb.voll) void closeVollansicht(vb, { instant: true });

  vb.scMedia?.stopHover();
  vb.player?.pause?.();
  vb._closeTagField?.();

  const box = new MediaLightbox();
  const st = {
    box, quelle, keys, onClose,
    index: Math.min(Math.max(start, 0), keys.length - 1),
    sel: null, player: null, root: null, live: null, dir: 0, first: true,
    dirty: false, instant: false, tab: 'feedback', sourceId: null, cleanup: null
  };
  st.sel = st.keys[st.index];
  st.refresh = () => refresh(vb, st);
  st.showTab = (tab) => showTab(st, tab);
  vb.voll = st;

  box.open({
    className: 'vb-voll-lightbox',
    renderBody: () => bodyHtml(vollCtx(vb), { index: st.index, total: st.keys.length, tab: st.tab }),
    onBeforeRerender: () => { st.player?.destroy(); st.player = null; },
    onMount: (root) => mount(vb, st, root),
    onPrev: () => step(vb, st, -1),
    onNext: () => step(vb, st, 1),
    onBeforeClose: (overlay) => beforeClose(vb, st, overlay),
    onClose: () => teardown(vb, st)
  });
  st.overlay = box.overlay;

  // Eigenes Live-Element außerhalb des Bodys: der Body wird bei jedem Blättern ersetzt
  const live = document.createElement('div');
  live.className = 'vb-visually-hidden';
  live.setAttribute('aria-live', 'polite');
  box.overlay.appendChild(live);
  st.live = live;
  const unbind = bindVollansichtEvents(vb, st, {
    step: (delta) => step(vb, st, delta),
    goto: (sel) => go(vb, st, sel),
    openInFolder: () => openInFolder(vb, st),
    showTab: (tab) => showTab(st, tab),
    close: () => closeVollansicht(vb, { instant: true })
  });
  // Den Player-Rahmen hält der Player selbst nach, die Bühne eines Ausstehenden Videos dieser Listener
  const onResize = () => sizeAusstehend(st);
  window.addEventListener('resize', onResize);
  st.cleanup = () => {
    unbind();
    window.removeEventListener('resize', onResize);
  };
  vb._syncUrl();
}

export function closeVollansicht(vb, { instant = false } = {}) {
  const st = vb.voll;
  if (!st?.box?.isOpen()) return Promise.resolve();
  if (instant) st.instant = true;
  return st.box.close();
}

async function beforeClose(vb, st, overlay) {
  await leaveFields(vb, st, { wait: !st.instant });
  st.player?.pause();
  exitFs();
  if (st.instant || vb.destroyed) return;
  if (st.quelle === 'showcase') tileOf(vb, st.sel)?.scrollIntoView?.({ block: 'nearest' });
  await vb.motion?.lightboxOut({ overlay });
}

const tileOf = (vb, sel) => [...(vb.scGridEl?.querySelectorAll('[data-vb-sc-tile]') || [])]
  .find(t => t.dataset.itemId === tileKey(sel)) || null;

function teardown(vb, st) {
  st.player?.destroy();
  st.player = null;
  st.cleanup?.();
  exitFs();
  if (vb.voll === st) vb.voll = null;
  vb.renaming = null;
  vb.captionEdit = null;
  if (vb.destroyed) return;
  if (st.quelle === 'ordner') {
    // Der Ordner folgt der zuletzt gezeigten Datei
    if (st.sel.itemId && st.sel.itemId !== vb.sel.itemId) vb._select(st.sel);
    else if (st.dirty) vb._render({ restoreFocus: false, patch: true });
  }
  st.onClose?.({ dirty: st.dirty, sel: st.sel });
  vb._syncUrl();
  if (!st.instant && st.quelle === 'showcase') tileOf(vb, st.sel)?.focus({ preventScroll: true });
}

/** Für alle: Vollansicht zu, Ordner auf die Datei bzw. beim Ausstehenden Video auf die nächste Schleife. */
async function openInFolder(vb, st) {
  const { row } = resolveSelection(vb.tree, st.sel);
  const sel = st.sel.itemId ? st.sel : { ...st.sel, folderId: (vb.canUpload && uploadZiel(row)?.id) || null };
  await closeVollansicht(vb, { instant: true });
  if (vb.destroyed) return;
  if (vb.view === 'ordner') vb._select(sel);
  else vb._openInFolder(sel);
}
