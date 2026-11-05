// VideoBrowser.js
// Controller des Videos-Tabs (Produktion → Videos): Spaltenbrowser mit vier Ebenen
// (Kooperation → Video/Story → Ordner → Datei), Ablauf-Leiste, Pfadleiste,
// Detailbereich, Upload-Zone, Kommentare mit Timecode.
//
// Zustand: Auswahl (URL: ?k=&v=&f=&i=), Baum aus videoBrowserLogic.buildTree.
// Rechte nur über canFeature/Features (videoTeamSicht, mediaUpload, skriptKommentieren).

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { confirmationModal } from '../../core/ConfirmationModal.js';
import { escapeHtml } from '../../core/format.js';
import { icon } from '../../core/icons/IconSystem.js';
import {
  TITEL_MAX,
  deleteAsset,
  loadVideoBrowserData,
  renameAsset,
  saveWiedergabeMessung,
  saveZeitkommentar
} from './VideoBrowserAdapter.js';
import { createMotion } from './videoBrowserMotion.js';
import { mountPlayer } from './VideoBrowserPlayer.js';
import { prefetchLinks, stopWarming, warmNeighbors } from './videoBrowserMedia.js';
import { createUploader } from './VideoBrowserUpload.js';
import { downloadItems } from './videoBrowserDownload.js';
import {
  EMPTY_SELECTION,
  SELECTION_KEYS,
  buildTree,
  clearFrom,
  collectDownloadItems,
  commentsForAsset,
  cssEscape,
  ersterOffenerInhalt,
  plural,
  renditionFor,
  resolveSelection,
  selectLevel,
  selectionEquals,
  selectionFromSearch,
  selectionToSearch,
  validateSelection,
  withAutoItem
} from './videoBrowserLogic.js';
import {
  commentHtml,
  formatHint,
  renderColumns,
  renderDetail,
  renderPath,
  uploadRowHtml
} from './videoBrowserRender.js';

