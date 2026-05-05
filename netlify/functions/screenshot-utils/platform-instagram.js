/**
 * Instagram: Popup-Handling + Screenshot-Strategie
 * Unterstützt /reel/, /p/ und Profil-basierte URLs
 */

async function handleInstagramPopups(page) {
  console.log('🍪 Instagram: Popups...');
  await new Promise(r => setTimeout(r, 2000));

  try {
    // Step 1: "Weiter im Web" / "Continue on web" klicken
    const clickedContinue = await page.evaluate(() => {
      const links = document.querySelectorAll('a[role="link"], button, [role="button"]');
      for (const el of links) {
        const text = el.textContent || '';
        if (text.includes('Weiter im Web') || text.includes('Continue on web') ||
            text.includes('View on web') || text.includes('Continue')) {
          el.click();
          return true;
        }
      }
      return false;
    });

    if (clickedContinue) {
      console.log('✅ "Weiter im Web" geklickt');
      await new Promise(r => setTimeout(r, 2000));
    }

    // Step 2: "Not Now" / "Jetzt nicht" Button
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent || '';
        if (text.includes('Not Now') || text.includes('Jetzt nicht') || text.includes('Not now')) {
          btn.click();
          return;
        }
      }
    });
    await new Promise(r => setTimeout(r, 500));

    // Step 3: "Sieh dir dieses Reel in der App an" Modal schließen
    // Dieses Popup erscheint oft verzögert nach dem Seitenaufbau
    await closeAppDownloadModal(page);

    // Step 4: Header, App-Banner und Overlays entfernen
    await page.evaluate(() => {
      document.querySelectorAll('._ab16, ._ab1a, ._ab18, [class*="x1qjc9v5"]').forEach(el => {
        if (el.querySelector('svg[aria-label="Instagram"]') ||
            el.textContent?.includes('Anmelden') ||
            el.textContent?.includes('App öffnen')) {
          el.remove();
        }
      });

      const header = document.querySelector('div._ab16');
      if (header) header.remove();

      document.querySelectorAll('[class*="HpNGH"], [class*="RnEpo"]').forEach(el => {
        el.remove();
      });
    });
  } catch (e) {
    console.log('Instagram Popups:', e.message);
  }

  await new Promise(r => setTimeout(r, 1000));
}

/**
 * Schließt das "Sieh dir dieses Reel in der App an" / "Instagram öffnen" Modal.
 * Strategie: Erst X-Button klicken (menschliches Verhalten), dann DOM-Fallback.
 */
async function closeAppDownloadModal(page) {
  console.log('🔍 Instagram: Suche App-Download-Modal...');

  // Warte kurz, da das Modal oft verzögert erscheint
  await new Promise(r => setTimeout(r, 1500));

  const closed = await page.evaluate(() => {
    // Finde das Modal anhand seines Inhalts
    const dialogs = document.querySelectorAll('[role="dialog"], [class*="x1n2onr6"]');
    for (const dialog of dialogs) {
      const text = dialog.textContent || '';
      const isAppModal = text.includes('Sieh dir dieses Reel') ||
                         text.includes('in der App an') ||
                         text.includes('Instagram öffnen') ||
                         text.includes('Open Instagram') ||
                         text.includes('See this Reel') ||
                         text.includes('Registrieren');

      if (!isAppModal) continue;

      // Strategie 1: X-Button / Close-Button im Modal klicken
      const closeSelectors = [
        'button[aria-label="Close"]',
        'button[aria-label="Schließen"]',
        'button[aria-label="Dismiss"]',
        '[role="button"][aria-label="Close"]',
        '[role="button"][aria-label="Schließen"]'
      ];

      for (const sel of closeSelectors) {
        const btn = dialog.querySelector(sel);
        if (btn) {
          btn.click();
          return 'x-button';
        }
      }

      // Strategie 2: SVG-basierter Close-Button (X-Icon oben rechts)
      const allButtons = dialog.querySelectorAll('button, [role="button"]');
      for (const btn of allButtons) {
        const svg = btn.querySelector('svg');
        if (svg) {
          const rect = btn.getBoundingClientRect();
          // X-Button ist typischerweise oben rechts, klein (< 50px)
          if (rect.width < 50 && rect.height < 50) {
            btn.click();
            return 'svg-close';
          }
        }
      }

      // Strategie 3: DOM-Fallback - Modal komplett entfernen
      dialog.remove();
      return 'dom-removed';
    }

    // Auch außerhalb von [role="dialog"] suchen - manchmal nutzt Instagram andere Container
    const allOverlays = document.querySelectorAll('[class*="x1n2onr6"], [class*="xdt5ytf"]');
    for (const overlay of allOverlays) {
      const text = overlay.textContent || '';
      if ((text.includes('Instagram öffnen') || text.includes('Open Instagram')) &&
          (text.includes('Registrieren') || text.includes('Sign up') || text.includes('Reel'))) {
        // Backdrop/Overlay entfernen
        const backdrop = overlay.closest('[class*="x1n2onr6"]');
        if (backdrop && backdrop !== document.body) {
          backdrop.remove();
          return 'overlay-removed';
        }
        overlay.remove();
        return 'container-removed';
      }
    }

    return null;
  });

  if (closed) {
    console.log(`✅ Instagram App-Modal geschlossen (${closed})`);
    await new Promise(r => setTimeout(r, 1000));
  } else {
    console.log('ℹ️ Kein App-Download-Modal gefunden');
  }

  // Nochmals prüfen - manchmal taucht das Modal erneut auf
  const closedAgain = await page.evaluate(() => {
    const dialogs = document.querySelectorAll('[role="dialog"]');
    for (const dialog of dialogs) {
      const text = dialog.textContent || '';
      if (text.includes('Instagram öffnen') || text.includes('Open Instagram') ||
          text.includes('Sieh dir dieses Reel') || text.includes('See this Reel')) {
        dialog.remove();
        return true;
      }
    }

    // Verbleibende Backdrops entfernen
    document.querySelectorAll('[class*="x1n2onr6"][style*="position: fixed"]').forEach(el => {
      if (el.textContent?.includes('Instagram')) {
        el.remove();
      }
    });

    return false;
  });

  if (closedAgain) {
    console.log('✅ Instagram: Zweites Modal entfernt');
    await new Promise(r => setTimeout(r, 500));
  }
}

