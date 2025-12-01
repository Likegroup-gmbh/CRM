// test-youtube.js
// Ausführen mit: node test-youtube.js <URL>

const puppeteer = require('puppeteer');
const fs = require('fs');

async function testYouTube(url) {
  console.log(`\n🔍 Teste YouTube: ${url}\n`);
  
  const browser = await puppeteer.launch({
    headless: false,  // SICHTBARER BROWSER!
    slowMo: 50,
    args: [
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  
  try {
    console.log('📡 Lade YouTube-Seite...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log('✅ Seite geladen!');
    
    // Warte auf Cookie-Banner
    console.log('🍪 Warte auf Cookie-Banner...');
    await new Promise(r => setTimeout(r, 3000));
    
    // === FRAME ANALYSE ===
    console.log('\n═══════════════════════════════════════════');
    console.log('  FRAME ANALYSE');
    console.log('═══════════════════════════════════════════');
    
    const frames = page.frames();
    console.log(`\n🔍 Gefunden: ${frames.length} Frames\n`);
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const frameUrl = frame.url();
      console.log(`\n--- Frame ${i+1}: ${frameUrl.substring(0, 80)} ---`);
      
      try {
        const frameInfo = await frame.evaluate(() => {
          const info = { buttons: [], html: '' };
          
          // Alle Buttons sammeln
          document.querySelectorAll('button, [role="button"]').forEach((btn, idx) => {
            const text = btn.textContent?.trim().substring(0, 80) || '';
            const ariaLabel = btn.getAttribute('aria-label') || '';
            const classes = btn.className || '';
            const jsname = btn.getAttribute('jsname') || '';
            info.buttons.push({
              idx: idx + 1,
              text: text,
              ariaLabel: ariaLabel,
              classes: classes.substring(0, 60),
              jsname: jsname
            });
          });
          
          // Suche nach Cookie/Consent Elementen
          const consentElements = document.querySelectorAll('[class*="consent"], [class*="cookie"], [id*="consent"], [id*="cookie"], tp-yt-paper-dialog, ytd-consent-bump-v2-lightbox');
          if (consentElements.length > 0) {
            info.html = consentElements[0].outerHTML.substring(0, 2000);
          }
          
          return info;
        });
        
        console.log(`  Buttons: ${frameInfo.buttons.length}`);
        frameInfo.buttons.forEach(btn => {
          const highlight = (btn.text.includes('ablehnen') || btn.text.includes('Reject') || 
                           btn.ariaLabel.includes('ablehnen') || btn.ariaLabel.includes('Reject')) ? '🎯' : '  ';
          console.log(`  ${highlight} ${btn.idx}. "${btn.text.substring(0, 40)}" | aria="${btn.ariaLabel.substring(0, 30)}" | jsname="${btn.jsname}"`);
        });
        
        if (frameInfo.html) {
          console.log(`\n  📄 Consent HTML gefunden! Speichere...`);
          fs.writeFileSync(`youtube-consent-frame${i}.html`, frameInfo.html);
        }
        
      } catch (e) {
        console.log(`  ⚠️ Frame nicht zugänglich: ${e.message.substring(0, 50)}`);
      }
    }
    
    // === MAIN PAGE HTML DUMP ===
    console.log('\n═══════════════════════════════════════════');
    console.log('  MAIN PAGE CONSENT SUCHE');
    console.log('═══════════════════════════════════════════');
    
    const mainHtml = await page.evaluate(() => {
      // Suche nach typischen YouTube Consent Elementen
      const selectors = [
        'tp-yt-paper-dialog',
        'ytd-consent-bump-v2-lightbox', 
        '[class*="consent"]',
        '[class*="cookie"]',
        'ytd-popup-container',
        '#dialog',
        '.ytd-popup-container'
      ];
      
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.innerHTML.includes('ablehnen')) {
          return { selector: sel, html: el.outerHTML.substring(0, 5000) };
        }
      }
      
      // Komplettes body HTML für Analyse
      return { selector: 'none', html: document.body.innerHTML.substring(0, 10000) };
    });
    
    console.log(`\n📄 Consent gefunden mit Selector: ${mainHtml.selector}`);
    fs.writeFileSync('youtube-page-dump.html', mainHtml.html);
    console.log('📄 HTML gespeichert in: youtube-page-dump.html');
    
    // === KLICK VERSUCH ===
    console.log('\n═══════════════════════════════════════════');
    console.log('  KLICK VERSUCH');
    console.log('═══════════════════════════════════════════');
    
    let clicked = false;
    
    // Versuche in allen Frames
    for (const frame of frames) {
      if (clicked) break;
      try {
        clicked = await frame.evaluate(() => {
          const buttons = document.querySelectorAll('button, [role="button"]');
          for (const btn of buttons) {
            const text = btn.textContent || '';
            const ariaLabel = btn.getAttribute('aria-label') || '';
            if (text.includes('Alle ablehnen') || text.includes('Reject all') ||
                ariaLabel.includes('Alle ablehnen') || ariaLabel.includes('Reject all')) {
              btn.click();
              return true;
            }
          }
          return false;
        });
        if (clicked) {
          console.log(`✅ Geklickt in Frame: ${frame.url().substring(0, 50)}`);
        }
      } catch (e) {}
    }
    
    if (!clicked) {
      console.log('⚠️ "Alle ablehnen" Button nicht gefunden');
    }
    
    // WICHTIG: Nach Cookie-Klick warten bis Seite neu lädt!
    if (clicked) {
      console.log('⏳ Warte auf Navigation nach Cookie-Klick...');
      try {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
        console.log('✅ Navigation abgeschlossen');
      } catch (e) {
        console.log('⚠️ Keine Navigation erkannt, warte trotzdem...');
      }
      await new Promise(r => setTimeout(r, 3000));
    }
    
    // Warte auf Video-Element
    console.log('⏳ Warte auf Video...');
    try {
      await page.waitForSelector('video', { timeout: 10000 });
      
      // Versuche Video zu starten
      await page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          video.muted = true;
          video.play().catch(() => {});
        }
      });
      
      // Warte bis Video Frames hat
      await page.waitForFunction(() => {
        const video = document.querySelector('video');
        return video && video.readyState >= 3;
      }, { timeout: 10000 });
      
      console.log('✅ Video geladen!');
      await new Promise(r => setTimeout(r, 1000)); // Extra Zeit für gutes Frame
      
    } catch (e) {
      console.log('⚠️ Video nicht geladen:', e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
    
    // Screenshot
    const filename = `test-youtube-${Date.now()}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`\n📸 Screenshot gespeichert: ${filename}`);
    
    console.log('\n📍 Browser bleibt offen für 60 Sekunden...');
    console.log('   - Öffne DevTools (F12)');
    console.log('   - Inspiziere den Cookie-Banner');
    console.log('   - Schau nach dem Button-Selector\n');
    
    await new Promise(r => setTimeout(r, 60000));
    
  } catch (error) {
    console.error('❌ Fehler:', error.message);
  }
  
  await browser.close();
  console.log('🔒 Browser geschlossen.\n');
}

// Hauptlogik
const urlArg = process.argv[2];

if (urlArg) {
  testYouTube(urlArg);
} else {
  console.log('═══════════════════════════════════════════');
  console.log('  YOUTUBE PUPPETEER TESTER');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('Verwendung:');
  console.log('  node test-youtube.js <URL>');
  console.log('');
  console.log('Beispiel:');
  console.log('  node test-youtube.js "https://www.youtube.com/shorts/gZJii6g2PrI"');
  console.log('');
}

