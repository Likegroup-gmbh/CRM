// Netlify Function: instagram-query
// Uebersetzt eine natuerlichsprachige Chat-Nachricht via Claude Haiku in ein
// Filter-JSON und queryt damit den instagram_creators-Pool.
// Synchron (kein Background), Supabase-Bearer-Auth.
//
// Body: { message?, currentFilters?, limit? }
//   - message: Chat-Text ("Hunde-Creator mit 2M+ Followern, ER ueber 3%")
//   - currentFilters: bestehende Filter als Basis (Chat ueberschreibt nur Genanntes)
//   - limit: 25 | 50 | 100 (Default 25)
// Response: { filters, reply, results }

const { createClient } = require('@supabase/supabase-js');
const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY;

const ALLOWED_LIMITS = [25, 50, 100];
const DEFAULT_LIMIT = 25;

function jsonResponse(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

async function verifyAuth(event, supabase) {
  const authHeader = (event.headers || {}).authorization || (event.headers || {}).Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

const EMPTY_FILTERS = {
  topics: [], followers_min: null, followers_max: null,
  posts_min: null, posts_max: null, engagement_min: null,
  brands: [], min_brand_count: null, age_range: null, search_text: null
};

/** Chat-Nachricht -> Filter-JSON (Claude). currentFilters ist die Basis. */
async function parseMessageToFilters(message, currentFilters) {
  const systemBlocks = [{
    text: 'Du wandelst Suchanfragen fuer Instagram-Creator in ein JSON-Filterobjekt um. '
      + 'Gib NUR JSON zurueck, exakt mit diesen Keys:\n'
      + '{"topics":[],"followers_min":null,"followers_max":null,"posts_min":null,'
      + '"posts_max":null,"engagement_min":null,"brands":[],"min_brand_count":null,'
      + '"age_range":null,"search_text":null}\n'
      + 'Regeln:\n'
      + '- topics: deutsche Themen-Tags kleingeschrieben (z.B. "hunde","fitness","beauty").\n'
      + '- followers_min/max: Zahlen (2M = 2000000, "500k" = 500000).\n'
      + '- engagement_min: Prozent als Zahl (3% -> 3).\n'
      + '- brands: genannte Markennamen/Handles kleingeschrieben; min_brand_count: Zahl wenn '
      + 'gefordert ("mit mind. 3 Marken gearbeitet" -> min_brand_count 3).\n'
      + '- age_range: eines von "18-24","25-34","35-44","45+" oder null.\n'
      + '- search_text: freier Rest-Suchbegriff oder null.\n'
      + 'Uebernimm die uebergebenen aktuellen Filter als Basis und aendere nur, was in der '
      + 'Nachricht vorkommt. Nicht genannte Felder unveraendert lassen.'
  }];

  const userPrompt = `Aktuelle Filter:\n${JSON.stringify(currentFilters)}\n\nNachricht:\n${message}`;

  const { text } = await callClaude({
    model: MODELS.edit_fast,
    systemBlocks,
    userPrompt,
    maxTokens: 512
  });
  const parsed = extractJson(text);
  return { ...EMPTY_FILTERS, ...currentFilters, ...parsed };
}

/** Filter -> Supabase-Query auf instagram_creators */
async function queryPool(supabase, filters, limit) {
  let q = supabase
    .from('instagram_creators')
    .select('username,name,biography,website,followers_count,media_count,engagement_rate,'
      + 'topics,brand_mentions,estimated_age_range,profile_picture_url,recent_media,source,found_via_hashtag')
    .is('enrich_error', null);

  if (Array.isArray(filters.topics) && filters.topics.length) q = q.overlaps('topics', filters.topics);
  if (filters.followers_min != null) q = q.gte('followers_count', filters.followers_min);
  if (filters.followers_max != null) q = q.lte('followers_count', filters.followers_max);
  if (filters.posts_min != null) q = q.gte('media_count', filters.posts_min);
  if (filters.posts_max != null) q = q.lte('media_count', filters.posts_max);
  if (filters.engagement_min != null) q = q.gte('engagement_rate', filters.engagement_min);
  if (Array.isArray(filters.brands) && filters.brands.length) q = q.overlaps('brand_mentions', filters.brands);
  if (filters.age_range) q = q.eq('estimated_age_range', filters.age_range);
  if (filters.search_text) {
    const s = `%${filters.search_text}%`;
    q = q.or(`name.ilike.${s},username.ilike.${s},biography.ilike.${s}`);
  }

  q = q.order('followers_count', { ascending: false, nullsFirst: false }).limit(limit);
  const { data, error } = await q;
  if (error) throw new Error(`Pool-Query: ${error.message}`);

  let results = data || [];
  // min_brand_count laesst sich nicht direkt in der Query pruefen -> nachfiltern
  if (filters.min_brand_count != null) {
    results = results.filter((r) => (r.brand_mentions?.length || 0) >= filters.min_brand_count);
  }
  return results;
}

/** Brand-Infos (Name + Logo) fuer alle brand_mentions der Treffer aus dem Cache laden */
async function brandsForResults(supabase, results) {
  const handles = [...new Set(results.flatMap((r) => r.brand_mentions || []))];
  if (handles.length === 0) return {};
  const { data, error } = await supabase
    .from('instagram_brands')
    .select('username, name, profile_picture_url')
    .in('username', handles)
    .is('lookup_error', null);
  if (error) {
    console.warn('⚠️ Brand-Cache-Query fehlgeschlagen:', error.message);
    return {};
  }
  const map = {};
  for (const b of data || []) {
    map[b.username] = { name: b.name, profile_picture_url: b.profile_picture_url };
  }
  return map;
}

function buildReply(filters, count) {
  const parts = [];
  if (filters.topics?.length) parts.push(`Thema ${filters.topics.join(', ')}`);
  if (filters.followers_min != null) parts.push(`ab ${Number(filters.followers_min).toLocaleString('de-DE')} Follower`);
  if (filters.followers_max != null) parts.push(`bis ${Number(filters.followers_max).toLocaleString('de-DE')}`);
  if (filters.engagement_min != null) parts.push(`ER >= ${filters.engagement_min}%`);
  if (filters.min_brand_count != null) parts.push(`>= ${filters.min_brand_count} Marken`);
  if (filters.age_range) parts.push(`Alter ${filters.age_range} (Schaetzung)`);
  const crit = parts.length ? ` (${parts.join(', ')})` : '';
  return `${count} Treffer${crit}.`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return jsonResponse(500, { error: 'Supabase-Env fehlt' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const user = await verifyAuth(event, supabase);
  if (!user) return jsonResponse(401, { error: 'Nicht autorisiert' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return jsonResponse(400, { error: 'Ungueltiger JSON-Body' }); }

  const limit = ALLOWED_LIMITS.includes(Number(body.limit)) ? Number(body.limit) : DEFAULT_LIMIT;
  const currentFilters = { ...EMPTY_FILTERS, ...(body.currentFilters || {}) };

  try {
    let filters = currentFilters;
    // Nur wenn eine Chat-Nachricht da ist, Claude bemuehen (manuelle Filteraenderung -> kostenlos)
    if (body.message && body.message.trim()) {
      filters = await parseMessageToFilters(body.message.trim(), currentFilters);
    }
    const results = await queryPool(supabase, filters, limit);
    const brands = await brandsForResults(supabase, results);
    return jsonResponse(200, {
      filters,
      reply: buildReply(filters, results.length),
      results,
      brands
    });
  } catch (err) {
    console.error('❌ instagram-query:', err.message);
    return jsonResponse(502, { error: err.message });
  }
};
