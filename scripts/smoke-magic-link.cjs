#!/usr/bin/env node
'use strict';

// Smoke-Test: Magic-Link-Registrierung (Kunden-Einladung) auf der Live-Domain.
//
// Faengt genau den Fehler ab, bei dem Datenbank und ausgeliefertes Frontend
// auseinanderlaufen (27.10.2026: Migration sperrt magic_links fuer anon, Live-Seite
// liest die Tabelle noch -> "Link ungueltig").
//
// Prueft ohne Secrets und ohne Schreibzugriff:
//   1. Registrierungsseite laedt, kein rohes ${icon()}
//   2. Das Bundle der Seite ruft magic_link_vorschau auf und liest magic_links nicht direkt
//   3. RPC magic_link_vorschau antwortet als anon (Supabase-URL und Anon-Key stehen
//      oeffentlich im Bundle)
//   4. magic_links ist fuer anon nicht lesbar
//
// Nutzung:
//   node scripts/smoke-magic-link.cjs
//   SMOKE_BASE_URL=https://v2--site.netlify.app node scripts/smoke-magic-link.cjs
//   SMOKE_RETRIES=6 SMOKE_RETRY_WAIT_S=60 node scripts/smoke-magic-link.cjs   (nach Deploy)
//
// Der Signup-Trigger (Token -> Rolle kunde, freigeschaltet) wird separat geprueft:
// supabase/tests/magic_link_signup_rollback.sql

const {
  checkHtml,
  checkEntryBundle,
  extractSupabaseConfig,
  checkRpcResponse,
  checkTableClosed,
} = require('./smoke/magic-link-checks.cjs');

const BASE_URL = (process.env.SMOKE_BASE_URL || 'https://base.likegroup.de').replace(/\/$/, '');
const PAGE = '/src/auth/magic-register.html';
const RETRIES = Number(process.env.SMOKE_RETRIES || 1);
const RETRY_WAIT_S = Number(process.env.SMOKE_RETRY_WAIT_S || 30);
const BOGUS_TOKEN = '0'.repeat(48);

async function getText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  return { status: res.status, text: await res.text() };
}

async function getJson(url, init) {
  const res = await fetch(url, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    // Antwort ohne JSON-Body
  }
  return { status: res.status, body };
}

function scriptUrls(html) {
  const urls = new Set();
  const re = /<(?:script|link)[^>]+(?:src|href)="([^"]+\.js)"/g;
  let m;
  while ((m = re.exec(html))) urls.add(new URL(m[1], BASE_URL).href);
  return [...urls];
}

async function einLauf() {
  const fehler = [];

  const page = await getText(`${BASE_URL}${PAGE}?token=${BOGUS_TOKEN}`);
  if (page.status !== 200) return [`${PAGE} antwortet ${page.status}`];
  fehler.push(...checkHtml(page.text));

  const entryMatch = page.text.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
  const urls = scriptUrls(page.text);
  const bundles = [];
  for (const url of urls) {
    const res = await getText(url);
    if (res.status === 200) bundles.push(res.text);
    if (entryMatch && url === new URL(entryMatch[1], BASE_URL).href) {
      if (res.status !== 200) fehler.push(`Einstiegs-Bundle antwortet ${res.status}`);
      else fehler.push(...checkEntryBundle(res.text));
    }
  }

  const { url, anonKey } = extractSupabaseConfig(bundles);
  if (!url || !anonKey) {
    fehler.push('Supabase-URL oder Anon-Key nicht im Bundle gefunden');
    return fehler;
  }
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  const rpc = await getJson(`${url}/rest/v1/rpc/magic_link_vorschau`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: BOGUS_TOKEN }),
  });
  fehler.push(...checkRpcResponse(rpc.status, rpc.body));

  const tabelle = await getJson(`${url}/rest/v1/magic_links?select=id&limit=1`, { headers });
  fehler.push(...checkTableClosed(tabelle.status, tabelle.body));

  return fehler;
}

async function main() {
  let fehler = [];
  for (let versuch = 1; versuch <= RETRIES; versuch += 1) {
    try {
      fehler = await einLauf();
    } catch (err) {
      fehler = [`Smoke-Test abgebrochen: ${err.message}`];
    }
    if (fehler.length === 0) break;
    if (versuch < RETRIES) {
      console.log(`Versuch ${versuch}/${RETRIES} fehlgeschlagen, neuer Versuch in ${RETRY_WAIT_S}s ...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT_S * 1000));
    }
  }

  if (fehler.length > 0) {
    console.error(`FEHLER Magic-Link-Smoke-Test (${BASE_URL}):`);
    for (const f of fehler) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`OK Magic-Link-Smoke-Test (${BASE_URL})`);
}

main();
