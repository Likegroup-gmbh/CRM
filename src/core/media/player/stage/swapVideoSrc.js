// swapVideoSrc
// Stellt ein <video> auf eine andere Quelle (z. B. fertige Blob-URL) um, ohne
// die Wiedergabeposition zu verlieren. Mit `resume` laeuft ein spielendes
// Video nach dem Umstellen weiter.

export function swapVideoSrc(video, url, { resume = false } = {}) {
  const t = video.currentTime;
  const wasPaused = video.paused;
  video.src = url;
  const restore = () => {
    try { if (Number.isFinite(t) && t > 0) video.currentTime = t; } catch (_) { /* noop */ }
    if (resume && !wasPaused) video.play().catch(() => {});
  };
  if (video.readyState >= 1) restore();
  else video.addEventListener('loadedmetadata', restore, { once: true });
}
