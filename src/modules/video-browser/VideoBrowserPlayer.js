// VideoBrowserPlayer.js
// Vorschau-Player des Videos-Tabs: Rahmen im Seitenverhältnis, Zeitleiste mit
// Kommentar-Markern, Play/Pause, Lautstärke, Geschwindigkeit und Bild-Schritt für die
// Review-Arbeit. Ohne auflösbare Datei läuft ein Platzhalter (A7-Fallback über GSAP).
// Standbilder werden nur angezeigt.
//
// Der Zustand liegt in einem Objekt `p`, das die Teilmodule in ./player/ bekommen:
// playerLayout (Anzeige, Vollbild), playerControls (Steuerung), playerSource (Quelle laden),
// playerEvents (Maus und Tastatur).

import { icon } from '../../core/icons/IconSystem.js';
import { ICON_PLAY, ICON_FS, ICON_VOLUME } from '../../core/media/mediaPlayerIcons.js';
import { cssEscape } from './videoBrowserLogic.js';
import { applySize, isFullscreen, onFullscreenChange, paintPlaying, paintTime, renderMarkers } from './player/playerLayout.js';
import { DEFAULT_FRAME_SEC, paintControls, pause, play, seek } from './player/playerControls.js';
import { finishMessung, loadSource } from './player/playerSource.js';
import { bindPlayerEvents } from './player/playerEvents.js';

function shell(isStill) {
  return `
    <figure class="vb-player${isStill ? ' vb-player--still' : ''}" tabindex="-1">
      <div class="vb-player__stage" data-vb-stage>
        <div class="vb-player__frame" data-vb-frame>
          <div class="vb-player__media" data-vb-media></div>
          ${isStill ? '' : `<button type="button" class="vb-player__big" data-vb-play aria-label="Abspielen">${ICON_PLAY}</button>`}
          <button type="button" class="vb-player__fs" data-vb-fs aria-label="Vollbild" title="Vollbild (F)">${ICON_FS}</button>
        </div>
      </div>
      ${isStill ? '' : `
      <div class="vb-timeline">
        <button type="button" class="vb-timeline__play" data-vb-play aria-label="Abspielen">${ICON_PLAY}</button>
        <span class="vb-timeline__time" data-vb-time>0:00 / 0:00</span>
        <div class="vb-timeline__track" data-vb-track>
          <input class="vpl-seek vb-timeline__seek" data-vb-slider type="range" min="0" max="0" step="0.1" value="0" aria-label="Wiedergabeposition" />
          <div class="vb-timeline__markers" data-vb-markers></div>
        </div>
      </div>
      <div class="vb-controls">
        <button type="button" class="vb-ctl" data-vb-frame="-1" aria-label="Ein Bild zurück" title="Ein Bild zurück (,)">${icon('chevron-left')}</button>
        <button type="button" class="vb-ctl" data-vb-frame="1" aria-label="Ein Bild vor" title="Ein Bild vor (.)">${icon('chevron-right')}</button>
        <button type="button" class="vb-ctl vb-ctl--text" data-vb-speed title="Wiedergabegeschwindigkeit">1×</button>
        <span class="vb-controls__spacer"></span>
        <button type="button" class="vb-ctl" data-vb-mute title="Ton an/aus (M)">${ICON_VOLUME}</button>
        <input class="vb-volume" type="range" min="0" max="1" step="0.05" value="1" data-vb-volume aria-label="Lautstärke" />
      </div>`}
    </figure>`;
}

const withTimecode = (list) => list.filter(c => c.timecodeSec !== null && c.timecodeSec !== undefined);

/**
 * @param {HTMLElement} host
 * @param {{ item: object, ratio?: string, comments?: Array, motion?: object,
 *           onTime?: (sec: number) => void, onMarker?: (commentId: string) => void,
 *           onMessung?: (row: object) => void, autoplay?: boolean, maxHeight?: () => number }} options
 *        onMessung: eine Zeile je Wiedergabe (erstes Bild, Start, Stalls), beim Quellwechsel und Schließen
 *        autoplay: startet stumm, sobald die Datei bereit ist (Showcase-Vollansicht)
 *        maxHeight: Obergrenze der Rahmenhöhe statt der Standardhöhe des Detailbereichs
 */
export function mountPlayer(host, { item, ratio, comments = [], motion = null, onTime = null, onMarker = null, onMessung = null, autoplay = false, maxHeight = null }) {
  const isStill = item.type === 'still';
  host.innerHTML = shell(isStill);

  const p = {
    host,
    isStill,
    motion,
    onTime,
    onMarker,
    onMessung,
    root: host.querySelector('.vb-player'),
    stage: host.querySelector('[data-vb-stage]'),
    frame: host.querySelector('[data-vb-frame]'),
    mediaHost: host.querySelector('[data-vb-media]'),
    playButtons: [...host.querySelectorAll('[data-vb-play]')],
    timeEl: host.querySelector('[data-vb-time]'),
    slider: host.querySelector('[data-vb-slider]'),
    markersEl: host.querySelector('[data-vb-markers]'),
    fsButton: host.querySelector('[data-vb-fs]'),
    speedButton: host.querySelector('[data-vb-speed]'),
    muteButton: host.querySelector('[data-vb-mute]'),
    volumeInput: host.querySelector('[data-vb-volume]'),
    destroyed: false,
    rate: 1,
    volume: 1,
    muted: !!autoplay,
    maxHeight,
    frameSec: DEFAULT_FRAME_SEC,
    currentRatio: ratio || item.ratio || '9:16',
    dims: null,
    video: null,
    simulated: null,
    simTween: null,
    duration: 0,
    time: 0,
    playing: false,
    markers: withTimecode(comments),
    loadToken: 0,
    messung: null,
    ready: Promise.resolve(),
    markReady: () => {}
  };

  applySize(p, false);
  const resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => { if (!p.destroyed) applySize(p, false); })
    : null;
  resizeObserver?.observe(host);
  const onWindowResize = () => { if (!p.destroyed) applySize(p, false); };
  window.addEventListener('resize', onWindowResize);
  const onFsChange = () => onFullscreenChange(p);
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  const unbindEvents = bindPlayerEvents(p);

  paintControls(p);
  paintPlaying(p);
  loadSource(p, item, { resumePlay: !!autoplay && !isStill });

  return {
    seek: (sec) => seek(p, sec),
    getTime: () => p.time,
    isPlaying: () => p.playing,
    pause: () => pause(p),
    play: () => play(p),
    /** Resolved, sobald die aktuelle Quelle durchspielbar ist oder nicht lädt. */
    whenReady: () => p.ready,
    /** Pixelmaße der geladenen Datei, `null` solange die Metadaten fehlen. */
    getDimensions: () => p.dims,
    /** Dauer in Sekunden, 0 solange die Metadaten fehlen. */
    getDuration: () => p.duration || 0,
    setMarkers(list) {
      p.markers = withTimecode(list);
      renderMarkers(p);
      paintTime(p);
    },
    markerEl: (commentId) => p.markersEl?.querySelector(`.vb-marker[data-comment-id="${cssEscape(String(commentId))}"]`) || null,
    destroy() {
      p.destroyed = true;
      finishMessung(p);
      resizeObserver?.disconnect();
      if (isFullscreen(p)) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      unbindEvents();
      p.simTween?.kill();
      if (p.video) { p.video.pause(); p.video.removeAttribute('src'); p.video.load(); }
      window.removeEventListener('resize', onWindowResize);
      host.innerHTML = '';
    }
  };
}
