// Netlify Background Function: Briefing-PDF-Extract (Liky)
// Zwei Modi: extract (PDF -> Felder) und chat (History + formData -> Patches).
// Feature-Key: pdf_briefing (existiert in ki_requests).

const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');
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
      orphans: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            frage: { type: 'string' }
          },
          required: ['text', 'frage']
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
    task += `Bekannte Produkte: ${produkte.map((p) => p.name).join(', ')}\n`;
  }

  task += '\n# SPEC\n' + JSON.stringify(spec, null, 2) + '\n\n';
  task += '# REGELN\n'
    + '- fields: nur Felder, die im PDF belegt sind. kind=fact wenn direkt im Text, '
    + 'kind=guess wenn abgeleitet. from = kurzer Quellverweis (Seite/Abschnitt).\n'
    + '- orphans: Saetze, die du erkannt hast, aber keinem Feld zuordnen kannst. '
    + 'frage = deine Rueckfrage an den User.\n'
    + '- missing: Pflichtfelder, die leer bleiben (z.B. aktivierung_name).\n'
    + '- unternehmen_hint: Name aus dem PDF, passt = ob er zum gewaehlten Unternehmen passt.\n'
    + '- produkte_hint: Produktnamen aus dem PDF, produkt_id wenn bekannt, sonst null.\n';

  return { stable, task };
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
    + '- patches: nur Felder, die sich aendern. force=true nur wenn der User '
    + 'explizit ueberschreiben will (z.B. "Deadline weg").\n';

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
