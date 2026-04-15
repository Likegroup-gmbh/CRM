const { getAccessToken, sanitizePath } = require('./_shared/dropbox');

function buildStorysFolderPath({ unternehmen, marke, kampagne, kooperation }) {
  const parts = ['/Videos'];
  if (unternehmen) parts.push(sanitizePath(unternehmen));
  if (marke) parts.push(sanitizePath(marke));
  if (kampagne) parts.push(sanitizePath(kampagne));
  if (kooperation) parts.push(sanitizePath(kooperation));
  parts.push('Storys');
  return parts.join('/');
}

function buildStorysFilePath(fields) {
  const folder = buildStorysFolderPath(fields);
  const name = sanitizePath(fields.fileName) || 'story.mp4';
  return `${folder}/${name}`;
}

exports.buildStorysFolderPath = buildStorysFolderPath;

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
    const action = fields.action || 'prepare';

    console.log('dropbox-upload-storys action:', action, 'fields:', JSON.stringify(fields));

    const token = await getAccessToken();
    const folderPath = buildStorysFolderPath(fields);

    if (action === 'list') {
      try {
        const resp = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: folderPath, recursive: false, include_deleted: false }),
        });

        if (!resp.ok) {
          const text = await resp.text();
          if (resp.status === 409 && text.includes('not_found')) {
            return {
              statusCode: 200,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ entries: [] }),
            };
          }
          throw new Error(`list_folder failed: ${resp.status} – ${text}`);
        }

        const data = await resp.json();
        const entries = (data.entries || [])
          .filter(e => e['.tag'] === 'file')
          .map(e => ({
            name: e.name,
            path: e.path_display,
            size: e.size,
            modified: e.server_modified,
          }));

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries }),
        };
      } catch (err) {
        console.error('dropbox-upload-storys list error:', err);
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: [], error: err.message }),
        };
      }
    }

    // action === 'prepare' (default)
    const dropboxPath = buildStorysFilePath(fields);

    try {
      await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath, autorename: false }),
      });
    } catch (_) { /* Ordner existiert evtl. schon */ }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, dropboxPath, folderPath }),
    };
  } catch (err) {
    console.error('dropbox-upload-storys error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed' }),
    };
  }
};
