// VideoBrowserPlayer.js
// Vorschau-Player des Videos-Tabs: Rahmen im Seitenverhältnis, Zeitleiste mit
// Kommentar-Markern, Play/Pause, Lautstärke, Geschwindigkeit und Bild-Schritt für die
// Review-Arbeit. Ohne auflösbare Datei läuft ein Platzhalter (A7-Fallback über GSAP).
// Standbilder werden nur angezeigt.
//
// Tasten (Fokus im Player): Leertaste Play/Pause, F Vollbild, M Ton,
// , und . ein Bild zurück/vor (auch Shift + Pfeil), Pfeil = 5 s.

import { escapeHtml as esc } from '../../core/format.js';
import { icon } from '../../core/icons/IconSystem.js';
import { cachedUrl, dropVorschauLink, mediaOf, resolveSource } from './videoBrowserMedia.js';
import { ICON_PLAY, ICON_PAUSE, ICON_FS, ICON_FS_EXIT, ICON_VOLUME, ICON_MUTE, formatTime } from '../../core/media/mediaPlayerIcons.js';
import { createWiedergabeMessung, formatOf, perfNow } from '../../core/media/mediaPerf.js';
import { lookupPath } from '../../core/media/player/mediaIdentity.js';
import { cssEscape, fitFrame, markerNah, markerProzent } from './videoBrowserLogic.js';

const MIN_H = 320;
const MAX_H = 560;
const FALLBACK_SEC = 30;
const SEEK_STEP = 5;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
// HTML5-Video kennt keine Bildrate: Startwert, wird beim Abspielen aus den Frames gemessen.
const DEFAULT_FRAME_SEC = 1 / 30;

/** Maximale Höhe der Vorschau: wächst mit dem Fenster, damit hohe Monitore nicht leer bleiben. */
const maxFrameHeight = () => Math.max(MIN_H, Math.min(MAX_H, Math.round(window.innerHeight * 0.55)));
const speedLabel = (rate) => `${String(rate).replace('.', ',')}×`;

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

/**
 * @param {HTMLElement} host
 * @param {{ item: object, ratio?: string, comments?: Array, motion?: object,
 *           onTime?: (sec: number) => void, onMarker?: (commentId: string) => void,
 *           onMessung?: (row: object) => void }} options
 *        onMessung: eine Zeile je Wiedergabe (erstes Bild, Start, Stalls), beim Quellwechsel und Schließen
 */
