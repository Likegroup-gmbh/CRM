// Netlify Background Function: Rechnungs-PDF-Extract (Liky, ADR 0016)
// Liest eine Creator-Rechnung (PDF) und fuellt damit das Anlege-Formular vor.
// Assistenz, kein Gate: was nicht belastbar gelesen wird, bleibt leer, und
// ein Misserfolg blockiert das manuelle Anlegen nie. Die Kooperation wird
// nicht gesetzt — die Function liefert nur Creator-Treffer, der Client macht
// daraus einen Vorschlag mit Begruendung.
// Feature-Key: pdf_rechnung (ki_requests.feature ist frei waehlbar).

const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');
const { withSkriptHandler } = require('./_shared/skript-handler');
const { createJobUpdater } = require('./_shared/job-updater');
const { starteKiRequest } = require('./_shared/ki-log');

const EXTRACT_TOOL = {
  name: 'rechnung_extract_abgeben',
  description: 'Gibt die aus der Creator-Rechnung erkannten Felder ab.',
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
      creator_hint: {
        type: 'object',
        description: 'Absender der Rechnung (der Creator), nicht der Empfaenger.',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          instagram: { type: 'string' }
        }
      },
      warnungen: {
        type: 'array',
        items: { type: 'string' },
        description: 'Auffaelligkeiten, die ein Mensch pruefen sollte.'
      }
    },
    required: ['fields']
  }
};

// Nur diese Felder duerfen aus der KI-Antwort durch — alles andere wird
// verworfen, damit die Function kein generischer Formular-Schreibkanal wird.
const ERLAUBTE_FELDER = new Set([
  'nettobetrag', 'nettobetrag_steuerfrei', 'ksk_betrag', 'zusatzkosten',
  'ust_prozent', 'ust_ausgewiesen', 'skonto_prozent',
  'gestellt_am', 'zahlungsziel', 'rechnungsnummer', 'waehrung'
]);

const BETRAG_FELDER = new Set([
  'nettobetrag', 'nettobetrag_steuerfrei', 'ksk_betrag', 'zusatzkosten'
]);
const DATUM_FELDER = new Set(['gestellt_am', 'zahlungsziel']);

// "1.234,56" / "1234.56" / "1 234,56 €" -> 1234.56
function parseDeutscheZahl(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let s = value.trim().replace(/[€$\s]/g, '');
  if (!s) return null;
  const hatKomma = s.includes(',');
  const hatPunkt = s.includes('.');
  if (hatKomma && hatPunkt) {
    // Letztes Trennzeichen ist das Dezimalzeichen
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hatKomma) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// "31.12.2026" / "2026-12-31" -> "2026-12-31"
function parseDatum(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) return `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`;
  return null;
}

// Validiert und normalisiert die KI-Felder. Ungueltiges fliegt still raus —
// lieber ein leeres Formularfeld als ein falscher Wert (ADR 0016).
function normalizeExtractFields(fields) {
  const out = {};
  if (!fields || typeof fields !== 'object') return out;
  for (const [name, eintrag] of Object.entries(fields)) {
    if (!ERLAUBTE_FELDER.has(name)) continue;
    if (!eintrag || eintrag.value === null || eintrag.value === undefined) continue;
    const meta = {
      kind: eintrag.kind === 'guess' ? 'guess' : 'fact',
      from: typeof eintrag.from === 'string' ? eintrag.from.slice(0, 200) : null
    };
    if (BETRAG_FELDER.has(name)) {
      const n = parseDeutscheZahl(eintrag.value);
      if (n === null || n < 0) continue; // negative Betraege sind verboten
      out[name] = { value: Math.round(n * 100) / 100, ...meta };
    } else if (DATUM_FELDER.has(name)) {
      const d = parseDatum(eintrag.value);
      if (!d) continue;
      out[name] = { value: d, ...meta };
    } else if (name === 'ust_ausgewiesen') {
      if (typeof eintrag.value !== 'boolean') continue;
      out[name] = { value: eintrag.value, ...meta };
    } else if (name === 'ust_prozent' || name === 'skonto_prozent') {
      const n = parseDeutscheZahl(eintrag.value);
      if (n === null || n < 0 || n > 100) continue;
      out[name] = { value: n, ...meta };
    } else {
      // rechnungsnummer, waehrung
      const s = String(eintrag.value).trim().slice(0, 100);
      if (!s) continue;
      out[name] = { value: s, ...meta };
    }
  }
  return out;
}

