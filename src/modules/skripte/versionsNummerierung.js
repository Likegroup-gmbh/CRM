// versionsNummerierung.js
// Reine Nummerierungslogik fuer Skript-Versionen (isoliert testbar):
// - Aktive Version = neueste Hauptversion -> neue Hauptversion (v4).
// - Aktive Version = aeltere Version (v2 oder v2.1) -> Unterversion v2.x,
//   damit die spaeteren Hauptversionen nicht ueberschrieben werden.
// - Bestandsskripte ohne Versionen bekommen lazy v1 (Stand VOR der Aenderung).

const SNAPSHOT_FIELDS = [
  'titel', 'hook', 'hauptteil', 'cta', 'hook_visuell', 'hauptteil_visuell', 'cta_visuell', 'inhalt_md'
];

function snapshotRow(skriptId, stand, { versionNr, subNr, beschreibung, userId }) {
  const row = {
    skript_id: skriptId,
    version_nr: versionNr,
    sub_nr: subNr,
    aenderung_beschreibung: beschreibung || null,
    created_by: userId
  };
  for (const feld of SNAPSHOT_FIELDS) {
    row[feld] = stand?.[feld] ?? null;
  }
  return row;
}

/**
 * Plant die zu insertenden Versions-Rows fuer eine Aenderung.
 * @param {Array<{version_nr:number, sub_nr?:number}>} versionen - vorhandene Versionen
 * @param {object} skript - aktueller (neuer) Stand
 * @param {object|null} vorherigerStand - Stand vor der Aenderung (fuer lazy v1)
 * @param {object|null} aktiveVersion - { version_nr, sub_nr } der bearbeiteten Version
 * @returns {{ rows: object[], neu: { version_nr: number, sub_nr: number } }}
 */
export function planeVersionsRows({ versionen = [], skript, beschreibung = null, vorherigerStand = null, aktiveVersion = null, userId = null }) {
  const rows = [];
  const maxHaupt = versionen.length ? Math.max(...versionen.map((v) => v.version_nr)) : 0;

  if (maxHaupt === 0 && vorherigerStand) {
    rows.push(snapshotRow(skript.id, vorherigerStand, {
      versionNr: 1, subNr: 0, beschreibung: 'Ausgangsversion', userId
    }));
  }

  // Neue Nummer bestimmen: Hauptversion, wenn an der neuesten Hauptversion
  // gearbeitet wurde (oder keine Angabe) - sonst Unterversion der aktiven Version
  let neu;
  const basisHaupt = rows.length ? 1 : maxHaupt;
  const aufNeuesterHaupt = !aktiveVersion
    || (aktiveVersion.version_nr === basisHaupt && !(aktiveVersion.sub_nr > 0));
  if (basisHaupt === 0 || aufNeuesterHaupt) {
    neu = { version_nr: basisHaupt + 1, sub_nr: 0 };
  } else {
    const maxSub = Math.max(0, ...versionen
      .filter((v) => v.version_nr === aktiveVersion.version_nr)
      .map((v) => v.sub_nr || 0));
    neu = { version_nr: aktiveVersion.version_nr, sub_nr: maxSub + 1 };
  }

  rows.push(snapshotRow(skript.id, skript, {
    versionNr: neu.version_nr, subNr: neu.sub_nr, beschreibung, userId
  }));

  return { rows, neu };
}
