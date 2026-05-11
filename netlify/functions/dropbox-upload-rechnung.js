const { getAccessToken, sanitizePath, buildUnifiedBasePath, ensureFolder } = require('./_shared/dropbox');

// Pfad für Rechnungs-PDFs und Belege.
// Einheitliche Hierarchie:
//   /{Unternehmen}/{Marke}/{Kampagne}/{Kooperation}/Rechnungen/{Rechnungsnummer}/{fileName}
//   /{Unternehmen}/{Marke}/{Kampagne}/{Kooperation}/Rechnungen/{Rechnungsnummer}/Belege/{fileName}
//
// Bei Contracting-Rechnungen (kein kampagne/kooperation) fällt der Pfad zurück auf:
//   /{Unternehmen}/Contracting/Rechnungen/{Rechnungsnummer}/...
function buildRechnungPath({
  unternehmen, marke, kampagne, kooperation,
  rechnungsNr, kind, fileName,
}) {
  const hasKampagne = !!kampagne;
  let parts;

  if (!hasKampagne && unternehmen) {
    parts = ['/' + sanitizePath(unternehmen), 'Contracting', 'Rechnungen'];
  } else {
    const base = buildUnifiedBasePath({ unternehmen, marke, kampagne, kooperation });
    parts = [base, 'Rechnungen'];
  }

  const nr = sanitizePath(rechnungsNr || '') || `Rechnung_${Date.now()}`;
  parts.push(nr);

  if (kind === 'beleg') {
    parts.push('Belege');
  }

  const name = sanitizePath(fileName) || (kind === 'beleg' ? `beleg_${Date.now()}` : `rechnung_${Date.now()}.pdf`);
  parts.push(name);

  return parts.join('/');
}

exports.buildRechnungPath = buildRechnungPath;

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
    const kind = fields.kind === 'beleg' ? 'beleg' : 'pdf';

    console.log('dropbox-upload-rechnung fields:', JSON.stringify({ ...fields, kind }));

    const token = await getAccessToken();

    const dropboxPath = buildRechnungPath({
      unternehmen: fields.unternehmen,
      marke: fields.marke,
      kampagne: fields.kampagne,
      kooperation: fields.kooperation,
      rechnungsNr: fields.rechnungsNr,
      kind,
      fileName: fields.fileName,
    });

    console.log('dropbox-upload-rechnung path:', dropboxPath);

    const folderPath = dropboxPath.substring(0, dropboxPath.lastIndexOf('/'));
    await ensureFolder(token, folderPath);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, dropboxPath, folderPath }),
    };
  } catch (err) {
    console.error('dropbox-upload-rechnung error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed to get token' }),
    };
  }
};
