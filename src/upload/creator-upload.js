// creator-upload.js — Oeffentliche Creator-Upload-Seite (Rohmaterial-Abgabe).
// Kein Supabase-Client, kein Anon-Key: nur die Token-API + TUS mit
// x-signature. Token kommt per URL-Hash (#t=...), nie per Query.
//
// Der Creator laedt sein Rohmaterial ab — kein Slot, keine Feedbackschleife.
// Geschnitten wird intern; Feedbackschleifen/Finale laufen ueber das CRM.

import * as tus from 'tus-js-client';

const I18N = {
  de: {
    loading: 'Link wird überprüft…',
    errorTitle: 'Link ungültig',
    errorText: 'Dieser Link ist ungültig oder abgelaufen.',
    heroTitle: (name) => `Hallo ${name ? name + ', ' : ''}hier lädst du dein Rohmaterial hoch`,
    heroSub: (kamp, date) => `Kampagne: ${kamp} · Link gültig bis ${date}`,
    rohmaterial: 'Rohmaterial',
    dropHint: 'Dateien hierher ziehen oder auswählen',
    dropSub: 'Video-Dateien (MP4, MOV, AVI, MKV, WEBM) oder ZIP · max. 10 GB pro Datei',
    chooseFiles: 'Dateien auswählen',
    uploaded: 'Bereits hochgeladen',
    nothingYet: 'Noch keine Dateien hochgeladen',
    queued: 'Warten…',
    uploading: 'Wird hochgeladen…',
    processing: 'Wird verarbeitet…',
    done: 'Hochgeladen',
    failed: 'Fehlgeschlagen — bitte erneut versuchen',
    retry: 'Erneut versuchen',
    footnote: 'Lade dein komplettes Rohmaterial hoch — den Schnitt übernehmen wir. Du kannst nichts löschen oder überschreiben.',
    err_bad_type: 'Dieser Dateityp ist hier nicht erlaubt',
    err_too_large: 'Datei zu groß',
    err_empty: 'Datei ist leer',
    err_rate_limited: 'Zu viele Uploads. Bitte später erneut versuchen.',
  },
  en: {
    loading: 'Checking your link…',
    errorTitle: 'Invalid link',
    errorText: 'This link is invalid or has expired.',
    heroTitle: (name) => `Hi ${name ? name + ', ' : ''}upload your raw footage here`,
    heroSub: (kamp, date) => `Campaign: ${kamp} · link valid until ${date}`,
    rohmaterial: 'Raw footage',
    dropHint: 'Drag files here or choose them',
    dropSub: 'Video files (MP4, MOV, AVI, MKV, WEBM) or ZIP · max. 10 GB per file',
    chooseFiles: 'Choose files',
    uploaded: 'Already uploaded',
    nothingYet: 'No files uploaded yet',
    queued: 'Waiting…',
    uploading: 'Uploading…',
    processing: 'Processing…',
    done: 'Uploaded',
    failed: 'Failed — please try again',
    retry: 'Try again',
    footnote: 'Upload all of your raw footage — we take care of the edit. You cannot delete or overwrite anything.',
    err_bad_type: 'This file type is not allowed here',
    err_too_large: 'File too large',
    err_empty: 'File is empty',
    err_rate_limited: 'Too many uploads. Please try again later.',
  },
};

// Muss mit SIZE_CAPS/EXT_BY_TYPE in netlify/functions/_shared/creator-upload.js laufen.
const SIZE_CAP = 10 * 1024 * 1024 * 1024;
const ACCEPT = 'video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,application/zip,.mp4,.mov,.avi,.mkv,.webm,.zip';
const ALLOWED_EXT = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'zip'];

// Mehr parallele TUS-Streams saettigen die Creator-Leitung und lassen jeden
// einzelnen Upload langsamer aussehen — der Rest wartet in der Queue.
const MAX_PARALLEL = 2;

let lang = 'de';
let token = null;
let pageData = null;

// Laufende/abgeschlossene Uploads dieser Sitzung, pro Kooperation.
// id ist clientseitig und stabil, damit ein Re-Render den Zustand nicht verliert.
let uploads = [];
let uploadSeq = 0;
let activeCount = 0;

const $ = (sel) => document.querySelector(sel);
const t = (key, ...args) => {
  const val = I18N[lang][key];
  return typeof val === 'function' ? val(...args) : val;
};

function getTokenFromUrl() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (hash.get('t')) return hash.get('t');
  // Fallback: ?token= aus aelteren Links -> sofort aus der URL entfernen
  const query = new URLSearchParams(window.location.search);
  const q = query.get('token');
  if (q) {
    history.replaceState(null, '', window.location.pathname);
    return q;
  }
  return null;
}

