// Netlify Background Function: Instagram Hashtag-Harvester
// Ablauf pro Lauf:
//   1. Aktive Hashtag-Seeds rotieren (max HASHTAGS_PER_RUN, aeltester last_run_at zuerst)
//   2. Meta Hashtag Search API -> hashtag_id -> top_media + recent_media -> Permalinks
//   3. Permalinks via Puppeteer (Stealth) oeffnen -> Autor-Username auslesen
//   4. Unbekannte Usernames -> enrichAndUpsert (source='harvest')
// Trigger: Netlify Schedule (@daily, siehe netlify.toml) ODER manuell (POST mit Bearer).
// Fortschritt/Ergebnis in instagram_harvest_runs.
//
// Meta-Limit: max 30 UNIQUE Hashtags pro rollierende 7 Tage pro IG-Account.
// Deshalb wenige Seeds pro Lauf + Rotation ueber last_run_at.

const chromium = require('@sparticuz/chromium');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createClient } = require('@supabase/supabase-js');
const { enrichAndUpsert } = require('./_shared/instagram-enrich');

puppeteerExtra.use(StealthPlugin());

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const HASHTAGS_PER_RUN = 4;      // haelt das 30/Woche-Limit ein (4/Tag = 28/Woche)
const MAX_PERMALINKS_PER_TAG = 30;
const MAX_NEW_PROFILES_PER_RUN = 30;
const SCRAPE_DELAY_MS = 1500;

// Netlify killt Background Functions hart nach 15 Min — vorher sauber aufhoeren
const TIME_BUDGET_MS = 13 * 60 * 1000;
const STALE_RUN_AFTER_MS = 20 * 60 * 1000;

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 '
  + '(KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Runs, die laenger als 20 Min auf running stehen, wurden von Netlify gekillt -> schliessen */
async function closeStaleRuns(supabase) {
  await supabase.from('instagram_harvest_runs')
    .update({
      status: 'error',
      error: 'Abgebrochen (15-Min-Limit ueberschritten)',
      finished_at: new Date().toISOString()
    })
    .eq('status', 'running')
    .lt('started_at', new Date(Date.now() - STALE_RUN_AFTER_MS).toISOString());
}

async function verifyAuth(event, supabase) {
  const authHeader = (event.headers || {}).authorization || (event.headers || {}).Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function graphGet(path, params = {}) {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', process.env.META_ACCESS_TOKEN);
  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const err = new Error(data.error?.message || `Graph API HTTP ${res.status}`);
    err.meta = data.error || null;
    throw err;
  }
  return data;
}

/** Hashtag-Name -> Permalinks (top + recent media) */
async function permalinksForHashtag(hashtag) {
  const igUserId = process.env.META_IG_USER_ID;
  // 1. Hashtag-ID aufloesen
  const search = await graphGet('ig_hashtag_search', { user_id: igUserId, q: hashtag });
  const hashtagId = search.data?.[0]?.id;
  if (!hashtagId) return [];

  const permalinks = new Set();
  const edgeErrors = [];
  for (const edge of ['top_media', 'recent_media']) {
    try {
      const media = await graphGet(`${hashtagId}/${edge}`, {
        user_id: igUserId,
        fields: 'permalink'
      });
      for (const m of media.data || []) {
        if (m.permalink) permalinks.add(m.permalink);
      }
    } catch (err) {
      console.warn(`⚠️ ${edge} fuer #${hashtag} fehlgeschlagen:`, err.message);
      edgeErrors.push(err.meta?.message || err.message);
    }
  }
  // Beide Edges gescheitert -> Fehler hochreichen, damit er in seed_errors sichtbar wird
  if (permalinks.size === 0 && edgeErrors.length === 2) {
    throw new Error(edgeErrors[0]);
  }
  return [...permalinks].slice(0, MAX_PERMALINKS_PER_TAG);
}

