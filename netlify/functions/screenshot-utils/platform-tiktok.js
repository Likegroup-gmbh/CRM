/**
 * TikTok: Popup-Handling + Screenshot-Strategie
 */

const { PLATFORM_SELECTORS, MAX_SCREENSHOT_HEIGHT } = require('./constants');

async function handleTikTokPopups(page) {
  console.log('🍪 TikTok: Cookie-Banner & Popups...');
  await new Promise(r => setTimeout(r, 2000));

  // Shadow DOM Cookie-Banner
  try {
    const clicked = await page.evaluate(() => {
      const shadowHosts = document.querySelectorAll('*');
      for (const el of shadowHosts) {
        if (el.shadowRoot) {
          const shadowButtons = el.shadowRoot.querySelectorAll('button');
          for (const btn of shadowButtons) {
            const text = btn.textContent || '';
            if (text.includes('ablehnen') || text.includes('Decline') ||
                text.includes('Optionale Cookies ablehnen')) {
              btn.click();
              return true;
            }
          }
        }
      }
      return false;
    });

    if (clicked) {
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (e) {
    console.log('Cookie-Banner:', e.message);
  }

  // "Watch on TikTok" Modal schließen (Mobile)
  try {
    await new Promise(r => setTimeout(r, 1000));

    const modalClosed = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, [role="button"]');
      for (const btn of buttons) {
        const dataE2e = btn.querySelector('[data-e2e="launch-popup-close"]');
        if (dataE2e || (btn.textContent || '').includes('Jetzt nicht') ||
            (btn.textContent || '').includes('Not now')) {
          btn.click();
          return true;
        }
      }

      document.querySelectorAll('[class*="tux-base-dialog"]').forEach(el => {
        if ((el.textContent || '').includes('Schau dir dieses Video') ||
            (el.textContent || '').includes('Watch this video')) {
          el.style.display = 'none';
        }
      });
      return false;
    });

    if (modalClosed) {
      await new Promise(r => setTimeout(r, 800));
    }
  } catch (e) {
    console.log('Modal:', e.message);
  }

  // Overlays ausblenden
  await page.evaluate(() => {
    document.querySelectorAll('[class*="XMarkWrapper"], [class*="KeyboardShortcut"], [class*="FixedBottomContainer"]').forEach(el => {
      el.style.display = 'none';
    });
    document.querySelectorAll('[class*="captcha"], [class*="Captcha"], [class*="verify"], [class*="Verify"]').forEach(el => {
      el.style.display = 'none';
    });
    document.querySelectorAll('[class*="modal"], [class*="Modal"], [role="dialog"]').forEach(el => {
      if (el.textContent?.includes('Puzzle') || el.textContent?.includes('Schieberegler')) {
        el.style.display = 'none';
      }
    });
    document.querySelectorAll('[class*="DivBrowserModeContainer"]').forEach(el => {
      el.style.display = 'none';
    });
    document.querySelectorAll('[type="top"], [class*="DivFixedWrapper"], [class*="DivTopBannerAB"]').forEach(el => {
      el.style.display = 'none';
    });
  });

  await new Promise(r => setTimeout(r, 500));
}

/**
 * TikTok Screenshot-Strategie:
 * Overlays entfernen, dann Element-Clip mit Bounding-Box (max 645px Höhe)
 */
async function takeTikTokScreenshot(page) {
  await new Promise(r => setTimeout(r, 1500));

  // Modale und Overlays final entfernen
  await page.evaluate(() => {
    document.querySelectorAll('[role="dialog"], [class*="tux-base-dialog"]').forEach(el => el.remove());
    document.querySelectorAll('[class*="DivModalMask"], [class*="overlay"], [class*="Overlay"], [class*="backdrop"]').forEach(el => el.remove());
    document.querySelectorAll('[type="top"], [class*="DivFixedWrapper"], [class*="DivTopBannerAB"], [class*="TopBanner"], [class*="DivHeaderContainer"]').forEach(el => el.remove());
    document.querySelectorAll('[class*="DivTabContainer"], [class*="TabBar"], footer').forEach(el => el.remove());

    const style = document.createElement('style');
    style.textContent = '[role="dialog"],[class*="tux-base-dialog"],[class*="Modal"],[class*="DivModalMask"],[class*="overlay"],[class*="backdrop"],[type="top"],[class*="DivFixedWrapper"],[class*="TopBanner"]{display:none!important;visibility:hidden!important;}';
    document.head.appendChild(style);
  });

  const selector = PLATFORM_SELECTORS.tiktok;

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
        console.log(`✅ TikTok Element-Screenshot (max ${MAX_SCREENSHOT_HEIGHT}px)`);
        return { screenshotBuffer };
      }
    }
    throw new Error('Element/BoundingBox not found');
  } catch (e) {
    console.log('⚠️ TikTok Fallback viewport screenshot:', e.message);
    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 85,
      clip: { x: 0, y: 0, width: 430, height: MAX_SCREENSHOT_HEIGHT }
    });
    return { screenshotBuffer };
  }
}

module.exports = { handleTikTokPopups, takeTikTokScreenshot };
