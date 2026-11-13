// creatorUploadSeite.js — Texte, Zustand, Token-API und Darstellung der
// oeffentlichen Creator-Upload-Seite. Der Upload-Ablauf und die Events
// liegen in creator-upload.js.

const I18N = {
  de: {
    loading: 'Link wird überprüft…',
    errorTitle: 'Link ungültig',
    errorText: 'Dieser Link ist ungültig oder abgelaufen.',
    heroTitle: (name) => `Hallo ${name ? name + ', ' : ''}hier lädst du dein Rohmaterial hoch`,
    heroSub: (kamp, date) => `Kampagne: ${kamp} · Link gültig bis ${date}`,
    rohmaterial: 'Rohmaterial',
    dropHint: 'Dateien hierher ziehen oder auswählen',
    dropSub: 'Videos (MP4, MOV, AVI, MKV, WEBM), Bilder (JPG, PNG, HEIC …) oder ZIP · max. 10 GB pro Datei',
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
    dropSub: 'Videos (MP4, MOV, AVI, MKV, WEBM), images (JPG, PNG, HEIC …) or ZIP · max. 10 GB per file',
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

// Laufende/abgeschlossene Uploads dieser Sitzung, pro Kooperation.
// id ist clientseitig und stabil, damit ein Re-Render den Zustand nicht verliert.
export const state = {
  lang: 'de',
  token: null,
  pageData: null,
  uploads: [],
};

export const $ = (sel) => document.querySelector(sel);
const t = (key, ...args) => {
  const val = I18N[state.lang][key];
  return typeof val === 'function' ? val(...args) : val;
};

export function getTokenFromUrl() {
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

export async function api(fn, body, prefix = 'creator-upload-') {
  const resp = await fetch(`/.netlify/functions/${prefix}${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: state.token, ...body }),
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const err = new Error(data?.error || `Fehler (${resp.status})`);
    err.status = resp.status;
    err.code = data?.code || null;
    // Netlify-404 ohne JSON: die Function gibt es (noch) nicht
    err.ohneFunction = resp.status === 404 && !data;
    throw err;
  }
  return data || {};
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(state.lang === 'en' ? 'en-GB' : 'de-DE', {
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
      <p class="cu-koop-sub">${esc(state.pageData.kampagne)}</p>

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

export function render() {
  const { pageData, lang } = state;
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
  return (u.errorCode && I18N[state.lang][`err_${u.errorCode}`]) ? t(`err_${u.errorCode}`) : t('failed');
}

// Nur die Zeilen dieser Kooperation neu zeichnen — ein Full-Re-Render wuerde
// die Fortschrittsbalken der anderen Karten zuruecksetzen.
export function renderSessionList(koopId) {
  const host = document.getElementById(`cu-session-${koopId}`);
  if (!host) return;
  const rows = state.uploads.filter(u => u.koopId === koopId);
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
export function updateProgressBar(u) {
  const row = document.querySelector(`[data-upload-id="${u.id}"]`);
  const fill = row?.querySelector('.cu-progress-fill');
  if (fill) fill.style.width = `${u.progress}%`;
}

export function setState(name) {
  $('#state-loading').style.display = name === 'loading' ? '' : 'none';
  $('#state-error').style.display = name === 'error' ? '' : 'none';
  $('#state-content').style.display = name === 'content' ? '' : 'none';
}
