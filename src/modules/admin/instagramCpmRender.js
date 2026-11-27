// instagramCpmRender.js
// HTML der Admin-Seite Instagram-CPM (InstagramCpmPage.js): Formular, Range-Leiste mit
// Regel-Panel, Werkzeugleiste, Berechnung mit Rechenweg, Fehler-Items und Roh-JSON.
// Die Kacheln stehen in instagramCpmGrid.js.

import { escapeHtml } from '../../core/format.js';
import { DEFAULT_TKP } from '../creator-auswahl/castingPreisZellen.js';
import { FENSTER_KURZ, FENSTER_LANG, MIN_STICHPROBE, RANGE_BASIS } from '../../core/instagram/reelAuswahl.js';
import { zahl } from './medienablageFormat.js';
import { kompakt, kurzDatum } from './instagramCpmGrid.js';

const ANZAHL_STANDARD = 50;
const ANZAHL_MAX = 60;

const euro = (n) => (n == null ? '–'
  : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n));
const dezimal = (n, stellen = 2) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen }).format(n);

const REGEL_FELDER = [
  ['mindestFaktor', 'Mindestfaktor', 'Ausreißer frühestens ab Median × Faktor', '0.1'],
  ['tukeyK', 'Tukey-k', 'Streuung oberhalb Q3 auf der log-Skala', '0.1'],
  ['hoechstFaktor', 'Höchstfaktor', 'Ausreißer spätestens ab Median × Faktor', '0.1'],
  ['floorProzent', 'Floor in %', 'Flop unter diesem Anteil vom Median', '0.5'],
];

export function formHtml() {
  return `
    <form class="dq-list-card tt-form" data-ig-form data-no-submit-guard="true">
      <div class="dq-list-header">
        <h2 class="dq-list-title">Profil scrapen</h2>
        <p class="dq-list-hint">Apify · apify/instagram-reel-scraper · ohne angepinnte und Trial-Reels · nichts wird gespeichert</p>
      </div>
      <div class="tt-felder ig-felder">
        <div class="form-field">
          <label for="ig-profil">Instagram-Profil</label>
          <input id="ig-profil" class="form-input" data-ig-feld="profil" placeholder="@username oder instagram.com/username" autocomplete="off">
        </div>
        <div class="form-field">
          <label for="ig-anzahl">Reels abrufen</label>
          <input type="number" id="ig-anzahl" class="form-input" data-ig-feld="anzahl" min="12" max="${ANZAHL_MAX}" value="${ANZAHL_STANDARD}">
          <small class="form-hint">Mehr als 30, damit für abgewählte Reels ältere nachrücken.</small>
        </div>
        <div class="form-field">
          <label for="ig-tkp">TKP in Euro</label>
          <input type="number" id="ig-tkp" class="form-input" data-ig-feld="tkp" min="0" step="0.01" value="${DEFAULT_TKP}">
        </div>
      </div>
      <div class="tt-aktionen">
        <span></span>
        <button type="submit" class="mdc-btn mdc-btn--create" data-ig-start>
          <span class="mdc-btn__label">Scrapen</span>
        </button>
      </div>
    </form>
  `;
}

function regelPanelHtml(regeln) {
  return `
    <details class="ig-regeln">
      <summary>Regeln anpassen</summary>
      <div class="ig-regeln-felder">
        ${REGEL_FELDER.map(([key, label, hint, step]) => `
          <div class="form-field">
            <label for="ig-regel-${key}">${label}</label>
            <input type="number" id="ig-regel-${key}" class="form-input" data-ig-regel="${key}" min="0" step="${step}" value="${escapeHtml(String(regeln[key]))}">
            <small class="form-hint">${hint}</small>
          </div>
        `).join('')}
      </div>
      <div class="ig-regeln-aktionen">
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-ig-regeln-anwenden>Regeln anwenden</button>
        <small class="form-hint">Setzt die Auswahl auf den neuen Vorschlag zurück.</small>
      </div>
    </details>
  `;
}

/** Range-Leiste: was fuer diesen Creator normal ist und ab wann vorgeschlagen wird */
export function rangeHtml(range, regeln, { ausreisser = 0, flops = 0 } = {}) {
  const inhalt = range
    ? `
      <div class="ig-range-werte">
        <div><div class="ma-karte-label">Median</div><div class="ma-karte-wert" title="${escapeHtml(zahl(range.median))}">${escapeHtml(kompakt(range.median))}</div></div>
        <div><div class="ma-karte-label">Typische Range (Q1–Q3)</div><div class="ma-karte-wert">${escapeHtml(kompakt(range.q1))} – ${escapeHtml(kompakt(range.q3))}</div></div>
        <div><div class="ma-karte-label">Ausreißer über</div><div class="ma-karte-wert" title="${escapeHtml(zahl(range.oben))}">${escapeHtml(kompakt(range.oben))}</div></div>
        <div><div class="ma-karte-label">Flop unter</div><div class="ma-karte-wert" title="${escapeHtml(zahl(range.unten))}">${escapeHtml(kompakt(range.unten))}</div></div>
      </div>
      <p class="dq-list-hint">Basis: die ${range.n} neuesten Kandidaten (höchstens ${RANGE_BASIS}). Vorgeschlagen und abgewählt: ${ausreisser} Ausreißer nach oben, ${flops} Flops.</p>
    `
    : `<p class="dq-list-hint">Zu wenige Reels für eine Range (mindestens ${MIN_STICHPROBE}). Es wird nichts vorgeschlagen.</p>`;
  return `
    <div class="dq-list-card ig-range">
      <div class="dq-list-header"><h2 class="dq-list-title">Range des Creators</h2></div>
      <div class="ig-range-inhalt">${inhalt}${regelPanelHtml(regeln)}</div>
    </div>
  `;
}

