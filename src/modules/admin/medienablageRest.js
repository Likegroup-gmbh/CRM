// medienablageRest.js
// "Übrig geblieben beim Umzug" auf der Medienablage-Seite (`page` = MedienablagePage): was nach
// dem Umzug Dropbox -> SharePoint noch fehlt, je Ursache in Klartext mit dem nächsten Schritt.
//   1. Hängt fest: Zeilen aus ablage_umzug mit Fehler (Stand: umzug_rest), gebündelt je Ursache
//   2. Noch nicht gestartet: Weiche steht auf SharePoint, aber Dateien sind nicht eingereiht
//   3. Noch in Dropbox: Weiche steht dort, bewusst (nur zur Übersicht)
// Texte und Gruppierung: medienablageRestText.js.

import { escapeHtml } from '../../core/format.js';
import { zahl } from './medienablageFormat.js';
import { restGruppen, TYP_LABEL } from './medienablageRestText.js';

const BADGE = { fehler: 'danger', warn: 'warning', info: 'info' };
const DETAIL_MAX = 100;
const nummer = (v) => Number(v) || 0;

const dateien = (n, bereich = 'medien') => `${zahl(n)} ${bereich === 'dokumente' ? (n === 1 ? 'Dokument' : 'Dokumente') : (n === 1 ? 'Datei' : 'Dateien')}`;

function firmenname(page, id) {
  return page.unternehmen(id)?.firmenname || 'Unbekanntes Unternehmen';
}

function weicheSharepoint(page, bereich, id) {
  if (bereich === 'dokumente') {
    return (page.data?.dokumente || []).find(d => String(d.id) === String(id))?.dokument_ablage_ziel === 'sharepoint';
  }
  return page.unternehmen(id)?.ablage_ziel === 'sharepoint';
}

function bereichUmzug(page, bereich, id) {
  const liste = bereich === 'dokumente' ? page.data?.dokument_umzug : page.data?.umzug;
  return (liste || []).find(u => String(u.unternehmen_id) === String(id)) || {};
}

// ---------- 1. Hängt fest ----------

function dateienTabelle(page, zeilen) {
  const sichtbar = zeilen.slice(0, DETAIL_MAX).map(z => `
      <tr>
        <td class="dq-name">${escapeHtml(z.datei || 'Datei ohne Namen')}</td>
        <td>${escapeHtml(TYP_LABEL[z.typ] || z.typ)}</td>
        <td>${escapeHtml(firmenname(page, z.unternehmen_id))}</td>
        <td class="ma-pfad">${escapeHtml([z.kampagne, z.kooperation].filter(Boolean).join(' · ') || '–')}</td>
      </tr>
    `).join('');
  const mehr = zeilen.length > DETAIL_MAX
    ? `<p class="ma-leise ma-rest-mehr">… und ${zahl(zeilen.length - DETAIL_MAX)} weitere.</p>` : '';
  return `
        <details class="ma-rest-details">
          <summary>Dateien anzeigen</summary>
          <div class="dq-scroll-x">
          <table class="dq-table ma-table">
            <thead><tr><th>Datei</th><th>Art</th><th>Unternehmen</th><th>Kampagne · Kooperation</th></tr></thead>
            <tbody>${sichtbar}</tbody>
          </table>
          </div>
          ${mehr}
        </details>
      `;
}

function firmaZeile(page, g, f) {
  let aktion = '';
  if (g.info.erneut) {
    aktion = weicheSharepoint(page, f.bereich, f.id)
      ? `<button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-ma-rest-erneut="${escapeHtml(`${f.bereich}:${f.id}`)}"
                title="Öffnet die fehlgeschlagenen Dateien dieses Unternehmens wieder und startet den Umzug neu">Erneut versuchen</button>`
      : '<span class="ma-leise">Weiche steht auf Dropbox</span>';
  }
  return `
          <li class="ma-rest-firma">
            <span class="dq-name">${escapeHtml(firmenname(page, f.id))}</span>
            <span class="ma-leise">${dateien(f.anzahl, f.bereich)}</span>
            ${aktion}
          </li>
        `;
}

function gruppeHtml(page, g) {
  const { info } = g;
  const befehl = info.befehl ? ` <code class="ma-rest-befehl">${escapeHtml(info.befehl)}</code>` : '';
  return `
      <section class="ma-rest-gruppe ma-rest-gruppe--${info.ton}">
        <div class="ma-rest-kopf">
          <h3 class="ma-rest-titel">${escapeHtml(info.titel)}</h3>
          <span class="status-badge ${BADGE[info.ton]}">${dateien(g.anzahl)}</span>
        </div>
        <dl class="ma-rest-text">
          <dt>Warum</dt><dd>${escapeHtml(info.warum)}</dd>
          <dt>Was tun</dt><dd>${escapeHtml(info.tun)}${befehl}</dd>
        </dl>
        <ul class="ma-rest-firmen">${g.firmen.map(f => firmaZeile(page, g, f)).join('')}</ul>
        ${dateienTabelle(page, g.zeilen)}
      </section>
    `;
}

// ---------- 2. Noch nicht gestartet ----------

/** Weiche auf SharePoint, aber Dateien in Dropbox, die weder fertig noch eingereiht sind. */
export function nichtGestartet(page) {
  const rest = (alt, u) => alt - (nummer(u.offen) + nummer(u.fehler) + nummer(u.uebersprungen));
  const medien = (page.data?.unternehmen || [])
    .filter(u => u.ablage_ziel === 'sharepoint')
    .map(u => ({ id: u.id, bereich: 'medien', anzahl: rest(nummer(u.dateien_dropbox), bereichUmzug(page, 'medien', u.id)) }));
  const dokumente = (page.data?.dokumente || [])
    .filter(d => d.dokument_ablage_ziel === 'sharepoint')
    .map(d => ({ id: d.id, bereich: 'dokumente', anzahl: rest(nummer(d.dropbox) + nummer(d.storage), bereichUmzug(page, 'dokumente', d.id)) }));
  return [...medien, ...dokumente].filter(x => x.anzahl > 0).sort((a, b) => b.anzahl - a.anzahl);
}

