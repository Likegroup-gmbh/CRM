// vorschau-quelle.js
// Quelle-Adapter der Vorschaudatei: liefert fuer einen Quelle-Schluessel eine frische,
// von aussen abrufbare URL des Originals, die der Anbieter selbst herunterlaedt.
// Jetzt Dropbox (Temp-Link, 4 h gueltig), spaeter SharePoint ueber Graph
// (/drives/{id}/items/{id}/content bzw. @microsoft.graph.downloadUrl).

const { getAccessToken } = require('./dropbox');

const TOKEN_TTL_MS = 3 * 60 * 60 * 1000;
let cachedToken = null;

class QuelleError extends Error {
  constructor(message, permanent = false) {
    super(message);
    this.name = 'QuelleError';
    this.permanent = permanent;
  }
}

async function dropboxToken() {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
  const value = await getAccessToken();
  cachedToken = { value, expires: Date.now() + TOKEN_TTL_MS };
  return value;
}

async function dropboxUrl(path, fetchImpl) {
  const token = await dropboxToken();
  const resp = await fetchImpl('https://api.dropboxapi.com/2/files/get_temporary_link', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (resp.ok) return (await resp.json()).link;
  const text = await resp.text().catch(() => '');
  // 409 = path/not_found u. Ae.: Datei gibt es nicht (mehr), ein Retry aendert nichts.
  if (resp.status === 401) cachedToken = null;
  throw new QuelleError(`Dropbox ${resp.status}: ${text.slice(0, 200)}`, resp.status === 409);
}

/**
 * @param {{ quelle: string, quelle_pfad: string }} schluessel
 * @returns {Promise<string>}
 */
async function originalUrlFor({ quelle, quelle_pfad: pfad }, { fetchImpl = (...a) => fetch(...a) } = {}) {
  if (quelle === 'dropbox') return dropboxUrl(pfad, fetchImpl);
  throw new QuelleError(`Quelle ${quelle} wird noch nicht unterstuetzt`, true);
}

module.exports = { originalUrlFor, QuelleError };
