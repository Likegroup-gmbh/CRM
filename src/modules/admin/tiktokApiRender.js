// tiktokApiRender.js
// HTML der Admin-Seite TikTok-API (TikTokApiPage.js): Formular, Stand des Apify-Laufs,
// Profilkarten, Videotabelle, Fehler-Items und Roh-JSON. Cover und Avatare sind signierte
// TikTok-CDN-Links, die nach Stunden ablaufen; für die Testseite reicht das.

import { escapeHtml } from '../../core/format.js';
import { zahl, datumZeit } from './medienablageFormat.js';

const ANZAHL_STANDARD = 10;
const ANZAHL_MAX = 30;
const TEXT_MAX = 110;

const STATUS = {
  READY: ['Wartet', 'info'],
  RUNNING: ['Läuft', 'info'],
  SUCCEEDED: ['Fertig', 'success'],
  FAILED: ['Fehlgeschlagen', 'danger'],
  'TIMING-OUT': ['Zeit läuft ab', 'warning'],
  'TIMED-OUT': ['Zeit überschritten', 'danger'],
  ABORTING: ['Wird abgebrochen', 'warning'],
  ABORTED: ['Abgebrochen', 'inactive'],
};

const kompakt = (n) => (n == null ? '–'
  : new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(n));
const ganz = (n) => (n == null ? '–' : zahl(n));
const kurz = (text, max = TEXT_MAX) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
// Links und Bilder kommen aus gescrapten Daten: nur https, nie javascript: o. ä.
const https = (url) => (typeof url === 'string' && /^https:\/\//i.test(url) ? url : null);

/** 74 -> "1:14", ohne Wert "–" */
export function minSek(sekunden) {
  if (!Number.isFinite(sekunden) || sekunden < 0) return '–';
  const s = Math.round(sekunden);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Laufzeit in Sekunden: bis finishedAt oder, solange er läuft, bis jetzt. */
export function laufzeit(lauf, jetzt = Date.now()) {
  const start = Date.parse(lauf?.startedAt || '');
  if (!Number.isFinite(start)) return NaN;
  const ende = Date.parse(lauf?.finishedAt || '');
  return ((Number.isFinite(ende) ? ende : jetzt) - start) / 1000;
}

export function formHtml() {
  return `
    <form class="dq-list-card tt-form" data-tt-form data-no-submit-guard="true">
      <div class="dq-list-header">
        <h2 class="dq-list-title">Scraper starten</h2>
        <p class="dq-list-hint">Apify · clockworks/tiktok-scraper · Ergebnisse werden nur angezeigt, nicht gespeichert</p>
      </div>
      <div class="tt-felder">
        <div class="form-field">
          <label for="tt-videos">Video-Links</label>
          <textarea id="tt-videos" class="form-input" data-tt-feld="videos" rows="4" placeholder="https://www.tiktok.com/@name/video/7533731959172861206"></textarea>
          <small class="form-hint">Ein Link pro Zeile, höchstens 20. Kurzlinks (vm.tiktok.com) gehen auch.</small>
        </div>
        <div class="form-field">
          <label for="tt-profile">Profile</label>
          <textarea id="tt-profile" class="form-input" data-tt-feld="profile" rows="4" placeholder="@username"></textarea>
          <small class="form-hint">@name, name oder Profil-Link, ein Profil pro Zeile, höchstens 5.</small>
        </div>
      </div>
      <div class="tt-aktionen">
        <div class="form-field tt-anzahl">
          <label for="tt-anzahl">Videos pro Profil</label>
          <input type="number" id="tt-anzahl" class="form-input" data-tt-feld="anzahl" min="1" max="${ANZAHL_MAX}" value="${ANZAHL_STANDARD}">
        </div>
        <button type="submit" class="mdc-btn mdc-btn--create" data-tt-start>
          <span class="mdc-btn__label">Scrapen</span>
        </button>
      </div>
    </form>
  `;
}

function statusBadge(status) {
  const [label, ton] = STATUS[status] || [status || 'Unbekannt', 'info'];
  return `<span class="status-badge ${ton}">${escapeHtml(label)}</span>`;
}

/**
 * @param {object|null} lauf  laufAusRun aus der Function
 * @param {{ fehler?: string|null, laeuft?: boolean, jetzt?: number }} opts
 */
export function laufHtml(lauf, { fehler = null, laeuft = false, jetzt = Date.now() } = {}) {
  if (!lauf && !fehler) return '';
  const fehlerHtml = fehler ? `<p class="tt-fehler">${escapeHtml(fehler)}</p>` : '';
  if (!lauf) return `<div class="dq-list-card tt-lauf">${fehlerHtml}</div>`;

  const teile = [
    lauf.startedAt ? `Gestartet ${escapeHtml(datumZeit(lauf.startedAt))}` : null,
    `Laufzeit <span data-tt-laufzeit>${minSek(laufzeit(lauf, jetzt))}</span>`,
    lauf.usageTotalUsd != null ? `Kosten ${escapeHtml(zahl(lauf.usageTotalUsd, 4))} USD` : null,
    lauf.runId ? `Lauf ${escapeHtml(lauf.runId)}` : null,
  ].filter(Boolean);

  return `
    <div class="dq-list-card tt-lauf">
      <div class="dq-list-header ma-list-header">
        <div>
          <h2 class="dq-list-title">Lauf ${statusBadge(lauf.status)}</h2>
          <p class="dq-list-hint">${teile.join(' · ')}</p>
          ${lauf.statusText ? `<p class="dq-list-hint">${escapeHtml(lauf.statusText)}</p>` : ''}
        </div>
        <div class="ma-zeilen-aktionen">
          ${https(lauf.konsoleUrl) ? `<a class="mdc-btn mdc-btn--secondary mdc-btn--sm" href="${escapeHtml(lauf.konsoleUrl)}" target="_blank" rel="noopener noreferrer">In Apify öffnen</a>` : ''}
          ${laeuft && !lauf.fertig && lauf.status !== 'ABORTING' ? '<button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-tt-abbrechen>Abbrechen</button>' : ''}
        </div>
      </div>
      ${fehlerHtml}
    </div>
  `;
}

function bild(src, klasse) {
  return https(src)
    ? `<img class="${klasse}" src="${escapeHtml(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="${klasse} tt-bild-leer"></span>`;
}

function profilLink(p) {
  const name = `@${escapeHtml(p.name)}`;
  const url = https(p.url);
  return url ? `<a class="dq-name" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${name}</a>` : `<span class="dq-name">${name}</span>`;
}

function profilKarteHtml(p) {
  const zahlen = [['Follower', p.follower], ['Likes gesamt', p.likes], ['Videos', p.videos], ['Folgt', p.folgt]];
  return `
    <div class="dq-pruefung tt-profil">
      <div class="tt-profil-kopf">
        ${bild(p.avatar, 'tt-avatar')}
        <div class="tt-profil-name">
          ${profilLink(p)}
          ${p.verifiziert ? '<span class="status-badge info ma-badge">Verifiziert</span>' : ''}
          ${p.privat ? '<span class="status-badge inactive ma-badge">Privat</span>' : ''}
          ${p.nickName ? `<div class="ma-leise">${escapeHtml(p.nickName)}</div>` : ''}
        </div>
      </div>
      <div class="tt-profil-zahlen">
        ${zahlen.map(([label, wert]) => `
          <div title="${escapeHtml(ganz(wert))}">
            <div class="ma-karte-label">${label}</div>
            <div class="ma-karte-wert">${escapeHtml(kompakt(wert))}</div>
          </div>
        `).join('')}
      </div>
      ${p.bio ? `<div class="ma-karte-meta">${escapeHtml(p.bio)}</div>` : ''}
    </div>
  `;
}

function videoZeileHtml(v) {
  const badges = [
    v.werbung ? '<span class="status-badge warning ma-badge">Werbung</span>' : '',
    v.angepinnt ? '<span class="status-badge inactive ma-badge">Angepinnt</span>' : '',
  ].join('');
  return `
    <tr>
      <td>${bild(v.cover, 'tt-cover')}</td>
      <td class="tt-video">
        <span class="dq-name">@${escapeHtml(v.autor || '–')}</span>${badges}
        <div class="ma-leise" title="${escapeHtml(v.text)}">${escapeHtml(kurz(v.text) || 'Ohne Text')}</div>
      </td>
      <td class="tt-datum">${escapeHtml(datumZeit(v.datum) || '–')}</td>
      <td class="dq-num">${ganz(v.aufrufe)}</td>
      <td class="dq-num">${ganz(v.likes)}</td>
      <td class="dq-num">${ganz(v.kommentare)}</td>
      <td class="dq-num">${ganz(v.shares)}</td>
      <td class="dq-num">${ganz(v.gespeichert)}</td>
      <td class="dq-num">${minSek(v.dauer ?? NaN)}</td>
      <td>${https(v.url) ? `<a class="dq-link" href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer">Öffnen</a>` : ''}</td>
    </tr>
  `;
}

function videoTabelleHtml(videos) {
  if (!videos.length) return '<div class="dq-leer">Keine Videos im Ergebnis.</div>';
  return `
    <div class="dq-scroll-x">
      <table class="dq-table tt-table">
        <thead>
          <tr>
            <th></th>
            <th>Video</th>
            <th>Datum</th>
            <th class="dq-num">Aufrufe</th>
            <th class="dq-num">Likes</th>
            <th class="dq-num">Kommentare</th>
            <th class="dq-num">Shares</th>
            <th class="dq-num">Gespeichert</th>
            <th class="dq-num">Dauer</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${videos.map(videoZeileHtml).join('')}</tbody>
      </table>
    </div>
  `;
}

function fehlerListeHtml(fehler) {
  if (!fehler.length) return '';
  return `
    <div class="dq-list-card">
      <div class="dq-list-header">
        <h2 class="dq-list-title">Nicht abrufbar</h2>
        <p class="dq-list-hint">Der Scraper hat für diese Eingaben ein Fehler-Item geliefert.</p>
      </div>
      <table class="dq-table">
        <tbody>
          ${fehler.map(f => `
            <tr>
              <td><span class="dq-name">${escapeHtml(f.eingabe || f.url || '–')}</span></td>
              <td><span class="status-badge danger">${escapeHtml(f.code)}</span></td>
              <td class="ma-leise">${escapeHtml(f.text)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/** @param {{ videos: object[], profile: object[], fehler: object[], roh: object[] }|null} ergebnis */
export function ergebnisHtml(ergebnis) {
  if (!ergebnis) return '';
  const { videos = [], profile = [], fehler = [], roh = [] } = ergebnis;
  return `
    ${profile.length ? `<div class="dq-summary tt-profile">${profile.map(profilKarteHtml).join('')}</div>` : ''}
    <div class="dq-list-card">
      <div class="dq-list-header">
        <h2 class="dq-list-title">Videos</h2>
        <p class="dq-list-hint">${videos.length} Videos · ${profile.length} Profile · ${fehler.length} Fehler</p>
      </div>
      ${videoTabelleHtml(videos)}
    </div>
    ${fehlerListeHtml(fehler)}
    <details class="dq-list-card tt-roh">
      <summary class="dq-list-header">
        <span class="dq-list-title">Roh-JSON</span>
        <span class="dq-list-hint">${roh.length} Items, so wie Apify sie liefert</span>
      </summary>
      <div class="tt-roh-aktionen">
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-tt-kopieren>JSON kopieren</button>
      </div>
      <pre class="tt-roh-json">${escapeHtml(JSON.stringify(roh, null, 2))}</pre>
    </details>
  `;
}
