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

const DEBUG = false;
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

async function sessionStart({ token, chunk, signal }) {
  const result = await xhrRequest({
    url: `${CONTENT_BASE}/upload_session/start`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': httpHeaderSafeJson({ close: false }),
    },
    body: chunk,
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

async function sessionFinish({ token, sessionId, offset, dropboxPath, chunk, signal }) {
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
    body: chunk,
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
    return uploadViaProxyFallback({ file, dropboxPath, token, signal, onProgress });
  }
}

/**
 * Parallele Session-Appends mit Worker-Pool.
 * Reihenfolge der Appends spielt für Dropbox keine Rolle, solange der Cursor-Offset stimmt.
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

  // Chunks vorberechnen (Offset + size + ob "letzter")
  const chunks = [];
  let off = 0;
  while (off < totalSize) {
    const end = Math.min(off + chunkSize, totalSize);
    chunks.push({ offset: off, size: end - off, isLast: end === totalSize });
    off = end;
  }

  // Session mit erstem Chunk starten (synchron — Session-ID brauchen wir)
  const firstSlice = file.slice(0, chunks[0].size);
  const sessionId = await withRetry(
    (t) => sessionStart({ token: t, chunk: firstSlice, signal }),
    { signal, getToken: refreshToken, currentToken }
  );
  dbg('session-start OK', { sessionId, firstChunk: chunks[0].size });

  // Progress-Tracking: pro Chunk loaded; finalisiert auf size beim Erfolg
  const chunkLoaded = new Array(chunks.length).fill(0);
  chunkLoaded[0] = chunks[0].size; // first chunk schon hochgeladen
  const reportProgress = () => {
    if (!onProgress) return;
    let sum = 0;
    for (const v of chunkLoaded) sum += v;
    onProgress({ loaded: Math.min(sum, totalSize), total: totalSize, phase: 'upload' });
  };
  reportProgress();

  // Letzter Chunk muss via session-finish gehen (kein parallel-finish nötig, läuft am Ende)
  const lastChunkIdx = chunks.length - 1;
  const appendIndices = [];
  for (let i = 1; i < chunks.length - 1; i++) appendIndices.push(i);
  // Bei nur 2 Chunks: keine appends, direkt finish
  // Bei 3+: 1..n-2 sind appends, n-1 ist finish

  let nextIdx = 0;
  const queue = appendIndices;

  async function worker() {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const myIdx = (() => {
        if (nextIdx >= queue.length) return -1;
        return queue[nextIdx++];
      })();
      if (myIdx < 0) return;

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

  // Worker-Pool starten
  const workerCount = Math.min(Math.max(1, concurrency), queue.length || 1);
  const workers = [];
  for (let i = 0; i < workerCount; i++) workers.push(worker());
  await Promise.all(workers);

  // Finish mit letztem Chunk (sequentiell nach allen Appends)
  if (chunks.length === 1) {
    // Sollte hier nicht ankommen (small file path), aber safety
    chunkLoaded[0] = chunks[0].size;
    reportProgress();
    return { path_display: dropboxPath };
  }

  const lastMeta = chunks[lastChunkIdx];
  const lastSlice = file.slice(lastMeta.offset, lastMeta.offset + lastMeta.size);
  const finishResult = await withRetry(async (t) => {
    const r = await sessionFinish({
      token: t,
      sessionId,
      offset: lastMeta.offset,
      dropboxPath,
      chunk: lastSlice,
      signal,
    });
    chunkLoaded[lastChunkIdx] = lastMeta.size;
    reportProgress();
    return r;
  }, { signal, getToken: refreshToken, currentToken });

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
