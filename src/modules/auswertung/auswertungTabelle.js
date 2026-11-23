// auswertungTabelle.js
// Post-Tabelle des Reports (Spec 5.4): bestätigte Posts sortierbar, Rang der Top 3 unabhängig von der
// Sortierung, Poster der geposteten Datei. Für das Team stehen danach alle Einheiten ohne bestätigte
// Auswertung, ein Entwurf mit seinem Link und den schon gelesenen Zahlen. Eine bestätigte Zeile öffnet
// per Klick oder Enter das Detail-Panel, eine offene Erfassen. Die Filter (auswertungFilter) gelten
// für beide Arten von Zeilen; ist einer aktiv, nennt der Kopf die Kennzahlen der gefilterten Posts.

import { renderSortHeaderCell } from '../../core/list/sortableHeader.js';
import { renderTableIdentity } from '../../core/format/tableIdentity.js';
import { renderVerknuepfungPill } from '../../core/ui/verknuepfungPill.js';
import { icon } from '../../core/icons/IconSystem.js';
import { getPoster } from '../../core/media/PosterCache.js';
import { berechneKennzahlen, bestaetigtePosts, engagementRate, interaktionen, messTage } from './auswertungKennzahlen.js';
import { filterLage, passtZumFilter, renderFilterLeiste } from './auswertungFilter.js';
import { LEER, dateiFormat, datum, esc, exakt, kompakt, plattformLink, plural, prozent, sekunden } from './auswertungFormat.js';

export const STANDARD_SORT = { field: 'aufrufe', ascending: false };

const SPALTEN = [
  { label: '#', className: 'auswertung-tabelle__rang' },
  { label: 'Post' },
  { label: 'Creator' },
  { label: 'Plattform' },
  { label: 'Gepostet', field: 'gepostet' },
  { label: 'Aufrufe', field: 'aufrufe', className: 'auswertung-zahl' },
  { label: 'Likes', field: 'likes', className: 'auswertung-zahl' },
  { label: 'Kommentare', field: 'comments', className: 'auswertung-zahl' },
  { label: 'Betrachter', field: 'reach', className: 'auswertung-zahl' },
  { label: 'Interaktionen', field: 'interaktionen', className: 'auswertung-zahl' },
  { label: 'Engagement-Rate', field: 'engagement', className: 'auswertung-zahl' },
  { label: 'Ø Wiedergabe', field: 'wiedergabe', className: 'auswertung-zahl' }
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
  if (field === 'wiedergabe') return zahl(post.metrics?.avgWatchSec);
  return post.metrics?.views ?? null;
}

