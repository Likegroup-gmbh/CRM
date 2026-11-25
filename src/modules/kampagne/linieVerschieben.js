// linieVerschieben.js
// Kooperation in eine andere Linie derselben Kampagne (ADR 0062).
// Der Plan sagt, welche Zeilen sich ändern. Anwenden schreibt sie und
// setzt bei einem Fehler den Ausgangsstand zurück.

import { isNichtUmsetzen, NICHT_UMSETZEN_KATEGORIE } from '../creator-auswahl/castingKategorien.js';

const GRUND_TEXT = {
  andere_kampagne: 'Die Linie liegt in einer anderen Kampagne.',
  entwurf: 'Entwürfe sind keine Ziel-Linie.',
  gleiche_linie: 'Die Kooperation liegt schon auf dieser Linie.',
  budget: 'Die Verkaufspreise würden das Produktionsbudget überschreiten.',
  ziel_ohne_konzept: 'Die Ziellinie hat kein Konzept.',
  ziel_ohne_casting: 'Die Ziellinie hat kein Casting.',
  eintrag_fehlt: 'Ein Casting-Eintrag der Videoidee konnte nicht geladen werden.',
  ziel_unvollstaendig: 'Die Ziel-Linie ist unvollständig.'
};

export function grundText(grund) {
  return GRUND_TEXT[grund] || 'Verschieben fehlgeschlagen.';
}

function betrag(wert) {
  const n = Number(wert);
  return Number.isFinite(n) ? n : 0;
}

function pruefeZiel(input) {
  const koop = input.kooperation;
  const ziel = input.ziel;
  if (!koop?.id || !ziel?.briefingId || !ziel?.produktionId || !ziel?.kampagneId) return 'ziel_unvollstaendig';
  if (ziel.kampagneId !== koop.kampagne_id) return 'andere_kampagne';
  if (ziel.is_draft) return 'entwurf';
  if (koop.briefing_id && koop.briefing_id === ziel.briefingId) return 'gleiche_linie';
  if (ziel.budget != null && ziel.produktionId !== koop.produktion_id) {
    const hinzu = (input.videos || []).reduce((summe, video) => summe + betrag(video.verkaufspreis_netto), 0);
    if (betrag(input.verbrauch) + hinzu > betrag(ziel.budget)) return 'budget';
  }
  return null;
}

function paarSchluessel(ideeId, skriptId) {
  return ideeId || `skript:${skriptId}`;
}

/**
 * Paare aus Videoidee und ihren Skripten, auf die Videos dieser Kooperation zeigen.
 * Ein fremdes Video auf Idee oder Skript hält das ganze Paar in der alten Linie.
 */
export function paareDerKooperation({ videos, fremdeVideos, ideen, skripte }) {
  const ideeNachId = new Map((ideen || []).map(idee => [idee.id, idee]));
  const skriptNachId = new Map((skripte || []).map(skript => [skript.id, skript]));
  const skripteNachIdee = new Map();
  for (const skript of skripte || []) {
    if (!skript.strategie_item_id) continue;
    const liste = skripteNachIdee.get(skript.strategie_item_id) || [];
    liste.push(skript);
    skripteNachIdee.set(skript.strategie_item_id, liste);
  }

  const paare = new Map();
  const sicher = (ideeId, skript) => {
    const idee = ideeId ? ideeNachId.get(ideeId) || null : null;
    const schluessel = paarSchluessel(idee?.id || null, skript?.id);
    if (!idee && !skript) return null;
    if (!paare.has(schluessel)) paare.set(schluessel, { idee, skripte: [] });
    const paar = paare.get(schluessel);
    if (skript && !paar.skripte.some(vorhanden => vorhanden.id === skript.id)) paar.skripte.push(skript);
    return paar;
  };

  for (const video of videos || []) {
    const skript = video.skript_id ? skriptNachId.get(video.skript_id) || null : null;
    const ideeId = video.strategie_item_id || skript?.strategie_item_id || null;
    const paar = sicher(ideeId, skript);
    if (!paar || !ideeId) continue;
    for (const weiteres of skripteNachIdee.get(ideeId) || []) {
      if (!paar.skripte.some(vorhanden => vorhanden.id === weiteres.id)) paar.skripte.push(weiteres);
    }
  }

  for (const paar of paare.values()) {
    const skriptIds = new Set(paar.skripte.map(skript => skript.id));
    paar.geteilt = (fremdeVideos || []).some(video => (
      (paar.idee && video.strategie_item_id === paar.idee.id)
      || (video.skript_id && skriptIds.has(video.skript_id))
    ));
  }
  return [...paare.values()];
}

