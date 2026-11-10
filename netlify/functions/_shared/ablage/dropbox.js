// _shared/ablage/dropbox.js
// Dropbox-Seite der Ablage-Schnittstelle. Kapselt das bestehende _shared/dropbox.js,
// damit ablage-link & Co. beide Ablagen gleich ansprechen. Schreibpfade fuer Dropbox
// bleiben bis zur Abschaltung in den dropbox-*.js-Functions.

const { getAccessToken } = require('../dropbox');

const istSichererPfad = (p) => typeof p === 'string' && p.startsWith('/') && !p.includes('..');

function createDropboxAblage({ fetchImpl = (...a) => fetch(...a), token = getAccessToken } = {}) {
  async function rpc(pfad, body) {
    const t = await token();
    const resp = await fetchImpl(`https://api.dropboxapi.com/2/${pfad}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, data };
  }

  return {
    art: 'dropbox',

    /** Temporaerer Direktlink (4 h). null, wenn die Datei fehlt. */
    async downloadUrl(pfad) {
      if (!istSichererPfad(pfad)) return null;
      const { ok, status, data } = await rpc('files/get_temporary_link', { path: pfad });
      if (ok) return { url: data.link, ablauf: new Date(Date.now() + 4 * 3600 * 1000).toISOString() };
      if (status === 409) return null;
      throw new Error(`Dropbox ${status}: ${data.error_summary || 'unbekannt'}`);
    },

    async downloadUrls(pfade) {
      const out = new Map();
      for (const p of pfade) out.set(p, (await this.downloadUrl(p).catch(() => null))?.url || null);
      return out;
    },

    async loeschen(pfad) {
      if (!istSichererPfad(pfad)) return false;
      const { ok, status, data } = await rpc('files/delete_v2', { path: pfad });
      if (ok) return true;
      if (status === 409 && /not_found/.test(data.error_summary || '')) return false;
      throw new Error(`Dropbox ${status}: ${data.error_summary || 'unbekannt'}`);
    },
  };
}

module.exports = { createDropboxAblage, istSichererPfad };
