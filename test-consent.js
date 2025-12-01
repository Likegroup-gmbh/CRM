// test-consent.js
// Teste direkt die YouTube Consent-Seite

const puppeteer = require('puppeteer');

async function testConsent() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  YOUTUBE CONSENT TEST');
  console.log('═══════════════════════════════════════════\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50,
    args: [
      '--window-size=1920,1080',
      '--no-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Desktop User-Agent
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  
  try {
    // Step 1: Navigiere zu einem YouTube Short
    const youtubeUrl = 'https://www.youtube.com/shorts/tKnJxGEhdM8';
    console.log(`📡 Step 1: Navigiere zu ${youtubeUrl}`);
    await page.goto(youtubeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Step 2: Prüfe aktuelle URL
    const currentUrl = page.url();
    console.log(`📍 Step 2: Aktuelle URL: ${currentUrl}`);
    
    // Step 3: Prüfe ob wir auf consent.youtube.com sind
    if (currentUrl.includes('consent.youtube.com')) {
      console.log('✅ Step 3: Consent-Seite gefunden!');
      
      // Warte kurz
      await new Promise(r => setTimeout(r, 2000));
      
      // Step 4: Analysiere die Seite
      console.log('\n📋 Step 4: Analysiere Consent-Seite...');
      
      const pageInfo = await page.evaluate(() => {
        const info = {
          title: document.title,
          forms: [],
          buttons: [],
          iframes: []
        };
        
        // Alle Formulare
        document.querySelectorAll('form').forEach((form, i) => {
          info.forms.push({
            action: form.action,
            method: form.method,
            id: form.id
          });
        });
        
        // Alle Buttons
        document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach((btn, i) => {
          info.buttons.push({
            text: btn.textContent?.trim().substring(0, 50),
            ariaLabel: btn.getAttribute('aria-label'),
            type: btn.type,
            name: btn.name
          });
        });
        
        // Alle iframes
        document.querySelectorAll('iframe').forEach((iframe, i) => {
          info.iframes.push({
            src: iframe.src?.substring(0, 100),
            id: iframe.id
          });
        });
        
        return info;
      });
      
      console.log('\n📄 Seiten-Titel:', pageInfo.title);
      
      console.log('\n📝 Formulare:');
      pageInfo.forms.forEach((f, i) => {
        console.log(`  ${i+1}. action="${f.action}" method="${f.method}" id="${f.id}"`);
      });
      
      console.log('\n🔘 Buttons:');
      pageInfo.buttons.forEach((b, i) => {
        console.log(`  ${i+1}. "${b.text}" | aria="${b.ariaLabel}" | type="${b.type}" | name="${b.name}"`);
      });
      
      console.log('\n📺 IFrames:');
      pageInfo.iframes.forEach((f, i) => {
        console.log(`  ${i+1}. src="${f.src}" id="${f.id}"`);
      });
      
      // Step 5: Suche nach "Alle ablehnen" Button
      console.log('\n🔍 Step 5: Suche "Alle ablehnen" Button...');
      
      const rejectButton = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, [role="button"]');
        for (const btn of buttons) {
          const text = btn.textContent || '';
          const ariaLabel = btn.getAttribute('aria-label') || '';
          if (text.includes('Alle ablehnen') || text.includes('Reject all') ||
              ariaLabel.includes('Alle ablehnen') || ariaLabel.includes('Reject')) {
            return {
              found: true,
              text: text.trim().substring(0, 50),
              ariaLabel: ariaLabel,
              tagName: btn.tagName,
              className: btn.className
            };
          }
        }
        return { found: false };
      });
      
      if (rejectButton.found) {
        console.log('✅ Button gefunden!');
        console.log(`   Text: "${rejectButton.text}"`);
        console.log(`   aria-label: "${rejectButton.ariaLabel}"`);
        console.log(`   Tag: ${rejectButton.tagName}`);
        console.log(`   Klassen: ${rejectButton.className}`);
      } else {
        console.log('❌ Button NICHT gefunden!');
      }
      
    } else {
      console.log('❌ Step 3: KEINE Consent-Seite! Direkt zum Video weitergeleitet.');
      console.log('   Das bedeutet: Kein Cookie-Banner nötig für diese Region/Browser.');
    }
    
    // Screenshot
    const filename = `test-consent-${Date.now()}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`\n📸 Screenshot: ${filename}`);
    
    console.log('\n📍 Browser bleibt 30 Sekunden offen...');
    await new Promise(r => setTimeout(r, 30000));
    
  } catch (error) {
    console.error('❌ Fehler:', error.message);
  }
  
  await browser.close();
  console.log('🔒 Browser geschlossen.\n');
}

testConsent();

