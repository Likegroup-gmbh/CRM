// inlineFormatEdit.js
// Formatierung auf dem Raw-String erkennen, umschalten und in Laeufe zerlegen.

import { istHighlightFarbe } from './highlightFarben.js';
import { istSichereLinkUrl, parseTokens } from './inlineFormatParser.js';

const MARKER = { bold: '**', italic: '*' };

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
