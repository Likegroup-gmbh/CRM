const { getAccessToken } = require('./_shared/dropbox');

const DROPBOX_DELETE_URL = 'https://api.dropboxapi.com/2/files/delete_v2';

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

    console.log('dropbox-delete-vertrag filePath:', filePath);

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
      if (resp.status === 409 && text.includes('not_found')) {
        console.log('dropbox-delete-vertrag: file already gone, treating as success');
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
    console.error('dropbox-delete-vertrag error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed to delete file' }),
    };
  }
};
