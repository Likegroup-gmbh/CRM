const { getAccessToken, sanitizePath } = require('./_shared/dropbox');

function buildAuftragsbestaetigungPath({ unternehmen, marke, auftragstitel, fileName }) {
  const parts = ['/Auftragsbestaetigungen'];
  if (unternehmen) parts.push(sanitizePath(unternehmen));
  if (marke) parts.push(sanitizePath(marke));
  if (auftragstitel) parts.push(sanitizePath(auftragstitel));

  const name = sanitizePath(fileName) || `Auftragsbestaetigung_${Date.now()}.pdf`;
  parts.push(name);

  return parts.join('/');
}

exports.buildAuftragsbestaetigungPath = buildAuftragsbestaetigungPath;

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

    console.log('dropbox-upload-auftragsbestaetigung fields:', JSON.stringify(fields));

    const token = await getAccessToken();

    const dropboxPath = buildAuftragsbestaetigungPath({
      unternehmen: fields.unternehmen,
      marke: fields.marke,
      auftragstitel: fields.auftragstitel,
      fileName: fields.fileName,
    });

    console.log('dropbox-upload-auftragsbestaetigung path:', dropboxPath);

    const folderPath = dropboxPath.substring(0, dropboxPath.lastIndexOf('/'));

    try {
      await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath, autorename: false }),
      });
    } catch (_) { /* Ordner existiert evtl. schon – 409 ist okay */ }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, dropboxPath, folderPath }),
    };
  } catch (err) {
    console.error('dropbox-upload-auftragsbestaetigung error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed to get token' }),
    };
  }
};
