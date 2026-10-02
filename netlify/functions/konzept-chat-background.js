// konzept-chat-background.js
// Liky-Chat am Konzept: Feedback an Videoidee-Vorschlaege (ADR 0036).
// Die User-Message in konzept_chat_messages IST der Job (Muster wie
// skript_chat_messages): der Client legt sie an, POSTet { messageId } hierher
// und pollt die Zeile. Diese Function plant die Aktionen per Tool-Call,
// fuehrt sie aus und schreibt die Assistant-Antwort in dieselbe Zeile.
//
// Aktionen: umschreiben (beschreibung derselben Zeile neu), verwerfen
// (delete), neu (additiv), ersetzen (erst entwerfen, dann verwerfen).
// Uebernehmen laeuft nie ueber den Chat - das bleibt der Button.

const { createClient } = require('@supabase/supabase-js');
const { callClaude, MODELS } = require('./_shared/anthropic');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');
const { starteKiRequest } = require('./_shared/ki-log');
const { appendStep } = require('./_shared/thinking');
const {
  normalisiereAnzahl,
  konzeptTool,
  loadIdeeInput,
  buildPrompt,
  validateIdeen,
  leerFehler,
  ideenDiagnose,
  erstzeile,
  buildVorschlagInsert
} = require('./_shared/strategie-idee');
const { leitplankenAusBriefing } = require('./_shared/skript-context/briefing-felder');

const PLAN_TOOL = {
  name: 'feedback_planen',
  description: 'Plant, was mit den Videoidee-Vorschlaegen eines Konzepts passiert.',
  input_schema: {
    type: 'object',
    properties: {
      aktionen: {
        type: 'array',
        description: 'Die Aktionen in Ausfuehrungsreihenfolge.',
        items: {
          type: 'object',
          properties: {
            typ: {
              type: 'string',
              enum: ['umschreiben', 'verwerfen', 'neu', 'ersetzen'],
              description: 'umschreiben: Beschreibung der genannten Vorschlaege neu schreiben, Zeile bleibt. verwerfen: genannte Vorschlaege loeschen. neu: zusaetzliche Vorschlaege entwerfen. ersetzen: genannte verwerfen und stattdessen neue entwerfen.'
            },
            vorschlag_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs aus der Liste der aktuellen Vorschlaege. Leer bei neu.'
            },
            anzahl: {
              type: 'integer',
              description: 'Nur bei neu/ersetzen. Fehlt die Zahl im Text, bei ersetzen die Anzahl der genannten, sonst null.'
            },
            anweisung: {
              type: 'string',
              description: 'Was sich inhaltlich aendern soll, in den Worten der Nachricht.'
            }
          },
          required: ['typ']
        }
      },
      rueckfrage: {
        type: 'string',
        description: 'Gesetzt, wenn die Nachricht nicht eindeutig zuzuordnen ist: welche Idee gemeint ist, oder was genau passieren soll. Dann keine Aktionen.'
      },
      antwort: {
        type: 'string',
        description: 'Kurze Antwort an das Team, was passiert ist. Wird bei Aktionen serverseitig aus dem Ergebnis gebaut; hier nur fuer reine Rueckfragen ohne Aktion relevant.'
      }
    },
    required: ['aktionen']
  }
};

const REWRITE_TOOL = {
  name: 'idee_umschreiben',
  description: 'Schreibt die Beschreibung eines Videoidee-Vorschlags neu.',
  input_schema: {
    type: 'object',
    properties: {
      titel: { type: 'string', description: 'Kurzer merkbarer Titel, der Hook in einem Satz. Keine Anfuehrungszeichen.' },
      pain_point: { type: 'string', description: 'Welchen Pain die Idee angreift, ein bis zwei Saetze.' },
      hook: { type: 'string', description: 'Gesprochener oder sichtbarer Aufmacher der ersten Sekunden.' },
      kernbotschaft: { type: 'string', description: 'Was haengen bleiben soll, ein Satz.' },
      ablauf: { type: 'string', description: 'Grober Ablauf in zwei bis vier Schritten, keine Shotliste.' }
    },
    required: ['titel', 'pain_point', 'hook', 'kernbotschaft', 'ablauf']
  }
};

