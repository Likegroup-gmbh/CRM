// Skript-Upload über Liky (ADR 0073): ein PDF oder der Text einer Word-Datei
// mit Hinweis. Liky ordnet den Wortlaut den Zellen zu und formuliert nicht um.
// Das PDF wird danach gelöscht. Bilder (JPEG im PDF, bei Word vorab
// hochgeladen) landen unter der Skript-Tabelle.

const crypto = require('crypto');
const { callClaude, MODELS } = require('./_shared/anthropic');
const { withSkriptHandler } = require('./_shared/skript-handler');
const { starteKiRequest } = require('./_shared/ki-log');
const { jpegAusPdf, pdfIstGeschuetzt } = require('./_shared/pdf-jpeg');

const TEXTFELDER = [
  'hook', 'hauptteil', 'cta',
  'hook_visuell', 'hauptteil_visuell', 'cta_visuell',
  'text_hook', 'rezept', 'caption',
  'hook_variante_1', 'hook_variante_2', 'hook_variante_3'
];

const TOOL = {
  name: 'skript_zuordnen',
  description: 'Ordnet den Wortlaut des PDFs den Skript-Zellen zu, ohne ihn umzuformulieren.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...Object.fromEntries(TEXTFELDER.map((feld) => [feld, {
        type: 'string',
        description: 'Wortlaut oder leer, wenn die Zelle im PDF fehlt.'
      }])),
      rest: {
        type: 'array',
        description: 'Text, der in keine Zelle gehört, in Lesereihenfolge.',
        items: {
          type: 'object',
          properties: {
            typ: { type: 'string', enum: ['absatz', 'ueberschrift', 'liste'] },
            text: { type: 'string' }
          },
          required: ['typ', 'text']
        }
      }
    }
  }
};

const HINWEIS_MAX = 2000;
const BILDER_MAX = 40;

const SYSTEM = [
  'Du liest eine Skript-Datei für die LikeBase und kopierst den Wortlaut.',
  'Du formulierst nichts um, kürzt nicht und ergänzt nichts.',
  'Die Skript-Tabelle hat die Zeilen Hook, Hauptteil und CTA.',
  'Jede dieser Zeilen hat „Was gesagt wird“ (hook, hauptteil, cta) und „Was zu sehen ist“ (hook_visuell, hauptteil_visuell, cta_visuell).',
  'Text-Hook, Rezept und Caption sind eigene Zeilen. Hook 1, Hook 2 und Hook 3 sind die Hook-Varianten.',
  'Groß- und Kleinschreibung der Beschriftung spielt keine Rolle.',
  'Was keine dieser Beschriftungen hat, kommt in rest, in der Reihenfolge des PDFs.',
  'Eine Liste wird ein rest-Eintrag mit typ liste und den Punkten durch Zeilenumbrüche getrennt.',
  'Bilder beschreibst du nicht.',
  'Stehen mehrere Skripte in der Datei, übernimmst du nur eins: das, welches der Hinweis des Teams nennt, sonst das erste.',
  'Der Hinweis bestimmt, welcher Teil übernommen wird und wo Zellen stehen. Am Wortlaut ändert er nichts.',
  'Word-Text kommt als Markdown: **fett** und *kursiv* übernimmst du mit den Sternchen, Tabellenzeilen stehen als | Zelle | Zelle |.'
].join(' ');

function liesAuftrag({ text, hinweis }) {
  let prompt = text
    ? `Ordne das Skript aus dieser Word-Datei den Zellen zu. Übernimm den Wortlaut.\n\n<dokument>\n${text}\n</dokument>\n`
    : 'Ordne dieses Skript den Zellen zu. Übernimm den Wortlaut.\n';
  const notiz = String(hinweis || '').trim().slice(0, HINWEIS_MAX);
  if (notiz) prompt += `\n# HINWEIS DES TEAMS\n<hinweis>\n${notiz}\n</hinweis>\n`;
  return prompt;
}

function wordBildBloecke(skriptId, pfade) {
  return (Array.isArray(pfade) ? pfade : [])
    .filter((pfad) => typeof pfad === 'string' && pfad.startsWith(`${skriptId}/`) && !pfad.includes('..'))
    .slice(0, BILDER_MAX)
    .map((pfad) => ({
      id: `b_${crypto.randomUUID()}`, typ: 'bild', pfad, breite: 'mittel', unterschrift: '', intern: false
    }));
}

function textOderNull(wert) {
  const text = String(wert || '').trim();
  return text || null;
}