function nichtGestartetHtml(page, liste) {
  if (!liste.length) return '';
  const summe = liste.reduce((s, x) => s + x.anzahl, 0);
  const zeilen = liste.map(x => `
          <li class="ma-rest-firma">
            <span class="dq-name">${escapeHtml(firmenname(page, x.id))}</span>
            <span class="ma-leise">${dateien(x.anzahl, x.bereich)}</span>
            <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm"
                    ${x.bereich === 'dokumente' ? 'data-ma-dokument-umzug' : 'data-ma-umzug'}="${escapeHtml(x.id)}">Umzug starten</button>
          </li>
        `).join('');
  return `
      <section class="ma-rest-gruppe ma-rest-gruppe--warn">
        <div class="ma-rest-kopf">
          <h3 class="ma-rest-titel">Umzug noch nicht gestartet</h3>
          <span class="status-badge warning">${zahl(summe)} offen</span>
        </div>
        <dl class="ma-rest-text">
          <dt>Warum</dt><dd>Die Weiche steht auf SharePoint, aber diese Dateien liegen noch in Dropbox und sind nicht eingereiht.</dd>
          <dt>Was tun</dt><dd>„Umzug starten“ klicken, der Rest läuft im Hintergrund.</dd>
        </dl>
        <ul class="ma-rest-firmen">${zeilen}</ul>
      </section>
    `;
}

// ---------- 3. Noch in Dropbox ----------

/** Weiche steht auf Dropbox: Medien und Dokumente je Unternehmen, größte zuerst. */
export function nochInDropbox(page) {
  const je = new Map();
  const merke = (id, feld, n) => {
    if (n <= 0) return;
    if (!je.has(id)) je.set(id, { id, medien: 0, dokumente: 0 });
    je.get(id)[feld] += n;
  };
  for (const u of page.data?.unternehmen || []) {
    if (u.ablage_ziel !== 'sharepoint') merke(u.id, 'medien', nummer(u.dateien_dropbox));
  }
  for (const d of page.data?.dokumente || []) {
    if (d.dokument_ablage_ziel !== 'sharepoint') merke(d.id, 'dokumente', nummer(d.dropbox) + nummer(d.storage));
  }
  return [...je.values()].sort((a, b) => (b.medien + b.dokumente) - (a.medien + a.dokumente));
}

function nochInDropboxHtml(page, liste) {
  if (!liste.length) return '';
  const zeilen = liste.map(x => `
          <li class="ma-rest-firma">
            <span class="dq-name">${escapeHtml(firmenname(page, x.id))}</span>
            <span class="ma-leise">${[x.medien ? dateien(x.medien) : '', x.dokumente ? dateien(x.dokumente, 'dokumente') : ''].filter(Boolean).join(' · ')}</span>
          </li>
        `).join('');
  return `
      <details class="ma-rest-gruppe ma-rest-gruppe--info ma-rest-dropbox">
        <summary>${zahl(liste.length)} ${liste.length === 1 ? 'Unternehmen hat' : 'Unternehmen haben'} noch Dateien in Dropbox (Weiche steht dort, so gewollt)</summary>
        <p class="ma-rest-hinweis">Zum Umziehen unten in der Tabelle „Weiche“ auf SharePoint stellen, danach erscheint hier „Bestand umziehen“.</p>
        <ul class="ma-rest-firmen">${zeilen}</ul>
      </details>
    `;
}

// ---------- Zusammenbau ----------

export function restHtml(page) {
  const zeilen = page.data?.umzug_rest || [];
  const gruppen = restGruppen(zeilen);
  const offen = nichtGestartet(page);
  const dropbox = nochInDropbox(page);
  const firmen = new Set(zeilen.map(z => z.unternehmen_id)).size;

  const hinweis = zeilen.length
    ? `${dateien(zeilen.length)} hängen fest (${zahl(firmen)} Unternehmen). Je Ursache steht unten, warum und was zu tun ist.`
    : 'Keine Datei hängt fest.';
  const alleErledigt = !zeilen.length && !offen.length;

  return `
      <div class="dq-list-card ma-rest">
        <div class="dq-list-header">
          <h2 class="dq-list-title">Übrig geblieben beim Umzug</h2>
          <p class="dq-list-hint">${escapeHtml(hinweis)}</p>
        </div>
        ${alleErledigt ? '<div class="dq-leer dq-leer--ok">Alles umgezogen, was auf SharePoint steht.</div>' : ''}
        ${gruppen.map(g => gruppeHtml(page, g)).join('')}
        ${nichtGestartetHtml(page, offen)}
        ${nochInDropboxHtml(page, dropbox)}
      </div>
    `;
}

// Neuer Versuch für ein Unternehmen: öffnet dessen Fehler-Zeilen wieder und stößt den Läufer an
export async function restErneut(page, button) {
  if (page._busy) return;
  const [bereich, id] = String(button.dataset.maRestErneut || '').split(':');
  if (!id) return;
  const name = firmenname(page, id);
  const aktion = bereich === 'dokumente' ? 'dokument_umzug_starten' : 'umzug_starten';
  await page.ausfuehren({ aktion, unternehmen_id: id }, {
    button,
    erfolg: (antwort) => (antwort?.angelegt
      ? `${name}: ${dateien(antwort.angelegt, bereich)} neu eingereiht.`
      : `${name}: nichts neu einzureihen.`),
  });
}
