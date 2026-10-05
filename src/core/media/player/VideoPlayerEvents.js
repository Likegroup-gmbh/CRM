// VideoPlayerEvents
// Bindet die DOM-Events des Player-Bodys (Selects, Galerie, Prev/Next, Download,
// Promote, Stage). Jeder Handler schreibt in die Auswahl der Session und laedt
// dann die Quelle neu. host = VideoPlayerLightbox: session, assetLoader,
// lightbox, stage, promote, navigate(), jumpTo(), loadCurrent(), download().

import { selectVideoVersion, selectVideoVariant } from './selection/video.js';
import { selectStoryVersion, selectStoryFinalVariant } from './selection/story.js';
import { selectStillVersion, selectStillVariant } from './selection/still.js';

/** Body neu rendern und die Quelle des (geaenderten) Mediums anzeigen. */
async function reselect(host, { clearSrc = true } = {}) {
  if (clearSrc) host.session.src = null;
  await host.lightbox.update();
  host.stage.show();
}

/** change-Handler an ein Select (falls im Body vorhanden) haengen. */
function onSelectChange(root, selector, handler) {
  const el = root.querySelector(selector);
  if (el) el.addEventListener('change', () => handler(el.value));
}

export function bindPlayerEvents(root, host) {
  const { session, assetLoader } = host;

  onSelectChange(root, '.player-version-select', async (raw) => {
    selectVideoVersion(session, assetLoader, raw);
    session.loading = false;
    await reselect(host, { clearSrc: false });
  });

  // Variantenwechsel: nur die Quelle tauschen, der Body bleibt stehen.
  onSelectChange(root, '.player-variant-select', (id) => {
    selectVideoVariant(session, id);
    host.stage.show();
  });

  onSelectChange(root, '.story-version-select', async (raw) => {
    selectStoryVersion(session, raw);
    await reselect(host);
  });

  onSelectChange(root, '.story-final-variant-select', async (id) => {
    selectStoryFinalVariant(session, id);
    await reselect(host);
  });

  onSelectChange(root, '.still-version-select', async (raw) => {
    selectStillVersion(session, raw);
    await reselect(host);
  });

  onSelectChange(root, '.still-variant-select', async (id) => {
    // Jedes Still ist ein eigenes Item in der Liste: dorthin springen.
    const idx = session.items.findIndex(it => it.type === 'bild' && it.image.id === id);
    if (idx >= 0 && idx !== session.index) {
      await host.jumpTo(idx);
      return;
    }
    selectStillVariant(session, id);
    await reselect(host);
  });

  host.promote.bind(root);

  // Feedback-Autosave/Flush laeuft ueber die delegierte VideoFeedbackBinding
  // am Lightbox-Root (in _open gebunden) -> kein per-Mount-Listener noetig.

  root.querySelector('.vpl-prev')?.addEventListener('click', () => host.navigate(-1));
  root.querySelector('.vpl-next')?.addEventListener('click', () => host.navigate(1));
  root.querySelector('.vpl-download')?.addEventListener('click', () => host.download());

  host.stage.mount(root);
}
