const { getAccessToken, sanitizePath, buildUnifiedBasePath, ensureFolder } = require('./_shared/dropbox');

function buildCustomUploadPath({ unternehmen, marke, kampagne, kooperation, folderName, fileName }) {
  const base = buildUnifiedBasePath({ unternehmen, marke, kampagne, kooperation });
  const folder = sanitizePath(folderName) || 'Upload';
  const name = sanitizePath(fileName) || 'datei';
  return `${base}/${folder}/${name}`;
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

    const dropboxPath = buildCustomUploadPath({
      unternehmen: fields.unternehmen,
      marke: fields.marke,
      kampagne: fields.kampagne,
      kooperation: fields.kooperation,
      folderName: fields.folderName,
      fileName: fields.fileName,
    });

    const folderPath = dropboxPath.substring(0, dropboxPath.lastIndexOf('/'));
    await ensureFolder(token, folderPath);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, dropboxPath, folderPath }),
    };
  } catch (err) {
    console.error('dropbox-upload-custom error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed' }),
    };
  }
};
