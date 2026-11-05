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

import { istHighlightFarbe, highlightHex } from './highlightFarben.js';

const MARKER = { bold: '**', italic: '*' };

const LINK_PROTOKOLL = /^(https?:\/\/|mailto:)/i;

/** Nur http(s) und mailto, ohne Leerzeichen und Klammern. */
export function istSichereLinkUrl(url) {
  const value = String(url ?? '').trim();
  return LINK_PROTOKOLL.test(value) && !/[\s()<>"]/.test(value);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Parser (Raw-String -> Token-Baum, absolute Offsets) ----------

const OPEN_TAGS = { bold: '<strong>', italic: '<em>', bolditalic: '<strong><em>', code: '<code>', highlight: '<mark>' };
const CLOSE_TAGS = { bold: '</strong>', italic: '</em>', bolditalic: '</em></strong>', code: '</code>', highlight: '</mark>', link: '</a>' };

/** Optionales {farbe} direkt hinter dem oeffnenden ==. */
function parseFarbe(raw, pos, end) {
  const m = /^\{([a-z]{1,16})\}/.exec(raw.slice(pos, Math.min(end, pos + 20)));
  return m && istHighlightFarbe(m[1]) ? { id: m[1], len: m[0].length } : { id: '', len: 0 };
}

/** [label](url) ab i, sonst null. */
function parseLink(raw, i, end) {
  const closeBracket = raw.indexOf('](', i + 1);
  if (closeBracket === -1 || closeBracket <= i + 1 || closeBracket + 2 > end) return null;
  if (raw.slice(i + 1, closeBracket).includes('\n')) return null;
  const closeParen = raw.indexOf(')', closeBracket + 2);
  if (closeParen === -1 || closeParen >= end) return null;
  const href = raw.slice(closeBracket + 2, closeParen);
  if (!istSichereLinkUrl(href)) return null;
  return {
    type: 'link',
    start: i,
    contentStart: i + 1,
    contentEnd: closeBracket,
    end: closeParen + 1,
    href,
    children: []
  };
}

function parseInline(raw, start, end, tokens, opts = {}) {
  let i = start;
  let litStart = start;
  while (i < end) {
    if (opts.erweitert || opts.hervorheben) {
      const link = opts.erweitert && raw[i] === '[' ? parseLink(raw, i, end) : null;
      const mark = !link && raw.startsWith('==', i);
      if (link || mark) {
        const token = link || (() => {
          const farbe = parseFarbe(raw, i + 2, end);
          const contentStart = i + 2 + farbe.len;
          const closeIdx = raw.indexOf('==', contentStart);
          if (closeIdx === -1 || closeIdx + 2 > end || closeIdx === contentStart) return null;
          return {
            type: 'highlight', start: i, contentStart, contentEnd: closeIdx, end: closeIdx + 2, farbe: farbe.id, children: []
          };
        })();
        if (!token) {
          i += mark ? 2 : 1;
          continue;
        }
        if (litStart < i) tokens.push({ type: 'text', start: litStart, end: i });
        parseInline(raw, token.contentStart, token.contentEnd, token.children, opts);
        tokens.push(token);
        i = token.end;
        litStart = i;
        continue;
      }
    }
    const three = raw.startsWith('***', i);
    const two = !three && raw.startsWith('**', i);
    const one = !three && !two && raw[i] === '*';
    const code = !three && !two && !one && raw[i] === '`';
    if (!three && !two && !one && !code) { i += 1; continue; }
    const marker = three ? '***' : two ? '**' : one ? '*' : '`';
    const closeIdx = raw.indexOf(marker, i + marker.length);
    // Kein schliessender Marker oder leerer Inhalt -> Marker ist Literal
    if (closeIdx === -1 || closeIdx + marker.length > end || closeIdx === i + marker.length) {
      i += marker.length;
      continue;
    }
    if (litStart < i) tokens.push({ type: 'text', start: litStart, end: i });
    const type = three ? 'bolditalic' : two ? 'bold' : one ? 'italic' : 'code';
    const token = {
      type,
      start: i,
      contentStart: i + marker.length,
      contentEnd: closeIdx,
      end: closeIdx + marker.length,
      children: []
    };
    if (type !== 'code') parseInline(raw, token.contentStart, token.contentEnd, token.children, opts);
    tokens.push(token);
    i = token.end;
    litStart = i;
  }
  if (litStart < end) tokens.push({ type: 'text', start: litStart, end });
}

function parseTokens(raw, opts) {
  const text = String(raw ?? '');
  const tokens = [];
  parseInline(text, 0, text.length, tokens, opts || {});
  return { text, tokens };
}

// ---------- Renderer: Raw -> HTML + Offset-Maps ----------

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

// ---------- Detect / Toggle auf Raw-String ----------

function runBefore(text, idx) {
  let n = 0;
  while (idx - 1 - n >= 0 && text[idx - 1 - n] === '*') n += 1;
  return n;
}

function runAfter(text, idx) {
  let n = 0;
  while (idx + n < text.length && text[idx + n] === '*') n += 1;
  return n;
}

/**
 * Prueft, ob die Auswahl [start, end) von Markern umschlossen ist
 * (Marker direkt ausserhalb oder als Teil der Auswahl selbst).
 * Bei *** zaehlt beides: bold (>=2) und italic (ungerade Anzahl).
 */
export function detectInlineFormat(raw, start, end) {
  const text = String(raw ?? '');
  if (start > end) [start, end] = [end, start];
  const nPre = runBefore(text, start);
  const nPost = runAfter(text, end);
  let bold = nPre >= 2 && nPost >= 2;
  let italic = nPre >= 1 && nPost >= 1 && nPre % 2 === 1 && nPost % 2 === 1;

  const nLeadIn = runAfter(text, start);
  const nTrailIn = runBefore(text, end);
  if (!bold && nLeadIn >= 2 && nTrailIn >= 2 && end - start > 4) bold = true;
  if (!italic && nLeadIn >= 1 && nTrailIn >= 1 && nLeadIn % 2 === 1 && nTrailIn % 2 === 1 && end - start > 2) {
    italic = true;
  }
  return { bold, italic };
}

/**
 * Wrap/Unwrap der Auswahl. Rueckgabe: neuer String + Auswahl-Offsets,
 * die den (formatierten) Inhalt ohne Marker umfassen.
 */
export function toggleInlineFormat(raw, start, end, format) {
  if (format === 'highlight') return toggleHighlight(raw, start, end);
  const text = String(raw ?? '');
  const m = MARKER[format];
  if (!m) return { text, start, end };
  if (start > end) [start, end] = [end, start];
  if (start === end) return { text, start, end };

  const { bold, italic } = detectInlineFormat(text, start, end);
  const active = format === 'bold' ? bold : italic;

  if (active) {
    const nPre = runBefore(text, start);
    const nPost = runAfter(text, end);
    if (nPre >= m.length && nPost >= m.length) {
      // Marker ausserhalb der Auswahl entfernen
      const neu = text.slice(0, start - m.length) + text.slice(start, end) + text.slice(end + m.length);
      return { text: neu, start: start - m.length, end: end - m.length };
    }
    // Marker liegen innerhalb der Auswahl
    const inner = text.slice(start + m.length, end - m.length);
    return { text: text.slice(0, start) + inner + text.slice(end), start, end: start + inner.length };
  }

  const neu = text.slice(0, start) + m + text.slice(start, end) + m + text.slice(end);
  return { text: neu, start: start + m.length, end: end + m.length };
}

// ---------- Erweitert: Highlight und Link (Token-basiert) ----------

/** Token des Typs, in dessen Inhalt die Auswahl liegt (oder das sie genau umfasst). */
function findeToken(list, type, start, end) {
  for (const t of list) {
    if (t.type === 'text') continue;
    if (t.type === type) {
      const innen = t.contentStart <= start && end <= t.contentEnd;
      const genau = start === t.start && end === t.end;
      if (innen || genau) return t;
    }
    if (t.start <= start && end <= t.end && t.children?.length) {
      const tiefer = findeToken(t.children, type, start, end);
      if (tiefer) return tiefer;
    }
  }
  return null;
}

/** Highlight und Link an der Auswahl (nur erweitertes Markdown). */
export function detectErweitert(raw, start, end) {
  if (start > end) [start, end] = [end, start];
  const { tokens } = parseTokens(raw, { erweitert: true });
  const link = findeToken(tokens, 'link', start, end);
  return {
    highlight: Boolean(findeToken(tokens, 'highlight', start, end)),
    farbe: findeToken(tokens, 'highlight', start, end)?.farbe || '',
    link: link?.href || ''
  };
}

/** Highlight-Token samt Markern entfernen; Auswahl-Offsets wandern mit. */
function entferneHighlight(text, t, start, end) {
  const offen = t.contentStart - t.start;
  const neu = text.slice(0, t.start) + text.slice(t.contentStart, t.contentEnd) + text.slice(t.end);
  const shift = (s) => {
    if (s <= t.start) return s;
    if (s >= t.end) return s - offen - 2;
    if (s >= t.contentEnd) return t.contentEnd - offen;
    if (s >= t.contentStart) return s - offen;
    return t.start;
  };
  return { text: neu, start: shift(start), end: shift(end) };
}

function toggleHighlight(raw, start, end) {
  const { text, tokens } = parseTokens(raw, { erweitert: true });
  if (start > end) [start, end] = [end, start];
  if (start === end) return { text, start, end };
  const t = findeToken(tokens, 'highlight', start, end);
  if (t) return entferneHighlight(text, t, start, end);
  const neu = `${text.slice(0, start)}==${text.slice(start, end)}==${text.slice(end)}`;
  return { text: neu, start: start + 2, end: end + 2 };
}

/**
 * Farbige Hervorhebung auf die Auswahl legen. Liegt die Auswahl in einem
 * Highlight: andere Farbe -> umfaerben, gleiche Farbe oder leere farbe -> entfernen.
 * Ohne Highlight und mit farbe: umschliessen. Rueckgabe wie toggleInlineFormat.
 */
export function setzeHighlightFarbe(raw, start, end, farbe) {
  const { text, tokens } = parseTokens(raw, { erweitert: true });
  if (start > end) [start, end] = [end, start];
  if (start === end) return { text, start, end };
  const id = istHighlightFarbe(farbe) ? farbe : '';
  const t = findeToken(tokens, 'highlight', start, end);
  if (t) {
    if (!id || t.farbe === id) return entferneHighlight(text, t, start, end);
    const offen = `=={${id}}`;
    const delta = offen.length - (t.contentStart - t.start);
    const neu = text.slice(0, t.start) + offen + text.slice(t.contentStart);
    const min = t.start + offen.length;
    const max = t.contentEnd + delta;
    const shift = (s) => Math.min(Math.max(s + delta, min), max);
    return { text: neu, start: shift(start), end: shift(end) };
  }
  if (!id) return { text, start, end };
  const offen = `=={${id}}`;
  const neu = `${text.slice(0, start)}${offen}${text.slice(start, end)}==${text.slice(end)}`;
  return { text: neu, start: start + offen.length, end: end + offen.length };
}

/**
 * Link auf die Auswahl setzen, aendern oder (url leer) entfernen.
 * Rueckgabe wie toggleInlineFormat; die Offsets umfassen das Label.
 */
export function setzeLink(raw, start, end, url) {
  const { text, tokens } = parseTokens(raw, { erweitert: true });
  if (start > end) [start, end] = [end, start];
  const href = String(url ?? '').trim();
  const t = findeToken(tokens, 'link', start, end);
  if (t) {
    const label = text.slice(t.contentStart, t.contentEnd);
    if (!href) {
      const neu = text.slice(0, t.start) + label + text.slice(t.end);
      return { text: neu, start: t.start, end: t.start + label.length };
    }
    if (!istSichereLinkUrl(href)) return { text, start, end };
    const neu = `${text.slice(0, t.contentEnd)}](${href})${text.slice(t.end)}`;
    return { text: neu, start: t.contentStart, end: t.contentEnd };
  }
  if (start === end || !href || !istSichereLinkUrl(href)) return { text, start, end };
  const neu = `${text.slice(0, start)}[${text.slice(start, end)}](${href})${text.slice(end)}`;
  return { text: neu, start: start + 1, end: end + 1 };
}

/**
 * Text-Laeufe mit Format-Flags, z.B. fuer das PDF.
 * @returns {Array<{ text: string, bold?: boolean, italic?: boolean, code?: boolean, highlight?: boolean, href?: string }>}
 */
export function inlineMdRuns(raw, opts = { erweitert: true }) {
  const { text, tokens } = parseTokens(raw, opts);
  const runs = [];
  const push = (value, fmt) => {
    if (!value) return;
    const last = runs[runs.length - 1];
    const gleich = last && ['bold', 'italic', 'code', 'highlight', 'href']
      .every((k) => (last[k] || false) === (fmt[k] || false));
    if (gleich) last.text += value;
    else runs.push({ ...fmt, text: value });
  };
  const walk = (list, fmt) => {
    for (const t of list) {
      if (t.type === 'text') { push(text.slice(t.start, t.end), fmt); continue; }
      if (t.type === 'code') { push(text.slice(t.contentStart, t.contentEnd), { ...fmt, code: true }); continue; }
      const next = { ...fmt };
      if (t.type === 'bold' || t.type === 'bolditalic') next.bold = true;
      if (t.type === 'italic' || t.type === 'bolditalic') next.italic = true;
      if (t.type === 'highlight') next.highlight = t.farbe || true;
      if (t.type === 'link') next.href = t.href;
      walk(t.children, next);
    }
  };
  walk(tokens, {});
  return runs;
}

/** Sichtbarer Text ohne Marker. */
export function inlineMdText(raw, opts = { erweitert: true }) {
  return inlineMdRuns(raw, opts).map((r) => r.text).join('');
}

/** Laeufe zurueck nach Markdown; jeder Lauf bekommt seine Marker selbst. */
export function runsZuMd(runs) {
  return (runs || []).map((r) => {
    if (!r.text) return '';
    let out = r.code ? `\`${r.text}\`` : r.text;
    if (!r.code) {
      if (r.bold && r.italic) out = `***${out}***`;
      else if (r.bold) out = `**${out}**`;
      else if (r.italic) out = `*${out}*`;
    }
    if (r.highlight) out = `==${typeof r.highlight === 'string' ? `{${r.highlight}}` : ''}${out}==`;
    if (r.href) out = `[${out}](${r.href})`;
    return out;
  }).join('');
}

/**
 * Teilt an einem sichtbaren Offset in zwei gueltige Markdown-Strings
 * (Enter mitten in einem Absatz). Offene Formatierung wird links
 * geschlossen und rechts neu geoeffnet.
 */
export function teileInlineMd(raw, sichtbarerOffset, opts = { erweitert: true }) {
  const runs = inlineMdRuns(raw, opts);
  const links = [];
  const rechts = [];
  let pos = 0;
  for (const run of runs) {
    const ende = pos + run.text.length;
    if (ende <= sichtbarerOffset) links.push(run);
    else if (pos >= sichtbarerOffset) rechts.push(run);
    else {
      const cut = sichtbarerOffset - pos;
      links.push({ ...run, text: run.text.slice(0, cut) });
      rechts.push({ ...run, text: run.text.slice(cut) });
    }
    pos = ende;
  }
  return [runsZuMd(links), runsZuMd(rechts)];
}

// ---------- DOM-Bruecke (contenteditable-Zellen) ----------

function nodeTextLen(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.length;
  if (node.nodeType !== Node.ELEMENT_NODE) return 0;
  if (node.tagName === 'BR') return 1;
  let n = 0;
  for (const c of node.childNodes) n += nodeTextLen(c);
  return n;
}

function prefixLen(el, childCount) {
  let n = 0;
  const max = Math.min(childCount, el.childNodes.length);
  for (let i = 0; i < max; i++) n += nodeTextLen(el.childNodes[i]);
  return n;
}

/** Sichtbarer Text-Offset einer DOM-Position (BR zaehlt als 1 Zeichen). */
function renderedOffset(cell, node, offset) {
  if (node === cell) return prefixLen(cell, offset);
  let found = -1;
  const walk = (el, acc) => {
    let total = acc;
    for (const child of el.childNodes) {
      if (found >= 0) break;
      if (child === node) {
        found = node.nodeType === Node.TEXT_NODE ? total + offset : total + prefixLen(node, offset);
        break;
      }
      if (child.nodeType === Node.ELEMENT_NODE && child.contains(node)) {
        total = walk(child, total);
      } else {
        total += nodeTextLen(child);
      }
    }
    return total;
  };
  walk(cell, 0);
  return found >= 0 ? found : null;
}

/**
 * Aktuelle DOM-Selektion in der Zelle -> Raw-Offsets.
 * Nutzt die toRaw-Map aus renderInlineMd(raw) der Zelle.
 */
export function domSelectionToRaw(cell, toRaw) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!cell.contains(range.startContainer) || !cell.contains(range.endContainer)) return null;
  const startVis = renderedOffset(cell, range.startContainer, range.startOffset);
  const endVis = renderedOffset(cell, range.endContainer, range.endOffset);
  if (startVis == null || endVis == null) return null;
  const clamp = (idx) => Math.max(0, Math.min(idx, toRaw.length - 1));
  // Start = Raw-Idx des ersten sichtbaren Zeichens; Ende = Raw-Idx HINTER dem
  // letzten sichtbaren Zeichen (sonst wuerde die Grenze auf evtl. folgende
  // Marker bzw. das naechste Zeichen zeigen).
  const start = toRaw[clamp(startVis)];
  const end = endVis === 0 ? toRaw[0] : toRaw[clamp(endVis - 1)] + 1;
  return { start, end };
}

