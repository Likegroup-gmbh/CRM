const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';

async function getAccessToken() {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;

  console.log(`[dropbox-auth] refreshToken=${refreshToken ? `set(${refreshToken.length}chars)` : 'MISSING'} appKey=${appKey ? 'set' : 'MISSING'} appSecret=${appSecret ? 'set' : 'MISSING'}`);

  if (!refreshToken || !appKey || !appSecret) {
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

  console.log(`[dropbox-auth] token-refresh status=${resp.status}`);

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`[dropbox-auth] token-refresh FAILED: ${text}`);
    throw new Error(`Token refresh failed: ${resp.status} – ${text}`);
  }

  const data = await resp.json();
  const token = data.access_token;
  console.log(`[dropbox-auth] token-refresh OK: tokenType=${typeof token} tokenLen=${token ? token.length : 0} prefix=${token ? token.substring(0, 20) : 'EMPTY'}... expiresIn=${data.expires_in}`);

  if (!token || typeof token !== 'string' || token.length < 10) {
    throw new Error(`Invalid access token from refresh: type=${typeof token} len=${token ? token.length : 0}`);
  }

  return token;
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
