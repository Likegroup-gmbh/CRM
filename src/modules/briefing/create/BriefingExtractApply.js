// BriefingExtractApply.js
// Übernimmt Likys Extrakt ins Briefing-Formular: formData zuerst, dann neu rendern,
// danach markiert der ExtractReviewLayer die sichtbaren Felder.
// Die Instanz lebt am BriefingLikyPanel und übersteht Step-Renders (aiFill bleibt).
//
// Claude liefert Werte nicht immer in der Shape der Widgets (Wrapper { value, kind },
// Listen als Text, Videolänge als "mind. 30 Sek."). normalizeValue bringt alles auf die
// Form, die FieldRenderer rendert und saveCurrentStepData wieder einsammelt.
// Produkte: neue werden angehängt, vorhandene Einträge bleiben (der Produkt-Sync legt an).

import { ExtractReviewLayer } from '../../../core/form/ai/ExtractReviewLayer.js';
import { videolaengeOderNull, mindestlaengeOderNull, videolaengeAusAlt } from '../videolaenge.js';
import { ideenListe } from '../ideenSplit.js';
import { findeDublette, PRODUKT_EINGABE } from './briefingProduktSync.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEXT_TYPEN = new Set(['text', 'textarea', 'url', 'date']);

/** Alte Jobs / Modelle liefern fields als JSON-String oder Array. */
export function coerceFieldMap(value) {
  if (value == null) return {};
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (_) {
      return {};
    }
  }
  if (Array.isArray(parsed)) {
    const out = {};
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const named = String(item.name || item.key || '').trim();
      if (named) {
        const { name: _n, key: _k, ...rest } = item;
        out[named] = rest;
        continue;
      }
      const keys = Object.keys(item).filter((k) => !['kind', 'from', 'value', 'force'].includes(k));
      if (keys.length === 1) out[keys[0]] = item[keys[0]];
    }
    return out;
  }
  if (parsed && typeof parsed === 'object') return parsed;
  return {};
}

/** { value, kind, from, force }-Wrapper auspacken (Chat-Patches). */
function unwrapEntry(entry) {
  if (entry && typeof entry === 'object' && !Array.isArray(entry) && 'value' in entry) {
    return entry.value;
  }
  return entry;
}

function asText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join('\n');
  if (typeof value === 'object') return asText(value.label ?? value.text ?? value.value ?? '');
  return String(value);
}

