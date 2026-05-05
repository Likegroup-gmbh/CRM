/**
 * Instagram: Popup-Handling + Screenshot-Strategie
 * Unterscheidet zwischen /reels/ und /p/ URLs (verschiedene Layouts/Popups)
 * WICHTIG: [role="dialog"] NIEMALS entfernen - darin lebt der Reel-Content!
 */

function detectInstagramType(url) {
  if (!url) return 'unknown';
  if (url.includes('/reel/') || url.includes('/reels/')) return 'reel';
  if (url.includes('/p/')) return 'post';
  return 'unknown';
}

async function uploadDiagnostic(page, supabase, supabaseUrl, label, step) {
  try {
    const buffer = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false });
    const fileName = `diag-ig-${step}-${label}-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('strategie-screenshots')
      .upload(`screenshots/${fileName}`, buffer, { contentType: 'image/jpeg', upsert: true });
    const diagUrl = error ? 'UPLOAD_ERROR' : `${supabaseUrl}/storage/v1/object/public/strategie-screenshots/screenshots/${fileName}`;
    console.log(`📸 DIAG [${step}] ${label}: ${diagUrl}`);
    return diagUrl;
  } catch (e) {
    console.log(`⚠️ DIAG [${step}] ${label} failed: ${e.message}`);
    return null;
  }
}

async function handleInstagramPopups(page, url) {
  const igType = detectInstagramType(url);
  console.log(`🍪 Instagram: Popups... (Typ: ${igType}, URL: ${url})`);
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

    // Step 3: Overlay schließen
    await hideAppDownloadOverlay(page);

  } catch (e) {
    console.log('Instagram Popups:', e.message);
  }

  await new Promise(r => setTimeout(r, 1000));
}

async function hideAppDownloadOverlay(page) {
  console.log('🔍 Instagram: Suche App-Download-Overlay...');
  await new Promise(r => setTimeout(r, 1500));

  const result = await page.evaluate(() => {
    const allButtons = document.querySelectorAll('button, [role="button"]');

    for (const btn of allButtons) {
      const ariaLabel = btn.getAttribute('aria-label') || '';
      if (ariaLabel === 'Close' || ariaLabel === 'Schließen' || ariaLabel === 'Dismiss') {
        btn.click();
        return 'x-button-aria';
      }
    }

    for (const btn of allButtons) {
      const svg = btn.querySelector('svg');
      if (!svg) continue;
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.width <= 48 && rect.height <= 48 && rect.top < 100) {
        btn.click();
        return 'x-button-svg-top';
      }
    }

    const overlays = document.querySelectorAll('[class*="x1n2onr6"]');
    for (const overlay of overlays) {
      const text = overlay.textContent || '';
      const style = window.getComputedStyle(overlay);
      if (style.position === 'fixed' &&
          (text.includes('Instagram öffnen') || text.includes('Open Instagram') ||
           text.includes('Sieh dir dieses Reel') || text.includes('See this Reel'))) {
        overlay.style.display = 'none';
        return 'overlay-hidden';
      }
    }

    const fixedElements = document.querySelectorAll('div[style*="position: fixed"], div[style*="position:fixed"]');
    for (const el of fixedElements) {
      const text = el.textContent || '';
      if (text.includes('Instagram öffnen') || text.includes('Open Instagram') ||
          text.includes('Registrieren') || text.includes('Sign up')) {
        el.style.display = 'none';
        return 'fixed-overlay-hidden';
      }
    }

    return 'no-overlay-found';
  });

  console.log(`✅ Instagram Overlay-Handling: ${result}`);
  await new Promise(r => setTimeout(r, 1000));
}

/**
 * Instagram Screenshot mit URL-Typ-Erkennung.
 * /p/-URLs: Diagnose-Screenshots für Timing-Analyse
 * /reels/-URLs: Direkter Screenshot (funktioniert bereits)
 */
async function takeInstagramScreenshot(page, { debug, supabase, supabaseUrl, headers, url }) {
  const igType = detectInstagramType(url);
  const isPostUrl = igType === 'post';

  // Bei /p/-URLs: Diagnose-Screenshots für Analyse
  if (isPostUrl) {
    console.log('📸 Instagram /p/ URL erkannt - starte Diagnose-Screenshots...');
    return takePostDiagnosticScreenshots(page, { supabase, supabaseUrl, headers, debug });
  }

  // /reels/-URLs: Normaler Flow (funktioniert)
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

  if (debug) {
    return handleInstagramDebug(page, { supabase, supabaseUrl, headers });
  }

  return { screenshotBuffer };
}

/**
 * Diagnose-Screenshots für /p/ URLs.
 * Macht Screenshots zu verschiedenen Zeitpunkten + DOM-Analyse.
 */
async function takePostDiagnosticScreenshots(page, { supabase, supabaseUrl, headers, debug }) {
  // DOM-Analyse zuerst
  const domInfo = await page.evaluate(() => ({
    currentUrl: window.location.href,
    title: document.title,
    hasArticle: !!document.querySelector('article'),
    hasVideo: !!document.querySelector('video'),
    hasImg: !!document.querySelector('img[src*="instagram"]'),
    hasDialog: !!document.querySelector('[role="dialog"]'),
    dialogCount: document.querySelectorAll('[role="dialog"]').length,
    hasError: !!(document.body?.textContent?.includes('schiefgelaufen') || document.body?.textContent?.includes('went wrong')),
    hasLoginWall: !!(document.body?.textContent?.includes('Anmelden') || document.body?.textContent?.includes('Log in')),
    bodyText: document.body?.textContent?.substring(0, 500) || 'NO BODY'
  }));
  console.log('🔍 /p/ DOM-Analyse:', JSON.stringify(domInfo, null, 2));

  // Screenshots zu verschiedenen Zeitpunkten
  const timings = [0, 1.0, 2.0, 3.0, 5.0, 8.0];
  let lastBuffer = null;

  for (const seconds of timings) {
    if (seconds > 0) await new Promise(r => setTimeout(r, seconds === timings[1] ? 1000 : (seconds - timings[timings.indexOf(seconds) - 1]) * 1000));

    await uploadDiagnostic(page, supabase, supabaseUrl, `post-${seconds.toFixed(1)}s`, seconds.toFixed(1));

    lastBuffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false });
  }

  // Nochmal DOM-Check nach Warten
  const domInfoAfter = await page.evaluate(() => ({
    currentUrl: window.location.href,
    hasError: !!(document.body?.textContent?.includes('schiefgelaufen') || document.body?.textContent?.includes('went wrong')),
    hasArticle: !!document.querySelector('article'),
    hasImg: !!document.querySelector('img[src*="instagram"]'),
    bodyText: document.body?.textContent?.substring(0, 300) || 'NO BODY'
  }));
  console.log('🔍 /p/ DOM nach Warten:', JSON.stringify(domInfoAfter, null, 2));

  const screenshotBuffer = lastBuffer || await page.screenshot({
    type: 'jpeg',
    quality: 85,
    fullPage: false
  });

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
    hasDialog: !!document.querySelector('[role="dialog"]'),
    dialogCount: document.querySelectorAll('[role="dialog"]').length,
    bodyText: document.body?.textContent?.substring(0, 300) || 'NO BODY'
  }));

  console.log('🔍 DEBUG Info:', JSON.stringify(debugInfo, null, 2));

  const debugScreenshot = await page.screenshot({ type: 'jpeg', quality: 80, fullPage: false });
  const debugFileName = `debug-instagram-${Date.now()}.jpg`;
  const { error: debugUploadError } = await supabase.storage
    .from('strategie-screenshots')
    .upload(`screenshots/${debugFileName}`, debugScreenshot, {
      contentType: 'image/jpeg', upsert: true
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
        success: true, debug: true,
        debug_screenshot_url: debugScreenshotUrl,
        debug_info: debugInfo,
        platform: 'instagram'
      })
    }
  };
}

module.exports = { handleInstagramPopups, takeInstagramScreenshot };
