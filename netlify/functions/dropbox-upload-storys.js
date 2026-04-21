const { getAccessToken, sanitizePath } = require('./_shared/dropbox');

function buildStorysBaseFolderPath({ unternehmen, marke, kampagne, kooperation }) {
  const parts = ['/Videos'];
  if (unternehmen) parts.push(sanitizePath(unternehmen));
  if (marke) parts.push(sanitizePath(marke));
  if (kampagne) parts.push(sanitizePath(kampagne));
  if (kooperation) parts.push(sanitizePath(kooperation));
  parts.push('Storys');
  return parts.join('/');
}

function buildVideoFolderPath(fields) {
  const base = buildStorysBaseFolderPath(fields);
  const pos = fields.videoPosition || 1;
  const thema = sanitizePath(fields.videoThema || '');
  return thema ? `${base}/Video_${pos}_${thema}` : `${base}/Video_${pos}`;
}

function buildSlotFolderPath(fields) {
  const videoFolder = buildVideoFolderPath(fields);
  const slotIdx = fields.slotIndex || 1;
  return `${videoFolder}/Story_${slotIdx}`;
}

function buildStorysVersionFolderPath(fields) {
  const slotFolder = buildSlotFolderPath(fields);
  const version = fields.versionNumber || 1;
  return `${slotFolder}/Version_${version}`;
}

function buildStorysFilePath(fields) {
  const folder = buildStorysVersionFolderPath(fields);
  const name = sanitizePath(fields.fileName) || 'story.mp4';
  return `${folder}/${name}`;
}

exports.buildStorysBaseFolderPath = buildStorysBaseFolderPath;
exports.buildVideoFolderPath = buildVideoFolderPath;
exports.buildSlotFolderPath = buildSlotFolderPath;
exports.buildStorysVersionFolderPath = buildStorysVersionFolderPath;

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
    const videoFolderPath = buildVideoFolderPath(fields);
    const versionFolderPath = buildStorysVersionFolderPath(fields);

    if (action === 'list') {
      try {
        const targetPath = fields.slotIndex
          ? (fields.versionNumber ? versionFolderPath : buildSlotFolderPath(fields))
          : videoFolderPath;
        const resp = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: targetPath, recursive: !fields.versionNumber, include_deleted: false }),
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

    if (action === 'delete-version') {
      try {
        const resp = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: versionFolderPath }),
        });

        if (!resp.ok) {
          const text = await resp.text();
          if (resp.status === 409 && text.includes('not_found')) {
            return {
              statusCode: 200,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ deleted: true }),
            };
          }
          throw new Error(`delete_v2 failed: ${resp.status} – ${text}`);
        }

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ deleted: true }),
        };
      } catch (err) {
        console.error('dropbox-upload-storys delete-version error:', err);
        return {
          statusCode: 500,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: err.message }),
        };
      }
    }

    // action === 'prepare' (default)
    const dropboxPath = buildStorysFilePath(fields);

    try {
      await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: versionFolderPath, autorename: false }),
      });
    } catch (_) { /* Ordner existiert evtl. schon */ }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, dropboxPath, folderPath: versionFolderPath, videoFolderPath }),
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
