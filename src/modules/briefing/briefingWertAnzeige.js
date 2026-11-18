// briefingWertAnzeige.js
// Ein Briefing-Wert als HTML für Dokument, Creator-PDF und „Frühere Angaben“.
// Kennt die Feldtypen des Creator-Briefings und die der Altfelder. Leer heißt null.

import { formatVideolaenge, tokenLabel } from './videolaenge.js';
import { groupAnzeigeZeilen, FUNNEL_STUFEN_OPTIONS } from './briefingAltfelder.js';

const URL_RE = /^https?:\/\/\S+$/i;

export function tagsHtml(labels, escape) {
  return labels.map(l => `<span class="tag tag--type">${escape(l)}</span>`).join(' ');
}

const tags = tagsHtml;

function linkOderText(text, escape) {
  const t = String(text ?? '').trim();
  if (URL_RE.test(t)) return `<a href="${escape(t)}" target="_blank" rel="noopener">${escape(t)}</a>`;
  return escape(t);
}

function videolaenge(value, escape) {
  if (!value || typeof value !== 'object') return null;
  if (value.art === 'intervall' || value.art === 'minimum') {
    const text = formatVideolaenge(value.von, value.bis);
    return text ? escape(text) : null;
  }
  if (value.art === 'tokens') {
    if (!Array.isArray(value.values) || !value.values.length) return null;
    return tags(value.values.map(tokenLabel), escape);
  }
  if (value.art === 'text') return escape(value.text);
  return null;
}

function funnelVideolaenge(value, escape) {
  if (typeof value !== 'object') return null;
  const zeilen = FUNNEL_STUFEN_OPTIONS
    .map(opt => ({ label: opt.label, text: formatVideolaenge(value[opt.value]?.von, value[opt.value]?.bis) }))
    .filter(z => z.text)
    .map(z => `<strong>${escape(z.label)}:</strong> ${escape(z.text)}`);
  return zeilen.length ? zeilen.join('<br>') : null;
}

function ideenListe(value, escape) {
  if (!Array.isArray(value) || !value.length) return null;
  const zeilen = value.map((e) => {
    const text = typeof e === 'string' ? e : e?.text;
    if (!String(text ?? '').trim()) return null;
    const art = e?.verbindlich ? 'Verbindlich' : 'Inspiration';
    return `<span class="tag ${e?.verbindlich ? 'tag--type' : 'tag--muted'}">${art}</span> ${linkOderText(text, escape)}`;
  }).filter(Boolean);
  return zeilen.length ? zeilen.join('<br>') : null;
}

function channelGroup(field, value, escape) {
  if (typeof value !== 'object') return null;
  const parts = [];
  for (const channel of field.channels || []) {
    const cv = value[channel.key];
    if (cv === true) {
      parts.push(tags([channel.label], escape));
    } else if (Array.isArray(cv) && cv.length) {
      const formate = cv.map(f => channel.formats?.find(o => o.value === f)?.label || f);
      parts.push(`<strong>${escape(channel.label)}:</strong> ${tags(formate, escape)}`);
    }
  }
  if (value.weitere) parts.push(`<strong>Weitere:</strong> ${escape(value.weitere)}`);
  return parts.length ? parts.join('<br>') : null;
}

function uploads(value, escape) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const links = value.map((entry, i) => {
    if (entry.typ === 'upload' && entry.value) {
      const { data } = window.supabase?.storage.from('documents').getPublicUrl(entry.value) || {};
      const url = data?.publicUrl || '#';
      return `<a href="${url}" target="_blank" rel="noopener">${escape(entry.label || `Datei ${i + 1}`)}</a>`;
    }
    return entry.value ? linkOderText(entry.value, escape) : null;
  }).filter(Boolean);
  return links.length ? links.join('<br>') : null;
}

/**
 * @param {object} field Feld aus briefingFelder.json oder briefingAltfelder.js
 * @param {unknown} value
 * @param {{ escape: (s: unknown) => string, formatDate: (d: string) => string }} fmt
 * @returns {string|null}
 */
export function formatBriefingWert(field, value, { escape, formatDate }) {
  if (value === null || value === undefined || value === '') return null;

  switch (field.type) {
    case 'checkbox':
      return value ? 'Ja' : null;
    case 'date':
      return formatDate(value);
    case 'url':
      return `<a href="${escape(value)}" target="_blank" rel="noopener">Link</a>`;
    case 'radio': {
      const opt = field.options?.find(o => String(o.value) === String(value));
      return escape(opt?.label || value);
    }
    case 'funnelVideolaenge':
      return funnelVideolaenge(value, escape);
    case 'videolaenge':
    case 'sekundenSpanne':
      return videolaenge(value, escape);
    case 'checkboxes':
    case 'customMulti': {
      if (!Array.isArray(value) || value.length === 0) return null;
      return tags(value.map(v => field.options?.find(o => o.value === v)?.label || v), escape);
    }
    case 'group': {
      if (typeof value !== 'object') return null;
      const parts = groupAnzeigeZeilen(field, value)
        .map(row => `<strong>${escape(row.label)}:</strong> ${escape(row.text)}`);
      return parts.length ? parts.join('<br>') : null;
    }
    case 'channelGroup':
      return channelGroup(field, value, escape);
    case 'ideenListe':
      return ideenListe(value, escape);
    case 'repeatableText': {
      if (!Array.isArray(value) || value.length === 0) return null;
      return value.map(v => `• ${escape(v)}`).join('<br>');
    }
    case 'repeatableUpload':
      return uploads(value, escape);
    default:
      return typeof value === 'object' ? null : escape(value);
  }
}
