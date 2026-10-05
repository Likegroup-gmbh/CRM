// loadCurrentItem
// Ablauf nach jedem Item-Wechsel: Auswahl hydratisieren (Video: erst Assets
// laden), Lightbox aktualisieren, Quelle auf der Stage anzeigen.
// host = VideoPlayerLightbox: session, assetLoader, lightbox, stage.

import { applyVideoDefault } from './selection/video.js';
import { applyStoryDefault } from './selection/story.js';
import { applyStillDefault } from './selection/still.js';

export async function loadCurrentItem(host) {
  const { session, assetLoader, lightbox, stage } = host;
  const item = session.current;
  if (!item) return;
  const intent = session.takeIntent();

  if (item.type === 'video') {
    const videoId = item.video.id;
    if (assetLoader.has(videoId)) {
      session.assets = assetLoader.get(videoId);
      session.loading = false;
      applyVideoDefault(session, assetLoader, intent);
      await lightbox.update();
      await stage.show();
      return;
    }
    session.assets = [];
    session.loading = true;
    await lightbox.update();
    const assets = await assetLoader.load(videoId);
    if (session.current?.video?.id !== videoId) return;
    session.assets = assets;
    session.loading = false;
    applyVideoDefault(session, assetLoader, intent);
    await lightbox.update();
    await stage.show();
    return;
  }

  if (item.type === 'story') {
    applyStoryDefault(session);
  } else {
    applyStillDefault(session, intent);
  }
  session.loading = true;
  await lightbox.update();
  await stage.show();
}
