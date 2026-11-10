// _shared/ablage/graph.js
// Duenner HTTP-Client fuer Microsoft Graph und die SharePoint-REST-API:
// Bearer-Token, Retry bei 429/503/504 mit Retry-After, einmal neuer Token bei 401.

const GRAPH_BASIS = 'https://graph.microsoft.com/v1.0';
const MAX_WARTEN_SEK = 30;

class GraphError extends Error {
  constructor(status, code, message, { retryAfter = null, body = null } = {}) {
    super(message || code || `HTTP ${status}`);
    this.name = 'GraphError';
    this.status = status;
    this.code = code || null;
    this.retryAfter = retryAfter;
    this.body = body;
  }
}

const istNichtGefunden = (err) => err?.status === 404 || err?.code === 'itemNotFound';
const istKonflikt = (err) => err?.status === 409 || err?.code === 'nameAlreadyExists';
const istVorbedingung = (err) => err?.status === 412;

function retryAfterSek(resp) {
  const raw = resp.headers?.get?.('retry-after');
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function fehlerAus(resp) {
  const text = await resp.text().catch(() => '');
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  // Graph: { error: { code, message } }, SharePoint REST: { 'odata.error': { code, message: { value } } }
  const g = body?.error;
  const sp = body?.['odata.error'];
  const code = g?.code || sp?.code || null;
  const message = g?.message || sp?.message?.value || text.slice(0, 300) || `HTTP ${resp.status}`;
  return new GraphError(resp.status, code, message, { retryAfter: retryAfterSek(resp), body });
}

/**
 * @param {object} deps
 * @param {(opts?:{neu?:boolean}) => Promise<string>} deps.token
 * @param {string} [deps.basis]
 */
function createHttp({
  token,
  basis = GRAPH_BASIS,
  fetchImpl = (...a) => fetch(...a),
  schlafen = (ms) => new Promise((r) => setTimeout(r, ms)),
  maxVersuche = 4,
  standardHeader = {},
} = {}) {
  async function anfrage(pfad, { method = 'GET', body, rawBody, headers = {}, ohneAuth = false, roh = false } = {}) {
    const url = /^https?:\/\//.test(pfad) ? pfad : `${basis}${pfad}`;
    let neu = false;
    for (let versuch = 1; ; versuch++) {
      const h = { ...standardHeader, ...headers };
      if (!ohneAuth) h.Authorization = `Bearer ${await token({ neu })}`;
      if (body !== undefined && !h['Content-Type']) h['Content-Type'] = 'application/json';
      const resp = await fetchImpl(url, {
        method,
        headers: h,
        body: rawBody !== undefined ? rawBody : (body !== undefined ? JSON.stringify(body) : undefined),
      });

      if ((resp.status === 429 || resp.status === 503 || resp.status === 504) && versuch < maxVersuche) {
        const sek = Math.min(retryAfterSek(resp) ?? 2 ** versuch, MAX_WARTEN_SEK);
        await schlafen(sek * 1000);
        continue;
      }
      if (resp.status === 401 && !ohneAuth && !neu) {
        neu = true;
        continue;
      }
      if (!resp.ok) throw await fehlerAus(resp);
      if (roh) return resp;
      const loc = resp.headers?.get?.('location');
      const ct = resp.headers?.get?.('content-type') || '';
      if (resp.status === 204 || (resp.status === 202 && !ct.includes('json'))) {
        return loc ? { location: loc } : null;
      }
      if (ct.includes('json')) {
        const data = await resp.json();
        return loc && data && typeof data === 'object' ? { ...data, location: loc } : data;
      }
      const text = await resp.text();
      return text ? { text } : null;
    }
  }

  return {
    anfrage,
    get: (p, o = {}) => anfrage(p, { ...o, method: 'GET' }),
    post: (p, body, o = {}) => anfrage(p, { ...o, method: 'POST', body }),
    patch: (p, body, o = {}) => anfrage(p, { ...o, method: 'PATCH', body }),
    put: (p, o = {}) => anfrage(p, { ...o, method: 'PUT' }),
    del: (p, o = {}) => anfrage(p, { ...o, method: 'DELETE' }),
  };
}

/** Alle Seiten einer Collection (@odata.nextLink) einsammeln. */
async function alleSeiten(http, pfad, { max = 50 } = {}) {
  const out = [];
  let next = pfad;
  for (let i = 0; next && i < max; i++) {
    const page = await http.get(next);
    out.push(...(page?.value || []));
    next = page?.['@odata.nextLink'] || null;
  }
  return out;
}

/**
 * $batch mit max. 20 Requests. Liefert die Antworten in Eingabe-Reihenfolge:
 * { status, body, headers }. 429 im Batch -> GraphError (Aufrufer entscheidet).
 */
async function batch(http, requests) {
  const out = new Array(requests.length);
  for (let start = 0; start < requests.length; start += 20) {
    const teil = requests.slice(start, start + 20);
    const res = await http.post('/$batch', {
      requests: teil.map((r, i) => ({ id: String(i), method: r.method || 'GET', url: r.url, ...(r.body ? { body: r.body, headers: { 'Content-Type': 'application/json' } } : {}) })),
    });
    const throttled = (res?.responses || []).find((r) => r.status === 429);
    if (throttled) {
      const ra = Number(throttled.headers?.['Retry-After'] ?? throttled.headers?.['retry-after']);
      throw new GraphError(429, 'tooManyRequests', 'Graph drosselt ($batch)', { retryAfter: Number.isFinite(ra) ? ra : null });
    }
    for (const r of res?.responses || []) {
      out[start + Number(r.id)] = { status: r.status, body: r.body, headers: r.headers || {} };
    }
  }
  return out;
}

module.exports = {
  GRAPH_BASIS,
  GraphError,
  createHttp,
  alleSeiten,
  batch,
  istNichtGefunden,
  istKonflikt,
  istVorbedingung,
};
