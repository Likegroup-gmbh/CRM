// Im Lambda kommt das Chromium-Binary zur Laufzeit aus dem Release-Tarball
// statt aus dem Function-Zip: ~63 MB weniger Upload pro Chromium-Function
// (das war der Deploy-Haenger). Lokal bleibt das Binary im Paket.
// CHROMIUM_PACK_URL erlaubt einen eigenen Mirror, falls GitHub klemmt.
//
// Eigenes Modul ohne Side Effects: browser-setup.js und creator-scrape.js
// registrieren beim Laden jeweils ein Stealth-Plugin auf derselben
// puppeteer-extra-Instanz - ein Import von browser-setup nur fuer diesen
// Pfad wuerde das Plugin doppelt anmelden.

const fs = require('fs');
const chromium = require('@sparticuz/chromium');

const CHROMIUM_PACK_URL = process.env.CHROMIUM_PACK_URL
  || 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function chromiumExecutablePath() {
  return process.env.AWS_LAMBDA_FUNCTION_NAME
    ? chromium.executablePath(CHROMIUM_PACK_URL)
    : chromium.executablePath();
}

/**
 * Installiertes Chrome fuer `npm run dev:functions`: das Binary von @sparticuz/chromium ist
 * Linux-only und startet auf dem Mac nicht (spawn ENOEXEC). Entschieden wird am Betriebssystem,
 * nicht an AWS_LAMBDA_FUNCTION_NAME: die Netlify CLI setzt das lokal auch. CHROME_PATH
 * ueberschreibt. Mit diesem Chrome gelten die Lambda-Args (chromium.args) nicht.
 */
function lokalesChrome() {
  if (process.platform !== 'darwin') return null;
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  return fs.existsSync(MAC_CHROME) ? MAC_CHROME : null;
}

module.exports = { chromiumExecutablePath, lokalesChrome };
