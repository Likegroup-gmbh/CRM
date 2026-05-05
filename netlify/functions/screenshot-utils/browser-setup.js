const chromium = require('@sparticuz/chromium');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { getRandomUserAgent, isMobilePlatform, VIEWPORTS } = require('./constants');

const stealth = StealthPlugin({
  enabledEvasions: new Set([
    'chrome.app',
    'chrome.csi',
    'chrome.loadTimes',
    'chrome.runtime',
    'defaultArgs',
    'iframe.contentWindow',
    'media.codecs',
    'navigator.hardwareConcurrency',
    'navigator.languages',
    'navigator.permissions',
    'navigator.plugins',
    'navigator.webdriver',
    'sourceurl',
    'user-agent-override',
    'webgl.vendor',
    'window.outerdimensions',
    'navigator.vendor'
  ])
});
puppeteerExtra.use(stealth);

async function launchBrowser(platform) {
  const isMobile = isMobilePlatform(platform);
  const viewport = isMobile ? VIEWPORTS.mobile : VIEWPORTS.desktop;

  const browser = await puppeteerExtra.launch({
    args: [
      ...chromium.args,
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--window-size=1920,1080'
    ],
    defaultViewport: viewport,
    executablePath: await chromium.executablePath(),
    headless: 'new',
    ignoreDefaultArgs: ['--enable-automation']
  });

  return browser;
}

async function setupPage(browser, platform) {
  const isMobile = isMobilePlatform(platform);
  const page = await browser.newPage();

  const userAgent = getRandomUserAgent(isMobile);
  console.log(`🎭 User-Agent: ${userAgent.substring(0, 50)}...`);
  await page.setUserAgent(userAgent);

  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
  });

  await injectAntiBotScripts(page);

  if (platform !== 'youtube') {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['font', 'websocket'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  return page;
}

async function injectAntiBotScripts(page) {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
      ]
    });
    Object.defineProperty(navigator, 'language', { get: () => 'de-DE' });
    Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    const originalDateTimeFormat = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function(locale, options) {
      if (options && options.timeZone === undefined) {
        options = { ...options, timeZone: 'Europe/Berlin' };
      }
      return new originalDateTimeFormat(locale, options);
    };
    Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;

    Date.prototype.getTimezoneOffset = function() {
      return -60;
    };

    window.chrome = {
      runtime: {},
      loadTimes: () => ({}),
      csi: () => ({}),
      app: {}
    };

    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Google Inc. (Intel)';
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter.call(this, parameter);
    };

    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false
      })
    });

    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });
}

module.exports = { launchBrowser, setupPage };