export function kategorieFuerZiel(eintrag, zielNamen) {
  if (isNichtUmsetzen(eintrag)) {
    return { kategorie: NICHT_UMSETZEN_KATEGORIE, nicht_umsetzen: true };
  }
  const name = String(eintrag?.kategorie || '').trim();
  const treffer = (zielNamen || []).find(vorhanden => String(vorhanden).trim().toLowerCase() === name.toLowerCase());
  if (name && treffer) return { kategorie: String(treffer).trim(), nicht_umsetzen: false };
  return { kategorie: null, nicht_umsetzen: false };
}

function planeCasting(ziehendeIdeen, input) {
  const eintragNachId = new Map((input.eintraege || []).map(eintrag => [eintrag.id, eintrag]));
  const zielNachCreator = new Map();
  for (const eintrag of input.zielEintraege || []) {
    if (eintrag.creator_id && !zielNachCreator.has(eintrag.creator_id)) {
      zielNachCreator.set(eintrag.creator_id, eintrag);
    }
  }
  const ziehendeIds = new Set(ziehendeIdeen.map(idee => idee.id));
  const bleibend = (input.ideen || []).filter(idee => !ziehendeIds.has(idee.id));
  const wiederverwenden = [];
  const verschieben = [];
  const kopieren = [];
  const behandelt = new Set();

  for (const idee of ziehendeIdeen) {
    const eintragId = idee.creator_auswahl_item_id;
    if (!eintragId) continue;
    const eintrag = eintragNachId.get(eintragId);
    if (!eintrag) return { fehler: 'eintrag_fehlt' };
    if (eintrag.creator_id && zielNachCreator.has(eintrag.creator_id)) {
      wiederverwenden.push({ ideeId: idee.id, eintragId: zielNachCreator.get(eintrag.creator_id).id });
      continue;
    }
    if (behandelt.has(eintragId)) {
      const kopie = kopieren.find(zeile => zeile.vonId === eintragId);
      if (kopie) kopie.ideeIds.push(idee.id);
      continue;
    }
    behandelt.add(eintragId);
    const felder = kategorieFuerZiel(eintrag, input.zielKategorien);
    const bleibt = bleibend.some(andere => andere.creator_auswahl_item_id === eintragId);
    if (bleibt) {
      kopieren.push({
        vonId: eintragId,
        ideeIds: [idee.id],
        creator_auswahl_id: input.ziel.castingId,
        ...felder
      });
    } else {
      verschieben.push({
        eintragId,
        creator_auswahl_id: input.ziel.castingId,
        ...felder
      });
    }
  }
  return { wiederverwenden, verschieben, kopieren };
}

function vertraegeFuer(input) {
  return (input.vertraege || [])
    .filter(vertrag => vertrag.kooperation_id === input.kooperation.id)
    .filter(vertrag => String(vertrag.typ || '').toLowerCase() !== 'contracting')
    .filter(vertrag => vertrag.produktion_id !== input.ziel.produktionId)
    .map(vertrag => ({ id: vertrag.id, produktion_id: input.ziel.produktionId }));
}

export function planLinieWechsel(input) {
  const zielGrund = pruefeZiel(input);
  if (zielGrund) return { ok: false, grund: zielGrund };

  const ziehend = paareDerKooperation(input).filter(paar => !paar.geteilt);
  const ideen = ziehend.map(paar => paar.idee).filter(Boolean);
  const skriptIds = new Set();
  const skripte = [];
  for (const paar of ziehend) {
    for (const skript of paar.skripte) {
      if (skriptIds.has(skript.id)) continue;
      skriptIds.add(skript.id);
      skripte.push(skript);
    }
  }

  if (ideen.length && !input.ziel.konzeptId) return { ok: false, grund: 'ziel_ohne_konzept' };
  const brauchtCasting = ideen.some(idee => idee.creator_auswahl_item_id);
  if (brauchtCasting && !input.ziel.castingId) return { ok: false, grund: 'ziel_ohne_casting' };

  const casting = planeCasting(ideen, input);
  if (casting.fehler) return { ok: false, grund: casting.fehler };

  return {
    ok: true,
    kooperation: {
      id: input.kooperation.id,
      briefing_id: input.ziel.briefingId,
      produktion_id: input.ziel.produktionId
    },
    skripte: skripte.map(skript => ({
      id: skript.id,
      briefing_id: input.ziel.briefingId,
      produktion_id: input.ziel.produktionId
    })),
    videoideen: ideen.map(idee => ({ id: idee.id, strategie_id: input.ziel.konzeptId })),
    casting,
    vertraege: vertraegeFuer(input)
  };
}

