/**
 * YouTube: Menschliches Verhalten + Screenshot-Strategie
 * Debug-Screenshot nur im debug-Modus (nicht mehr automatisch in Produktion)
 */

const { randomDelay, PLATFORM_SELECTORS, MAX_SCREENSHOT_HEIGHT } = require('./constants');

async function handleYouTubeInteraction(page) {
  console.log('🔍 YouTube: Simuliere menschliches Verhalten...');

  await new Promise(r => setTimeout(r, randomDelay(4000, 6000)));

  // Natural Scrolling
  await page.evaluate(() => {
    window.scrollBy({ top: Math.random() * 200, behavior: 'smooth' });
  });
  await new Promise(r => setTimeout(r, randomDelay(500, 1500)));

  // Play-Button klicken
  console.log('▶️ Klicke Play-Button...');
  const playClicked = await page.evaluate(() => {
    const playSelectors = [
      'button[aria-label="Abspielen (k)"]',
      'button[aria-label="Play (k)"]',
      '#play-pause-button-shape button',
      '.ytp-large-play-button',
      'button[title*="Abspielen"]',
      'button[title*="Play"]'
    ];

    for (const sel of playSelectors) {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.click();
        return { clicked: true, selector: sel };
      }
    }
    return { clicked: false };
  });
  console.log('▶️ Play-Button:', JSON.stringify(playClicked));

  await new Promise(r => setTimeout(r, randomDelay(1500, 3000)));

  // Video-Element finden und starten
  const videoInfo = await page.evaluate(() => {
    const videoSelectors = [
      'video.video-stream.html5-main-video',
      'video.video-stream',
      'video.html5-main-video',
      '.html5-video-container video',
      '#shorts-player video',
      'video'
    ];

    let video = null;
    let usedSelector = '';

    for (const sel of videoSelectors) {
      video = document.querySelector(sel);
      if (video) {
        usedSelector = sel;
        break;
      }
    }

    if (!video) {
      const allVideos = document.querySelectorAll('video');
      return { found: false, totalVideos: allVideos.length };
    }

    video.muted = true;
    video.play().catch(() => {});

    return {
      found: true,
      selector: usedSelector,
      src: video.src ? 'blob:...' : 'keine src',
      readyState: video.readyState,
      paused: video.paused,
      duration: video.duration
    };
  });
  console.log('📹 Video:', JSON.stringify(videoInfo));

  // Auf Video-Frame warten
  if (videoInfo.found) {
    try {
      await page.waitForFunction(() => {
        const video = document.querySelector('video.video-stream, video');
        return video && video.readyState >= 2;
      }, { timeout: 5000 });
      console.log('✅ Video bereit');
    } catch (e) {
      console.log('⚠️ Video nicht bereit');
    }
  }

  await new Promise(r => setTimeout(r, 1000));
}

/**
 * YouTube Screenshot-Strategie:
 * Overlays entfernen, Element-Clip mit Bounding-Box
 * Debug-Screenshot nur bei debug: true
 */
async function takeYouTubeScreenshot(page) {
  // Overlays entfernen
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => {
    document.querySelectorAll('[role="dialog"], [class*="tux-base-dialog"]').forEach(el => el.remove());
    document.querySelectorAll('[class*="DivModalMask"], [class*="overlay"], [class*="Overlay"], [class*="backdrop"]').forEach(el => el.remove());

    const style = document.createElement('style');
    style.textContent = '[role="dialog"],[class*="Modal"],[class*="overlay"],[class*="backdrop"]{display:none!important;visibility:hidden!important;}';
    document.head.appendChild(style);
  });

  // Element-Screenshot
  const selector = PLATFORM_SELECTORS.youtube;

  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    const element = await page.$(selector);

    if (element) {
      const box = await element.boundingBox();
      if (box) {
        const screenshotBuffer = await page.screenshot({
          type: 'jpeg',
          quality: 85,
          clip: {
            x: box.x,
            y: box.y,
            width: box.width,
            height: Math.min(box.height, MAX_SCREENSHOT_HEIGHT)
          }
        });
        console.log(`✅ YouTube Element-Screenshot (max ${MAX_SCREENSHOT_HEIGHT}px)`);
        return { screenshotBuffer };
      }
    }
    throw new Error('Element/BoundingBox not found');
  } catch (e) {
    console.log('⚠️ YouTube Fallback viewport screenshot:', e.message);
    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 85,
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    return { screenshotBuffer };
  }
}

module.exports = { handleYouTubeInteraction, takeYouTubeScreenshot };
