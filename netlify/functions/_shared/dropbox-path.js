// Plausibilitaetspruefung fuer Dropbox-Pfade, die vom Client kommen.
// Dateiendungen werden bewusst nicht geprueft: Aufrufer loeschen auch Ordner.

function isSafeDropboxPath(path) {
  if (typeof path !== 'string') return false;
  const p = path.trim();
  if (p.length < 2 || p.length > 1024) return false;
  if (!p.startsWith('/')) return false;
  if (/(^|\/)\.\.(\/|$)/.test(p)) return false;
  if (/[\u0000-\u001f]/.test(p)) return false;
  return true;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

module.exports = { isSafeDropboxPath, isUuid };
