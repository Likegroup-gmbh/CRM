// onedrive-freigeben.mjs
// Umzug der OneDrive-Links: Die App hat nur Sites.Selected und sieht die persoenlichen OneDrives
// nicht, aus denen die alten Video-Links stammen. Listet diese Sites aus den Asset-URLs und gibt
// der App "read" darauf (bzw. entzieht ihn nach dem Umzug wieder).
//
// Aufruf:
//   node scripts/medienablage/onedrive-freigeben.mjs [--env .env]                      # nur auflisten
//   node scripts/medienablage/onedrive-freigeben.mjs --token <Admin-Token> [--env .env]
//   node scripts/medienablage/onedrive-freigeben.mjs --token <Admin-Token> --entziehen
// Admin-Token: Graph Explorer als Admin, Sites.FullControl.All zugestimmt, Reiter "Zugriffstoken".

import { ladeEnv, argumente, pflicht, supabaseService } from './_env.mjs';

const TABELLEN = ['kooperation_video_asset', 'kooperation_story_asset', 'kooperation_bilder_asset', 'kooperation_rohmaterial_asset'];
const KURZ = { p: 'personal', s: 'sites', t: 'teams' };
const ARTEN = new Set(['personal', 'sites', 'teams']);

/** Site-URL aus einem SharePoint-/OneDrive-Link (auch Freigabelinks /:v:/g/personal/...). */
export function siteAusLink(link) {
  let u;
  try {
    u = new URL(link);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (!host.endsWith('.sharepoint.com')) return null;
  const teile = u.pathname.split('/').filter(Boolean);
  let i = 0;
  if (/^:\w:$/.test(teile[0] || '')) {
    i = 1;
    if (KURZ[teile[1]]) return teile[2] ? `https://${host}/${KURZ[teile[1]]}/${teile[2].toLowerCase()}` : null;
    if (teile[1] === 'g' || teile[1] === 'r') i = 2;
  }
  return ARTEN.has(teile[i]) && teile[i + 1] ? `https://${host}/${teile[i]}/${teile[i + 1].toLowerCase()}` : null;
}

async function linksLaden(supabase) {
  const out = [];
  for (const t of TABELLEN) {
    for (let von = 0; ; von += 1000) {
      const { data, error } = await supabase.from(t).select('id, file_url')
        .or('file_url.ilike.%sharepoint.com%,file_url.ilike.%1drv.ms%,file_url.ilike.%onedrive.live.com%')
        .neq('ablage', 'sharepoint')
        .range(von, von + 999);
      if (error) throw new Error(`${t}: ${error.message}`);
      out.push(...data.map((r) => r.file_url));
      if (data.length < 1000) break;
    }
  }
  return out;
}

function graphMit(token) {
  return async (method, pfad, body) => {
    const res = await fetch(`https://graph.microsoft.com/v1.0${pfad}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(`${method} ${pfad}: ${res.status} ${json?.error?.message || text}`);
    return json;
  };
}

async function main() {
  const args = argumente();
  ladeEnv(args.env || '.env');
  const clientId = pflicht('MS_CLIENT_ID');
  const eigene = new Set([process.env.SP_SITE_URL, process.env.SP_TEST_SITE_URL].filter(Boolean).map((s) => s.toLowerCase().replace(/\/+$/, '')));

  const links = await linksLaden(supabaseService());
  const sites = new Map();
  const fremd = [];
  for (const l of links) {
    const s = siteAusLink(l);
    if (!s) fremd.push(l);
    else if (!eigene.has(s)) sites.set(s, (sites.get(s) || 0) + 1);
  }
  console.error(`${links.length} OneDrive-/SharePoint-Links, ${sites.size} Sites:`);
  for (const [s, n] of [...sites].sort((a, b) => b[1] - a[1])) console.error(`  ${String(n).padStart(4)}  ${s}`);
  if (fremd.length) {
    console.error(`\n${fremd.length} Links ohne erkennbare Tenant-Site (privates OneDrive/1drv.ms) – zieht der Umzug nicht, von Hand herunterladen:`);
    for (const l of fremd.slice(0, 20)) console.error(`  ${l}`);
  }

  if (!args.token) {
    console.error('\nOhne --token nur aufgelistet. Mit Admin-Token aus Graph Explorer erneut aufrufen.');
    return;
  }
  const graph = graphMit(args.token);
  let ok = 0;
  for (const site of sites.keys()) {
    const { host, pathname } = new URL(site);
    try {
      const s = await graph('GET', `/sites/${host}:${pathname}?$select=id,displayName`);
      const perms = (await graph('GET', `/sites/${s.id}/permissions`))?.value || [];
      const unsere = perms.filter((p) => [...(p.grantedToIdentitiesV2 || []), ...(p.grantedToIdentities || [])]
        .some((g) => g.application?.id === clientId));
      if (args.entziehen) {
        for (const p of unsere) await graph('DELETE', `/sites/${s.id}/permissions/${p.id}`);
        console.error(`  − ${site}: ${unsere.length} Freigabe(n) entzogen`);
      } else if (unsere.length) {
        console.error(`  = ${site}: schon freigegeben (${unsere.flatMap((p) => p.roles).join(', ')})`);
      } else {
        await graph('POST', `/sites/${s.id}/permissions`, {
          roles: ['read'],
          grantedToIdentities: [{ application: { id: clientId, displayName: 'CRM Medienablage' } }],
        });
        console.error(`  + ${site}: read`);
      }
      ok++;
    } catch (err) {
      console.error(`  ! ${site}: ${err.message}`);
    }
  }
  console.error(`\n${ok}/${sites.size} Sites erledigt.`);
  if (ok < sites.size) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`FEHLER: ${err.message}`);
    process.exit(1);
  });
}
