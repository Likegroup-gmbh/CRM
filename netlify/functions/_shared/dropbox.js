const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
// Puffer vor Ablauf: ein Token, das mitten in einem langen Upload abläuft, kostet einen 401-Refresh
const TOKEN_MARGIN_MS = 5 * 60 * 1000;

// Lebt pro warmer Function-Instanz; spart den OAuth-Roundtrip vor jedem Dropbox-Call.
let cachedToken = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  // Parallele Aufrufe während des Refreshs teilen sich denselben Request
  const pending = refreshAccessToken().then(({ token, expiresIn }) => {
    cachedToken = { token: Promise.resolve(token), expiresAt: Date.now() + expiresIn * 1000 - TOKEN_MARGIN_MS };
    return token;
  });
  cachedToken = { token: pending, expiresAt: Infinity };
  pending.catch(() => { if (cachedToken?.token === pending) cachedToken = null; });
  return pending;
}

async function refreshAccessToken() {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;

  if (!refreshToken || !appKey || !appSecret) {
    console.error(`[dropbox-auth] refreshToken=${refreshToken ? 'set' : 'MISSING'} appKey=${appKey ? 'set' : 'MISSING'} appSecret=${appSecret ? 'set' : 'MISSING'}`);
    throw new Error('Dropbox credentials not configured');
  }

  const resp = await fetch(DROPBOX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`[dropbox-auth] token-refresh FAILED (${resp.status}): ${text}`);
    throw new Error(`Token refresh failed: ${resp.status} – ${text}`);
  }

  const data = await resp.json();
  const token = data.access_token;

  if (!token || typeof token !== 'string' || token.length < 10) {
    throw new Error(`Invalid access token from refresh: type=${typeof token} len=${token ? token.length : 0}`);
  }

  // Dropbox liefert expires_in in Sekunden (heute 4 h); ohne Angabe kurz cachen
  const expiresIn = Number(data.expires_in) > 0 ? Number(data.expires_in) : 600;
  return { token, expiresIn };
}

function sanitizePath(str) {
  if (!str) return '';
  return str
    .replace(/[<>:"|?*\\/]/g, '-')
    .replace(/-{2,}/g, '-')
    .trim();
}

// Einheitlicher Stammpfad für ALLE Uploads pro Unternehmen/Marke/Kampagne/Kooperation.
// Bestandteile werden nur hinzugefügt wenn truthy. Fehlt unternehmen, wird ein
// dokumentierter Fallback-Ordner /_unzugeordnet verwendet, damit Uploads nie im
// Dropbox-Root landen.
function buildUnifiedBasePath({ unternehmen, marke, kampagne, kooperation }) {
  const parts = [];
  if (unternehmen) parts.push(sanitizePath(unternehmen));
  if (marke) parts.push(sanitizePath(marke));
  if (kampagne) parts.push(sanitizePath(kampagne));
  if (kooperation) parts.push(sanitizePath(kooperation));
  if (parts.length === 0) return '/_unzugeordnet';
  return '/' + parts.join('/');
}

// Legt einen Ordner inkl. aller Parents in Dropbox an. 409 (existiert bereits)
// wird als Erfolg behandelt, alle anderen Fehler nur geloggt (nicht geworfen),
// damit ein evtl. nachfolgender Upload trotzdem starten kann.
async function ensureFolder(token, folderPath) {
  if (!folderPath || folderPath === '/') return;
  try {
    const resp = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath, autorename: false }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      // 409 = path/conflict/folder -> Ordner existiert schon, kein Fehler
      if (resp.status === 409) return;
      console.warn(`[dropbox] ensureFolder non-ok (${resp.status}) für ${folderPath}: ${text}`);
    }
  } catch (err) {
    console.warn(`[dropbox] ensureFolder error für ${folderPath}: ${err.message || err}`);
  }
}

module.exports = { getAccessToken, sanitizePath, buildUnifiedBasePath, ensureFolder };
