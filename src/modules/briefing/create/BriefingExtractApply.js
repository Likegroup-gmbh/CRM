// BriefingExtractApply.js
// Uebernimmt Likys Extrakt ins Briefing-Formular. Anders als am Produkt
// (DOM-zuerst) wird hier formData zuerst geschrieben und das Formular dann
// neu gerendert - die Custom-Widgets (entitySelect, repeatableKpi,
// channelGroup) lassen sich nicht sinnvoll ueber DOM-Events befuellen.
// Danach markiert der ExtractReviewLayer die sichtbaren Felder.
//
// Die Instanz lebt am BriefingLikyPanel und uebersteht Step-Renders:
// aiFill bleibt erhalten, setForm/markVisible werden nach jedem Render
// erneut aufgerufen.
//
// Wichtig: Claude liefert die Werte nicht immer in der Shape, die die
// Widgets erwarten (KPIs als { kpi, ziel }, Channels als
// [{ format, anzahl, vorgaben }], Chat-Patches als { value, kind }-Wrapper).
// normalizeValue bringt alles auf die Form, die FieldRenderer rendert und
// saveCurrentStepData wieder einsammelt. Ohne das landet "[object Object]"
// in Textfeldern und die Widgets zeigen leer, obwohl formData voll ist.

import { ExtractReviewLayer } from '../../../core/form/ai/ExtractReviewLayer.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** { value, kind, from, force }-Wrapper auspacken (Chat-Patches). */
function unwrapEntry(entry) {
  if (entry && typeof entry === 'object' && !Array.isArray(entry) && 'value' in entry) {
    return entry.value;
  }
  return entry;
}

function asText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean).join('\n');
  }
  if (typeof value === 'object') {
    // { label: ... } oder Reste eines Wrappers - nie "[object Object]"
    return asText(value.label ?? value.text ?? value.value ?? '');
  }
  return String(value);
}

function asDate(value) {
  const text = asText(value).trim();
  if (!text) return '';
  // ISO passt direkt, deutsches Datum (17.11.2026) wird umgedreht
  const de = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) return `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`;
  return text;
}

/** Wert auf einen der bekannten Option-values mappen (Label oder value). */
function matchOption(options, raw) {
  const text = asText(raw).trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const hit = (options || []).find(
    (o) => String(o.value).toLowerCase() === lower || String(o.label).toLowerCase() === lower
  );
  return hit ? hit.value : null;
}

function asOptionValue(field, value) {
  // Boolean-Radios (true/false-Optionen) als echte Booleans
  const isBooleanRadio = field.type === 'radio'
    && Array.isArray(field.options) && field.options.length > 0
    && field.options.every((o) => o.value === 'true' || o.value === 'false');
  if (isBooleanRadio) {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return null;
  }
  return matchOption(field.options, value);
}

function asOptionList(field, value) {
  const items = Array.isArray(value) ? value : [value];
  const known = new Set((field.options || []).map((o) => String(o.value)));
  const out = [];
  for (const item of items) {
    const matched = matchOption(field.options, item);
    if (matched) {
      out.push(matched);
    } else if (field.type === 'customMulti') {
      // Freitext bleibt bei customMulti erhalten (eigenes Eingabefeld)
      const text = asText(item).trim();
      if (text && !known.has(text)) out.push(text);
    }
    // bei checkboxes: Unbekanntes verwerfen, sonst haengt es unsichtbar im Wert
  }
  return [...new Set(out)];
}

function asKpiList(field, value) {
  const items = Array.isArray(value) ? value : [];
  const out = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const kpi = matchOption(field.kpiOptions, item.kpi) || asText(item.kpi).trim();
    // Claude schreibt den Zielwert gern als "ziel" oder "wert"
    const zielwert = asText(item.zielwert ?? item.ziel ?? item.wert ?? item.target).trim();
    if (kpi || zielwert) out.push({ kpi, zielwert });
  }
  return out;
}

function asChannelGroup(field, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const channel of field.channels || []) {
    const raw = value[channel.key];
    if (raw == null || raw === false) continue;
    if (!channel.formats) {
      // Toggle-Plattform ohne Unterformate
      if (raw === true || (Array.isArray(raw) && raw.length) || (typeof raw === 'object' && Object.keys(raw).length)) {
        out[channel.key] = true;
      }
      continue;
    }
    // Claude liefert gern [{ format, anzahl, vorgaben }] statt ['reel'],
    // der Chat schickt { active: true, formats: ['reel'] }
    const items = Array.isArray(raw)
      ? raw
      : (raw && typeof raw === 'object' && Array.isArray(raw.formats) ? raw.formats : [raw]);
    const formats = [];
    for (const item of items) {
      const candidate = item && typeof item === 'object' ? (item.format ?? item.value ?? item.key) : item;
      const matched = matchOption(channel.formats, candidate);
      if (matched) formats.push(matched);
    }
    if (formats.length) out[channel.key] = [...new Set(formats)];
  }
  const weitere = asText(value.weitere).trim();
  if (weitere) out.weitere = weitere;
  return Object.keys(out).length ? out : null;
}

function asGroup(field, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const sub of field.fields || []) {
    out[sub.name] = asText(value[sub.name]);
  }
  return Object.values(out).some((v) => v.trim()) ? out : null;
}

function asTextList(value) {
  const items = Array.isArray(value) ? value : [value];
  return items.map(asText).map((s) => s.trim()).filter(Boolean);
}

function asUploadList(value) {
  const items = Array.isArray(value) ? value : [];
  const out = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const url = asText(item.value ?? item.url).trim();
    if (!url) continue;
    out.push({ typ: 'url', value: url });
  }
  return out;
}