function buildExtractPrompt() {
  const stable = 'Du bist Liky, der KI-Assistent im CRM der Agentur Lightbase. '
    + 'Du liest die Rechnung eines Creators (PDF) und fuellst damit das '
    + 'Rechnungs-Formular vor. Antworte ausschliesslich ueber das Tool '
    + '"rechnung_extract_abgeben". Deutsch. Keine Floskeln.';

  const task = '# AUFTRAG\n'
    + 'Lies die Rechnung und belege die Felder. Nur was im PDF steht oder '
    + 'eindeutig ableitbar ist. Nichts erfinden. Im Zweifel weglassen.\n\n'
    + '# FELDER\n'
    + '- nettobetrag: Netto-Honorar fuer die Leistung (Content/Video), OHNE '
    + 'Zusatzkosten und OHNE eine separat ausgewiesene KSK-Zeile.\n'
    + '- nettobetrag_steuerfrei: nur wenn ein Teil explizit steuerfrei '
    + 'ausgewiesen ist (z.B. Auslandsleistung), sonst weglassen.\n'
    + '- zusatzkosten: separat ausgewiesene Nebenkosten (Reise, Equipment, '
    + 'Musik-Lizenzen). Summe, wenn mehrere Positionen.\n'
    + '- ksk_betrag: nur wenn eine Kuenstlersozialabgabe/KSK-Zeile mit Betrag '
    + 'ausgewiesen ist. Ein reiner Hinweistext ohne Betrag zaehlt nicht.\n'
    + '- ust_ausgewiesen: false wenn keine Umsatzsteuer ausgewiesen ist '
    + '(Kleinunternehmer §19, Reverse Charge), sonst true.\n'
    + '- ust_prozent: Steuersatz in Prozent (z.B. 19, 7), nur wenn USt ausgewiesen.\n'
    + '- skonto_prozent: nur wenn Skonto ausdruecklich genannt ist.\n'
    + '- gestellt_am: Rechnungsdatum.\n'
    + '- zahlungsziel: Faelligkeitsdatum, nur wenn explizit genannt (nicht aus '
    + '"zahlbar in 14 Tagen" ableiten).\n'
    + '- rechnungsnummer: die Rechnungsnummer des Creators.\n'
    + '- waehrung: ISO-Code (EUR, USD, ...).\n\n'
    + '# CREATOR\n'
    + 'creator_hint: der ABSENDER der Rechnung (der Creator), nicht Lightbase. '
    + 'name wie auf der Rechnung, email und instagram-Handle wenn vorhanden.\n\n'
    + '# REGELN\n'
    + '- kind=fact wenn direkt im Text, kind=guess wenn abgeleitet. '
    + 'from = kurzer Quellverweis (z.B. "Fusszeile", "Positionstabelle").\n'
    + '- Betraege als Zahl mit Punkt als Dezimaltrennzeichen.\n'
    + '- Daten als JJJJ-MM-TT.\n'
    + '- warnungen: Auffaelligkeiten (z.B. Fremdwaehrung, mehrere Rechnungen '
    + 'im PDF, Summe passt nicht zu Positionen, kein Datum erkennbar).\n';

  return { stable, task };
}

