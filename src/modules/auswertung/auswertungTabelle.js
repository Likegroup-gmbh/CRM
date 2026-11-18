// auswertungTabelle.js
// Post-Tabelle des Reports (Spec 5.4): bestätigte Posts sortierbar, Rang der Top 3 unabhängig von der
// Sortierung, Poster der geposteten Datei. Für das Team stehen danach alle Einheiten ohne bestätigte
// Auswertung, ein Entwurf mit seinem Link und den schon gelesenen Zahlen. Eine bestätigte Zeile öffnet
// per Klick oder Enter das Detail-Panel, eine offene Erfassen.

import { renderSortHeaderCell } from '../../core/list/sortableHeader.js';
import { renderTableIdentity } from '../../core/format/tableIdentity.js';
import { icon } from '../../core/icons/IconSystem.js';
import { getPoster } from '../../core/media/PosterCache.js';
import { bestaetigtePosts, engagementRate, interaktionen, messTage } from './auswertungKennzahlen.js';
import { LEER, dateiFormat, datum, esc, exakt, plattformLabel, plural, prozent } from './auswertungFormat.js';

export const STANDARD_SORT = { field: 'aufrufe', ascending: false };

const SPALTEN = [
  { label: '#', className: 'auswertung-tabelle__rang' },
  { label: 'Post' },
  { label: 'Plattform' },
  { label: 'Gepostet', field: 'gepostet' },
  { label: 'Live-Link' },
  { label: 'Aufrufe', field: 'aufrufe', className: 'auswertung-zahl' },
  { label: 'Likes', field: 'likes', className: 'auswertung-zahl' },
  { label: 'Kommentare', field: 'comments', className: 'auswertung-zahl' },
  { label: 'Betrachter', field: 'reach', className: 'auswertung-zahl' },
  { label: 'Interaktionen', field: 'interaktionen', className: 'auswertung-zahl' },
  { label: 'Engagement-Rate', field: 'engagement', className: 'auswertung-zahl' }
];

export const ART_ICON = { video: 'film', story: 'video', still: 'photo' };

const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function sortWert(post, field) {
  if (field === 'gepostet') return post.postedAt ? Date.parse(post.postedAt) : null;
  if (field === 'reach') return post.metrics?.reach ?? null;
  if (field === 'likes') return zahl(post.metrics?.likes);
  if (field === 'comments') return zahl(post.metrics?.comments);
  if (field === 'interaktionen') return interaktionen(post);
  if (field === 'engagement') return engagementRate([post]);
  return post.metrics?.views ?? null;
}

function linkAnzeige(url) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function statZellen(post, { voll }) {
  const url = post?.link || '';
  const linkTd = url
    ? `<td><a href="${esc(url)}" target="_blank" rel="noopener" class="table-link" title="${esc(url)}">${esc(linkAnzeige(url))}</a></td>`
    : `<td>${LEER}</td>`;
  const zahlTd = (key) => `<td class="auswertung-zahl">${esc(exakt(zahl(post?.metrics?.[key])))}</td>`;
  const rest = voll
    ? `<td class="auswertung-zahl">${esc(exakt(post?.metrics?.reach))}</td>
      <td class="auswertung-zahl">${esc(exakt(interaktionen(post)))}</td>
      <td class="auswertung-zahl">${esc(prozent(engagementRate([post])))}</td>`
    : `<td class="auswertung-zahl">${LEER}</td>`.repeat(3);
  return `${linkTd}${zahlTd('views')}${zahlTd('likes')}${zahlTd('comments')}${rest}`;
}

/** Bestätigte Posts nach `sort`, Posts ohne Wert immer am Ende. */
export function sortiertePosts(posts, sort = STANDARD_SORT) {
  const richtung = sort.ascending ? 1 : -1;
  return bestaetigtePosts(posts).slice().sort((a, b) => {
    const va = sortWert(a, sort.field);
    const vb = sortWert(b, sort.field);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va - vb) * richtung;
  });
}

/** Rang nach Aufrufen für alle bestätigten Posts mit Aufrufen. */
function raenge(posts) {
  return new Map(sortiertePosts(posts, STANDARD_SORT)
    .filter(p => p.metrics?.views != null)
    .map((p, i) => [p.id, i + 1]));
}

export function postDatei(einheit, post) {
  const dateien = einheit?.dateien || [];
  return dateien.find(d => d.id === post?.dateiId) || dateien[0] || null;
}

function poster(einheit, datei) {
  const key = datei ? ` data-poster="${esc(datei.id)}"` : '';
  return `<span class="auswertung-poster"${key}>${icon(ART_ICON[einheit?.art] || 'film', { size: 16 })}</span>`;
}

function videoZelle(einheit, post, { kampagne }) {
  const datei = postDatei(einheit, post);
  const titel = einheit?.titel || einheit?.label || 'Ohne Titel';
  const wo = einheit?.titel ? einheit.label : einheit?.bezug && `zu ${einheit.bezug}`;
  const sub = [einheit?.creator?.name, wo, post && dateiFormat(einheit, post.dateiId), kampagne ? einheit?.produktion?.name : '']
    .filter(Boolean).join(' · ');
  return renderTableIdentity({
    avatarHtml: poster(einheit, datei),
    nameHtml: `<span class="auswertung-tabelle__titel" title="${esc(titel)}">${esc(titel)}</span>`,
    subHtml: `<span class="auswertung-tabelle__sub">${esc(sub)}</span>`
  });
}

