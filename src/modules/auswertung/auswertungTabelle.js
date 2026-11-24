// auswertungTabelle.js
// Post-Tabelle des Reports je Creator (ADR 0081), aufgebaut wie die Kooperationstabelle: je Creator
// ein <tbody>, Rang und Creator stehen einmal links über alle seine Zeilen. Darin die bestätigten
// Posts nach der Sortierung mit dem Poster der geposteten Datei, für das Team danach alle Einheiten
// ohne bestätigte Auswertung (ein Entwurf mit seinem Link und den schon gelesenen Zahlen). Eine
// bestätigte Zeile öffnet per Klick oder Enter das Detail-Panel, eine offene Erfassen. Die Filter
// (auswertungFilter) gelten für beide Arten von Zeilen; ist einer aktiv, nennt der Kopf die
// Kennzahlen der gefilterten Posts. Reihenfolge, Stand und Rang rechnet auswertungGruppen.

import { renderSortHeaderCell } from '../../core/list/sortableHeader.js';
import { renderTableIdentity } from '../../core/format/tableIdentity.js';
import { renderVerknuepfungPill } from '../../core/ui/verknuepfungPill.js';
import { icon } from '../../core/icons/IconSystem.js';
import { getPoster } from '../../core/media/PosterCache.js';
import { berechneKennzahlen, interaktionen, messTage } from './auswertungKennzahlen.js';
import { STANDARD_SORT, creatorGruppen, creatorRaenge, gefilterteZeilen, offeneZeilen } from './auswertungGruppen.js';
import { filterLage, renderFilterLeiste } from './auswertungFilter.js';
import { LEER, dateiFormat, datum, esc, exakt, kompakt, plattformLink, plural, sekunden } from './auswertungFormat.js';

const SPALTEN = [
  { label: '#', className: 'auswertung-tabelle__rang' },
  { label: 'Creator' },
  { label: 'Post' },
  { label: 'Plattform' },
  { label: 'Gepostet', field: 'gepostet' },
  { label: 'Aufrufe', field: 'aufrufe', className: 'auswertung-zahl' },
  { label: 'Likes', field: 'likes', className: 'auswertung-zahl' },
  { label: 'Kommentare', field: 'comments', className: 'auswertung-zahl' },
  { label: 'Betrachter', field: 'reach', className: 'auswertung-zahl' },
  { label: 'Interaktionen', field: 'interaktionen', className: 'auswertung-zahl' },
  { label: 'Ø Wiedergabe', field: 'wiedergabe', className: 'auswertung-zahl' },
  { label: 'Link-Klicks', field: 'linkClicks', className: 'auswertung-zahl' },
  { label: 'Sticker-Taps', field: 'stickerTaps', className: 'auswertung-zahl' }
];

export const ART_ICON = { video: 'film', story: 'video', still: 'photo' };