function restBloecke(rest) {
  const bloecke = [];
  for (const eintrag of Array.isArray(rest) ? rest : []) {
    const text = String(eintrag?.text || '').trim();
    if (!text) continue;
    if (eintrag.typ === 'liste') {
      const punkte = text.split('\n').map((p) => p.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
      if (punkte.length) bloecke.push({ id: `b_${crypto.randomUUID()}`, typ: 'liste', punkte, intern: false });
      continue;
    }
    bloecke.push({
      id: `b_${crypto.randomUUID()}`,
      typ: eintrag.typ === 'ueberschrift' ? 'h2' : 'absatz',
      md: text,
      intern: false
    });
  }
  return bloecke;
}

async function bilderHochladen(supabase, skriptId, buffer) {
  const bloecke = [];
  for (const jpeg of jpegAusPdf(buffer)) {
    const pfad = `${skriptId}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from('skript-bilder')
      .upload(pfad, jpeg, { contentType: 'image/jpeg', upsert: false });
    if (error) continue;
    bloecke.push({
      id: `b_${crypto.randomUUID()}`,
      typ: 'bild',
      pfad,
      breite: 'mittel',
      unterschrift: '',
      intern: false
    });
  }
  return bloecke;
}

async function markiereFehler(supabase, skriptId, kontext, meldung) {
  await supabase.from('skripte').update({
    prompt_kontext: {
      ...(kontext || {}),
      upload_status: 'fehler',
      upload_fehler: meldung
    }
  }).eq('id', skriptId);
}

exports.handler = withSkriptHandler(async ({ supabase, user, payload }) => {
  const { skriptId, pdfPath, text, bildPfade, hinweis } = payload || {};
  const wordText = typeof text === 'string' ? text.trim() : '';
  if (!skriptId || (!pdfPath && !wordText)) return { statusCode: 400, body: 'skriptId, pdfPath oder text fehlt' };
  const erlaubt = `skript-upload/${user.id}/`;
  if (pdfPath && !String(pdfPath).startsWith(erlaubt)) {
    return { statusCode: 403, body: 'pdfPath gehoert nicht zu diesem Upload' };
  }

  const { data: skript, error } = await supabase.from('skripte')
    .select('id, created_by, prompt_kontext, titel')
    .eq('id', skriptId)
    .maybeSingle();
  if (error || !skript) return { statusCode: 404, body: 'Skript nicht gefunden' };
  if (skript.created_by !== user.id) return { statusCode: 403, body: 'Skript gehoert jemand anderem' };

  const kontext = skript.prompt_kontext || {};
  let ki = null;
  try {
    let buffer = null;
    if (pdfPath) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(pdfPath);
      if (downloadError || !fileData) throw new Error('PDF nicht lesbar');
      buffer = Buffer.from(await fileData.arrayBuffer());
      await supabase.storage.from('documents').remove([pdfPath]);
      if (pdfIstGeschuetzt(buffer)) throw new Error('Das PDF ist geschützt.');
    }

    ki = await starteKiRequest(supabase, { userId: user.id, feature: buffer ? 'pdf_skript_upload' : 'word_skript_upload' });
    const result = await callClaude({
      model: MODELS.extract_briefing,
      systemBlocks: [{ text: SYSTEM, cache: true }],
      userPrompt: liesAuftrag({ text: buffer ? '' : wordText, hinweis }),
      maxTokens: 8000,
      tool: TOOL,
      timeoutMs: 240000,
      ...(buffer ? { document: { base64: buffer.toString('base64'), mediaType: 'application/pdf' } } : {})
    });
    await ki.abschliessen(result);
    const json = result.json;
    if (!json) throw new Error('Liky konnte die Datei keinem Skript zuordnen');

    const zellen = {};
    for (const feld of TEXTFELDER) zellen[feld] = textOderNull(json[feld]);
    const bilder = buffer
      ? await bilderHochladen(supabase, skriptId, buffer)
      : wordBildBloecke(skriptId, bildPfade);
    const bloecke = restBloecke(json.rest);
    const dokument = bilder.length || bloecke.length
      ? [{ id: 'skript-tabelle', typ: 'skript_tabelle' }, ...bloecke, ...bilder]
      : null;

    const { error: updateError } = await supabase.from('skripte').update({
      ...zellen,
      dokument_bloecke: dokument,
      dokument_bloecke_rev: dokument ? 1 : 0,
      aktive_version_nr: 1,
      aktive_sub_nr: 0,
      prompt_kontext: { ...kontext, upload_status: 'fertig', upload_pruefen: true }
    }).eq('id', skriptId);
    if (updateError) throw new Error(updateError.message);

    await supabase.from('skript_versionen').insert({
      skript_id: skriptId,
      version_nr: 1,
      sub_nr: 0,
      titel: skript.titel,
      ...zellen,
      aenderung_beschreibung: `Hochgeladen aus ${kontext.upload_dateiname || 'Datei'}`,
      created_by: user.id
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    if (ki) await ki.fehlgeschlagen(err);
    await markiereFehler(supabase, skriptId, kontext, err.message || 'Die Datei konnte nicht gelesen werden');
    return { statusCode: 500, body: err.message };
  }
});

exports.liesAuftrag = liesAuftrag;
exports.wordBildBloecke = wordBildBloecke;
