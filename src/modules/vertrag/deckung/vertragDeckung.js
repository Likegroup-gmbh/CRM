// vertragDeckung.js
// Ein Vertrag deckt mehrere Kooperationen desselben Creators in derselben Kampagne (ADR 0047).
// Reine Regeln (spiegeln die Trigger in supabase/migrations/20261010_vertrag_deckt_kooperationen.sql)
// und die Daten-Aktionen Verknuepfen, Loesen, Flag-Sync.

const KOOP_COLS = 'id, name, creator_id, kampagne_id, produktion_id, briefing_id, videoanzahl, '
  + 'einkaufspreis_netto, ksk_selbstzahler, ksk_betrag, created_at';

/** Spalten der Vertraege, die die Vertrag-Zelle in den Kooperationstabellen braucht. */
export const VERTRAG_ZELLE_COLS = 'id, name, typ, kooperation_id, datei_url, dropbox_file_url, unterschriebener_vertrag_url, is_draft, status, gesendet_am, created_at';

export const DECKUNG_GRUENDE = Object.freeze({
  nicht_gefunden: 'Vertrag oder Kooperation wurde nicht gefunden.',
  contracting: 'Contracting-Verträge decken keine Kooperationen.',
  abgelehnt: 'Der Vertrag ist abgelehnt.',
  anderer_creator: 'Der Vertrag gehört einem anderen Creator.',
  andere_kampagne: 'Der Vertrag gehört zu einer anderen Kampagne.',
  bereits_gedeckt: 'Die Kooperation hat schon einen Vertrag.',
  deckel: 'Die Videoanzahl des Vertrags reicht nicht aus.',
  loesen_rechnung: 'Zur Kooperation existiert schon eine Rechnung.',
  loesen_upload: 'Es ist schon ein Video hochgeladen.',
  letzte_kooperation: 'Der Vertrag braucht mindestens eine Kooperation.'
});

function zahl(wert) {
  const n = parseFloat(wert);
  return Number.isFinite(n) ? n : 0;
}

/** Videoanzahl, die der Vertrag nennt. 0 heisst: keine Videozahl am Vertrag, kein Deckel. */
export function vertragVideoLimit(vertrag) {
  return Math.max(0, parseInt(vertrag?.anzahl_videos, 10) || 0);
}

export function koopVideos(koop) {
  return Math.max(0, parseInt(koop?.videoanzahl, 10) || 0);
}

/** Summe, Rest und Passung des Videodeckels. `zusatz` ist eine Kooperation, die dazukommen soll. */
export function videoDeckung(vertrag, gedeckteKoops = [], zusatz = null) {
  const limit = vertragVideoLimit(vertrag);
  const summe = gedeckteKoops.reduce((s, k) => s + koopVideos(k), 0) + (zusatz ? koopVideos(zusatz) : 0);
  if (!limit) return { aktiv: false, limit: 0, summe, rest: null, passt: true };
  return { aktiv: true, limit, summe, rest: limit - summe, passt: summe <= limit };
}

/** Vergütungsbasis einer Kooperation wie im Vertrags-Assistenten: EK netto plus KSK bei Selbstzahler. */
export function verguetungsBasis(koop) {
  return zahl(koop?.einkaufspreis_netto) + (koop?.ksk_selbstzahler ? zahl(koop?.ksk_betrag) : 0);
}

/** Anzeige (keine Sperre): liegt die Summe der EK ueber der Vertragsverguetung? */
export function geldDeckung(vertrag, gedeckteKoops = []) {
  const verguetung = zahl(vertrag?.verguetung_netto);
  const summe = gedeckteKoops.reduce((s, k) => s + verguetungsBasis(k), 0);
  return { verguetung, summe, ueber: verguetung > 0 && summe > verguetung + 0.005 };
}

/**
 * Darf `koop` an `vertrag` haengen? Liefert einen Grund-Schluessel oder null.
 * `gedeckteKoops` sind die Kooperationen, die der Vertrag schon deckt.
 */
export function verknuepfSperre(vertrag, koop, gedeckteKoops = []) {
  if (!vertrag || !koop) return 'nicht_gefunden';
  if (vertrag.typ === 'Contracting') return 'contracting';
  if (vertrag.status === 'abgelehnt') return 'abgelehnt';
  if (!vertrag.creator_id || vertrag.creator_id !== koop.creator_id) return 'anderer_creator';
  if (!vertrag.kampagne_id || vertrag.kampagne_id !== koop.kampagne_id) return 'andere_kampagne';
  if (gedeckteKoops.some((k) => k.id === koop.id)) return 'bereits_gedeckt';
  if (!videoDeckung(vertrag, gedeckteKoops, koop).passt) return 'deckel';
  return null;
}

