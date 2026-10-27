'use strict';
/**
 * Vorher/Nachher-Vergleich je Kampagne (reine Funktion).
 * Weicht etwas ab, rollt der Executor die Kampagne ueber die Backup-Tabelle zurueck.
 *
 * Messung (messeKampagne im Skript):
 * {
 *   kampagne: { volumen, creator_budget, is_completed },
 *   produktionen: [{ id, budget }],
 *   koops: [{ id, kampagne_id, briefing_id, produktion_id, verkaufspreis_netto, einkaufspreis_netto,
 *             status, status_id, vertrag_unterschrieben, videoanzahl }],
 *   videos: [{ id, kooperation_id, verkaufspreis_netto, einkaufspreis_netto }],
 *   rechnungen: [{ id, auftrag_id, netto, vertrag_id }],
 *   vertraege: [{ id, kampagne_id, produktion_id, kooperation_id, typ }],
 *   vertragKoopAnzahl: number,
 * }
 */

const KOOP_FELDER_UNVERAENDERT = [
  'kampagne_id', 'verkaufspreis_netto', 'einkaufspreis_netto', 'status', 'status_id',
  'vertrag_unterschrieben', 'videoanzahl',
];

function num(value) {
  return Math.round((parseFloat(value) || 0) * 100) / 100;
}

function summe(list, feld) {
  return num(list.reduce((acc, row) => acc + (parseFloat(row?.[feld]) || 0), 0));
}

function nachId(list) {
  return new Map(list.map(row => [row.id, row]));
}

/**
 * @param vorher  Messung vor dem Lauf
 * @param nachher Messung nach dem Lauf
 * @param erwartet { koops: Map<id,{briefingId,produktionId}>, vertraege: Map<id,produktionId>,
 *                   koopsOhneProduktion: string[] }
 * @returns string[] Fehler (leer = ok)
 */
