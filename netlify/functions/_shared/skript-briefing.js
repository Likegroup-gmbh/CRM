// PDF-Briefing durchforsten: Download aus Supabase Storage, Fakten-Extrakt
// via Claude (nativer PDF-Support, funktioniert auch bei gescannten PDFs).
// Der Extrakt wird in skripte.prompt_kontext.briefing_extrakt gecacht, damit
// das PDF pro Skript nur EINMAL verarbeitet wird (Rueckfragen-Runden +
// finale Generierung nutzen denselben Extrakt).

const { callClaude, MODELS } = require('./anthropic');

const BUCKET = 'documents';

const EXTRAKT_PROMPT = 'Das angehaengte PDF ist ein Kunden-Briefing fuer ein Creator-Video (UGC, TikTok/Instagram Reels). '
  + 'Extrahiere ALLE Fakten vollstaendig und strukturiert als Markdown-Liste, gruppiert nach:\n'
  + '- Produkt/Angebot (was genau wird beworben, welche Features/Leistungen gibt es wirklich)\n'
  + '- Preise, Rabatte, Aktionen, Konditionen\n'
  + '- CTA / Links / Registrierungs- oder Kaufweg\n'
  + '- Zielgruppe\n'
  + '- Must-haves (Pflicht-Aussagen, Pflicht-Elemente)\n'
  + '- No-Gos / Verbote\n'
  + '- Rechtliche Vorgaben\n'
  + '- Sonstige relevante Infos (Ton, Stil, Beispiele, Deadlines)\n\n'
  + 'Regeln: Erfinde NICHTS dazu, lass NICHTS Relevantes weg, uebernimm Zahlen/Links/Namen exakt. '
  + 'Wenn eine Kategorie im Briefing nicht vorkommt, schreibe "keine Angaben". '
  + 'Antworte NUR mit dem Extrakt, ohne Einleitung.';

/**
 * Liefert den Fakten-Extrakt des hochgeladenen PDF-Briefings (oder null).
 *
 * @param {object} supabase   Service-Role-Client
 * @param {object} payload    Generator-Payload (erwartet payload.briefing_pdf = { pfad, name })
 * @param {string|null} skriptId  Skript/Stub, an dem der Extrakt gecacht wird
 * @param {function|null} log     optionaler Logger (msg) => void
 * @returns {Promise<string|null>} Extrakt-Text
 */
async function ladeBriefingExtrakt(supabase, payload, skriptId = null, log = null) {
  const pfad = payload?.briefing_pdf?.pfad;
  if (!pfad) return null;

  // Cache-Check: schon einmal extrahiert?
  let promptKontext = null;
  if (skriptId) {
    const { data: skript } = await supabase.from('skripte')
      .select('prompt_kontext').eq('id', skriptId).single();
    promptKontext = skript?.prompt_kontext || null;
    if (promptKontext?.briefing_extrakt) {
      if (log) log('PDF-Briefing: Extrakt aus Cache');
      return promptKontext.briefing_extrakt;
    }
  }

  // PDF aus Storage laden
  const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(pfad);
  if (downloadError || !file) {
    throw new Error(`PDF-Briefing konnte nicht geladen werden (${pfad}): ${downloadError?.message || 'unbekannt'}`);
  }
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  if (log) log(`PDF-Briefing geladen (${Math.round(base64.length * 0.75 / 1024)} KB), Fakten werden extrahiert...`);

  // Fakten-Extrakt mit dem guenstigen Modell
  const result = await callClaude({
    model: MODELS.distill,
    userPrompt: EXTRAKT_PROMPT,
    documents: [{ base64, mediaType: 'application/pdf' }],
    maxTokens: 4096
  });

  const extrakt = (result.text || '').trim();
  if (!extrakt) throw new Error('PDF-Briefing: Extrakt ist leer');

  // Am Skript cachen (best effort - Extrakt steht auch ohne Cache bereit)
  if (skriptId) {
    try {
      await supabase.from('skripte')
        .update({ prompt_kontext: { ...(promptKontext || {}), briefing_extrakt: extrakt } })
        .eq('id', skriptId);
    } catch (_) { /* noop */ }
  }

  if (log) log('PDF-Briefing: Fakten-Extrakt erstellt');
  return extrakt;
}

module.exports = { ladeBriefingExtrakt, BRIEFING_BUCKET: BUCKET };
