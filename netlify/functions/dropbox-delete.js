const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_DELETE_URL = 'https://api.dropboxapi.com/2/files/delete_v2';

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
    const { filePath } = JSON.parse(event.body || '{}');

    if (!filePath) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'filePath is required' }),
      };
    }

    console.log('dropbox-delete filePath:', filePath);

    const token = await getAccessToken();

    const resp = await fetch(DROPBOX_DELETE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: filePath }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      // 409 path_lookup/not_found = file already gone, treat as success
      if (resp.status === 409 && text.includes('not_found')) {
        console.log('dropbox-delete: file already gone, treating as success');
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, alreadyDeleted: true }),
        };
      }
      throw new Error(`Dropbox delete failed: ${resp.status} – ${text}`);
    }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('dropbox-delete error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed to delete file' }),
    };
  }
};
