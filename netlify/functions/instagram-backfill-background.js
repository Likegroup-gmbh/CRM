// Netlify Background Function: CRM-Creator in den Instagram-Pool backfillen
// Laedt alle creator.instagram-Handles, diesst gegen instagram_creators und
// reichert fehlende (oder laenger nicht aktualisierte) via Business Discovery an.
// Background (Suffix "-background"): antwortet sofort 202, Fortschritt in
// instagram_harvest_runs (trigger_type='backfill').
//
// Zweiter Modus: Body { mode: 'refresh' } ("Pool aktualisieren"-Button).
// Re-enriched ALLE vorhandenen Pool-Creator (CRM + Harvest), aelteste zuerst,
// ohne 7-Tage-Skip — frische Posts, ER und Kooperationen inkl. Brand-Logo-Cache.
// trigger_type='refresh'.

const { createClient } = require('@supabase/supabase-js');
const { enrichAndUpsert, cacheBrands, normalizeUsername, isValidUsername } = require('./_shared/instagram-enrich');

// Nur Profile neu anfassen, die aelter als das hier sind (spart API-Calls bei Re-Runs)
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 Tage
const DELAY_BETWEEN_CALLS_MS = 1100; // ~1 Call/s, Meta-Rate-Limits schonen
const MAX_BRAND_LOOKUPS_PER_RUN = 100; // Brand-Cache-Nachzug pro Lauf deckeln
const MAX_REFRESH_PER_RUN = 250; // Pool-Refresh: max Profile pro Lauf (15-Min-Budget)
const MAX_BACKFILL_PER_RUN = 100; // kleinere Batches schonen das App-Rate-Limit (#4)

// Dauerhafte Fehler: erneuter Versuch bringt nichts (kein Business-Account, kaputter Handle).
// Rate-Limits u.ae. sind dagegen transient und werden beim naechsten Lauf neu versucht.
function isPermanentError(err) {
  return /invalid user id|ungueltiger username|cannot be found/i.test(err || '');
}

