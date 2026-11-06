// VideoBrowser.js
// Controller des Videos-Tabs (Produktion → Videos): Spaltenbrowser mit vier Ebenen
// (Kooperation → Video/Story → Ordner → Datei), Ablauf-Leiste, Pfadleiste,
// Detailbereich, Upload-Zone, Kommentare mit Timecode.
//
// Zustand: Auswahl (URL: ?k=&v=&f=&i=), Baum aus videoBrowserLogic.buildTree.
// Rechte nur über canFeature/Features (videoTeamSicht, mediaUpload, skriptKommentieren).
// Events, Kommentare, Titel, Aktionen und Uploads liegen in eigenen Modulen (videoBrowser*.js).

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { loadVideoBrowserData, saveWiedergabeMessung } from './VideoBrowserAdapter.js';
import { createMotion } from './videoBrowserMotion.js';
import { mountPlayer } from './VideoBrowserPlayer.js';
import { prefetchLinks, stopWarming, warmNeighbors } from './videoBrowserMedia.js';
import { createUploader } from './VideoBrowserUpload.js';
import {
  EMPTY_SELECTION,
  SELECTION_KEYS,
  buildTree,
  commentsForAsset,
  cssEscape,
  ersterOffenerInhalt,
  resolveSelection,
  selectionEquals,
  selectionFromSearch,
  selectionToSearch,
  validateSelection,
  withAutoItem
} from './videoBrowserLogic.js';
import { renderColumns, renderDetail, renderPath } from './videoBrowserRender.js';
import { bindEvents } from './videoBrowserEvents.js';
import { highlightComment, syncPinTime } from './videoBrowserComments.js';
import { currentUploads, uploadChanged, uploadSettled, uploadsAdded } from './videoBrowserUploadState.js';

/** Spätestens dann werden die Nachbarn vorgewärmt, auch wenn das aktive Video noch lädt. */
const WARM_GATE_MS = 4000;

function syncUrl(sel) {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const search = selectionToSearch(window.location.search, sel);
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
}

export function clearVideoBrowserUrl() {
  syncUrl(EMPTY_SELECTION);
}

class VideoBrowser {
  constructor(detail, pane) {
    this.detail = detail;
    this.pane = pane;
    this.team = !!window.canFeature?.('videoTeamSicht');
    this.canUpload = !!window.canFeature?.('mediaUpload') && this.team;
    this.canComment = !!window.canFeature?.('skriptKommentieren');
    this.canDownload = !!window.canFeature?.('mediaDownload');
    this.raw = null;
    this.tree = { kooperationen: [] };
    this.sel = { ...EMPTY_SELECTION };
    this.drafts = {};
    this.uploads = new Map();
    this.player = null;
    this.renaming = null;
    this.focusPending = null;
    this.destroyed = false;
    this.cleanups = [];
  }

  toast(type, text) {
    window.toastSystem?.show?.(text, type);
  }

  /* ---- Lebenszyklus ---- */

