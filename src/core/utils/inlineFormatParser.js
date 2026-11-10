// inlineFormatParser.js
// Raw-String -> Token-Baum mit absoluten Offsets (Grammatik siehe inlineFormat.js).

import { istHighlightFarbe } from './highlightFarben.js';

const LINK_PROTOKOLL = /^(https?:\/\/|mailto:)/i;

/** Nur http(s) und mailto, ohne Leerzeichen und Klammern. */
export function istSichereLinkUrl(url) {
  const value = String(url ?? '').trim();
  return LINK_PROTOKOLL.test(value) && !/[\s()<>"]/.test(value);
}

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

export function parseTokens(raw, opts) {
  const text = String(raw ?? '');
  const tokens = [];
  parseInline(text, 0, text.length, tokens, opts || {});
  return { text, tokens };
}
