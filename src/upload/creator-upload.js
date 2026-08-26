// creator-upload.js — Oeffentliche Creator-Upload-Seite.
// Kein Supabase-Client, kein Anon-Key: nur die Token-API + TUS mit
// x-signature. Token kommt per URL-Hash (#t=...), nie per Query.

import * as tus from 'tus-js-client';

const I18N = {
  de: {
    loading: 'Link wird überprüft…',
    errorTitle: 'Link ungültig',
    errorText: 'Dieser Link ist ungültig oder abgelaufen.',
    heroTitle: (name, kamp) => `Hallo ${name ? name + ', ' : ''}hier lädst du deine Inhalte hoch`,
    heroSub: (kamp, date) => `Kampagne: ${kamp} · Link gültig bis ${date}`,
    videos: 'Videos',
    storys: 'Storys',
    bilder: 'Bilder',
    video: 'Video',
    story: 'Story',
    upload: 'Hochladen',
    uploading: 'Wird hochgeladen…',
    processing: 'Wird verarbeitet…',
    done: (v) => `Hochgeladen${v ? ` (FS${v})` : ''}`,
    failed: 'Fehlgeschlagen — bitte erneut versuchen',
    fs: (n) => `FS${n}`,
    fsFree: (n) => `FS${n} frei`,
    bilderHint: (n) => n > 0 ? `${n} Bild${n !== 1 ? 'er' : ''} bereits hochgeladen` : 'Noch keine Bilder hochgeladen',
    footnote: 'Jede Abgabe wird als neue Version gespeichert. Du kannst nichts löschen oder überschreiben.',
    allFull: 'Alle Feedbackschleifen belegt',
    chooseFile: 'Datei auswählen',
    err_bad_type: 'Dieser Dateityp ist hier nicht erlaubt',
    err_too_large: 'Datei zu groß',
    err_empty: 'Datei ist leer',
    err_fs_full: 'Alle Feedbackschleifen sind bereits belegt',
    err_in_flight: 'Für dieses Ziel läuft bereits ein Upload',
    err_rate_limited: 'Zu viele Uploads. Bitte später erneut versuchen.',
  },
  en: {
    loading: 'Checking your link…',
    errorTitle: 'Invalid link',
    errorText: 'This link is invalid or has expired.',
    heroTitle: (name) => `Hi ${name ? name + ', ' : ''}upload your content here`,
    heroSub: (kamp, date) => `Campaign: ${kamp} · link valid until ${date}`,
    videos: 'Videos',
    storys: 'Stories',
    bilder: 'Images',
    video: 'Video',
    story: 'Story',
    upload: 'Upload',
    uploading: 'Uploading…',
    processing: 'Processing…',
    done: (v) => `Uploaded${v ? ` (FS${v})` : ''}`,
    failed: 'Failed — please try again',
    fs: (n) => `FS${n}`,
    fsFree: (n) => `FS${n} free`,
    bilderHint: (n) => n > 0 ? `${n} image${n !== 1 ? 's' : ''} uploaded` : 'No images uploaded yet',
    footnote: 'Every submission is stored as a new version. You cannot delete or overwrite anything.',
    allFull: 'All feedback rounds taken',
    chooseFile: 'Choose file',
    err_bad_type: 'This file type is not allowed here',
    err_too_large: 'File too large',
    err_empty: 'File is empty',
    err_fs_full: 'All feedback rounds are already taken',
    err_in_flight: 'An upload for this target is already running',
    err_rate_limited: 'Too many uploads. Please try again later.',
  },
};

const MAX_VERSIONS = 3;
// Muss mit SIZE_CAPS in netlify/functions/_shared/creator-upload.js laufen.
const SIZE_CAPS = {
  video: 2 * 1024 * 1024 * 1024,
  story: 500 * 1024 * 1024,
  bilder: 55 * 1024 * 1024,
};
const ACCEPT_BY_TYPE = {
  video: 'video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.avi,.mkv,.webm',
  story: 'video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.avi,.mkv,.webm',
  bilder: 'image/*,.heic,.heif',
};

let lang = 'de';
let token = null;
let pageData = null;

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

function fsBadges(filled) {
  const set = new Set(filled || []);
  let html = '<div class="cu-badges">';
  for (let v = 1; v <= MAX_VERSIONS; v++) {
    html += `<span class="cu-badge ${set.has(v) ? 'cu-badge--filled' : ''}">${esc(t('fs', v))}</span>`;
  }
  return html + '</div>';
}

function nextFreeFs(filled) {
  const set = new Set(filled || []);
  for (let v = 1; v <= MAX_VERSIONS; v++) {
    if (!set.has(v)) return v;
  }
  return null;
}

function slotRow({ targetType, targetId, title, sub, fs }) {
  const free = nextFreeFs(fs);
  return `
    <div class="cu-slot" data-target-type="${targetType}" data-target-id="${esc(targetId)}">
      <div class="cu-slot-info">
        <div class="cu-slot-name">${esc(title)}</div>
        ${sub ? `<div class="cu-slot-sub">${esc(sub)}</div>` : ''}
        ${fsBadges(fs)}
        <div class="cu-progress" style="display:none;"><div class="cu-progress-fill"></div></div>
        <div class="cu-status"></div>
      </div>
      <button type="button" class="cu-btn cu-upload-btn" ${free == null ? 'disabled' : ''}>
        ${esc(free == null ? t('allFull') : t('upload'))}
      </button>
    </div>`;
}