  async mount() {
    await this._load();
    if (this.destroyed) return;

    if (!this.tree.kooperationen.length) {
      this.pane.innerHTML = renderEmptyState({
        icon: 'video',
        title: 'Keine Videos vorhanden',
        text: 'In diesem Bereich gibt es noch keine Kooperationen mit Videos.'
      });
      return;
    }

    this.sel = validateSelection(selectionFromSearch(window.location.search), this.tree);
    this._buildShell();
    this.motion = createMotion(this.root);
    this.uploader = createUploader({
      onAdded: (list) => uploadsAdded(this, list),
      onChange: (patch) => uploadChanged(this, patch),
      onSettled: (info) => uploadSettled(this, info),
      toast: (type, text) => this.toast(type, text)
    });
    bindEvents(this);
    this._render({ fromDepth: 0, detailAnimate: true });
    this._fit();
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this._warmTimer);
    this._warmGen = (this._warmGen || 0) + 1;
    stopWarming();
    this._destroyPlayer();
    this.uploader?.destroy();
    this.motion?.destroy();
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
    this.pane.innerHTML = '';
  }

  async _load() {
    const d = this.detail;
    this.raw = await loadVideoBrowserData({
      kampagneId: d.kampagneId,
      produktionId: d.produktionId || null,
      briefingId: this._linieId(),
      linien: d.linien || [],
      team: this.team
    });
    this.tree = buildTree(this.raw, { team: this.team });
  }

  _linieId() {
    const d = this.detail;
    if (!d?.linien?.length) return null;
    return d.linieAlle ? null : (d.linieId || null);
  }

  async reload() {
    const before = this.sel;
    await this._load();
    if (this.destroyed) return;
    this.sel = validateSelection(before, this.tree);
    if (!selectionEquals(before, this.sel)) syncUrl(this.sel);
    this._render({ restoreFocus: false });
  }

  /* ---- Gerüst ---- */

  _buildShell() {
    this.pane.innerHTML = `
      <div class="vb" data-vb>
        <nav class="vb-path" data-vb-path aria-label="Pfad"></nav>
        <div class="vb-main">
          <div class="vb-cols" data-vb-cols></div>
          <section class="vb-detail" data-vb-detail aria-labelledby="vb-detail-heading" aria-live="polite">
            <h3 class="vb-visually-hidden" id="vb-detail-heading">Details</h3>
            <div class="vb-detail__inner" data-vb-detail-inner></div>
          </section>
        </div>
      </div>`;
    this.root = this.pane.querySelector('[data-vb]');
    this.pathEl = this.root.querySelector('[data-vb-path]');
    this.colsEl = this.root.querySelector('[data-vb-cols]');
    this.detailEl = this.root.querySelector('[data-vb-detail]');
    this.detailInner = this.root.querySelector('[data-vb-detail-inner]');
  }

  _fit() {
    // Höhe kommt aus dem Flex-Layout (video-browser.css). Hier nur die
    // Pfadleiste, die von der Spaltenbreite abhängt.
    const apply = () => {
      if (this.destroyed || !this.root?.isConnected) return;
      this._syncLayout();
    };
    apply();
    window.addEventListener('resize', apply);
    this.cleanups.push(() => window.removeEventListener('resize', apply));
    document.fonts?.ready?.then(apply);
  }

  _ctx() {
    const resolved = resolveSelection(this.tree, this.sel);
    return {
      tree: this.tree,
      sel: this.sel,
      resolved,
      team: this.team,
      canUpload: this.canUpload,
      canComment: this.canComment,
      canDownload: this.canDownload,
      drafts: this.drafts,
      uploads: currentUploads(this, resolved),
      produktionTitel: this.detail.lineTitle || this.detail.produktion?.name || '',
      zeigeLinie: !!(this.detail.linien?.length > 1 && this.detail.linieAlle),
      hatOffenes: !!ersterOffenerInhalt(this.tree)
    };
  }

  /* ---- Rendern ---- */

  /**
   * @param {{ fromDepth?: number|null, detailAnimate?: boolean,
   *           cols?: boolean, detail?: boolean, restoreFocus?: boolean }} opts
   * fromDepth: ab dieser Spaltentiefe wird animiert (null = gar nicht).
   */
  _render({ fromDepth = null, detailAnimate = false, cols = true, detail = true, restoreFocus = true } = {}) {
    const ctx = this._ctx();

    this.pathEl.innerHTML = renderPath(ctx);
    if (cols) this._renderColumns(ctx, { fromDepth });
    if (detail) this._renderDetail(ctx, { animate: detailAnimate });
    this._syncLayout();
    if (restoreFocus) this._applyFocus();
    this._prefetchMedia(ctx);
  }

  /** Nur Pfad und Spalten neu, Detail und Player bleiben stehen. */
  _renderNav() {
    const ctx = this._ctx();
    this.pathEl.innerHTML = renderPath(ctx);
    this._renderColumns(ctx);
  }

  /**
   * Medien vorbereiten, bevor geklickt wird: Links der Dateien im offenen Ordner und der
   * Ordner mit nur einer Datei (werden beim Öffnen automatisch gewählt). Die Nachbarn der
   * gewählten Datei werden erst vorgewärmt, wenn das aktive Video durchspielbar ist (oder
   * nach WARM_GATE_MS), damit sie ihm keine Bandbreite wegnehmen.
   */
  _prefetchMedia(ctx) {
    clearTimeout(this._warmTimer);
    const gen = this._warmGen = (this._warmGen || 0) + 1;
    const { row, folder, item } = ctx.resolved;
    const candidates = [...(folder?.items || [])];
    for (const f of row?.folders || []) {
      if (f.kind !== 'raw' && f.items.length === 1) candidates.push(f.items[0]);
    }
    prefetchLinks(candidates);
    if (!folder || !item) return;
    const i = folder.items.findIndex(x => x.id === item.id);
    const neighbors = [folder.items[i - 1], folder.items[i + 1]].filter(Boolean);
    if (!neighbors.length) return;
    const fallback = new Promise((resolve) => { this._warmTimer = setTimeout(resolve, WARM_GATE_MS); });
    Promise.race([this.player?.whenReady?.() || Promise.resolve(), fallback]).then(() => {
      if (!this.destroyed && gen === this._warmGen) warmNeighbors(neighbors);
    });
  }

  /**
   * Die Pfadleiste zeigt dasselbe wie die Spaltenköpfe. Sie erscheint nur, wenn die Spalten
   * horizontal scrollen (dann ist der Anfang nicht mehr zu sehen).
   */
  _syncLayout() {
    if (!this.root) return;
    // offsetWidth statt scrollWidth: Einblend-Animationen verschieben Spalten per transform.
    const scrolls = !!this.colsEl
      && [...this.colsEl.children].reduce((sum, col) => sum + col.offsetWidth, 0) > this.colsEl.clientWidth + 1;
    this.root.classList.toggle('vb--path', scrolls);
  }

  _renderColumns(ctx, { fromDepth = null } = {}) {
    const scrolls = new Map([...this.colsEl.querySelectorAll('.vb-col')].map(c => [c.dataset.depth, c.querySelector('[data-vb-body]')?.scrollTop || 0]));
    const badgesBefore = new Map([...this.colsEl.querySelectorAll('[data-badge-key]')].map(b => [b.dataset.badgeKey, b.textContent]));

    this.colsEl.innerHTML = renderColumns(ctx).join('');
    const cols = [...this.colsEl.querySelectorAll('.vb-col')];
    cols.forEach((col) => {
      const body = col.querySelector('[data-vb-body]');
      if (body) body.scrollTop = scrolls.get(col.dataset.depth) || 0;
    });

    if (fromDepth !== null) {
      this.motion.columnsIn(cols, { fromDepth, scroller: this.colsEl });
    } else {
      // A11: Zähler, die sich ändern
      this.colsEl.querySelectorAll('[data-badge-key]').forEach((b) => {
        const was = badgesBefore.get(b.dataset.badgeKey);
        if (was !== undefined && was !== b.textContent) this.motion.badgeBump(b);
      });
    }
  }

  _renderDetail(ctx, { animate = false } = {}) {
    this._destroyPlayer();
    this.renaming = null;
    this.detailInner.innerHTML = renderDetail(ctx);

    const host = this.detailInner.querySelector('[data-vb-player-host]');
    const { row, item } = ctx.resolved;
    if (host && item) {
      const comments = item.type === 'video' && row ? commentsForAsset(row.comments, item.runde, item.id) : [];
      this.player = mountPlayer(host, {
        item,
        ratio: item.ratio,
        comments,
        motion: this.motion,
        onTime: (sec) => syncPinTime(this, sec, item.id),
        onMarker: (commentId) => highlightComment(this, commentId),
        onMessung: (messung) => saveWiedergabeMessung(messung, { team: this.team })
      });
    }

    if (animate) this.motion.detailIn(this.detailEl);
  }

  _destroyPlayer() {
    this.player?.destroy();
    this.player = null;
  }

  /* ---- Auswahl ---- */

  _setSel(sel) {
    this.sel = sel;
    syncUrl(sel);
  }

  _select(next, { focus = null, autoItem = false } = {}) {
    let target = validateSelection(next, this.tree);
    // Nur beim Öffnen eines Ordners, nicht beim Zurückgehen aus der Datei.
    if (autoItem) target = withAutoItem(target, this.tree);
    if (selectionEquals(target, this.sel)) {
      this.focusPending = focus;
      this._applyFocus();
      return;
    }
    let differing = SELECTION_KEYS.findIndex(key => (target[key] || null) !== (this.sel[key] || null));
    if (differing < 0) differing = 0;
    this.focusPending = focus;
    this._setSel(target);
    this._render({ fromDepth: differing + 1, detailAnimate: true });
  }

  _applyFocus() {
    const f = this.focusPending;
    this.focusPending = null;
    if (!f) return;
    let el = null;
    if (f.id) el = this.colsEl.querySelector(`.vb-col[data-depth="${f.depth}"] .vb-row[data-id="${cssEscape(String(f.id))}"]`);
    else el = this.colsEl.querySelector(`.vb-col[data-depth="${f.depth}"] .vb-row:not(.vb-row--upload)`);
    el?.focus({ preventScroll: true });
  }
}

/* ------------------------------------------------------------------ */
/* Anbindung an die Produktions-Detailseite                            */
/* ------------------------------------------------------------------ */

export async function mountVideoBrowserPane(detail, pane, isCurrent = () => true) {
  unmountVideoBrowser(detail);
  const browser = new VideoBrowser(detail, pane);
  detail._videoBrowser = browser;
  try {
    await browser.mount();
  } catch (error) {
    browser.destroy();
    if (detail._videoBrowser === browser) detail._videoBrowser = null;
    throw error;
  }
  if (!isCurrent() || !pane.isConnected) {
    browser.destroy();
    if (detail._videoBrowser === browser) detail._videoBrowser = null;
  }
}

export function unmountVideoBrowser(detail) {
  detail._videoBrowser?.destroy();
  detail._videoBrowser = null;
}

export { VideoBrowser };
