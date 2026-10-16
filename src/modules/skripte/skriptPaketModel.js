// Reine Auswahlregeln für den Skript-Zugang eines Creators.
// Freigegeben ist die einzige Stufe, die im Dialog und im Link liegt.

export const SKRIPT_FREIGEGEBEN = 'freigegeben';

export function creatorAnzeigeName(creator) {
  const name = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
  return name || 'Creator';
}

/**
 * Kooperation gewinnt vor dem Casting-Eintrag an der Videoidee.
 * Ohne beides bleibt der Creator leer.
 */
export function resolveSkriptCreator(castingCreator, koopCreator) {
  if (koopCreator?.id) return koopCreator;
  if (castingCreator?.id) return castingCreator;
  return null;
}

/**
 * @param {Array} skripte  Zeilen mit id, status, creatorId, nr
 * @param {string|null} creatorId
 * @param {string[]} gespeichertIds  zuletzt gespeicherte Mitgliedschaft
 * @param {boolean} hatZugang
 */
export function paketAuswahl({ skripte = [], creatorId = null, gespeichertIds = [], hatZugang = false } = {}) {
  const frei = skripte.filter((s) => s.status === SKRIPT_FREIGEGEBEN);
  const eigene = frei.filter((s) => creatorId && s.creatorId === creatorId);
  const weitere = frei.filter((s) => !creatorId || s.creatorId !== creatorId);
  const saved = new Set(gespeichertIds);
  const checked = new Set();

  if (!hatZugang) {
    eigene.forEach((s) => checked.add(s.id));
  } else {
    frei.forEach((s) => {
      if (saved.has(s.id)) checked.add(s.id);
    });
  }

  return { eigene, weitere, checkedIds: [...checked] };
}

/** Creator, die in der Kampagne mindestens ein Skript haben. */
export function creatorOptionen(skripte = []) {
  const map = new Map();
  for (const skript of skripte) {
    if (!skript.creator?.id) continue;
    if (!map.has(skript.creator.id)) map.set(skript.creator.id, skript.creator);
  }
  return [...map.values()].sort((a, b) => creatorAnzeigeName(a).localeCompare(creatorAnzeigeName(b), 'de'));
}
