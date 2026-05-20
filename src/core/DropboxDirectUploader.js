// DropboxDirectUploader.js
// Direkter Binary-Upload via XHR ohne Netlify-Proxy-Hop.
// - 8 MB Chunks, parallel (concurrency=4), Retry mit Backoff, Abort, 401 Auto-Refresh
// - Fallback auf bestehenden Proxy-Pfad falls direct fehlschlägt (z.B. CORS-Block)

import { proxyPost, readFileAsBase64 } from './VideoUploadUtils.js';

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;
const DEFAULT_CONCURRENCY = 4;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [1000, 2000, 4000];

const CONTENT_BASE = 'https://content.dropboxapi.com/2/files';

const DEBUG = true; // Temporaer fuer Test-Phase, nach stabilem Betrieb zurueck auf false.
function dbg(...args) { if (DEBUG) console.log('[DirectUpload]', ...args); }

// Dropbox verlangt \uXXXX-Escaping für Non-ASCII im API-Arg Header
function httpHeaderSafeJson(obj) {
  return JSON.stringify(obj).replace(/[\u007f-\uffff]/g, (c) =>
    '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4)
  );
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }
  });
}

class HttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * Ein einzelner XHR-Request mit Progress-Callback, Abort und Timeout.
 * Liefert das geparste JSON oder wirft HttpError.
 */
function xhrRequest({ url, method = 'POST', headers = {}, body, signal, onProgress }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));

    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }

    if (onProgress && xhr.upload) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      });
    }

    const onAbort = () => xhr.abort();
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    xhr.onload = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      const status = xhr.status;
      const text = xhr.responseText || '';
      if (status >= 200 && status < 300) {
        try { resolve(text ? JSON.parse(text) : {}); }
        catch { resolve({}); }
      } else {
        reject(new HttpError(status, text));
      }
    };
    xhr.onerror = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error('Network error'));
    };
    xhr.onabort = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    xhr.ontimeout = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error('Timeout'));
    };

    xhr.send(body);
  });
}

function isRetryable(err) {
  if (err?.name === 'AbortError') return false;
  if (err instanceof HttpError) {
    return err.status >= 500 || err.status === 429 || err.status === 0;
  }
  return true;
}

function isAuthError(err) {
  return err instanceof HttpError && err.status === 401;
}

/**
 * Führt eine Operation mit Retry + 401-Auto-Refresh durch.
 */
async function withRetry(fn, { signal, getToken, currentToken }) {
  let attempt = 0;
  let token = currentToken;
  while (true) {
    try {
      return await fn(token);
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      if (isAuthError(err) && typeof getToken === 'function') {
        dbg('401 → Token refresh');
        token = await getToken({ forceRefresh: true });
        continue;
      }
      if (!isRetryable(err) || attempt >= MAX_RETRIES) throw err;
      const wait = RETRY_BACKOFF_MS[attempt] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
      dbg(`Retry ${attempt + 1}/${MAX_RETRIES} nach ${wait}ms (${err.message})`);
      await sleep(wait, signal);
      attempt++;
    }
  }
}

async function sessionStart({ token, signal }) {
  // Concurrent-Session: leerer Body, session_type 'concurrent' ist Pflicht
  // damit Dropbox parallele append_v2 erlaubt (default ist sequenziell).
  const result = await xhrRequest({
    url: `${CONTENT_BASE}/upload_session/start`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': httpHeaderSafeJson({ close: false, session_type: 'concurrent' }),
    },
    body: new Blob(),
    signal,
  });
  return result.session_id;
}

async function sessionAppend({ token, sessionId, offset, chunk, signal, onProgress }) {
  await xhrRequest({
    url: `${CONTENT_BASE}/upload_session/append_v2`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': httpHeaderSafeJson({
        cursor: { session_id: sessionId, offset },
        close: false,
      }),
    },
    body: chunk,
    signal,
    onProgress,
  });
}

async function sessionFinish({ token, sessionId, offset, dropboxPath, signal }) {
  // Concurrent-Session: finish ohne Body, Offset = totalSize.
  return xhrRequest({
    url: `${CONTENT_BASE}/upload_session/finish`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': httpHeaderSafeJson({
        cursor: { session_id: sessionId, offset },
        commit: { path: dropboxPath, mode: 'overwrite', autorename: true, mute: false },
      }),
    },
    body: new Blob(),
    signal,
  });
}

