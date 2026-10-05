// StageController
// Besitzt alles, was im Stage-Bereich (.media-viewer-stage) passiert: Quelle
// anzeigen, geparkte Video-Elemente wiederverwenden, Blob-Upgrade, Format-Hinweis
// und Fehler-Fallback. Haelt nur Stage-State (Token, aktiver Video-Key); die
// Quelle selbst liefert sourceResolver, der Anzeige-State liegt in der Session.
//
// host = VideoPlayerLightbox (Verdrahtung): session, lightbox, view, playback,
// videoPool, prefetcher, currentMedia(), download().

import * as MediaCache from '../../MediaCache.js';
import { perfLog, mediaLog } from '../../mediaPerf.js';
import { isRiskyFormat, lookupPath } from '../mediaIdentity.js';
import { cachedSource, networkSource, fillBlobCache } from './sourceResolver.js';
import { swapVideoSrc } from './swapVideoSrc.js';

export class StageController {
  constructor(host) {
    this.host = host;
    /** Zaehler fuer veraltete Aufloesungen (Navigation waehrend des Ladens). */
    this.token = 0;
    /** Key des aktuell sichtbaren, poolbaren Videos (fuers Offscreen-Parken). */
    this.activeVideoKey = null;
  }

  /** Das .media-viewer-stage-Element des offenen Players (oder null). */
  el() {
    return this.host.lightbox.contentEl?.querySelector('.media-viewer-stage') || null;
  }

  /** Beim Schliessen: Stage-State verwerfen. */
  reset() {
    this.activeVideoKey = null;
  }

  /** Erst-Mount (Lightbox-onMount): Hinweis, Fehler-Listener, Controls. */
  mount(root) {
    const stage = root.querySelector('.media-viewer-stage');
    this._bindStage(stage);
    this.host.playback.mount(stage);
  }

  /** Loest die Quelle des aktuellen Mediums auf und zeigt sie an. */
  async show() {
    const { session } = this.host;
    const token = ++this.token;
    const media = this.host.currentMedia();
    if (!media) return;

    const cached = cachedSource(media);
    if (cached) {
      session.src = cached.src;
      session.fallbackUrl = cached.fallbackUrl;
      session.loading = false;
      this.apply();
      cached.refreshLink().then(url => {
        if (url && token === this.token) session.fallbackUrl = url;
      });
      this._prefetchNeighbors();
      return;
    }

    const resolved = await networkSource(media);
    if (token !== this.token) return; // veraltet

    MediaCache.pin(media.key);
    session.src = resolved;
    session.fallbackUrl = resolved;
    session.loading = false;
    this.apply();
    perfLog('resolve', { hit: 'miss', key: media.key });

    // Sobald der Blob fertig ist, wird das laufende <video> darauf umgestellt ->
    // das (spaeter geparkte) Element haengt am Blob statt an der Dropbox-URL.
    fillBlobCache(media, resolved)?.then(blobUrl => {
      if (blobUrl && token === this.token) this._upgradeActiveToBlob(media.key, blobUrl);
    });

    this._prefetchNeighbors();
  }

