const { getAccessToken } = require('./_shared/dropbox');

const DEBUG = true;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// Dropbox verlangt \uXXXX-Escaping fuer alle Non-ASCII-Zeichen im Dropbox-API-Arg Header
// https://www.dropbox.com/developers/reference/json-encoding
function httpHeaderSafeJson(obj) {
  return JSON.stringify(obj).replace(/[\u007f-\uffff]/g, (c) =>
    '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4)
  );
}

function logHeaders(resp, label) {
  if (!DEBUG) return;
  const h = {};
  resp.headers.forEach((v, k) => { h[k] = v; });
  console.log(`[dropbox-proxy] ${label} response-headers:`, JSON.stringify(h));
}

async function handleUploadSmall(token, dropboxPath, fileBuffer) {
  const resp = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': httpHeaderSafeJson({
        path: dropboxPath, mode: 'overwrite', autorename: true, mute: false,
      }),
    },
    body: fileBuffer,
  });
  if (!resp.ok) {
    const text = await resp.text();
    logHeaders(resp, 'upload-small-FAIL');
    throw new Error(`Dropbox upload failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

async function handleSessionStart(token, chunkBuffer) {
  const resp = await fetch('https://content.dropboxapi.com/2/files/upload_session/start', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': httpHeaderSafeJson({ close: false }),
    },
    body: chunkBuffer,
  });
  if (!resp.ok) {
    const text = await resp.text();
    logHeaders(resp, 'session-start-FAIL');
    throw new Error(`Session start failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

async function handleSessionAppend(token, sessionId, offset, chunkBuffer) {
  const resp = await fetch('https://content.dropboxapi.com/2/files/upload_session/append_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': httpHeaderSafeJson({
        cursor: { session_id: sessionId, offset },
        close: false,
      }),
    },
    body: chunkBuffer,
  });
  if (!resp.ok) {
    const text = await resp.text();
    logHeaders(resp, 'session-append-FAIL');
    throw new Error(`Session append failed (${resp.status}): ${text}`);
  }
}

async function handleSessionFinish(token, sessionId, offset, dropboxPath, chunkBuffer) {
  if (DEBUG) console.log(`[dropbox-proxy] session-finish SENDING: tokenLen=${token.length} tokenPrefix=${token.substring(0, 20)}... sessionId=${sessionId} offset=${offset} path=${dropboxPath} chunkLen=${chunkBuffer.length}`);

  const resp = await fetch('https://content.dropboxapi.com/2/files/upload_session/finish', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': httpHeaderSafeJson({
        cursor: { session_id: sessionId, offset },
        commit: { path: dropboxPath, mode: 'overwrite', autorename: true, mute: false },
      }),
    },
    body: chunkBuffer,
  });
  if (!resp.ok) {
    const text = await resp.text();
    logHeaders(resp, 'session-finish-FAIL');
    console.error(`[dropbox-proxy] session-finish FAILED: status=${resp.status} body="${text}" tokenLen=${token.length} tokenPrefix=${token.substring(0, 20)}...`);
    throw new Error(`Session finish failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

async function handleSharedLink(token, path) {
  const resp = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      settings: { requested_visibility: 'public', audience: 'public', access: 'viewer' },
    }),
  });

  if (resp.ok) {
    const data = await resp.json();
    return data.url || null;
  }

  if (resp.status === 409) {
    const listResp = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, direct_only: true }),
    });
    if (listResp.ok) {
      const listData = await listResp.json();
      if (listData.links?.length > 0) return listData.links[0].url;
    }
  }

  return null;
}

async function handleDiagnose() {
  const result = { timestamp: new Date().toISOString() };
  try {
    const token = await getAccessToken();
    result.tokenOk = true;
    result.tokenLen = token.length;
    result.tokenPrefix = token.substring(0, 20) + '...';

    const checkResp = await fetch('https://api.dropboxapi.com/2/check/user', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'diagnose' }),
    });
    result.checkStatus = checkResp.status;
    result.checkBody = await checkResp.text();
    result.checkOk = checkResp.ok;
  } catch (err) {
    result.tokenOk = false;
    result.error = err.message;
  }
  return result;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;

    const body = JSON.parse(rawBody || '{}');
    const { action } = body;

    if (DEBUG) {
      const tokenType = body.token ? typeof body.token : 'none';
      const tokenLen = body.token ? body.token.length : 0;
      const tokenPre = body.token ? body.token.substring(0, 20) : 'N/A';
      console.log(`[dropbox-proxy] action=${action} isBase64Encoded=${event.isBase64Encoded} bodyLen=${(rawBody || '').length} body.token: type=${tokenType} len=${tokenLen} prefix=${tokenPre}...`);
    }

    const tokenSource = body.token ? 'client' : 'refresh';
    const token = body.token || await getAccessToken();

    if (DEBUG) console.log(`[dropbox-proxy] tokenSource=${tokenSource} finalTokenLen=${token.length} finalTokenPrefix=${token.substring(0, 20)}...`);

    switch (action) {
      case 'diagnose': {
        const diag = await handleDiagnose();
        return jsonResponse(200, diag);
      }

      case 'upload-small': {
        const buf = Buffer.from(body.chunk, 'base64');
        if (DEBUG) console.log(`[dropbox-proxy] upload-small chunkSize=${buf.length} path=${body.dropboxPath}`);
        const result = await handleUploadSmall(token, body.dropboxPath, buf);
        return jsonResponse(200, result);
      }

      case 'session-start': {
        const freshToken = await getAccessToken();
        const buf = Buffer.from(body.chunk, 'base64');
        if (DEBUG) console.log(`[dropbox-proxy] session-start chunkSize=${buf.length} tokenLen=${freshToken.length} tokenPrefix=${freshToken.substring(0, 20)}...`);
        const { session_id } = await handleSessionStart(freshToken, buf);
        if (DEBUG) console.log(`[dropbox-proxy] session-start OK: sessionId=${session_id}`);
        return jsonResponse(200, { session_id, token: freshToken });
      }

      case 'session-append': {
        const buf = Buffer.from(body.chunk, 'base64');
        if (DEBUG) console.log(`[dropbox-proxy] session-append chunkSize=${buf.length} offset=${body.offset} sessionId=${body.sessionId}`);
        await handleSessionAppend(token, body.sessionId, body.offset, buf);
        return jsonResponse(200, { ok: true });
      }

      case 'session-finish': {
        const buf = body.chunk ? Buffer.from(body.chunk, 'base64') : Buffer.alloc(0);
        if (DEBUG) console.log(`[dropbox-proxy] session-finish chunkSize=${buf.length} offset=${body.offset} sessionId=${body.sessionId} path=${body.dropboxPath}`);
        const result = await handleSessionFinish(token, body.sessionId, body.offset, body.dropboxPath, buf);
        return jsonResponse(200, result);
      }

      case 'shared-link': {
        const url = await handleSharedLink(token, body.path);
        return jsonResponse(200, { url });
      }

      default:
        return jsonResponse(400, { error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('[dropbox-proxy] ERROR:', err.message, err.stack);
    return jsonResponse(500, { error: err.message || 'Internal error' });
  }
};