async function api(fn, body) {
  const resp = await fetch(`/.netlify/functions/creator-upload-${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...body }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.error || `Fehler (${resp.status})`);
    err.status = resp.status;
    err.code = data.code || null;
    throw err;
  }
  return data;
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${Math.round(n / 1024 / 1024)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function fileExt(name) {
  return (String(name || '').split('.').pop() || '').toLowerCase();
}

// ─── Render ─────────────────────────────────────────────────

function renderKoop(koop) {
  const existing = koop.rohmaterial || [];
  const existingHtml = existing.length > 0
    ? existing.map(f => `
        <div class="cu-file cu-file--done">
          <div class="cu-file-info">
            <div class="cu-file-name">${esc(f.name)}</div>
            <div class="cu-file-sub">${esc(formatSize(f.size))}</div>
          </div>
          <div class="cu-file-state cu-file-state--ok">${esc(t('done'))}</div>
        </div>`).join('')
    : `<p class="cu-note cu-note--empty">${esc(t('nothingYet'))}</p>`;

  return `
    <div class="cu-card" data-koop-id="${esc(koop.id)}">
      <h3 class="cu-koop-name">${esc(koop.name)}</h3>
      <p class="cu-koop-sub">${esc(pageData.kampagne)}</p>

      <div class="cu-drop" data-koop-id="${esc(koop.id)}" tabindex="0" role="button">
        <div class="cu-drop-hint">${esc(t('dropHint'))}</div>
        <div class="cu-drop-sub">${esc(t('dropSub'))}</div>
        <button type="button" class="cu-btn cu-choose-btn">${esc(t('chooseFiles'))}</button>
      </div>

      <div class="cu-file-list" id="cu-session-${esc(koop.id)}"></div>

      <div class="cu-section-title">${esc(t('uploaded'))}</div>
      <div class="cu-file-list">${existingHtml}</div>
    </div>`;
}

function render() {
  $('#hero-title').textContent = t('heroTitle', pageData.creatorVorname);
  $('#hero-sub').textContent = t('heroSub', pageData.kampagne, formatDate(pageData.expiresAt));
  $('#koop-list').innerHTML = pageData.kooperationen.map(renderKoop).join('');
  pageData.kooperationen.forEach(k => renderSessionList(k.id));
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (I18N[lang][key]) el.textContent = t(key);
  });
  $('#lang-toggle').textContent = lang === 'de' ? 'EN' : 'DE';
}

function stateLabel(u) {
  if (u.state === 'queued') return t('queued');
  if (u.state === 'uploading') return t('uploading');
  if (u.state === 'processing') return t('processing');
  if (u.state === 'done') return t('done');
  return (u.errorCode && I18N[lang][`err_${u.errorCode}`]) ? t(`err_${u.errorCode}`) : t('failed');
}

// Nur die Zeilen dieser Kooperation neu zeichnen — ein Full-Re-Render wuerde
// die Fortschrittsbalken der anderen Karten zuruecksetzen.
function renderSessionList(koopId) {
  const host = document.getElementById(`cu-session-${koopId}`);
  if (!host) return;
  const rows = uploads.filter(u => u.koopId === koopId);
  host.innerHTML = rows.map(u => {
    const stateClass = u.state === 'done' ? 'cu-file-state--ok'
      : u.state === 'failed' ? 'cu-file-state--err' : '';
    const showBar = u.state === 'uploading' || u.state === 'processing';
    return `
      <div class="cu-file" data-upload-id="${u.id}">
        <div class="cu-file-info">
          <div class="cu-file-name">${esc(u.name)}</div>
          <div class="cu-file-sub">${esc(formatSize(u.size))}</div>
          ${showBar ? `<div class="cu-progress"><div class="cu-progress-fill" style="width:${u.progress}%"></div></div>` : ''}
        </div>
        <div class="cu-file-state ${stateClass}">${esc(stateLabel(u))}</div>
        ${u.state === 'failed' ? `<button type="button" class="cu-btn cu-btn--ghost cu-retry-btn">${esc(t('retry'))}</button>` : ''}
      </div>`;
  }).join('');
}

// Fortschritt haeufig: nur den Balken anfassen, nicht die Zeile neu bauen.
function updateProgressBar(u) {
  const row = document.querySelector(`[data-upload-id="${u.id}"]`);
  const fill = row?.querySelector('.cu-progress-fill');
  if (fill) fill.style.width = `${u.progress}%`;
}

function setState(state) {
  $('#state-loading').style.display = state === 'loading' ? '' : 'none';
  $('#state-error').style.display = state === 'error' ? '' : 'none';
  $('#state-content').style.display = state === 'content' ? '' : 'none';
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
  const body = JSON.stringify({ token, jobId });
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
    uploads.push(entry);
  }
  renderSessionList(koopId);
  pumpQueue();
}

function pumpQueue() {
  while (activeCount < MAX_PARALLEL) {
    const next = uploads.find(u => u.state === 'queued');
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

  const onPageHide = () => abortUpload(entry.jobId);
  window.addEventListener('pagehide', onPageHide);

  try {
    const start = await api('start', {
      targetType: 'rohmaterial',
      targetId: entry.koopId,
      fileName: entry.file.name,
      fileSize: entry.file.size,
      contentType: entry.file.type || '',
    });
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

    entry.state = 'done';
    entry.progress = 100;
    renderSessionList(entry.koopId);
  } catch (err) {
    console.error('Upload fehlgeschlagen:', err);
    abortUpload(entry.jobId);
    entry.jobId = null;
    if (err.status === 404) {
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
      const entry = uploads.find(u => u.id === row?.dataset.uploadId);
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
  token = getTokenFromUrl();
  if (!token) {
    setState('error');
    return;
  }

  $('#lang-toggle').addEventListener('click', () => {
    lang = lang === 'de' ? 'en' : 'de';
    if (pageData) render();
    document.documentElement.lang = lang;
  });

  try {
    pageData = await api('resolve', {});
    render();
    bindUploads();
    setState('content');
  } catch (err) {
    setState('error');
  }
}

init();
