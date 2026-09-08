#!/usr/bin/env node
// scripts/instagram-media-debug.mjs
// Lokale Verifikation der Instagram-CPM-Rechnung (Trial-Reel-Erkennung) gegen
// echte Business-Discovery-Daten. Read-only: nur GETs, keine DB.
//
// Aufruf:
//   node scripts/instagram-media-debug.mjs <handle> [--pages n] [--find <shortcode>] [--raw out.json]
//
//   --pages n        Media-Seiten a 50 (Default 3 = bis zu 150, wie Produktion)
//   --find <code>    Sucht einen Shortcode in der geladenen Media-Liste und
//                    zeigt den kompletten Eintrag (klaert z.B., ob die
//                    27M/76M-Reels ueberhaupt in ihrer Liste existieren)
//   --raw <datei>    Schreibt { profile, media, stats } als JSON
//
// Der Report kommt aus formatCpmReport - derselbe Code wie im Netlify-Log
// (emitCpmDebug in sourcing-instagram-stats.js), also 1:1 vergleichbar.
//
// Env: META_ACCESS_TOKEN + META_IG_USER_ID aus .env / .env.local oder der
// Shell. META_GRAPH_VERSION optional (Default v21.0).

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const {
  computeInstagramCpm,
  formatCpmReport
} = require('../netlify/functions/_shared/instagram-cpm.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- .env laden (ohne Dependency; Shell-Werte gewinnen) ---
function ladeEnv() {
  for (const name of ['.env', '.env.local']) {
    const pfad = join(ROOT, name);
    if (!existsSync(pfad)) continue;
    for (const zeile of readFileSync(pfad, 'utf8').split('\n')) {
      const m = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      if (process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}

// --- CLI ---
function parseArgs(argv) {
  const args = { handle: null, pages: 3, find: null, raw: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--pages') args.pages = Math.max(1, Number(argv[++i]) || 3);
    else if (a === '--find') args.find = argv[++i] || null;
    else if (a === '--raw') args.raw = argv[++i] || null;
    else if (!a.startsWith('--') && !args.handle) args.handle = a;
  }
  return args;
}

// --- Graph API (spiegelt _shared/instagram-graph.js, aber standalone) ---
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
// Wie sourcing-instagram-stats.js: ohne media_product_type/is_shared_to_feed
// (Fehlercode 100 bei Business Discovery), caption fuer Werbe-/Duplikat-Regeln
const MEDIA_FIELDS = 'id,media_type,view_count,like_count,'
  + 'comments_count,timestamp,permalink,caption';
const PROFILE_FIELDS = 'username,name,followers_count,media_count,biography,website';

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

/** Profil + Medien paginiert laden (gleiches Muster wie fetchProfileWithMedia) */
async function ladeProfilMitMedia(username, maxPages) {
  const igUserId = process.env.META_IG_USER_ID;
  let profile = null;
  let media = [];
  let after = null;

  for (let page = 0; page < maxPages; page += 1) {
    const edge = after
      ? `media.limit(50).after(${after}){${MEDIA_FIELDS}}`
      : `media.limit(50){${MEDIA_FIELDS}}`;
    const fields = page === 0 ? `${PROFILE_FIELDS},${edge}` : edge;
    const data = await graphGet(igUserId, {
      fields: `business_discovery.username(${username}){${fields}}`
    });
    const bd = data.business_discovery || {};
    if (page === 0) profile = bd;
    media = media.concat(bd.media?.data || []);
    after = bd.media?.paging?.cursors?.after || null;
    if (!after) break;
  }
  return { profile, media };
}

// --- Main ---
ladeEnv();
const args = parseArgs(process.argv.slice(2));

if (!args.handle) {
  console.error('Aufruf: node scripts/instagram-media-debug.mjs <handle> [--pages n] [--find <shortcode>] [--raw out.json]');
  process.exit(1);
}
if (!process.env.META_ACCESS_TOKEN || !process.env.META_IG_USER_ID) {
  console.error('META_ACCESS_TOKEN / META_IG_USER_ID fehlen (weder in .env noch in der Shell).');
  process.exit(1);
}

const username = args.handle.replace(/^@/, '').toLowerCase();

try {
  const { profile, media } = await ladeProfilMitMedia(username, args.pages);
  const stats = computeInstagramCpm(media);

  console.log(formatCpmReport(username, stats, {
    source: 'script',
    pool_fetched_at: new Date().toISOString(),
    follower: profile?.followers_count ?? null,
    media_total: media.length
  }));

  if (args.find) {
    const treffer = media.filter((m) => String(m.permalink || '').includes(args.find));
    console.log(`\n--find "${args.find}": ${treffer.length} Treffer in ${media.length} geladenen Medien`);
    for (const t of treffer) {
      console.log(JSON.stringify(t, null, 2));
    }
    if (!treffer.length) {
      console.log('Der Shortcode existiert nicht in ihrer Media-Liste (gepinnt-alt, Collab fremder Handle oder aelter als die geladenen Seiten).');
    }
  }

  if (args.raw) {
    writeFileSync(args.raw, JSON.stringify({ profile, media, stats }, null, 2));
    console.log(`\nRohdaten geschrieben: ${args.raw}`);
  }
} catch (err) {
  console.error(`Abruf fehlgeschlagen: ${err.message}`);
  if (err.meta) console.error('Meta-Fehler:', JSON.stringify(err.meta));
  process.exit(1);
}
