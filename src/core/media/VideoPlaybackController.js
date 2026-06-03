// VideoPlaybackController
// Verdrahtet ein <video>-Element im Stage-Bereich mit den Custom-Controls
// (Play/Pause, Seek, Mute, Fullscreen). Reine UI-Steuerung ohne State-Bezug.

import { ICON_PLAY, ICON_PAUSE, ICON_VOLUME, ICON_MUTE, ICON_FS, ICON_FS_EXIT, formatTime } from './mediaPlayerIcons.js';

export class VideoPlaybackController {
  constructor() {
    this._fsAbort = null;
  }

  /** Bindet die Controls an das Video im uebergebenen Stage-Element. */
  mount(stage) {
    if (!stage) return;
    const video = stage.querySelector('.vpl-video');
    if (!video || video.dataset.bound === '1') return;
    video.dataset.bound = '1';

    const playBtn = stage.querySelector('.vpl-play');
    const muteBtn = stage.querySelector('.vpl-mute');
    const fsBtn = stage.querySelector('.vpl-fs');
    const seek = stage.querySelector('.vpl-seek');
    const timeEl = stage.querySelector('.vpl-time');

    const setProgress = () => {
      if (seek && Number.isFinite(video.duration) && video.duration > 0) {
        seek.max = video.duration;
        seek.value = video.currentTime;
        seek.style.setProperty('--p', `${(video.currentTime / video.duration) * 100}%`);
      }
      if (timeEl) timeEl.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    };

    const togglePlay = () => { if (video.paused) video.play(); else video.pause(); };

    if (playBtn) playBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);
    video.addEventListener('play', () => { if (playBtn) playBtn.innerHTML = ICON_PAUSE; });
    video.addEventListener('pause', () => { if (playBtn) playBtn.innerHTML = ICON_PLAY; });
    video.addEventListener('loadedmetadata', setProgress);
    video.addEventListener('timeupdate', setProgress);

    if (seek) {
      seek.addEventListener('input', () => {
        if (Number.isFinite(video.duration)) {
          video.currentTime = Number(seek.value);
          seek.style.setProperty('--p', `${(video.currentTime / video.duration) * 100}%`);
        }
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        muteBtn.innerHTML = video.muted ? ICON_MUTE : ICON_VOLUME;
      });
    }

    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (stage.requestFullscreen) stage.requestFullscreen();
      });
      this._armFullscreen(stage);
    }
  }

  /**
   * Setzt nur den document-`fullscreenchange`-Listener neu. Fuer wiederverwendete
   * (geparkte) Stage-Subtrees: fsBtn-Click + Video-Listener sind dort bereits
   * gebunden, nur der document-Listener wurde beim unmount abgebrochen.
   */
  rearmFullscreen(stage) {
    if (!stage || !stage.querySelector('.vpl-fs')) return;
    this._armFullscreen(stage);
  }

  _armFullscreen(stage) {
    const fsBtn = stage.querySelector('.vpl-fs');
    if (!fsBtn) return;
    // Alten document-Listener entbinden, bevor ein neuer registriert wird.
    this._fsAbort?.abort();
    this._fsAbort = new AbortController();
    document.addEventListener('fullscreenchange', () => {
      fsBtn.innerHTML = document.fullscreenElement ? ICON_FS_EXIT : ICON_FS;
    }, { signal: this._fsAbort.signal });
  }

  /** Entfernt den document-gebundenen fullscreenchange-Listener. */
  unmount() {
    this._fsAbort?.abort();
    this._fsAbort = null;
  }
}
