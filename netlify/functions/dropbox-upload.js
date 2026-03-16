// dropbox-upload.js
// Gibt einen kurzlebigen Dropbox Access Token + den berechneten Zielpfad zurueck.
// Der eigentliche Upload passiert direkt vom Browser an die Dropbox API,
// um das 6 MB Lambda Body-Limit zu umgehen.

const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';

function sanitizePath(str) {
  if (!str) return '';
  return str
    .replace(/[<>:"|?*\\]/g, '_')
    .replace(/\/{2,}/g, '/')
    .trim();
}

async function getAccessToken() {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;

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

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token refresh failed: ${resp.status} – ${text}`);
  }

  const data = await resp.json();
  return data.access_token;
}

function buildDropboxPath({ unternehmen, marke, kampagne, kooperation, videoTitel, versionNumber, fileName }) {
  const parts = ['/Videos'];
  if (unternehmen) parts.push(sanitizePath(unternehmen));
  if (marke) parts.push(sanitizePath(marke));
  if (kampagne) parts.push(sanitizePath(kampagne));
  if (kooperation) parts.push(sanitizePath(kooperation));

  const origExt = fileName ? fileName.split('.').pop().toLowerCase() : 'mp4';
  const ext = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(origExt) ? origExt : 'mp4';
  const name = `V${versionNumber || 1}_${sanitizePath(videoTitel || 'Video')}.${ext}`;
  parts.push(name);

  return parts.join('/');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const fields = JSON.parse(event.body || '{}');

    const token = await getAccessToken();

    const dropboxPath = buildDropboxPath({
      unternehmen: fields.unternehmen,
      marke: fields.marke,
      kampagne: fields.kampagne,
      kooperation: fields.kooperation,
      videoTitel: fields.videoTitel,
      versionNumber: fields.versionNumber,
      fileName: fields.fileName,
    });

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, dropboxPath }),
    };
  } catch (err) {
    console.error('dropbox-upload error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed to get token' }),
    };
  }
};
