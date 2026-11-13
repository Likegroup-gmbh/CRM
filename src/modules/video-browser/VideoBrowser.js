// VideoBrowser.js
// Controller des Videos-Tabs (Produktion → Videos): Spaltenbrowser mit vier Ebenen
// (Kooperation → Video/Story → Ordner → Datei), Pfadleiste, Detailbereich, Upload-Zone,
// Kommentare mit Timecode. Zweite Darstellung: Showcase (Grid der Finalen Versionen, videoBrowserShowcase.js),
// umschaltbar über "Ordner | Showcase" oben im Tab.
//
// Zustand: Auswahl (URL: ?k=&v=&f=&i=), Baum aus videoBrowserLogic.buildTree.
// Rechte nur über canFeature/Features (videoTeamSicht, mediaUpload, skriptKommentieren).
// Events, Kommentare, Titel, Aktionen und Uploads liegen in eigenen Modulen (videoBrowser*.js).

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { loadVideoBrowserData, saveWiedergabeMessung } from './VideoBrowserAdapter.js';
import { createMotion } from './videoBrowserMotion.js';
import { mountPlayer } from './VideoBrowserPlayer.js';
import { prefetchLinks, stopWarming, warmNeighbors } from './videoBrowserMedia.js';
import { prefetchPosters } from '../../core/media/PosterCache.js';
import { createUploader } from './VideoBrowserUpload.js';
import {
  EMPTY_SELECTION,
  SELECTION_KEYS,
  buildTree,
  commentsForAsset,
  cssEscape,
  ersterOffenerInhalt,
  koopGroupToSearch,
  resolveSelection,
  selectionEquals,
  selectionFromSearch,
  selectionToSearch,
  showcaseToSearch,
  validateSelection,
  withAutoItem
} from './videoBrowserLogic.js';
import { renderColumns, renderDetail, renderPath } from './videoBrowserRender.js';
import { finalBarHtml, headHtml, metaHtml } from './videoBrowserRenderItem.js';
import { tabsHtml } from './videoBrowserRenderTabs.js';
import { bindEvents } from './videoBrowserEvents.js';
import { initKoopState, koopGroupParam, revealKoop, scrollSelectedKoop } from './videoBrowserKoopState.js';
import { ladeFreieOrdner } from './videoBrowserAblage.js';
import { highlightComment, syncPinTime } from './videoBrowserComments.js';
import { syncCaptionClamp } from './videoBrowserCaption.js';
import { defaultTab, setDetailTab } from './videoBrowserTabs.js';
import { closeTagField, refreshTagField } from './videoBrowserTagField.js';
import { formatTime } from '../../core/media/mediaPlayerIcons.js';
import { currentUploads, uploadChanged, uploadSettled, uploadsAdded } from './videoBrowserUploadState.js';
import { bindLiveUpdates } from './videoBrowserLive.js';
import { rohZuruecksetzen } from './videoBrowserRoh.js';
import {
  destroyShowcase,
  initShowcaseState,
  mountShowcase,
  renderShowcase,
  setView,
  showcaseSectionHtml,
  showcaseToolbarHtml
} from './videoBrowserShowcase.js';

/** Spätestens dann werden die Nachbarn vorgewärmt, auch wenn das aktive Video noch lädt. */
const WARM_GATE_MS = 4000;

/**
 * Auswahl, Gruppierung der Spalte 0 und (bei offenem Showcase) dessen Einstellungen in die URL
 * spiegeln, fremde Parameter bleiben.
 */