function vergleiche(vorher, nachher, erwartet = {}) {
  const fehler = [];
  const fehl = text => fehler.push(text);

  // Kooperationen
  const koopsV = nachId(vorher.koops);
  const koopsN = nachId(nachher.koops);
  if (koopsV.size !== koopsN.size) fehl(`Kooperationen: ${koopsV.size} vorher, ${koopsN.size} nachher`);
  for (const [id, v] of koopsV) {
    const n = koopsN.get(id);
    if (!n) { fehl(`Kooperation ${id} fehlt nachher`); continue; }
    for (const feld of KOOP_FELDER_UNVERAENDERT) {
      const a = v[feld];
      const b = n[feld];
      const gleich = feld.endsWith('_netto') ? num(a) === num(b) : (a ?? null) === (b ?? null);
      if (!gleich) fehl(`Kooperation ${id}: ${feld} ${a} -> ${b}`);
    }
    const soll = erwartet.koops?.get(id);
    if (soll) {
      if (n.briefing_id !== soll.briefingId) fehl(`Kooperation ${id}: briefing_id ${n.briefing_id}, erwartet ${soll.briefingId}`);
      if (n.produktion_id !== soll.produktionId) fehl(`Kooperation ${id}: produktion_id ${n.produktion_id}, erwartet ${soll.produktionId}`);
    } else if ((v.briefing_id ?? null) !== (n.briefing_id ?? null) || (v.produktion_id ?? null) !== (n.produktion_id ?? null)) {
      fehl(`Kooperation ${id} ausserhalb des Plans veraendert`);
    }
    if (n.briefing_id && !n.produktion_id) fehl(`Kooperation ${id}: Linie ohne Produktion`);
  }
  for (const feld of ['verkaufspreis_netto', 'einkaufspreis_netto']) {
    if (summe(vorher.koops, feld) !== summe(nachher.koops, feld)) {
      fehl(`Summe ${feld} weicht ab: ${summe(vorher.koops, feld)} -> ${summe(nachher.koops, feld)}`);
    }
  }

  // Keine Koop verliert die Produktion; Plan-Koops haben danach eine (ausser bewusst liegengelassene).
  const ausnahmen = new Set(erwartet.koopsOhneProduktion || []);
  for (const k of nachher.koops) {
    const war = koopsV.get(k.id);
    if (!k.produktion_id && war?.produktion_id) fehl(`Kooperation ${k.id} hat die Produktion verloren`);
    if (!k.produktion_id && erwartet.koops?.has(k.id) && !ausnahmen.has(k.id)) fehl(`Kooperation ${k.id} ohne Produktion nach dem Lauf`);
  }
  // Summe ueber alle Produktionen der Kampagne = Summe ueber kampagne_id (nur Koops mit Produktion)
  const produktionIds = new Set(nachher.produktionen.map(p => p.id));
  const mitProduktion = nachher.koops.filter(k => k.produktion_id);
  const inKampagne = mitProduktion.filter(k => produktionIds.has(k.produktion_id));
  if (inKampagne.length !== mitProduktion.length) fehl('Kooperation zeigt auf eine Produktion ausserhalb der Kampagne');
  if (summe(inKampagne, 'verkaufspreis_netto') !== summe(mitProduktion, 'verkaufspreis_netto')) {
    fehl('Summe ueber Produktionen ungleich Summe ueber kampagne_id');
  }

  // Videos
  if (vorher.videos.length !== nachher.videos.length) fehl(`Videos: ${vorher.videos.length} vorher, ${nachher.videos.length} nachher`);
  for (const feld of ['verkaufspreis_netto', 'einkaufspreis_netto']) {
    if (summe(vorher.videos, feld) !== summe(nachher.videos, feld)) fehl(`Video-Summe ${feld} weicht ab`);
  }

  // Rechnungen je Auftrag
  const nachAuftrag = list => {
    const map = new Map();
    for (const r of list) {
      const e = map.get(r.auftrag_id) || { n: 0, netto: 0 };
      e.n += 1;
      e.netto = num(e.netto + (parseFloat(r.netto) || 0));
      map.set(r.auftrag_id, e);
    }
    return map;
  };
  const rV = nachAuftrag(vorher.rechnungen);
  const rN = nachAuftrag(nachher.rechnungen);
  for (const [auftrag, e] of rV) {
    const n = rN.get(auftrag);
    if (!n || n.n !== e.n || n.netto !== e.netto) fehl(`Rechnungen Auftrag ${auftrag}: ${e.n}/${e.netto} -> ${n ? `${n.n}/${n.netto}` : 'fehlt'}`);
  }
  if (rV.size !== rN.size) fehl('Anzahl Auftraege mit Rechnungen weicht ab');
  const rechV = nachId(vorher.rechnungen);
  for (const r of nachher.rechnungen) {
    if ((rechV.get(r.id)?.vertrag_id ?? null) !== (r.vertrag_id ?? null)) fehl(`Rechnung ${r.id}: vertrag_id geaendert`);
  }

  // Produktionsbudgets, Topf, is_completed
  const prodN = nachId(nachher.produktionen);
  for (const p of vorher.produktionen) {
    const n = prodN.get(p.id);
    if (!n) { fehl(`Produktion ${p.id} fehlt nachher`); continue; }
    if ((p.budget ?? null) !== (n.budget ?? null)) fehl(`Produktion ${p.id}: Budget ${p.budget} -> ${n.budget}`);
  }
  const vorherIds = new Set(vorher.produktionen.map(p => p.id));
  for (const p of nachher.produktionen) {
    if (!vorherIds.has(p.id) && p.budget != null) fehl(`Neue Produktion ${p.id} hat ein Budget`);
  }
  for (const feld of ['volumen', 'creator_budget', 'is_completed']) {
    if ((vorher.kampagne?.[feld] ?? null) !== (nachher.kampagne?.[feld] ?? null)) {
      fehl(`Kampagne ${feld}: ${vorher.kampagne?.[feld]} -> ${nachher.kampagne?.[feld]}`);
    }
  }

  // Vertraege
  if (vorher.vertraege.length !== nachher.vertraege.length) fehl(`Vertraege: ${vorher.vertraege.length} vorher, ${nachher.vertraege.length} nachher`);
  if (vorher.vertragKoopAnzahl !== nachher.vertragKoopAnzahl) fehl(`vertrag_kooperation: ${vorher.vertragKoopAnzahl} -> ${nachher.vertragKoopAnzahl}`);
  const vertV = nachId(vorher.vertraege);
  for (const v of nachher.vertraege) {
    const war = vertV.get(v.id);
    if (!war) continue;
    if (war.kampagne_id && war.kampagne_id !== v.kampagne_id) fehl(`Vertrag ${v.id}: kampagne_id geaendert`);
    if (war.kooperation_id !== v.kooperation_id) fehl(`Vertrag ${v.id}: kooperation_id geaendert`);
    const soll = erwartet.vertraege?.get(v.id);
    if (soll !== undefined) {
      if (v.produktion_id !== soll) fehl(`Vertrag ${v.id}: produktion_id ${v.produktion_id}, erwartet ${soll}`);
    } else if ((war.produktion_id ?? null) !== (v.produktion_id ?? null)) {
      fehl(`Vertrag ${v.id} ausserhalb des Plans veraendert`);
    }
  }

  return fehler;
}

module.exports = { vergleiche, summe, num };