function asDate(value) {
  const text = asText(value).trim();
  if (!text) return '';
  const de = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) return `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function matchOption(options, raw) {
  const lower = asText(raw).trim().toLowerCase();
  if (!lower) return null;
  const hit = (options || []).find(
    (o) => String(o.value).toLowerCase() === lower || String(o.label).toLowerCase() === lower
  );
  return hit ? hit.value : null;
}

function asOptionList(field, value) {
  const items = Array.isArray(value) ? value : [value];
  return [...new Set(items.map((item) => matchOption(field.options, item)).filter(Boolean))];
}

function asVideolaenge(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const minimum = value.minimum ?? value.mindestlaenge ?? value.min;
    if (minimum != null) return mindestlaengeOderNull(minimum, null);
    return videolaengeOderNull(value.von, value.bis ?? null);
  }
  const text = asText(value);
  const min = text.match(/(?:mind(?:estens|\.)?|ab|min(?:imum)?\.?)\s*(\d+)/i);
  if (min) return mindestlaengeOderNull(min[1], null);
  return videolaengeAusAlt({ videolaenge_text: text });
}

function asIdeen(value) {
  const items = Array.isArray(value) ? value : [value];
  const out = [];
  for (const item of items) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const text = asText(item.text ?? item.value).trim();
      if (text) out.push({ text, verbindlich: item.verbindlich === true || item.verbindlich === 'true' });
      continue;
    }
    for (const text of ideenListe(asText(item))) out.push({ text, verbindlich: false });
  }
  return out;
}

function asProdukte(value) {
  const items = Array.isArray(value) ? value : [value];
  return items
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => Object.fromEntries(PRODUKT_EINGABE.map((f) => [f, asText(item[f]).trim()])))
    .filter((p) => p.name || p.url);
}

/**
 * Wert auf die Shape bringen, die FieldRenderer/saveCurrentStepData erwarten.
 * Gibt null zurück, wenn nichts Verwertbares dabei ist.
 */
export function normalizeValue(field, raw) {
  const value = unwrapEntry(raw);
  if (value == null) return null;

  switch (field.type) {
    case 'date':
      return asDate(value) || null;
    case 'checkbox':
      return value === true || value === 'true';
    case 'checkboxes': {
      const list = asOptionList(field, value);
      return list.length ? list : null;
    }
    case 'videolaenge':
      return asVideolaenge(value);
    case 'ideenListe': {
      const list = asIdeen(value);
      return list.length ? list : null;
    }
    case 'produktListe': {
      const list = asProdukte(value);
      return list.length ? list : null;
    }
    case 'entitySelect':
      // Extract/Chat liefern Namen, keine IDs - nicht raten
      return UUID_RE.test(asText(value).trim()) ? asText(value).trim() : null;
    default: {
      const text = asText(value).trim();
      return text || null;
    }
  }
}

function istLeer(value) {
  if (value == null || value === false) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) {
    return value.every((item) => (item && typeof item === 'object')
      ? Object.entries(item).every(([k, v]) => k === 'verbindlich' || v == null || String(v).trim() === '')
      : String(item ?? '').trim() === '');
  }
  if (typeof value === 'object') return Object.values(value).every((v) => v == null || v === '');
  return false;
}

function eintragInfo(entry, fallbackFrom = null) {
  const obj = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
  return { kind: obj.kind === 'guess' ? 'guess' : 'fact', from: obj.from || fallbackFrom };
}

export class BriefingExtractApply {
  constructor(briefingCreate) {
    this.briefing = briefingCreate;
    this.form = null;
    this.review = null;
    // name -> { from, kind } für die Markierung (übersteht Step-Renders)
    this.aiFill = new Map();
  }

  setForm(form) {
    this.form = form;
    this.review = form ? new ExtractReviewLayer(form) : null;
  }

  /** Produkte aus dem Extrakt anhängen, die noch nicht in der Liste stehen. @returns {number} neue */
  ergaenzeProdukte(neue) {
    const vorhanden = (this.briefing.formData.produkte || []).filter((p) => !istLeer([p]) || p.produkt_id);
    const dazu = neue.filter((p) => !findeDublette(vorhanden, p));
    this.briefing.formData.produkte = [...vorhanden, ...dazu];
    return dazu.length;
  }

  /**
   * Extrahierte Felder in formData schreiben. Nur leere Felder - was der
   * Nutzer selbst ausgefüllt hat, bleibt stehen.
   * @returns {{ applied: string[], skipped: string[] }}
   */
  apply(fields, spec) {
    const applied = [];
    const skipped = [];
    const specByName = new Map(spec.map((f) => [f.name, f]));

    for (const [name, entry] of Object.entries(coerceFieldMap(fields))) {
      const specField = specByName.get(name);
      if (!specField || entry == null) continue;
      const value = normalizeValue(specField, entry);
      if (value == null || value === false) continue;

      if (specField.type === 'produktListe') {
        if (this.ergaenzeProdukte(value)) {
          this.aiFill.set(name, eintragInfo(entry));
          applied.push(specField.label || name);
        }
        continue;
      }
      if (!istLeer(this.briefing.formData[name])) {
        skipped.push(specField.label || name);
        continue;
      }
      this.briefing.formData[name] = value;
      if (specField.type === 'videolaenge') this.briefing.formData[`${name}_modus`] = null;
      this.aiFill.set(name, eintragInfo(entry));
      applied.push(specField.label || name);
    }
    return { applied, skipped };
  }

  /** Chat-Patches: dürfen vorhandene Werte ändern (explizite Steuerung). */
  applyPatches(patches, spec) {
    const applied = [];
    const specByName = new Map(spec.map((f) => [f.name, f]));

    for (const [name, entry] of Object.entries(coerceFieldMap(patches))) {
      const specField = specByName.get(name);
      if (!specField || entry == null) continue;
      const value = normalizeValue(specField, entry);
      if (value == null) continue;
      if (specField.type === 'produktListe') {
        this.ergaenzeProdukte(value);
      } else {
        this.briefing.formData[name] = value;
        if (specField.type === 'videolaenge') this.briefing.formData[`${name}_modus`] = null;
      }
      this.aiFill.set(name, eintragInfo(entry, 'Chat'));
      applied.push(specField.label || name);
    }
    return { applied };
  }

  /** Neu rendern und die sichtbaren Felder markieren. */
  renderAndMark() {
    this.briefing.render();
    this.setForm(document.getElementById('briefing-form'));
    this.markVisible();
  }

  /** Felder des aktuellen Steps markieren (nach jedem Step-Render aufrufen). */
  markVisible() {
    if (!this.form || !this.review) return;
    for (const [name, entry] of this.aiFill) {
      const input = this.review.findInput(name);
      if (input && TEXT_TYPEN.has(input.type)) {
        // mark() schreibt den Wert selbst ins Feld - also aus formData mitgeben
        this.review.mark(name, { ...entry, value: this.briefing.formData[name] });
      } else {
        this.markiereWrapper(name, entry);
      }
    }
  }

  /** Checkboxen, Listen, Videolänge: nur markieren, Werte stehen schon im DOM. */
  markiereWrapper(name, entry) {
    const anker = this.form.querySelector(
      `[data-videolaenge="${name}"], [data-ideenliste="${name}"], [data-produktliste="${name}"], [name="${name}"]`
    );
    const wrapper = anker?.closest('.form-field');
    if (!wrapper || wrapper.classList.contains('ai-filled')) return;
    wrapper.classList.add('ai-filled', entry.kind === 'guess' ? 'ai-filled--guess' : 'ai-filled--fact');
    (this.review.labelOf(wrapper) || wrapper).appendChild(this.review.buildBadge(entry.kind, entry.from));
  }
}
