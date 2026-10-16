// Auswahlregeln für den Skript-Zugang eines Creators.
// Freigegeben ist die einzige Stufe, die im Dialog und im Link liegt.

export const SKRIPT_FREIGEGEBEN = 'freigegeben';

export function creatorAnzeigeName(creator) {
  const name = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
  return name || creator?.name || 'Creator';
}

/** Creator wie in der Skripte-Tabelle: CRM am Casting, sonst die Kooperation. */
export function creatorAusZeile(row) {
  const crm = row?.strategie_item?.casting_eintrag?.creator;
  if (crm?.id) return crm;
  const videos = row?.kooperation_videos || [];
  for (const video of videos) {
    const creator = video?.kooperation?.creator;
    if (creator?.id) return creator;
  }
  return null;
}

/**
 * @param {Array} skripte  Zeilen mit id, status, creatorId
 * @param {string|null} creatorId
 * @param {string[]} gespeichertIds
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
