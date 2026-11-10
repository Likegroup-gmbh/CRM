// poster-urls.js
// Signierte Links auf die Poster vieler Dateien in einem Call (ADR 0064).
//
// Berechtigung ohne Rollenlogik: die Asset-Zeilen werden mit dem JWT des Aufrufers gelesen,
// also unter RLS (Team, Kunde, Gast). Nur was er sieht, bekommt einen Link. Die Links leben
// wenige Minuten und dienen nur dem einmaligen Download; der Client cacht die Bytes, nie
// die URL. Fehlt ein Poster, legt die Function den Schluessel an und stoesst die Erzeugung
// an (Read-Repair). Bis dahin zeigt der Client das Original.
//
// POST { items: [{ typ: 'video'|'story'|'still'|'roh', id }] }
//   -> { posters: { [id]: url }, ausstehend: [id], ohne: [id], ttlSec }

const { createClient } = require('@supabase/supabase-js');
const { BUCKET, supabaseEnv, serviceClient, erzeugungAnstossen } = require('./_shared/poster');

const MAX_ITEMS = 200;
// .in() landet in der GET-URL; wie VideoBrowserAdapter in Bloecken von 100
const CHUNK = 100;
const TTL_SEC = 600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABELLE = {
  video: 'kooperation_video_asset',
  story: 'kooperation_story_asset',
  still: 'kooperation_bilder_asset',
  roh: 'kooperation_rohmaterial_asset',
};

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

function bearer(event) {
  const h = event.headers || {};
  return String(h.authorization || h.Authorization || '').replace(/^Bearer\s+/i, '').trim();
}

const defaults = {
  callerClient(jwt) {
    const { url, anon } = supabaseEnv();
    if (!url || !anon) return null;
    return createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
  },
  serviceClient,
  anstossen: (event) => erzeugungAnstossen(event),
};

function chunks(list) {
  const out = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

/** Gueltige, eindeutige Items; die erste Angabe je id gewinnt. */
function parseItems(body) {
  const items = Array.isArray(body?.items) ? body.items : [];
  const typById = new Map();
  for (const it of items) {
    if (typById.size >= MAX_ITEMS) break;
    const id = typeof it?.id === 'string' ? it.id : '';
    if (!UUID.test(id) || !TABELLE[it?.typ] || typById.has(id)) continue;
    typById.set(id, it.typ);
  }
  return typById;
}

function createHandler(deps = {}) {
  const d = { ...defaults, ...deps };

  return async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const jwt = bearer(event);
    if (!jwt) return json(401, { error: 'Nicht angemeldet' });

    let typById;
    try {
      typById = parseItems(JSON.parse(event.body || '{}'));
    } catch {
      return json(400, { error: 'Kein JSON' });
    }
    const leer = { posters: {}, ausstehend: [], ohne: [], ttlSec: TTL_SEC };
    if (!typById.size) return json(200, leer);

    const caller = d.callerClient(jwt);
    const service = d.serviceClient();
    if (!caller || !service) {
      console.error('[poster-urls] Supabase-Konfiguration unvollstaendig');
      return json(500, { error: 'Serverkonfiguration unvollständig' });
    }

    // 1. Sichtbarkeit unter RLS des Aufrufers, je Tabelle ein Call
    const idsByTyp = new Map();
    for (const [id, typ] of typById) idsByTyp.set(typ, [...(idsByTyp.get(typ) || []), id]);
    const sichtbar = new Set();
    for (const [typ, typIds] of idsByTyp) {
      for (const teil of chunks(typIds)) {
        const { data, error } = await caller.from(TABELLE[typ]).select('id').in('id', teil);
        if (error) {
          if (error.code === 'PGRST301') return json(401, { error: 'Sitzung abgelaufen' });
          console.warn(`[poster-urls] ${typ} unter RLS nicht lesbar:`, error.message);
          continue;
        }
        (data || []).forEach((r) => sichtbar.add(r.id));
      }
    }
    const ids = [...typById.keys()];
    if (!sichtbar.size) return json(200, { ...leer, ohne: ids });

    // 2. Schluessel und Poster-Stand (service_role, nur fuer sichtbare Assets)
    const rows = [];
    for (const teil of chunks([...sichtbar])) {
      const { data, error } = await service
        .from('asset_poster_je_asset')
        .select('typ, asset_id, file_path, revision, status, storage_path')
        .in('asset_id', teil);
      if (error) {
        console.error('[poster-urls] Poster-Stand nicht lesbar:', error.message);
        return json(200, { ...leer, ohne: ids });
      }
      rows.push(...(data || []));
    }
    const zeilen = rows.filter((r) => typById.get(r.asset_id) === r.typ);

    // 3. Fertige Poster signieren
    const fertig = zeilen.filter((r) => r.status === 'ready' && r.storage_path);
    const urlByPfad = new Map();
    if (fertig.length) {
      const pfade = [...new Set(fertig.map((r) => r.storage_path))];
      const { data: signiert, error: signErr } = await service.storage.from(BUCKET).createSignedUrls(pfade, TTL_SEC);
      if (signErr) console.error('[poster-urls] Signieren fehlgeschlagen:', signErr.message);
      (signiert || []).forEach((s) => { if (s?.signedUrl && !s.error) urlByPfad.set(s.path, s.signedUrl); });
    }

    // 4. Read-Repair: fehlende Schluessel anlegen, Erzeugung nur bei wirklich neuen anstossen
    const fehlend = new Map();
    zeilen.filter((r) => !r.status).forEach((r) => fehlend.set(`${r.file_path}\n${r.revision}`, r));
    if (fehlend.size) {
      const { data: neu, error: insErr } = await service
        .from('asset_poster')
        .upsert(
          [...fehlend.values()].map((r) => ({ file_path: r.file_path, revision: r.revision })),
          { onConflict: 'file_path,revision', ignoreDuplicates: true },
        )
        .select('file_path');
      if (insErr) console.error('[poster-urls] Read-Repair fehlgeschlagen:', insErr.message);
      else if (neu?.length) await d.anstossen(event);
    }

    const posters = {};
    const ausstehend = [];
    for (const r of zeilen) {
      const url = r.status === 'ready' ? urlByPfad.get(r.storage_path) : null;
      if (url) posters[r.asset_id] = url;
      else if (!r.status || r.status === 'pending') ausstehend.push(r.asset_id);
    }
    const bekannt = new Set([...Object.keys(posters), ...ausstehend]);
    return json(200, { posters, ausstehend, ohne: ids.filter((id) => !bekannt.has(id)), ttlSec: TTL_SEC });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.TTL_SEC = TTL_SEC;
