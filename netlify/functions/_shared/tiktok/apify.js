// _shared/tiktok/apify.js
// Apify API v2 fuer den TikTok-Scraper (Admin-Seite TikTok-API, Profilabruf im Casting). Ein Lauf
// wird gestartet und gepollt, nicht synchron abgewartet: Sync-Functions haben 26 s, Profil-Laeufe
// dauern laenger. Die Wartezeiten sind so knapp, dass Lauf-Abfrage plus Dataset-Abruf in diese
// 26 s passen. Wer danach noch rechnet und speichert, gibt eine kuerzere Wartezeit mit (wartenS).

const BASIS = 'https://api.apify.com/v2';
const ACTOR_STANDARD = 'clockworks~tiktok-scraper';
const MAX_USD_STANDARD = 0.5;
const WARTEN_S = 15;
const laufTimeoutMs = (wartenS) => (wartenS + 5) * 1000;
const ITEMS_TIMEOUT_MS = 6000;
// Eingabe-Limits (eingabe.js) ergeben hoechstens 170 Items; Netlify-Antworten duerfen max. 6 MB haben
const ITEMS_MAX = 200;

const ENDSTATUS = new Set(['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED']);
const RUN_ID_RE = /^[A-Za-z0-9]{10,32}$/;
const istRunId = (v) => typeof v === 'string' && RUN_ID_RE.test(v);

function apifyKonfig(env = process.env) {
  const token = String(env.APIFY_TOKEN || '').trim();
  const actor = String(env.APIFY_TIKTOK_ACTOR || ACTOR_STANDARD).trim().replace('/', '~');
  const maxUsd = Number(env.APIFY_MAX_USD);
  return { token, actor, maxUsd: Number.isFinite(maxUsd) && maxUsd > 0 ? maxUsd : MAX_USD_STANDARD };
}

function fehlerText(status, daten, roh) {
  const detail = daten?.error?.message || daten?.message || roh || '';
  const kurz = String(detail).replace(/\s+/g, ' ').trim().slice(0, 240);
  if (status === 401) return `Apify lehnt den Token ab (401)${kurz ? `: ${kurz}` : ''}`;
  return kurz ? `Apify HTTP ${status}: ${kurz}` : `Apify HTTP ${status}`;
}

/**
 * @returns {Promise<{ ok: true, status: number, daten: any } | { ok: false, status?: number, fehler: string }>}
 */
async function anfrage(konfig, pfad, { method = 'GET', query = {}, body, timeoutMs, fetchImpl = (...a) => fetch(...a) } = {}) {
  const url = new URL(BASIS + pfad);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  const headers = { Authorization: `Bearer ${konfig.token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetchImpl(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const roh = await resp.text().catch(() => '');
    let daten = null;
    try {
      daten = roh ? JSON.parse(roh) : null;
    } catch {
      // Klartext-Fehler
    }
    if (!resp.ok) return { ok: false, status: resp.status, fehler: fehlerText(resp.status, daten, roh) };
    return { ok: true, status: resp.status, daten };
  } catch (err) {
    const fehler = err?.name === 'AbortError' ? 'Zeitüberschreitung bei Apify' : (err?.message || 'Netzwerkfehler');
    return { ok: false, fehler };
  } finally {
    clearTimeout(timer);
  }
}

/** Run-Objekt auf das, was die Seite braucht. */
function laufAusRun(run) {
  return {
    runId: run?.id || null,
    status: run?.status || null,
    statusText: run?.statusMessage || null,
    datasetId: run?.defaultDatasetId || null,
    startedAt: run?.startedAt || null,
    finishedAt: run?.finishedAt || null,
    usageTotalUsd: typeof run?.usageTotalUsd === 'number' ? run.usageTotalUsd : null,
    konsoleUrl: run?.id ? `https://console.apify.com/view/runs/${run.id}` : null,
    fertig: ENDSTATUS.has(run?.status),
  };
}

async function laufStarten(konfig, input, { wartenS = WARTEN_S, ...opts } = {}) {
  const r = await anfrage(konfig, `/actors/${encodeURIComponent(konfig.actor)}/runs`, {
    method: 'POST',
    query: { waitForFinish: wartenS, maxTotalChargeUsd: konfig.maxUsd },
    body: input,
    timeoutMs: laufTimeoutMs(wartenS),
    ...opts,
  });
  return r.ok ? { ok: true, lauf: laufAusRun(r.daten?.data) } : r;
}

async function laufStand(konfig, runId, { wartenS = WARTEN_S, ...opts } = {}) {
  const r = await anfrage(konfig, `/actor-runs/${runId}`, {
    query: { waitForFinish: wartenS },
    timeoutMs: laufTimeoutMs(wartenS),
    ...opts,
  });
  return r.ok ? { ok: true, lauf: laufAusRun(r.daten?.data) } : r;
}

async function laufAbbrechen(konfig, runId, opts = {}) {
  const r = await anfrage(konfig, `/actor-runs/${runId}/abort`, {
    method: 'POST',
    timeoutMs: ITEMS_TIMEOUT_MS,
    ...opts,
  });
  return r.ok ? { ok: true, lauf: laufAusRun(r.daten?.data) } : r;
}

async function laufItems(konfig, datasetId, opts = {}) {
  const r = await anfrage(konfig, `/datasets/${encodeURIComponent(datasetId)}/items`, {
    query: { format: 'json', clean: true, limit: ITEMS_MAX },
    timeoutMs: ITEMS_TIMEOUT_MS,
    ...opts,
  });
  if (!r.ok) return r;
  return { ok: true, items: Array.isArray(r.daten) ? r.daten : [] };
}

module.exports = {
  ACTOR_STANDARD,
  MAX_USD_STANDARD,
  WARTEN_S,
  istRunId,
  apifyKonfig,
  laufAusRun,
  laufStarten,
  laufStand,
  laufAbbrechen,
  laufItems,
};
