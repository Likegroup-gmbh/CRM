// creator-upload.js — Oeffentliche Creator-Upload-Seite (Rohmaterial-Abgabe).
// Kein Supabase-Client, kein Anon-Key: nur die Token-API + TUS mit
// x-signature. Token kommt per URL-Hash (#t=...), nie per Query.
//
// Der Creator laedt sein Rohmaterial ab — kein Slot, keine Feedbackschleife.
// Geschnitten wird intern; Feedbackschleifen/Finale laufen ueber das CRM.
// Texte, Zustand, Token-API und Darstellung: creatorUploadSeite.js.

import * as tus from 'tus-js-client';
import { uploadToSession } from '../core/AblageUploader.js';
import {
  state, $, getTokenFromUrl, api, render, renderSessionList, updateProgressBar, setState,
} from './creatorUploadSeite.js';

// Muss mit SIZE_CAPS/EXT_BY_TYPE in netlify/functions/_shared/creator-upload.js laufen.
const SIZE_CAP = 10 * 1024 * 1024 * 1024;
const ACCEPT = 'video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,application/zip,.mp4,.mov,.avi,.mkv,.webm,.zip';
const ALLOWED_EXT = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'zip'];

// Mehr parallele TUS-Streams saettigen die Creator-Leitung und lassen jeden
// einzelnen Upload langsamer aussehen — der Rest wartet in der Queue.
const MAX_PARALLEL = 2;

let uploadSeq = 0;
let activeCount = 0;

function fileExt(name) {
  return (String(name || '').split('.').pop() || '').toLowerCase();
}

// ─── Upload ─────────────────────────────────────────────────

function pollStatus(jobId) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = async () => {
      attempts++;
      try {
        const res = await api('status', { jobId });
        if (res.status === 'done') return resolve(res);
        if (res.status === 'failed') return reject(new Error(res.error || 'failed'));
        if (attempts > 120) return reject(new Error('timeout'));
        setTimeout(tick, 2500);
      } catch (err) {
        if (err.status === 404) return reject(err);
        if (attempts > 120) return reject(err);
        setTimeout(tick, 2500);
      }
    };
    tick();
  });
}

function abortUpload(jobId) {
  if (!jobId) return;
  const body = JSON.stringify({ token: state.token, jobId });
  // sendBeacon ueberlebt pagehide; fetch nur als Fallback.
  if (navigator.sendBeacon && navigator.sendBeacon('/.netlify/functions/creator-upload-abort', new Blob([body], { type: 'application/json' }))) {
    return;
  }
  fetch('/.netlify/functions/creator-upload-abort', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

function isTooLargeError(err) {
  if (!err) return false;
  const status = err.status ?? err.originalResponse?.getStatus?.() ?? err.originalRequest?.status;
  if (status === 413) return true;
  const msg = String(err.message || err.originalResponse?.getBody?.() || '').toLowerCase();
  return msg.includes('entitytoolarge') || msg.includes('file size') || msg.includes('file-size') || msg.includes('too large') || msg.includes('payload too large');
}

function enqueue(koopId, files) {
  for (const file of files) {
    const entry = {
      id: `u${++uploadSeq}`,
      koopId,
      file,
      name: file.name,
      size: file.size,
      state: 'queued',
      progress: 0,
      errorCode: null,
      jobId: null,
    };
    if (!ALLOWED_EXT.includes(fileExt(file.name))) {
      entry.state = 'failed';
      entry.errorCode = 'bad_type';
    } else if (file.size > SIZE_CAP) {
      entry.state = 'failed';
      entry.errorCode = 'too_large';
    } else if (file.size <= 0) {
      entry.state = 'failed';
      entry.errorCode = 'empty';
    }
    state.uploads.push(entry);
  }
  renderSessionList(koopId);
  pumpQueue();
}

function pumpQueue() {
  while (activeCount < MAX_PARALLEL) {
    const next = state.uploads.find(u => u.state === 'queued');
    if (!next) return;
    activeCount++;
    runUpload(next).finally(() => {
      activeCount--;
      pumpQueue();
    });
  }
}

async function runUpload(entry) {
  entry.state = 'uploading';
  entry.progress = 0;
  entry.errorCode = null;
  renderSessionList(entry.koopId);

  const controller = new AbortController();
  const onPageHide = () => {
    controller.abort();
    abortUpload(entry.jobId);
  };
  window.addEventListener('pagehide', onPageHide);

  try {
    const startBody = {
      targetType: 'rohmaterial',
      targetId: entry.koopId,
      fileName: entry.file.name,
      fileSize: entry.file.size,
      contentType: entry.file.type || '',
    };
    const ziel = await api('start', startBody, 'ablage-creator-').catch((err) => {
      if (err.ohneFunction) return { ziel: 'dropbox' };
      throw err;
    });
    if (ziel.ziel === 'sharepoint') await uploadNachSharePoint(entry, ziel, controller.signal);
    else if (ziel.ziel === 'dropbox') await uploadPerTus(entry, await api('start', startBody));
    else throw new Error('Ablage-Ziel unbekannt');

    entry.state = 'done';
    entry.progress = 100;
    renderSessionList(entry.koopId);
  } catch (err) {
    console.error('Upload fehlgeschlagen:', err);
    abortUpload(entry.jobId);
    entry.jobId = null;
    // 404 der Upload-Session ist eine abgelaufene Sitzung, kein ungültiger Link
    if (err.status === 404 && err.name !== 'SessionError') {
      setState('error');
      return;
    }
    entry.state = 'failed';
    entry.errorCode = err.code || (isTooLargeError(err) ? 'too_large' : null);
    renderSessionList(entry.koopId);
  } finally {
    window.removeEventListener('pagehide', onPageHide);
  }
}

/** Bytes direkt in die SharePoint-Session; complete meldet die Datei dem Server. */
async function uploadNachSharePoint(entry, ziel, signal) {
  if (!ziel.jobId || !ziel.uploadUrl) throw new Error('Ablage-Ziel unvollständig');
  const item = await uploadToSession({
    file: entry.file,
    uploadUrl: ziel.uploadUrl,
    chunkBytes: ziel.chunkBytes,
    signal,
    onProgress: ({ loaded, total }) => {
      entry.progress = Math.round((loaded / total) * 100);
      updateProgressBar(entry);
    },
  });
  // deferCommit: alle Bytes da, die Datei schaltet erst complete frei (dann ohne item_id)
  if (!item?.id && !item?.deferred) throw new Error('SharePoint hat keine Datei zurückgegeben');

  entry.state = 'processing';
  renderSessionList(entry.koopId);
  await api('complete', { jobId: ziel.jobId, ...(item?.id ? { itemId: item.id } : {}) }, 'ablage-creator-');
}

async function uploadPerTus(entry, start) {
  entry.jobId = start.jobId;

  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(entry.file, {
      endpoint: start.uploadEndpoint,
      headers: { 'x-signature': start.uploadToken },
      metadata: {
        bucketName: start.bucket,
        objectName: start.stagingPath,
        contentType: start.contentType,
      },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      onProgress: (uploaded, total) => {
        entry.progress = Math.round((uploaded / total) * 100);
        updateProgressBar(entry);
      },
      onError: reject,
      onSuccess: resolve,
    });
    upload.start();
  });

  entry.state = 'processing';
  renderSessionList(entry.koopId);

  await api('complete', { jobId: entry.jobId });
  await pollStatus(entry.jobId);
  entry.jobId = null;
}

