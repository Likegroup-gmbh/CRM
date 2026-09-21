// persona-liky.js
// Chat- und PDF-Extract-Tool, Prompt und Sanitize fuer Liky an der Persona.
// URL-Extract bleibt in extract-specs.js / site-extract.

const { getSpec, buildFieldInstructions } = require('./extract-specs');
const { sanitizePersonaPayload } = require('./produkt-persona');
const { validateSituationen } = require('./audience-situation');

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
    + '- reply: deine Antwort an den User.\n'
    + '- patches: nur Felder, die sich aendern. force=true nur wenn der User '
    + 'explizit ueberschreiben will.\n'
    + '- audience_situations: 2 bis 4 konkrete Empfangsmomente der Person, '
    + 'keine Produkt-Use-Cases. Nur setzen wenn noch keine da sind oder der User '
    + 'neue will. Sonst weglassen.\n';

  return { stable, task };
}

function patchValue(entry) {
  if (entry && typeof entry === 'object' && 'value' in entry) return entry.value;
  return entry;
}

/** Nur bekannte Persona-Felder, mit force/kind aus dem Tool-Call. */
function sanitizePatches(raw, { defaultFrom = 'Chat' } = {}) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

  for (const [name, entry] of Object.entries(raw)) {
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
