// persona-liky.js
// Chat- und PDF-Extract-Tool, Prompt und Sanitize fuer Liky an der Persona.
// URL-Extract bleibt in extract-specs.js / site-extract.

const { getSpec, buildFieldInstructions } = require('./extract-specs');
const { sanitizePersonaPayload } = require('./produkt-persona');
const { validateSituationen } = require('./audience-situation');
const { extractJson, repairJsonStrings } = require('./anthropic');

const EXTRACT_TOOL = {
  name: 'persona_extract_abgeben',
  description: 'Gibt die aus dem PDF erkannten Persona-Felder plus optionale Audience Situations ab.',
  input_schema: {
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            value: {},
            kind: { type: 'string', enum: ['fact', 'guess'] },
            from: { type: 'string' }
          },
          required: ['value']
        }
      },
      audience_situations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            beschreibung: { type: 'string' }
          },
          required: ['name']
        }
      }
    },
    required: ['fields']
  }
};

const CHAT_TOOL = {
  name: 'persona_chat_abgeben',
  description: 'Antwortet im Chat und liefert Feld-Patches plus optionale Audience Situations.',
  input_schema: {
    type: 'object',
    properties: {
      reply: { type: 'string', description: 'Kurze Antwort an den User, Deutsch.' },
      patches: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            value: {},
            kind: { type: 'string', enum: ['fact', 'guess'] },
            from: { type: 'string' },
            force: { type: 'boolean' }
          },
          required: ['value']
        }
      },
      audience_situations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            beschreibung: { type: 'string' }
          },
          required: ['name']
        }
      }
    },
    required: ['reply']
  }
};

function fieldCatalog() {
  const spec = getSpec('persona');
  return spec.fields.map((f) => {
    const art = f.kind === 'fact' ? 'BELEGBAR' : 'ABGELEITET';
    return `- "${f.name}" (${f.label}, ${art}): ${f.hint}`;
  }).join('\n');
}

function buildExtractPrompt() {
  const spec = getSpec('persona');
  const stable = 'Du bist Liky, der KI-Assistent im CRM. Du liest ein PDF '
    + 'und fuellst das Persona-Formular vor. Antworte ausschliesslich ueber das Tool '
    + '"persona_extract_abgeben". Deutsch. Keine Floskeln. '
    + 'Eine Persona ist ein Typ Mensch, keine Zielgruppe und kein Produkt.';

  let task = '# AUFTRAG\n'
    + 'Lies das PDF und belege die Felder. Nur was das Dokument hergibt. '
    + 'Nichts erfinden. Formular ist Deutsch.\n\n';
  task += '# FELDER\n' + buildFieldInstructions(spec) + '\n\n';
  task += '# REGELN\n'
    + '- fields: Objekt Feldname -> { value, kind, from }. Nur Felder, die im PDF '
    + 'belegt oder nachvollziehbar ableitbar sind. kind=fact wenn direkt im Text, '
    + 'kind=guess wenn abgeleitet. from = kurzer Quellverweis (Seite/Abschnitt).\n'
    + '- audience_situations: 2 bis 4 konkrete Empfangsmomente der Person, '
    + 'keine Produkt-Use-Cases. Nur setzen wenn das PDF dafuer eine Grundlage hat. '
    + 'Sonst weglassen.\n';

  return { stable, task };
}

function buildChatPrompt({ history, formData, userText }) {
  const stable = 'Du bist Liky, der KI-Assistent im CRM. Du fuellst das Persona-Formular. '
    + 'Antworte ausschliesslich ueber das Tool "persona_chat_abgeben". Deutsch. Knapp. '
    + 'Eine Persona ist ein Typ Mensch, keine Zielgruppe und kein Produkt.';

  let task = '# FELDER\n' + fieldCatalog() + '\n\n';
  task += 'Aktueller Formularstand: ' + JSON.stringify(formData || {}, null, 2) + '\n\n';
  if (history?.length) {
    task += 'Chat-Verlauf:\n';
    for (const msg of history.slice(-10)) {
      task += `${msg.rolle}: ${msg.inhalt}\n`;
    }
    task += '\n';
  }
  task += `User: ${userText}\n\n`;
  task += '# REGELN\n'
    + '- reply: deine Antwort an den User. Ein Reply ohne patches aendert das Formular nicht.\n'
    + '- patches: jedes Feld, das sich aendern soll, als { value, kind, from }. '
    + 'Ein Aenderungswunsch ohne patches ist wirkungslos. force setzt der Server.\n'
    + '- alter_von und alter_bis immer zusammen. Fehlt eine konkrete Zahl '
    + '(z.B. "zu alt"), waehle eine passende juengere Spanne und nenne die Annahme im reply.\n'
    + '- Wenn Name oder Alter sich aendern, schreib im selben Patch jedes Textfeld um, '
    + 'das den alten Namen oder das alte Alter noch behauptet: beschreibung, oberbegriff, '
    + 'beruf. lebenssituation nur, wenn die Kategorie nicht mehr passt. Sonst nichts erfinden '
    + 'und keine anderen Felder anfassen.\n'
    + '- Selects nur mit den exakten Optionen: geschlecht "Weiblich"|"Männlich"|"Divers"|"Gemischt", '
    + 'budgetrahmen "niedrig"|"mittel"|"hoch", lebenssituation "Single"|"Familie"|"Paar ohne Kinder"|'
    + '"Alleinerziehend"|"Student/in"|"Rentner/in"|"Mensch mit Behinderung"|"WG / Wohngemeinschaft".\n'
    + '- audience_situations: 2 bis 4 konkrete Empfangsmomente der Person, '
    + 'keine Produkt-Use-Cases. Nur setzen wenn noch keine da sind oder der User '
    + 'neue will. Sonst weglassen.\n';

  return { stable, task };
}

