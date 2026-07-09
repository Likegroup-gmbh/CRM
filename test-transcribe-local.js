// Lokaler Test für die Video-Interceptor-Pipeline (ohne Cloudflare AI).
// Testet: TikTok Rehydration-Parsing + Video-Download, Instagram Netzwerk-Interception.
// Ausführen mit: node test-transcribe-local.js [tiktok-url] [instagram-url]
// Ohne Argumente werden automatisch Videos von bekannten Profilen gesucht.

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());
const {
  createMediaUrlCollector,
  extractTikTokVideoData,
  extractInstagramVideoData,
  downloadVideoBuffer,
  downloadSubtitleText
} = require('./netlify/functions/screenshot-utils/video-interceptor');

// Desktop-UA wie in transcribe-background.js (launchBrowser('other'))
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(DESKTOP_UA);
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8' });
  return page;
}

async function findVideoUrlFromProfile(browser, profileUrl, linkPattern) {
  const page = await newPage(browser);
  try {
    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 6000));
    // Etwas scrollen, um Lazy-Loading zu triggern
    await page.evaluate(() => window.scrollTo(0, 800));
    await new Promise(r => setTimeout(r, 3000));
    const link = await page.evaluate((pattern) => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const match = anchors.find(a => new RegExp(pattern).test(a.href));
      return match ? match.href : null;
    }, linkPattern);
    return link;
  } finally {
    await page.close();
  }
}

async function testTikTok(browser, url) {
  console.log('\n========== TIKTOK ==========');
  if (!url) {
    console.log('Suche Video auf @tagesschau...');
    url = await findVideoUrlFromProfile(browser, 'https://www.tiktok.com/@tagesschau', '/video/\\d+');
    if (!url) { console.log('❌ Kein Video-Link auf Profil gefunden'); return; }
  }
  console.log('Test-URL:', url);

  const page = await newPage(browser);
  try {
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    const data = await extractTikTokVideoData(page);
    console.log('Extraktion:', JSON.stringify({
      hasVideoUrl: !!data.videoUrl,
      durationSeconds: data.durationSeconds,
      caption: (data.caption || '').substring(0, 80),
      author: data.author,
      subtitle: data.subtitle ? { lang: data.subtitle.lang, format: data.subtitle.format } : null,
      error: data.error
    }, null, 2));

    if (data.error) return;

    if (data.subtitle?.url) {
      try {
        const text = await downloadSubtitleText(page, data.subtitle.url);
        console.log(`✅ Native Captions (${text.length} Zeichen): "${text.substring(0, 150)}..."`);
      } catch (e) {
        console.log('⚠️ Caption-Download fehlgeschlagen:', e.message);
      }
    }

    if (data.videoUrl) {
      const buffer = await downloadVideoBuffer(page, data.videoUrl, url);
      console.log(`✅ Video-Download: ${(buffer.length / 1024 / 1024).toFixed(2)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      // Magic Bytes pruefen (MP4: "ftyp" bei Offset 4)
      const magic = buffer.slice(4, 8).toString('ascii');
      console.log(`   Magic Bytes: "${magic}" ${magic === 'ftyp' ? '(gültiges MP4)' : '(unerwartet!)'}`);
    }
  } finally {
    await page.close();
  }
}

async function testInstagram(browser, url) {
  console.log('\n========== INSTAGRAM ==========');
  if (!url) {
    console.log('Suche Reel auf @tagesschau...');
    url = await findVideoUrlFromProfile(browser, 'https://www.instagram.com/tagesschau/reels/', '/reel/');
    if (!url) { console.log('❌ Kein Reel-Link auf Profil gefunden (Login-Wall?)'); return; }
  }
  console.log('Test-URL:', url);

  const page = await newPage(browser);
  try {
    const t0 = Date.now();
    const mediaUrls = createMediaUrlCollector(page);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => document.querySelector('video')?.play()?.catch(() => {}));
    await new Promise(r => setTimeout(r, 4000));

    const data = await extractInstagramVideoData(page, mediaUrls);
    console.log('Extraktion:', JSON.stringify({
      hasVideoUrl: !!data.videoUrl,
      isAudioOnly: data.isAudioOnly,
      collectedMediaUrls: mediaUrls.length,
      durationSeconds: data.durationSeconds,
      caption: (data.caption || '').substring(0, 80)
    }, null, 2));

    if (data.videoUrl) {
      const buffer = await downloadVideoBuffer(page, data.videoUrl, url);
      console.log(`✅ Video-Download: ${(buffer.length / 1024 / 1024).toFixed(2)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      const magic = buffer.slice(4, 8).toString('ascii');
      console.log(`   Magic Bytes: "${magic}" ${magic === 'ftyp' ? '(gültiges MP4)' : '(unerwartet!)'}`);
    } else {
      console.log('❌ Keine Video-URL gefunden. Gesammelte Media-URLs:');
      mediaUrls.slice(0, 5).forEach(m => console.log('  -', m.url.substring(0, 120)));
    }
  } finally {
    await page.close();
  }
}

(async () => {
  const [tiktokUrl, instagramUrl] = process.argv.slice(2);
  const browser = await puppeteerExtra.launch({
    headless: 'new',
    executablePath: require('puppeteer').executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=de-DE']
  });

  try {
    await testTikTok(browser, tiktokUrl);
    await testInstagram(browser, instagramUrl);
  } catch (e) {
    console.error('Testfehler:', e);
  } finally {
    await browser.close();
  }
})();
