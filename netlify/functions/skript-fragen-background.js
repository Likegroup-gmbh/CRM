// Netlify Background Function: Rueckfragen VOR der Skript-Generierung
// (Slot-Filling, "Grill Me"). Die pending Assistant-Message in
// skript_chat_messages IST der Job (wie beim Editor-Chat):
//   pending -> running -> fertig    (weitere Frage-Runde)
//                      -> vorschlag (alles geklaert -> UI zeigt "Jetzt generieren")
//                      -> error
// Der inhaltliche Leitfaden liegt editierbar in
// _shared/prompts/skript-rueckfragen.md und wird zur Laufzeit geladen.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');
const { loadContext, buildKontextText } = require('./_shared/skript-context');
const { ladeBriefingExtrakt } = require('./_shared/skript-briefing');

async function verifyAuth(event, supabase) {
  const authHeader = (event.headers || {}).authorization || (event.headers || {}).Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ---------------------------------------------------------------------------
// Leitfaden aus Markdown-Datei (mehrere Kandidaten, da esbuild __dirname
// verschieben kann; included_files in netlify.toml liefert die Datei mit aus)
// ---------------------------------------------------------------------------
const LEITFADEN_FALLBACK = 'Interviewe den Mitarbeiter zu allen offenen Punkten dieses Skript-Auftrags, '
  + 'bis ihr ein gemeinsames Verstaendnis erreicht habt. Wenn eine Frage durch die vorliegenden '
  + 'CRM-Daten beantwortbar ist, beantworte sie selbst aus den Daten, statt sie zu stellen. '
  + 'Wichtigster Punkt: der CTA - erfinde NIE einen Registrierungs- oder Kaufweg, sondern frag nach. '
  + 'Maximal 2 Fragen pro Runde.';

function ladeLeitfaden() {
  const kandidaten = [
    path.resolve(__dirname, '_shared/prompts/skript-rueckfragen.md'),
    path.resolve(__dirname, '../../netlify/functions/_shared/prompts/skript-rueckfragen.md'),
    path.resolve(process.cwd(), 'netlify/functions/_shared/prompts/skript-rueckfragen.md')
  ];
  for (const p of kandidaten) {
    try {
      return fs.readFileSync(p, 'utf8');
    } catch (_) { /* naechsten Kandidaten versuchen */ }
  }
  console.warn('[skript-fragen] Leitfaden-Datei nicht gefunden, nutze Fallback');
  return LEITFADEN_FALLBACK;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
function buildFragenPrompt(ctx, params, history, briefingExtrakt = null) {
  // Block 1 (stabil, cachebar): Rolle + Leitfaden
  const stable = 'Du bist ein erfahrener Werbetexter fuer UGC- und Creator-Videos (TikTok, Instagram Reels) '
    + 'und bereitest die Generierung eines deutschen Video-Skripts (Hook, Hauptteil, CTA) vor. '
    + 'BEVOR das Skript geschrieben wird, klaerst du im Dialog mit einem Mitarbeiter alle offenen Punkte. '
    + 'Du schreibst in dieser Phase KEIN Skript.\n\n'
    + '# LEITFADEN FUER DIE RUECKFRAGEN\n'
    + ladeLeitfaden();

  // Block 2 (variabel): PDF-Briefing + Kontext + bisheriger Dialog
  let task = '';
  if (briefingExtrakt) {
    task += '# HOCHGELADENES PDF-BRIEFING (wichtigste Quelle - Fakten-Extrakt)\n'
      + briefingExtrakt + '\n\n';
  }
  task += '# VORLIEGENDE CRM-DATEN ZU DIESEM AUFTRAG\n';
  task += buildKontextText(ctx, params) || '(keine Daten vorhanden)\n';

  if (ctx.dna.length) {
    task += `\nAktive Skript-DNA-Layer: ${ctx.dna.map((d) => `${d.layer_typ} (v${d.version})`).join(', ')}\n`;
  }

  if (history.length) {
    task += '\n# BISHERIGER DIALOG\n';
    for (const h of history) {
      task += `${h.rolle === 'user' ? 'User' : 'Du'}: ${h.inhalt || ''}\n`;
    }
  }

  task += '\n# AUFGABE\n';
  task += history.some((h) => h.rolle === 'user')
    ? 'Werte die Antworten des Users aus. Pruefe anhand des Leitfadens, ob noch kritische Punkte offen sind.\n'
    : 'Das ist die erste Runde. Pruefe den Auftrag anhand des Leitfadens auf kritische Luecken.\n';

  task += '\n# AUSGABEFORMAT\nAntworte AUSSCHLIESSLICH mit einem JSON-Objekt in dieser Form:\n'
    + '{"nachricht": "deine Nachricht an den User (Deutsch, locker, kurz)", "fertig": true|false}\n'
    + 'Regeln:\n'
    + '- fertig=false: nachricht enthaelt deine naechste(n) Rueckfrage(n) (max. 2, die wichtigste zuerst).\n'
    + '- fertig=true: alle kritischen Punkte sind geklaert (oder es gab nichts zu klaeren). '
    + 'nachricht fasst in 1-2 Saetzen zusammen, was du aus den Antworten mitnimmst, und sagt, dass du bereit bist.\n'
    + '- Stelle KEINE Frage, deren Antwort bereits in den CRM-Daten oder im bisherigen Dialog steht.';

  return { stable, task };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const user = await verifyAuth(event, supabase);
  if (!user) return { statusCode: 401, body: 'Unauthorized' };

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (_) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { messageId } = payload;
  if (!messageId) return { statusCode: 400, body: 'messageId fehlt' };

  const fail = async (msg) => {
    await supabase.from('skript_chat_messages')
      .update({ status: 'error', error_message: msg })
      .eq('id', messageId);
  };

  try {
    const { data: message } = await supabase.from('skript_chat_messages')
      .select('*').eq('id', messageId).single();
    if (!message) return { statusCode: 404, body: 'Message nicht gefunden' };
    if (message.rolle !== 'assistant' || message.status !== 'pending') {
      return { statusCode: 409, body: 'Message ist kein pending Assistant-Job' };
    }

    await supabase.from('skript_chat_messages')
      .update({ status: 'running' }).eq('id', messageId);

    // Stub-Skript mit den Generator-Vorgaben laden
    const { data: skript } = await supabase.from('skripte')
      .select('*').eq('id', message.skript_id).single();
    if (!skript) throw new Error('Skript nicht gefunden');

    const params = skript.prompt_kontext?.generator_payload || {
      unternehmen_id: skript.unternehmen_id,
      marke_id: skript.marke_id,
      kampagne_id: skript.kampagne_id,
      produkt_id: skript.produkt_id,
      persona_id: skript.persona_id,
      branche_id: skript.branche_id,
      mit_dna: skript.mit_dna,
      video_idee: skript.video_idee,
      location: skript.location,
      video_laenge: skript.video_laenge,
      funnel_stufe: skript.funnel_stufe,
      tonalitaet: skript.tonalitaet
    };

    const ctx = await loadContext(supabase, params);

    // PDF-Briefing durchforsten (nur 1. Runde teuer, danach Cache am Skript)
    const briefingExtrakt = await ladeBriefingExtrakt(supabase, params, skript.id);

    // Bisheriger Rueckfragen-Dialog (ohne die pending Assistant-Message)
    const { data: historyRaw } = await supabase.from('skript_chat_messages')
      .select('rolle, inhalt')
      .eq('skript_id', message.skript_id).eq('aktion', 'rueckfrage')
      .neq('id', message.id)
      .order('created_at');
    const history = (historyRaw || []).filter((h) => (h.inhalt || '').trim());

    const { stable, task } = buildFragenPrompt(ctx, params, history, briefingExtrakt);

    const result = await callClaude({
      model: MODELS.edit_fast,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 2048
    });

    const parsed = extractJson(result.text);

    await supabase.from('skript_chat_messages').update({
      // 'vorschlag' = alles geklaert, UI zeigt "Skript jetzt generieren"
      status: parsed.fertig === true ? 'vorschlag' : 'fertig',
      inhalt: (parsed.nachricht || '').trim() || null,
      model: result.model,
      usage: result.usage
    }).eq('id', messageId);

    return { statusCode: 200 };
  } catch (error) {
    console.error(`[skript-fragen ${messageId}] Fehler:`, error.message);
    try { await fail(error.message); } catch (_) { /* noop */ }
    return { statusCode: 500 };
  }
};