/** Text zu einem Sperrgrund, mit Zahlen beim Deckel. */
export function deckungGrundText(key, vertrag = null, gedeckteKoops = [], koop = null) {
  if (key === 'deckel' && vertrag) {
    const d = videoDeckung(vertrag, gedeckteKoops, koop);
    return `Der Vertrag nennt ${d.limit} Videos, mit dieser Kooperation wären es ${d.summe}.`;
  }
  return DECKUNG_GRUENDE[key] || 'Die Verknüpfung ist nicht möglich.';
}

/** Fehlertext aus einer DB-Exception ('vertrag_kooperation:<grund>[:summe:limit]') oder null. */
export function deckungFehlerText(error) {
  const treffer = /vertrag_kooperation:([a-z_]+)(?::(\d+):(\d+))?/.exec(error?.message || '');
  if (!treffer) return null;
  const [, key, summe, limit] = treffer;
  if (key === 'deckel' && summe && limit) {
    return `Der Vertrag nennt ${limit} Videos, mit dieser Kooperation wären es ${summe}.`;
  }
  return DECKUNG_GRUENDE[key] || null;
}

function einzeln(res) {
  if (res?.error) throw new Error(deckungFehlerText(res.error) || res.error.message);
  return res?.data;
}

const client = (sb) => sb || window.supabase;

/**
 * Kooperationen, die die Vertraege decken: Junction plus Erzeuger-Kooperation (Altbestand
 * ohne Zeile). Ergebnis: Map vertragId -> Kooperationen.
 */
export async function ladeGedeckteKooperationen(vertragIds, sb) {
  const result = new Map();
  const ids = [...new Set((vertragIds || []).filter(Boolean))];
  ids.forEach((id) => result.set(id, []));
  if (!ids.length) return result;
  const db = client(sb);

  const [junction, erzeuger] = await Promise.all([
    db.from('vertrag_kooperation').select('vertrag_id, kooperation_id').in('vertrag_id', ids),
    db.from('vertraege').select('id, kooperation_id').in('id', ids)
  ]);
  const paare = new Map(); // vertragId -> Set(koopId)
  const merke = (vertragId, koopId) => {
    if (!vertragId || !koopId) return;
    if (!paare.has(vertragId)) paare.set(vertragId, new Set());
    paare.get(vertragId).add(koopId);
  };
  (einzeln(junction) || []).forEach((r) => merke(r.vertrag_id, r.kooperation_id));
  (einzeln(erzeuger) || []).forEach((r) => merke(r.id, r.kooperation_id));

  const koopIds = [...new Set([...paare.values()].flatMap((set) => [...set]))];
  if (!koopIds.length) return result;
  const koops = einzeln(await db.from('kooperationen').select(KOOP_COLS).in('id', koopIds)) || [];
  const nachId = new Map(koops.map((k) => [k.id, k]));
  paare.forEach((set, vertragId) => {
    result.set(vertragId, [...set].map((id) => nachId.get(id)).filter(Boolean)
      .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))));
  });
  return result;
}

/**
 * Bestehende Vertraege, an die `koop` noch haengen darf (gleicher Creator und Kampagne,
 * nicht abgelehnt, Deckel nicht gerissen). Jeder Eintrag: { vertrag, gedeckt, deckung }.
 */
export async function ladeVerknuepfbareVertraege(koop, sb) {
  if (!koop?.creator_id || !koop?.kampagne_id) return [];
  const db = client(sb);
  const vertraege = einzeln(await db.from('vertraege')
    .select('id, name, typ, status, creator_id, kampagne_id, anzahl_videos, verguetung_netto, kooperation_id, created_at')
    .eq('creator_id', koop.creator_id)
    .eq('kampagne_id', koop.kampagne_id)
    .neq('status', 'abgelehnt')
    .neq('typ', 'Contracting')
    .order('created_at', { ascending: false })) || [];
  if (!vertraege.length) return [];

  const gedeckt = await ladeGedeckteKooperationen(vertraege.map((v) => v.id), db);
  return vertraege
    .map((vertrag) => {
      const koops = gedeckt.get(vertrag.id) || [];
      return { vertrag, gedeckt: koops, deckung: videoDeckung(vertrag, koops, koop) };
    })
    .filter(({ vertrag, gedeckt: koops }) => verknuepfSperre(vertrag, koop, koops) === null);
}

/** Haengt eine Kooperation an einen bestehenden Vertrag. Wirft mit lesbarem Text. */
export async function verknuepfeKooperation(vertragId, kooperationId, sb) {
  const db = client(sb);
  einzeln(await db.from('vertrag_kooperation').insert({ vertrag_id: vertragId, kooperation_id: kooperationId }));
  return { success: true };
}

