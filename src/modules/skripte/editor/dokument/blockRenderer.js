// blockRenderer.js
// Skript-Dokument (ADR 0062): Block-Liste -> HTML. Pure Funktionen.
// Textzellen tragen data-block-feld statt data-feld, damit InlineEdit und
// Liky sie nie als Skript-Zelle behandeln.

import { renderInlineMd } from '../../../../core/utils/inlineFormat.js';
import { icon } from '../../../../core/icons/IconSystem.js';
import { escapeHtml } from '../../SkripteUtils.js';
import { SKRIPT_TABELLE, TEXT_TYPEN, sichtbareBloecke } from './blockModell.js';

export const BLOCK_MD = { erweitert: true };

export function renderBlockMd(raw) {
  return renderInlineMd(raw, BLOCK_MD);
}

const PLATZHALTER = {
  absatz: 'Text schreiben…',
  h1: 'Überschrift 1',
  h2: 'Überschrift 2',
  liste: 'Listenpunkt',
  nummerierung: 'Listenpunkt',
  unterschrift: 'Bildunterschrift…'
};

function zelleHtml({ tag = 'div', klasse = '', raw, editierbar, attrs = '', placeholder = '' }) {
  return `<${tag} class="skripte-editor-block-text${klasse ? ` ${klasse}` : ''}"${attrs}${
    placeholder ? ` data-placeholder="${escapeHtml(placeholder)}"` : ''}${
    editierbar ? ' contenteditable="plaintext-only" spellcheck="true"' : ''}>${renderBlockMd(raw).html}</${tag}>`;
}

function griffHtml(block) {
  const label = block.typ === SKRIPT_TABELLE ? 'Skript-Tabelle verschieben' : 'Block-Optionen';
  return `
    <div class="skripte-editor-block-griff" contenteditable="false">
      <button type="button" class="skripte-editor-block-griff-btn" data-block-griff draggable="true"
        title="${label}: Klicken für Optionen, Ziehen zum Verschieben" aria-label="${label}">${icon('ellipsis-vertical')}</button>
    </div>`;
}

function internHtml(block, mitIntern) {
  if (!block.intern || !mitIntern) return '';
  return `<span class="skripte-editor-block-intern" title="Nur intern sichtbar, nicht im PDF und nicht für Kunde, Gast oder Creator">${icon('lock-closed')}<span>Intern</span></span>`;
}

function textBlockHtml(block, editierbar) {
  if (!editierbar && !block.md.trim()) return '';
  const tag = block.typ === 'h1' ? 'h2' : block.typ === 'h2' ? 'h3' : 'p';
  return zelleHtml({
    tag,
    klasse: `skripte-editor-block-text--${block.typ}`,
    raw: block.md,
    editierbar,
    attrs: ' data-block-feld="md"',
    placeholder: editierbar ? PLATZHALTER[block.typ] : ''
  });
}

function listenBlockHtml(block, editierbar) {
  const tag = block.typ === 'nummerierung' ? 'ol' : 'ul';
  const punkte = editierbar ? block.punkte : block.punkte.filter((p) => p.trim());
  if (!punkte.length) return '';
  return `<${tag} class="skripte-editor-block-liste">${punkte.map((punkt, i) => `
    <li>${zelleHtml({
      raw: punkt,
      editierbar,
      attrs: ` data-block-feld="punkte" data-index="${i}"`,
      placeholder: editierbar ? PLATZHALTER[block.typ] : ''
    })}</li>`).join('')}</${tag}>`;
}

function bildBlockHtml(block, editierbar, bildUrl) {
  const url = bildUrl(block.pfad);
  const unterschrift = block.unterschrift || '';
  const ratio = block.breite_px && block.hoehe_px
    ? ` style="aspect-ratio: ${block.breite_px} / ${block.hoehe_px}"`
    : '';
  const caption = editierbar || unterschrift.trim()
    ? zelleHtml({
      tag: 'figcaption',
      raw: unterschrift,
      editierbar,
      attrs: ' data-block-feld="unterschrift"',
      placeholder: editierbar ? PLATZHALTER.unterschrift : ''
    })
    : '';
  return `
    <figure class="skripte-editor-block-bild skripte-editor-block-bild--${block.breite}">
      <img src="${escapeHtml(url)}" alt="${escapeHtml(unterschrift)}" loading="lazy" draggable="false"${ratio}>
      ${caption}
    </figure>`;
}