/** Autor-Username aus einem Post-Permalink scrapen */
async function usernameFromPermalink(page, permalink) {
  try {
    await page.goto(permalink, { waitUntil: 'networkidle2', timeout: 20000 });
    const username = await page.evaluate(() => {
      // 1. og:url enthaelt oft /{username}/
      // 2. JSON-LD / meta author
      const ld = document.querySelector('script[type="application/ld+json"]');
      if (ld) {
        try {
          const data = JSON.parse(ld.textContent);
          const author = Array.isArray(data) ? data[0]?.author : data.author;
          const alt = author?.alternateName || author?.identifier?.value;
          if (alt) return String(alt).replace('@', '');
        } catch { /* ignore */ }
      }
      // 3. Link zum Profil im Header
      const headerLink = document.querySelector('header a[href^="/"]');
      if (headerLink) {
        const href = headerLink.getAttribute('href') || '';
        const m = href.match(/^\/([A-Za-z0-9._]+)\/?$/);
        if (m) return m[1];
      }
      return null;
    });
    return username ? username.toLowerCase() : null;
  } catch (err) {
    console.warn(`⚠️ Scrape fehlgeschlagen fuer ${permalink}:`, err.message);
    return null;
  }
}

exports.handler = async (event) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase-Env fehlt' }) };
  }
  if (!process.env.META_ACCESS_TOKEN || !process.env.META_IG_USER_ID) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Meta-Env fehlt' }) };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Von Netlify gekillte Vorgaenger-Laeufe schliessen (selbstheilend)
  await closeStaleRuns(supabase);

  // Schedule-Aufrufe (Netlify Cron) senden ein next_run im Body und keine User-Auth.
  // Manuelle POSTs von der Seite brauchen einen gueltigen Supabase-User.
  let parsedBody = {};
  try { parsedBody = JSON.parse(event.body || '{}'); } catch { /* ignore */ }
  const isScheduled = !!parsedBody.next_run || !!event.headers?.['x-nf-event'];
  const triggerType = isScheduled ? 'schedule' : 'manual';
  if (!isScheduled) {
    const user = await verifyAuth(event, supabase);
    if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Nicht autorisiert' }) };
  }

  // Manuelle Laeufe koennen die Hashtags fuer GENAU diesen Lauf mitgeben (max 4).
  // Ohne hashtags (Cron) rotiert der Lauf ueber die gespeicherten Seeds.
  const requestedHashtags = !isScheduled && Array.isArray(parsedBody.hashtags)
    ? [...new Set(parsedBody.hashtags
        .map((h) => String(h).trim().replace(/^#/, '').toLowerCase())
        .filter((h) => /^[a-z0-9_äöüß]+$/i.test(h)))]
      .slice(0, HASHTAGS_PER_RUN)
    : null;

  const startedAtMs = Date.now();

  const { data: run } = await supabase.from('instagram_harvest_runs')
    .insert({ status: 'running', trigger_type: triggerType, stats: { phase: 'starting' } })
    .select().single();
  const runId = run?.id;

  const stats = {
    phase: 'starting',
    seeds_used: [], seed_errors: [],
    permalinks: 0, usernames_found: 0, new_profiles: 0, enriched: 0, failed: 0
  };

  // Zwischenstand in den Run schreiben (Phase + Stats, fuer die Live-Anzeige)
  const updateRun = async (phase) => {
    if (phase) stats.phase = phase;
    if (runId) await supabase.from('instagram_harvest_runs').update({ stats }).eq('id', runId);
  };

  let browser;

  try {
    // 1. Seeds bestimmen: explizit uebergebene Hashtags (manueller Lauf mit Auswahl)
    // oder Rotation ueber gespeicherte Seeds (Cron), aeltester last_run_at zuerst
    await updateRun('seeds');
    let seeds;
    if (requestedHashtags?.length) {
      // In die Seed-Tabelle upserten (Historie + last_run_at fuer das 30/Woche-Limit)
      const { data: upserted, error: seedErr } = await supabase
        .from('instagram_hashtag_seeds')
        .upsert(requestedHashtags.map((hashtag) => ({ hashtag })), { onConflict: 'hashtag' })
        .select('id, hashtag');
      if (seedErr) throw new Error(`Seed-Upsert: ${seedErr.message}`);
      seeds = upserted;
    } else {
      const { data } = await supabase
        .from('instagram_hashtag_seeds')
        .select('id, hashtag')
        .eq('aktiv', true)
        .order('last_run_at', { ascending: true, nullsFirst: true })
        .limit(HASHTAGS_PER_RUN);
      seeds = data;
    }

    if (!seeds || seeds.length === 0) {
      stats.phase = 'done';
      if (runId) {
        await supabase.from('instagram_harvest_runs')
          .update({ status: 'done', stats, error: 'Keine Hashtags fuer diesen Lauf', finished_at: new Date().toISOString() }).eq('id', runId);
      }
      return { statusCode: 202, body: JSON.stringify({ ok: true, note: 'keine Hashtags', stats }) };
    }

    // 2. Permalinks pro Seed sammeln (permalink -> hashtag).
    // Einzelne Seed-Fehler brechen den Lauf nicht ab, sondern landen in seed_errors.
    await updateRun('hashtags');
    const permalinkMap = new Map();
    for (const seed of seeds) {
      stats.seeds_used.push(seed.hashtag);
      try {
        const links = await permalinksForHashtag(seed.hashtag);
        for (const l of links) if (!permalinkMap.has(l)) permalinkMap.set(l, seed.hashtag);
      } catch (err) {
        stats.seed_errors.push({ hashtag: seed.hashtag, error: err.meta?.message || err.message });
      }
      await supabase.from('instagram_hashtag_seeds')
        .update({ last_run_at: new Date().toISOString() }).eq('id', seed.id);
      await updateRun();
    }
    stats.permalinks = permalinkMap.size;

    // Alle Seeds gescheitert (z.B. fehlende Public-Content-Access-Permission) -> harter Fehler
    if (permalinkMap.size === 0 && stats.seed_errors.length === seeds.length) {
      throw new Error(stats.seed_errors[0].error);
    }

    // 3. Bekannte Usernames laden (nicht neu scrapen/enrichen)
    const { data: existing } = await supabase.from('instagram_creators').select('username');
    const known = new Set((existing || []).map((e) => e.username));

    // 4. Browser starten + Permalinks scrapen
    await updateRun('scrape');
    browser = await puppeteerExtra.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      defaultViewport: { width: 430, height: 932 },
      executablePath: await chromium.executablePath(),
      headless: 'new',
      ignoreDefaultArgs: ['--enable-automation']
    });
    const page = await browser.newPage();
    await page.setUserAgent(MOBILE_UA);

    const newUsernames = new Map(); // username -> hashtag
    for (const [permalink, hashtag] of permalinkMap.entries()) {
      if (newUsernames.size >= MAX_NEW_PROFILES_PER_RUN) break;
      if (Date.now() - startedAtMs > TIME_BUDGET_MS * 0.6) {
        stats.note = 'Zeitbudget beim Scrapen erreicht';
        break;
      }
      const username = await usernameFromPermalink(page, permalink);
      if (!username) continue;
      stats.usernames_found += 1;
      if (known.has(username) || newUsernames.has(username)) continue;
      newUsernames.set(username, hashtag);
      if (stats.usernames_found % 5 === 0) await updateRun();
      await sleep(SCRAPE_DELAY_MS);
    }
    stats.new_profiles = newUsernames.size;

    await browser.close();
    browser = null;

    // 5. Neue Usernames anreichern
    await updateRun('enrich');
    for (const [username, hashtag] of newUsernames.entries()) {
      if (Date.now() - startedAtMs > TIME_BUDGET_MS) {
        stats.note = `Zeitbudget erreicht – ${stats.enriched + stats.failed}/${newUsernames.size} angereichert`;
        break;
      }
      const result = await enrichAndUpsert(supabase, username, {
        source: 'harvest',
        found_via_hashtag: hashtag
      });
      if (result.ok) stats.enriched += 1;
      else stats.failed += 1;
      if ((stats.enriched + stats.failed) % 5 === 0 && runId) {
        await supabase.from('instagram_harvest_runs').update({ stats }).eq('id', runId);
      }
      await sleep(1100);
    }

    stats.phase = 'done';
    if (runId) {
      await supabase.from('instagram_harvest_runs')
        .update({ status: 'done', stats, finished_at: new Date().toISOString() }).eq('id', runId);
    }
    return { statusCode: 202, body: JSON.stringify({ ok: true, stats }) };
  } catch (err) {
    console.error('❌ instagram-harvest:', err.message);
    if (runId) {
      await supabase.from('instagram_harvest_runs')
        .update({ status: 'error', stats, error: err.message, finished_at: new Date().toISOString() }).eq('id', runId);
    }
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    if (browser) await browser.close();
  }
};
