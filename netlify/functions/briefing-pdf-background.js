// Netlify Background Function: Briefing-PDF-Extract (Liky)
// Zwei Modi: extract (PDF -> Felder) und chat (History + formData -> Patches).
// Feature-Key: pdf_briefing (existiert in ki_requests).

const { callClaude, extractJson, repairJsonStrings, MODELS } = require('./_shared/anthropic');
const { withSkriptHandler } = require('./_shared/skript-handler');
const { createJobUpdater } = require('./_shared/job-updater');
const { starteKiRequest } = require('./_shared/ki-log');

// fieldConfig ist ESM; wir brauchen die Spec serverseitig. Der Client
// schickt die Spec im Job-Payload mit — die Function vertraut ihr nicht
// blind, sondern validiert die Feldnamen gegen die erlaubten Typen.
const EXTRACT_TOOL = {
  name: 'briefing_extract_abgeben',
  description: 'Gibt die aus dem Kundenbriefing erkannten Felder ab.',
  input_schema: {
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        description: 'Feldname -> { value, kind: fact|guess, from }',
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
      missing: { type: 'array', items: { type: 'string' } },
      unternehmen_hint: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          passt: { type: 'boolean' }
        }
      },
      produkte_hint: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            produkt_id: { type: ['string', 'null'] }
          }
        }
      }
    },
    required: ['fields']
  }
};

const CHAT_TOOL = {
  name: 'briefing_chat_abgeben',
  description: 'Antwortet im Chat und liefert Feld-Patches.',
  input_schema: {
    type: 'object',
    properties: {
      reply: { type: 'string' },
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
      }
    },
    required: ['reply']
  }
};

function buildExtractPrompt({ spec, unternehmenName, markeName, produkte }) {
  const stable = 'Du bist Liky, der KI-Assistent im CRM. Du liest ein Kundenbriefing '
    + '(PDF) und fuellst damit das Briefing-Formular vor. Antworte ausschliesslich '
    + 'ueber das Tool "briefing_extract_abgeben". Deutsch. Keine Floskeln.';

  let task = '# AUFTRAG\n'
    + 'Lies das PDF und belege die Felder der Spec. Nur was im PDF steht. '
    + 'Enums auf options.value mappen. Nichts erfinden. Formular ist Deutsch.\n\n';

  if (unternehmenName) task += `Unternehmen: ${unternehmenName}\n`;
  if (markeName) task += `Marke: ${markeName}\n`;
  if (produkte?.length) {
    task += 'Bekannte Produkte (id + name; produkt_id nur aus dieser Liste):\n'
      + JSON.stringify(produkte.map((p) => ({ id: p.id, name: p.name }))) + '\n';
  }

  task += '\n# SPEC\n' + JSON.stringify(spec, null, 2) + '\n\n';
  task += '# REGELN\n'
    + '- Spec ist geschlossen: nur Felder aus der Spec belegen. Was keinem Feld '
    + 'zugeordnet werden kann, weglassen. Keine Rueckfragen, keine Extra-Keys. '
    + 'Kunden-PDFs enthalten oft Irrelevantes (Scope, Kontakte, Zeitplaene).\n'
    + '- Ignorieren: Ansprechpartner/Kontaktpersonen (sitzen nicht am Briefing), '
    + 'Agentur-Leistungsbeschreibung, interne Projektplaene, Budget, Legal/'
    + 'Boilerplate, Deckblatt-Metadaten. Einzelne Meilenstein-Zeilen nicht ablegen.\n'
    + '- Zeitraum: Kampagnenlaufzeit oder grober Veroeffentlichungszeitraum kompakt '
    + 'in veroeffentlichungszeitraum (z.B. "KW 46-48 / Go-Live 17.11.2026").\n'
    + '- fields: Objekt Feldname -> { value, kind, from }. Nur Felder aus der Spec, '
    + 'die im PDF belegt sind. kind=fact wenn direkt im Text, '
    + 'kind=guess wenn abgeleitet. from = kurzer Quellverweis (Seite/Abschnitt).\n'
    + '- value exakt in der Form, die valueShape des Feldes vorgibt. '
    + 'Enums auf options.value mappen, Formate auf die format-values des Channels. '
    + 'Keine zusaetzlichen Keys wie "anzahl" oder "vorgaben" in channelGroup-Werten.\n'
    + '- missing: Pflichtfelder, die leer bleiben (z.B. aktivierung_name).\n'
    + '- unternehmen_hint: Name aus dem PDF, passt = ob er zum gewaehlten Unternehmen passt.\n'
    + '- produkte_hint: Produktnamen aus dem PDF. produkt_id NUR eine id aus '
    + 'Bekannte Produkte, sonst null. Keine UUID erfinden.\n';

  return { stable, task };
}

