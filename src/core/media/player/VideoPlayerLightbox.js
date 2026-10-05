import { MediaLightbox } from '../MediaLightbox.js';
import { ICON_DROPBOX } from '../mediaPlayerIcons.js';
import { toPreviewDropboxUrl } from '../../VideoUploadUtils.js';
import { prefetchStreamUrl } from '../mediaSrc.js';
import * as MediaCache from '../MediaCache.js';
import { PlayerSession } from './PlayerSession.js';
import { MediaItemBuilder } from './MediaItemBuilder.js';
import { VideoAssetLoader } from './VideoAssetLoader.js';
import { MediaPrefetcher } from './MediaPrefetcher.js';
import { VideoPlayerView } from './VideoPlayerView.js';
import { VideoPlaybackController } from './VideoPlaybackController.js';
import { VideoElementPool } from './VideoElementPool.js';
import { StageController } from './stage/StageController.js';
import { PromoteFinalControl } from './PromoteFinalControl.js';
import { bindPlayerEvents } from './VideoPlayerEvents.js';
import { loadCurrentItem } from './loadCurrentItem.js';
import { resolveCurrentMedia } from './resolveItemMedia.js';
import { downloadCurrentMedia } from './playerDownload.js';

// Finder-Listen fuer _open: erster Treffer gewinnt (spezifisch -> allgemein).
const videoFinders = (videoId, kooperationId) => [
  it => it.type === 'video' && it.video.id === videoId && it.koop.id === kooperationId,
  it => it.type === 'video' && it.video.id === videoId,
];

const storyFinders = (videoId, kooperationId) => [
  it => it.type === 'story' && it.video?.id === videoId && it.koop.id === kooperationId,
  it => it.type === 'story' && it.koop.id === kooperationId,
];

const bilderFinders = (videoId, kooperationId) => [
  ...(videoId ? [it => it.type === 'bild' && it.video?.id === videoId && it.koop.id === kooperationId] : []),
  // Fallback: nicht zugeordnete (Alt-)Bilder der Kooperation
  it => it.type === 'bild' && it.koop.id === kooperationId && !it.video,
  it => it.type === 'bild' && it.koop.id === kooperationId,
];

/**
 * Durchgaengiger Medien-Viewer fuer die Kampagnen-Tabelle (Orchestrator).
 * - Flache Item-Liste ueber ALLE gefilterten Kooperationen (siehe MediaItemBuilder):
 *   pro Video das Video + seine Storys, danach die Bilder der Koop.
 * - Prev/Next blaettert durchgaengig ueber alle Typen.
 *
 * Diese Klasse ist nur API + Lifecycle + Verdrahtung. Der Zustand liegt in der
 * PlayerSession, Auswahlregeln in selection/*, das Anzeigen der Quelle im
 * StageController, Rendering in der VideoPlayerView, DOM-Events in
 * VideoPlayerEvents, "Als final markieren" in PromoteFinalControl.
 */
export class VideoPlayerLightbox {
  constructor(table) {
    this.table = table;
    this.lightbox = new MediaLightbox();
    this.session = new PlayerSession(table);
    this._feedbackAbort = null;

    // Module
    this.itemBuilder = new MediaItemBuilder(table);
    this.assetLoader = new VideoAssetLoader();
    this.playback = new VideoPlaybackController();
    this.videoPool = new VideoElementPool();
    this.stage = new StageController(this);
    this.prefetcher = new MediaPrefetcher(this);
    this.view = new VideoPlayerView(this);
    this.promote = new PromoteFinalControl(this);
  }

  /** Aufgeloestes Medium { type, asset, lookup, key, label } des aktuellen Items. */
  currentMedia() {
    return resolveCurrentMedia(this.session, this.assetLoader);
  }

  // ---- Public Einstiegspunkte ----

  openVideo(videoId, kooperationId) {
    return this._open(videoFinders(videoId, kooperationId), kooperationId);
  }

  /** Oeffnet ein Video direkt in der finalen Version (optional eine bestimmte Variante). */
  openVideoFinal(videoId, kooperationId, assetId = null) {
    return this._open(videoFinders(videoId, kooperationId), kooperationId, { final: true, assetId: assetId || null });
  }

  openStillFinal(videoId, kooperationId, assetId = null) {
    return this._open(bilderFinders(videoId, kooperationId), kooperationId, { final: true, assetId: assetId || null });
  }