function tabelleBlockHtml(block, editierbar) {
  return `
    <div class="skripte-editor-block-tabelle-wrap">
      <table class="skripte-editor-block-tabelle${block.kopfzeile ? ' has-kopfzeile' : ''}">
        <tbody>
          ${block.zeilen.map((zeile, z) => `
          <tr>
            ${zeile.map((wert, s) => {
              const tag = block.kopfzeile && z === 0 ? 'th' : 'td';
              return `<${tag}>${zelleHtml({
                raw: wert,
                editierbar,
                attrs: ` data-block-feld="zelle" data-zeile="${z}" data-spalte="${s}"`
              })}</${tag}>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function inhaltHtml(block, { editierbar, bildUrl, skriptTabelleHtml }) {
  if (block.typ === SKRIPT_TABELLE) return skriptTabelleHtml || '';
  if (block.typ === 'bild') return bildBlockHtml(block, editierbar, bildUrl);
  if (block.typ === 'tabelle') return tabelleBlockHtml(block, editierbar);
  if (block.typ === 'trennlinie') return '<hr class="skripte-editor-block-trennlinie">';
  if (block.typ === 'liste' || block.typ === 'nummerierung') return listenBlockHtml(block, editierbar);
  return textBlockHtml(block, editierbar);
}

/** Ein Block samt Griff (nur editierbar) und Intern-Badge. */
export function blockHtml(block, opts = {}) {
  const { editierbar = false, mitIntern = false, bildUrl = (p) => p, skriptTabelleHtml = '' } = opts;
  const inhalt = inhaltHtml(block, { editierbar, bildUrl, skriptTabelleHtml });
  if (!inhalt && !editierbar) return '';
  const klassen = [
    'skripte-editor-block',
    `skripte-editor-block--${block.typ.replace('_', '-')}`,
    block.intern && mitIntern ? 'is-intern' : ''
  ].filter(Boolean).join(' ');
  // Bild und Trennlinie haben keine Textzelle: fokussierbar fuer Entf/Backspace
  const fokussierbar = editierbar && (block.typ === 'bild' || block.typ === 'trennlinie');
  return `
    <div class="${klassen}" data-block-id="${escapeHtml(block.id)}" data-block-typ="${block.typ}"${fokussierbar ? ' tabindex="-1"' : ''}>
      ${editierbar ? griffHtml(block) : ''}
      <div class="skripte-editor-block-inhalt">${inhalt}</div>
      ${internHtml(block, mitIntern)}
    </div>`;
}

/**
 * Skript-Dokument: alle Bloecke in Reihenfolge. Ohne mitIntern fehlen
 * interne Bloecke (Kunde, Gast, Creator). `skriptTabelleHtml` fuellt den
 * Platz der Skript-Tabelle.
 */
export function dokumentHtml(bloecke, opts = {}) {
  const { editierbar = false, mitIntern = false } = opts;
  const liste = sichtbareBloecke(bloecke, { mitIntern: mitIntern || editierbar });
  const anfangZone = editierbar && !TEXT_TYPEN.includes(liste[0]?.typ);
  return `
    <div class="skripte-editor-dokument${editierbar ? ' is-editierbar' : ''}" id="ed-dokument">
      ${anfangZone ? '<div class="skripte-editor-dokument-anfang" data-dokument-anfang title="Klicken, um oben Text einzufügen"></div>' : ''}
      ${liste.map((block) => blockHtml(block, { ...opts, mitIntern: mitIntern || editierbar })).join('')}
      ${editierbar ? `<div class="skripte-editor-dokument-ende" data-dokument-ende title="Klicken, um weiterzuschreiben"></div>` : ''}
    </div>`;
}
