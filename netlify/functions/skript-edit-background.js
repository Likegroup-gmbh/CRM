// Netlify Background Function: Skript-Editor (Chat-basierte Ueberarbeitung)
// Die pending Assistant-Message in skript_chat_messages IST der Job:
//   pending -> running -> vorschlag (mit vorschlag_text) | fertig (nur Antwort) | error
// Modellwahl pro Aufgabe: Kuerzen/Laenger -> edit_fast (Haiku),
// Neu schreiben / Anderer Ton / freier Chat -> edit_write (Sonnet).

const { createClient } = require('@supabase/supabase-js');
const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');

async function verifyAuth(event, supabase) {
  const authHeader = (event.headers || {}).authorization || (event.headers || {}).Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

const AKTION_LABELS = {
  neu_schreiben: 'Neu schreiben',
  kuerzen: 'Kürzen',
  laenger: 'Länger machen',
  anderer_ton: 'Anderer Ton',
  chat: 'Freies Feedback'
};

const AKTION_ANWEISUNGEN = {
  neu_schreiben: 'Schreibe die markierte Stelle komplett neu. Gleiche Kernaussage, aber frische Formulierung.',
  kuerzen: 'Kürze die markierte Stelle deutlich. Kernaussage und Ton beibehalten, Füllwörter und Redundanz raus.',
  laenger: 'Baue die markierte Stelle aus: mehr Detail, mehr Emotion oder ein konkretes Beispiel – ohne zu labern.',
  anderer_ton: 'Schreibe die markierte Stelle in einem anderen Ton um. Beachte die Ton-Vorgabe des Users, falls vorhanden.',
  chat: 'Reagiere auf das Feedback des Users. Wenn eine konkrete Textänderung sinnvoll ist, schlage sie vor. Wenn dir Informationen fehlen (z.B. wie ein CTA konkret aussehen soll), stelle eine Rückfrage statt etwas zu erfinden.'
};

// ---------------------------------------------------------------------------
// Kontext: bewusst schlank (Skript + Namen + aktive DNA), KEIN voller
// Generierungs-Kontext wie bei skript-generate-background.
// ---------------------------------------------------------------------------
async function loadEditContext(supabase, message) {
  const { data: skript } = await supabase.from('skripte')
    .select('*, unternehmen(firmenname), marke(markenname), produkt(name), personas(name, beschreibung), branchen(name)')
    .eq('id', message.skript_id).single();
  if (!skript) throw new Error('Skript nicht gefunden');

  // Chat-Verlauf (letzte 12 Messages VOR der pending Assistant-Message)
  const { data: history } = await supabase.from('skript_chat_messages')
    .select('rolle, inhalt, aktion, sektion, selektion_text, vorschlag_text, status')
    .eq('skript_id', message.skript_id)
    .neq('id', message.id)
    .order('created_at', { ascending: false })
    .limit(12);

  // Aktive DNA-Layer passend zum Skript-Kontext (fuer Ton-Konsistenz)
  let dna = [];
  if (skript.mit_dna !== false) {
    const orParts = ['layer_typ.eq.global'];
    if (skript.branche_id) orParts.push(`and(layer_typ.eq.branche,branche_id.eq.${skript.branche_id})`);
    if (skript.persona_id) orParts.push(`and(layer_typ.eq.zielgruppe,persona_id.eq.${skript.persona_id})`);
    if (skript.marke_id) orParts.push(`and(layer_typ.eq.marke,marke_id.eq.${skript.marke_id})`);
    const { data } = await supabase.from('skript_dna')
      .select('name, layer_typ, version, inhalt')
      .eq('status', 'aktiv')
      .or(orParts.join(','));
    const order = { global: 0, branche: 1, zielgruppe: 2, marke: 3 };
    dna = (data || []).sort((a, b) => order[a.layer_typ] - order[b.layer_typ]);
  }

  return { skript, history: (history || []).reverse(), dna };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
function buildEditPrompt(ctx, message) {
  const { skript, history, dna } = ctx;

  // Block 1 (stabil, cachebar): Rolle + DNA
  let stable = 'Du bist ein erfahrener Werbetexter fuer UGC- und Creator-Videos (TikTok, Instagram Reels) '
    + 'und ueberarbeitest ein bestehendes deutsches Video-Skript im Dialog mit einem Mitarbeiter. '
    + 'Du aenderst NUR was verlangt wird und erhaeltst Ton und Stil des restlichen Skripts. '
    + 'Der Text ist gesprochener Creator-Text, keine Werbesprache.\n';

  if (dna.length) {
    stable += '\n# SKRIPT-DNA (verbindliches Regelwerk, geschichtet - spaetere Layer haben Vorrang)\n';
    for (const d of dna) {
      stable += `\n--- ${d.name ? `"${d.name}" - ` : ''}Layer: ${d.layer_typ} (v${d.version}) ---\n${d.inhalt}\n`;
    }
  }

  // Block 2 (variabel): Skript + Verlauf + Auftrag
  let task = '# AKTUELLES SKRIPT\n';
  if (skript.titel) task += `Titel: ${skript.titel}\n`;
  task += `HOOK:\n${skript.hook || '-'}\n\nHAUPTTEIL:\n${skript.hauptteil || '-'}\n\nCTA:\n${skript.cta || '-'}\n`;

  const meta = [
    skript.marke?.markenname ? `Marke: ${skript.marke.markenname}` : null,
    skript.unternehmen?.firmenname ? `Unternehmen: ${skript.unternehmen.firmenname}` : null,
    skript.produkt?.name ? `Produkt: ${skript.produkt.name}` : null,
    skript.personas?.name ? `Zielgruppe: ${skript.personas.name}` : null,
    skript.branchen?.name ? `Branche: ${skript.branchen.name}` : null,
    skript.tonalitaet ? `Tonalitaet: ${skript.tonalitaet}` : null,
    skript.funnel_stufe ? `Funnel-Stufe: ${skript.funnel_stufe}` : null
  ].filter(Boolean);
  if (meta.length) task += `\n# KONTEXT\n${meta.join('\n')}\n`;

  if (history.length) {
    task += '\n# BISHERIGER CHAT-VERLAUF\n';
    for (const h of history) {
      if (h.rolle === 'user') {
        const label = h.aktion && h.aktion !== 'chat' ? `[${AKTION_LABELS[h.aktion]}${h.sektion ? ` / ${h.sektion}` : ''}] ` : '';
        task += `User: ${label}${h.inhalt || ''}${h.selektion_text ? `\n(markierte Stelle: "${h.selektion_text}")` : ''}\n`;
      } else {
        const outcome = h.status === 'angenommen' ? ' [Vorschlag wurde ANGENOMMEN]'
          : h.status === 'abgelehnt' ? ' [Vorschlag wurde ABGELEHNT]' : '';
        task += `Assistent: ${h.inhalt || ''}${h.vorschlag_text ? `\n(Vorschlag: "${h.vorschlag_text}")${outcome}` : ''}\n`;
      }
    }
  }

  task += '\n# AUFTRAG\n';
  task += `Aktion: ${AKTION_LABELS[message.aktion] || message.aktion}\n`;
  if (message.sektion && message.sektion !== 'gesamt') task += `Sektion: ${message.sektion.toUpperCase()}\n`;
  if (message.selektion_text) task += `Markierte Stelle:\n"""${message.selektion_text}"""\n`;
  if (message.inhalt) task += `Anweisung des Users: ${message.inhalt}\n`;
  task += `\n${AKTION_ANWEISUNGEN[message.aktion] || AKTION_ANWEISUNGEN.chat}\n`;

  task += '\n# AUSGABEFORMAT\nAntworte AUSSCHLIESSLICH mit einem JSON-Objekt in dieser Form:\n'
    + '{"antwort": "kurze Erklaerung fuer den User (1-3 Saetze, Deutsch)", '
    + '"sektion": "hook|hauptteil|cta|null", '
    + '"vorschlag_text": "neuer Text oder null"}\n'
    + 'Regeln:\n'
    + '- Wenn eine markierte Stelle vorliegt, ist vorschlag_text NUR der Ersatztext fuer genau diese Stelle (nicht die ganze Sektion).\n'
    + '- Ohne markierte Stelle, aber mit klarem Aenderungswunsch: vorschlag_text = komplette neue Version der betroffenen Sektion, sektion entsprechend setzen.\n'
    + '- Bei reinen Fragen/Rueckfragen: vorschlag_text = null, sektion = null.\n'
    + '- Schlage pro Antwort maximal EINE Aenderung vor.';

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

    const ctx = await loadEditContext(supabase, message);
    const { stable, task } = buildEditPrompt(ctx, message);

    // Modellwahl pro Aufgabe
    const model = ['kuerzen', 'laenger'].includes(message.aktion)
      ? MODELS.edit_fast
      : MODELS.edit_write;

    const result = await callClaude({
      model,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 2048
    });

    const parsed = extractJson(result.text);
    const vorschlag = (parsed.vorschlag_text || '').trim() || null;
    const sektion = ['hook', 'hauptteil', 'cta'].includes(parsed.sektion) ? parsed.sektion : message.sektion;

    await supabase.from('skript_chat_messages').update({
      // Vorschlag ohne konkrete Sektion kann nicht angewendet werden -> nur Antwort
      status: vorschlag && sektion && sektion !== 'gesamt' ? 'vorschlag' : 'fertig',
      inhalt: (parsed.antwort || '').trim() || null,
      vorschlag_text: vorschlag,
      sektion: sektion || message.sektion,
      model: result.model,
      usage: result.usage
    }).eq('id', messageId);

    return { statusCode: 200 };
  } catch (error) {
    console.error(`[skript-edit ${messageId}] Fehler:`, error.message);
    try { await fail(error.message); } catch (_) { /* noop */ }
    return { statusCode: 500 };
  }
};