function postZeile(post, einheit, rang, { kampagne, top }) {
  const tage = messTage(post);
  const rangHtml = rang
    ? `<span class="auswertung-rang${top.has(post.id) ? ' auswertung-rang--top' : ''}">${rang}</span>`
    : LEER;
  return `
    <tr class="auswertung-zeile" tabindex="0" data-post-id="${esc(post.id)}" data-flip-id="${esc(post.id)}" aria-label="${esc(`${einheit?.label || 'Post'} öffnen`)}">
      <td class="auswertung-tabelle__rang">${rangHtml}</td>
      <td>${videoZelle(einheit, post, { kampagne })}</td>
      <td>${plattformLabel(post.plattform)}</td>
      <td>
        <div>${esc(datum(post.postedAt))}</div>
        ${tage != null ? `<div class="auswertung-tabelle__sub">gemessen nach ${esc(plural(tage, 'Tag', 'Tagen'))}</div>` : ''}
      </td>
      ${statZellen(post, { voll: true })}
    </tr>`;
}

const istGeplant = (iso, heute) => Boolean(iso) && Date.parse(iso) > heute;

/** Unterzeile unter dem Datum einer offenen Zeile: woran es noch hängt. */
export function offenHinweis({ einheit, post, status }, heute = Date.now()) {
  if (status === 'pruefen') return 'Zahlen prüfen';
  if (status === 'optional') return 'Paid, kein Post erwartet';
  if (!einheit?.dateien?.length) return 'Noch keine Finale Version';
  const gepostet = post?.postedAt || einheit.gepostetAm;
  if (istGeplant(gepostet, heute)) return 'geplant';
  return gepostet ? 'Zahlen fehlen' : 'Noch nicht gepostet';
}

function offeneZeile(zeile, { kampagne }) {
  const { einheit, post } = zeile;
  const ziel = post ? `data-auswertung-erfassen="${esc(post.id)}"` : `data-auswertung-erfassen-einheit="${esc(einheit.id)}"`;
  const plattform = post?.plattform;
  const gepostet = post?.postedAt || einheit?.gepostetAm;
  return `
    <tr class="auswertung-zeile auswertung-zeile--offen" tabindex="0" ${ziel} data-flip-id="offen:${esc(post?.id || einheit.id)}" aria-label="${esc(`${einheit?.label || 'Post'} erfassen`)}">
      <td class="auswertung-tabelle__rang">${LEER}</td>
      <td>${videoZelle(einheit, post, { kampagne })}</td>
      <td>${plattform ? plattformLabel(plattform) : LEER}</td>
      <td>
        <div>${esc(datum(gepostet))}</div>
        <div class="auswertung-tabelle__sub">${esc(offenHinweis(zeile))}</div>
      </td>
      ${statZellen(post, { voll: false })}
    </tr>`;
}

/** Einheiten ohne bestätigte Zahlen in fester Reihenfolge: Prüfen, Fehlt, Paid ohne Post. */
function offeneZeilen(modell) {
  return [
    ...modell.pruefen.map(p => ({ einheit: modell.einheitenById.get(p.einheitId), post: p, status: 'pruefen' })),
    ...modell.fehlend.map(e => ({ einheit: e, post: null, status: 'fehlt' })),
    ...(modell.optional || []).map(e => ({ einheit: e, post: null, status: 'optional' }))
  ];
}

export function renderTabellenZeilen(modell, { sort = STANDARD_SORT, team = false } = {}) {
  const ctx = { kampagne: modell.kampagne, top: new Set(modell.top) };
  const rang = raenge(modell.posts);
  const bestaetigt = sortiertePosts(modell.posts, sort)
    .map(p => postZeile(p, modell.einheitenById.get(p.einheitId), rang.get(p.id), ctx));
  const offen = team ? offeneZeilen(modell).map(z => offeneZeile(z, ctx)) : [];
  if (!bestaetigt.length && !offen.length) {
    return `<tr><td colspan="${SPALTEN.length}" class="budget-tab__leer">Noch keine Posts.</td></tr>`;
  }
  return [...bestaetigt, ...offen].join('');
}

export function renderTabelle(modell, { sort = STANDARD_SORT, team = false } = {}) {
  const ohne = modell.pruefen.length + modell.fehlend.length;
  const sub = [`${exakt(modell.fortschritt.bestaetigt)} ausgewertet`, team && ohne ? `${exakt(ohne)} ohne Zahlen` : '']
    .filter(Boolean).join(' · ');
  return `
    <div class="budget-tab__section-head">
      <h4 class="budget-tab__section-title">Posts</h4>
      <p class="budget-tab__section-sub">${esc(sub)}</p>
    </div>
    <div class="data-table-container auswertung-tabelle">
      <table class="data-table">
        <thead data-auswertung-thead><tr>${SPALTEN.map(c => renderSortHeaderCell(c, sort)).join('')}</tr></thead>
        <tbody data-auswertung-tbody>${renderTabellenZeilen(modell, { sort, team })}</tbody>
      </table>
    </div>`;
}

/**
 * Poster in die Platzhalter hängen. Die Anfrage je Datei bleibt im `cache` (Promise), damit ein
 * Sortieren oder das Panel sie ohne zweiten Abruf zeigt. Fehlt ein Poster, bleibt das Icon.
 */
export function ladePoster(root, modell, cache) {
  const items = new Map(modell.einheiten.flatMap(e => (e.dateien || []).map(d => [d.id, d.item])));
  root?.querySelectorAll('[data-poster]').forEach((slot) => {
    const id = slot.dataset.poster;
    if (!cache.has(id)) {
      const item = items.get(id);
      if (!item) return;
      cache.set(id, getPoster(item).catch(() => null));
    }
    cache.get(id).then((url) => {
      if (!url || !slot.isConnected || slot.querySelector('img')) return;
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.src = url;
      slot.replaceChildren(img);
    });
  });
}
