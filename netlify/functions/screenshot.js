const { createClient } = require('@supabase/supabase-js');
const { detectPlatform } = require('./screenshot-utils/constants');
const { launchBrowser, setupPage } = require('./screenshot-utils/browser-setup');
const { handleInstagramPopups, takeInstagramScreenshot } = require('./screenshot-utils/platform-instagram');
const { handleTikTokPopups, takeTikTokScreenshot } = require('./screenshot-utils/platform-tiktok');
const { handleYouTubeInteraction, takeYouTubeScreenshot } = require('./screenshot-utils/platform-youtube');

function getAllowedOrigin(requestOrigin) {
  const siteUrl = process.env.URL || '';
  const deployPrimeUrl = process.env.DEPLOY_PRIME_URL || '';
  const allowed = [siteUrl, deployPrimeUrl].filter(Boolean);
  if (allowed.includes(requestOrigin)) return requestOrigin;
  if (requestOrigin && /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/.test(requestOrigin)) return requestOrigin;
  return siteUrl || 'null';
}

async function verifyAuth(event) {
  const authHeader = (event.headers || {}).authorization || (event.headers || {}).Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

exports.handler = async (event, context) => {
  const requestOrigin = (event.headers || {}).origin || '';
  const origin = getAllowedOrigin(requestOrigin);
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  const user = await verifyAuth(event);
  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let browser;

  try {
    const { url, debug } = JSON.parse(event.body || '{}');
    if (!url) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL required' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase config missing');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const platform = detectPlatform(url);
    console.log(`📸 Screenshot: ${platform} - ${url}`);

    // Browser starten + Seite konfigurieren
    console.log('🥷 Starte Browser mit Stealth Mode...');
    browser = await launchBrowser(platform);
    const page = await setupPage(browser, platform);

    // Instagram /p/ -> /reels/ Rewrite (Instagram blockiert /p/ fuer nicht-eingeloggte User)
    let navigateUrl = url;
    if (platform === 'instagram' && url.includes('/p/')) {
      navigateUrl = url.replace(/\/p\//, '/reels/').split('?')[0];
      console.log(`🔄 Instagram /p/ -> /reels/: ${navigateUrl}`);
    }

    // Navigation
    console.log('🌐 Navigating...');
    await page.goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

    // Plattform-spezifisches Handling + Screenshot
    const ctx = { debug, supabase, supabaseUrl, headers };
    let result;

    if (platform === 'instagram') {
      await handleInstagramPopups(page, navigateUrl);
      result = await takeInstagramScreenshot(page, ctx);
      if (result.debugResponse) return result.debugResponse;
    } else if (platform === 'tiktok') {
      await handleTikTokPopups(page);
      result = await takeTikTokScreenshot(page);
    } else if (platform === 'youtube') {
      await handleYouTubeInteraction(page);
      result = await takeYouTubeScreenshot(page, ctx);
    } else {
      // Fallback: Viewport-Screenshot
      result = {
        screenshotBuffer: await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false })
      };
    }

    // Upload zu Supabase
    const fileName = `screenshot-${platform}-${Date.now()}.jpg`;
    const filePath = `screenshots/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('strategie-screenshots')
      .upload(filePath, result.screenshotBuffer, {
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
      body: JSON.stringify({ success: true, screenshot_url: publicUrl, platform })
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
