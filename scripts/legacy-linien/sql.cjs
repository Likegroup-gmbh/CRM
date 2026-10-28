'use strict';
/**
 * Plan-Emitter fuer die Altbestand-Linien-Migration ohne Service-Role-Key.
 *
 * Macht aus dem Plan einer Kampagne (planner.cjs) ein kompaktes JSON, das
 * private.legacy_linien_anwenden() / private.legacy_linien_batch() ausfuehrt
 * (supabase/migrations/20261113_legacy_linien_funktionen.sql). Die Funktion sichert
 * vorher in legacy_linien_backup, aendert und vergleicht Vorher/Nachher; bei
 * Abweichung rollt Postgres die Kampagne zurueck.
 *
 * Kompakt: die groesste Gruppe an Kooperationen (und Vertraegen) wird nicht mit IDs
 * aufgelistet, sondern als "alle uebrigen" gemeint (ids = null). Die Funktion prueft die
 * Summe gegen koopsAnzahl / vertraegeAnzahl, Drift faellt dort auf.
 */

const crypto = require('crypto');

function nachGroesse(gruppen) {
  return [...gruppen].sort((a, b) => b.ids.length - a.ids.length);
}

function baueKampagnePlan(plan, ctx, laufId) {
  const K = plan.kampagneId;
  const kampagne = ctx.kampagne;
  const refs = new Map();
  for (const ziel of plan.produktionen) refs.set(ziel.ref, ziel.id || crypto.randomUUID());
  const prodId = ref => refs.get(ref) || ref;

  const legacy = {
    koops: ctx.koops.filter(x => !x.briefing_id),
    castings: ctx.castings.filter(x => !x.briefing_id),
    konzepte: ctx.konzepte.filter(x => !x.briefing_id),
    skripte: ctx.skripte.filter(x => !x.briefing_id),
  };

  const castingNachId = new Map(ctx.castings.map(c => [c.id, c]));
  const konzeptNachId = new Map(ctx.konzepte.map(c => [c.id, c]));

  // Linien, Castings, Konzepte
  const briefingVonLinie = new Map();
  const koopsProLinie = new Map();
  for (const z of plan.koopZuordnung) koopsProLinie.set(z.linieKey, (koopsProLinie.get(z.linieKey) || 0) + 1);
  const verknuepfen = [];
  const linien = plan.linien.map(linie => {
    const id = linie.briefingId || crypto.randomUUID();
    const produktionId = prodId(linie.produktionRef);
    briefingVonLinie.set(linie.key, { b: id, p: produktionId });
    const neuCasting = linie.neuCasting ? crypto.randomUUID() : null;
    const neuKonzept = linie.neuKonzept ? crypto.randomUUID() : null;
    const castingId = linie.castingIds[0] || neuCasting;
    const konzeptId = linie.konzeptId || neuKonzept;
    if (castingId && konzeptId && !castingNachId.get(castingId)?.strategie_id && !konzeptNachId.get(konzeptId)?.creator_auswahl_id) {
      verknuepfen.push([castingId, konzeptId]);
    }
    return {
      id,
      bestehend: Boolean(linie.briefingId),
      p: produktionId,
      titel: linie.titel,
      bereich: linie.bereich,
      castings: linie.castingIds,
      konzept: linie.konzeptId || null,
      neuCasting,
      neuKonzept,
      koopsN: koopsProLinie.get(linie.key) || 0,
    };
  });

  // Kooperationen: Gruppen nach (Linie, Regel), groesste = Rest
  const koopGruppen = new Map();
  for (const z of plan.koopZuordnung) {
    const ziel = briefingVonLinie.get(z.linieKey);
    const key = `${ziel.b}|${ziel.p}|${z.regel}`;
    if (!koopGruppen.has(key)) koopGruppen.set(key, { b: ziel.b, p: ziel.p, regel: z.regel, ids: [] });
    koopGruppen.get(key).ids.push(z.koopId);
  }
  const koops = nachGroesse(koopGruppen.values()).map((g, i) => ({ b: g.b, p: g.p, regel: g.regel, ids: i === 0 ? null : g.ids }));

  // Vertraege: nur die, deren Produktion sich aendert
  const vertragNachId = new Map(ctx.vertraege.map(v => [v.id, v]));
  const vertragAenderungen = plan.vertragZuordnung
    .map(z => ({ id: z.vertragId, p: prodId(z.produktionRef) }))
    .filter(z => (vertragNachId.get(z.id)?.produktion_id ?? null) !== z.p);
  const vertragGruppen = new Map();
  for (const z of vertragAenderungen) {
    if (!vertragGruppen.has(z.p)) vertragGruppen.set(z.p, { p: z.p, ids: [] });
    vertragGruppen.get(z.p).ids.push(z.id);
  }
  const vertraege = nachGroesse(vertragGruppen.values()).map((g, i) => ({ p: g.p, ids: i === 0 ? null : g.ids }));
  const geaendert = new Set(vertragAenderungen.map(z => z.id));
  const vertraegeAusser = ctx.vertraege.map(v => v.id).filter(id => !geaendert.has(id));

  return {
    lauf: laufId,
    k: K,
    name: plan.name,
    unternehmen: kampagne.unternehmen_id || null,
    marke: kampagne.marke_id || null,
    drift: { koops: legacy.koops.length, castings: legacy.castings.length, konzepte: legacy.konzepte.length, skripte: legacy.skripte.length },
    koopsOhne: plan.koopsOhneProduktion,
    koopsAnzahl: plan.koopZuordnung.length,
    produktionen: plan.produktionen.map(z => ({ id: prodId(z.ref), name: z.name, neu: z.neu, umbenennen: z.umbenennen })),
    produktionenNeu: plan.produktionen.filter(z => z.neu).length,
    linien,
    verknuepfen,
    castingZu: plan.castingZuordnung.map(z => ({ id: z.id, b: z.briefingId, p: z.produktionId })),
    konzeptZu: plan.konzeptZuordnung.map(z => ({ id: z.id, b: z.briefingId, p: z.produktionId })),
    koops,
    skripte: plan.skriptZuordnung.map(z => {
      const ziel = briefingVonLinie.get(z.linieKey);
      return { id: z.skriptId, b: ziel.b, p: ziel.p, regel: z.regel };
    }),
    vertraege,
    vertraegeAusser: vertraege.length ? vertraegeAusser : [],
    vertraegeAnzahl: vertragAenderungen.length,
  };
}

/** Pakete (SQL) fuer eine Liste Plaene; maximal maxBytes oder maxAnzahl Kampagnen je Paket. */
function baueBatches(plaene, maxBytes = 28000, maxAnzahl = 12) {
  const batches = [];
  let aktuell = [];
  let bytes = 0;
  for (const p of plaene) {
    const len = JSON.stringify(p).length;
    if (aktuell.length && (bytes + len > maxBytes || aktuell.length >= maxAnzahl)) {
      batches.push(aktuell);
      aktuell = [];
      bytes = 0;
    }
    aktuell.push(p);
    bytes += len;
  }
  if (aktuell.length) batches.push(aktuell);
  return batches;
}

function batchSql(plaene) {
  const json = JSON.stringify(plaene.map(({ name, ...rest }) => rest));
  if (json.includes('$p$')) throw new Error('Plan enthaelt $p$');
  return `select private.legacy_linien_batch($p$${json}$p$::jsonb);\n`;
}

module.exports = { baueKampagnePlan, baueBatches, batchSql };