// Reine Scoring-Funktion: bewertet Kandidaten gegen den Hint. Email-Treffer
// schlaegt alles, danach voller Name, dann Namensteile, dann Handle.
function scoreCreatorKandidaten(hint, kandidaten) {
  const name = (hint?.name || '').trim().toLowerCase();
  const email = (hint?.email || '').trim().toLowerCase();
  const instagram = (hint?.instagram || '').trim().toLowerCase().replace(/^@/, '');
  const parts = name.split(/[\s,]+/).filter((p) => p.length >= 3);

  return (kandidaten || [])
    .map((c) => {
      let score = 0;
      const vor = (c.vorname || '').toLowerCase();
      const nach = (c.nachname || '').toLowerCase();
      const voll = `${vor} ${nach}`.trim();
      if (email && (c.mail || '').toLowerCase() === email) score += 10;
      if (name && voll === name) score += 5;
      for (const p of parts) {
        if (vor.includes(p) || nach.includes(p)) score += 1;
      }
      if (instagram && (c.instagram || '').toLowerCase().replace(/^@/, '') === instagram) score += 4;
      return { id: c.id, vorname: c.vorname, nachname: c.nachname, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
}

async function findeCreatorKandidaten(supabase, hint) {
  const kandidaten = new Map();
  const sammeln = (rows) => {
    for (const c of rows || []) if (c?.id) kandidaten.set(c.id, c);
  };

  const email = (hint?.email || '').trim();
  if (email.includes('@')) {
    const { data } = await supabase
      .from('creator')
      .select('id, vorname, nachname, mail, instagram')
      .ilike('mail', email)
      .limit(5);
    sammeln(data);
  }

  const instagram = (hint?.instagram || '').trim().replace(/^@/, '');
  if (instagram.length >= 3) {
    const { data } = await supabase
      .from('creator')
      .select('id, vorname, nachname, mail, instagram')
      .ilike('instagram', instagram)
      .limit(5);
    sammeln(data);
  }

  const name = (hint?.name || '').trim();
  const parts = name.split(/[\s,]+/).filter((p) => p.length >= 3);
  for (const part of parts.slice(0, 3)) {
    // ILIKE-Sonderzeichen raus, sonst wird das Pattern ungueltig
    const esc = part.replace(/[%_\\]/g, '');
    if (esc.length < 3) continue;
    const { data } = await supabase
      .from('creator')
      .select('id, vorname, nachname, mail, instagram')
      .or(`vorname.ilike.%${esc}%,nachname.ilike.%${esc}%`)
      .limit(10);
    sammeln(data);
  }

  return scoreCreatorKandidaten(hint, [...kandidaten.values()]).slice(0, 3);
}

exports.handler = withSkriptHandler(async ({ supabase, user, payload }) => {
  const { jobId, pdfPath } = payload || {};
  if (!jobId) return { statusCode: 400, body: 'jobId fehlt' };
  if (!pdfPath) return { statusCode: 400, body: 'pdfPath fehlt' };

  // Job atomar claimen (pending -> running)
  const { data: claimed, error: claimError } = await supabase
    .from('rechnung_pdf_jobs')
    .update({ status: 'running' })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (claimError) throw new Error(`Job-Claim fehlgeschlagen: ${claimError.message}`);
  if (!claimed) return { statusCode: 409, body: 'Job laeuft bereits oder ist abgeschlossen' };

  const job = createJobUpdater(supabase, jobId, { table: 'rechnung_pdf_jobs', withLogs: false });
  const startTime = Date.now();
  let ki = null;

  try {
    ki = await starteKiRequest(supabase, { userId: user.id, feature: 'pdf_rechnung' });

    job.step('lesen', 'Ich lese die Rechnung…');

    // PDF serverseitig aus dem Storage laden — der Client schickt nur den
    // Pfad, sonst kollidiert das Base64 mit dem Netlify-Body-Limit. Der Pfad
    // muss im Upload-Ordner des Users liegen: die Service-Role umgeht die
    // Storage-RLS, ohne Abgleich waere jeder erratene Pfad lesbar.
    const erlaubterPrefix = `rechnung-extracts/${user.id}/`;
    if (!pdfPath.startsWith(erlaubterPrefix)) {
      throw new Error('pdfPath gehoert nicht zu diesem Upload');
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(pdfPath);
    if (downloadError || !fileData) {
      throw new Error(`PDF nicht lesbar: ${downloadError?.message || 'leer'}`);
    }
    const pdfBase64 = Buffer.from(await fileData.arrayBuffer()).toString('base64');

    // Temp-Datei gleich wieder rauswerfen — der dauerhafte Beleg entsteht
    // erst beim Speichern der Rechnung ueber den normalen pdf_file-Upload.
    await supabase.storage.from('documents').remove([pdfPath]);

    const { stable, task } = buildExtractPrompt();

    job.step('auswerten', 'Ich werte die Rechnung aus…');
    const result = await callClaude({
      model: MODELS.extract_rechnung,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 4096,
      tool: EXTRACT_TOOL,
      timeoutMs: 240000,
      document: { base64: pdfBase64, mediaType: 'application/pdf' }
    });

    await ki.abschliessen(result);

    const json = result.json || extractJson(result.text);
    if (!json) throw new Error('Keine strukturierte Antwort von Claude');

    const fields = normalizeExtractFields(json.fields);
    const creatorTreffer = await findeCreatorKandidaten(supabase, json.creator_hint);
    const warnungen = Array.isArray(json.warnungen)
      ? json.warnungen.filter((w) => typeof w === 'string').slice(0, 5)
      : [];

    await job.flushAndUpdate({
      status: 'done',
      result: {
        success: true,
        fields,
        creator_hint: json.creator_hint || null,
        creator_treffer: creatorTreffer,
        warnungen,
        cost: result.usage,
        dauer_ms: Date.now() - startTime
      }
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error(`[${jobId}] rechnung-pdf-background:`, error);
    if (ki) await ki.fehlgeschlagen(error);
    await job.flushAndUpdate({
      status: 'error',
      error_message: error.message,
      result: { success: false, error: error.message }
    });
    return { statusCode: 500, body: error.message };
  }
});

// Reine Helfer fuer Tests (Prompt, Normalisierung, Scoring)
module.exports.buildExtractPrompt = buildExtractPrompt;
module.exports.normalizeExtractFields = normalizeExtractFields;
module.exports.scoreCreatorKandidaten = scoreCreatorKandidaten;
module.exports.parseDeutscheZahl = parseDeutscheZahl;
module.exports.parseDatum = parseDatum;
