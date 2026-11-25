// _shared/ablage/graph-auth.js
// App-only-Token per Client-Assertion (Zertifikat). Die SharePoint-REST-API nimmt
// fuer App-Zugriff kein Client-Secret, deshalb Zertifikat fuer Graph und REST.
// Schluessel + Zertifikat kommen aus dem Vault (RPC ablage_geheimnis); lokal per Env.

const crypto = require('crypto');
const { sharePointKonfig, serviceClient } = require('./konfig');

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const MARGIN_MS = 5 * 60 * 1000;

const VAULT_SCHLUESSEL = 'medienablage_schluessel';
const VAULT_ZERTIFIKAT = 'medienablage_zertifikat';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function pemAusEnv(name) {
  const raw = process.env[name];
  if (!raw) return null;
  return raw.includes('-----BEGIN') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8');
}

function zertifikatLesen(keyPem, certPem) {
  const x509 = new crypto.X509Certificate(certPem);
  // x5t = SHA-1-Fingerabdruck des DER-Zertifikats, base64url
  const x5t = b64url(crypto.createHash('sha1').update(x509.raw).digest());
  return {
    key: crypto.createPrivateKey(keyPem),
    x5t,
    ablauf: new Date(x509.validTo),
  };
}

let _zert = null;

async function ladeZertifikat({ supabase } = {}) {
  if (_zert) return _zert;
  _zert = (async () => {
    let keyPem = pemAusEnv('MS_CERT_KEY');
    let certPem = pemAusEnv('MS_CERT');
    if (!keyPem || !certPem) {
      const db = supabase || serviceClient();
      if (!db) throw new Error('Supabase-Service-Konfiguration fehlt (Zertifikat)');
      const [k, c] = await Promise.all([
        db.rpc('ablage_geheimnis', { p_name: VAULT_SCHLUESSEL }),
        db.rpc('ablage_geheimnis', { p_name: VAULT_ZERTIFIKAT }),
      ]);
      if (k.error || c.error) throw new Error(`Vault: ${(k.error || c.error).message}`);
      keyPem = k.data;
      certPem = c.data;
    }
    if (!keyPem || !certPem) throw new Error('Zertifikat fuer die Medienablage fehlt (Vault medienablage_*)');
    return zertifikatLesen(keyPem, certPem);
  })();
  _zert.catch(() => { _zert = null; });
  return _zert;
}

function clientAssertion({ tenantId, clientId, zert, jetzt = Date.now() }) {
  const now = Math.floor(jetzt / 1000);
  const header = { alg: 'RS256', typ: 'JWT', x5t: zert.x5t };
  const payload = {
    aud: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    iss: clientId,
    sub: clientId,
    jti: crypto.randomUUID(),
    nbf: now - 60,
    iat: now,
    exp: now + 600,
  };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(input), zert.key);
  return `${input}.${b64url(sig)}`;
}

function scopeFuerSharePoint(host) {
  return `https://${host}/.default`;
}

/**
 * Token-Quelle mit Cache pro Scope. Parallele Aufrufe teilen sich einen Request.
 * @returns {(scope:string, opts?:{neu?:boolean}) => Promise<string>}
 */
function createTokenQuelle({
  konfig = sharePointKonfig(),
  fetchImpl = (...a) => fetch(...a),
  zertifikat = () => ladeZertifikat(),
  jetzt = () => Date.now(),
} = {}) {
  const cache = new Map();

  async function holen(scope) {
    const zert = await zertifikat();
    const resp = await fetchImpl(`https://login.microsoftonline.com/${konfig.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: konfig.clientId,
        scope,
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: clientAssertion({ tenantId: konfig.tenantId, clientId: konfig.clientId, zert, jetzt: jetzt() }),
      }).toString(),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.access_token) {
      const msg = data.error_description || data.error || `HTTP ${resp.status}`;
      throw new Error(`Microsoft-Token fehlgeschlagen: ${String(msg).split('\n')[0]}`);
    }
    return { token: data.access_token, expiresAt: jetzt() + (Number(data.expires_in) || 3600) * 1000 - MARGIN_MS };
  }

  return async function token(scope = GRAPH_SCOPE, { neu = false } = {}) {
    const hit = cache.get(scope);
    if (!neu && hit && hit.expiresAt > jetzt()) return hit.token;
    const pending = holen(scope).then((t) => {
      cache.set(scope, { token: Promise.resolve(t.token), expiresAt: t.expiresAt });
      return t.token;
    });
    cache.set(scope, { token: pending, expiresAt: Infinity });
    pending.catch(() => { if (cache.get(scope)?.token === pending) cache.delete(scope); });
    return pending;
  };
}

function _reset() {
  _zert = null;
}

module.exports = {
  GRAPH_SCOPE,
  VAULT_SCHLUESSEL,
  VAULT_ZERTIFIKAT,
  zertifikatLesen,
  ladeZertifikat,
  clientAssertion,
  scopeFuerSharePoint,
  createTokenQuelle,
  _reset,
};
