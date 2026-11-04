// vorschau-link.js
// Signierte Links auf die Vorschaudateien eines ganzen Ordners in einem Call (ADR 0061).
//
// Berechtigung ohne Rollenlogik: die View kooperation_video_vorschau_je_asset wird mit
// dem JWT des Aufrufers gelesen, also unter RLS (Mitarbeiter, Kunde ueber Marke oder
// Unternehmen). Sie liefert nur Vorschaudateien, deren Revision zur aktuellen
// Asset-Zeile passt; was fehlt, spielt der Client als Original ab.
// Signiert wird lokal mit dem Signing Key: kein Cloudflare-Call im kritischen Pfad.
//
// POST { assetIds: string[] } -> { links: { [assetId]: url }, ttlSec, expiresAt }

const { createClient } = require('@supabase/supabase-js');
const { streamConfig, signStreamToken, downloadUrl } = require('./_shared/cloudflare-stream');

const MAX_IDS = 100;
// Jeder Range-Request traegt das Token: es muss die ganze Sichtung ueberdauern.
const TTL_SEC = 4 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

function bearer(event) {
  const h = event.headers || {};
  return String(h.authorization || h.Authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function supabaseEnv() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    anon: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
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
  serviceClient() {
    const { url, service } = supabaseEnv();
    if (!url || !service) return null;
    return createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  },
  cfg: () => streamConfig(),
  nowSec: () => Math.floor(Date.now() / 1000),
};

function createHandler(deps = {}) {
  const d = { ...defaults, ...deps };

  return async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const jwt = bearer(event);
    if (!jwt) return json(401, { error: 'Nicht angemeldet' });

    let ids;
    try {
      ids = JSON.parse(event.body || '{}').assetIds;
    } catch {
      return json(400, { error: 'Kein JSON' });
    }
    if (!Array.isArray(ids)) return json(400, { error: 'assetIds fehlt' });
    ids = [...new Set(ids.filter((id) => typeof id === 'string' && UUID.test(id)))].slice(0, MAX_IDS);
    if (!ids.length) return json(200, { links: {}, ttlSec: TTL_SEC, expiresAt: null });

    const cfg = d.cfg();
    const caller = d.callerClient(jwt);
    const service = d.serviceClient();
    if (!caller || !service || !cfg.keyId || !cfg.keyPem || !cfg.customerCode) {
      console.error('[vorschau-link] Konfiguration unvollstaendig');
      return json(500, { error: 'Serverkonfiguration unvollständig' });
    }

    const { data: sichtbar, error } = await caller
      .from('kooperation_video_vorschau_je_asset')
      .select('asset_id, vorschau_id')
      .in('asset_id', ids)
      .eq('status', 'ready');
    if (error) {
      // Abgelaufenes JWT, Gast ohne Zugriff o. Ae.: kein Link, der Client nimmt das Original.
      console.warn('[vorschau-link] Lesen unter RLS fehlgeschlagen:', error.message);
      return json(error.code === 'PGRST301' ? 401 : 200, { links: {}, ttlSec: TTL_SEC, expiresAt: null });
    }
    if (!sichtbar?.length) return json(200, { links: {}, ttlSec: TTL_SEC, expiresAt: null });

    const { data: anbieter, error: svcErr } = await service
      .from('kooperation_video_vorschau')
      .select('id, anbieter_id')
      .in('id', [...new Set(sichtbar.map((r) => r.vorschau_id))])
      .eq('status', 'ready');
    if (svcErr) {
      console.error('[vorschau-link]', svcErr);
      return json(500, { error: 'Vorschau nicht lesbar' });
    }
    const uidById = new Map((anbieter || []).filter((r) => r.anbieter_id).map((r) => [r.id, r.anbieter_id]));

    const now = d.nowSec();
    const links = {};
    for (const { asset_id: assetId, vorschau_id: vorschauId } of sichtbar) {
      const uid = uidById.get(vorschauId);
      if (uid) links[assetId] = downloadUrl(cfg, signStreamToken(cfg, uid, { ttlSec: TTL_SEC, nowSec: now }));
    }
    return json(200, { links, ttlSec: TTL_SEC, expiresAt: new Date((now + TTL_SEC) * 1000).toISOString() });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.TTL_SEC = TTL_SEC;
