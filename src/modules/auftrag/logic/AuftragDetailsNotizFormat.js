// Auswahl in der Auftragsnotiz fett oder kursiv setzen.
// Gespeichert wird die gleiche Mini-Markdown-Schreibweise wie im Skript-Editor.

import {
  domSelectionToRaw,
  htmlToInlineMd,
  renderInlineMd,
  selectRawRange,
  toggleInlineFormat
} from '../../../core/utils/inlineFormat.js';
import { prepareNotizText } from './AuftragDetailsNotizText.js';

export function applyNotizFormat(raw, start, end, format) {
  const toggled = toggleInlineFormat(raw, start, end, format);
  const prepared = prepareNotizText(toggled.text);
  return {
    text: prepared.text,
    start: Math.min(toggled.start, prepared.text.length),
    end: Math.min(toggled.end, prepared.text.length),
    limited: prepared.limited
  };
}

/** Aktuelle Auswahl formatieren. Ohne Auswahl bleibt der Text unverändert. */
export function formatEditorSelection(el, format) {
  const raw = htmlToInlineMd(el);
  const current = renderInlineMd(raw);
  const offsets = domSelectionToRaw(el, current.toRaw);
  if (!offsets || offsets.start === offsets.end) return null;
  const applied = applyNotizFormat(raw, offsets.start, offsets.end, format);
  if (applied.text === raw) return null;
  const next = renderInlineMd(applied.text);
  return {
    text: applied.text,
    html: next.html,
    toRendered: next.toRendered,
    start: applied.start,
    end: applied.end,
    limited: applied.limited
  };
}

export function writeEditorHtml(el, text) {
  if (!text) {
    el.innerHTML = '';
    el.classList.add('is-empty');
    return;
  }
  el.classList.remove('is-empty');
  el.innerHTML = renderInlineMd(text).html;
}

/** Auswahl formatieren und im Feld stehen lassen. Ohne Auswahl passiert nichts. */
export function applyFormatToEditor(el, format) {
  const result = formatEditorSelection(el, format);
  if (!result) return null;
  el.innerHTML = result.html;
  el.classList.toggle('is-empty', !result.text);
  selectRawRange(el, result.toRendered, result.start, result.end);
  return result;
}

export function formatFromShortcut(event) {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null;
  return { b: 'bold', i: 'italic' }[event.key.toLowerCase()] || null;
}

export function insertPlainTextAtSelection(el, text) {
  const sel = window.getSelection();
  if (!text || !sel?.rangeCount || !el?.contains(sel.anchorNode)) return false;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}
