// screenshots.cjs
// Puppeteer-Lauf gegen die frisch deployte Production: einmal einloggen,
// dann pro Route ein Viewport-Screenshot. Laeuft in der GitHub Action,
// nicht auf Netlify - deshalb kein @sparticuz/chromium, sondern das
// normale puppeteer aus den devDependencies.

const puppeteer = require('puppeteer');

const VIEWPORT = { width: 1280, height: 800 };
const MAX_ROUTES = 4;

async function login(page, baseUrl, email, password) {
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#loginEmail', { timeout: 30000 });
  await page.type('#loginEmail', email);
  await page.type('#loginPassword', password);
  await Promise.all([
    page.waitForSelector('.dashboard-greeting', { timeout: 45000 }),
    page.click('#loginForm button[type="submit"]')
  ]);
}

async function shootRoute(page, baseUrl, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle2', timeout: 60000 });
  // SPA rendert nach dem Laden asynchron nach; kurz warten, bis das Netz ruhig ist
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {});
  return page.screenshot({ type: 'png' });
}

/**
 * Gibt eine Map route -> Buffer zurueck. Routen, die fehlschlagen, fehlen
 * in der Map - der Aufrufer speichert den Post dann ohne diesen Shot.
 */
async function shootRoutes({ baseUrl, email, password, routes }) {
  const ziele = [...new Set(routes)].slice(0, MAX_ROUTES);
  const shots = new Map();
  if (!ziele.length) return shots;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await login(page, baseUrl, email, password);

    for (const route of ziele) {
      try {
        shots.set(route, await shootRoute(page, baseUrl, route));
        console.log(`📸 Screenshot ${route}`);
      } catch (err) {
        console.error(`⚠️ Screenshot ${route} fehlgeschlagen: ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  return shots;
}

module.exports = { shootRoutes };
