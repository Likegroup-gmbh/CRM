// Lokaler Test für Instagram Scraping
// Ausführen mit: node test-instagram-scrape.js

const puppeteer = require('puppeteer');

const TEST_URL = 'https://www.instagram.com/sleepymonkeycoaching/';

async function testInstagramScrape() {
  console.log('🚀 Starte Instagram Scrape Test...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Browser sichtbar!
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Desktop User-Agent
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('📷 Navigiere zu:', TEST_URL);
  await page.goto(TEST_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  
  // Warten
  console.log('⏳ Warte 5 Sekunden...');
  await new Promise(r => setTimeout(r, 5000));
  
  // Screenshot 1: Vor Cookie-Banner Handling
  await page.screenshot({ path: 'test-ig-1-initial.png', fullPage: false });
  console.log('📸 Screenshot 1: test-ig-1-initial.png');
  
  // Cookie-Banner/Login-Popup schließen
  console.log('🍪 Versuche Popups zu schließen...');
  try {
    await page.evaluate(() => {
      // Suche nach "Nicht jetzt" oder "Ablehnen" Buttons
      const buttons = document.querySelectorAll('button, [role="button"]');
      for (const btn of buttons) {
        const text = btn.textContent || '';
        if (text.includes('Nicht jetzt') || text.includes('Not Now') || 
            text.includes('Ablehnen') || text.includes('ablehnen') ||
            text.includes('Decline')) {
          console.log('Gefunden:', text);
          btn.click();
          return 'clicked: ' + text;
        }
      }
      return 'no button found';
    });
  } catch (e) {
    console.log('Popup Error:', e.message);
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  // ESC drücken falls noch Dialog offen
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 1000));
  
  // Screenshot 2: Nach Popup-Handling
  await page.screenshot({ path: 'test-ig-2-after-popup.png', fullPage: false });
  console.log('📸 Screenshot 2: test-ig-2-after-popup.png');
  
  // Daten extrahieren
  console.log('\n🔍 Extrahiere Daten...\n');
  
  const data = await page.evaluate(() => {
    const results = {
      pageTitle: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.content || null,
      ogTitle: document.querySelector('meta[property="og:title"]')?.content || null,
    };
    
    // Username aus URL
    const pathMatch = window.location.pathname.match(/^\/([^\/]+)/);
    results.handle = pathMatch ? '@' + pathMatch[1] : null;
    
    // Name aus Title
    const titleMatch = document.title.match(/^(.+?)\s*\(@/);
    results.name = titleMatch ? titleMatch[1].trim() : null;
    
    // Follower aus Liste
    const listItems = document.querySelectorAll('li');
    for (const li of listItems) {
      const text = li.textContent || '';
      if (text.includes('Follower')) {
        results.followerText = text;
        const match = text.match(/([\d.,]+)\s*Follower/i);
        results.followerCount = match ? match[1] : null;
        break;
      }
    }
    
    // Profilbild
    const profileImg = document.querySelector('img[alt*="Profilbild"], img[alt*="profile picture"]');
    results.profileImgAlt = profileImg?.alt || null;
    results.profileImgSrc = profileImg?.src ? 'FOUND (URL zu lang)' : null;
    
    // Alle Bilder im Header auflisten
    const header = document.querySelector('header');
    if (header) {
      const headerImgs = header.querySelectorAll('img');
      results.headerImages = Array.from(headerImgs).map(img => ({
        alt: img.alt,
        width: img.width,
        height: img.height,
        hasSrc: !!img.src
      }));
    }
    
    // Bio suchen
    if (header) {
      const spans = header.querySelectorAll('span');
      results.headerSpans = Array.from(spans).slice(0, 20).map(s => s.textContent?.trim()).filter(t => t && t.length > 0);
    }
    
    return results;
  });
  
  console.log('📊 Extrahierte Daten:');
  console.log('─'.repeat(50));
  console.log('Page Title:', data.pageTitle);
  console.log('Name:', data.name);
  console.log('Handle:', data.handle);
  console.log('Follower Text:', data.followerText);
  console.log('Follower Count:', data.followerCount);
  console.log('Profilbild Alt:', data.profileImgAlt);
  console.log('Profilbild Src:', data.profileImgSrc);
  console.log('─'.repeat(50));
  console.log('\n📷 Header Images:', JSON.stringify(data.headerImages, null, 2));
  console.log('\n📝 Header Spans (erste 20):');
  data.headerSpans?.forEach((s, i) => console.log(`  ${i+1}. "${s}"`));
  
  // Screenshot 3: Profilbild-Element
  console.log('\n📸 Versuche Profilbild-Screenshot...');
  const profileElement = await page.$('img[alt*="Profilbild"], img[alt*="profile picture"]');
  if (profileElement) {
    await profileElement.screenshot({ path: 'test-ig-3-profile-img.png' });
    console.log('✅ Screenshot 3: test-ig-3-profile-img.png');
  } else {
    console.log('❌ Profilbild-Element nicht gefunden');
    
    // Fallback: Header-Bereich
    const header = await page.$('header');
    if (header) {
      await header.screenshot({ path: 'test-ig-3-header.png' });
      console.log('📸 Fallback Screenshot: test-ig-3-header.png');
    }
  }
  
  console.log('\n✅ Test abgeschlossen! Browser bleibt 30 Sekunden offen...');
  await new Promise(r => setTimeout(r, 30000));
  
  await browser.close();
}

testInstagramScrape().catch(console.error);

