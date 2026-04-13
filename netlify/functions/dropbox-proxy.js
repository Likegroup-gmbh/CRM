const { getAccessToken } = require('./_shared/dropbox');

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

async function handleUploadSmall(token, dropboxPath, fileBuffer) {
  const resp = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: dropboxPath, mode: 'overwrite', autorename: true, mute: false,
      }),
    },
    body: fileBuffer,
  });
  if (!resp.ok) throw new Error(`Dropbox upload failed (${resp.status}): ${await resp.text()}`);
  return resp.json();
}

async function handleSessionStart(token, chunkBuffer) {
  const resp = await fetch('https://content.dropboxapi.com/2/files/upload_session/start', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ close: false }),
    },
    body: chunkBuffer,
  });
  if (!resp.ok) throw new Error(`Session start failed (${resp.status}): ${await resp.text()}`);
  return resp.json();
}

async function handleSessionAppend(token, sessionId, offset, chunkBuffer) {
  const resp = await fetch('https://content.dropboxapi.com/2/files/upload_session/append_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        cursor: { session_id: sessionId, offset },
        close: false,
      }),
    },
    body: chunkBuffer,
  });
  if (!resp.ok) throw new Error(`Session append failed (${resp.status}): ${await resp.text()}`);
}

async function handleSessionFinish(token, sessionId, offset, dropboxPath, chunkBuffer) {
  const resp = await fetch('https://content.dropboxapi.com/2/files/upload_session/finish', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        cursor: { session_id: sessionId, offset },
        commit: { path: dropboxPath, mode: 'overwrite', autorename: true, mute: false },
      }),
    },
    body: chunkBuffer,
  });
  if (!resp.ok) throw new Error(`Session finish failed (${resp.status}): ${await resp.text()}`);
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { action } = body;
    const token = await getAccessToken();

    switch (action) {
      case 'upload-small': {
        const buf = Buffer.from(body.chunk, 'base64');
        const result = await handleUploadSmall(token, body.dropboxPath, buf);
        return jsonResponse(200, result);
      }

      case 'session-start': {
        const buf = Buffer.from(body.chunk, 'base64');
        const { session_id } = await handleSessionStart(token, buf);
        return jsonResponse(200, { session_id });
      }

      case 'session-append': {
        const buf = Buffer.from(body.chunk, 'base64');
        await handleSessionAppend(token, body.sessionId, body.offset, buf);
        return jsonResponse(200, { ok: true });
      }

      case 'session-finish': {
        const buf = body.chunk ? Buffer.from(body.chunk, 'base64') : Buffer.alloc(0);
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
    console.error('dropbox-proxy error:', err);
    return jsonResponse(500, { error: err.message || 'Internal error' });
  }
};
