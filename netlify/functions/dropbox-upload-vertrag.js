const { getAccessToken, sanitizePath } = require('./_shared/dropbox');

function buildVertragPath({ unternehmen, kampagne, creator, vertragstyp, fileName }) {
  const parts = ['/Vertraege'];
  if (unternehmen) parts.push(sanitizePath(unternehmen));
  if (kampagne) parts.push(sanitizePath(kampagne));
  if (creator) parts.push(sanitizePath(creator));
  if (vertragstyp) parts.push(sanitizePath(vertragstyp));

  const name = sanitizePath(fileName) || `Vertrag_${Date.now()}.pdf`;
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

    console.log('dropbox-upload-vertrag fields:', JSON.stringify(fields));

    const token = await getAccessToken();

    const dropboxPath = buildVertragPath({
      unternehmen: fields.unternehmen,
      kampagne: fields.kampagne,
      creator: fields.creator,
      vertragstyp: fields.vertragstyp,
      fileName: fields.fileName,
    });

    console.log('dropbox-upload-vertrag path:', dropboxPath);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, dropboxPath }),
    };
  } catch (err) {
    console.error('dropbox-upload-vertrag error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed to get token' }),
    };
  }
};
