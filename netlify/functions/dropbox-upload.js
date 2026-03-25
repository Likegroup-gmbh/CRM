const { getAccessToken, sanitizePath } = require('./_shared/dropbox');

function buildDropboxPath({ unternehmen, marke, kampagne, kooperation, videoPosition, videoThema, videoTitel, versionNumber, fileName }) {
  const parts = ['/Videos'];
  if (unternehmen) parts.push(sanitizePath(unternehmen));
  if (marke) parts.push(sanitizePath(marke));
  if (kampagne) parts.push(sanitizePath(kampagne));
  if (kooperation) parts.push(sanitizePath(kooperation));

  const thema = sanitizePath(videoThema || '');
  const pos = videoPosition || 1;
  parts.push(thema ? `Video_${pos}_${thema}` : `Video_${pos}`);

  parts.push(`Version_${versionNumber || 1}`);

  const name = sanitizePath(fileName) || `V${versionNumber || 1}_${sanitizePath(videoTitel || 'Video')}.mp4`;
  parts.push(name);

  return parts.join('/');
}

exports.buildDropboxPath = buildDropboxPath;

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

    console.log('dropbox-upload fields:', JSON.stringify(fields));

    const token = await getAccessToken();

    const dropboxPath = buildDropboxPath({
      unternehmen: fields.unternehmen,
      marke: fields.marke,
      kampagne: fields.kampagne,
      kooperation: fields.kooperation,
      videoPosition: fields.videoPosition,
      videoThema: fields.videoThema,
      videoTitel: fields.videoTitel,
      versionNumber: fields.versionNumber,
      fileName: fields.fileName,
    });

    console.log('dropbox-upload path:', dropboxPath);

    const folderPath = dropboxPath.substring(0, dropboxPath.lastIndexOf('/'));

    try {
      await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath, autorename: false }),
      });
    } catch (_) { /* Ordner existiert evtl. schon – 409 ist okay */ }

    const kooperationFolderPath = folderPath.substring(0, folderPath.lastIndexOf('/'));

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, dropboxPath, folderPath, kooperationFolderPath }),
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
