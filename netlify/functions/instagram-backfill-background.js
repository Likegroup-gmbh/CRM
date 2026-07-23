// Netlify Background Function: CRM-Creator in den Instagram-Pool backfillen
// Laedt alle creator.instagram-Handles, diesst gegen instagram_creators und
// reichert fehlende (oder laenger nicht aktualisierte) via Business Discovery an.
// Background (Suffix "-background"): antwortet sofort 202, Fortschritt in
// instagram_harvest_runs (trigger_type='backfill').

const { createClient } = require('@supabase/supabase-js');
const { enrichAndUpsert, normalizeUsername, isValidUsername } = require('./_shared/instagram-enrich');

// Nur Profile neu anfassen, die aelter als das hier sind (spart API-Calls bei Re-Runs)
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 Tage
const DELAY_BETWEEN_CALLS_MS = 1100; // ~1 Call/s, Meta-Rate-Limits schonen

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  // Run-Log anlegen
  const { data: run } = await supabase.from('instagram_harvest_runs')
    .insert({ status: 'running', trigger_type: 'backfill' })
    .select().single();
  const runId = run?.id;

  const stats = { crm_handles: 0, candidates: 0, enriched: 0, failed: 0, skipped_existing: 0 };

  try {
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

    // 3. Bestehende Pool-Eintraege laden (username + last_enriched_at)
    const { data: existing } = await supabase
      .from('instagram_creators')
      .select('username, last_enriched_at');
    const existingMap = new Map((existing || []).map((e) => [e.username, e.last_enriched_at]));

    // 4. Kandidaten bestimmen: fehlend oder zu alt
    const now = Date.now();
    const candidates = [];
    for (const [username, crmId] of handleMap.entries()) {
      const last = existingMap.get(username);
      if (last && (now - new Date(last).getTime()) < REFRESH_AFTER_MS) {
        stats.skipped_existing += 1;
        continue;
      }
      candidates.push({ username, crmId });
    }
    stats.candidates = candidates.length;

    // 5. Sequentiell anreichern (Rate-Limit-schonend)
    for (const { username, crmId } of candidates) {
      const result = await enrichAndUpsert(supabase, username, {
        source: 'crm',
        crm_creator_id: crmId
      });
      if (result.ok) stats.enriched += 1;
      else stats.failed += 1;

      // Zwischenstand periodisch schreiben
      if ((stats.enriched + stats.failed) % 10 === 0 && runId) {
        await supabase.from('instagram_harvest_runs').update({ stats }).eq('id', runId);
      }
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }

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
