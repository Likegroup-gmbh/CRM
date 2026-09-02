const { getAccessToken, sanitizePath, buildUnifiedBasePath, ensureFolder } = require('./_shared/dropbox');

// Rohmaterial liegt auf Kooperations-Ebene, Geschwister von Videos/Storys/Bilder.
// Kein Video-Unterordner: der Creator liefert einen Stapel Clips, bevor die
// Video-Slots geschnitten sind.
function buildRohmaterialFolderPath({ unternehmen, marke, kampagne, kooperation }) {
  const base = buildUnifiedBasePath({ unternehmen, marke, kampagne, kooperation });
  return `${base}/Rohmaterial`;
}

// Originalname bleibt erhalten (der Cutter erkennt seine Clips daran), nur
// Dropbox-verbotene Zeichen werden ersetzt.
function buildRohmaterialFilePath(fields) {
  const folder = buildRohmaterialFolderPath(fields);
  const name = sanitizePath(fields.fileName) || 'rohmaterial.mp4';
  return `${folder}/${name}`;
}

exports.buildRohmaterialFolderPath = buildRohmaterialFolderPath;
exports.buildRohmaterialFilePath = buildRohmaterialFilePath;

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

    console.log('dropbox-upload-rohmaterial action:', action, 'fields:', JSON.stringify(fields));

    const token = await getAccessToken();
    const folderPath = buildRohmaterialFolderPath(fields);

    if (action === 'ensure-folder') {
      await ensureFolder(token, folderPath);
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, folderPath }),
      };
    }

    // action === 'prepare' (default)
    const dropboxPath = buildRohmaterialFilePath(fields);
    await ensureFolder(token, folderPath);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, dropboxPath, folderPath }),
    };
  } catch (err) {
    console.error('dropbox-upload-rohmaterial error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed' }),
    };
  }
};
