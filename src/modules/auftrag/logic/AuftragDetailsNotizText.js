// Text der Auftragsnotiz: Grenze, Kürzung, Links und die Darstellung von Fett und Kursiv.
// Ohne DOM und ohne Speichern.

import { renderInlineMd } from '../../../core/utils/inlineFormat.js';

export const NOTIZ_MAX = 10000;
export const NOTIZ_PLACEHOLDER = 'Notiz zum Auftrag';
export const NOTIZ_IDLE_MS = 1000;
export const NOTIZ_SAVED_MS = 1600;

export function prepareNotizText(raw) {
  const text = String(raw ?? '').replace(/\r\n/g, '\n');
  if (text.length > NOTIZ_MAX) {
    return { text: text.slice(0, NOTIZ_MAX), limited: true };
  }
  return { text, limited: text.length >= NOTIZ_MAX };
}

/** Gespeicherter Stand: Anfang und Ende ohne Leerzeichen. Innen bleiben Zeilenumbrüche. */
export function canonicalNotiz(raw) {
  return prepareNotizText(raw).text.trim();
}

export function canSeeAuftragNotiz() {
  if (window.isInvestor?.() === true) return false;
  return window.isAdmin?.() === true || window.isMitarbeiter?.() === true;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function splitUrl(found) {
  let body = found;
  let trail = '';
  const punctuation = body.match(/[.,;:!?)]+$/);
  if (punctuation) {
    trail = punctuation[0];
    body = body.slice(0, -trail.length);
  }
  return { body, trail, href: httpUrl(body) };
}

function httpUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Klartext zu HTML. Nur http- und https-Adressen werden Links, jeder in einem neuen Tab. */
export function linkifyNotizHtml(raw) {
  const text = String(raw ?? '');
  const re = /https?:\/\/[^\s<>"']+/gi;
  let html = '';
  let last = 0;
  for (const match of text.matchAll(re)) {
    const found = match[0];
    const index = match.index ?? 0;
    const { body, trail, href } = splitUrl(found);
    html += escapeHtml(text.slice(last, index));
    if (href) {
      html += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(body)}</a>`;
      html += escapeHtml(trail);
    } else {
      html += escapeHtml(found);
    }
    last = index + found.length;
  }
  html += escapeHtml(text.slice(last));
  return html;
}

/**
 * Gespeicherter Text als HTML: **fett**, *kursiv* und http(s)-Links.
 * Marker, die eine Adresse umschließen, bleiben Format. Fremdes HTML bleibt Text.
 */
export function renderNotizHtml(raw) {
  const text = String(raw ?? '');
  const urls = [];
  const marked = text.replace(/https?:\/\/[^\s<>"'`*]+/gi, (found) => {
    const { body, trail, href } = splitUrl(found);
    if (!href) return found;
    const token = `\u0000${urls.length}\u0000`;
    urls.push({ href, label: body });
    return token + trail;
  });
  let html = renderInlineMd(marked).html;
  urls.forEach((url, index) => {
    const token = `\u0000${index}\u0000`;
    const anchor = `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url.label)}</a>`;
    html = html.split(token).join(anchor);
  });
  return html;
}

export function formatNotizZeit(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const tag = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
  const uhr = new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
  return `${tag}, ${uhr}`;
}

export function formatNotizMeta(name, iso) {
  const zeit = formatNotizZeit(iso);
  if (!zeit) return '';
  const who = String(name || '').trim() || 'Unbekannt';
  return `Zuletzt geändert von ${who} am ${zeit}.`;
}

export function formatNotizKonflikt(name, iso) {
  const who = String(name || '').trim() || 'Unbekannt';
  const zeit = formatNotizZeit(iso);
  if (!zeit) return `Inzwischen geändert von ${who}.`;
  return `Inzwischen geändert von ${who} am ${zeit}.`;
}