function locateRenderedPos(cell, pos) {
  let total = 0;
  let result = null;
  const walk = (el) => {
    for (const child of el.childNodes) {
      if (result) return;
      if (child.nodeType === Node.TEXT_NODE) {
        const len = child.nodeValue.length;
        if (pos <= total + len) {
          result = { node: child, offset: pos - total };
          return;
        }
        total += len;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName === 'BR') {
          if (pos === total) {
            const idx = [...el.childNodes].indexOf(child);
            result = { node: el, offset: idx };
            return;
          }
          total += 1;
        } else {
          walk(child);
        }
      }
    }
  };
  walk(cell);
  if (result) return result;
  // Fallback: ans Ende des letzten Textknotens
  const last = cell.lastChild;
  if (last?.nodeType === Node.TEXT_NODE) return { node: last, offset: last.nodeValue.length };
  return { node: cell, offset: cell.childNodes.length };
}

/** Aktuelle DOM-Selektion in der Zelle als sichtbare Offsets. */
export function domSelectionToRendered(cell) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!cell.contains(range.startContainer) || !cell.contains(range.endContainer)) return null;
  const start = renderedOffset(cell, range.startContainer, range.startOffset);
  const end = renderedOffset(cell, range.endContainer, range.endOffset);
  if (start == null || end == null) return null;
  return { start, end };
}

/** Sichtbare Zeichen der Zelle (BR zaehlt als 1). */
export function renderedLength(cell) {
  return cell ? nodeTextLen(cell) : 0;
}

/** Setzt die DOM-Selektion auf sichtbare Offsets (Caret bei start === end). */
export function selectRenderedRange(cell, start, end = start) {
  const a = locateRenderedPos(cell, Math.max(0, start));
  const b = locateRenderedPos(cell, Math.max(0, end));
  const sel = window.getSelection();
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Setzt die DOM-Selektion auf einen Raw-Bereich (via toRendered-Map). */
export function selectRawRange(cell, toRendered, startRaw, endRaw) {
  const startVis = toRendered[Math.max(0, Math.min(startRaw, toRendered.length - 1))];
  const endVis = toRendered[Math.max(0, Math.min(endRaw, toRendered.length - 1))];
  const start = locateRenderedPos(cell, startVis);
  const end = locateRenderedPos(cell, endVis);
  const sel = window.getSelection();
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}
