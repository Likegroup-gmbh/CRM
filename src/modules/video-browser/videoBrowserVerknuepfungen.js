// videoBrowserVerknuepfungen.js
// Verknüpfungen je Video für die Details der Vollansicht: Videoidee mit Konzept und Produkt, Skript.
// Gespeicherte Verknüpfungen (strategie_item_id, skript_id) gewinnen, sonst gilt dieselbe virtuelle
// Zuordnung über den Creator wie in der Kooperationstabelle (konzeptInhalte.js). Ideen lädt nur das
// Team, die Kundenseite sieht nur das gespeicherte Skript.

import { loadKonzeptInhalte, zuordnenKonzeptInhalte } from '../kampagne/konzeptInhalte.js';

const ideeOf = (s) => (s?.id ? {
  id: s.id,
  beschreibung: s.beschreibung || '',
  strategieId: s.strategie_id || null,
  produkt: s.produkt?.id ? { id: s.produkt.id, name: s.produkt.name || '' } : null
} : null);

const skriptOf = (s) => (s?.id ? {
  id: s.id,
  titel: s.titel || '',
  status: s.status || null,
  briefingId: s.briefing_id || null
} : null);

/**
 * videoId → { idee, skript, ideeVirtuell, skriptVirtuell } aus Videozeilen (gespeicherte Joins
 * `strategie_item`/`skript`, nach zuordnenKonzeptInhalte auch die virtuellen).
 */
export function verknuepfungenAusVideos(videos) {
  const out = {};
  for (const v of videos || []) {
    out[v.id] = {
      idee: ideeOf(v.strategie_item),
      skript: skriptOf(v.skript),
      ideeVirtuell: !!v._ideeAusKonzept,
      skriptVirtuell: !!v._skriptAusKonzept
    };
  }
  return out;
}

/** Fehler beim Lesen der Konzepte heißt: nur die gespeicherten Verknüpfungen. */
export async function loadVerknuepfungen({ client, kampagneId, produktionId = null, briefingId = null, kooperationen, videos, team }) {
  if (!team || !client) return verknuepfungenAusVideos(videos);
  try {
    const { ideen, skripte } = await loadKonzeptInhalte(client, { kampagneId, produktionId, briefingId });
    const koops = (kooperationen || []).map(k => ({
      id: k.id,
      creator_id: k.creator_id || k.creator?.id || null,
      produktion_id: k.produktion_id || null,
      briefing_id: k.briefing_id || null
    }));
    const byKoop = {};
    for (const v of videos || []) (byKoop[v.kooperation_id] ||= []).push(v);
    const zugeordnet = zuordnenKonzeptInhalte(koops, byKoop, ideen, skripte);
    return verknuepfungenAusVideos(Object.values(zugeordnet).flat());
  } catch (err) {
    console.warn('VideoBrowser: Konzept-Inhalte nicht lesbar', err?.message || err);
    return verknuepfungenAusVideos(videos);
  }
}
