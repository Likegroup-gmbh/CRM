// inlineFormat.js
// Mini-Markdown fuer Inline-Formatierung (**fett**, *kursiv*, `code`) mit
// WYSIWYG-Bruecke: Rendert nach HTML inkl. Offset-Maps (sichtbarer Text <->
// Raw-String) und serialisiert contenteditable-HTML zurueck nach Markdown.
// Fachlich ungebunden - Skript-Editor und spaetere Stellen teilen sich das.

const MARKER = { bold: '**', italic: '*' };

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Parser (Raw-String -> Token-Baum, absolute Offsets) ----------

const OPEN_TAGS = { bold: '<strong>', italic: '<em>', bolditalic: '<strong><em>', code: '<code>' };
const CLOSE_TAGS = { bold: '</strong>', italic: '</em>', bolditalic: '</em></strong>', code: '</code>' };

function parseInline(raw, start, end, tokens) {
  let i = start;
  let litStart = start;
  while (i < end) {
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
    if (type !== 'code') parseInline(raw, token.contentStart, token.contentEnd, token.children);
    tokens.push(token);
    i = token.end;
    litStart = i;
  }
  if (litStart < end) tokens.push({ type: 'text', start: litStart, end });
}

// ---------- Renderer: Raw -> HTML + Offset-Maps ----------

/**
 * @param {string} raw Markdown-String
 * @returns {{ html: string, toRaw: number[], toRendered: number[] }}
 *   toRaw[sichtbarerIdx] = rawIdx (inkl. Sentinel: toRaw[len] = raw.length),
 *   toRendered[rawIdx] = sichtbarerIdx (Marker zeigen auf die Inhaltsposition).
 */
export function renderInlineMd(raw) {
  const text = String(raw ?? '');
  const tokens = [];
  parseInline(text, 0, text.length, tokens);

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
      html += OPEN_TAGS[t.type];
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