// Netlify killt Background Functions hart nach 15 Min — vorher sauber aufhoeren,
// damit der finale Status-Write noch durchkommt. Rest erledigt der naechste Lauf.
const TIME_BUDGET_MS = 13 * 60 * 1000;
const STALE_RUN_AFTER_MS = 20 * 60 * 1000;

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

  const user = await verifyAuth(event, supabase);
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Nicht autorisiert' }) };
  }

  // Von Netlify gekillte Vorgaenger-Laeufe schliessen (selbstheilend)
  await closeStaleRuns(supabase);

  // Modus: 'backfill' (Default, CRM-Handles) oder 'refresh' (alle Pool-Creator neu)
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ignore */ }
  const isRefresh = body.mode === 'refresh';
  const triggerType = isRefresh ? 'refresh' : 'backfill';
  const startedAtMs = Date.now();

  // Run-Log anlegen
  const { data: run } = await supabase.from('instagram_harvest_runs')
    .insert({ status: 'running', trigger_type: triggerType, stats: { phase: 'crm_load' } })
    .select().single();
  const runId = run?.id;

  const stats = { phase: 'crm_load', crm_handles: 0, candidates: 0, enriched: 0, failed: 0, skipped_existing: 0, brands_cached: 0 };

  const updateRun = async (phase) => {
    if (phase) stats.phase = phase;
    if (runId) await supabase.from('instagram_harvest_runs').update({ stats }).eq('id', runId);
  };

  try {
    // Kandidaten bestimmen: { username, crmId }
    let candidates = [];

    if (isRefresh) {
      // Refresh: ALLE Pool-Creator (CRM + Harvest), aelteste zuerst, ohne 7-Tage-Skip.
      // Dauerhaft fehlgeschlagene Profile (kein Business-Account) fliegen raus.
      // Kein source/crm_creator_id im Upsert -> bestehende Werte bleiben erhalten.
      const { data: pool, error: poolErr } = await supabase
        .from('instagram_creators')
        .select('username, enrich_error')
        .order('last_enriched_at', { ascending: true, nullsFirst: true });
      if (poolErr) throw new Error(`Pool-Load: ${poolErr.message}`);
      candidates = (pool || [])
        .filter((p) => !isPermanentError(p.enrich_error))
        .slice(0, MAX_REFRESH_PER_RUN)
        .map((p) => ({ username: p.username, crmId: null }));
      stats.skipped_permanent = (pool || []).filter((p) => isPermanentError(p.enrich_error)).length;
    } else {
      // 1. CRM-Handles laden
      const { data: creators, error: crmErr } = await supabase
        .from('creator')
        .select('id, instagram')
        .not('instagram', 'is', null);
      if (crmErr) throw new Error(`CRM-Load: ${crmErr.message}`);

      // 2. Normalisieren + dedupe (username -> crm_creator_id)
      const handleMap = new Map();
      for (const c of creators || []) {
        const u = normalizeUsername(c.instagram);
        if (isValidUsername(u) && !handleMap.has(u)) handleMap.set(u, c.id);
      }
      stats.crm_handles = handleMap.size;

      // 3. Bestehende Pool-Eintraege laden (inkl. Fehlerstatus)
      const { data: existing } = await supabase
        .from('instagram_creators')
        .select('username, last_enriched_at, enrich_error');
      const existingMap = new Map((existing || []).map((e) => [e.username, e]));

      // 4. Kandidaten bestimmen mit Prioritaet:
      //    (1) noch nicht im Pool, (2) transienter Fehlschlag (Retry, z.B. Rate-Limit),
      //    (3) erfolgreich aber aelter als 7 Tage.
      //    Dauerhafte Fehler (Invalid user id) werden nicht mehr versucht.
      const now = Date.now();
      const missing = [];
      const retry = [];
      const stale = [];
      stats.skipped_permanent = 0;
      for (const [username, crmId] of handleMap.entries()) {
        const row = existingMap.get(username);
        if (!row) { missing.push({ username, crmId }); continue; }
        if (row.enrich_error) {
          if (isPermanentError(row.enrich_error)) stats.skipped_permanent += 1;
          else retry.push({ username, crmId });
          continue;
        }
        if (row.last_enriched_at && (now - new Date(row.last_enriched_at).getTime()) < REFRESH_AFTER_MS) {
          stats.skipped_existing += 1;
          continue;
        }
        stale.push({ username, crmId });
      }
      candidates = [...missing, ...retry, ...stale];
      if (candidates.length > MAX_BACKFILL_PER_RUN) {
        stats.note = `${candidates.length} Kandidaten – dieser Lauf verarbeitet ${MAX_BACKFILL_PER_RUN}, Rest beim naechsten Klick`;
        candidates = candidates.slice(0, MAX_BACKFILL_PER_RUN);
      }
    }
    stats.candidates = candidates.length;
    await updateRun('enrich');

    // 5. Sequentiell anreichern (Rate-Limit-schonend, mit Zeitbudget)
    for (const { username, crmId } of candidates) {
      if (Date.now() - startedAtMs > TIME_BUDGET_MS) {
        stats.note = `Zeitbudget erreicht – ${stats.enriched + stats.failed}/${candidates.length} verarbeitet, Rest beim naechsten Lauf`;
        break;
      }
      const result = await enrichAndUpsert(
        supabase,
        username,
        isRefresh ? {} : { source: 'crm', crm_creator_id: crmId }
      );
      if (result.ok) stats.enriched += 1;
      else stats.failed += 1;

      // Zwischenstand periodisch schreiben
      if ((stats.enriched + stats.failed) % 10 === 0) {
        await updateRun();
      }
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }

    // 6. Brand-Cache fuer bestehende Pool-Creator nachziehen (Bubbles auf der Seite).
    // cacheBrands ueberspringt frische/als nicht-aufloesbar markierte Handles selbst.
    // Nur wenn noch Zeitbudget da ist (Lookups koennen ~2s/Handle dauern).
    if (Date.now() - startedAtMs < TIME_BUDGET_MS) {
      await updateRun('brands');
      const { data: poolBrands } = await supabase
        .from('instagram_creators')
        .select('brand_mentions')
        .not('brand_mentions', 'eq', '{}');
      const allHandles = [...new Set((poolBrands || []).flatMap((r) => r.brand_mentions || []))];
      if (allHandles.length) {
        // Erst gegen den Cache diffen, dann cappen — sonst blockieren gecachte Handles den Nachzug
        const { data: cachedBrands } = await supabase
          .from('instagram_brands')
          .select('username')
          .in('username', allHandles);
        const cachedSet = new Set((cachedBrands || []).map((b) => b.username));
        const missing = allHandles.filter((h) => !cachedSet.has(h)).slice(0, MAX_BRAND_LOOKUPS_PER_RUN);
        if (missing.length) {
          const brandResult = await cacheBrands(supabase, missing);
          stats.brands_cached = brandResult.cached;
        }
      }
    }

    stats.phase = 'done';
    if (runId) {
      await supabase.from('instagram_harvest_runs')
        .update({ status: 'done', stats, finished_at: new Date().toISOString() })
        .eq('id', runId);
    }
    return { statusCode: 202, body: JSON.stringify({ ok: true, stats }) };
  } catch (err) {
    console.error('❌ instagram-backfill:', err.message);
    if (runId) {
      await supabase.from('instagram_harvest_runs')
        .update({ status: 'error', stats, error: err.message, finished_at: new Date().toISOString() })
        .eq('id', runId);
    }
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
