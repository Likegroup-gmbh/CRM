// Netlify Function: Screenshot-Generierung mit Puppeteer
// OPTIMIERT FÜR TIKTOK - getestet und funktioniert!

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { createClient } = require('@supabase/supabase-js');

/**
 * Plattform anhand der URL erkennen
 */
function detectPlatform(url) {
  if (!url) return 'other';
  const urlLower = url.toLowerCase();
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  if (urlLower.includes('tiktok.com')) return 'tiktok';
  if (urlLower.includes('instagram.com')) return 'instagram';
  return 'other';
}

/**
 * Netlify Function Handler
 */
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  let browser;
  
  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL required' }) };
    }

    // Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase config missing');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const platform = detectPlatform(url);
    console.log(`📸 Screenshot: ${platform} - ${url}`);

    // Browser starten - Desktop Viewport (funktioniert besser für TikTok)
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ],
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    
    // Desktop User-Agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigation
    console.log('🌐 Navigating...');
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 25000 
    });

    // Warte bis Seite geladen
    await new Promise(r => setTimeout(r, 3000));

    // ========== TIKTOK SPEZIFISCH ==========
    if (platform === 'tiktok') {
      console.log('🍪 TikTok: Cookie-Banner schließen...');
      
      // Cookie-Banner im Shadow DOM schließen
      try {
        const cookieClicked = await page.evaluate(() => {
          const shadowHosts = document.querySelectorAll('*');
          for (const el of shadowHosts) {
            if (el.shadowRoot) {
              const shadowButtons = el.shadowRoot.querySelectorAll('button');
              for (const btn of shadowButtons) {
                const text = btn.textContent || '';
                if (text.includes('ablehnen') || text.includes('Decline')) {
                  btn.click();
                  return 'ablehnen';
                }
              }
              for (const btn of shadowButtons) {
                const text = btn.textContent || '';
                if (text.includes('erlauben') || text.includes('Accept') || text.includes('Allow')) {
                  btn.click();
                  return 'erlauben';
                }
              }
            }
          }
          return false;
        });
        if (cookieClicked) console.log(`✅ Cookie-Button: ${cookieClicked}`);
      } catch (e) {
        console.log('Cookie handling error:', e.message);
      }

      await new Promise(r => setTimeout(r, 1000));

      // Tastenkombinationen-Popup schließen
      console.log('🧹 TikTok: Popups schließen...');
      try {
        await page.evaluate(() => {
          // X-Button im Tastenkombinationen-Popup
          document.querySelectorAll('[class*="XMarkWrapper"], [class*="e1jppm6i4"]').forEach(el => el.click());
          // Popup ausblenden
          document.querySelectorAll('[class*="KeyboardShortcut"], [class*="FixedBottomContainer"]').forEach(el => {
            el.style.display = 'none';
          });
        });
      } catch (e) {}

      // Captcha/Modal ausblenden
      try {
        await page.evaluate(() => {
          document.querySelectorAll('[class*="captcha"], [class*="Captcha"], [class*="verify"], [class*="Verify"]').forEach(el => {
            el.style.display = 'none';
          });
          document.querySelectorAll('[class*="modal"], [class*="Modal"], [role="dialog"]').forEach(el => {
            if (el.textContent?.includes('Puzzle') || el.textContent?.includes('Schieberegler')) {
              el.style.display = 'none';
            }
          });
          document.querySelectorAll('[class*="overlay"], [class*="Overlay"], [class*="backdrop"]').forEach(el => {
            el.style.display = 'none';
          });
        });
      } catch (e) {}

      await new Promise(r => setTimeout(r, 500));
    }

    // ========== INSTAGRAM SPEZIFISCH ==========
    if (platform === 'instagram') {
      console.log('📸 Instagram: Banner schließen...');
      try {
        await page.click('button:has-text("Not Now")').catch(() => {});
        await page.click('a:has-text("Continue on web")').catch(() => {});
        await page.evaluate(() => {
          document.querySelectorAll('[role="dialog"]').forEach(el => el.style.display = 'none');
        });
      } catch (e) {}
    }

    // ========== SCREENSHOT ==========
    console.log('📸 Taking screenshot...');
    let screenshotBuffer;
    
    // Plattform-spezifische Selektoren
    const selectors = {
      tiktok: '[data-e2e="detail-video"]',
      instagram: 'article, main article, [role="presentation"]',
      youtube: '#movie_player, video',
      other: 'body'
    };
    
    const selector = selectors[platform];
    
    try {
      const element = await page.$(selector);
      
      if (element) {
        screenshotBuffer = await element.screenshot({
          type: 'jpeg',
          quality: 85
        });
        console.log('✅ Element screenshot taken');
      } else {
        throw new Error('Element not found');
      }
    } catch (e) {
      console.log('⚠️ Fallback to viewport screenshot');
      screenshotBuffer = await page.screenshot({
        type: 'jpeg',
        quality: 85,
        fullPage: false
      });
    }

    // Zu Supabase hochladen
    const fileName = `screenshot-${platform}-${Date.now()}.jpg`;
    const filePath = `screenshots/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('strategie-screenshots')
      .upload(filePath, screenshotBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600'
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from('strategie-screenshots')
      .getPublicUrl(filePath);

    console.log(`✅ Done: ${publicUrl}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        screenshot_url: publicUrl,
        platform
      })
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  } finally {
    if (browser) await browser.close();
  }
};