function capText(value, max = 300) {
  const s = String(value || '').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function fmtVorschlagFuerPlan(v, index) {
  return [
    `[${index + 1}] id=${v.id}`,
    `Titel: ${erstzeile(v.beschreibung)}`,
    `Beschreibung: ${capText(v.beschreibung, 500)}`
  ].join('\n');
}

function buildPlanPrompt({ vorschlaege, history, nachricht }) {
  const liste = vorschlaege.length
    ? vorschlaege.map(fmtVorschlagFuerPlan).join('\n\n')
    : '(keine offenen Vorschlaege)';
  const verlauf = (history || [])
    .map((m) => `${m.rolle === 'user' ? 'Team' : 'Liky'}: ${capText(m.inhalt, 300)}`)
    .join('\n');

  const stable = `Du bist Liky, der KI-Assistent einer Creator-Agentur, und planst Feedback an Videoidee-Vorschlaegen eines Konzepts.

Regeln:
- Es gibt nur die aufgelisteten Vorschlaege. Uebernommene Videoideen und alles andere im CRM sind tabu.
- Uebernehmen geht nicht ueber den Chat. Wird danach gefragt, sagt die Antwort, dass der Button in der Tabelle uebernimmt.
- "die", "die zweite", "nochmal" beziehen sich auf den Verlauf und die Liste. Nur eindeutige Treffer bekommen eine Aktion.
- Kein Treffer, mehrere moegliche Treffer oder ein unklarer Wunsch: rueckfrage setzen, keine Aktion.
- "ueberarbeiten", "umschreiben", "aendern", "verbessern" genannter Nummern: umschreiben dieser Vorschlaege. Die Nummern [1], [2], ... in der Liste oben sind die Nummern, die das Team in der Tabelle sieht.
- umschreiben und verwerfen/ersetzen derselben Idee in einer Nachricht: die Idee wird nicht umgeschrieben, sie geht weg.
- neu nur, wenn ausdruecklich zusaetzliche Ideen gewuenscht sind ("noch drei dazu", "weitere Ideen"). Ueberarbeiten ist nie neu.
- neu ohne Zahl im Text: anzahl null, der Client fragt die Zahl ueber die Karte ab.
- Reine Diskussion oder Frage ohne Aenderungswunsch: rueckfrage, keine Aktion.
- Antworten kurz, Deutsch, Du-Form.`;

  const task = `Aktuelle Vorschlaege:
${liste}

Bisheriger Verlauf:
${verlauf || '(kein Verlauf)'}

Neue Nachricht des Teams:
${nachricht}

Plane die Aktionen ueber das Tool.`;

  return { stable, task };
}

function buildRewritePrompt({ vorschlag, anweisung, input }) {
  const { donts } = leitplankenAusBriefing(input?.briefing);
  const ausschluesse = String(input?.briefing?.vorgaben_ausschluesse || '').trim();
  const produktText = (input?.produkte || [])
    .map((p) => [p?.name, p?.usp, p?.loesung].filter(Boolean).join(' | '))
    .filter(Boolean)
    .join('\n');

  const stable = `Du schreibst die Beschreibung eines Videoidee-Vorschlags einer Creator-Agentur neu.
Situation, Pain und Aussage der Idee bleiben. Der Wortlaut darf sich aendern.
Keine erfundenen Produktfeatures, Preise, Claims. Donts sind Verbote.`;

  const grenzen = [
    donts ? `Donts:\n${donts}` : '',
    ausschluesse ? `Ausschluesse:\n${ausschluesse}` : '',
    produktText ? `Produktfakten:\n${produktText}` : ''
  ].filter(Boolean).join('\n\n');

  const task = `Bestehender Videoidee-Vorschlag:
${vorschlag.beschreibung}

Anweisung des Teams:
${anweisung || 'Besser formulieren.'}
${grenzen ? `\n${grenzen}\n` : ''}
Schreibe genau diesen Vorschlag neu. Titel darf sich aendern, wenn der Hook sich aendert. Gib das Ergebnis ueber das Tool ab.`;
  return { stable, task };
}

/** Ideen entwerfen und inserieren. Gibt die neuen Zeilen zurueck. */
async function entwerfeUndInseriere(supabase, { strategieId, anzahl, hinweis, benutzerId, kiFeature, entwerfen }) {
  const input = await loadIdeeInput(supabase, strategieId);
  const ki = await starteKiRequest(supabase, { userId: kiFeature.userId, feature: 'strategie_idee' });
  let letzterResult = null;
  try {
    const { stable, task } = buildPrompt({ ...input, anzahl, hinweis });
    const tool = konzeptTool(anzahl);
    const rufe = entwerfen || (() => callClaude({
      model: MODELS.konzept,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 8000,
      tool,
      toolForced: true
    }));

    letzterResult = await rufe();
    let geprueft = letzterResult.json
      ? validateIdeen(letzterResult.json, { ausschluss: input.ausschluss, anzahl })
      : { ideen: [], verworfen: [] };

    if (!geprueft.ideen.length) {
      console.warn('konzept-chat: erster Lauf ohne Ideen:', ideenDiagnose(letzterResult.json, geprueft, letzterResult));
      letzterResult = await rufe();
      geprueft = letzterResult.json
        ? validateIdeen(letzterResult.json, { ausschluss: input.ausschluss, anzahl })
        : { ideen: [], verworfen: [] };
    }

    if (!geprueft.ideen.length) {
      if (!letzterResult.json) throw new Error('Die KI hat kein strukturiertes Ergebnis geliefert');
      throw new Error(leerFehler(geprueft));
    }

    await ki.abschliessen({ model: letzterResult.model, usage: letzterResult.usage });

    const { data: maxRow } = await supabase.from('strategie_items')
      .select('sortierung')
      .eq('strategie_id', strategieId)
      .order('sortierung', { ascending: false })
      .limit(1)
      .maybeSingle();
    let sortierung = Number.isFinite(maxRow?.sortierung) ? maxRow.sortierung + 1 : 0;

    const rows = geprueft.ideen.map((idee) => buildVorschlagInsert({
      strategieId,
      idee,
      sortierung: sortierung++,
      createdBy: benutzerId
    }));
    const { data: inserted, error } = await supabase.from('strategie_items').insert(rows).select('id');
    if (error) throw new Error(`Ideen konnten nicht gespeichert werden: ${error.message}`);
    return { neu: inserted || [], input };
  } catch (error) {
    await ki.fehlgeschlagen(error, { model: letzterResult?.model, usage: letzterResult?.usage });
    throw error;
  }
}

async function schreibeUm(supabase, { vorschlag, anweisung, input, userId }) {
  const ki = await starteKiRequest(supabase, { userId, feature: 'strategie_idee' });
  let result = null;
  try {
    const { stable, task } = buildRewritePrompt({ vorschlag, anweisung, input });
    result = await callClaude({
      model: MODELS.konzept,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 4000,
      tool: REWRITE_TOOL,
      toolForced: true
    });
    const idee = result.json || {};
    const geprueft = validateIdeen({ ideen: [idee] }, { ausschluss: [], anzahl: 1 });
    if (!geprueft.ideen.length) throw new Error('Die KI hat keinen tragfaehigen Text geliefert');

    const { error } = await supabase.from('strategie_items')
      .update({
        beschreibung: geprueft.ideen[0].beschreibung,
        beschreibung_quelle: 'ki'
      })
      .eq('id', vorschlag.id)
      .eq('ist_vorschlag', true);
    if (error) throw new Error(`Umschreiben fehlgeschlagen: ${error.message}`);

    await ki.abschliessen({ model: result.model, usage: result.usage });
    return geprueft.ideen[0];
  } catch (error) {
    await ki.fehlgeschlagen(error, { model: result?.model, usage: result?.usage });
    throw error;
  }
}

async function verwerfe(supabase, ids) {
  const { error } = await supabase.from('strategie_items')
    .delete()
    .in('id', ids)
    .eq('ist_vorschlag', true);
  if (error) throw new Error(`Verwerfen fehlgeschlagen: ${error.message}`);
}

/**
 * Fuehrt den geplanten Aktionen-Mix aus. Rein sequenziell, Rueckfrage oder
 * leerer Plan enden ohne Schreibzugriff. Ersetzen entwirft zuerst und loescht
 * die genannten Zeilen erst, wenn die neuen liegen (ADR 0036).
 */
async function fuehrePlanAus(supabase, plan, ctx) {
  const { vorschlaege, gueltigeIds, strategieId, nachricht, benutzerId, userId, schreibeStep } = ctx;
  const aktionen = Array.isArray(plan?.aktionen) ? plan.aktionen : [];

  if (plan?.rueckfrage || !aktionen.length) {
    return {
      rueckfrage: String(plan?.rueckfrage || plan?.antwort || 'Woran soll ich arbeiten?').trim(),
      umgeschrieben: [],
      verworfen: 0,
      neu: [],
      ersetzt: { alt: [], neu: [] },
      brauchtAnzahl: false
    };
  }

  const ergebnis = {
    rueckfrage: null,
    umgeschrieben: [],
    verworfen: 0,
    neu: [],
    ersetzt: { alt: [], neu: [] },
    brauchtAnzahl: false
  };
  const wegIds = new Set();
  let ideeInput = null;

  for (const aktion of aktionen) {
    const ids = (Array.isArray(aktion.vorschlag_ids) ? aktion.vorschlag_ids : [])
      .filter((id) => gueltigeIds.has(id));
    const anweisung = String(aktion.anweisung || '').trim();

    if (aktion.typ === 'umschreiben') {
      const ziele = ids.filter((id) => !wegIds.has(id));
      if (!ziele.length) continue;
      schreibeStep('umschreiben', ziele.length === 1
        ? 'Ich schreibe die Idee um'
        : `Ich schreibe ${ziele.length} Ideen um`);
      if (!ideeInput) ideeInput = await loadIdeeInput(supabase, strategieId);
      for (const id of ziele) {
        const vorschlag = vorschlaege.find((v) => v.id === id);
        if (!vorschlag) continue;
        await schreibeUm(supabase, { vorschlag, anweisung, input: ideeInput, userId });
        ergebnis.umgeschrieben.push(id);
      }
    }

    if (aktion.typ === 'verwerfen') {
      const ziele = ids.filter((id) => !wegIds.has(id));
      if (!ziele.length) continue;
      schreibeStep('verwerfen', ziele.length === 1
        ? 'Ich verwerfe die Idee'
        : `Ich verwerfe ${ziele.length} Ideen`);
      await verwerfe(supabase, ziele);
      ziele.forEach((id) => wegIds.add(id));
      ergebnis.verworfen += ziele.length;
    }

    if (aktion.typ === 'neu' || aktion.typ === 'ersetzen') {
      let anzahl = Number.isInteger(aktion.anzahl) ? aktion.anzahl : null;
      if (aktion.typ === 'ersetzen' && anzahl == null && ids.length) anzahl = ids.length;
      if (anzahl == null) {
        ergebnis.brauchtAnzahl = true;
        continue;
      }
      anzahl = normalisiereAnzahl({ anzahl });

      schreibeStep('generieren', `Liky entwirft ${anzahl} ${anzahl === 1 ? 'Videoidee' : 'Videoideen'}`);
      const { neu, input } = await entwerfeUndInseriere(supabase, {
        strategieId,
        anzahl,
        hinweis: anweisung || nachricht,
        benutzerId,
        kiFeature: { userId },
        entwerfen: ctx.entwerfen
      });
      ideeInput = ideeInput || input;

      if (aktion.typ === 'ersetzen') {
        const ziele = ids.filter((id) => !wegIds.has(id));
        if (ziele.length) {
          schreibeStep('verwerfen', 'Ich loese die alten Vorschlaege ab');
          await verwerfe(supabase, ziele);
          ziele.forEach((id) => wegIds.add(id));
          ergebnis.ersetzt.alt.push(...ziele);
        }
        ergebnis.ersetzt.neu.push(...neu.map((r) => r.id));
      } else {
        ergebnis.neu.push(...neu.map((r) => r.id));
      }
    }
  }

  return ergebnis;
}

/** Kurze Antwort an das Team aus dem Ausfuehrungsergebnis. */
function fasseErgebnis(ergebnis) {
  const teile = [];
  if (ergebnis.umgeschrieben.length) {
    teile.push(ergebnis.umgeschrieben.length === 1
      ? '1 Idee umgeschrieben'
      : `${ergebnis.umgeschrieben.length} Ideen umgeschrieben`);
  }
  if (ergebnis.verworfen) {
    teile.push(ergebnis.verworfen === 1 ? '1 Idee verworfen' : `${ergebnis.verworfen} Ideen verworfen`);
  }
  if (ergebnis.neu.length) {
    teile.push(ergebnis.neu.length === 1
      ? '1 neue Idee liegt in der Tabelle'
      : `${ergebnis.neu.length} neue Ideen liegen in der Tabelle`);
  }
  if (ergebnis.ersetzt.neu.length) {
    teile.push(`${ergebnis.ersetzt.alt.length} durch ${ergebnis.ersetzt.neu.length} neue ersetzt`);
  }
  return teile.length ? `${teile.join(', ')}.` : 'Nichts zu tun – die Zuordnung war nicht eindeutig.';
}

module.exports._internals = { fuehrePlanAus, fasseErgebnis, buildPlanPrompt, buildRewritePrompt, PLAN_TOOL };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ konzept-chat-background: Supabase-Konfiguration fehlt');
    return { statusCode: 500 };
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  let messageId;
  try {
    ({ messageId } = JSON.parse(event.body || '{}'));
  } catch (_) {
    return { statusCode: 400 };
  }
  if (!messageId) return { statusCode: 400 };

  const markError = async (message) => {
    try {
      await supabase.from('konzept_chat_messages')
        .update({ status: 'error', error_message: message })
        .eq('id', messageId)
        .in('status', ['pending', 'running']);
    } catch (e) {
      console.error(`[${messageId}] Fehler-Update fehlgeschlagen:`, e.message);
    }
  };

  const auth = await verifyAuth(event, supabase);
  if (!auth.user) {
    const body = authErrorBody(auth);
    if (auth.code === 'auth_unavailable') await markError(body.error);
    return {
      statusCode: auth.code === 'auth_unavailable' ? 503 : 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    };
  }
  const { user } = auth;

  const { data: message } = await supabase.from('konzept_chat_messages')
    .select('id, strategie_id, rolle, inhalt, status, created_by')
    .eq('id', messageId).single();
  if (!message || message.created_by !== user.id) {
    console.error(`❌ konzept-chat-background: Message ${messageId} nicht gefunden oder fremd`);
    return { statusCode: 404 };
  }
  if (message.rolle !== 'user' || message.status !== 'pending') {
    console.warn(`⚠️ konzept-chat-background: Message ${messageId} ist ${message.rolle}/${message.status}, kein zweiter Lauf`);
    return { statusCode: 409 };
  }

  let progressSteps = [];
  let queue = Promise.resolve();
  const schreibeStep = (step, label) => {
    progressSteps = appendStep(progressSteps, { step, label });
    const steps = progressSteps;
    queue = queue
      .then(() => supabase.from('konzept_chat_messages').update({
        status: 'running',
        progress_steps: steps
      }).eq('id', messageId))
      .catch((e) => console.error(`[${messageId}] Progress-Update fehlgeschlagen:`, e.message));
  };

  const antworte = async ({ inhalt, bezugIds = [], brauchtAnzahl = false }) => {
    await queue;
    await supabase.from('konzept_chat_messages')
      .update({ status: 'fertig', inhalt, bezug_ids: bezugIds, braucht_anzahl: brauchtAnzahl })
      .eq('id', messageId);
  };

  schreibeStep('planen', 'Ich ordne dein Feedback zu');

  let ki = null;
  let letzterResult = null;
  try {
    const { data: vorschlaege } = await supabase.from('strategie_items')
      .select('id, beschreibung')
      .eq('strategie_id', message.strategie_id)
      .eq('ist_vorschlag', true)
      .order('sortierung');

    const { data: history } = await supabase.from('konzept_chat_messages')
      .select('rolle, inhalt')
      .eq('strategie_id', message.strategie_id)
      .eq('created_by', user.id)
      .neq('id', messageId)
      .order('created_at', { ascending: false })
      .limit(10);

    const { stable, task } = buildPlanPrompt({
      vorschlaege: vorschlaege || [],
      history: (history || []).reverse(),
      nachricht: message.inhalt || ''
    });

    ki = await starteKiRequest(supabase, { userId: user.id, feature: 'strategie_idee' });
    letzterResult = await callClaude({
      model: MODELS.konzept,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt: task,
      maxTokens: 2000,
      tool: PLAN_TOOL,
      toolForced: true
    });
    await ki.abschliessen({ model: letzterResult.model, usage: letzterResult.usage });
    ki = null;

    const plan = letzterResult.json || {};
    const gueltigeIds = new Set((vorschlaege || []).map((v) => v.id));

    const { data: benutzer } = await supabase.from('benutzer')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    const ergebnis = await fuehrePlanAus(supabase, plan, {
      vorschlaege: vorschlaege || [],
      gueltigeIds,
      strategieId: message.strategie_id,
      nachricht: message.inhalt || '',
      benutzerId: benutzer?.id || null,
      userId: user.id,
      schreibeStep
    });

    if (ergebnis.rueckfrage) {
      await antworte({ inhalt: ergebnis.rueckfrage });
      return { statusCode: 200 };
    }

    await antworte({
      inhalt: fasseErgebnis(ergebnis),
      bezugIds: [
        ...ergebnis.umgeschrieben,
        ...ergebnis.neu,
        ...ergebnis.ersetzt.neu
      ],
      brauchtAnzahl: ergebnis.brauchtAnzahl
    });
    return { statusCode: 200 };
  } catch (error) {
    console.error(`❌ konzept-chat-background [${messageId}]:`, error.message);
    if (ki) await ki.fehlgeschlagen(error, { model: letzterResult?.model, usage: letzterResult?.usage });
    await queue;
    await markError(error.message);
    return { statusCode: 500 };
  }
};
