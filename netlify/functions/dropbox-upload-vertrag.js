const { getAccessToken, sanitizePath, buildUnifiedBasePath, ensureFolder } = require('./_shared/dropbox');

// Pfad für (unterschriebene) Vertrags-PDFs.
// Einheitliche Hierarchie:
//   /{Unternehmen}/{Marke}/{Kampagne}/{Kooperation}/Vertraege/{Creator}_{Vertragstyp}/{fileName}
// kooperation, marke und creator/vertragstyp sind alle optional und werden nur
// als Pfadsegment angefügt, wenn vorhanden.
function buildVertragPath({ unternehmen, marke, kampagne, kooperation, creator, vertragstyp, fileName }) {
  const base = buildUnifiedBasePath({ unternehmen, marke, kampagne, kooperation });
  const parts = [base, 'Vertraege'];

  const creatorPart = sanitizePath(creator || '');
  const typPart = sanitizePath(vertragstyp || '');
  let leafFolder = '';
  if (creatorPart && typPart) leafFolder = `${creatorPart}_${typPart}`;
  else if (creatorPart) leafFolder = creatorPart;
  else if (typPart) leafFolder = typPart;
  if (leafFolder) parts.push(leafFolder);

  const name = sanitizePath(fileName) || `Vertrag_${Date.now()}.pdf`;
  parts.push(name);

  return parts.join('/');
}

exports.buildVertragPath = buildVertragPath;

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
      marke: fields.marke,
      kampagne: fields.kampagne,
      kooperation: fields.kooperation,
      creator: fields.creator,
      vertragstyp: fields.vertragstyp,
      fileName: fields.fileName,
    });

    console.log('dropbox-upload-vertrag path:', dropboxPath);

    const folderPath = dropboxPath.substring(0, dropboxPath.lastIndexOf('/'));
    await ensureFolder(token, folderPath);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, dropboxPath, folderPath }),
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
