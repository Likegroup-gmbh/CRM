const { getAccessToken, sanitizePath, buildUnifiedBasePath, ensureFolder } = require('./_shared/dropbox');

function buildBilderRootFolderPath({ unternehmen, marke, kampagne, kooperation }) {
  const base = buildUnifiedBasePath({ unternehmen, marke, kampagne, kooperation });
  return `${base}/Bilder`;
}

// Mit videoPosition wird ein Video-Unterordner verwendet (Muster wie Storys),
// ohne bleibt der Kooperations-Bilderordner (Altverhalten, z.B. list-Action).
function buildBilderFolderPath(fields) {
  const root = buildBilderRootFolderPath(fields);
  if (!fields.videoPosition) return root;
  const pos = fields.videoPosition;
  const thema = sanitizePath(fields.videoThema || '');
  return thema ? `${root}/Video_${pos}_${thema}` : `${root}/Video_${pos}`;
}

function buildBilderFilePath(fields) {
  const folder = buildBilderFolderPath(fields);
  const name = sanitizePath(fields.fileName) || 'bild.jpg';
  return `${folder}/${name}`;
}

exports.buildBilderFolderPath = buildBilderFolderPath;
exports.buildBilderRootFolderPath = buildBilderRootFolderPath;

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

    console.log('dropbox-upload-bilder action:', action, 'fields:', JSON.stringify(fields));

    const token = await getAccessToken();
    const folderPath = buildBilderFolderPath(fields);

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
        console.error('dropbox-upload-bilder list error:', err);
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: [], error: err.message }),
        };
      }
    }

    if (action === 'ensure-folder') {
      await ensureFolder(token, folderPath);
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, folderPath, rootFolderPath: buildBilderRootFolderPath(fields) }),
      };
    }

    // action === 'prepare' (default)
    const dropboxPath = buildBilderFilePath(fields);
    await ensureFolder(token, folderPath);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, dropboxPath, folderPath, rootFolderPath: buildBilderRootFolderPath(fields) }),
    };
  } catch (err) {
    console.error('dropbox-upload-bilder error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed' }),
    };
  }
};