const toast = (type, text) => window.toastSystem?.show?.(text, type);
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
    this.viewRatio = null;
    this.player = null;
    this.renaming = null;
    this.focusPending = null;
    this.destroyed = false;
    this.cleanups = [];
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
      onAdded: (list) => this._uploadsAdded(list),
      onChange: (patch) => this._uploadChanged(patch),
      onSettled: (info) => this._uploadSettled(info),
      toast
    });
    this._bind();
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
      uploads: this._currentUploads(resolved),
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
    this.viewRatio = ctx.resolved.item?.ratio || null;

    this.pathEl.innerHTML = renderPath(ctx);
    if (cols) this._renderColumns(ctx, { fromDepth });
    if (detail) this._renderDetail(ctx, { animate: detailAnimate });
    this._syncLayout();
    if (restoreFocus) this._applyFocus();
    this._prefetchMedia(ctx);
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
        onTime: (sec) => {
          const label = this.detailInner.querySelector('[data-vb-pin-time]');
          if (label) label.textContent = this._fmt(sec);
          this._autoPin(sec, item.id);
        },
        onMarker: (commentId) => this._highlightComment(commentId),
        onMessung: (row) => saveWiedergabeMessung(row, { team: this.team })
      });
    }

    const formats = this.detailInner.querySelector('[data-vb-formats]');
    if (formats) {
      this.motion.segmentThumb(formats, { animate: false });
      document.fonts?.ready?.then(() => { if (!this.destroyed && formats.isConnected) this.motion.segmentThumb(formats, { animate: false }); });
    }

    if (animate) this.motion.detailIn(this.detailEl);
  }

  /**
   * Zeitstempel-Checkbox: an, sobald der Playhead bewegt wurde, solange der Nutzer sie nicht
   * selbst angefasst hat. Bei 0:00 hat noch niemand eine Stelle gewählt.
   */
  _autoPin(sec, assetId) {
    const pin = this.detailInner?.querySelector('[data-vb-pin]');
    if (!pin || this.drafts[assetId]?.pinTouched) return;
    pin.checked = sec > 0.05;
  }

  _fmt(sec) {
    const total = Math.max(0, Math.floor(sec || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  _destroyPlayer() {
    this.player?.destroy();
    this.player = null;
  }

  /* ---- Auswahl ---- */

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
    this.sel = target;
    this.focusPending = focus;
    syncUrl(this.sel);
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

  _gotoFromAttrs(el) {
    const { gotoKoop, gotoVideo, gotoFolder, gotoItem } = el.dataset;
    let next = { ...this.sel };
    if (gotoKoop) next = selectLevel(next, 0, gotoKoop);
    if (gotoVideo) next = selectLevel(next, 1, gotoVideo);
    if (gotoFolder) next = selectLevel(next, 2, gotoFolder);
    if (gotoItem) next = selectLevel(next, 3, gotoItem);
    this._select(next, { autoItem: !!gotoFolder && !gotoItem });
  }

  /* ---- Events ---- */

  _bind() {
    const on = (target, type, handler, opts) => {
      target.addEventListener(type, handler, opts);
      this.cleanups.push(() => target.removeEventListener(type, handler, opts));
    };

    on(this.root, 'click', (e) => this._onClick(e));
    on(this.colsEl, 'keydown', (e) => this._onColsKey(e));
    on(this.root, 'submit', (e) => {
      const form = e.target.closest('[data-vb-comment-form]');
      if (!form) return;
      e.preventDefault();
      void this._submitComment(form);
    });
    on(this.root, 'input', (e) => {
      const text = e.target.closest('[data-vb-comment-text]');
      if (!text) return;
      const form = text.closest('[data-vb-comment-form]');
      const draft = this.drafts[form.dataset.assetId] || { text: '', pinned: false, pinTouched: false };
      draft.text = text.value;
      this.drafts[form.dataset.assetId] = draft;
    });
    on(this.root, 'change', (e) => {
      const radio = e.target.closest('[data-vb-formats] input[type="radio"]');
      if (radio) {
        this._switchRatio(radio);
        return;
      }
      const pin = e.target.closest('[data-vb-pin]');
      if (pin) {
        const form = pin.closest('[data-vb-comment-form]');
        const draft = this.drafts[form.dataset.assetId] || { text: '', pinned: false, pinTouched: false };
        draft.pinned = pin.checked;
        draft.pinTouched = true;
        this.drafts[form.dataset.assetId] = draft;
        return;
      }
      const input = e.target.closest('[data-vb-file]');
      if (input) {
        this._startUpload([...input.files]);
        input.value = '';
      }
    });
    on(this.root, 'keydown', (e) => {
      if (e.target.closest('[data-vb-title-input]')) {
        if (e.key === 'Enter') {
          e.preventDefault();
          void this._commitRename();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this._endRename();
        }
        return;
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.closest('[data-vb-comment-text]')) {
        e.preventDefault();
        void this._submitComment(e.target.closest('[data-vb-comment-form]'));
      }
    });
    // Der Haken speichert per Klick: das Feld darf vorher nicht durch Blur speichern.
    on(this.root, 'mousedown', (e) => {
      if (this.renaming && e.target.closest('[data-vb-edit]')) e.preventDefault();
    });
    on(this.root, 'focusout', (e) => {
      if (e.target.closest('[data-vb-title-input]')) void this._commitRename();
    });
    on(this.root, 'dblclick', (e) => {
      if (e.target.closest('[data-vb-asset-title]') && !this.renaming) this._startRename();
    });

    // Drag & Drop: Drop außerhalb der Zone darf die Datei nicht im Browser öffnen.
    const isFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    on(document, 'dragover', (e) => { if (isFiles(e)) e.preventDefault(); });
    on(document, 'drop', (e) => { if (isFiles(e)) e.preventDefault(); });
    // Die ganze Spalte mit Upload-Zone ist Ablageziel, nicht nur die kleine Fläche am Fuß.
    const dropTarget = (e) => {
      const col = e.target.closest('.vb-col');
      const zone = col?.querySelector('[data-vb-dropzone]');
      return zone ? { col, zone } : null;
    };
    const clearDrop = ({ col, zone }) => {
      col.classList.remove('is-dropping');
      zone.classList.remove('dragover');
    };
    on(this.root, 'dragover', (e) => {
      const target = dropTarget(e);
      if (!target || !isFiles(e)) return;
      e.preventDefault();
      target.col.classList.add('is-dropping');
      target.zone.classList.add('dragover');
    });
    on(this.root, 'dragleave', (e) => {
      const target = dropTarget(e);
      if (target && !target.col.contains(e.relatedTarget)) clearDrop(target);
    });
    on(this.root, 'drop', (e) => {
      const target = dropTarget(e);
      if (!target) return;
      e.preventDefault();
      clearDrop(target);
      this._startUpload([...(e.dataTransfer?.files || [])]);
    });
  }

  _onClick(e) {
    const rowBtn = e.target.closest('.vb-col .vb-row[data-depth]');
    if (rowBtn && !rowBtn.classList.contains('vb-row--upload')) {
      const depth = Number(rowBtn.dataset.depth);
      this._select(selectLevel(this.sel, depth, rowBtn.dataset.id), { focus: { depth, id: rowBtn.dataset.id }, autoItem: depth === 2 });
      return;
    }

    const download = e.target.closest('[data-vb-download]');
    if (download) {
      void this._download(download);
      return;
    }

    if (e.target.closest('[data-vb-edit]')) {
      if (this.renaming) void this._commitRename();
      else this._startRename();
      return;
    }

    const remove = e.target.closest('[data-vb-delete]');
    if (remove) {
      void this._deleteItem(remove);
      return;
    }

    const keep = e.target.closest('[data-path-keep]');
    if (keep) {
      this._select(clearFrom(this.sel, Number(keep.dataset.pathKeep)));
      return;
    }

    const back = e.target.closest('[data-vb-back]');
    if (back) {
      const depth = Number(back.closest('.vb-col').dataset.depth);
      this._select(clearFrom(this.sel, depth - 1));
      return;
    }

    if (e.target.closest('[data-vb-first-open]')) {
      const first = ersterOffenerInhalt(this.tree);
      if (first) this._select(first);
      return;
    }

    const seek = e.target.closest('.vb-comment [data-seek]');
    if (seek && this.player) {
      this.player.seek(Number(seek.dataset.seek));
      this._highlightComment(seek.closest('.vb-comment').dataset.commentId);
      return;
    }

    const zone = e.target.closest('[data-vb-dropzone]');
    if (zone && !e.target.closest('[data-vb-file]')) {
      zone.querySelector('[data-vb-file]')?.click();
      return;
    }

    const goto = e.target.closest('[data-goto-koop], [data-goto-video], [data-goto-folder], [data-goto-item]');
    if (goto) this._gotoFromAttrs(goto);
  }

  _onColsKey(e) {
    const rowEl = e.target.closest('.vb-row[data-depth]');
    if (!rowEl || rowEl.classList.contains('vb-row--upload')) return;
    const col = rowEl.closest('.vb-col');
    const depth = Number(rowEl.dataset.depth);
    const rows = [...col.querySelectorAll('.vb-row[data-depth]:not(.vb-row--upload)')];
    const idx = rows.indexOf(rowEl);

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      rows[idx + (e.key === 'ArrowDown' ? 1 : -1)]?.focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const selectedAlready = rowEl.getAttribute('aria-current') === 'true';
      if (selectedAlready) {
        this.colsEl.querySelector(`.vb-col[data-depth="${depth + 1}"] .vb-row:not(.vb-row--upload)`)?.focus();
      } else {
        this._select(selectLevel(this.sel, depth, rowEl.dataset.id), { focus: { depth: depth + 1 }, autoItem: depth === 2 });
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.colsEl.querySelector(`.vb-col[data-depth="${depth - 1}"] .vb-row.is-selected`)?.focus();
    }
  }

  /* ---- Format-Umschalter ---- */

  _switchRatio(radio) {
    const ratio = radio.value;
    const { row, item, folder } = resolveSelection(this.tree, this.sel);
    if (!row || !item || !folder) return;
    this._endRename();
    const group = radio.closest('[data-vb-formats]');
    this.motion.segmentThumb(group, { animate: true });

    const finals = (row.folders.find(f => f.kind === 'final')?.items || []).filter(i => i.type === item.type);
    const rendition = renditionFor(finals, ratio);
    this.viewRatio = ratio;
    const hint = this.detailInner.querySelector('[data-vb-format-hint]');
    if (hint) hint.textContent = formatHint(ratio, !!rendition);

    if (rendition && rendition.id !== item.id) {
      this.sel = { ...this.sel, itemId: rendition.id };
      syncUrl(this.sel);
      const ctx = this._ctx();
      this.pathEl.innerHTML = renderPath(ctx);
      this._renderColumns(ctx);
      const title = this.detailInner.querySelector('[data-vb-asset-title]');
      if (title) title.textContent = rendition.name;
      this.player?.setRatio(ratio, { asset: rendition });
    } else {
      this.player?.setRatio(ratio);
    }
  }

  /* ---- Download ---- */

  _downloadMeta(koop) {
    const k = this.detail.kampagneData || {};
    return {
      creatorName: koop?.name || '',
      unternehmen: k.unternehmen?.firmenname || '',
      kampagne: k.kampagnenname || k.eigener_name || ''
    };
  }

  async _download(button) {
    if (!this.canDownload || button.disabled) return;
    const resolved = resolveSelection(this.tree, this.sel);
    const entries = collectDownloadItems(button.dataset.vbDownload, resolved);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      await downloadItems(entries, this._downloadMeta(resolved.koop));
    } catch (err) {
      console.error('VideoBrowser: Download fehlgeschlagen', err);
      toast('error', 'Download fehlgeschlagen.');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  /* ---- Titel bearbeiten (inline im Detailkopf) ---- */

  _startRename() {
    if (!this.canUpload || this.renaming) return;
    const { item } = resolveSelection(this.tree, this.sel);
    const title = this.detailInner.querySelector('[data-vb-asset-title]');
    if (!item || !title) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input vb-asset-head__input';
    input.value = item.name;
    input.maxLength = TITEL_MAX;
    input.setAttribute('aria-label', 'Titel');
    input.setAttribute('data-vb-title-input', '');
    title.replaceChildren(input);
    const button = this.detailInner.querySelector('[data-vb-edit]');
    this._setEditButton(button, true);
    this.renaming = { itemId: item.id, name: item.name, input, title, button, busy: false };
    input.focus();
    input.select();
  }

  _setEditButton(button, editing) {
    if (!button) return;
    const label = editing ? 'Titel speichern' : 'Titel bearbeiten';
    button.innerHTML = icon(editing ? 'check' : 'pencil-square');
    button.setAttribute('aria-label', label);
    button.title = label;
    button.classList.toggle('is-active', editing);
  }

  _endRename(name) {
    const state = this.renaming;
    if (!state) return;
    this.renaming = null;
    state.title.textContent = name ?? state.name;
    this._setEditButton(state.button, false);
  }

  async _commitRename() {
    const state = this.renaming;
    if (!state || state.busy) return;
    const value = state.input.value.trim();
    const { item } = resolveSelection(this.tree, this.sel);
    if (!value || value === state.name || item?.id !== state.itemId) {
      this._endRename();
      return;
    }
    state.busy = true;
    state.input.disabled = true;
    try {
      const saved = await renameAsset(item, value);
      item.asset.titel = saved;
      this.tree = buildTree(this.raw, { team: this.team });
      this._endRename(saved);
      // Detail und Player bleiben stehen, nur Spalten und Pfad tragen den neuen Namen.
      const ctx = this._ctx();
      this.pathEl.innerHTML = renderPath(ctx);
      this._renderColumns(ctx);
    } catch (err) {
      console.error('VideoBrowser: Titel speichern fehlgeschlagen', err);
      toast('error', 'Titel konnte nicht gespeichert werden.');
      if (this.renaming !== state) return;
      state.busy = false;
      state.input.disabled = false;
      state.input.focus();
    }
  }

  /* ---- Löschen ---- */

  async _deleteItem(button) {
    if (!this.canUpload || button.disabled) return;
    const { row, item } = resolveSelection(this.tree, this.sel);
    if (!row || !item) return;
    const kommentare = item.type === 'video' && !item.isFinal
      ? commentsForAsset(row.comments, item.runde, item.id).filter(c => c.assetId === item.id).length
      : 0;
    const hinweis = kommentare ? ` ${plural(kommentare, 'Kommentar', 'Kommentare')} zu dieser Datei werden ebenfalls entfernt.` : '';
    const { confirmed } = await confirmationModal.open({
      title: 'Datei löschen',
      message: `„${escapeHtml(item.name)}“ wird endgültig gelöscht, auch die Datei in Dropbox.${hinweis}`,
      confirmText: 'Löschen'
    });
    if (!confirmed || this.destroyed) return;

    button.disabled = true;
    try {
      await deleteAsset(item);
    } catch (err) {
      console.error('VideoBrowser: Löschen fehlgeschlagen', err);
      toast('error', 'Datei konnte nicht gelöscht werden.');
      button.disabled = false;
      return;
    }
    toast('success', 'Datei gelöscht.');
    if (this.destroyed) return;
    if (this.sel.itemId === item.id) {
      this.sel = clearFrom(this.sel, 3);
      syncUrl(this.sel);
    }
    try {
      await this.reload();
    } catch (err) {
      console.error('VideoBrowser: Aktualisieren nach Löschen fehlgeschlagen', err);
    }
  }

  /* ---- Kommentare ---- */

  async _submitComment(form) {
    if (!form || form.dataset.busy) return;
    const { koop, row, folder, item } = resolveSelection(this.tree, this.sel);
    if (!row || !folder || !item) return;
    const textEl = form.querySelector('[data-vb-comment-text]');
    const text = textEl.value.trim();
    if (!text) { textEl.focus(); return; }
    const pinned = form.querySelector('[data-vb-pin]')?.checked;
    const timecodeSec = pinned && this.player ? this.player.getTime() : null;

    form.dataset.busy = '1';
    const send = form.querySelector('[data-vb-comment-send]');
    if (send) send.disabled = true;
    try {
      const saved = await saveZeitkommentar({
        videoId: row.id,
        runde: folder.number,
        assetId: item.id,
        text,
        timecodeSec,
        isKunde: !this.team
      });
      this.raw.zeitkommentare = [...(this.raw.zeitkommentare || []), saved];
      this.tree = buildTree(this.raw, { team: this.team });
      delete this.drafts[item.id];
      textEl.value = '';

      const created = commentsForAsset(resolveSelection(this.tree, this.sel).row.comments, folder.number, item.id)
        .find(c => c.id === saved.id);
      const list = this.detailInner.querySelector('[data-vb-comments]');
      if (created && list) {
        this.detailInner.querySelector('[data-vb-comments-empty]')?.remove();
        list.insertAdjacentHTML('beforeend', commentHtml(created));
        const el = list.lastElementChild;
        const comments = commentsForAsset(resolveSelection(this.tree, this.sel).row.comments, folder.number, item.id);
        this.player?.setMarkers(comments);
        this.motion.commentIn(el, created.timecodeSec !== null ? this.player?.markerEl(created.id) : null);
        el.scrollIntoView?.({ block: 'nearest' });
      }
    } catch (err) {
      console.error('VideoBrowser: Kommentar speichern fehlgeschlagen', err);
      toast('error', 'Kommentar konnte nicht gespeichert werden.');
    } finally {
      delete form.dataset.busy;
      if (send) send.disabled = false;
    }
  }

  _highlightComment(commentId) {
    this.detailInner.querySelectorAll('.vb-comment.is-active').forEach(el => el.classList.remove('is-active'));
    const el = this.detailInner.querySelector(`.vb-comment[data-comment-id="${cssEscape(String(commentId))}"]`);
    el?.classList.add('is-active');
    el?.scrollIntoView?.({ block: 'nearest' });
  }

  /* ---- Upload ---- */

  _folderKey(resolved) {
    const { koop, row, folder } = resolved;
    if (!koop || !folder) return null;
    return folder.kind === 'raw' ? `${koop.id}:${folder.id}` : `${koop.id}:${row.id}:${folder.id}`;
  }

  _currentUploads(resolved) {
    const key = this._folderKey(resolved);
    return key ? (this.uploads.get(key) || []) : [];
  }

  _startUpload(files) {
    const { koop, row, folder } = resolveSelection(this.tree, this.sel);
    if (!files.length || !koop || !folder || !folder.upload || !this.canUpload) return;
    void this.uploader.start({ koop, row, folder, files });
  }

  _uploadsAdded(list) {
    if (this.destroyed || !list.length) return;
    const key = list[0].folderKey;
    this.uploads.set(key, [...list, ...(this.uploads.get(key) || [])]);
    if (key !== this._folderKey(resolveSelection(this.tree, this.sel))) return;
    const body = this.colsEl.querySelector('.vb-col--3 [data-vb-body]');
    if (!body) return;
    body.querySelector(':scope > .vb-empty')?.remove();
    let uploadList = body.querySelector(':scope > [data-vb-upload-list]');
    if (!uploadList) {
      uploadList = document.createElement('ul');
      uploadList.className = 'vb-rows';
      uploadList.setAttribute('data-vb-upload-list', '');
      body.prepend(uploadList);
    }
    uploadList.insertAdjacentHTML('afterbegin', list.map(uploadRowHtml).join(''));
    list.forEach((u, i) => {
      const el = body.querySelector(`[data-upload-id="${cssEscape(u.id)}"]`);
      this.motion.uploadRowIn(el, i);
    });
    body.scrollTop = 0;
  }

  _uploadChanged({ id, progress, error }) {
    if (this.destroyed) return;
    for (const list of this.uploads.values()) {
      const up = list.find(u => u.id === id);
      if (!up) continue;
      if (progress !== undefined) up.progress = progress;
      if (error !== undefined) up.error = error;
      const el = this.colsEl.querySelector(`[data-upload-id="${cssEscape(id)}"]`);
      if (!el) return;
      if (up.error) {
        el.outerHTML = uploadRowHtml(up);
      } else {
        const bar = el.querySelector('.upload-progress-bar');
        if (bar) bar.value = Math.round(up.progress * 100);
      }
      return;
    }
  }

  async _uploadSettled({ ok, folderKey }) {
    if (this.destroyed) return;
    try {
      await this.reload();
    } catch (err) {
      console.error('VideoBrowser: Aktualisieren nach Upload fehlgeschlagen', err);
    }
    if (this.destroyed) return;
    const list = (this.uploads.get(folderKey) || []).filter(u => u.error);
    if (list.length) this.uploads.set(folderKey, list);
    else this.uploads.delete(folderKey);
    if (ok || list.length === 0) this._render({ restoreFocus: false });
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
