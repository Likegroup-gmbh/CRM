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

module.exports = { getAccessToken, sanitizePath };