function normalizeProduktName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Spiegel von src/modules/briefing/create/produktHint.js - Claude liefert
// IDs unzuverlaessig, deshalb serverseitig gegen den Katalog matchen.
function resolveProduktHints(hints, katalog) {
  const list = (katalog || []).filter((p) => p?.id);
  const byId = new Map(list.map((p) => [String(p.id), p]));
  return (hints || []).map((hint) => {
    const name = String(hint?.name || '').trim();
    const given = hint?.produkt_id ? String(hint.produkt_id).trim() : '';
    if (given && (!list.length || byId.has(given))) {
      return { name, produkt_id: given };
    }
    const key = normalizeProduktName(name);
    if (!key) return { name, produkt_id: null };
    const exact = list.filter((p) => normalizeProduktName(p.name) === key);
    if (exact.length === 1) return { name, produkt_id: exact[0].id };
    const contained = list.filter((p) => {
      const k = normalizeProduktName(p.name);
      return k && (key.includes(k) || k.includes(key));
    });
    if (contained.length === 1) return { name, produkt_id: contained[0].id };
    return { name, produkt_id: null };
  });
}

// Modelle liefern offene Maps gelegentlich als JSON-String oder als Array
// (die API validiert tool_use.input nicht gegen input_schema). Einmal
// auspacken. Parse-Fehler duerfen den Payload nicht zu {} machen.
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

function mapFromArray(items) {
  const out = {};
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const named = String(item.name || item.key || '').trim();
    if (named) {
      const { name: _n, key: _k, ...rest } = item;
      out[named] = rest;
      continue;
    }
    // [{ aktivierung_name: { value, kind, from } }]
    const keys = Object.keys(item).filter((k) => !['kind', 'from', 'value', 'force'].includes(k));
    if (keys.length === 1) out[keys[0]] = item[keys[0]];
  }
  return out;
}

function coerceMap(value, key) {
  if (value == null) return {};
  const parsed = parseMaybeJson(value);
  if (parsed == null) {
    console.warn(`[${key}] String nicht parsebar`);
    return {};
  }
  if (typeof value === 'string') console.warn(`[${key}] als String geliefert, geparst`);
  if (Array.isArray(parsed)) {
    const out = mapFromArray(parsed);
    if (!Object.keys(out).length && parsed.length) {
      console.warn(`[${key}] Array ohne erkennbare Feldnamen (${parsed.length} Items)`);
    }
    return out;
  }
  if (parsed && typeof parsed === 'object') return parsed;
  return {};
}

function buildChatPrompt({ spec, history, formData, userText }) {
  const stable = 'Du bist Liky, der KI-Assistent im CRM. Du hilfst beim Ausfuellen '
    + 'des Briefing-Formulars. Antworte ausschliesslich ueber das Tool '
    + '"briefing_chat_abgeben". Deutsch. Knapp.';

  let task = '# KONTEXT\n';
  task += 'Spec: ' + JSON.stringify(spec, null, 2) + '\n\n';
  task += 'Aktueller Formularstand: ' + JSON.stringify(formData, null, 2) + '\n\n';
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
    + '- Du siehst KEIN PDF und kein Kundenbriefing. Dir liegen nur der '
    + 'Formularstand und der Chat vor. Erfinde keine Briefing-Inhalte, Zahlen '
    + 'oder Termine - wenn etwas fehlt, frag nach.\n'
    + '- patches: nur Felder, die der User geaendert haben will. '
    + 'patches.feldname = { value, kind, from }. value exakt in der Form, die '
    + 'valueShape des Feldes vorgibt (Enums als options.value, KPIs als '
    + '{ kpi, zielwert }, Channels als { key: [format-values] }). '
    + 'Ein Aenderungswunsch gehoert immer in patches. Ein Reply ohne patches '
    + 'aendert das Formular nicht.\n'
    + '- force=true nur wenn der User explizit ueberschreiben will '
    + '(z.B. "Deadline weg").\n';

  return { stable, task };
}

