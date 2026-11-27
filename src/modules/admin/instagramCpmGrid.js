// instagramCpmGrid.js
// Kachel-Grid der Admin-Seite Instagram-CPM (InstagramCpmPage.js): ein Reel je Kachel mit
// Thumbnail, Views, Kommentaren, Likes, Datum und Badges. Die Kandidaten sind klickbar
// (an/ab), die vorgefilterten nur zur Ansicht. Thumbnails kommen ueber die Function
// instagram-bild (signierter Pfad aus dem Scraper-Ergebnis).

import { escapeHtml } from '../../core/format.js';
import { zahl } from './medienablageFormat.js';

export const kompakt = (n) => (n == null ? '–'
  : new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(n));
const ganz = (n) => (n == null ? '–' : zahl(n));
const https = (url) => (typeof url === 'string' && /^https:\/\//i.test(url) ? url : null);
// Der Bild-Pfad zeigt immer auf unsere eigene Function
const bildPfad = (pfad) => (typeof pfad === 'string' && pfad.startsWith('/.netlify/functions/instagram-bild?') ? pfad : null);

export function kurzDatum(iso) {
  const d = new Date(iso || '');
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const badge = (text, ton) => `<span class="status-badge ${ton} ig-badge">${escapeHtml(text)}</span>`;

function bildHtml(reel) {
  const src = bildPfad(reel.bild);
  return src
    ? `<img class="ig-kachel-img" src="${escapeHtml(src)}" alt="" loading="lazy">`
    : '<span class="ig-kachel-img ig-kachel-img--leer">Kein Bild</span>';
}

function zahlenHtml(reel) {
  const viewsTitel = reel.viewsAlt != null && reel.viewsAlt !== reel.views
    ? `${ganz(reel.views)} Aufrufe (Plays), ${ganz(reel.viewsAlt)} Video-Views`
    : `${ganz(reel.views)} Aufrufe`;
  return `
    <span class="ig-kachel-views" title="${escapeHtml(viewsTitel)}">${escapeHtml(kompakt(reel.views))}<small>Views</small></span>
    <span class="ig-kachel-meta">
      <span title="${escapeHtml(ganz(reel.kommentare))} Kommentare">${escapeHtml(kompakt(reel.kommentare))} Kommentare</span>
      <span title="${escapeHtml(ganz(reel.likes))} Likes">${escapeHtml(kompakt(reel.likes))} Likes</span>
    </span>
    <span class="ig-kachel-datum">${escapeHtml(kurzDatum(reel.datum))}</span>
  `;
}

function oeffnenLink(reel) {
  const url = https(reel.url);
  return url
    ? `<a class="ig-kachel-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" data-ig-link>Öffnen</a>`
    : '';
}

/**
 * Status-Badges eines Kandidaten.
 * @param {object} reel
 * @param {{ aus: boolean, imKurz: boolean, imLang: boolean, vorschlag?: 'hoch'|'flop' }} st
 */
export function kandidatBadges(reel, st) {
  const teile = [];
  if (st.imKurz) teile.push(badge('12er', 'success'));
  else if (st.imLang) teile.push(badge('30er', 'info'));
  else if (!st.aus) teile.push(badge('außerhalb', 'inactive'));
  if (st.vorschlag === 'hoch') teile.push(badge('Ausreißer ↑', 'danger'));
  if (st.vorschlag === 'flop') teile.push(badge('Flop ↓', 'warning'));
  if (st.aus && !st.vorschlag) teile.push(badge('Abgewählt', 'inactive'));
  if (reel.werbung) teile.push(badge('Anzeige ohne Verlinkung', 'warning'));
  return teile.join('');
}

/**
 * @param {object} reel
 * @param {number} nr Position im Grid, 1 = neuestes
 * @param {{ aus: boolean, imKurz: boolean, imLang: boolean, vorschlag?: 'hoch'|'flop' }} st
 */
export function kandidatKachelHtml(reel, nr, st) {
  const klassen = ['ig-kachel', st.aus ? 'is-aus' : '', st.imKurz ? 'is-kurz' : ''].filter(Boolean).join(' ');
  return `
    <div class="${klassen}" role="button" tabindex="0" aria-pressed="${st.aus ? 'false' : 'true'}"
      data-ig-reel="${escapeHtml(reel.id)}" title="${escapeHtml(reel.caption || 'Ohne Caption')}">
      <span class="ig-kachel-bild">
        ${bildHtml(reel)}
        <span class="ig-kachel-nr">#${nr}</span>
        <span class="ig-kachel-badges">${kandidatBadges(reel, st)}</span>
      </span>
      <span class="ig-kachel-info">
        ${zahlenHtml(reel)}
        ${oeffnenLink(reel)}
      </span>
    </div>
  `;
}

/**
 * @param {object[]} reels Kandidaten, neueste zuerst
 * @param {(reel: object) => object} status liefert den Kachel-Status je Reel
 */
export function gridHtml(reels, status) {
  if (!reels.length) return '<div class="dq-leer">Keine Reels nach dem Vorfilter.</div>';
  return `<div class="ig-grid" data-ig-grid>${reels.map((r, i) => kandidatKachelHtml(r, i + 1, status(r))).join('')}</div>`;
}

function gefiltertKachelHtml(reel) {
  const wer = reel.collab?.length ? reel.collab : reel.verlinkt || [];
  return `
    <div class="ig-kachel is-gefiltert" title="${escapeHtml(reel.caption || 'Ohne Caption')}">
      <span class="ig-kachel-bild">
        ${bildHtml(reel)}
        <span class="ig-kachel-badges">${badge(reel.filterText || reel.filter || 'Gefiltert', 'danger')}</span>
      </span>
      <span class="ig-kachel-info">
        ${zahlenHtml(reel)}
        ${wer.length ? `<span class="ig-kachel-wer">${wer.slice(0, 3).map((n) => `@${escapeHtml(n)}`).join(' ')}</span>` : ''}
        ${reel.werbung ? `<span class="ig-kachel-wer">Marker: ${escapeHtml(reel.werbung)}</span>` : ''}
        ${oeffnenLink(reel)}
      </span>
    </div>
  `;
}

export function gefiltertHtml(gefiltert) {
  if (!gefiltert.length) return '';
  return `
    <details class="dq-list-card ig-gefiltert">
      <summary class="dq-list-header">
        <span class="dq-list-title">Rausgefiltert (${gefiltert.length})</span>
        <span class="dq-list-hint">Zählen nie mit: Werbung mit Verlinkung, Collabs, angepinnte Reels</span>
      </summary>
      <div class="ig-grid ig-grid--klein">${gefiltert.map(gefiltertKachelHtml).join('')}</div>
    </details>
  `;
}