/**
 * Instagram Screenshot-Strategie:
 * Viewport-Screenshot direkt nach Media-Ready (DOM-Manipulation danach stört das Layout)
 */
async function takeInstagramScreenshot(page, { debug, supabase, supabaseUrl, headers }) {
  console.log('📷 Instagram: Warte auf Video/Bild...');
  try {
    await page.waitForFunction(() => {
      const video = document.querySelector('article video, [role="presentation"] video, video');
      if (video && video.readyState >= 2) return true;
      const img = document.querySelector('article img[src*="instagram"], [role="presentation"] img');
      if (img && img.complete && img.naturalHeight > 0) return true;
      return false;
    }, { timeout: 5000 });
    console.log('✅ Instagram: Video/Bild bereit');
  } catch (e) {
    console.log('⚠️ Instagram: Video/Bild nicht bereit nach 5s');
  }

  console.log('📸 Instagram: Viewport-Screenshot...');
  const screenshotBuffer = await page.screenshot({
    type: 'jpeg',
    quality: 85,
    fullPage: false
  });

  // Debug-Modus: DOM-Analyse + Screenshot hochladen und sofort zurückgeben
  if (debug) {
    return handleInstagramDebug(page, { supabase, supabaseUrl, headers });
  }

  return { screenshotBuffer };
}

async function handleInstagramDebug(page, { supabase, supabaseUrl, headers }) {
  console.log('🔍 Instagram DEBUG: DOM-Analyse...');

  const debugInfo = await page.evaluate(() => ({
    currentUrl: window.location.href,
    title: document.title,
    hasArticle: !!document.querySelector('article'),
    hasVideo: !!document.querySelector('article video'),
    videoReadyState: document.querySelector('video')?.readyState ?? 'no video',
    hasImg: !!document.querySelector('article img'),
    hasPresentation: !!document.querySelector('[role="presentation"]'),
    hasMainArticle: !!document.querySelector('main article'),
    hasLoginWall: !!(document.body?.textContent?.includes('Anmelden') || document.body?.textContent?.includes('Log in')),
    hasAppModal: !!document.querySelector('[role="dialog"]'),
    allSelectors: {
      'article video': !!document.querySelector('article video'),
      'article img': !!document.querySelector('article img'),
      '[role="presentation"] video': !!document.querySelector('[role="presentation"] video'),
      'main article': !!document.querySelector('main article'),
      'video': !!document.querySelector('video'),
      '[role="dialog"]': !!document.querySelector('[role="dialog"]')
    },
    bodySnippet: document.body?.innerHTML?.substring(0, 800) || 'NO BODY'
  }));

  console.log('🔍 DEBUG Info:', JSON.stringify(debugInfo, null, 2));

  const debugScreenshot = await page.screenshot({
    type: 'jpeg',
    quality: 80,
    fullPage: false
  });

  const debugFileName = `debug-instagram-${Date.now()}.jpg`;
  const { error: debugUploadError } = await supabase.storage
    .from('strategie-screenshots')
    .upload(`screenshots/${debugFileName}`, debugScreenshot, {
      contentType: 'image/jpeg',
      upsert: true
    });

  let debugScreenshotUrl = null;
  if (!debugUploadError) {
    debugScreenshotUrl = `${supabaseUrl}/storage/v1/object/public/strategie-screenshots/screenshots/${debugFileName}`;
    console.log('🔍 DEBUG Screenshot:', debugScreenshotUrl);
  }

  return {
    debugResponse: {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        debug: true,
        debug_screenshot_url: debugScreenshotUrl,
        debug_info: debugInfo,
        platform: 'instagram'
      })
    }
  };
}

module.exports = { handleInstagramPopups, takeInstagramScreenshot };
