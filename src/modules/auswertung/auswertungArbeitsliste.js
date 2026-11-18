// auswertungArbeitsliste.js
// Arbeitsliste der Erfassen-Ansicht (Spec 7.2): je Post eine Zeile, je Einheit ohne Post eine
// Zeile „Fehlt“ (Paid-Linie: „Optional“). Sortiert Prüfen → Fehler → KI liest → Fehlt → Optional
// → Erfasst, bei gleichem Status in der Reihenfolge der Einheiten. Filter mit Zählern.

import { moveSegmentThumb, renderSegmentSwitch, setSegmentValue } from '../../core/components/SegmentSwitch.js';
import { icon } from '../../core/icons/IconSystem.js';
import { postsJeEinheit } from './auswertungKennzahlen.js';
import { PLATTFORMEN } from './auswertungKonfig.js';
import { dateiFormat, esc, exakt } from './auswertungFormat.js';
import { ART_ICON, postDatei } from './auswertungTabelle.js';

export const FILTER_ATTR = 'data-erfassen-filter';

export const STATUS = {
  pruefen: { label: 'Prüfen', rang: 0, filter: 'pruefen' },
  fehler: { label: 'Fehler', rang: 1, filter: 'pruefen' },
  liest: { label: 'KI liest …', rang: 2, filter: 'pruefen' },
  fehlt: { label: 'Fehlt', rang: 3, filter: 'fehlt' },
  optional: { label: 'Optional', rang: 4, filter: null },
  erfasst: { label: 'Erfasst', rang: 5, filter: 'erfasst' }
};

const FILTER = [['alle', 'Alle'], ['pruefen', 'Prüfen'], ['fehlt', 'Fehlt'], ['erfasst', 'Erfasst']];
export const FILTER_WERTE = FILTER.map(([wert]) => wert);

/** Ein laufender KI-Lauf geht vor; ein Fehler bleibt sichtbar, auch an einem bestätigten Post. */
export function postStatus(post) {
  if (post.kiStatus === 'laeuft') return 'liest';
  if (post.kiStatus === 'fehler') return 'fehler';
  return post.status === 'confirmed' ? 'erfasst' : 'pruefen';
}

/** @returns {Array<{ key: string, einheit: object, post: object|null, status: string }>} */
export function eintraegeAus(modell) {
  const jeEinheit = postsJeEinheit(modell?.posts);
  const out = [];
  (modell?.einheiten || []).forEach((einheit, i) => {
    const posts = jeEinheit.get(einheit.id) || [];
    if (!posts.length) {
      out.push({ key: `einheit:${einheit.id}`, einheit, post: null, status: einheit.erwartet === false ? 'optional' : 'fehlt', ordnung: i });
      return;
    }
    posts.forEach((post, j) => out.push({ key: `post:${post.id}`, einheit, post, status: postStatus(post), ordnung: i + j / 100 }));
  });
  return out.sort((a, b) => STATUS[a.status].rang - STATUS[b.status].rang || a.ordnung - b.ordnung);
}

export function zaehle(eintraege) {
  const zahlen = { alle: eintraege.length, pruefen: 0, fehlt: 0, erfasst: 0 };
  eintraege.forEach((e) => {
    const filter = STATUS[e.status].filter;
    if (filter) zahlen[filter] += 1;
  });
  return zahlen;
}

export function gefiltert(eintraege, filter) {
  if (!filter || filter === 'alle') return eintraege;
  return eintraege.filter(e => STATUS[e.status].filter === filter);
}

/**
 * Eintrag zum Ziel aus Tabelle oder Panel: der Post selbst, sonst die Einheit (ihr erster Post
 * oder ihre Zeile „Fehlt“). null, wenn das Ziel nicht in dieser Produktion liegt.
 */
export function eintragZumZiel(eintraege, ziel) {
  if (!ziel) return null;
  if (ziel.postId) {
    const treffer = eintraege.find(e => e.key === `post:${ziel.postId}`);
    if (treffer) return treffer;
  }
  if (ziel.einheitId) return eintraege.find(e => e.einheit.id === ziel.einheitId) || null;
  return null;
}

/** Nach dem Bestätigen: der nächste „Prüfen“, sonst der nächste „Fehlt“, nie der aktuelle. */
export function naechsterEintrag(eintraege, aktuellerKey) {
  const andere = eintraege.filter(e => e.key !== aktuellerKey);
  return andere.find(e => e.status === 'pruefen') || andere.find(e => e.status === 'fehlt') || null;
}

function statusChip(status) {
  const puls = status === 'liest' ? '<span class="erfassen-status__puls" aria-hidden="true"></span>' : '';
  return `<span class="erfassen-status erfassen-status--${status}">${puls}${esc(STATUS[status].label)}</span>`;
}