function renderKoop(koop) {
  const videoRows = koop.videos.map(v =>
    slotRow({
      targetType: 'video',
      targetId: v.id,
      title: `${t('video')} ${v.position}${v.thema ? ` — ${v.thema}` : ''}`,
      sub: v.titel || '',
      fs: v.fs,
    })
  ).join('');

  const storyRows = koop.videos.flatMap(v =>
    v.storys.map(s =>
      slotRow({
        targetType: 'story',
        targetId: s.id,
        title: `${t('story')} ${s.slotIndex}${s.slotName ? ` — ${s.slotName}` : ''}`,
        sub: `${t('video')} ${v.position}${v.thema ? ` — ${v.thema}` : ''}`,
        fs: s.fs,
      })
    )
  ).join('');

  const bilderRow = slotRow({
    targetType: 'bilder',
    targetId: koop.id,
    title: t('bilder'),
    sub: t('bilderHint', koop.bilderCount || 0),
    fs: [],
  }).replace('<div class="cu-badges">', '<div class="cu-badges" style="display:none;">');

  return `
    <div class="cu-card">
      <h3 class="cu-koop-name">${esc(koop.name)}</h3>
      <p class="cu-koop-sub">${esc(pageData.kampagne)}</p>
      ${videoRows ? `<div class="cu-section-title">${esc(t('videos'))}</div>${videoRows}` : ''}
      ${storyRows ? `<div class="cu-section-title">${esc(t('storys'))}</div>${storyRows}` : ''}
      <div class="cu-section-title">${esc(t('bilder'))}</div>${bilderRow}
    </div>`;
}

function render() {
  $('#hero-title').textContent = t('heroTitle', pageData.creatorVorname, pageData.kampagne);
  $('#hero-sub').textContent = t('heroSub', pageData.kampagne, formatDate(pageData.expiresAt));
  $('#koop-list').innerHTML = pageData.kooperationen.map(renderKoop).join('');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (I18N[lang][key]) el.textContent = t(key);
  });
  $('#lang-toggle').textContent = lang === 'de' ? 'EN' : 'DE';
}

function setState(state) {
  $('#state-loading').style.display = state === 'loading' ? '' : 'none';
  $('#state-error').style.display = state === 'error' ? '' : 'none';
  $('#state-content').style.display = state === 'content' ? '' : 'none';
}

// Nach Abschluss nur diesen Slot aktualisieren — ein Full-Re-Render wuerde
// laufende Uploads anderer Slots visuell abschiessen.
function updateSlotAfterDone(slotEl, versionNumber) {
  const targetType = slotEl.dataset.targetType;
  if (targetType === 'bilder') {
    const sub = slotEl.querySelector('.cu-slot-sub');
    if (sub) {
      const m = sub.textContent.match(/\d+/);
      const n = m ? parseInt(m[0], 10) + 1 : 1;
      sub.textContent = t('bilderHint', n);
    }
    return;
  }
  const badges = slotEl.querySelectorAll('.cu-badge');
  const idx = (versionNumber || 0) - 1;
  if (badges[idx]) badges[idx].classList.add('cu-badge--filled');
  const allFilled = [...badges].length > 0 && [...badges].every(b => b.classList.contains('cu-badge--filled'));
  if (allFilled) {
    const btn = slotEl.querySelector('.cu-upload-btn');
    btn.disabled = true;
    btn.textContent = t('allFull');
  }
}

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

async function handleUpload(slotEl, file) {
  const btn = slotEl.querySelector('.cu-upload-btn');
  const progress = slotEl.querySelector('.cu-progress');
  const fill = slotEl.querySelector('.cu-progress-fill');
  const status = slotEl.querySelector('.cu-status');
  const targetType = slotEl.dataset.targetType;
  const targetId = slotEl.dataset.targetId;

  btn.disabled = true;
  status.className = 'cu-status';
  status.textContent = '';
  progress.style.display = '';
  fill.style.width = '0%';

  if (file.size > SIZE_CAPS[targetType]) {
    status.className = 'cu-status cu-status--err';
    status.textContent = t('err_too_large');
    progress.style.display = 'none';
    btn.disabled = false;
    return;
  }

  let jobId = null;
  const onPageHide = () => abortUpload(jobId);
  window.addEventListener('pagehide', onPageHide);

  try {
    const start = await api('start', {
      targetType,
      targetId,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || '',
    });
    jobId = start.jobId;

    status.textContent = t('uploading');

    await new Promise((resolve, reject) => {
      const upload = new tus.Upload(file, {
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
          fill.style.width = `${Math.round((uploaded / total) * 100)}%`;
        },
        onError: reject,
        onSuccess: resolve,
      });
      upload.start();
    });

    status.textContent = t('processing');
    await api('complete', { jobId });
    const result = await pollStatus(jobId);
    jobId = null;

    status.className = 'cu-status cu-status--ok';
    status.textContent = t('done', result.versionNumber);
    progress.style.display = 'none';
    updateSlotAfterDone(slotEl, result.versionNumber);
  } catch (err) {
    console.error('Upload fehlgeschlagen:', err);
    abortUpload(jobId);
    jobId = null;
    if (err.status === 404) {
      setState('error');
      return;
    }
    status.className = 'cu-status cu-status--err';
    const code = err.code || (isTooLargeError(err) ? 'too_large' : null);
    status.textContent = (code && I18N[lang][`err_${code}`]) ? t(`err_${code}`) : t('failed');
    progress.style.display = 'none';
    btn.disabled = false;
  } finally {
    window.removeEventListener('pagehide', onPageHide);
  }
}

function bindUploads() {
  $('#koop-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.cu-upload-btn');
    if (!btn || btn.disabled) return;
    const slotEl = btn.closest('.cu-slot');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT_BY_TYPE[slotEl.dataset.targetType] || '*/*';
    input.onchange = () => {
      if (input.files && input.files[0]) handleUpload(slotEl, input.files[0]);
    };
    input.click();
  });
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
