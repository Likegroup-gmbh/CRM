// cloudflare-stream.js
// Client fuer Cloudflare Stream, den Anbieter der Vorschaudatei. Nur die Calls, die
// der Vorschau-Pfad braucht: per URL kopieren, Status und MP4-Download, loeschen,
// Webhook-Signatur pruefen und Links lokal signieren (kein API-Call pro Link, sonst
// haengt die Tail-Latenz des Players an einer fremden API).
//
// Videos werden immer mit requireSignedURLs angelegt: ohne Token kein Abruf.
//
// Env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_API_TOKEN, CLOUDFLARE_STREAM_CUSTOMER_CODE,
//      CLOUDFLARE_STREAM_SIGNING_KEY_ID, CLOUDFLARE_STREAM_SIGNING_KEY_PEM (base64 oder PEM),
//      CLOUDFLARE_STREAM_WEBHOOK_SECRET

const crypto = require('crypto');

const API = 'https://api.cloudflare.com/client/v4';
/** Aeltere Webhook-Zeitstempel werden verworfen (Replay-Schutz). */
const WEBHOOK_MAX_AGE_SEC = 5 * 60;

class StreamError extends Error {
  constructor(message, status = 0, retryable = false) {
    super(message);
    this.name = 'StreamError';
    this.status = status;
    this.retryable = retryable;
  }
}

function streamConfig(env = process.env) {
  return {
    accountId: env.CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: env.CLOUDFLARE_STREAM_API_TOKEN || '',
    customerCode: env.CLOUDFLARE_STREAM_CUSTOMER_CODE || '',
    keyId: env.CLOUDFLARE_STREAM_SIGNING_KEY_ID || '',
    keyPem: env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM || '',
    webhookSecret: env.CLOUDFLARE_STREAM_WEBHOOK_SECRET || '',
  };
}

function createStreamClient(cfg = streamConfig(), { fetchImpl = (...a) => fetch(...a) } = {}) {
  async function api(method, path, body) {
    if (!cfg.accountId || !cfg.apiToken) {
      throw new StreamError('Cloudflare-Stream-Konfiguration fehlt', 500, false);
    }
    let resp;
    try {
      resp = await fetchImpl(`${API}/accounts/${cfg.accountId}/stream${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${cfg.apiToken}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new StreamError(`Cloudflare nicht erreichbar: ${err.message}`, 0, true);
    }
    const data = await resp.json().catch(() => null);
    if (!resp.ok || data?.success === false) {
      const msg = (data?.errors || []).map((e) => e.message).join('; ') || `HTTP ${resp.status}`;
      throw new StreamError(msg, resp.status, resp.status === 429 || resp.status >= 500);
    }
    return data?.result ?? null;
  }

  return {
    /**
     * Original per URL kopieren lassen. Cloudflare holt die Datei selbst, kein Byte
     * laeuft durch die Function. `meta` landet im Webhook wieder bei uns.
     * @returns {Promise<{ uid: string }>}
     */
    copyFromUrl({ url, name, meta = {} }) {
      const strMeta = Object.fromEntries(Object.entries({ name, ...meta }).map(([k, v]) => [k, String(v ?? '')]));
      return api('POST', '/copy', { url, meta: strMeta, requireSignedURLs: true });
    },
    getVideo: (uid) => api('GET', `/${encodeURIComponent(uid)}`),
    /** MP4-Download anstossen (erst nach readyToStream moeglich). */
    async enableDownload(uid) {
      const result = await api('POST', `/${encodeURIComponent(uid)}/downloads`);
      return result?.default || null;
    },
    async getDownload(uid) {
      const result = await api('GET', `/${encodeURIComponent(uid)}/downloads`);
      return result?.default || null;
    },
    /** Loeschen; schon geloescht (404) gilt als erledigt. */
    async deleteVideo(uid) {
      try {
        await api('DELETE', `/${encodeURIComponent(uid)}`);
        return true;
      } catch (err) {
        if (err.status === 404) return false;
        throw err;
      }
    },
  };
}

/**
 * Webhook-Header `Webhook-Signature: time=<unix>,sig1=<hex>` pruefen:
 * HMAC-SHA256(secret, `${time}.${rawBody}`), Vergleich in konstanter Zeit.
 */
function verifyWebhookSignature(secret, header, rawBody, nowSec = Math.floor(Date.now() / 1000)) {
  if (!secret || !header || typeof rawBody !== 'string') return false;
  const parts = Object.fromEntries(String(header).split(',').map((kv) => {
    const i = kv.indexOf('=');
    return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
  }));
  const time = Number(parts.time);
  if (!Number.isFinite(time) || !/^[0-9a-f]{64}$/i.test(parts.sig1 || '')) return false;
  if (Math.abs(nowSec - time) > WEBHOOK_MAX_AGE_SEC) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.time}.${rawBody}`).digest();
  const given = Buffer.from(parts.sig1, 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const b64url = (input) => Buffer.from(input).toString('base64url');

function signingKey(pem) {
  const text = pem.includes('-----BEGIN') ? pem : Buffer.from(pem, 'base64').toString('utf8');
  return crypto.createPrivateKey(text.replace(/\\n/g, '\n'));
}

/**
 * Signierten Token fuer ein Video lokal erzeugen (RS256 mit dem Signing Key).
 * `downloadable` gibt den MP4-Download frei.
 */
function signStreamToken(cfg, uid, { ttlSec, nowSec = Math.floor(Date.now() / 1000) }) {
  if (!cfg.keyId || !cfg.keyPem) throw new StreamError('Signing Key fehlt', 500, false);
  const header = b64url(JSON.stringify({ alg: 'RS256', kid: cfg.keyId }));
  const payload = b64url(JSON.stringify({
    sub: uid,
    kid: cfg.keyId,
    exp: nowSec + ttlSec,
    nbf: nowSec - 60,
    downloadable: true,
  }));
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), signingKey(cfg.keyPem));
  return `${header}.${payload}.${b64url(signature)}`;
}

function downloadUrl(cfg, token) {
  if (!cfg.customerCode) throw new StreamError('Customer-Code fehlt', 500, false);
  return `https://customer-${cfg.customerCode}.cloudflarestream.com/${token}/downloads/default.mp4`;
}

module.exports = {
  StreamError,
  streamConfig,
  createStreamClient,
  verifyWebhookSignature,
  signStreamToken,
  downloadUrl,
  WEBHOOK_MAX_AGE_SEC,
};