/**
 * Wert auf die Shape bringen, die FieldRenderer/saveCurrentStepData erwarten.
 * Gibt null zurueck, wenn nichts Verwertbares dabei ist.
 */
export function normalizeValue(field, raw) {
  const value = unwrapEntry(raw);
  if (value == null) return null;

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'url': {
      const text = asText(value).trim();
      return text || null;
    }
    case 'date': {
      const date = asDate(value);
      return date || null;
    }
    case 'checkbox':
      return value === true || value === 'true';
    case 'radio':
      return asOptionValue(field, value);
    case 'checkboxes':
    case 'customMulti': {
      const list = asOptionList(field, value);
      return list.length ? list : null;
    }
    case 'repeatableKpi': {
      const list = asKpiList(field, value);
      return list.length ? list : null;
    }
    case 'repeatableText': {
      const list = asTextList(value);
      return list.length ? list : null;
    }
    case 'repeatableUpload': {
      const list = asUploadList(value);
      return list.length ? list : null;
    }
    case 'channelGroup':
      return asChannelGroup(field, value);
    case 'group':
      return asGroup(field, value);
    case 'entitySelect':
      // Extract/Chat liefern Namen ("FORGEWORKS AG"), keine IDs - nicht raten
      return UUID_RE.test(asText(value).trim()) ? asText(value).trim() : null;
    case 'entityMulti': {
      const ids = (Array.isArray(value) ? value : [value])
        .map((v) => asText(v).trim())
        .filter((v) => UUID_RE.test(v));
      return ids.length ? ids : null;
    }
    default: {
      const text = asText(value).trim();
      return text || null;
    }
  }
}

export class BriefingExtractApply {
  constructor(briefingCreate) {
    this.briefing = briefingCreate;
    this.form = null;
    this.review = null;
    // name -> { from, kind } fuer die Markierung (ueberlebt Step-Renders)
    this.aiFill = new Map();
  }

  setForm(form) {
    this.form = form;
    this.review = form ? new ExtractReviewLayer(form) : null;
  }

  /**
   * Extrahierte Felder in formData schreiben. Nur leere Felder - was der
   * Nutzer selbst ausgefuellt hat, bleibt stehen.
   * @returns {{ applied: string[], skipped: string[] }}
   */
  apply(fields, spec) {
    const applied = [];
    const skipped = [];
    const specByName = new Map(spec.map((f) => [f.name, f]));

    for (const [name, entry] of Object.entries(fields || {})) {
      const specField = specByName.get(name);
      if (!specField || entry?.value == null) continue;

      const value = normalizeValue(specField, entry.value);
      if (value == null) continue;

      const current = this.briefing.formData[name];
      if (!this.isEmpty(current)) {
        skipped.push(specField.label || name);
        continue;
      }

      this.briefing.formData[name] = value;
      this.aiFill.set(name, { from: entry.from || null, kind: entry.kind || 'fact' });
      applied.push(specField.label || name);
    }

    return { applied, skipped };
  }

  /**
   * Bekannte Produkte aus produkte_hint in produkt_ids schreiben.
   * Entity-Felder sind nicht in der Spec - ohne das landen existierende
   * Produkte nie im Formular. Nur wenn produkt_ids noch leer ist.
   * @returns {string[]} Labels der geschriebenen Felder
   */
  applyProduktHints(hints) {
    const ids = [...new Set((hints || [])
      .map((p) => String(p?.produkt_id || '').trim())
      .filter((id) => UUID_RE.test(id)))];
    if (!ids.length) return [];
    if (!this.isEmpty(this.briefing.formData.produkt_ids)) return [];

    this.briefing.formData.produkt_ids = ids;
    this.aiFill.set('produkt_ids', { from: 'PDF', kind: 'fact' });
    return ['Produkte'];
  }

  /** Chat-Patches: duerfen vorhandene Werte aendern (Explizite Steuerung). */
  applyPatches(patches, spec) {
    const applied = [];
    const specByName = new Map(spec.map((f) => [f.name, f]));

    for (const [name, entry] of Object.entries(patches || {})) {
      const specField = specByName.get(name);
      if (!specField || entry == null) continue;

      // Chat schickt { value, kind, from, force } - nur den Wert uebernehmen
      const value = normalizeValue(specField, entry);
      if (value == null) continue;

      this.briefing.formData[name] = value;
      const kind = entry && typeof entry === 'object' && entry.kind === 'guess' ? 'guess' : 'fact';
      const from = entry && typeof entry === 'object' && entry.from ? entry.from : 'Chat';
      this.aiFill.set(name, { from, kind });
      applied.push(specField.label || name);
    }

    return { applied };
  }

  /** Neu rendern und die sichtbaren Felder markieren. */
  renderAndMark() {
    this.briefing.render();
    // render() hat das DOM ersetzt - Referenzen neu holen
    this.setForm(document.getElementById('briefing-form'));
    this.markVisible();
  }

  /** Felder des aktuellen Steps markieren (nach jedem Step-Render aufrufen). */
  markVisible() {
    if (!this.form || !this.review) return;
    for (const [name, entry] of this.aiFill) {
      // mark() schreibt den Wert selbst ins Feld - also aus formData mitgeben
      this.review.mark(name, { ...entry, value: this.briefing.formData[name] });
    }
  }

  isEmpty(value) {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) {
      if (value.length === 0) return true;
      // [{kpi, zielwert}] mit leeren Feldern gilt als leer
      return value.every((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? Object.values(item).every((v) => v == null || String(v).trim() === '')
          : false
      );
    }
    if (typeof value === 'object') {
      return Object.values(value).every((v) => this.isEmpty(v));
    }
    return false;
  }
}