const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Offene Zeilen zeigen die schon gelesenen Rohwerte; Interaktionen erst nach dem Bestätigen. */
function statZellen(post, { voll }) {
  const td = (text) => `<td class="auswertung-zahl">${esc(text)}</td>`;
  const roh = (key) => td(exakt(zahl(post?.metrics?.[key])));
  return [
    roh('views'),
    roh('likes'),
    roh('comments'),
    roh('reach'),
    td(voll ? exakt(interaktionen(post)) : LEER),
    td(sekunden(zahl(post?.metrics?.avgWatchSec))),
    roh('linkClicks'),
    roh('stickerTaps')
  ].join('');
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

/**
 * Profilbild (Thumb vor Hauptbild, sonst Initial) und Name; mit Recht verlinkt der Name den Creator.
 * Keine Unterzeile: Aufrufe und Stand stehen in den Post-Zeilen.
 */
function creatorZelle(gruppe) {
  const { creator } = gruppe;
  const name = creator?.name || '';
  const href = creator?.id ? `/creator/${creator.id}` : '';
  let nameHtml = '<span class="auswertung-tabelle__titel auswertung-tabelle__ohne">Ohne Creator</span>';
  if (name) {
    nameHtml = href && darfCreatorOeffnen()
      ? renderVerknuepfungPill({ kind: 'creator', label: name, href, attrs: 'data-auswertung-creator' })
      : `<span class="auswertung-tabelle__titel" title="${esc(name)}">${esc(name)}</span>`;
  }
  return renderTableIdentity({
    url: creator?.avatarUrl,
    name,
    iconHtml: name ? '' : icon('user', { size: 16 }),
    nameHtml
  });
}

function rangHtml(rang) {
  if (!rang) return LEER;
  return `<span class="auswertung-rang${rang <= 3 ? ' auswertung-rang--top' : ''}">${rang}</span>`;
}

/** `kopf`: Rang- und Creator-Zelle, nur in der ersten Zeile der Gruppe. */
function postZeile(post, einheit, ctx, kopf = '') {
  const tage = messTage(post);
  return `
    <tr class="auswertung-zeile" tabindex="0" data-post-id="${esc(post.id)}" aria-label="${esc(`${einheit?.label || 'Post'} öffnen`)}">
      ${kopf}
      <td class="auswertung-tabelle__post">${videoZelle(einheit, post, ctx)}</td>
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

function offeneZeile(zeile, ctx, kopf = '') {
  const { einheit, post } = zeile;
  const ziel = post ? `data-auswertung-erfassen="${esc(post.id)}"` : `data-auswertung-erfassen-einheit="${esc(einheit.id)}"`;
  const gepostet = post?.postedAt || einheit?.gepostetAm;
  return `
    <tr class="auswertung-zeile auswertung-zeile--offen" tabindex="0" ${ziel} aria-label="${esc(`${einheit?.label || 'Post'} erfassen`)}">
      ${kopf}
      <td class="auswertung-tabelle__post">${videoZelle(einheit, post, ctx)}</td>
      <td>${plattformLink(post?.plattform, post?.link)}</td>
      <td>
        <div>${esc(datum(gepostet))}</div>
        <div class="auswertung-tabelle__sub">${esc(offenHinweis(zeile))}</div>
      </td>
      ${statZellen(post, { voll: false })}
    </tr>`;
}

function gruppeHtml(gruppe, ctx) {
  const zeilen = [
    ...gruppe.posts.map(post => ({ post })),
    ...gruppe.offen.map(offen => ({ offen }))
  ];
  const n = zeilen.length;
  const kopf = `
      <td class="auswertung-tabelle__rang" rowspan="${n}" data-auswertung-gruppenkopf>${rangHtml(ctx.rang.get(gruppe.key))}</td>
      <td class="auswertung-tabelle__creator" rowspan="${n}" data-auswertung-gruppenkopf>${creatorZelle(gruppe)}</td>`;
  const html = zeilen.map((z, i) => (z.post
    ? postZeile(z.post, ctx.einheitenById.get(z.post.einheitId), ctx, i === 0 ? kopf : '')
    : offeneZeile(z.offen, ctx, i === 0 ? kopf : ''))).join('');
  return `<tbody class="auswertung-gruppe" data-flip-id="${esc(`creator:${gruppe.key}`)}">${html}</tbody>`;
}

/**
 * Je Creator ein <tbody> (data-flip-id je Creator), ohne Zeilen ein Leer-<tbody>.
 * @param {{ sort?: object, team?: boolean, filter?: object }} opts - filter wie im Zustand
 */
export function renderTabellenGruppen(modell, { sort = STANDARD_SORT, team = false, filter } = {}) {
  const lage = filterLage(modell, filter);
  const gruppen = creatorGruppen(modell, { sort, team, filter: lage.filter });
  if (!gruppen.length) {
    const text = lage.aktiv ? 'Keine Posts für diesen Filter.' : 'Noch keine Posts.';
    return `<tbody data-flip-id="leer"><tr><td colspan="${SPALTEN.length}" class="budget-tab__leer">${text}</td></tr></tbody>`;
  }
  const ctx = {
    kampagne: modell.kampagne,
    mitLinien: modell.mitLinien,
    einheitenById: modell.einheitenById,
    team,
    rang: creatorRaenge(modell)
  };
  return gruppen.map(g => gruppeHtml(g, ctx)).join('');
}

/**
 * Ohne Filter der Stand der Ebene, mit Filter dazu Aufrufe, Interaktionen und Ø Wiedergabe
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
  const { bestaetigt, offen } = gefilterteZeilen(modell, { team, filter: lage.filter });
  const k = berechneKennzahlen(bestaetigt);
  const ohne = ohneZahlen(offen);
  return [
    `${exakt(bestaetigt.length)} von ${exakt(modell.fortschritt.bestaetigt)} ausgewertet`,
    k.aufrufe != null ? `${kompakt(k.aufrufe)} Aufrufe` : '',
    k.interaktionen != null ? `${kompakt(k.interaktionen)} Interaktionen` : '',
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
      <table class="data-table" data-auswertung-table>
        <thead data-auswertung-thead><tr>${SPALTEN.map(c => renderSortHeaderCell(c, sort)).join('')}</tr></thead>
        ${renderTabellenGruppen(modell, { sort, team, filter })}
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
