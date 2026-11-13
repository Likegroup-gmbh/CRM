// videoBrowserRohOrdner.js
// Unterordner im Rohmaterial (ADR 0070): Creator-Name, "final", beliebig tief. Die Ordner kommen
// aus dem Register (auch leere) und aus den Dateipfaden (Ordner ohne Register-Eintrag). Kein DOM.

const ROH_SEGMENT = '/Rohmaterial/';
// Spiegelt dateiTyp in netlify/functions/_shared/ablage/pfad.js
const VIDEO_EXT = /\.(mp4|mov|m4v|avi|mkv|webm)$/i;
const BILD_EXT = /\.(jpe?g|png|webp|heic|heif|gif)$/i;

/** Was aus einer Rohmaterial-Datei in der Feedbackschleife wird: 'video', 'still' oder null. */
export function rohZielTyp(fileName) {
  if (VIDEO_EXT.test(fileName || '')) return 'video';
  if (BILD_EXT.test(fileName || '')) return 'still';
  return null;
}

const ohneSchraegstrich = (p) => String(p || '').replace(/\/+$/, '');
const schluessel = (p) => String(p || '').toLowerCase();

/** Pfad unterhalb von Rohmaterial/ ('' = die Wurzel selbst oder nicht zuzuordnen). */
export function rohRelativ(pfad, wurzelPfad = null) {
  const p = String(pfad || '');
  const w = ohneSchraegstrich(wurzelPfad);
  if (w && schluessel(p).startsWith(`${schluessel(w)}/`)) return p.slice(w.length + 1);
  const i = p.indexOf(ROH_SEGMENT);
  return i < 0 ? '' : p.slice(i + ROH_SEGMENT.length);
}

/** Ordner einer Datei relativ zu Rohmaterial/ ('' = direkt in der Wurzel). */
export function rohOrdnerVonDatei(filePath, wurzelPfad = null) {
  const teile = rohRelativ(filePath, wurzelPfad).split('/').filter(Boolean);
  teile.pop();
  return teile.join('/');
}

/** Kann die Datei in eine Feedbackschleife (Video oder Bild in SharePoint)? */
export function rohVerschiebbar(asset) {
  return asset?.ablage === 'sharepoint' && !!asset.item_id && !!rohZielTyp(asset.file_name);
}

function vergleichePfad(a, b) {
  const ta = a.split('/');
  const tb = b.split('/');
  for (let i = 0; i < Math.min(ta.length, tb.length); i++) {
    const c = ta[i].localeCompare(tb[i], 'de', { numeric: true, sensitivity: 'base' });
    if (c) return c;
  }
  return ta.length - tb.length;
}

/**
 * Ordnerbaum des Rohmaterials einer Kooperation.
 * @param {Array<{ item_id, parent_item_id, name, pfad, art }>} registerOrdner art 'typ' = Wurzel, 'frei' = Unterordner
 * @param {Array<{ file_path?: string }>} dateien
 * @returns {{ wurzelItemId: string|null, wurzelPfad: string|null, ordnerVon: (asset) => string,
 *   ordner: Array<{ pfad: string, name: string, tiefe: number, eltern: string, itemId: string|null, anzahl: number, gesamt: number }> }}
 *   ordner in Baumreihenfolge (Eltern vor Kindern), anzahl = Dateien direkt darin, gesamt = mit Unterordnern
 */
export function rohOrdnerBaum(registerOrdner = [], dateien = []) {
  const wurzel = registerOrdner.find(o => o.art === 'typ') || null;
  const wurzelPfad = wurzel?.pfad || null;
  const ordnerVon = (asset) => rohOrdnerVonDatei(asset?.file_path, wurzelPfad);
  const map = new Map();

  const anlegen = (rel) => {
    const teile = rel.split('/').filter(Boolean);
    let eintrag = null;
    for (let i = 1; i <= teile.length; i++) {
      const pfad = teile.slice(0, i).join('/');
      const key = schluessel(pfad);
      if (!map.has(key)) {
        map.set(key, { pfad, name: teile[i - 1], tiefe: i - 1, eltern: teile.slice(0, i - 1).join('/'), itemId: null, anzahl: 0, gesamt: 0 });
      }
      eintrag = map.get(key);
    }
    return eintrag;
  };

  for (const o of registerOrdner) {
    if (o.art !== 'frei') continue;
    const rel = rohRelativ(o.pfad, wurzelPfad);
    const eintrag = rel ? anlegen(rel) : null;
    if (eintrag) eintrag.itemId = o.item_id;
  }
  for (const d of dateien) {
    const rel = ordnerVon(d);
    if (!rel) continue;
    anlegen(rel).anzahl++;
    const teile = rel.split('/');
    for (let i = 1; i <= teile.length; i++) map.get(schluessel(teile.slice(0, i).join('/'))).gesamt++;
  }

  const ordner = [...map.values()].sort((a, b) => vergleichePfad(a.pfad, b.pfad));
  return { wurzelItemId: wurzel?.item_id || null, wurzelPfad, ordnerVon, ordner };
}

/** Liegt `pfad` in `ordner` oder darunter (Groß-/Kleinschreibung egal wie in SharePoint)? */
export function rohIstUnter(pfad, ordner) {
  const p = schluessel(pfad);
  const o = schluessel(ordner);
  return p === o || p.startsWith(`${o}/`);
}
