// swapVideoSrc
// Stellt ein <video> auf eine andere Quelle (z. B. fertige Blob-URL) um, ohne
// die Wiedergabeposition zu verlieren. Mit `resume` laeuft ein spielendes
// Video nach dem Umstellen weiter.
//
// Position und play() erst nach loadedmetadata des NEUEN Mediums. Der
// readyState direkt nach dem Src-Tausch kann noch vom alten Medium stammen;
// ein play() davor wird vom Laden der neuen Quelle abgebrochen.

export function swapVideoSrc(video, url, { resume = false } = {}) {
  const t = video.currentTime;
  const wasPaused = video.paused;
  video.src = url;
  const restore = () => {
    try { if (Number.isFinite(t) && t > 0) video.currentTime = t; } catch (_) { /* noop */ }
    if (resume && !wasPaused) video.play?.()?.catch?.(() => {});
  };
  video.addEventListener('loadedmetadata', restore, { once: true });
}
