// skript-auftrag.js
// Serverseitige Haelfte des Skript-Auftrags: Job atomar claimen
// (Idempotenz), Skript-Zugriff autorisieren (Service Role umgeht RLS),
// laufende Auftraege pro Skript erkennen. Der Schreib-Adapter fuer
// Fortschritt/Logs bleibt job-updater.js.

const { setThinking } = require('./thinking');

/**
 * Atomarer Claim: pending -> running. Liefert die Job-Row oder null, wenn
 * der Job bereits claimed/abgeschlossen ist (zweiter Trigger = 409).
 * skript_id wird sofort auf die Row geschrieben, damit der Job ab jetzt
 * auch ueber die Parent-Policy sichtbar ist.
 */
async function beansprucheJob(supabase, jobId, { skriptId = null } = {}) {
  const patch = { status: 'running' };
  if (skriptId) patch.skript_id = skriptId;
  const { data, error } = await supabase.from('skript_generation_jobs')
    .update(patch)
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`Job-Claim fehlgeschlagen: ${error.message}`);
  return data || null;
}

/**
 * Atomarer Claim fuer Chat-Auftraege (Edit/Fragen): pending -> running in
 * einem Update. Liefert die Row oder null, wenn sie bereits claimed oder
 * beendet ist - Netlify-Auto-Retry nach Gateway-Fehler und doppelte
 * Client-Invokes laufen damit ins Leere, statt Claude zweimal zu rufen.
 */
async function beansprucheNachricht(supabase, messageId) {
  const { data, error } = await supabase.from('skript_chat_messages')
    .update({ status: 'running' })
    .eq('id', messageId)
    .eq('rolle', 'assistant')
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`Message-Claim fehlgeschlagen: ${error.message}`);
  if (!data) return null;
  await setThinking(supabase, 'skript_chat_messages', messageId, {
    step: 'kontext',
    label: 'Ich lese Skript und Kontext…'
  });
  return data;
}

const OFFEN = ['pending', 'running'];

function warte(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Schreibt ein Update auf eine Chat-Message MIT Fehlerpruefung (supabase-js
 * wirft nicht, sondern liefert { error }) und einem Retry. Ohne das bleibt
 * eine Message still auf 'running', wenn das finale Update scheitert.
 * nurWennStatus (String oder Liste): Update nur, wenn die Row noch in diesem
 * Status ist - ein Abbruch durch den Nutzer wird so nie ueberschrieben.
 * Liefert true, wenn eine Row geschrieben wurde; false, wenn der Status-Filter
 * nicht mehr griff (z.B. cancelled). Wirft nach allen Versuchen.
 */
async function schreibeNachricht(supabase, messageId, patch, { nurWennStatus = null, versuche = 2, pauseMs = 400 } = {}) {
  let letzterFehler = null;
  for (let versuch = 1; versuch <= versuche; versuch++) {
    if (versuch > 1) await warte(pauseMs);
    let q = supabase.from('skript_chat_messages').update(patch).eq('id', messageId);
    if (Array.isArray(nurWennStatus)) q = q.in('status', nurWennStatus);
    else if (nurWennStatus) q = q.eq('status', nurWennStatus);
    const { data, error } = await q.select('id');
    if (!error) return (data || []).length > 0;
    letzterFehler = error;
    console.error(`[skript-auftrag ${messageId}] Update-Versuch ${versuch} fehlgeschlagen:`, error.message);
  }
  throw new Error(`Message-Update fehlgeschlagen: ${letzterFehler?.message || 'unbekannt'}`);
}

/** Fehlerstatus setzen, ohne einen Abbruch oder ein fertiges Ergebnis zu ueberschreiben. */
async function markiereNachrichtFehler(supabase, messageId, errorMessage) {
  return schreibeNachricht(
    supabase,
    messageId,
    { status: 'error', error_message: errorMessage },
    { nurWennStatus: OFFEN }
  );
}

/**
 * Sicherheitsnetz im finally: steht die geclaimte Message nach dem Lauf noch
 * auf 'running' (finales Update still gescheitert, Fehlerpfad selbst
 * gescheitert), wird sie auf error gesetzt. Der Nutzer sieht dann "Nochmal
 * versuchen" statt eines endlosen Wartens. Wirft nie.
 */
async function sichereNachrichtAbgeschlossen(supabase, messageId) {
  try {
    const { data } = await supabase.from('skript_chat_messages')
      .select('status').eq('id', messageId).maybeSingle();
    if (data?.status !== 'running') return false;
    console.error(`[skript-auftrag ${messageId}] Message nach dem Lauf noch running - setze error`);
    return await markiereNachrichtFehler(supabase, messageId, 'Antwort konnte nicht gespeichert werden – bitte nochmal versuchen.');
  } catch (err) {
    console.error(`[skript-auftrag ${messageId}] Sicherheitsnetz fehlgeschlagen:`, err.message);
    return false;
  }
}

/**
 * Scope-Pruefung serverseitig: requireInternal weist nur die Rolle nach,
 * RLS greift unter Service Role nicht. Ohne diesen Check koennte jeder
 * interne Token eine fremde skript_id/messageId triggern.
 */
async function autorisiereSkript(supabase, user, skriptId) {
  const { data, error } = await supabase.rpc('can_auth_user_access_skript', {
    p_auth_user_id: user.id,
    p_skript_id: skriptId
  });
  if (error) throw new Error(`Scope-Pruefung fehlgeschlagen: ${error.message}`);
  return data === true;
}

/**
 * Pro Skript nur ein laufender Generate. Nur 'running' zaehlen: 'pending'
 * heisst "angelegt, noch nicht getriggert" - der atomare Claim entscheidet
 * das Race zwischen zwei gleichzeitig angelegten Jobs.
 */
async function hatLaufendenJob(supabase, skriptId, ausserJobId) {
  let q = supabase.from('skript_generation_jobs')
    .select('id')
    .eq('skript_id', skriptId)
    .eq('status', 'running');
  if (ausserJobId) q = q.neq('id', ausserJobId);
  const { data, error } = await q.limit(1);
  if (error) throw new Error(`Lauf-Pruefung fehlgeschlagen: ${error.message}`);
  return (data || []).length > 0;
}

/** Abbruch-Checks: der Client storniert ueber ein Status-Update (RLS: eigene Jobs). */
async function istJobAbgebrochen(supabase, jobId) {
  const { data } = await supabase.from('skript_generation_jobs')
    .select('status').eq('id', jobId).maybeSingle();
  return data?.status === 'cancelled';
}

async function istNachrichtAbgebrochen(supabase, messageId) {
  const { data } = await supabase.from('skript_chat_messages')
    .select('status').eq('id', messageId).maybeSingle();
  return data?.status === 'cancelled';
}

module.exports = {
  beansprucheJob, beansprucheNachricht, autorisiereSkript, hatLaufendenJob,
  istJobAbgebrochen, istNachrichtAbgebrochen,
  schreibeNachricht, markiereNachrichtFehler, sichereNachrichtAbgeschlossen
};
