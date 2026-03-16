const Busboy = require('busboy');

const DROPBOX_UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';
const DROPBOX_UPLOAD_SESSION_START = 'https://content.dropboxapi.com/2/files/upload_session/start';
const DROPBOX_UPLOAD_SESSION_APPEND = 'https://content.dropboxapi.com/2/files/upload_session/append_v2';
const DROPBOX_UPLOAD_SESSION_FINISH = 'https://content.dropboxapi.com/2/files/upload_session/finish';
const DROPBOX_SHARED_LINK_URL = 'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';

const CHUNK_SIZE = 100 * 1024 * 1024; // 100 MB per chunk
const MAX_SINGLE_UPLOAD = 150 * 1024 * 1024; // 150 MB – Dropbox single upload limit

function sanitizePath(str) {
  if (!str) return '';
  return str
    .replace(/[<>:"|?*\\]/g, '_')
    .replace(/\/{2,}/g, '/')
    .trim();
}

async function getAccessToken() {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;

  if (!refreshToken || !appKey || !appSecret) {
    throw new Error('Dropbox credentials not configured (DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET)');
  }

  const resp = await fetch(DROPBOX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Dropbox token refresh failed: ${resp.status} – ${text}`);
  }

  const data = await resp.json();
  return data.access_token;
}

function buildDropboxPath({ unternehmen, marke, kampagne, kooperation, videoTitel, versionNumber }) {
  const parts = ['/Videos'];
  if (unternehmen) parts.push(sanitizePath(unternehmen));
  if (marke) parts.push(sanitizePath(marke));
  if (kampagne) parts.push(sanitizePath(kampagne));
  if (kooperation) parts.push(sanitizePath(kooperation));

  const ext = 'mp4';
  const filename = `V${versionNumber || 1}_${sanitizePath(videoTitel || 'Video')}.${ext}`;
  parts.push(filename);

  return parts.join('/');
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let fileBuffer = null;
    let fileName = '';

    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    const busboy = Busboy({ headers: { 'content-type': contentType } });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    const chunks = [];
    busboy.on('file', (_fieldname, stream, info) => {
      fileName = info.filename || 'video.mp4';
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on('finish', () => {
      resolve({ fields, fileBuffer, fileName });
    });

    busboy.on('error', reject);

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'utf-8');

    busboy.end(body);
  });
}

async function uploadSmallFile(token, dropboxPath, fileBuffer) {
  const resp = await fetch(DROPBOX_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({
        path: dropboxPath,
        mode: 'overwrite',
        autorename: true,
        mute: false,
      }),
      'Content-Type': 'application/octet-stream',
    },
    body: fileBuffer,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Dropbox upload failed: ${resp.status} – ${text}`);
  }

  return resp.json();
}

async function uploadLargeFile(token, dropboxPath, fileBuffer) {
  // Start session
  const startResp = await fetch(DROPBOX_UPLOAD_SESSION_START, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ close: false }),
      'Content-Type': 'application/octet-stream',
    },
    body: fileBuffer.subarray(0, CHUNK_SIZE),
  });

  if (!startResp.ok) {
    const text = await startResp.text();
    throw new Error(`Dropbox upload session start failed: ${startResp.status} – ${text}`);
  }

  const { session_id } = await startResp.json();
  let offset = CHUNK_SIZE;

  // Append remaining chunks
  while (offset < fileBuffer.length - CHUNK_SIZE) {
    const chunk = fileBuffer.subarray(offset, offset + CHUNK_SIZE);
    const appendResp = await fetch(DROPBOX_UPLOAD_SESSION_APPEND, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({
          cursor: { session_id, offset },
          close: false,
        }),
        'Content-Type': 'application/octet-stream',
      },
      body: chunk,
    });

    if (!appendResp.ok) {
      const text = await appendResp.text();
      throw new Error(`Dropbox upload session append failed: ${appendResp.status} – ${text}`);
    }

    offset += chunk.length;
  }

  // Finish with last chunk
  const lastChunk = fileBuffer.subarray(offset);
  const finishResp = await fetch(DROPBOX_UPLOAD_SESSION_FINISH, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({
        cursor: { session_id, offset },
        commit: {
          path: dropboxPath,
          mode: 'overwrite',
          autorename: true,
          mute: false,
        },
      }),
      'Content-Type': 'application/octet-stream',
    },
    body: lastChunk,
  });

  if (!finishResp.ok) {
    const text = await finishResp.text();
    throw new Error(`Dropbox upload session finish failed: ${finishResp.status} – ${text}`);
  }

  return finishResp.json();
}

async function createSharedLink(token, dropboxPath) {
  const resp = await fetch(DROPBOX_SHARED_LINK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: dropboxPath,
      settings: {
        requested_visibility: 'public',
        audience: 'public',
        access: 'viewer',
      },
    }),
  });

  if (resp.ok) {
    const data = await resp.json();
    return data.url.replace('?dl=0', '?raw=1');
  }

  // 409 = link already exists – fetch existing
  if (resp.status === 409) {
    const listResp = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: dropboxPath, direct_only: true }),
    });

    if (listResp.ok) {
      const listData = await listResp.json();
      if (listData.links?.length > 0) {
        return listData.links[0].url.replace('?dl=0', '?raw=1');
      }
    }
  }

  return null;
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
    const { fields, fileBuffer, fileName } = await parseMultipart(event);

    if (!fileBuffer || fileBuffer.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No file provided' }) };
    }

    const token = await getAccessToken();

    const dropboxPath = buildDropboxPath({
      unternehmen: fields.unternehmen,
      marke: fields.marke,
      kampagne: fields.kampagne,
      kooperation: fields.kooperation,
      videoTitel: fields.videoTitel,
      versionNumber: fields.versionNumber,
    });

    console.log(`Uploading ${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB → ${dropboxPath}`);

    let result;
    if (fileBuffer.length <= MAX_SINGLE_UPLOAD) {
      result = await uploadSmallFile(token, dropboxPath, fileBuffer);
    } else {
      result = await uploadLargeFile(token, dropboxPath, fileBuffer);
    }

    const sharedLink = await createSharedLink(token, result.path_display || dropboxPath);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: result.path_display || dropboxPath,
        shared_link: sharedLink,
        size: result.size,
        name: result.name,
      }),
    };
  } catch (err) {
    console.error('Dropbox upload error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Upload failed' }),
    };
  }
};