// ─── Events ─────────────────────────────────────────────────

function pickFiles(koopId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = ACCEPT;
  input.onchange = () => {
    if (input.files && input.files.length) enqueue(koopId, [...input.files]);
  };
  input.click();
}

function bindUploads() {
  const list = $('#koop-list');

  list.addEventListener('click', (e) => {
    const retry = e.target.closest('.cu-retry-btn');
    if (retry) {
      const row = retry.closest('[data-upload-id]');
      const entry = state.uploads.find(u => u.id === row?.dataset.uploadId);
      // Ein Typ-/Groessenfehler wird durch einen Retry nicht besser.
      if (entry && !['bad_type', 'too_large', 'empty'].includes(entry.errorCode)) {
        entry.state = 'queued';
        renderSessionList(entry.koopId);
        pumpQueue();
      }
      return;
    }
    const drop = e.target.closest('.cu-drop');
    if (drop) pickFiles(drop.dataset.koopId);
  });

  list.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const drop = e.target.closest('.cu-drop');
    if (!drop) return;
    e.preventDefault();
    pickFiles(drop.dataset.koopId);
  });

  // Drag & Drop pro Karte. dragover muss praeventiert werden, sonst oeffnet
  // der Browser die Datei statt sie an uns zu geben.
  list.addEventListener('dragover', (e) => {
    const drop = e.target.closest('.cu-drop');
    if (!drop) return;
    e.preventDefault();
    drop.classList.add('cu-drop--over');
  });

  list.addEventListener('dragleave', (e) => {
    const drop = e.target.closest('.cu-drop');
    if (drop) drop.classList.remove('cu-drop--over');
  });

  list.addEventListener('drop', (e) => {
    const drop = e.target.closest('.cu-drop');
    if (!drop) return;
    e.preventDefault();
    drop.classList.remove('cu-drop--over');
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) enqueue(drop.dataset.koopId, files);
  });

  // Ausserhalb der Drop-Zonen nichts uebernehmen, damit ein Fehlwurf nicht
  // die Seite durch die Datei ersetzt.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}

async function init() {
  state.token = getTokenFromUrl();
  if (!state.token) {
    setState('error');
    return;
  }

  $('#lang-toggle').addEventListener('click', () => {
    state.lang = state.lang === 'de' ? 'en' : 'de';
    if (state.pageData) render();
    document.documentElement.lang = state.lang;
  });

  try {
    state.pageData = await api('resolve', {});
    render();
    bindUploads();
    setState('content');
  } catch (err) {
    setState('error');
  }
}

init();
