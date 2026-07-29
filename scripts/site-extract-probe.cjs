// site-extract-probe.cjs
// Prueft die Extraktions-Pipeline gegen echte Seiten, ohne Claude und ohne
// Supabase. Zeigt pro Seite: welcher Weg genutzt wurde, ob das Impressum
// gefunden wurde, welche Logo-Kandidaten es gibt und wie viel Text ankommt.
//
// Aufruf: node scripts/site-extract-probe.cjs [url ...]
// Ohne Argumente laeuft eine Standardliste gemischter Tech-Stacks.

const { assessHtml } = require('../netlify/functions/site-extract-utils/page-fetcher');
const { distill } = require('../netlify/functions/site-extract-utils/html-distill');
const { pickLogo } = require('../netlify/functions/site-extract-utils/logo');
const { getSpec } = require('../netlify/functions/_shared/extract-specs');

const DEFAULT_URLS = [
  'https://www.true-fruits.com',
  'https://www.einhorn.my',
  'https://www.veganz.de',
  'https://www.tchibo.de',
  'https://www.personio.de',
  'https://www.sennheiser.com'
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
};

function detectStack(html) {
  const h = html.toLowerCase();
  if (h.includes('cdn.shopify.com') || h.includes('shopify-features')) return 'Shopify';
  if (h.includes('assets.website-files.com') || h.includes('webflow.js') || h.includes('data-wf-page')) return 'Webflow';
  if (h.includes('wp-content') || h.includes('wp-json')) return 'WordPress';
  if (h.includes('_next/static')) return 'Next.js';
  if (h.includes('__nuxt')) return 'Nuxt';
  if (h.includes('typo3')) return 'TYPO3';
  return 'unbekannt';
}

async function grab(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: controller.signal });
    const html = Buffer.from(await res.arrayBuffer()).toString('utf8');
    return { html, status: res.status, finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

async function probe(url) {
  const spec = getSpec('unternehmen');
  console.log(`\n${'='.repeat(78)}\n${url}`);

  let page;
  try {
    page = await grab(url);
  } catch (err) {
    console.log(`  ABRUF FEHLGESCHLAGEN: ${err.message}`);
    return { url, ok: false };
  }

  const verdict = assessHtml(page.html, page.status);
  const d = distill(page.html, page.finalUrl, { followLinks: spec.followLinks, withLogo: true });

  console.log(`  Stack:            ${detectStack(page.html)}`);
  console.log(`  HTTP:             ${page.status}${page.finalUrl !== url ? ` -> ${page.finalUrl}` : ''}`);
  console.log(`  Gate:             ${verdict.ok ? 'fetch reicht' : `Browser noetig (${verdict.reason})`}`);
  console.log(`  Titel:            ${d.title.slice(0, 70) || '-'}`);
  console.log(`  Text:             ${d.text.length} Zeichen`);
  console.log(`  JSON-LD-Bloecke:  ${d.jsonLd.length}${d.jsonLd.length ? ` (${[...new Set(d.jsonLd.map(n => n['@type']).filter(Boolean))].join(', ')})` : ''}`);
  console.log(`  Impressum-Link:   ${d.links.impressum || 'NICHT GEFUNDEN'}`);
  console.log(`  Logo-Kandidaten:  ${d.logoCandidates.length}`);
  d.logoCandidates.slice(0, 3).forEach(c => console.log(
    `      ${String(c.score).padStart(3)} ${c.reason.padEnd(17)} ${(c.url || `<svg> ${c.svg.length} Zeichen`).slice(0, 90)}`
  ));

  // Adress-Rohsignale: zeigt, ob im Text ueberhaupt etwas zu holen ist
  let impressumText = 0;
  if (d.links.impressum) {
    try {
      const sub = await grab(d.links.impressum);
      const subD = distill(sub.html, sub.finalUrl);
      impressumText = subD.text.length;
      const plz = subD.text.match(/\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß-]+/);
      console.log(`  Impressum-Text:   ${impressumText} Zeichen`);
      console.log(`  PLZ+Ort im Text:  ${plz ? plz[0] : 'nicht erkennbar'}`);
    } catch (err) {
      console.log(`  Impressum-Abruf:  fehlgeschlagen (${err.message})`);
    }
  }

  let logo = null;
  if (d.logoCandidates.length) {
    logo = await pickLogo(d.logoCandidates);
    console.log(`  Logo:             ${logo ? `OK, ${Math.round(Buffer.from(logo.base64, 'base64').length / 1024)} KB PNG` : 'kein Kandidat konvertierbar'}`);
  }

  return {
    url,
    ok: true,
    stack: detectStack(page.html),
    gate: verdict.ok,
    text: d.text.length,
    jsonLd: d.jsonLd.length,
    impressum: Boolean(d.links.impressum),
    impressumText,
    logo: Boolean(logo)
  };
}

(async () => {
  const urls = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_URLS;
  const results = [];
  for (const url of urls) results.push(await probe(url));

  console.log(`\n${'='.repeat(78)}\nZUSAMMENFASSUNG (${results.length} Seiten)\n`);
  console.log('Stack        fetch  JSON-LD  Impressum  Logo   Text  URL');
  for (const r of results) {
    if (!r.ok) { console.log(`FEHLER                                          ${r.url}`); continue; }
    console.log(
      `${r.stack.padEnd(12)} ${(r.gate ? 'ja' : 'NEIN').padEnd(6)} ` +
      `${String(r.jsonLd).padEnd(8)} ${(r.impressum ? 'ja' : 'NEIN').padEnd(10)} ` +
      `${(r.logo ? 'ja' : 'NEIN').padEnd(6)} ${String(r.text).padStart(5)}  ${r.url}`
    );
  }
  const ok = results.filter(r => r.ok);
  console.log(`\nfetch reicht: ${ok.filter(r => r.gate).length}/${ok.length}` +
    ` | Impressum: ${ok.filter(r => r.impressum).length}/${ok.length}` +
    ` | Logo: ${ok.filter(r => r.logo).length}/${ok.length}`);
})();
