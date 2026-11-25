// inlineFormat.js
// Mini-Markdown fuer Inline-Formatierung (**fett**, *kursiv*, `code`) mit
// WYSIWYG-Bruecke: Rendert nach HTML inkl. Offset-Maps (sichtbarer Text <->
// Raw-String) und serialisiert contenteditable-HTML zurueck nach Markdown.
// Fachlich ungebunden - Skript-Editor und spaetere Stellen teilen sich das.
// Mit { erweitert: true } kommen ==Highlight== und [Link](https://…) dazu;
// ohne Option bleiben beide Literal (Skript-Tabelle, Liky-Zellen).
// Mit { hervorheben: true } kommt nur die Hervorhebung dazu (Links bleiben
// Literal) - so rendert die Skript-Tabelle.
// Farbige Hervorhebung: =={id}Text== mit id aus HIGHLIGHT_FARBEN; ohne id
// (==Text==) gilt der Standardton. Unbekannte ids bleiben Literal im Text.
// Teile: inlineFormatParser (Token-Baum), inlineFormatEdit (Toggle, Laeufe),
// inlineFormatDom (Selektion). Diese Datei rendert, serialisiert und
// re-exportiert alles.

import { istHighlightFarbe, highlightHex } from './highlightFarben.js';
import { istSichereLinkUrl, parseTokens } from './inlineFormatParser.js';

export { istSichereLinkUrl } from './inlineFormatParser.js';
export * from './inlineFormatEdit.js';
export * from './inlineFormatDom.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Renderer: Raw -> HTML + Offset-Maps ----------

const OPEN_TAGS = { bold: '<strong>', italic: '<em>', bolditalic: '<strong><em>', code: '<code>', highlight: '<mark>' };
const CLOSE_TAGS = { bold: '</strong>', italic: '</em>', bolditalic: '</em></strong>', code: '</code>', highlight: '</mark>', link: '</a>' };

/**
 * @param {string} raw Markdown-String
 * @param {{ erweitert?: boolean }} [opts] erweitert: ==Highlight== und [Link](url)
 * @returns {{ html: string, toRaw: number[], toRendered: number[] }}
 *   toRaw[sichtbarerIdx] = rawIdx (inkl. Sentinel: toRaw[len] = raw.length),
 *   toRendered[rawIdx] = sichtbarerIdx (Marker zeigen auf die Inhaltsposition).
 */
export function renderInlineMd(raw, opts) {
  const { text, tokens } = parseTokens(raw, opts);

  const toRaw = [];
  const toRendered = new Array(text.length + 1).fill(0);
  let html = '';
  let renderedLen = 0;

  const emitText = (start, end) => {
    for (let i = start; i < end; i++) {
      toRendered[i] = renderedLen;
      html += escapeHtml(text[i]);
      toRaw.push(i);
      renderedLen += 1;
    }
  };

  const emitTokens = (list) => {
    for (const t of list) {
      if (t.type === 'text') { emitText(t.start, t.end); continue; }
      for (let i = t.start; i < t.contentStart; i++) toRendered[i] = renderedLen;
      if (t.type === 'link') {
        html += `<a href="${escapeHtml(t.href)}" target="_blank" rel="noopener noreferrer">`;
      } else if (t.type === 'highlight' && t.farbe) {
        html += `<mark data-farbe="${t.farbe}" style="background-color:${highlightHex(t.farbe)}">`;
      } else {
        html += OPEN_TAGS[t.type];
      }
      if (t.type === 'code') emitText(t.contentStart, t.contentEnd);
      else emitTokens(t.children);
      html += CLOSE_TAGS[t.type];
      for (let i = t.contentEnd; i < t.end; i++) toRendered[i] = renderedLen;
    }
  };

  emitTokens(tokens);
  toRendered[text.length] = renderedLen;
  toRaw.push(text.length);
  return { html, toRaw, toRendered };
}

// ---------- Serializer: contenteditable-HTML -> Raw ----------

function serializeNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const tag = node.tagName;
  if (tag === 'BR') return '\n';
  const inner = [...node.childNodes].map(serializeNode).join('');
  if (!inner) return '';
  if (tag === 'STRONG' || tag === 'B') {
    const only = node.childNodes.length === 1 ? node.childNodes[0] : null;
    if (only?.nodeType === Node.ELEMENT_NODE && (only.tagName === 'EM' || only.tagName === 'I')) {
      const t = [...only.childNodes].map(serializeNode).join('');
      if (t) return `***${t}***`;
    }
    return `**${inner}**`;
  }
  if (tag === 'EM' || tag === 'I') {
    const only = node.childNodes.length === 1 ? node.childNodes[0] : null;
    if (only?.nodeType === Node.ELEMENT_NODE && (only.tagName === 'STRONG' || only.tagName === 'B')) {
      const t = [...only.childNodes].map(serializeNode).join('');
      if (t) return `***${t}***`;
    }
    return `*${inner}*`;
  }
  if (tag === 'CODE') return `\`${inner}\``;
  if (tag === 'MARK') {
    const farbe = node.getAttribute('data-farbe') || '';
    return `==${istHighlightFarbe(farbe) ? `{${farbe}}` : ''}${inner}==`;
  }
  if (tag === 'A') {
    const href = node.getAttribute('href') || '';
    return istSichereLinkUrl(href) ? `[${inner}](${href})` : inner;
  }
  // Block-Container (Browser-Enter in contenteditable): Umbruch davor
  if (tag === 'DIV' || tag === 'P') return `\n${inner}`;
  return inner;
}

export function htmlToInlineMd(el) {
  if (!el) return '';
  let out = [...el.childNodes].map(serializeNode).join('').replace(/ /g, ' ');
  if (out.startsWith('\n')) out = out.slice(1);
  if (out === '\n') out = '';
  return out;
}
