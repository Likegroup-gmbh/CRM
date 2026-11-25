// skriptNummern.js - laufende Skript-Nummer pro Konzept (abgeleitet, keine DB-Spalte)
//
// Nummer = Rang der Videoidee im Konzept nach strategie_items.sortierung.
// Gezaehlt werden die fuer die Skripterstellung freigegebenen Ideen plus jede
// Idee, an der bereits ein Skript haengt - so hat jedes Skript eine Nummer und
// die Nummer springt nicht, wenn die Liste gefiltert wird.

function zaehlt(item, mitSkript) {
  if (mitSkript.has(item.id)) return true;
  return !!item.skript_freigabe && !item.nicht_umsetzen && !item.ist_vorschlag;
}

function sortWert(item) {
  if (item.sortierung == null || item.sortierung === '') return Number.MAX_SAFE_INTEGER;
  const n = Number(item.sortierung);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function bySortierung(a, b) {
  const d = sortWert(a) - sortWert(b);
  return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
}

/**
 * @param {Array<{id, strategie_id, sortierung, skript_freigabe, nicht_umsetzen, ist_vorschlag}>} items
 *   alle Videoideen der betroffenen Konzepte
 * @param {Iterable<string>} itemIdsMitSkript Videoideen, an denen ein Skript haengt
 * @returns {Map<string, number>} strategie_item_id -> Nummer (ab 1)
 */
export function berechneSkriptNummern(items, itemIdsMitSkript = []) {
  const mitSkript = new Set(itemIdsMitSkript);
  const proKonzept = new Map();
  for (const item of items || []) {
    if (!item?.id || !item.strategie_id || !zaehlt(item, mitSkript)) continue;
    const liste = proKonzept.get(item.strategie_id) || [];
    liste.push(item);
    proKonzept.set(item.strategie_id, liste);
  }

  const nummern = new Map();
  for (const liste of proKonzept.values()) {
    liste.sort(bySortierung).forEach((item, i) => nummern.set(item.id, i + 1));
  }
  return nummern;
}

/** Hängt `skript_nr` (Nummer oder null) an jedes Skript. */
export function mitSkriptNummern(skripte, nummern) {
  return (skripte || []).map((s) => ({
    ...s,
    skript_nr: nummern.get(s.strategie_item_id || s.strategie_item?.id) ?? null
  }));
}

/** "Skript 3" oder leer. */
export function skriptNrLabel(skript) {
  return skript?.skript_nr ? `Skript ${skript.skript_nr}` : '';
}
