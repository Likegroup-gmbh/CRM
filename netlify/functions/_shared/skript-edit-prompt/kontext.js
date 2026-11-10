// skript-edit-prompt/kontext.js
// Edit-Kontext laden: Skript-Row, Verlauf, Regie-Modus und Hook-Sperre.

const { loadContext } = require('../skript-context');
const { ladeGesperrtenHook } = require('../hook-sperre');
const { VERLAUF_SKIP } = require('./verlauf');

/** Visual-Button oder markierte Visual-Spalte – nicht die Spoken-Spalte. */
function brauchtVisualStil(message) {
  return message?.aktion === 'visuell' || !!message?.ist_visuell;
}

/**
 * Modus-Slug: Message zuerst, sonst letzter Visual-Job dieses Skripts
 * (gleiche Sektion bevorzugt).
 */
async function resolveModusSlug(supabase, message) {
  if (message?.modus) return message.modus;
  if (!brauchtVisualStil(message) || !message?.skript_id) return null;

  let q = supabase.from('skript_chat_messages')
    .select('modus, sektion')
    .eq('skript_id', message.skript_id)
    .not('modus', 'is', null)
    .order('created_at', { ascending: false })
    .limit(12);
  if (message.id) q = q.neq('id', message.id);

  const { data } = await q;
  const rows = (data || []).filter((r) => r.modus);
  if (!rows.length) return null;
  const sektion = message.sektion;
  const same = sektion && sektion !== 'gesamt'
    ? rows.find((r) => r.sektion === sektion)
    : null;
  return (same || rows[0]).modus;
}

// ---------------------------------------------------------------------------
// Kontext: derselbe Loader wie Generierung und Rueckfragen (loadContext),
// plus Verlauf und geklaerte Rueckfragen. Spoken-Beispiele bewusst NICHT
// (Edit bleibt lokal).
// ---------------------------------------------------------------------------
// Enge Spalten statt select('*'): der Edit-Prompt braucht nur die
// Skript-Texte, die Meta-Vorgaben und die Scope-/Kontext-IDs.
const EDIT_SKRIPT_COLS = 'id, titel, hook, hook_visuell, hauptteil, hauptteil_visuell, cta, cta_visuell, '
  + 'hook_variante_1, hook_variante_2, hook_variante_3, inhalt_md, '
  + 'tonalitaet, video_laenge, funnel_stufe, video_idee, location, regieanweisung, prompt_kontext, festlegungen, festgezogen, '
  + 'branche_id, persona_id, marke_id, briefing_id, bereich, unternehmen_id, kampagne_id, produkt_id, strategie_item_id';

const EDIT_VERLAUF_LIMIT = 12;

/**
 * loadContext-Params aus der Skript-Row (Stand nach Edits), nicht aus dem
 * generator_payload.
 */
function editParams(skript) {
  const pk = skript?.prompt_kontext || {};
  return {
    unternehmen_id: skript?.unternehmen_id || null,
    marke_id: skript?.marke_id || null,
    kampagne_id: skript?.kampagne_id || null,
    produkt_id: skript?.produkt_id || null,
    persona_id: skript?.persona_id || null,
    branche_id: skript?.branche_id || null,
    briefing_id: skript?.briefing_id || null,
    bereich: skript?.bereich || null,
    video_idee: skript?.video_idee || null,
    strategie_item_id: skript?.strategie_item_id || pk.generator_payload?.strategie_item_id || null,
    location: skript?.location || null,
    video_laenge: skript?.video_laenge || null,
    funnel_stufe: skript?.funnel_stufe || null,
    tonalitaet: skript?.tonalitaet || null,
    referenz_video: pk.referenz_video || pk.generator_payload?.referenz_video || null
  };
}

/** Neue Geschichte sieht nur die Karte. Alle anderen Aufträge sehen die Vorlage nicht. */
function editKontextParams(skript, message) {
  const params = editParams(skript);
  params.nur_karte = true;
  if (message?.aktion === 'neue_geschichte') {
    params.referenz_karte = skript?.prompt_kontext?.referenz_karte || null;
  } else {
    params.referenz_video = null;
    params.referenz_karte = null;
  }
  return params;
}

async function loadEditContext(supabase, message) {
  const skriptPromise = supabase.from('skripte')
    .select(EDIT_SKRIPT_COLS)
    .eq('id', message.skript_id).single();

  // Chat-Verlauf (letzte 12 lebende Messages VOR der pending Assistant-Message).
  // Rueckfragen kommen separat und ohne Limit.
  const historyPromise = supabase.from('skript_chat_messages')
    .select('rolle, inhalt, aktion, sektion, ist_visuell, selektion_text, vorschlag_text, aenderungen, status, created_at, updated_at')
    .eq('skript_id', message.skript_id)
    .neq('id', message.id)
    .or('aktion.is.null,aktion.neq.rueckfrage')
    .not('status', 'in', `(${[...VERLAUF_SKIP].join(',')})`)
    .order('created_at', { ascending: false })
    .limit(EDIT_VERLAUF_LIMIT);

  const [{ data: skript }, { data: historyRaw }] = await Promise.all([
    skriptPromise, historyPromise
  ]);
  if (!skript) throw new Error('Skript nicht gefunden');

  const history = (historyRaw || []).reverse();
  // Die User-Message dieses Turns (Paar zur pending Assistant-Message) steht
  // bereits unter # AUFTRAG - aus der History streichen, sonst Duplikat
  const last = history[history.length - 1];
  if (last && last.rolle === 'user' && last.aktion === message.aktion && last.inhalt === message.inhalt) {
    history.pop();
  }

  const modusPromise = (async () => {
    if (!brauchtVisualStil(message)) return null;
    const slug = await resolveModusSlug(supabase, message);
    if (!slug) return null;
    const { data } = await supabase.from('skript_modi')
      .select('slug, name, inhalt')
      .eq('slug', slug)
      .eq('status', 'aktiv')
      .maybeSingle();
    return data || null;
  })();

  const [kontext, modus, gesperrterHook] = await Promise.all([
    loadContext(supabase, editParams(skript)),
    modusPromise,
    // Hook-Sperre (ADR 0054): live aus der Videoidee, nicht aus einer Kopie am Skript
    ladeGesperrtenHook(supabase, editParams(skript).strategie_item_id)
  ]);

  return { skript, history, kontext, modus, gesperrterHook };
}

module.exports = {
  brauchtVisualStil,
  resolveModusSlug,
  EDIT_VERLAUF_LIMIT,
  editParams,
  editKontextParams,
  loadEditContext
};
