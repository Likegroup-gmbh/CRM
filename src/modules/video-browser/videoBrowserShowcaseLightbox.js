// videoBrowserShowcaseLightbox.js
// Vollansicht der Showcase-Ansicht. Basis ist die MediaLightbox (Overlay, Esc,
// Pfeiltasten, Prev/Next), das Medium kommt aus dem Vorschau-Player des Videos-Tabs (mountPlayer).
// Zustand liegt am Controller (`vb.scBox`). Navigation ist zyklisch über die gesamte Anzeigeliste.

import { MediaLightbox } from '../../core/media/MediaLightbox.js';
import { escapeHtml as esc } from '../../core/format.js';
import { mountPlayer } from './VideoBrowserPlayer.js';
import { tagChipHtml, tagsOf } from './videoBrowserRenderTags.js';
import { FINAL_ID } from './videoBrowserFormat.js';

const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

/** Höhe, die dem Medium bleibt: Viewport abzüglich Kopf, Zeitleiste, Steuerung und Info. */
const maxFrameHeight = () => Math.max(220, window.innerHeight - 400);

function infoHtml(entry, vb) {
  const { koop, row, item } = entry;
  const meta = [koop.name, row.label, row.title, item.type === 'still' ? null : item.ratio].filter(Boolean).join(' · ');
  const tags = tagsOf(item, vb.raw?.tagTypen || []).map(t => tagChipHtml(t)).join('');
  const openInFolder = vb.team
    ? '<button type="button" class="mdc-btn mdc-btn--secondary vb-sc-box__open" data-vb-sc-open-folder>Im Ordner öffnen</button>'
    : '';
  return `
    <p class="vb-sc-box__title">${esc(item.name)}</p>
    <p class="vb-sc-box__meta">${esc(meta)}</p>
    ${tags ? `<div class="vb-sc-box__tags">${tags}</div>` : ''}
    ${openInFolder}`;
}

function bodyHtml(entry, index, total, vb) {
  return `
    <div class="vb-sc-box" data-vb-sc-box>
      <span class="vb-sc-box__count">${index + 1} / ${total}</span>
      <div class="vb-sc-box__host" data-vb-player-host></div>
      <div class="vb-sc-box__info">${infoHtml(entry, vb)}</div>
    </div>`;
}

const tileFor = (vb, itemId) => [...(vb.scGridEl?.querySelectorAll('[data-vb-sc-tile]') || [])]
  .find(t => t.dataset.itemId === itemId) || null;

/** Offen? */
export const isShowcaseBoxOpen = (vb) => !!vb.scBox?.box?.isOpen();

/**
 * Vollansicht öffnen.
 * @param {object} vb Controller
 * @param {{ index?: number }} opts
 */
export function openShowcaseLightbox(vb, { index = 0 } = {}) {
  const list = vb.scResult?.list || [];
  if (!list.length) return;
  closeShowcaseLightbox(vb, { animate: false });

  vb.scMedia?.stopHover();
  vb.player?.pause?.();

  const box = new MediaLightbox();
  const st = { box, index: Math.min(Math.max(index, 0), list.length - 1), player: null, dir: 0, first: true, skipAnim: false };
  vb.scBox = st;

  const step = (delta) => {
    st.dir = delta;
    st.index = (st.index + delta + list.length) % list.length;
    box.update();
  };

  box.open({
    className: 'vb-sc-lightbox',
    renderBody: () => bodyHtml(list[st.index], st.index, list.length, vb),
    onBeforeRerender: () => { st.player?.destroy(); st.player = null; },
    onMount: (root) => mountEntry(vb, st, root, list),
    onPrev: () => step(-1),
    onNext: () => step(1),
    onBeforeClose: (overlay) => animateClose(vb, st, overlay, list),
    onClose: () => teardown(vb, st)
  });

  // Eigenes Live-Element außerhalb des Bodys: der Body wird bei jedem Blättern ersetzt
  const live = document.createElement('div');
  live.className = 'vb-visually-hidden';
  live.setAttribute('aria-live', 'polite');
  live.dataset.vbScLive = '';
  box.overlay.appendChild(live);
  st.live = live;
  box.overlay.addEventListener('click', (e) => onBoxClick(vb, st, e));
}

function mountEntry(vb, st, root, list) {
  const entry = list[st.index];
  const host = root.querySelector('[data-vb-player-host]');
  if (!host) return;
  st.player = mountPlayer(host, {
    item: entry.item,
    ratio: entry.item.ratio,
    motion: vb.motion,
    autoplay: true,
    maxHeight: maxFrameHeight
  });
  if (st.live) st.live.textContent = `${st.index + 1} von ${list.length}: ${entry.item.name}, ${entry.koop.name}`;

  // Erstes Öffnen: nur das Einblenden der Karte (CSS der MediaLightbox). Blättern: Medium gleitet ein.
  if (st.first) st.first = false;
  else vb.motion?.slideIn(host.querySelector('[data-vb-frame]'), st.dir);
}

function onBoxClick(vb, st, e) {
  if (e.target.closest('[data-vb-sc-open-folder]')) {
    openInFolder(vb, st);
    return;
  }
}

/** Team: Vollansicht zu, Ansicht "Ordner", Auswahl auf die Finale Datei. */
function openInFolder(vb, st) {
  const entry = vb.scResult?.list?.[st.index];
  if (!entry || !vb.team) return;
  st.skipAnim = true;
  void st.box.close();
  // Finale liegen im Ordner Finale Version, Dateien des aktuellen Stands in ihrer Feedbackschleife
  const folder = entry.row.folders.find(f => f.items.some(i => i.id === entry.item.id));
  vb._openInFolder({
    kooperationId: entry.koop.id, videoId: entry.row.id, folderId: folder?.id || FINAL_ID, itemId: entry.item.id
  });
}

/** Schließen: Overlay blendet aus, die Kachel des aktuell gezeigten Inhalts wird vorher in Sicht gescrollt. */
async function animateClose(vb, st, overlay, list) {
  st.player?.pause();
  if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  if (st.skipAnim) return;
  const entry = list[st.index];
  const tile = tileFor(vb, entry.item.id);
  tile?.scrollIntoView?.({ block: 'nearest' });
  await vb.motion?.lightboxOut({ overlay });
}

function teardown(vb, st) {
  st.player?.destroy();
  st.player = null;
  if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  const entry = vb.scResult?.list?.[st.index];
  if (vb.scBox === st) vb.scBox = null;
  // Fokus zurück auf die Kachel des zuletzt gezeigten Inhalts
  if (entry && !st.skipAnim && !vb.destroyed) tileFor(vb, entry.item.id)?.focus({ preventScroll: true });
}

export function closeShowcaseLightbox(vb, { animate = true } = {}) {
  const st = vb.scBox;
  if (!st?.box?.isOpen()) { vb.scBox = null; return Promise.resolve(); }
  if (!animate) st.skipAnim = true;
  return st.box.close();
}
