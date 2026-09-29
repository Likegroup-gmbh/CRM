// Im Lambda kommt das Chromium-Binary zur Laufzeit aus dem Release-Tarball
// statt aus dem Function-Zip: ~63 MB weniger Upload pro Chromium-Function
// (das war der Deploy-Haenger). Lokal bleibt das Binary im Paket.
// CHROMIUM_PACK_URL erlaubt einen eigenen Mirror, falls GitHub klemmt.
//
// Eigenes Modul ohne Side Effects: browser-setup.js und creator-scrape.js
// registrieren beim Laden jeweils ein Stealth-Plugin auf derselben
// puppeteer-extra-Instanz - ein Import von browser-setup nur fuer diesen
// Pfad wuerde das Plugin doppelt anmelden.

const chromium = require('@sparticuz/chromium');

const CHROMIUM_PACK_URL = process.env.CHROMIUM_PACK_URL
  || 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

function chromiumExecutablePath() {
  return process.env.AWS_LAMBDA_FUNCTION_NAME
    ? chromium.executablePath(CHROMIUM_PACK_URL)
    : chromium.executablePath();
}

module.exports = { chromiumExecutablePath };
