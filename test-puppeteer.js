// test-puppeteer.js
// Ausführen mit: node test-puppeteer.js <URL>

const puppeteer = require('puppeteer');

const testUrls = [
  'https://www.tiktok.com/@visssionary/video/7493012629217606945',
  'https://www.instagram.com/reel/DIFLGJuOkKC/',
  'https://www.youtube.com/shorts/dQw4w9WgXcQ'
];

async function testScreenshot(url) {
  console.log(`\n🔍 Teste: ${url}\n`);
  
  const browser = await puppeteer.launch({
    headless: false,  // SICHTBARER BROWSER!
    slowMo: 50,       // Leicht verlangsamt
    args: [
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Realistische User-Agent
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  
  try {
    console.log('📡 Lade Seite...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log('✅ Seite geladen!');
    
    // Cookie-Banner schließen durch Klick auf "Optionale Cookies ablehnen"
    console.log('🍪 Versuche Cookie-Banner zu schließen...');
    await new Promise(r => setTimeout(r, 3000)); // Warte bis Banner geladen
    
    try {
      // Debug: Zeige alle Elemente mit "cookie" im Namen
      const debug = await page.evaluate(() => {
        const info = [];
        
        // Suche nach Shadow DOMs
        const shadowHosts = document.querySelectorAll('*');
        for (const el of shadowHosts) {
          if (el.shadowRoot) {
            info.push(`Shadow DOM gefunden: ${el.tagName}`);
            const shadowButtons = el.shadowRoot.querySelectorAll('button');
            shadowButtons.forEach(btn => {
              info.push(`  Shadow Button: ${btn.textContent?.substring(0, 50)}`);
            });
          }
        }
        
        // Normale Buttons
        document.querySelectorAll('button').forEach(btn => {
          info.push(`Button: ${btn.textContent?.substring(0, 50)}`);
        });
        
        // Elemente mit "cookie" in class
        document.querySelectorAll('[class*="cookie"], [class*="Cookie"], [class*="banner"], [class*="Banner"]').forEach(el => {
          info.push(`Cookie-Element: ${el.tagName}.${el.className?.substring(0, 50)}`);
        });
        
        return info;
      });
      
      console.log('🔍 Debug Info:');
      debug.forEach(d => console.log('   ' + d));
      
      // Versuche Shadow DOM Buttons zu klicken
      const clicked = await page.evaluate(() => {
        // Erst Shadow DOM durchsuchen
        const shadowHosts = document.querySelectorAll('*');
        for (const el of shadowHosts) {
          if (el.shadowRoot) {
            const shadowButtons = el.shadowRoot.querySelectorAll('button');
            for (const btn of shadowButtons) {
              const text = btn.textContent || '';
              if (text.includes('ablehnen') || text.includes('Decline')) {
                btn.click();
                return 'shadow-ablehnen';
              }
              if (text.includes('erlauben') || text.includes('Accept') || text.includes('Allow')) {
                btn.click();
                return 'shadow-erlauben';
              }
            }
          }
        }
        
        // Dann normale Buttons
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
          const text = btn.textContent || '';
          if (text.includes('ablehnen') || text.includes('Decline')) {
            btn.click();
            return 'ablehnen';
          }
        }
        for (const btn of allButtons) {
          const text = btn.textContent || '';
          if (text.includes('erlauben') || text.includes('Accept') || text.includes('Allow')) {
            btn.click();
            return 'erlauben';
          }
        }
        
        return false;
      });
      
      if (clicked) {
        console.log(`✅ Cookie-Button geklickt: "${clicked}"`);
        await new Promise(r => setTimeout(r, 1500));
      } else {
        console.log('⚠️ Kein Cookie-Button gefunden');
      }
    } catch (e) {
      console.log('⚠️ Fehler beim Cookie-Banner:', e.message);
    }
    
    // Tastenkombinationen-Popup schließen (X-Button)
    console.log('🧹 Schließe Tastenkombinationen-Popup...');
    try {
      await page.evaluate(() => {
        // X-Button im Tastenkombinationen-Popup
        const xButtons = document.querySelectorAll('[class*="XMarkWrapper"], [class*="e1jppm6i4"], [class*="DivXMark"]');
        for (const btn of xButtons) {
          btn.click();
        }
        
        // Popup ausblenden
        document.querySelectorAll('[class*="KeyboardShortcut"], [class*="FixedBottomContainer"]').forEach(el => {
          el.style.display = 'none';
        });
      });
      console.log('✅ Tastenkombinationen-Popup geschlossen!');
    } catch (e) {}
    
    // Captcha-Modal ausblenden
    console.log('🧹 Blende Captcha-Modal aus...');
    try {
      await page.evaluate(() => {
        // Captcha/Puzzle-Modal ausblenden
        document.querySelectorAll('[class*="captcha"], [class*="Captcha"], [class*="verify"], [class*="Verify"]').forEach(el => {
          el.style.display = 'none';
        });
        
        // Modal-Overlays ausblenden
        document.querySelectorAll('[class*="modal"], [class*="Modal"], [role="dialog"]').forEach(el => {
          if (el.textContent?.includes('Puzzle') || el.textContent?.includes('Schieberegler')) {
            el.style.display = 'none';
          }
        });
        
        // Overlay/Backdrop ausblenden
        document.querySelectorAll('[class*="overlay"], [class*="Overlay"], [class*="backdrop"], [class*="Backdrop"]').forEach(el => {
          el.style.display = 'none';
        });
      });
      console.log('✅ Captcha ausgeblendet!');
    } catch (e) {}
    
    // Kurz warten
    await new Promise(r => setTimeout(r, 500));
    console.log('');
    console.log('📍 Schau dir den Browser an:');
    console.log('   - Welche Popups/Modals siehst du?');
    console.log('   - Welche Buttons könnten geklickt werden?');
    console.log('   - Öffne DevTools (F12) und inspiziere störende Elemente');
    console.log('');
    console.log('📸 Mache sofort Screenshot...');
    
    // Nur 1 Sekunde warten damit alles gerendert ist
    await new Promise(r => setTimeout(r, 1000));
    
    // Screenshot nur vom Video-Element machen
    const filename = `test-screenshot-${Date.now()}.png`;
    
    try {
      // Versuche nur das Video-Element zu screenshotten (data-e2e="detail-video")
      const videoElement = await page.$('[data-e2e="detail-video"]') 
                        || await page.$('[class*="DivVideoWrapper"]')
                        || await page.$('#main-content-video_detail');
      
      if (videoElement) {
        await videoElement.screenshot({ path: filename });
        console.log(`📸 Video-Element Screenshot gespeichert: ${filename}`);
      } else {
        // Fallback: Ganzen Viewport screenshotten
        console.log('⚠️ Video-Element nicht gefunden, mache Fullscreen-Screenshot...');
        await page.screenshot({ path: filename, fullPage: false });
        console.log(`📸 Fullscreen Screenshot gespeichert: ${filename}`);
      }
    } catch (e) {
      console.log('⚠️ Screenshot-Fehler:', e.message);
      await page.screenshot({ path: filename, fullPage: false });
      console.log(`📸 Fallback Screenshot gespeichert: ${filename}`);
    }
    
  } catch (error) {
    console.error('❌ Fehler:', error.message);
  }
  
  await browser.close();
  console.log('🔒 Browser geschlossen.\n');
}

// Hauptlogik
const urlArg = process.argv[2];

if (urlArg) {
  // Einzelne URL testen
  testScreenshot(urlArg);
} else {
  console.log('═══════════════════════════════════════════');
  console.log('  PUPPETEER SCREENSHOT TESTER');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('Verwendung:');
  console.log('  node test-puppeteer.js <URL>');
  console.log('');
  console.log('Beispiele:');
  console.log('  node test-puppeteer.js "https://www.tiktok.com/@user/video/123"');
  console.log('  node test-puppeteer.js "https://www.instagram.com/reel/ABC123/"');
  console.log('');
  console.log('Test-URLs (alle nacheinander):');
  testUrls.forEach((url, i) => console.log(`  ${i+1}. ${url}`));
  console.log('');
  console.log('Starte alle Test-URLs in 3 Sekunden...');
  
  setTimeout(async () => {
    for (const url of testUrls) {
      await testScreenshot(url);
    }
    console.log('✅ Alle Tests abgeschlossen!');
  }, 3000);
}

