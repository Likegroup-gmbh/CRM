// test-screenshot.js
// Lokaler Screenshot-Test für alle Plattformen
// Ausführen: node test-screenshot.js <URL>
// Oder ohne URL: testet alle Plattformen nacheinander

const puppeteer = require('puppeteer');

const TEST_URLS = {
  tiktok: 'https://www.tiktok.com/@visssionary/video/7493012629217606945',
  instagram: 'https://www.instagram.com/reel/DIFLGJuOkKC/',
  youtube: 'https://www.youtube.com/shorts/dQw4w9WgXcQ'
};

function detectPlatform(url) {
  if (!url) return 'other';
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com')) return 'instagram';
  return 'other';
}

async function testScreenshot(url) {
  const platform = detectPlatform(url);
  const isMobile = platform === 'tiktok' || platform === 'instagram';
  const viewport = isMobile ? { width: 430, height: 932 } : { width: 1920, height: 1080 };

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  ${platform.toUpperCase()} - ${url}`);
  console.log(`${'═'.repeat(50)}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50,
    args: [
      `--window-size=${viewport.width},${viewport.height}`,
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport(viewport);

  const userAgent = isMobile
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  await page.setUserAgent(userAgent);

  try {
    console.log('📡 Lade Seite...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Seite geladen!');

    if (platform === 'tiktok') {
      await handleTikTok(page);
    } else if (platform === 'instagram') {
      await handleInstagram(page);
    } else if (platform === 'youtube') {
      await handleYouTube(page);
    }

    await new Promise(r => setTimeout(r, 500));

    const filename = `test-${platform}-${Date.now()}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`📸 Screenshot: ${filename}`);

  } catch (error) {
    console.error('❌ Fehler:', error.message);
  }

  await browser.close();
  console.log('🔒 Browser geschlossen.\n');
}

async function handleTikTok(page) {
  console.log('🍪 TikTok: Popups...');
  await new Promise(r => setTimeout(r, 2000));

  try {
    const clicked = await page.evaluate(() => {
      const shadowHosts = document.querySelectorAll('*');
      for (const el of shadowHosts) {
        if (el.shadowRoot) {
          for (const btn of el.shadowRoot.querySelectorAll('button')) {
            if ((btn.textContent || '').includes('ablehnen') || (btn.textContent || '').includes('Decline')) {
              btn.click();
              return 'cookie';
            }
          }
        }
      }
      return false;
    });
    if (clicked) {
      console.log(`✅ ${clicked} geklickt`);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (e) {
    console.log('Cookie:', e.message);
  }

  try {
    await new Promise(r => setTimeout(r, 1000));
    const modalClosed = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, [role="button"]');
      for (const btn of buttons) {
        const dataE2e = btn.querySelector('[data-e2e="launch-popup-close"]');
        if (dataE2e || (btn.textContent || '').includes('Jetzt nicht') || (btn.textContent || '').includes('Not now')) {
          btn.click();
          return true;
        }
      }
      document.querySelectorAll('[class*="tux-base-dialog"]').forEach(el => {
        if ((el.textContent || '').includes('Schau dir') || (el.textContent || '').includes('Watch this')) {
          el.style.display = 'none';
        }
      });
      return false;
    });
    if (modalClosed) {
      console.log('✅ Modal geschlossen');
      await new Promise(r => setTimeout(r, 800));
    }
  } catch (e) {}

  await page.evaluate(() => {
    const hideSelectors = [
      '[class*="XMarkWrapper"]', '[class*="KeyboardShortcut"]', '[class*="FixedBottomContainer"]',
      '[class*="captcha"]', '[class*="Captcha"]', '[class*="DivBrowserModeContainer"]',
      '[type="top"]', '[class*="DivFixedWrapper"]', '[class*="DivTopBannerAB"]'
    ];
    hideSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; });
    });
  });
  await new Promise(r => setTimeout(r, 500));
}

async function handleInstagram(page) {
  console.log('🍪 Instagram: Popups...');
  await new Promise(r => setTimeout(r, 2000));

  try {
    // "Weiter im Web"
    const clicked = await page.evaluate(() => {
      const links = document.querySelectorAll('a[role="link"], button, [role="button"]');
      for (const el of links) {
        const text = el.textContent || '';
        if (text.includes('Weiter im Web') || text.includes('Continue on web') || text.includes('Continue')) {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (clicked) {
      console.log('✅ "Weiter im Web" geklickt');
      await new Promise(r => setTimeout(r, 2000));
    }

    // "Not Now"
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if ((btn.textContent || '').includes('Not Now') || (btn.textContent || '').includes('Jetzt nicht')) {
          btn.click();
          return;
        }
      }
    });
    await new Promise(r => setTimeout(r, 500));

    // "Sieh dir dieses Reel in der App an" Modal
    console.log('🔍 Suche App-Download-Modal...');
    await new Promise(r => setTimeout(r, 1500));

    const closed = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"], [class*="x1n2onr6"]');
      for (const dialog of dialogs) {
        const text = dialog.textContent || '';
        if (text.includes('Sieh dir dieses Reel') || text.includes('Instagram öffnen') ||
            text.includes('Open Instagram') || text.includes('See this Reel')) {
          // X-Button suchen
          const closeButtons = dialog.querySelectorAll('button[aria-label="Close"], button[aria-label="Schließen"], button[aria-label="Dismiss"]');
          for (const btn of closeButtons) {
            btn.click();
            return 'x-button';
          }
          // SVG-Close-Button
          for (const btn of dialog.querySelectorAll('button, [role="button"]')) {
            if (btn.querySelector('svg') && btn.getBoundingClientRect().width < 50) {
              btn.click();
              return 'svg-close';
            }
          }
          dialog.remove();
          return 'dom-removed';
        }
      }
      return null;
    });

    if (closed) {
      console.log(`✅ App-Modal geschlossen (${closed})`);
      await new Promise(r => setTimeout(r, 1000));
    } else {
      console.log('ℹ️ Kein App-Download-Modal');
    }

    // Header entfernen
    await page.evaluate(() => {
      const header = document.querySelector('div._ab16');
      if (header) header.remove();
      document.querySelectorAll('[class*="HpNGH"], [class*="RnEpo"]').forEach(el => el.remove());
    });
  } catch (e) {
    console.log('Instagram Popups:', e.message);
  }
  await new Promise(r => setTimeout(r, 1000));
}

async function handleYouTube(page) {
  console.log('🍪 YouTube: Consent + Video...');
  await new Promise(r => setTimeout(r, 3000));

  // Consent-Button in allen Frames suchen
  const frames = page.frames();
  console.log(`🔍 ${frames.length} Frames`);

  let clicked = false;
  for (const frame of frames) {
    if (clicked) break;
    try {
      clicked = await frame.evaluate(() => {
        for (const btn of document.querySelectorAll('button, [role="button"]')) {
          const text = btn.textContent || '';
          const aria = btn.getAttribute('aria-label') || '';
          if (text.includes('Alle ablehnen') || text.includes('Reject all') ||
              aria.includes('Alle ablehnen') || aria.includes('Reject all')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
    } catch (e) {}
  }

  if (clicked) {
    console.log('✅ Consent geklickt');
    try {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 });
    } catch (e) {}
    await new Promise(r => setTimeout(r, 3000));
  }

  // Video starten
  try {
    await page.waitForSelector('video', { timeout: 10000 });
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) { video.muted = true; video.play().catch(() => {}); }
    });
    await page.waitForFunction(() => {
      const v = document.querySelector('video');
      return v && v.readyState >= 2;
    }, { timeout: 5000 });
    console.log('✅ Video bereit');
  } catch (e) {
    console.log('⚠️ Video:', e.message);
  }
  await new Promise(r => setTimeout(r, 1000));
}

// Hauptlogik
const urlArg = process.argv[2];

if (urlArg) {
  testScreenshot(urlArg);
} else {
  console.log(`\n${'═'.repeat(50)}`);
  console.log('  SCREENSHOT TESTER - Alle Plattformen');
  console.log(`${'═'.repeat(50)}`);
  console.log('\nVerwendung:');
  console.log('  node test-screenshot.js <URL>');
  console.log('\nBeispiele:');
  Object.entries(TEST_URLS).forEach(([p, u]) => console.log(`  node test-screenshot.js "${u}"`));
  console.log('\nStarte alle Tests in 3 Sekunden...\n');

  setTimeout(async () => {
    for (const [platform, url] of Object.entries(TEST_URLS)) {
      await testScreenshot(url);
    }
    console.log('✅ Alle Tests abgeschlossen!');
  }, 3000);
}
