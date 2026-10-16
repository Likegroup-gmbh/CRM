// Auswahlregeln für den Skript-Zugang eines Creators.
// Freigegeben ist die einzige Stufe, die im Dialog und im Link liegt.

export const SKRIPT_FREIGEGEBEN = 'freigegeben';

export function creatorAnzeigeName(creator) {
  const name = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
  return name || creator?.name || 'Creator';
}

/** Anzeige folgt dem Casting-Namen, die Id bleibt der Stammdatensatz. */
function mitCastingNamen(creator, castingName) {
  const name = String(castingName || '').trim();
  if (!name) return creator;
  const crmName = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
  if (name === crmName) return creator;
  return { ...creator, vorname: '', nachname: '', name };
}

/** Wie im Editor: die Kooperation gewinnt, sonst der Casting-Eintrag. */
export function creatorAusZeile(row) {
  const videos = [...(row?.kooperation_videos || [])].sort(
    (a, b) => (Number(a?.position) || 0) - (Number(b?.position) || 0)
  );
  for (const video of videos) {
    const creator = video?.kooperation?.creator;
    if (creator?.id) return creator;
  }
  const eintrag = row?.strategie_item?.casting_eintrag;
  const crm = eintrag?.creator;
  if (crm?.id) return mitCastingNamen(crm, eintrag?.name);
  const name = String(eintrag?.name || row?.strategie_item?.creator_name || '').trim();
  if (!name) return null;
  return { id: null, vorname: '', nachname: '', name };
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