  /** Rendert/holt das Stage-Innere fuer die aktuelle Session-Quelle. */
  apply() {
    const { session, lightbox, view, playback, videoPool } = this.host;
    if (!lightbox.isOpen()) return;
    const stage = this.el();
    if (!stage) return;

    const item = session.current;
    const media = this.host.currentMedia();
    const key = media?.key ?? null;
    const poolable = item?.type === 'video' && !!key && !isRiskyFormat(lookupPath(media.lookup));
    const label = media?.label ?? 'Medium';

    // Geparktes Video mit erhaltenem Puffer/Position wiederverwenden -> kein
    // Re-Download, Poster + gesehener Bereich sofort. Listener am Subtree sind
    // intakt; nur der document-gebundene Fullscreen-Listener muss neu.
    const parked = poolable ? videoPool.take(key) : null;
    if (parked) {
      stage.replaceChildren(...Array.from(parked.childNodes));
      playback.rearmFullscreen(stage);
      this.activeVideoKey = key;
      perfLog('pool-hit', { key });
      mediaLog(`"${label}" sofort aus Speicher wiederverwendet (kein Laden).`);
      // Falls inzwischen ein Blob bereitsteht, das geparkte Element aber noch an
      // der Dropbox-URL haengt: auf Blob umstellen (Position erhalten) -> kein
      // erneutes Netz-Laden beim Zurueckblaettern.
      const blobUrl = MediaCache.getObjectUrl(key);
      const video = stage.querySelector('.vpl-video');
      if (blobUrl && video && video.src !== blobUrl) {
        swapVideoSrc(video, blobUrl);
        perfLog('blob-upgrade', { key, via: 'pool' });
      }
      return;
    }

    stage.innerHTML = view.renderStageInner();
    this._bindStage(stage);
    // Altes Stage-Video wurde durch innerHTML ersetzt -> document-Listener
    // des vorherigen Mounts entbinden, bevor neu gemountet wird.
    playback.unmount();
    playback.mount(stage);
    this.activeVideoKey = poolable ? key : null;

    if (item?.type === 'video') {
      if (session.src && session.src.startsWith('blob:')) {
        mediaLog(`"${label}" sofort aus Cache (kein Netz).`);
      } else if (poolable) {
        mediaLog(`"${label}" wird vom Netz geladen (noch nicht im Cache - wird jetzt gecached).`);
      } else {
        mediaLog(`"${label}" wird vom Netz geladen (Format wird nicht gecached - bleibt langsam).`);
      }
    }
  }

  /**
   * Rettet das aktuell sichtbare Stage-Video (mit Puffer/Position/Listenern) in
   * den Offscreen-Pool, bevor der Body neu gerendert wird. No-op, wenn das
   * aktuelle Medium kein cachebares Video war (activeVideoKey === null).
   */
  park() {
    const key = this.activeVideoKey;
    if (!key) return;
    this.activeVideoKey = null;
    const stage = this.el();
    const video = stage?.querySelector('.vpl-video');
    if (!video) return;
    try { video.pause(); } catch (_) { /* still */ }
    const wrapper = document.createElement('div');
    wrapper.append(...Array.from(stage.childNodes));
    this.host.videoPool.park(key, wrapper);
  }

  /** Format-Hinweis ausblenden (X-Button oder sobald das Video spielt). */
  bindFormatHint(stage) {
    const hint = stage?.querySelector('.vpl-format-hint');
    if (!hint) return;
    const hide = () => hint.classList.add('is-hidden');
    hint.querySelector('.vpl-format-hint-close')?.addEventListener('click', hide);
    const video = stage.querySelector('.vpl-video');
    if (!video) return;
    if (!video.paused || video.currentTime > 0) hide();
    else video.addEventListener('playing', hide, { once: true });
  }

  /** Fallback-Ansicht, wenn das Video-Element einen Fehler wirft (Codec/Container). */
  onVideoError() {
    const stage = this.el();
    if (!stage) return;
    const { session, view } = this.host;
    const link = session.fallbackUrl || session.src;
    stage.innerHTML = view.renderUnplayable(link);
    const dl = stage.querySelector('.vpl-fallback-download');
    if (dl) dl.addEventListener('click', () => this.host.download());
  }

  /** Hinweis + Fehler-Listener an ein frisch gerendertes Stage-Innere binden. */
  _bindStage(stage) {
    this.bindFormatHint(stage);
    const video = stage?.querySelector('video');
    if (video) video.addEventListener('error', () => this.onVideoError(), { once: true });
  }

  /**
   * Stellt das aktuell sichtbare Stage-Video auf die fertige Blob-URL um, ohne
   * Position/Play-Status zu verlieren. Dropbox-Stream-URLs (max-age=60) wuerden
   * beim Parken/Reattach den Puffer verlieren und neu laden – der Blob nicht.
   */
  _upgradeActiveToBlob(key, blobUrl) {
    if (!this.host.lightbox.isOpen() || this.activeVideoKey !== key) return;
    const video = this.el()?.querySelector('.vpl-video');
    if (!video || video.src === blobUrl) return;

    this.host.session.src = blobUrl;
    swapVideoSrc(video, blobUrl, { resume: true });
    perfLog('blob-upgrade', { key });
  }

  _prefetchNeighbors() {
    const { prefetcher } = this.host;
    prefetcher.prefetchNeighborAssets();
    prefetcher.scheduleNeighborPrefetch();
  }
}
