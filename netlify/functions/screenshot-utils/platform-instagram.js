/**
 * Instagram: Popup-Handling + Screenshot-Strategie
 * WICHTIG: [role="dialog"] NIEMALS entfernen - darin lebt der Reel-Content!
 */

/**
 * Diagnose-Screenshot hochladen (für Timing-Analyse)
 */
async function uploadDiagnostic(page, supabase, supabaseUrl, label, step) {
  try {
    const buffer = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false });
    const fileName = `diag-ig-${step}-${label}-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('strategie-screenshots')
      .upload(`screenshots/${fileName}`, buffer, { contentType: 'image/jpeg', upsert: true });
    const url = error ? 'UPLOAD_ERROR' : `${supabaseUrl}/storage/v1/object/public/strategie-screenshots/screenshots/${fileName}`;
    console.log(`📸 DIAG [${step}] ${label}: ${url}`);
    return url;
  } catch (e) {
    console.log(`⚠️ DIAG [${step}] ${label} failed: ${e.message}`);
    return null;
  }
}

async function handleInstagramPopups(page, diagCtx) {
  console.log('🍪 Instagram: Popups...');
  await new Promise(r => setTimeout(r, 2000));

  if (diagCtx) await uploadDiagnostic(page, diagCtx.supabase, diagCtx.supabaseUrl, 'nach-load', 1);

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

    if (diagCtx) await uploadDiagnostic(page, diagCtx.supabase, diagCtx.supabaseUrl, 'nach-weiter-im-web', 2);

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

    // Step 3: "Sieh dir dieses Reel in der App an" Overlay per CSS verstecken
    // NIEMALS [role="dialog"] entfernen - darin lebt der Reel-Content!
    await hideAppDownloadOverlay(page);

    if (diagCtx) await uploadDiagnostic(page, diagCtx.supabase, diagCtx.supabaseUrl, 'nach-overlay-hide', 3);

    // Step 4: Header, App-Banner entfernen
    await page.evaluate(() => {
      // Header mit Instagram Logo entfernen
      document.querySelectorAll('._ab16, ._ab1a, ._ab18, [class*="x1qjc9v5"]').forEach(el => {
        if (el.querySelector('svg[aria-label="Instagram"]') ||
            el.textContent?.includes('Anmelden') ||
            el.textContent?.includes('App öffnen')) {
          el.remove();
        }
      });

      const header = document.querySelector('div._ab16');
      if (header) header.remove();

      // App-Banner (NICHT [role="dialog"]!)
      document.querySelectorAll('[class*="HpNGH"], [class*="RnEpo"]').forEach(el => {
        el.remove();
      });
    });
  } catch (e) {
    console.log('Instagram Popups:', e.message);
  }

  await new Promise(r => setTimeout(r, 1000));

  if (diagCtx) await uploadDiagnostic(page, diagCtx.supabase, diagCtx.supabaseUrl, 'nach-cleanup', 4);
}

/**
 * Versteckt das "Sieh dir dieses Reel in der App an" Overlay per CSS.
 * NIEMALS dialog.remove() aufrufen - das zerstört den Reel-Content!
 * Stattdessen: Nur das Overlay/Popup-Layer verstecken, nicht den Dialog selbst.
 */
async function hideAppDownloadOverlay(page) {
  console.log('🔍 Instagram: Suche App-Download-Overlay...');
  await new Promise(r => setTimeout(r, 1500));

  const result = await page.evaluate(() => {
    // Strategie 1: X-Button klicken (menschlichstes Verhalten)
    // Der X-Button ist AUSSERHALB des Dialogs, am oberen rechten Rand des Overlays
    const allButtons = document.querySelectorAll('button, [role="button"]');
    for (const btn of allButtons) {
      const ariaLabel = btn.getAttribute('aria-label') || '';
      if (ariaLabel === 'Close' || ariaLabel === 'Schließen' || ariaLabel === 'Dismiss') {
        btn.click();
        return 'x-button-aria';
      }
    }

    // Strategie 2: SVG X-Button finden (oben rechts, kleiner Button mit SVG)
    for (const btn of allButtons) {
      const svg = btn.querySelector('svg');
      if (!svg) continue;
      const rect = btn.getBoundingClientRect();
      // X-Button: klein, oben auf der Seite
      if (rect.width > 0 && rect.width <= 48 && rect.height <= 48 && rect.top < 100) {
        btn.click();
        return 'x-button-svg-top';
      }
    }

    // Strategie 3: Overlay-Container per CSS verstecken (NICHT entfernen!)
    // Suche nach dem spezifischen Popup das "Instagram öffnen" enthält
    // Aber NICHT den gesamten [role="dialog"] - darin lebt der Reel!
    const overlays = document.querySelectorAll('[class*="x1n2onr6"]');
    for (const overlay of overlays) {
      const text = overlay.textContent || '';
      const style = window.getComputedStyle(overlay);

      // Das App-Popup hat position:fixed und enthält "Instagram öffnen"
      if (style.position === 'fixed' &&
          (text.includes('Instagram öffnen') || text.includes('Open Instagram') ||
           text.includes('Sieh dir dieses Reel') || text.includes('See this Reel'))) {
        overlay.style.display = 'none';
        return 'overlay-hidden';
      }
    }

    // Strategie 4: Alle fixed-position Overlays die den Reel-Viewer blockieren
    const fixedElements = document.querySelectorAll('div[style*="position: fixed"], div[style*="position:fixed"]');
    for (const el of fixedElements) {
      const text = el.textContent || '';
      if (text.includes('Instagram öffnen') || text.includes('Open Instagram') ||
          text.includes('Registrieren') || text.includes('Sign up')) {
        el.style.display = 'none';
        return 'fixed-overlay-hidden';
      }
    }

    // Strategie 5: CSS-Injection als letzter Fallback
    // Versteckt typische Instagram App-Download Overlays ohne den Reel-Content zu berühren
    const style = document.createElement('style');
    style.textContent = `
      div[role="presentation"] > div[style*="position: fixed"]:not(:has(video)):not(:has(article)) {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    return 'css-injected';
  });

  console.log(`✅ Instagram Overlay-Handling: ${result}`);
  await new Promise(r => setTimeout(r, 1000));
}

/**
 * Instagram Screenshot-Strategie mit optionalen Diagnose-Screenshots
 */
async function takeInstagramScreenshot(page, { debug, supabase, supabaseUrl, headers }) {
  const diagCtx = debug ? { supabase, supabaseUrl } : null;

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

  if (diagCtx) await uploadDiagnostic(page, supabase, supabaseUrl, 'vor-screenshot', 5);

  console.log('📸 Instagram: Viewport-Screenshot...');
  const screenshotBuffer = await page.screenshot({
    type: 'jpeg',
    quality: 85,
    fullPage: false
  });

  // Debug-Modus: DOM-Analyse hochladen und zurückgeben
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
    hasDialog: !!document.querySelector('[role="dialog"]'),
    dialogCount: document.querySelectorAll('[role="dialog"]').length,
    hasLoginWall: !!(document.body?.textContent?.includes('Anmelden') || document.body?.textContent?.includes('Log in')),
    fixedOverlays: Array.from(document.querySelectorAll('*')).filter(el => {
      const s = window.getComputedStyle(el);
      return s.position === 'fixed' && el.offsetHeight > 100;
    }).length,
    bodyText: document.body?.textContent?.substring(0, 500) || 'NO BODY'
  }));

  console.log('🔍 DEBUG Info:', JSON.stringify(debugInfo, null, 2));

  const debugScreenshot = await page.screenshot({ type: 'jpeg', quality: 80, fullPage: false });
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