  openStory(videoId, kooperationId) {
    return this._open(storyFinders(videoId, kooperationId), kooperationId);
  }

  openBilder(videoId, kooperationId) {
    // Rueckwaertskompatibel: openBilder(kooperationId) ohne videoId
    if (kooperationId === undefined) {
      kooperationId = videoId;
      videoId = null;
    }
    return this._open(bilderFinders(videoId, kooperationId), kooperationId);
  }

  // ---- Lifecycle ----

  async _open(finders, kooperationId = null, intent = null) {
    const s = this.session;
    this.prefetcher.addPreconnect();
    await Promise.all([
      this.itemBuilder.ensureBilderLoaded(),
      this.itemBuilder.ensureStorySlotsLoaded(),
    ]);
    s.items = this.itemBuilder.build();

    let idx = -1;
    for (const f of finders) {
      idx = s.items.findIndex(f);
      if (idx >= 0) break;
    }
    // Niemals still auf items[0] (fremde Kooperation) springen. Wenn kein
    // passendes Medium gefunden wurde, auf die richtige Koop scopen; gibt es
    // dort gar nichts, leeren Zustand zeigen (index = -1 -> current === null).
    if (idx < 0 && kooperationId != null) {
      idx = s.items.findIndex(it => it.koop.id === kooperationId);
    }
    s.index = idx;
    s.resetItemState();
    s.intent = intent;

    // Warm-Start: Temp-Link des angeklickten Mediums sofort anfragen
    const lookup = this.currentMedia()?.lookup;
    if (lookup && (lookup.file_path || lookup.file_url)) prefetchStreamUrl(lookup);

    this.lightbox.open({
      className: 'video-player-lightbox media-split-lightbox',
      headerAction: {
        icon: ICON_DROPBOX,
        ariaLabel: 'Auf Dropbox ansehen',
        getHref: () => toPreviewDropboxUrl(this.currentMedia()?.lookup.file_url),
      },
      onPrev: () => this.navigate(-1),
      onNext: () => this.navigate(1),
      hasPrev: () => s.index > 0,
      hasNext: () => s.index >= 0 && s.index < s.items.length - 1,
      renderBody: () => this.view.renderBody(),
      onMount: (root) => bindPlayerEvents(root, this),
      onBeforeRerender: async () => {
        // Offenes Feedback verlustsicher speichern, BEVOR das Body-DOM (inkl.
        // Textarea) ersetzt wird -> Prev/Next/Variantenwechsel verlieren keinen
        // getippten Text und re-rendern erst mit frischem Store-Wert.
        await this.table?.feedbackSaveController?.flushAll();
        this.stage.park();
      },
      onClose: async () => {
        // Schliessen (X/Escape/Backdrop): offenes Feedback noch flushen.
        await this.table?.feedbackSaveController?.flushAll();
        this._feedbackAbort?.abort();
        this._feedbackAbort = null;
        MediaCache.unpin();
        this.prefetcher.cleanup();
        this.playback.unmount();
        this.videoPool.clear();
        this.stage.reset();
      },
    });

    // Feedback-Autosave/Flush einmal pro geoeffnetem Player an den Lightbox-Root
    // delegieren (gleiche Bindung wie die Tabelle, ueberlebt Body-Re-Renders).
    this._feedbackAbort?.abort();
    this._feedbackAbort = new AbortController();
    if (this.table?._feedbackBinding && this.lightbox.contentEl) {
      this.table._feedbackBinding.bind(this.lightbox.contentEl, this._feedbackAbort.signal);
    }

    await this.loadCurrent();
  }

  // ---- Navigation ----

  navigate(dir) {
    const s = this.session;
    if (s.index < 0) return;
    const next = s.index + dir;
    if (next < 0 || next >= s.items.length) return;
    s.index = next;
    s.resetItemState();
    this.loadCurrent();
  }

  /** Springt auf einen Item-Index (z. B. anderes Still) und laedt es. */
  jumpTo(index) {
    this.session.index = index;
    this.session.resetItemState();
    return this.loadCurrent();
  }

  loadCurrent() {
    return loadCurrentItem(this);
  }

  download() {
    downloadCurrentMedia(this.session, this.assetLoader);
  }
}