function patchValue(entry) {
  if (entry && typeof entry === 'object' && 'value' in entry) return entry.value;
  return entry;
}

// Modelle liefern offene Maps gelegentlich als JSON-String oder als Array
// (die API validiert tool_use.input nicht gegen input_schema).
function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_) { /* weiter */ }
  try {
    return JSON.parse(repairJsonStrings(value));
  } catch (_) { /* weiter */ }
  try {
    return extractJson(value);
  } catch (_) {
    return null;
  }
}

const PATCH_META = new Set(['kind', 'from', 'value', 'force']);

function mapFromArray(items) {
  const out = {};
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const keys = Object.keys(item).filter((k) => !PATCH_META.has(k));
    if (keys.length === 1) {
      const only = keys[0];
      const asLabel = (only === 'name' || only === 'key')
        && typeof item[only] === 'string'
        && 'value' in item;
      if (!asLabel) {
        out[only] = item[only];
        continue;
      }
    }
    const named = typeof item.name === 'string'
      ? item.name.trim()
      : (typeof item.key === 'string' ? item.key.trim() : '');
    if (!named) continue;
    const { name: _n, key: _k, ...rest } = item;
    if (!Object.keys(rest).length) continue;
    out[named] = rest;
  }
  return out;
}

function coercePatchMap(value) {
  if (value == null) return {};
  const parsed = parseMaybeJson(value);
  if (parsed == null) return {};
  if (Array.isArray(parsed)) return mapFromArray(parsed);
  if (typeof parsed === 'object') return parsed;
  return {};
}

/** Nur bekannte Persona-Felder, mit force/kind aus dem Tool-Call. */
function sanitizePatches(raw, { defaultFrom = 'Chat' } = {}) {
  const out = {};
  const map = coercePatchMap(raw);

  for (const [name, entry] of Object.entries(map)) {
    const value = patchValue(entry);
    const cleaned = sanitizePersonaPayload({ [name]: value });
    if (cleaned[name] == null || cleaned[name] === '') continue;
    out[name] = {
      value: cleaned[name],
      kind: entry && typeof entry === 'object' && entry.kind === 'fact' ? 'fact' : 'guess',
      from: entry && typeof entry === 'object' && entry.from
        ? String(entry.from).slice(0, 60)
        : defaultFrom,
      force: !!(entry && typeof entry === 'object' && entry.force)
    };
  }
  return out;
}

function sanitizeSituationen(json) {
  const rawSituationen = Array.isArray(json?.audience_situations)
    ? json.audience_situations
    : json?.situationen;
  return validateSituationen({
    situationen: Array.isArray(rawSituationen) ? rawSituationen : []
  });
}

function sanitizeChatResult(json) {
  const reply = String(json?.reply || '').trim() || 'Verstanden.';
  const patches = sanitizePatches(json?.patches);
  for (const entry of Object.values(patches)) entry.force = true;
  const { situationen, verworfen } = sanitizeSituationen(json);
  return { reply, patches, audience_situations: situationen, verworfen };
}

function sanitizeExtractResult(json) {
  const fields = sanitizePatches(json?.fields, { defaultFrom: 'PDF' });
  for (const entry of Object.values(fields)) entry.force = false;
  const { situationen, verworfen } = sanitizeSituationen(json);
  return { fields, audience_situations: situationen, verworfen };
}

module.exports = {
  EXTRACT_TOOL,
  CHAT_TOOL,
  buildExtractPrompt,
  buildChatPrompt,
  sanitizePatches,
  sanitizeChatResult,
  sanitizeExtractResult
};
