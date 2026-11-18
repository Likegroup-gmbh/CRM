// PDF-Skript-Upload (ADR 0073). Liky ordnet den Wortlaut den Zellen zu
// und formuliert nicht um. Die Datei wird danach gelöscht. Bilder, die als
// JPEG im PDF stecken, landen unter der Skript-Tabelle.

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

const SYSTEM = [
  'Du liest ein Skript-PDF für die LikeBase und kopierst den Wortlaut.',
  'Du formulierst nichts um, kürzt nicht und ergänzt nichts.',
  'Die Skript-Tabelle hat die Zeilen Hook, Hauptteil und CTA.',
  'Jede dieser Zeilen hat „Was gesagt wird“ (hook, hauptteil, cta) und „Was zu sehen ist“ (hook_visuell, hauptteil_visuell, cta_visuell).',
  'Text-Hook, Rezept und Caption sind eigene Zeilen. Hook 1, Hook 2 und Hook 3 sind die Hook-Varianten.',
  'Groß- und Kleinschreibung der Beschriftung spielt keine Rolle.',
  'Was keine dieser Beschriftungen hat, kommt in rest, in der Reihenfolge des PDFs.',
  'Eine Liste wird ein rest-Eintrag mit typ liste und den Punkten durch Zeilenumbrüche getrennt.',
  'Bilder beschreibst du nicht.'
].join(' ');

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
  const { skriptId, pdfPath } = payload || {};
  if (!skriptId || !pdfPath) return { statusCode: 400, body: 'skriptId oder pdfPath fehlt' };
  const erlaubt = `skript-upload/${user.id}/`;
  if (!String(pdfPath).startsWith(erlaubt)) {
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
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(pdfPath);
    if (downloadError || !fileData) throw new Error('PDF nicht lesbar');
    const buffer = Buffer.from(await fileData.arrayBuffer());
    await supabase.storage.from('documents').remove([pdfPath]);
    if (pdfIstGeschuetzt(buffer)) throw new Error('Das PDF ist geschützt.');

    ki = await starteKiRequest(supabase, { userId: user.id, feature: 'pdf_skript_upload' });
    const result = await callClaude({
      model: MODELS.extract_briefing,
      systemBlocks: [{ text: SYSTEM, cache: true }],
      userPrompt: 'Ordne dieses Skript den Zellen zu. Übernimm den Wortlaut.',
      maxTokens: 8000,
      tool: TOOL,
      timeoutMs: 240000,
      document: { base64: buffer.toString('base64'), mediaType: 'application/pdf' }
    });
    await ki.abschliessen(result);
    const json = result.json;
    if (!json) throw new Error('Keine Zuordnung aus dem PDF');

    const zellen = {};
    for (const feld of TEXTFELDER) zellen[feld] = textOderNull(json[feld]);
    const bilder = await bilderHochladen(supabase, skriptId, buffer);
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
      aenderung_beschreibung: `Hochgeladen aus ${kontext.upload_dateiname || 'PDF'}`,
      created_by: user.id
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    if (ki) await ki.fehlgeschlagen(err);
    await markiereFehler(supabase, skriptId, kontext, err.message || 'Das PDF konnte nicht gelesen werden');
    return { statusCode: 500, body: err.message };
  }
});