export function mountPlayer(host, { item, ratio, comments = [], motion = null, onTime = null, onMarker = null, onMessung = null }) {
  const isStill = item.type === 'still';
  host.innerHTML = shell(isStill);

  const root = host.querySelector('.vb-player');
  const stage = host.querySelector('[data-vb-stage]');
  const frame = host.querySelector('[data-vb-frame]');
  const mediaHost = host.querySelector('[data-vb-media]');
  const playButtons = [...host.querySelectorAll('[data-vb-play]')];
  const timeEl = host.querySelector('[data-vb-time]');
  const slider = host.querySelector('[data-vb-slider]');
  const markersEl = host.querySelector('[data-vb-markers]');
  const fsButton = host.querySelector('[data-vb-fs]');
  const speedButton = host.querySelector('[data-vb-speed]');
  const muteButton = host.querySelector('[data-vb-mute]');
  const volumeInput = host.querySelector('[data-vb-volume]');

  let destroyed = false;
  let rate = 1;
  let volume = 1;
  let muted = false;
  let frameSec = DEFAULT_FRAME_SEC;
  let currentRatio = ratio || item.ratio || '9:16';
  let video = null;
  let simulated = null;
  let simTween = null;
  let duration = 0;
  let time = 0;
  let playing = false;
  let markers = comments.filter(c => c.timecodeSec !== null && c.timecodeSec !== undefined);
  let currentAsset = item;
  let loadToken = 0;
  let messung = null;

  function finishMessung() {
    const row = messung?.finish();
    messung = null;
    if (row) onMessung?.(row);
  }

  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const isFullscreen = () => fsEl() === root;

  // Der Player schrumpft auf die Breite des Rahmens (kein dunkler Rand links und rechts).
  // Die verfügbare Breite kommt deshalb vom Host, nicht von der Bühne, die dem Rahmen folgt.
  // Im Vollbild füllt die Bühne den Bildschirm, sonst gilt die Maximalhöhe.
  const size = () => {
    const full = isFullscreen();
    const maxW = Math.max(120, full ? stage.clientWidth : host.clientWidth);
    const maxH = full ? Math.max(120, stage.clientHeight) : maxFrameHeight();
    return fitFrame(currentRatio, maxW, maxH);
  };
  const applySize = (animate) => {
    const next = size();
    if (motion) motion.frameTo(frame, next, { animate });
    else { frame.style.width = `${next.w}px`; frame.style.height = `${next.h}px`; }
  };
  applySize(false);

  const resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => { if (!destroyed) applySize(false); })
    : null;
  resizeObserver?.observe(host);
  const onWindowResize = () => { if (!destroyed) applySize(false); };
  window.addEventListener('resize', onWindowResize);

  /* ---- Anzeige ---- */

  function paintTime() {
    if (!timeEl) return;
    timeEl.textContent = `${formatTime(time)} / ${formatTime(duration)}`;
    slider.max = String(duration || 0);
    slider.value = String(time);
    slider.style.setProperty('--p', `${markerProzent(time, duration)}%`);
    slider.setAttribute('aria-valuetext', `${formatTime(time)} von ${formatTime(duration)}`);
    markersEl?.querySelectorAll('.vb-marker').forEach((m) => {
      m.classList.toggle('is-near', markerNah(Number(m.dataset.seek), time));
    });
    onTime?.(time);
  }

  function paintPlaying() {
    playButtons.forEach((b) => {
      b.setAttribute('aria-label', playing ? 'Pausieren' : 'Abspielen');
      b.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    });
    root.classList.toggle('is-playing', playing);
    const big = host.querySelector('.vb-player__big');
    if (motion) motion.playButton(big, playing);
  }

  function renderMarkers() {
    if (!markersEl) return;
    markersEl.innerHTML = markers.map((c) => `
      <button type="button" class="vb-marker" style="left: ${markerProzent(c.timecodeSec, duration)}%" data-seek="${c.timecodeSec}" data-comment-id="${esc(c.id)}" aria-label="Kommentar bei ${formatTime(c.timecodeSec)}: ${esc(c.text).slice(0, 80)}" title="${formatTime(c.timecodeSec)} · ${esc(c.text).slice(0, 80)}"></button>`).join('');
  }

  /* ---- Steuerung ---- */

  function seek(sec) {
    const target = Math.max(0, Math.min(duration || sec, sec));
    time = target;
    if (video) video.currentTime = target;
    if (simulated) {
      simulated.t = target;
      if (playing) startSimulation();
    }
    paintTime();
  }

  function startSimulation() {
    simTween?.kill();
    simTween = motion?.simulate(simulated, {
      duration,
      onUpdate: () => { time = simulated.t; paintTime(); },
      onComplete: () => { playing = false; paintPlaying(); }
    });
  }

  function play() {
    if (isStill) return;
    if (video) {
      video.play().catch(() => { /* Autoplay-Block: Nutzer klickt erneut */ });
    } else if (simulated) {
      if (time >= duration) { time = 0; simulated.t = 0; }
      playing = true;
      startSimulation();
      paintPlaying();
    }
  }

  function pause() {
    if (video) video.pause();
    else if (simulated) {
      simTween?.kill();
      playing = false;
      paintPlaying();
    }
  }

  const toggle = () => (playing ? pause() : play());

  /* ---- Review-Werkzeuge: Bild-Schritt, Geschwindigkeit, Ton ---- */

  function applyMedia() {
    if (!video) return;
    video.playbackRate = rate;
    video.volume = volume;
    video.muted = muted;
  }

  function paintControls() {
    if (!speedButton) return;
    speedButton.textContent = speedLabel(rate);
    speedButton.setAttribute('aria-label', `Wiedergabegeschwindigkeit ${speedLabel(rate)}, Klick wechselt`);
    const silent = muted || volume === 0;
    muteButton.innerHTML = silent ? ICON_MUTE : ICON_VOLUME;
    muteButton.setAttribute('aria-label', silent ? 'Ton einschalten' : 'Ton ausschalten');
    volumeInput.value = String(silent ? 0 : volume);
  }

  function cycleSpeed() {
    rate = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
    applyMedia();
    paintControls();
  }

  function toggleMute() {
    muted = !muted;
    if (!muted && volume === 0) volume = 0.5;
    applyMedia();
    paintControls();
  }

  function setVolume(value) {
    volume = Math.max(0, Math.min(1, value));
    muted = volume === 0;
    applyMedia();
    paintControls();
  }

  /** Ein Bild vor oder zurück (dir = ±1). Hält an und landet in der Mitte des Ziel-Frames. */
  function stepFrame(dir) {
    if (isStill) return;
    pause();
    const index = Math.floor(time / frameSec + 0.001) + dir;
    seek(Math.max(0, index * frameSec + frameSec / 2));
  }

  /** Bildrate aus den tatsächlich gezeigten Frames messen (nur wo der Browser es kann). */
  function probeFrameRate(v) {
    if (typeof v.requestVideoFrameCallback !== 'function') return;
    let last = null;
    let samples = 0;
    let best = Infinity;
    const tick = (_now, meta) => {
      if (destroyed || v !== video) return;
      if (last !== null) {
        const delta = meta.mediaTime - last;
        // Sprünge (Seek) und Doppelmeldungen fallen durch die Grenzen, der kleinste Abstand ist ein Bild.
        if (delta > 0.004 && delta < 0.2) { best = Math.min(best, delta); samples += 1; }
      }
      last = meta.mediaTime;
      if (samples >= 12) { frameSec = best; return; }
      v.requestVideoFrameCallback(tick);
    };
    v.requestVideoFrameCallback(tick);
  }

  /* ---- Vollbild ---- */

  function toggleFullscreen() {
    if (isFullscreen()) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return;
    }
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!request) return;
    const result = request.call(root);
    result?.catch?.(() => { /* Browser verweigert Vollbild: Vorschau bleibt wie sie ist */ });
  }

  function onFullscreenChange() {
    if (destroyed) return;
    const fs = isFullscreen();
    root.classList.toggle('is-fullscreen', fs);
    fsButton.innerHTML = fs ? ICON_FS_EXIT : ICON_FS;
    fsButton.setAttribute('aria-label', fs ? 'Vollbild beenden' : 'Vollbild');
    fsButton.title = fs ? 'Vollbild beenden (Esc)' : 'Vollbild (F)';
    applySize(false);
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  /* ---- Quelle ---- */

  // Gate für das Vorwärmen der Nachbarn: erst wenn die aktive Quelle durchspielbar ist
  // (oder fehlgeschlagen), damit sie die Bandbreite nicht teilen muss.
  let markReady = () => {};
  let ready = Promise.resolve();
  function resetReady() {
    ready = new Promise((resolve) => { markReady = resolve; });
  }

  /**
   * @param {object} asset
   * @param {{ resumeAt?: number, resumePlay?: boolean, original?: boolean }} [opts]
   *        original: Vorschaudatei überspringen (sie ließ sich nicht abspielen)
   */
  async function loadSource(asset, { resumeAt = 0, resumePlay = false, original = false } = {}) {
    const token = ++loadToken;
    const t0 = perfNow();
    currentAsset = asset;
    finishMessung();
    resetReady();
    // Blob aus dem Cache steht sofort bereit, sonst Vorschaudatei oder Original. Die Quelle
    // bleibt bis zum nächsten Laden fest: wird die Vorschau während der Wiedergabe fertig,
    // gilt sie erst beim nächsten Öffnen (kein Wechsel der src mitten im Satz).
    const cached = cachedUrl(asset);
    if (!cached) frame.classList.add('is-loading');
    const src = cached
      ? { url: cached, quelle: 'blob' }
      : await resolveSource(asset, { original }).catch(() => ({ url: null, quelle: 'original' }));
    const url = src.url;
    if (destroyed || token !== loadToken) return;

    video?.pause();
    simTween?.kill();
    simulated = null;
    video = null;
    mediaHost.innerHTML = '';

    if (isStill) {
      if (url) {
        const img = document.createElement('img');
        img.className = 'vb-player__img';
        img.alt = asset.name || 'Standbild';
        img.addEventListener('load', () => { frame.classList.remove('is-loading'); markReady(); }, { once: true });
        img.addEventListener('error', () => { frame.classList.remove('is-loading'); markReady(); }, { once: true });
        img.src = url;
        mediaHost.appendChild(img);
      } else {
        frame.classList.remove('is-loading');
        mediaHost.innerHTML = '<p class="vb-player__placeholder">Keine Vorschau verfügbar</p>';
        markReady();
      }
      return;
    }

    const media = mediaOf(asset);
    messung = createWiedergabeMessung({
      quelle: src.quelle,
      format: formatOf(lookupPath(media.lookup)),
      assetId: media.record.id || null,
      t0
    });

    if (!url) {
      messung.markFehler();
      finishMessung();
      markReady();
      frame.classList.remove('is-loading');
      simulated = { t: resumeAt };
      duration = FALLBACK_SEC;
      time = resumeAt;
      mediaHost.innerHTML = '<p class="vb-player__placeholder">Vorschau nicht verfügbar</p>';
      renderMarkers();
      paintTime();
      paintPlaying();
      return;
    }

    const el = document.createElement('video');
    video = el;
    messung.attach(el);
    el.className = 'vb-player__video';
    el.playsInline = true;
    // Wie im Medien-Player: komplett vorladen und per #t auf das erste Bild springen, damit
    // die Vorschau ohne Play sichtbar ist. 0,001 s statt 0,1 s, sonst zählt das als bewegter Playhead.
    el.preload = 'auto';
    el.src = `${url}${url.includes('#') ? '' : '#t=0.001'}`;
    applyMedia();
    probeFrameRate(el);
    el.addEventListener('loadedmetadata', () => {
      if (destroyed || token !== loadToken) return;
      duration = el.duration || 0;
      if (resumeAt) el.currentTime = Math.min(resumeAt, duration);
      renderMarkers();
      paintTime();
      if (resumePlay) play();
    }, { once: true });
    el.addEventListener('loadeddata', () => frame.classList.remove('is-loading'));
    el.addEventListener('canplaythrough', () => markReady(), { once: true });
    el.addEventListener('timeupdate', () => { time = el.currentTime; paintTime(); });
    el.addEventListener('play', () => { playing = true; paintPlaying(); });
    el.addEventListener('pause', () => { playing = false; paintPlaying(); });
    el.addEventListener('ended', () => { playing = false; paintPlaying(); });
    el.addEventListener('error', () => {
      if (src.quelle === 'vorschau' && !destroyed && token === loadToken) {
        // Vorschau nicht abspielbar (Token abgelaufen, beim Anbieter gelöscht): einmal aufs
        // Original zurück, an derselben Stelle.
        dropVorschauLink(asset);
        loadSource(asset, { resumeAt: el.currentTime || resumeAt, resumePlay: playing || resumePlay, original: true });
        return;
      }
      markReady();
      frame.classList.remove('is-loading');
      mediaHost.innerHTML = '<p class="vb-player__placeholder">Die Datei kann nicht abgespielt werden.</p>';
    });
    mediaHost.appendChild(video);
  }

  /* ---- Events ---- */

  const onClick = (e) => {
    if (e.target.closest('[data-vb-play]')) { toggle(); return; }
    if (e.target.closest('[data-vb-fs]')) { toggleFullscreen(); return; }
    const frameBtn = e.target.closest('[data-vb-frame]');
    if (frameBtn) { stepFrame(Number(frameBtn.dataset.vbFrame)); return; }
    if (e.target.closest('[data-vb-speed]')) { cycleSpeed(); return; }
    if (e.target.closest('[data-vb-mute]')) { toggleMute(); return; }
    const marker = e.target.closest('.vb-marker');
    if (marker) {
      e.stopPropagation();
      seek(Number(marker.dataset.seek));
      onMarker?.(marker.dataset.commentId);
      return;
    }
    if (e.target.closest('[data-vb-media]') && !isStill) toggle();
  };

  // Ziehen und Klicken auf den Regler erledigt das native Range-Input.
  const onSeekInput = () => seek(Number(slider.value));
  const onVolumeInput = () => setVolume(Number(volumeInput.value));

  const onDblClick = (e) => {
    if (e.target.closest('[data-vb-media]')) toggleFullscreen();
  };

  const onKey = (e) => {
    if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey
      && !e.target.closest('textarea, input:not([type="range"])')) {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
    if (isStill) return;
    const typing = e.target.closest('textarea, input:not([type="range"])');
    if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.key === ',') { e.preventDefault(); stepFrame(-1); return; }
      if (e.key === '.') { e.preventDefault(); stepFrame(1); return; }
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMute(); return; }
    }
    if (e.target === slider) {
      // Native Schrittweite (0,1 s) ist für die Tastatur zu fein: eigene Sprünge, mit Shift ein Bild.
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (dir) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) stepFrame(dir);
        else seek(time + dir * SEEK_STEP);
      } else if (e.key === ' ') { e.preventDefault(); toggle(); }
      return;
    }
    if (e.target.closest('textarea, input')) return;
    if (e.key === ' ' && e.target.closest('.vb-player')) { e.preventDefault(); toggle(); }
  };

  host.addEventListener('click', onClick);
  host.addEventListener('keydown', onKey);
  host.addEventListener('dblclick', onDblClick);
  slider?.addEventListener('input', onSeekInput);
  volumeInput?.addEventListener('input', onVolumeInput);

  paintControls();
  paintPlaying();
  loadSource(item);

  return {
    seek,
    getTime: () => time,
    isPlaying: () => playing,
    pause,
    /** Resolved, sobald die aktuelle Quelle durchspielbar ist oder nicht lädt. */
    whenReady: () => ready,
    /** Seitenverhältnis wechseln. Mit `asset`: eigene Datei laden und Position halten. */
    setRatio(nextRatio, { asset = null } = {}) {
      currentRatio = nextRatio;
      applySize(true);
      if (asset) {
        motion?.crossfade(mediaHost);
        loadSource(asset, { resumeAt: time, resumePlay: playing });
      }
    },
    setMarkers(list) {
      markers = list.filter(c => c.timecodeSec !== null && c.timecodeSec !== undefined);
      renderMarkers();
      paintTime();
    },
    markerEl: (commentId) => markersEl?.querySelector(`.vb-marker[data-comment-id="${cssEscape(String(commentId))}"]`) || null,
    destroy() {
      destroyed = true;
      finishMessung();
      resizeObserver?.disconnect();
      if (isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      host.removeEventListener('dblclick', onDblClick);
      simTween?.kill();
      if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
      host.removeEventListener('click', onClick);
      host.removeEventListener('keydown', onKey);
      slider?.removeEventListener('input', onSeekInput);
      volumeInput?.removeEventListener('input', onVolumeInput);
      window.removeEventListener('resize', onWindowResize);
      host.innerHTML = '';
    }
  };
}
