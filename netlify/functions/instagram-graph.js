// Netlify Function: instagram-graph
// Proxy fuer die Meta Graph API (Instagram Business Discovery).
// Der META_ACCESS_TOKEN bleibt serverseitig - das Frontend sieht ihn nie.
//
// Actions (POST, JSON-Body):
//   { action: 'status' }
//     -> prueft Token + META_IG_USER_ID, liefert eigenen IG-Account (id, username, name)
//   { action: 'lookup', usernames: ['cristiano', ...] }
//     -> Business Discovery pro Username (max 20), inkl. letzte 3 Posts.
//        Fehler pro Username einzeln (z.B. Personal Account), Rest laeuft weiter.
//
// Auth: Supabase Bearer-Token (wie transcribe/skript-Functions).

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY;

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const MAX_USERNAMES = 20;
const CONCURRENCY = 5;

// Felder, die Business Discovery pro Ziel-Account liefern soll
const DISCOVERY_FIELDS = 'username,name,followers_count,media_count,'
  + 'profile_picture_url,biography,website,'
  + 'media.limit(3){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp}';

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

async function verifyAuth(event) {
  const authHeader = (event.headers || {}).authorization || (event.headers || {}).Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/** Graph-GET mit Access Token; wirft bei Meta-Fehlern ein Error-Objekt mit .meta */
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

/** Usernames normalisieren: @ und URL-Reste weg, lowercase, dedupe */
function normalizeUsernames(input) {
  const list = (Array.isArray(input) ? input : [])
    .map((u) => String(u || '')
      .trim()
      .replace(/^@/, '')
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
      .replace(/[/?#].*$/, '')
      .toLowerCase())
    .filter((u) => /^[a-z0-9._]{1,30}$/.test(u));
  return [...new Set(list)];
}

async function handleStatus() {
  const igUserId = process.env.META_IG_USER_ID;
  const data = await graphGet(igUserId, { fields: 'id,username,name,followers_count' });
  return {
    ok: true,
    account: {
      id: data.id,
      username: data.username,
      name: data.name || null,
      followers_count: data.followers_count ?? null
    },
    graph_version: GRAPH_VERSION
  };
}

async function lookupOne(igUserId, username) {
  try {
    const data = await graphGet(igUserId, {
      fields: `business_discovery.username(${username}){${DISCOVERY_FIELDS}}`
    });
    const bd = data.business_discovery || {};
    return {
      username,
      ok: true,
      profile: {
        id: bd.id,
        username: bd.username,
        name: bd.name || null,
        followers_count: bd.followers_count ?? null,
        media_count: bd.media_count ?? null,
        profile_picture_url: bd.profile_picture_url || null,
        biography: bd.biography || null,
        website: bd.website || null,
        recent_media: (bd.media?.data || []).map((m) => ({
          id: m.id,
          caption: m.caption || null,
          media_type: m.media_type || null,
          media_url: m.media_url || null,
          thumbnail_url: m.thumbnail_url || null,
          permalink: m.permalink || null,
          timestamp: m.timestamp || null
        }))
      }
    };
  } catch (err) {
    // Typisch: Personal Account, nicht existent, age-gated -> Meta error code 110/24/#100
    return {
      username,
      ok: false,
      error: err.meta?.message || err.message,
      error_code: err.meta?.code ?? null
    };
  }
}

async function handleLookup(body) {
  const usernames = normalizeUsernames(body.usernames).slice(0, MAX_USERNAMES);
  if (usernames.length === 0) {
    return { ok: false, error: 'Keine gültigen Usernames übergeben' };
  }

  const igUserId = process.env.META_IG_USER_ID;
  const results = [];
  // Batches mit begrenzter Parallelitaet (Rate Limits + Netlify-Timeout)
  for (let i = 0; i < usernames.length; i += CONCURRENCY) {
    const batch = usernames.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((u) => lookupOne(igUserId, u)));
    for (const s of settled) {
      results.push(s.status === 'fulfilled'
        ? s.value
        : { username: '?', ok: false, error: s.reason?.message || 'Unbekannter Fehler' });
    }
  }

  return {
    ok: true,
    requested: usernames.length,
    results
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return jsonResponse(500, { error: 'Supabase-Env fehlt (SUPABASE_URL / SUPABASE_SERVICE_KEY)' });
  }
  if (!process.env.META_ACCESS_TOKEN || !process.env.META_IG_USER_ID) {
    return jsonResponse(500, { error: 'Meta-Env fehlt (META_ACCESS_TOKEN / META_IG_USER_ID)' });
  }

  const user = await verifyAuth(event);
  if (!user) {
    return jsonResponse(401, { error: 'Nicht autorisiert' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Ungültiger JSON-Body' });
  }

  try {
    switch (body.action) {
      case 'status':
        return jsonResponse(200, await handleStatus());
      case 'lookup':
        return jsonResponse(200, await handleLookup(body));
      default:
        return jsonResponse(400, { error: `Unbekannte Action: ${body.action}` });
    }
  } catch (err) {
    console.error('❌ instagram-graph:', err.message, err.meta || '');
    // Token abgelaufen etc. sauber ans Frontend melden
    return jsonResponse(502, {
      error: err.meta?.message || err.message,
      error_code: err.meta?.code ?? null,
      hint: err.meta?.code === 190
        ? 'META_ACCESS_TOKEN ist abgelaufen oder ungültig – neuen Long-Lived Token hinterlegen.'
        : null
    });
  }
};