async function zeile(db, table, id, spalten) {
  const { data, error } = await db.from(table).select(spalten).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function updateRow(db, undo, table, id, patch) {
  const vorher = await zeile(db, table, id, Object.keys(patch).join(','));
  const alt = {};
  for (const key of Object.keys(patch)) alt[key] = vorher?.[key] ?? null;
  const { error } = await db.from(table).update(patch).eq('id', id);
  if (error) throw new Error(error.message);
  undo.push(async () => {
    const { error: zurueck } = await db.from(table).update(alt).eq('id', id);
    if (zurueck) throw new Error(zurueck.message);
  });
}

async function kopiereEintrag(db, undo, auftrag) {
  const row = await zeile(db, 'creator_auswahl_items', auftrag.vonId, '*');
  if (!row) throw new Error(grundText('eintrag_fehlt'));
  const { id, ...rest } = row;
  const payload = {
    ...rest,
    creator_auswahl_id: auftrag.creator_auswahl_id,
    kategorie: auftrag.kategorie,
    nicht_umsetzen: auftrag.nicht_umsetzen
  };
  const { data, error } = await db.from('creator_auswahl_items').insert(payload).select('id').single();
  if (error) throw new Error(error.message);
  undo.push(async () => {
    const { error: weg } = await db.from('creator_auswahl_items').delete().eq('id', data.id);
    if (weg) throw new Error(weg.message);
  });
  return data.id;
}

export async function applyLinieWechsel(db, plan) {
  if (!plan?.ok) throw new Error(grundText(plan?.grund));
  const undo = [];
  try {
    const ideePatch = new Map(plan.videoideen.map(idee => [idee.id, { strategie_id: idee.strategie_id }]));
    for (const wieder of plan.casting.wiederverwenden) {
      const patch = ideePatch.get(wieder.ideeId) || {};
      patch.creator_auswahl_item_id = wieder.eintragId;
      ideePatch.set(wieder.ideeId, patch);
    }
    for (const kopie of plan.casting.kopieren) {
      const neuId = await kopiereEintrag(db, undo, kopie);
      for (const ideeId of kopie.ideeIds) {
        const patch = ideePatch.get(ideeId) || {};
        patch.creator_auswahl_item_id = neuId;
        ideePatch.set(ideeId, patch);
      }
    }
    for (const eintrag of plan.casting.verschieben) {
      await updateRow(db, undo, 'creator_auswahl_items', eintrag.eintragId, {
        creator_auswahl_id: eintrag.creator_auswahl_id,
        kategorie: eintrag.kategorie,
        nicht_umsetzen: eintrag.nicht_umsetzen
      });
    }
    for (const [id, patch] of ideePatch) {
      await updateRow(db, undo, 'strategie_items', id, patch);
    }
    for (const skript of plan.skripte) {
      await updateRow(db, undo, 'skripte', skript.id, {
        briefing_id: skript.briefing_id,
        produktion_id: skript.produktion_id
      });
    }
    await updateRow(db, undo, 'kooperationen', plan.kooperation.id, {
      briefing_id: plan.kooperation.briefing_id,
      produktion_id: plan.kooperation.produktion_id
    });
    for (const vertrag of plan.vertraege) {
      await updateRow(db, undo, 'vertraege', vertrag.id, { produktion_id: vertrag.produktion_id });
    }
  } catch (err) {
    for (const schritt of undo.reverse()) {
      try {
        await schritt();
      } catch (zurueck) {
        console.error('Rückgängig fehlgeschlagen', zurueck);
      }
    }
    throw err;
  }
}