exports.handler = withSkriptHandler(async ({ supabase, user, payload }) => {
  const { jobId, briefing_id: briefingId, modus, spec, formData, userText, history, pdfPath } = payload;
  if (!jobId) return { statusCode: 400, body: 'jobId fehlt' };
  if (!briefingId) return { statusCode: 400, body: 'briefing_id fehlt' };
  if (!modus || !['extract', 'chat'].includes(modus)) {
    return { statusCode: 400, body: 'modus muss extract oder chat sein' };
  }
  if (modus === 'extract' && !pdfPath) {
    return { statusCode: 400, body: 'pdfPath fehlt' };
  }

  // Job atomar claimen (pending -> running)
  const { data: claimed, error: claimError } = await supabase
    .from('briefing_pdf_jobs')
    .update({ status: 'running' })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (claimError) throw new Error(`Job-Claim fehlgeschlagen: ${claimError.message}`);
  if (!claimed) return { statusCode: 409, body: 'Job laeuft bereits oder ist abgeschlossen' };

  const job = createJobUpdater(supabase, jobId, { table: 'briefing_pdf_jobs', withLogs: false });
  const startTime = Date.now();
  let ki = null;

  try {
    ki = await starteKiRequest(supabase, { userId: user.id, feature: 'pdf_briefing' });

    const { data: briefing, error: briefingError } = await supabase
      .from('campaign_briefings')
      .select('id, unternehmen_id, marke_id, bereich')
      .eq('id', briefingId)
      .single();
    if (briefingError || !briefing) throw new Error('Briefing nicht gefunden');

    let unternehmenName = null;
    let markeName = null;
    let produkte = [];

    if (briefing.unternehmen_id) {
      const { data: u } = await supabase
        .from('unternehmen')
        .select('firmenname')
        .eq('id', briefing.unternehmen_id)
        .maybeSingle();
      unternehmenName = u?.firmenname || null;
    }
    if (briefing.marke_id) {
      const { data: m } = await supabase
        .from('marke')
        .select('markenname')
        .eq('id', briefing.marke_id)
        .maybeSingle();
      markeName = m?.markenname || null;
    }
    if (briefing.unternehmen_id) {
      const { data: p } = await supabase
        .from('produkt')
        .select('id, name')
        .eq('unternehmen_id', briefing.unternehmen_id);
      produkte = p || [];
    }

    const model = MODELS.extract_briefing;
    let result;

    if (modus === 'extract') {
      job.step('lesen', 'Ich lese das Kundenbriefing…');

      // PDF serverseitig aus dem Storage laden - der Client schickt nur den
      // Pfad, sonst kollidiert das Base64 mit dem Netlify-Body-Limit (413).
      // Der Pfad muss zum Briefing passen: die Service-Role umgeht die
      // Storage-RLS, ohne Abgleich waere jeder erratene Pfad lesbar.
      const { data: kb } = await supabase
        .from('kundenbriefings')
        .select('storage_path')
        .eq('briefing_id', briefingId)
        .maybeSingle();
      if (!kb || kb.storage_path !== pdfPath || !pdfPath.startsWith('kundenbriefings/')) {
        throw new Error('pdfPath gehoert nicht zu diesem Briefing');
      }

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(pdfPath);
      if (downloadError || !fileData) {
        throw new Error(`PDF nicht lesbar: ${downloadError?.message || 'leer'}`);
      }
      const pdfBase64 = Buffer.from(await fileData.arrayBuffer()).toString('base64');

      const { stable, task } = buildExtractPrompt({
        spec, unternehmenName, markeName, produkte
      });

      job.step('auswerten', 'Ich werte das PDF aus…');
      result = await callClaude({
        model,
        systemBlocks: [{ text: stable, cache: true }],
        userPrompt: task,
        maxTokens: 8192,
        tool: EXTRACT_TOOL,
        timeoutMs: 480000,
        document: { base64: pdfBase64, mediaType: 'application/pdf' }
      });
    } else {
      job.step('antworten', 'Ich denke nach…');
      const { stable, task } = buildChatPrompt({ spec, history, formData, userText });
      result = await callClaude({
        model,
        systemBlocks: [{ text: stable, cache: true }],
        userPrompt: task,
        maxTokens: 4096,
        tool: CHAT_TOOL,
        timeoutMs: 120000
      });
    }

    await ki.abschliessen(result);

    const json = result.json || extractJson(result.text);
    if (!json) throw new Error('Keine strukturierte Antwort von Claude');
    json.fields = coerceMap(json.fields, 'fields');
    if (modus === 'chat') json.patches = coerceMap(json.patches, 'patches');
    if (modus === 'extract' && Array.isArray(json.produkte_hint)) {
      json.produkte_hint = resolveProduktHints(json.produkte_hint, produkte);
    }

    await job.flushAndUpdate({
      status: 'done',
      result: {
        success: true,
        modus,
        ...json,
        cost: result.usage,
        dauer_ms: Date.now() - startTime
      }
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error(`[${jobId}] briefing-pdf-background:`, error);
    if (ki) await ki.fehlgeschlagen(error);
    await job.flushAndUpdate({
      status: 'error',
      error_message: error.message,
      result: { success: false, error: error.message }
    });
    return { statusCode: 500, body: error.message };
  }
});
