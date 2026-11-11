// Auswahlregeln für den Skript-Zugang einer Kampagne oder eines Creators.
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

/** Creator wie in der Skripte-Tabelle: Casting, sonst die Kooperation. */
export function creatorAusZeile(row) {
  const eintrag = row?.strategie_item?.casting_eintrag;
  const crm = eintrag?.creator;
  if (crm?.id) return mitCastingNamen(crm, eintrag?.name);
  const videos = row?.kooperation_videos || [];
  for (const video of videos) {
    const creator = video?.kooperation?.creator;
    if (creator?.id) return creator;
  }
  return null;
}

/**
 * Ohne creatorId ist es das Kampagnen-Paket: alle freigegebenen Skripte sind eigene.
 * @param {Array} skripte  Zeilen mit id, status, creatorId
 * @param {string|null} creatorId
 * @param {string[]} gespeichertIds
 * @param {boolean} hatZugang
 */
export function paketAuswahl({ skripte = [], creatorId = null, gespeichertIds = [], hatZugang = false } = {}) {
  const frei = skripte.filter((s) => s.status === SKRIPT_FREIGEGEBEN);
  const eigene = creatorId ? frei.filter((s) => s.creatorId === creatorId) : frei;
  const weitere = creatorId ? frei.filter((s) => s.creatorId !== creatorId) : [];
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

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

/** Eingefügter Text mit Komma, Semikolon, Leerzeichen oder Zeilenumbruch, auch "Name <mail>". */
export function emailsAusText(text) {
  const out = [];
  for (const teil of String(text || '').split(/[\s,;]+/)) {
    const email = teil.replace(/^[<("']+|[>)"']+$/g, '').trim().toLowerCase();
    if (isValidEmail(email) && !out.includes(email)) out.push(email);
  }
  return out;
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