/** Werkzeugleiste ueber dem Grid */
export function leisteHtml({ ausgewaehlt, kandidaten, imKurz, imLang }) {
  return `
    <div class="ig-leiste">
      <span class="dq-list-hint">${ausgewaehlt} von ${kandidaten} ausgewählt · 12er: ${imKurz}/${FENSTER_KURZ} · 30er: ${imLang}/${FENSTER_LANG} · Klick auf eine Kachel wählt sie an oder ab</span>
      <span class="ig-leiste-aktionen">
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-ig-zuruecksetzen>Vorschlag wiederherstellen</button>
        <button type="button" class="mdc-btn mdc-btn--create mdc-btn--sm" data-ig-berechnen>Berechnen</button>
      </span>
    </div>
  `;
}

/** "7.512.300 / 30 = 250.410 Views → 250,41 × 25 € = 6.260,25 €" */
export function rechenweg(a) {
  if (!a?.anzahl) return 'Keine Reels ausgewählt.';
  return `${zahl(a.summe)} / ${a.anzahl} = ${zahl(a.schnitt)} Views → ${dezimal(a.schnitt / 1000)} × ${euro(a.tkp)} = ${euro(a.preis)}`;
}

function auswertungHtml(titel, a) {
  const hinweis = a.anzahl && !a.vollstaendig
    ? `<p class="ig-hinweis">Nur ${a.anzahl} von ${a.ziel} Reels verfügbar.</p>` : '';
  return `
    <div class="dq-pruefung ig-auswertung" data-ig-auswertung="${a.ziel}">
      <div class="ma-karte-label">${titel}</div>
      <div class="ig-auswertung-preis">${escapeHtml(euro(a.preis))}</div>
      <div class="ig-auswertung-views">Ø ${escapeHtml(a.schnitt == null ? '–' : zahl(a.schnitt))} Views aus ${a.anzahl} Reels</div>
      <p class="ig-rechenweg" data-ig-rechenweg>${escapeHtml(rechenweg(a))}</p>
      ${hinweis}
      ${a.anzahl ? `
        <details class="ig-posten">
          <summary>Verwendete Reels</summary>
          <ol>${a.reels.map((r) => `<li><span>${escapeHtml(kurzDatum(r.datum))}</span><span>${escapeHtml(zahl(r.views))}</span></li>`).join('')}</ol>
        </details>` : ''}
    </div>
  `;
}

/** @param {{ kurz: object, lang: object }|null} berechnung */
export function berechnungHtml(berechnung, { veraltet = false } = {}) {
  if (!berechnung) {
    return '<div class="dq-list-card ig-berechnung"><p class="dq-list-hint ig-berechnung-leer">Auswahl prüfen und auf „Berechnen“ drücken.</p></div>';
  }
  return `
    <div class="dq-list-card ig-berechnung${veraltet ? ' is-veraltet' : ''}">
      <div class="dq-list-header">
        <h2 class="dq-list-title">Berechnung</h2>
        ${veraltet ? '<p class="ig-hinweis" data-ig-veraltet>Auswahl geändert, bitte neu berechnen.</p>' : ''}
      </div>
      <div class="ig-auswertungen">
        ${auswertungHtml(`${FENSTER_KURZ}er-Schnitt`, berechnung.kurz)}
        ${auswertungHtml(`${FENSTER_LANG}er-Schnitt`, berechnung.lang)}
      </div>
    </div>
  `;
}

export function fehlerHtml(fehler) {
  if (!fehler?.length) return '';
  return `
    <div class="dq-list-card">
      <div class="dq-list-header">
        <h2 class="dq-list-title">Nicht abrufbar</h2>
        <p class="dq-list-hint">Der Scraper hat für diese Eingabe ein Fehler-Item geliefert, z. B. privates oder unbekanntes Profil.</p>
      </div>
      <table class="dq-table"><tbody>
        ${fehler.map((f) => `
          <tr>
            <td><span class="dq-name">${escapeHtml(f.eingabe || '–')}</span></td>
            <td><span class="status-badge danger">${escapeHtml(f.code)}</span></td>
            <td class="ma-leise">${escapeHtml(f.text)}</td>
          </tr>`).join('')}
      </tbody></table>
    </div>
  `;
}

export function rohHtml(roh) {
  return `
    <details class="dq-list-card tt-roh">
      <summary class="dq-list-header">
        <span class="dq-list-title">Roh-JSON</span>
        <span class="dq-list-hint">${roh.length} Items, so wie Apify sie liefert</span>
      </summary>
      <div class="tt-roh-aktionen">
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-ig-kopieren>JSON kopieren</button>
      </div>
      <pre class="tt-roh-json">${escapeHtml(JSON.stringify(roh, null, 2))}</pre>
    </details>
  `;
}

export function profilKopfHtml(profil, { kandidaten, gefiltert }) {
  if (!profil) return '';
  const link = /^https:\/\//.test(profil.url || '')
    ? `<a class="dq-name" href="${escapeHtml(profil.url)}" target="_blank" rel="noopener noreferrer">@${escapeHtml(profil.name)}</a>`
    : `<span class="dq-name">@${escapeHtml(profil.name)}</span>`;
  return `
    <div class="ig-profil">
      ${link}${profil.vollName ? ` <span class="ma-leise">${escapeHtml(profil.vollName)}</span>` : ''}
      <span class="dq-list-hint">${kandidaten} Kandidaten · ${gefiltert} rausgefiltert</span>
    </div>
  `;
}