async function uploadSmallDirect({ token, dropboxPath, file, signal, onProgress, getToken }) {
  return withRetry(async (t) => {
    return xhrRequest({
      url: `${CONTENT_BASE}/upload`,
      headers: {
        'Authorization': `Bearer ${t}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': httpHeaderSafeJson({
          path: dropboxPath, mode: 'overwrite', autorename: true, mute: false,
        }),
      },
      body: file,
      signal,
      onProgress: onProgress ? (loaded, total) => onProgress({ loaded, total, phase: 'upload' }) : undefined,
    });
  }, { signal, getToken, currentToken: token });
}

/**
 * Haupt-Einstieg: lädt eine Datei direkt zu Dropbox hoch.
 *
 * @param {object} opts
 * @param {File|Blob} opts.file
 * @param {string} opts.dropboxPath
 * @param {string} opts.token - initialer Access Token
 * @param {function} [opts.getToken] - async ({ forceRefresh }) => string; für 401-Refresh
 * @param {number} [opts.chunkSize]
 * @param {number} [opts.concurrency]
 * @param {AbortSignal} [opts.signal]
 * @param {function} [opts.onProgress] - ({ loaded, total, phase }) => void
 * @param {boolean} [opts.allowProxyFallback=true] - bei direktem Fehler (CORS/Network) Proxy nutzen
 * @returns {Promise<object>} Dropbox finish-Response (path_display etc.)
 */
export async function uploadFileDirect({
  file,
  dropboxPath,
  token,
  getToken,
  chunkSize = DEFAULT_CHUNK_SIZE,
  concurrency = DEFAULT_CONCURRENCY,
  signal,
  onProgress,
  allowProxyFallback = true,
}) {
  if (!file) throw new Error('file fehlt');
  if (!dropboxPath) throw new Error('dropboxPath fehlt');
  if (!token) throw new Error('token fehlt');

  const totalSize = file.size;

  try {
    if (totalSize <= chunkSize) {
      const result = await uploadSmallDirect({ token, dropboxPath, file, signal, onProgress, getToken });
      onProgress?.({ loaded: totalSize, total: totalSize, phase: 'upload' });
      return result;
    }

    return await uploadSessionParallel({
      file, dropboxPath, token, getToken, chunkSize, concurrency, signal, onProgress, totalSize,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    if (!allowProxyFallback) throw err;

    console.warn('[DirectUpload] Direct fehlgeschlagen, Proxy-Fallback:', err.message);
    onProgress?.({ loaded: 0, total: totalSize, phase: 'proxy-fallback' });
    return uploadViaProxyFallback({ file, dropboxPath, token, signal, onProgress });
  }
}

/**
 * Concurrent-Session: leerer Start, alle Chunks parallel via append_v2, leerer Finish.
 * Dropbox erlaubt im concurrent-Mode beliebig viele parallele Appends auf dieselbe Session.
 */
async function uploadSessionParallel({
  file, dropboxPath, token, getToken, chunkSize, concurrency, signal, onProgress, totalSize,
}) {
  let currentToken = token;
  const refreshToken = async ({ forceRefresh } = {}) => {
    if (typeof getToken === 'function') {
      currentToken = await getToken({ forceRefresh });
      return currentToken;
    }
    return currentToken;
  };

  const chunks = [];
  let off = 0;
  while (off < totalSize) {
    const end = Math.min(off + chunkSize, totalSize);
    chunks.push({ offset: off, size: end - off });
    off = end;
  }

  const sessionId = await withRetry(
    (t) => sessionStart({ token: t, signal }),
    { signal, getToken: refreshToken, currentToken }
  );
  dbg('session-start OK (concurrent)', { sessionId, chunks: chunks.length });

  const chunkLoaded = new Array(chunks.length).fill(0);
  const reportProgress = () => {
    if (!onProgress) return;
    let sum = 0;
    for (const v of chunkLoaded) sum += v;
    onProgress({ loaded: Math.min(sum, totalSize), total: totalSize, phase: 'upload' });
  };

  let nextIdx = 0;
  async function worker() {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const myIdx = nextIdx++;
      if (myIdx >= chunks.length) return;

      const meta = chunks[myIdx];
      const slice = file.slice(meta.offset, meta.offset + meta.size);

      await withRetry(async (t) => {
        chunkLoaded[myIdx] = 0;
        await sessionAppend({
          token: t,
          sessionId,
          offset: meta.offset,
          chunk: slice,
          signal,
          onProgress: (loaded) => {
            chunkLoaded[myIdx] = Math.min(loaded, meta.size);
            reportProgress();
          },
        });
        chunkLoaded[myIdx] = meta.size;
        reportProgress();
      }, { signal, getToken: refreshToken, currentToken });
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), chunks.length);
  const workers = [];
  for (let i = 0; i < workerCount; i++) workers.push(worker());
  await Promise.all(workers);

  dbg('all appends OK, calling finish', { totalSize });
  const finishResult = await withRetry(
    (t) => sessionFinish({ token: t, sessionId, offset: totalSize, dropboxPath, signal }),
    { signal, getToken: refreshToken, currentToken }
  );

  return finishResult;
}

// ─── Proxy-Fallback (unverändert wie bisheriger Pfad) ───────────────────────

async function uploadViaProxyFallback({ file, dropboxPath, token, signal, onProgress }) {
  const SMALL = 2 * 1024 * 1024;
  const CHUNK = 2 * 1024 * 1024;
  const totalSize = file.size;

  if (totalSize <= SMALL) {
    const chunk = await readFileAsBase64(file);
    onProgress?.({ loaded: totalSize * 0.5, total: totalSize, phase: 'upload' });
    const result = await proxyPost({ action: 'upload-small', dropboxPath, chunk, token });
    onProgress?.({ loaded: totalSize, total: totalSize, phase: 'upload' });
    return result;
  }

  const readChunk = (start, end) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Chunk-Read fehlgeschlagen'));
    reader.readAsDataURL(file.slice(start, end));
  });

  const firstChunkB64 = await readChunk(0, CHUNK);
  const startResp = await proxyPost({ action: 'session-start', chunk: firstChunkB64, token });
  const sessionId = startResp.session_id;
  const sessionToken = startResp.token || token;
  let offset = CHUNK;
  onProgress?.({ loaded: offset, total: totalSize, phase: 'upload' });

  while (offset + CHUNK < totalSize) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const b64 = await readChunk(offset, offset + CHUNK);
    await proxyPost({ action: 'session-append', sessionId, offset, chunk: b64, token: sessionToken });
    offset += CHUNK;
    onProgress?.({ loaded: offset, total: totalSize, phase: 'upload' });
  }

  const lastB64 = await readChunk(offset, totalSize);
  const finishResult = await proxyPost({
    action: 'session-finish', sessionId, offset, dropboxPath, chunk: lastB64, token: sessionToken,
  });
  onProgress?.({ loaded: totalSize, total: totalSize, phase: 'upload' });
  return finishResult;
}