function syncUrl(sel, showcase = null, koopGroup = null) {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const search = koopGroupToSearch(showcaseToSearch(selectionToSearch(window.location.search, sel), showcase), koopGroup);
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
    // Caption schreibt nur die Team-Sicht. Kunden sehen sie, die Denylist
    // im Kooperationstab sperrt dasselbe Feld für sie.
    this.canEditCaption = this.team;
    this.captionEdit = null;
    this.captionOpen = new Set();
    this.canComment = !!window.canFeature?.('skriptKommentieren');
    this.canDownload = !!window.canFeature?.('mediaDownload');
    this.raw = null;
    this.tree = { kooperationen: [] };
    this.sel = { ...EMPTY_SELECTION };
    this.drafts = {};
    this.uploads = new Map();
    this.player = null;
    this.renaming = null;
    this.renamingFile = null;
    this.focusPending = null;
    this.destroyed = false;
    this.cleanups = [];
    // Gewählter Tab im Detail gilt global, nicht je Datei
    this.detailTab = defaultTab(this.team);
    // Tag-Filter der Inhalte-Spalte: { folderId, value } oder null (gilt für einen Ordner)
    this.filter = null;
    // Spalte 0 bei Alle Linien: Gruppierung (creator | linie) und eingeklappte Gruppenköpfe
    this.koopGroup = 'creator';
    this.collapsed = new Set();
    // Rohmaterial (Team): eingeklappte Unterordner, markierte Dateien, offenes "Neuer Ordner"-Feld
    // ({ koopId, parent }) und das Ziel-Menü der Verschieben-Leiste (videoBrowserRoh.js)
    this.rohZu = new Set();
    this.rohAuswahl = new Set();
    this.rohNeu = null;
    this.rohMenu = false;
    // Letzte Position des Players, damit ein Teil-Render den Zeitstempel nicht auf 0 zurücksetzt
    this._lastTime = 0;
    this._shownKey = null;
    this.tagField = null;
    this.undoGen = 0;
  }

  /** Toast; mit `options.action = { label, onClick }` bekommt er eine Schaltfläche (z. B. Rückgängig). */
  toast(type, text, options) {
    if (options) window.toastSystem?.show?.(text, type, undefined, options);
    else window.toastSystem?.show?.(text, type);
  }

  /* ---- Lebenszyklus ---- */

  async mount() {
    await this._load();
    if (this.destroyed) return;

    if (!this.tree.kooperationen.length) {
      this._setLinienWidth(null);
      this.pane.innerHTML = renderEmptyState({
        icon: 'video',
        title: 'Keine Videos vorhanden',
        text: 'In diesem Bereich gibt es noch keine Kooperationen mit Videos.'
      });
      return;
    }

    this.sel = validateSelection(selectionFromSearch(window.location.search), this.tree);
    initKoopState(this);
    // Deep Link oder Reload: die gewählte Kooperation liegt nie in einer eingeklappten Gruppe
    revealKoop(this, this.sel.kooperationId);
    initShowcaseState(this);
    this._buildShell();
    this.motion = createMotion(this.root);
    mountShowcase(this);
    this.uploader = createUploader({
      onAdded: (list) => uploadsAdded(this, list),
      onChange: (patch) => uploadChanged(this, patch),
      onSettled: (info) => uploadSettled(this, info),
      toast: (type, text) => this.toast(type, text)
    });
    bindEvents(this);
    bindLiveUpdates(this);
    this._render({ fromDepth: 0, detailAnimate: true });
    this._fit();
    this._syncUrl();
    scrollSelectedKoop(this);
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this._warmTimer);
    this._warmGen = (this._warmGen || 0) + 1;
    stopWarming();
    this._destroyPlayer();
    this._captionRO?.disconnect();
    clearTimeout(this._captionSavedTimer);
    clearTimeout(this._captionCopiedTimer);
    destroyShowcase(this);
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

  async reload({ detailAnimate = false } = {}) {
    const before = this.sel;
    await this._load();
    if (this.destroyed) return;
    this.sel = validateSelection(before, this.tree);
    if (!selectionEquals(before, this.sel)) this._syncUrl();
    // Dieselbe Datei bleibt stehen: nur Kopf, Leiste und Tabs werden ersetzt, der Player läuft weiter
    this._render({ restoreFocus: false, patch: true, detailAnimate });
    if (this.view === 'showcase') renderShowcase(this);
  }

  /* ---- Gerüst ---- */

  _buildShell() {
    this.pane.innerHTML = `
      <div class="vb" data-vb data-vb-view="${this.view}">
        ${showcaseToolbarHtml(this)}
        <nav class="vb-path" data-vb-path aria-label="Pfad"></nav>
        <div class="vb-main">
          <div class="vb-cols" data-vb-cols></div>
          <section class="vb-detail" data-vb-detail aria-labelledby="vb-detail-heading" aria-live="polite">
            <h3 class="vb-visually-hidden" id="vb-detail-heading">Details</h3>
            <div class="vb-detail__inner" data-vb-detail-inner></div>
          </section>
        </div>
        ${showcaseSectionHtml(this)}
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
      canEditCaption: this.canEditCaption,
      captionOpen: this.captionOpen,
      canComment: this.canComment,
      canDownload: this.canDownload,
      drafts: this.drafts,
      detailTab: this.detailTab,
      filter: this.filter,
      tagCatalog: this.raw?.tagTypen || [],
      uploads: currentUploads(this, resolved),
      produktionTitel: this.detail.lineTitle || this.detail.produktion?.name || '',
      zeigeLinie: this._zeigeLinie(),
      koopGroup: this.koopGroup,
      collapsed: this.collapsed,
      roh: { zu: this.rohZu, auswahl: this.rohAuswahl, neu: this.rohNeu, menu: this.rohMenu },
      hatOffenes: !!ersterOffenerInhalt(this.tree)
    };
  }

  /** Mehrere Linien gleichzeitig sichtbar (Alle Linien): dann gibt es Gruppenköpfe in Spalte 0. */
  _zeigeLinie() {
    return !!(this.detail.linien?.length > 1 && this.detail.linieAlle);
  }

  /* ---- Rendern ---- */

  /**
   * @param {{ fromDepth?: number|null, detailAnimate?: boolean,
   *           cols?: boolean, detail?: boolean, restoreFocus?: boolean, patch?: boolean }} opts
   * fromDepth: ab dieser Spaltentiefe wird animiert (null = gar nicht).
   * patch: zeigt der Detailbereich schon diese Datei, werden nur seine Regionen ersetzt.
   */
  _render({ fromDepth = null, detailAnimate = false, cols = true, detail = true, restoreFocus = true, patch = false } = {}) {
    const ctx = this._ctx();

    this.pathEl.innerHTML = renderPath(ctx);
    if (cols) this._renderColumns(ctx, { fromDepth });
    if (detail) {
      if (patch && this._canPatch(ctx)) this._patchDetail(ctx);
      else this._renderDetail(ctx, { animate: detailAnimate });
    }
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
    prefetchPosters(candidates);
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
    // Im Showcase sind Pfadleiste und Spalten ausgeblendet (Breite 0): nichts messen
    if (this.view === 'showcase') {
      this.root.classList.remove('vb--path');
      this._setLinienWidth(null);
      return;
    }
    // offsetWidth statt scrollWidth: Einblend-Animationen verschieben Spalten per transform.
    const scrolls = !!this.colsEl
      && [...this.colsEl.children].reduce((sum, col) => sum + col.offsetWidth, 0) > this.colsEl.clientWidth + 1;
    this.root.classList.toggle('vb--path', scrolls);
    this._syncLinienWidth();
    this._syncKoopSegment();
  }

  /** Indikator des Umschalters Creator | Linie auf den aktiven Wert setzen (nach Render und Resize). */
  _syncKoopSegment() {
    const seg = this.colsEl?.querySelector('[data-vb-seg="koopgruppe"]');
    if (seg) this.motion?.tabIndicator(seg, { animate: false });
  }

  /**
   * Linien-Dropdown der Tab-Zeile endet bündig mit der ersten Spalte: seine Trennlinie liegt auf der
   * Spaltenkante darunter. Die Breite der Spalte ist flexibel, deshalb wird sie gemessen (CSS-Variable
   * `--vb-linie-w` an der Tab-Zeile, genutzt in video-browser.css).
   */
  _syncLinienWidth() {
    const bar = this._linienBar();
    if (!bar) return;
    const first = this.colsEl?.querySelector('.vb-col');
    if (!first) {
      this._setLinienWidth(null);
      return;
    }
    const offset = this.root.getBoundingClientRect().left - bar.getBoundingClientRect().left;
    this._setLinienWidth(first.offsetWidth + offset);
  }

  _linienBar() {
    return this.pane.closest('.kampagne-detail-body')?.querySelector('.kampagne-workflow-tabs') || null;
  }

  /**
   * null = keine Spalte, das Dropdown sieht aus wie in den anderen Tabs.
   * destroy() lässt den Wert bewusst stehen: beim nächsten Öffnen des Tabs hat das Dropdown
   * sofort die Spaltenbreite, statt bis zum Ende des Ladens anders auszusehen. Außerhalb des
   * Videos-Tabs greift er nicht (video-browser.css).
   */
  _setLinienWidth(px) {
    const bar = this._linienBar();
    if (!bar) return;
    if (px == null) {
      bar.style.removeProperty('--vb-linie-w');
      delete bar.dataset.vbLinie;
      return;
    }
    bar.style.setProperty('--vb-linie-w', `${px}px`);
    bar.dataset.vbLinie = '';
  }

  _renderColumns(ctx, { fromDepth = null } = {}) {
    const scrolls = new Map([...this.colsEl.querySelectorAll('.vb-col')].map(c => [c.dataset.depth, c.querySelector('[data-vb-body]')?.scrollTop || 0]));
    const badgesBefore = new Map([...this.colsEl.querySelectorAll('[data-badge-key]')].map(b => [b.dataset.badgeKey, b.textContent]));
    // Gruppenköpfe haben keine Auswahl, an der _applyFocus den Fokus wiederfinden könnte
    const focusedHead = document.activeElement?.closest?.('[data-vb-koopgroup]')?.dataset.vbKoopgroup;

    this.colsEl.innerHTML = renderColumns(ctx).join('');
    this._syncKoopSegment();
    if (focusedHead) this.colsEl.querySelector(`[data-vb-koopgroup="${cssEscape(focusedHead)}"]`)?.focus({ preventScroll: true });
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

  /** Stimmt die Datei im Detail mit der Auswahl überein (und läuft der Player), reicht ein Teil-Render. */
  _canPatch(ctx) {
    const { item } = ctx.resolved;
    return !!item && this._shownKey === item.id
      && !!this.detailInner.querySelector('[data-vb-region="head"]');
  }

  _renderDetail(ctx, { animate = false } = {}) {
    this._destroyPlayer();
    this._closeTagField();
    this.renaming = null;
    this.renamingFile = null;
    this.captionEdit = null;
    this.detailInner.innerHTML = renderDetail(ctx);
    syncCaptionClamp(this);
    void ladeFreieOrdner(this);

    const host = this.detailInner.querySelector('[data-vb-player-host]');
    const { row, item } = ctx.resolved;
    this._shownKey = item?.id || null;
    if (host && item) {
      const comments = item.type === 'video' && row ? commentsForAsset(row.comments, item.runde, item.id) : [];
      this._lastTime = 0;
      this.player = mountPlayer(host, {
        item,
        ratio: item.ratio,
        comments,
        motion: this.motion,
        onTime: (sec) => { this._lastTime = sec; syncPinTime(this, sec, item.id); },
        onMarker: (commentId) => {
          // Ein Klick auf einen Marker zeigt den Kommentar: erst in den Tab, dann hervorheben
          setDetailTab(this, 'kommentare');
          highlightComment(this, commentId);
        },
        onMessung: (messung) => saveWiedergabeMessung(messung, { team: this.team })
      });
      this._fillDuration();
    }

    if (animate) this.motion.detailIn(this.detailEl);
  }

  /**
   * Teil-Render: Kopf (ohne laufende Titelbearbeitung), Final-Leiste und Tabs werden ersetzt.
   * Die Vorschau bleibt unberührt, die Wiedergabe läuft weiter. Ein Textfeld mit Fokus im Tab
   * (Kommentar, Dateiname) wird nicht überschrieben.
   */
  _patchDetail(ctx) {
    const inner = this.detailInner;
    const { row, item } = ctx.resolved;
    const swap = (name, html) => {
      const el = inner.querySelector(`[data-vb-region="${name}"]`);
      if (el) el.innerHTML = html;
      return el;
    };

    if (this.renaming) swap('meta', metaHtml(ctx));
    else swap('head', headHtml(ctx));

    // Der Fokus bleibt auf dem Schalter, auch wenn sein Element neu entsteht
    const finalBefore = inner.querySelector('[data-vb-final-toggle]')?.getAttribute('aria-pressed');
    const finalRegion = inner.querySelector('[data-vb-region="final"]');
    const hadFocus = !!finalRegion && finalRegion.contains(document.activeElement);
    swap('final', finalBarHtml(ctx));
    const finalToggle = inner.querySelector('[data-vb-final-toggle]');
    if (hadFocus && finalToggle) finalToggle.focus({ preventScroll: true });
    if (finalToggle && finalBefore != null && finalBefore !== finalToggle.getAttribute('aria-pressed')) {
      this.motion.starPop(finalToggle.querySelector('[data-vb-final-star]'));
    }

    const active = document.activeElement;
    const typing = !!active && inner.contains(active) && /^(INPUT|TEXTAREA)$/.test(active.tagName)
      && !!active.closest('[data-vb-region="tabs"]');
    const tabs = inner.querySelector('[data-vb-region="tabs"]');
    if (tabs && typing) {
      const count = tabs.querySelector('[data-vb-tab-count]');
      if (count) count.textContent = String(commentsForAsset(row.comments, item.runde, item.id, item.type).length);
    } else if (tabs) {
      this._closeTagField();
      tabs.innerHTML = tabsHtml(ctx);
      syncCaptionClamp(this);
      syncPinTime(this, this._lastTime, item.id);
      this._fillDuration();
    }
    this.player?.setMarkers?.(item.type === 'video' ? commentsForAsset(row.comments, item.runde, item.id) : []);
  }

  /** Dauer aus dem Player in die Eigenschaftszeile schreiben, sobald die Datei sie kennt. */
  _fillDuration() {
    const fill = () => {
      if (this.destroyed) return;
      const dur = this.player?.getDuration?.();
      const el = this.detailInner?.querySelector('[data-vb-prop-duration]');
      if (el && dur > 0) el.textContent = formatTime(dur);
    };
    fill();
    this.player?.whenReady?.().then(fill);
  }

  _closeTagField() {
    closeTagField(this, { focus: false });
  }

  /** Chips und Auswahlliste des Tag-Feldes nach einer Änderung angleichen (ruft videoBrowserTags.js). */
  _refreshTagField() {
    refreshTagField(this);
  }

  _destroyPlayer() {
    this.player?.destroy();
    this.player = null;
  }

  /* ---- Auswahl ---- */

  _setSel(sel) {
    this.sel = sel;
    this._syncUrl();
  }

  _syncUrl() {
    syncUrl(this.sel, this.view === 'showcase' ? this.showcase : null, koopGroupParam(this, this._zeigeLinie()));
  }

  /** Showcase → Ordner, die Auswahl springt auf die Datei ("Im Ordner öffnen", nur Team). */
  _openInFolder(sel) {
    this.sel = validateSelection(sel, this.tree);
    setView(this, 'ordner');
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
    // Sprung auf eine andere Kooperation (z. B. aus dem Detail): ihre Gruppe öffnet sich
    const andereKoop = !!target.kooperationId && target.kooperationId !== this.sel.kooperationId;
    if (andereKoop) revealKoop(this, target.kooperationId);
    if ((target.kooperationId || null) !== (this.sel.kooperationId || null)) rohZuruecksetzen(this);
    this.focusPending = focus;
    this._setSel(target);
    this._render({ fromDepth: differing + 1, detailAnimate: true });
    if (andereKoop) scrollSelectedKoop(this);
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
    browser._setLinienWidth(null);
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