function statZellen(post, { voll }) {
  const zahlTd = (key) => `<td class="auswertung-zahl">${esc(exakt(zahl(post?.metrics?.[key])))}</td>`;
  const rest = voll
    ? `<td class="auswertung-zahl">${esc(exakt(post?.metrics?.reach))}</td>
      <td class="auswertung-zahl">${esc(exakt(interaktionen(post)))}</td>
      <td class="auswertung-zahl">${esc(prozent(engagementRate([post])))}</td>`
    : `<td class="auswertung-zahl">${LEER}</td>`.repeat(3);
  const wiedergabe = `<td class="auswertung-zahl">${esc(sekunden(zahl(post?.metrics?.avgWatchSec)))}</td>`;
  return `${zahlTd('views')}${zahlTd('likes')}${zahlTd('comments')}${rest}${wiedergabe}`;
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

/** Unterzeile nennt die Produktion (Ebene Kampagne) bzw. die Linie (Produktion mit mehreren Linien). */
function videoZelle(einheit, post, { kampagne, mitLinien }) {
  const datei = postDatei(einheit, post);
  const titel = einheit?.titel || einheit?.label || 'Ohne Titel';
  const wo = einheit?.titel ? einheit.label : einheit?.bezug && `zu ${einheit.bezug}`;
  const herkunft = kampagne ? einheit?.produktion?.name : mitLinien ? einheit?.linie?.name : '';
  const sub = [wo, post && dateiFormat(einheit, post.dateiId), herkunft].filter(Boolean).join(' · ');
  return renderTableIdentity({
    avatarHtml: poster(einheit, datei),
    nameHtml: `<span class="auswertung-tabelle__titel" title="${esc(titel)}">${esc(titel)}</span>`,
    subHtml: sub ? `<span class="auswertung-tabelle__sub">${esc(sub)}</span>` : ''
  });
}

const darfCreatorOeffnen = () => window.canViewPage?.('creator') !== false
  && window.currentUser?.permissions?.creator?.can_view !== false;

/** Profilbild (Thumb vor Hauptbild, sonst Initial) und Name; mit Recht verlinkt der Name den Creator. */
function creatorZelle(creator) {
  const name = creator?.name || '';
  if (!name) return LEER;
  const href = creator.id ? `/creator/${creator.id}` : '';
  const nameHtml = href && darfCreatorOeffnen()
    ? renderVerknuepfungPill({ kind: 'creator', label: name, href, attrs: 'data-auswertung-creator' })
    : `<span class="auswertung-tabelle__titel" title="${esc(name)}">${esc(name)}</span>`;
  return renderTableIdentity({ url: creator.avatarUrl, name, nameHtml });
}

function postZeile(post, einheit, rang, ctx) {
  const tage = messTage(post);
  const rangHtml = rang
    ? `<span class="auswertung-rang${ctx.top.has(post.id) ? ' auswertung-rang--top' : ''}">${rang}</span>`
    : LEER;
  return `
    <tr class="auswertung-zeile" tabindex="0" data-post-id="${esc(post.id)}" data-flip-id="${esc(post.id)}" aria-label="${esc(`${einheit?.label || 'Post'} öffnen`)}">
      <td class="auswertung-tabelle__rang">${rangHtml}</td>
      <td class="auswertung-tabelle__post">${videoZelle(einheit, post, ctx)}</td>
      <td class="auswertung-tabelle__creator">${creatorZelle(einheit?.creator)}</td>
      <td>${plattformLink(post.plattform, post.link)}</td>
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

function offeneZeile(zeile, ctx) {
  const { einheit, post } = zeile;
  const ziel = post ? `data-auswertung-erfassen="${esc(post.id)}"` : `data-auswertung-erfassen-einheit="${esc(einheit.id)}"`;
  const plattform = post?.plattform;
  const gepostet = post?.postedAt || einheit?.gepostetAm;
  return `
    <tr class="auswertung-zeile auswertung-zeile--offen" tabindex="0" ${ziel} data-flip-id="offen:${esc(post?.id || einheit.id)}" aria-label="${esc(`${einheit?.label || 'Post'} erfassen`)}">
      <td class="auswertung-tabelle__rang">${LEER}</td>
      <td class="auswertung-tabelle__post">${videoZelle(einheit, post, ctx)}</td>
      <td class="auswertung-tabelle__creator">${creatorZelle(einheit?.creator)}</td>
      <td>${plattformLink(plattform, post?.link)}</td>
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

/** Zeilen nach dem wirksamen Filter: bestätigte Posts sortiert, offene nur fürs Team. */
function gefiltert(modell, { sort, team, filter }) {
  const bestaetigt = sortiertePosts(modell.posts, sort)
    .filter(p => passtZumFilter({ einheit: modell.einheitenById.get(p.einheitId), post: p }, filter));
  const offen = team ? offeneZeilen(modell).filter(z => passtZumFilter(z, filter)) : [];
  return { bestaetigt, offen };
}

/** @param {{ sort?: object, team?: boolean, filter?: object }} opts - filter wie im Zustand */
export function renderTabellenZeilen(modell, { sort = STANDARD_SORT, team = false, filter } = {}) {
  const lage = filterLage(modell, filter);
  const ctx = { kampagne: modell.kampagne, mitLinien: modell.mitLinien, top: new Set(modell.top) };
  const rang = raenge(modell.posts);
  const { bestaetigt, offen } = gefiltert(modell, { sort, team, filter: lage.filter });
  if (!bestaetigt.length && !offen.length) {
    const text = lage.aktiv ? 'Keine Posts für diesen Filter.' : 'Noch keine Posts.';
    return `<tr data-flip-id="leer"><td colspan="${SPALTEN.length}" class="budget-tab__leer">${text}</td></tr>`;
  }
  return [
    ...bestaetigt.map(p => postZeile(p, modell.einheitenById.get(p.einheitId), rang.get(p.id), ctx)),
    ...offen.map(z => offeneZeile(z, ctx))
  ].join('');
}

/**
 * Ohne Filter der Stand der Ebene, mit Filter dazu Aufrufe, Engagement-Rate und Ø Wiedergabe
 * der gefilterten bestätigten Posts, gerechnet wie die Kacheln.
 */
export function tabellenSub(modell, { team = false, filter } = {}) {
  const lage = filterLage(modell, filter);
  const ohneZahlen = (zeilen) => zeilen.filter(z => z.status !== 'optional').length;
  if (!lage.aktiv) {
    const ohne = ohneZahlen(team ? offeneZeilen(modell) : []);
    return [`${exakt(modell.fortschritt.bestaetigt)} ausgewertet`, ohne ? `${exakt(ohne)} ohne Zahlen` : '']
      .filter(Boolean).join(' · ');
  }
  const { bestaetigt, offen } = gefiltert(modell, { sort: STANDARD_SORT, team, filter: lage.filter });
  const k = berechneKennzahlen(bestaetigt);
  const ohne = ohneZahlen(offen);
  return [
    `${exakt(bestaetigt.length)} von ${exakt(modell.fortschritt.bestaetigt)} ausgewertet`,
    k.aufrufe != null ? `${kompakt(k.aufrufe)} Aufrufe` : '',
    k.engagementRate != null ? `${prozent(k.engagementRate)} Engagement-Rate` : '',
    k.wiedergabe != null ? `Ø ${sekunden(k.wiedergabe)} Wiedergabe` : '',
    ohne ? `${exakt(ohne)} ohne Zahlen` : ''
  ].filter(Boolean).join(' · ');
}

export function renderTabelle(modell, { sort = STANDARD_SORT, team = false, filter } = {}) {
  return `
    <div class="budget-tab__section-head auswertung-posts__kopf">
      <div>
        <h4 class="budget-tab__section-title">Posts</h4>
        <p class="budget-tab__section-sub" data-auswertung-tabelle-sub>${esc(tabellenSub(modell, { team, filter }))}</p>
      </div>
      ${renderFilterLeiste(filterLage(modell, filter))}
    </div>
    <div class="data-table-container auswertung-tabelle">
      <table class="data-table">
        <thead data-auswertung-thead><tr>${SPALTEN.map(c => renderSortHeaderCell(c, sort)).join('')}</tr></thead>
        <tbody data-auswertung-tbody>${renderTabellenZeilen(modell, { sort, team, filter })}</tbody>
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
