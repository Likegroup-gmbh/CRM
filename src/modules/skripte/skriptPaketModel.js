// Auswahlregeln für den Skript-Zugang einer Kampagne oder eines Creators.
// Jeder Status lässt sich teilen. Archivierte sind wählbar, aber nicht vorgewählt.

const NICHT_VORGEWAEHLT = new Set(['archiviert']);

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

/**
 * Creator eines Skripts: die der verknüpften Kooperationsvideos, sonst der am Casting
 * der Videoidee. Ein geteiltes Skript hat mehrere; die Hauptbesetzung steht vorn.
 */
export function creatorenAusZeile(row) {
  const eintrag = row?.strategie_item?.casting_eintrag;
  const casting = eintrag?.creator?.id ? mitCastingNamen(eintrag.creator, eintrag.name) : null;
  const ausVideos = new Map();
  for (const video of row?.kooperation_videos || []) {
    const creator = video?.kooperation?.creator;
    if (!creator?.id || ausVideos.has(creator.id)) continue;
    ausVideos.set(creator.id, creator.id === casting?.id ? casting : creator);
  }
  if (!ausVideos.size) return casting ? [casting] : [];
  const liste = [...ausVideos.values()];
  return liste.sort((a, b) => Number(b.id === casting?.id) - Number(a.id === casting?.id));
}

function gehoertZu(skript, creatorId) {
  if (Array.isArray(skript.creatorIds)) return skript.creatorIds.includes(creatorId);
  return skript.creatorId === creatorId;
}

/**
 * Ohne creatorId ist es das Kampagnen-Paket: alle Skripte der Kampagne sind eigene.
 * @param {Array} skripte  Zeilen mit id, status, creatorIds (oder creatorId)
 * @param {string|null} creatorId
 * @param {string[]} gespeichertIds
 * @param {boolean} hatZugang
 */
export function paketAuswahl({ skripte = [], creatorId = null, gespeichertIds = [], hatZugang = false } = {}) {
  const eigene = creatorId ? skripte.filter((s) => gehoertZu(s, creatorId)) : skripte;
  const weitere = creatorId ? skripte.filter((s) => !gehoertZu(s, creatorId)) : [];
  const saved = new Set(gespeichertIds);
  const checked = new Set();

  if (!hatZugang) {
    eigene.forEach((s) => {
      if (!NICHT_VORGEWAEHLT.has(s.status)) checked.add(s.id);
    });
  } else {
    skripte.forEach((s) => {
      if (saved.has(s.id)) checked.add(s.id);
    });
  }

  return { eigene, weitere, checkedIds: [...checked] };
}

/** Creator, die in der Kampagne mindestens ein Skript haben. */
export function creatorOptionen(skripte = []) {
  const map = new Map();
  for (const skript of skripte) {
    for (const creator of skript.creators || [skript.creator]) {
      if (!creator?.id || map.has(creator.id)) continue;
      map.set(creator.id, creator);
    }
  }
  return [...map.values()].sort((a, b) => creatorAnzeigeName(a).localeCompare(creatorAnzeigeName(b), 'de'));
}

/** Namen aller Creator eines Skripts für die Zeilen-Meta. */
export function creatorenText(skript) {
  const liste = (skript?.creators || [skript?.creator]).filter(Boolean);
  return liste.map(creatorAnzeigeName).join(', ');
}