/** Loest eine Kooperation vom Vertrag. Der Vertrag behaelt mindestens eine Kooperation. */
export async function loeseKooperation(vertragId, kooperationId, sb) {
  const db = client(sb);
  const gedeckt = (await ladeGedeckteKooperationen([vertragId], db)).get(vertragId) || [];
  const rest = gedeckt.filter((k) => k.id !== kooperationId);
  if (!rest.length) throw new Error(DECKUNG_GRUENDE.letzte_kooperation);

  einzeln(await db.from('vertrag_kooperation').delete()
    .eq('vertrag_id', vertragId).eq('kooperation_id', kooperationId));

  // Erzeuger-Kooperation nachziehen, falls sie geloest wurde
  const vertrag = einzeln(await db.from('vertraege').select('kooperation_id').eq('id', vertragId).maybeSingle());
  if (vertrag?.kooperation_id === kooperationId) {
    einzeln(await db.from('vertraege').update({ kooperation_id: rest[0].id }).eq('id', vertragId));
  }
  return { success: true };
}

/** Setzt vertrag_unterschrieben auf jeder Kooperation, die der Vertrag deckt. */
export async function syncVertragFlags(vertragId, signed, { supabase: sb, extraKooperationIds = [] } = {}) {
  if (!vertragId && !extraKooperationIds.length) return { success: false, error: 'Kein Vertrag', count: 0 };
  try {
    const db = client(sb);
    const gedeckt = vertragId ? (await ladeGedeckteKooperationen([vertragId], db)).get(vertragId) || [] : [];
    const ids = [...new Set([...gedeckt.map((k) => k.id), ...extraKooperationIds.filter(Boolean)])];
    if (!ids.length) return { success: true, count: 0 };
    const { error } = await db.from('kooperationen').update({ vertrag_unterschrieben: signed }).in('id', ids);
    if (error) return { success: false, error: error.message || String(error), count: 0 };
    return { success: true, count: ids.length };
  } catch (err) {
    return { success: false, error: err.message || String(err), count: 0 };
  }
}

const BATCH = 200;

function inBatches(liste) {
  const batches = [];
  for (let i = 0; i < liste.length; i += BATCH) batches.push(liste.slice(i, i + BATCH));
  return batches;
}

/**
 * Vertraege je Kooperation fuer Tabellen: der Erzeuger-Vertrag (kooperation_id) plus alle
 * Vertraege, die die Kooperation ueber die Junction decken. `vertraege` sind die schon
 * geladenen Vertraege mit kooperation_id in koopIds; fehlende werden mit `columns` nachgeladen.
 * Faellt bei Fehlern auf den Erzeuger-Vertrag zurueck.
 * Ergebnis: Map koopId -> Vertraege.
 */
export async function vertraegeProKooperation(vertraege, koopIds, { columns, sb } = {}) {
  const result = new Map();
  const add = (koopId, vertrag) => {
    if (!result.has(koopId)) result.set(koopId, []);
    const liste = result.get(koopId);
    if (!liste.some((v) => v.id === vertrag.id)) liste.push(vertrag);
  };
  (koopIds || []).forEach((id) => result.set(id, []));
  (vertraege || []).forEach((v) => { if (v.kooperation_id) add(v.kooperation_id, v); });

  const ids = [...new Set((koopIds || []).filter(Boolean))];
  if (!ids.length || !columns) return result;

  try {
    const db = client(sb);
    const antworten = await Promise.all(inBatches(ids).map((batch) =>
      db.from('vertrag_kooperation').select('vertrag_id, kooperation_id').in('kooperation_id', batch)));
    const paare = antworten.flatMap((a) => a?.data || []);
    if (!paare.length) return result;

    const bekannt = new Map((vertraege || []).map((v) => [v.id, v]));
    const fehlend = [...new Set(paare.map((p) => p.vertrag_id))].filter((id) => !bekannt.has(id));
    if (fehlend.length) {
      const nachgeladen = await Promise.all(inBatches(fehlend).map((batch) =>
        db.from('vertraege').select(columns).in('id', batch)));
      nachgeladen.flatMap((a) => a?.data || []).forEach((v) => bekannt.set(v.id, v));
    }
    paare.forEach((p) => {
      const vertrag = bekannt.get(p.vertrag_id);
      if (vertrag) add(p.kooperation_id, vertrag);
    });
  } catch (err) {
    console.warn('Gedeckte Vertraege konnten nicht geladen werden:', err);
  }
  return result;
}