export { statusChip as renderStatusChip };

/** Zweite Zeile: Creator, Einheit (wenn es einen Titel gibt), Plattform, Format bei mehreren Dateien. */
export function eintragSub(einheit, post) {
  const wo = einheit.titel ? einheit.label : einheit.bezug ? `${einheit.label} zu ${einheit.bezug}` : '';
  return [einheit.creator?.name, wo, post ? PLATTFORMEN[post.plattform]?.kurz : '', post && dateiFormat(einheit, post.dateiId)]
    .filter(Boolean).join(' · ');
}

function zeile(eintrag, aktiv) {
  const { einheit, post, status } = eintrag;
  const datei = postDatei(einheit, post);
  const titel = einheit.titel || einheit.label;
  return `
    <li class="erfassen-zeile${aktiv ? ' is-aktiv' : ''}" role="option" aria-selected="${aktiv}" tabindex="${aktiv ? 0 : -1}"
        data-erfassen-eintrag="${esc(eintrag.key)}" data-flip-id="${esc(eintrag.key)}" data-status="${status}">
      <span class="auswertung-poster"${datei ? ` data-poster="${esc(datei.id)}"` : ''}>${icon(ART_ICON[einheit.art] || 'film', { size: 14 })}</span>
      <span class="erfassen-zeile__text">
        <span class="erfassen-zeile__titel" title="${esc(titel)}">${esc(titel)}</span>
        <span class="erfassen-zeile__sub">${esc(eintragSub(einheit, post))}</span>
      </span>
      ${statusChip(status)}
    </li>`;
}

const LEER = {
  alle: 'Noch keine Einheiten in dieser Produktion.',
  pruefen: 'Nichts zu prüfen.',
  fehlt: 'Kein Post fehlt.',
  erfasst: 'Noch nichts erfasst.'
};

export function renderZeilen(eintraege, { filter, auswahl }) {
  const sichtbar = gefiltert(eintraege, filter);
  if (!sichtbar.length) return `<li class="erfassen-liste__leer">${esc(LEER[filter] || LEER.alle)}</li>`;
  return sichtbar.map(e => zeile(e, e.key === auswahl)).join('');
}

const quote = (f) => (f.gesamt ? Math.round((f.bestaetigt / f.gesamt) * 100) : 0);
const filterLabel = (label, zahl) => `${label} ${exakt(zahl)}`;

/** Kopf und Zeilen. Den Kopf zieht `aktualisiereKopf` später nach, damit Balken und Thumb gleiten. */
export function renderArbeitsliste(eintraege, { filter, auswahl, fortschritt }) {
  const zahlen = zaehle(eintraege);
  return `
    <div class="erfassen-liste__kopf" data-erfassen-kopf>
      <p class="erfassen-liste__stand" data-erfassen-stand><strong>${esc(exakt(fortschritt.bestaetigt))}</strong> von ${esc(exakt(fortschritt.gesamt))} erfasst</p>
      <div class="summary-progress" role="progressbar" aria-label="Erfasst" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${quote(fortschritt)}">
        <div class="summary-progress-fill" data-erfassen-balken style="width:${quote(fortschritt)}%"></div>
      </div>
      ${renderSegmentSwitch({ id: 'filter', options: FILTER.map(([value, label]) => ({ value, label: filterLabel(label, zahlen[value]) })), value: filter, attr: FILTER_ATTR })}
    </div>
    <ul class="erfassen-liste__zeilen" role="listbox" aria-label="Posts der Produktion" data-erfassen-zeilen>
      ${renderZeilen(eintraege, { filter, auswahl })}
    </ul>`;
}

export function aktualisiereKopf(kopf, eintraege, { filter, fortschritt }) {
  if (!kopf) return;
  const zahlen = zaehle(eintraege);
  const stand = kopf.querySelector('[data-erfassen-stand]');
  if (stand) stand.innerHTML = `<strong>${esc(exakt(fortschritt.bestaetigt))}</strong> von ${esc(exakt(fortschritt.gesamt))} erfasst`;
  const balken = kopf.querySelector('[data-erfassen-balken]');
  if (balken) {
    balken.style.width = `${quote(fortschritt)}%`;
    balken.parentElement.setAttribute('aria-valuenow', String(quote(fortschritt)));
  }
  const gruppe = kopf.querySelector(`[${FILTER_ATTR}]`);
  FILTER.forEach(([value, label]) => {
    const opt = gruppe?.querySelector(`[${FILTER_ATTR}-opt][data-value="${value}"]`);
    if (opt) opt.textContent = filterLabel(label, zahlen[value]);
  });
  setSegmentValue(gruppe, filter, { attr: FILTER_ATTR });
  moveSegmentThumb(gruppe);
}
