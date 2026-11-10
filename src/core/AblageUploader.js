// AblageUploader.js
// Lädt eine Datei in eine SharePoint-Upload-Session (Microsoft Graph createUploadSession).
// Die Session-URL ist vorab signiert: kein Authorization-Header, sonst lehnt Graph ab.
// Stücke laufen nacheinander; Graph nimmt pro Session nur ein Stück gleichzeitig an.

const DEFAULT_CHUNK_BYTES = 32 * 320 * 1024;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [1000, 2000, 4000];
const MAX_RETRY_AFTER_MS = 60_000;

function abortError() {
  return new DOMException('Aborted', 'AbortError');
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

class SessionError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'SessionError';
    this.status = status;
  }
}

function retryAfterMs(resp, attempt) {
  const header = resp?.headers?.get?.('Retry-After');
  if (header) {
    const seconds = Number(header);
    const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
    if (ms > 0) return Math.min(ms, MAX_RETRY_AFTER_MS);
  }
  return RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
}

/** Erster Wert aus nextExpectedRanges ("start-" oder "start-end"), sonst null. */
function nextOffset(body) {
  const first = body?.nextExpectedRanges?.[0];
  if (typeof first !== 'string') return null;
  const start = parseInt(first.split('-')[0], 10);
  return Number.isFinite(start) ? start : null;
}

async function readJson(resp) {
  try { return await resp.json(); } catch { return null; }
}

function cancelSession(fetchImpl, uploadUrl) {
  Promise.resolve()
    .then(() => fetchImpl(uploadUrl, { method: 'DELETE', keepalive: true }))
    .catch(() => {});
}

/**
 * @param {object} opts
 * @param {File|Blob} opts.file
 * @param {string} opts.uploadUrl - Session-URL vom Server
 * @param {number} opts.chunkBytes - Vielfaches von 320 KiB
 * @param {AbortSignal} [opts.signal] - Abbruch löscht die Session (best effort)
 * @param {(p: { loaded: number, total: number, phase: 'upload' }) => void} [opts.onProgress]
 * @param {typeof fetch} [opts.fetchImpl]
 * @returns {Promise<object>} driveItem ({ id, name, size, eTag, cTag, ... }); bei deferCommit { deferred: true }
 */
export async function uploadToSession({ file, uploadUrl, chunkBytes, signal, onProgress, fetchImpl }) {
  if (!file) throw new Error('file fehlt');
  if (!uploadUrl) throw new Error('uploadUrl fehlt');
  const total = file.size;
  if (!total) throw new Error('Datei ist leer');
  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));
  const size = chunkBytes > 0 ? chunkBytes : DEFAULT_CHUNK_BYTES;

  let offset = 0;
  let attempt = 0;

  const report = (loaded) => onProgress?.({ loaded: Math.min(loaded, total), total, phase: 'upload' });

  try {
    while (true) {
      if (signal?.aborted) throw abortError();
      const end = Math.min(offset + size, total) - 1;

      let resp;
      try {
        resp = await doFetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Range': `bytes ${offset}-${end}/${total}` },
          body: file.slice(offset, end + 1),
          signal,
        });
      } catch (err) {
        if (err?.name === 'AbortError' || signal?.aborted) throw abortError();
        if (attempt >= MAX_RETRIES) throw err;
        await sleep(retryAfterMs(null, attempt), signal);
        attempt++;
        continue;
      }

      if (resp.status === 200 || resp.status === 201) {
        const item = await readJson(resp);
        report(total);
        return item;
      }

      if (resp.status === 202) {
        const body = await readJson(resp);
        const next = nextOffset(body);
        offset = next ?? end + 1;
        attempt = 0;
        report(offset);
        // deferCommit: alle Bytes da, die Datei schaltet erst der Server frei
        if (offset >= total) return { deferred: true, ...(body || {}) };
        continue;
      }

      if (resp.status === 404) {
        throw new SessionError(404, 'Upload-Sitzung abgelaufen, bitte erneut hochladen');
      }

      // Stück ist schon angekommen (Antwort ging verloren): Stand der Session abfragen
      if (resp.status === 416 && attempt < MAX_RETRIES) {
        attempt++;
        const status = await doFetch(uploadUrl, { method: 'GET', signal });
        if (status.status === 404) throw new SessionError(404, 'Upload-Sitzung abgelaufen, bitte erneut hochladen');
        const next = status.ok ? nextOffset(await readJson(status)) : null;
        if (next === null) throw new SessionError(416, 'Upload-Stand unbekannt');
        offset = next;
        continue;
      }

      if ((resp.status >= 500 || resp.status === 429) && attempt < MAX_RETRIES) {
        await sleep(retryAfterMs(resp, attempt), signal);
        attempt++;
        continue;
      }

      const body = await readJson(resp);
      throw new SessionError(resp.status, body?.error?.message || `Upload fehlgeschlagen (HTTP ${resp.status})`);
    }
  } catch (err) {
    if (err?.name === 'AbortError') cancelSession(doFetch, uploadUrl);
    throw err;
  }
}
