// _shared/ablage/klassifizierung.js
// Reine Logik ohne I/O (Muster: videoBrowserTagLogic.js): Was bedeutet ein Item aus dem
// Delta-Feed fuers CRM? Der Eltern-Ordner aus dem Register bestimmt die Bedeutung.
// abgleich.js laedt die Eingaben und fuehrt die Entscheidung aus.
//
// Unter dem Unternehmen liegen die Bereiche Medien (Marke/Kampagne/Produktion/Kooperation, ADR 0069) und Verträge (ADR 0067),
// dazu Rechnungen und Aufträge (ADR 0068). In den Dokument-Bereichen legt das CRM keine Zeilen aus
// dem Finder an: Dokumente kennt es nur aus eigenen Uploads (abgleich-datei pflegt Pfad und Namen).
// Ablage (ADR 0065): Videos/Video_N/Feedbackschleife_K bzw. Finale_Version enthalten Video und
// Bild flach (Typ aus der Endung) und je Story-Slot einen Ordner Story_K. Typ-Ordner Storys/
// und Bilder/ sowie Varianten-Ordner (A/B/C) stammen aus dem Altbestand und gelten bis zum
// Umsortieren weiter.
//
// Entscheidungen fuer Dateien:
//   ignorieren | warten | unzugeordnet | entfernen
//   asset    { typ, ziel, umziehen }  Asset-Zeile anlegen/aktualisieren
//   format   { typ, ziel, format }    Finale Version: Formatordner nach Pixelmass + verschieben
//   zurueck  { typ, ziel }            Fachdatei an einen Nicht-Fach-Ort verschoben (oder in einem
//                                     alten Varianten-Ordner): an ihren Platz verschieben
// Fuer Ordner:
//   ignorieren | warten | ordner_geloescht | wiederherstellen | frei { besitz } | frei_aktualisieren { besitz }
//   fach { art, soll, ... } | zurueck_verschieben | zurueck_benennen | variante_umbenennen { variante }

const {
  MUSTER, FINALE_ORDNER, NAMEN, DOKUMENT_BEREICHE, nummer, formatOrdner, formatAusOrdner, formatAusMass, systemdatei, dateiTyp, bereichAusOrdner,
} = require('./pfad');
const { istDokument } = require('./dokument');

const UPLOAD_WARTEN_MS = 10 * 60 * 1000;
// Maße liefert Graph oft erst nach der Medienanalyse: kurz takten, Fenster bleibt 10 min
const MASS_VERSUCHE = 30;
const ELTERN_VERSUCHE = 5;
const WARTEN_SEK = { upload: 120, eltern: 30, mass: 20 };

const ASSET_TYP = { videos: 'video', storys: 'story', bilder: 'still', rohmaterial: 'roh' };
const GUELTIGE_TYPEN = new Set(Object.values(ASSET_TYP));
const BESITZ = ['unternehmen_id', 'bereich', 'marke_id', 'kampagne_id', 'produktion_id', 'kooperation_id', 'kooperation_video_id', 'typ', 'story_nummer', 'version_number'];

/** Besitzer-Spalten fuer einen Ordner unter `eltern` (frei: erbt den fachlichen Ort). */
function besitzVon(eltern) {
  const out = {};
  if (!eltern) return out;
  for (const k of BESITZ) if (eltern[k] != null) out[k] = eltern[k];
  return out;
}

/** ablage_upload.kontext -> Ziel (gleiches Format wie aus dem Register). */
function zielAusKontext(k) {
  return {
    kooperation_id: k.kooperation_id || null,
    kooperation_video_id: k.kooperation_video_id || null,
    story_id: k.story_id || null,
    version_number: Number(k.version_number) || 1,
    is_final: !!k.is_final,
    variant_name: k.variant_name || null,
  };
}

/** Asset-Zeile -> Ziel (fuer "zurueck an den alten Platz"). */
function zielAusZeile(row) {
  return {
    kooperation_id: row.kooperation_id || null,
    kooperation_video_id: row.video_id || null,
    story_id: row.story_id || null,
    version_number: row.version_number || 1,
    is_final: !!row.is_final,
    variant_name: row.variant_name || null,
  };
}

/**
 * Fachlicher Ort eines Ordners fuer Dateien darin.
 * -> { art:'asset', typ, ziel } | { art:'lose', ziel } | { art:'finale_video', ziel } | { art:'finale_story', ziel }
 *    | { art:'flach', ziel } | { art:'frei' } | { art:'ignorieren', grund } | { art:'falsch', grund }
 * ziel.variant_name === undefined: der Ordner sagt nichts zur Variante.
 */
function ortVon(eltern) {
  const typ = eltern.typ;
  const assetTyp = ASSET_TYP[typ];
  const basis = {
    kooperation_id: eltern.kooperation_id || null,
    kooperation_video_id: eltern.kooperation_video_id || null,
    story_nummer: eltern.story_nummer ?? null,
  };
  const unvollstaendig = (t) => ((t === 'video' || t === 'story' || t === 'still') && !basis.kooperation_video_id)
    || (t === 'story' && !basis.story_nummer)
    || !basis.kooperation_id;
  const asset = (t, ziel) => (unvollstaendig(t) ? { art: 'falsch', grund: 'register_unvollstaendig' } : { art: 'asset', typ: t, ziel });

  switch (eltern.art) {
    case 'variante':
      // Alter Varianten-Ordner (A/B/C) einer Video-Schleife: die Datei zieht flach in die Schleife
      if (typ === 'videos') {
        return unvollstaendig('video')
          ? { art: 'falsch', grund: 'register_unvollstaendig' }
          : { art: 'flach', ziel: { ...basis, version_number: eltern.version_number || 1, is_final: false } };
      }
      if (typ !== 'storys') return { art: 'frei' };
      return asset(assetTyp, { ...basis, version_number: eltern.version_number || 1, is_final: false, variant_name: eltern.variante || eltern.name });
    case 'story': {
      // Story_K in einer Runde unter Videos/Video_N; ohne version_number liegt er in der Finalen Version
      if (typ !== 'videos') return { art: 'falsch', grund: 'story_ordner' };
      if (eltern.version_number == null) {
        return unvollstaendig('story')
          ? { art: 'falsch', grund: 'register_unvollstaendig' }
          : { art: 'finale_story', ziel: { ...basis, version_number: 1, is_final: true } };
      }
      return asset('story', { ...basis, version_number: eltern.version_number, is_final: false });
    }
    case 'schleife': {
      const ziel = { ...basis, version_number: eltern.version_number || 1, is_final: false };
      if (typ === 'videos') return unvollstaendig('video') ? { art: 'falsch', grund: 'register_unvollstaendig' } : { art: 'lose', ziel };
      if (typ === 'storys' || typ === 'bilder') return asset(assetTyp, ziel);
      return { art: 'falsch', grund: 'schleife_ordner' };
    }
    case 'finale': {
      const ziel = { ...basis, version_number: 1, is_final: true };
      if (typ === 'videos') return unvollstaendig('video') ? { art: 'falsch', grund: 'register_unvollstaendig' } : { art: 'finale_video', ziel };
      if (typ === 'storys' || typ === 'bilder') return asset(assetTyp, ziel);
      return { art: 'falsch', grund: 'finale_ordner' };
    }
    case 'format': {
      const f = formatAusOrdner(eltern.format || eltern.name);
      if (typ !== 'videos' || !f) return { art: 'frei' };
      return asset('video', { ...basis, version_number: 1, is_final: true, variant_name: f });
    }
    case 'typ':
      if (typ === 'rohmaterial') return asset('roh', { kooperation_id: basis.kooperation_id });
      // Altbestand: Bilder/ direkt unter der Kooperation (Bild ohne Video)
      if (typ === 'bilder') {
        return basis.kooperation_id
          ? { art: 'asset', typ: 'still', ziel: { kooperation_id: basis.kooperation_id, kooperation_video_id: null, version_number: 1, is_final: false } }
          : { art: 'falsch', grund: 'register_unvollstaendig' };
      }
      return { art: 'falsch', grund: 'typ_ordner' };
    case 'frei':
      return DOKUMENT_BEREICHE.has(eltern.bereich) ? { art: 'dokument' } : { art: 'frei' };
    case 'dokument':
      return { art: 'dokument' };
    case 'bereich':
      return DOKUMENT_BEREICHE.has(eltern.bereich) ? { art: 'dokument' } : { art: 'falsch', grund: 'bereich_ordner' };
    case 'test':
    case 'unzugeordnet':
      return { art: 'ignorieren', grund: `${eltern.art}_ordner` };
    default:
      return { art: 'falsch', grund: `${eltern.art}_ordner` };
  }
}

function zurueck(asset) {
  return { aktion: 'zurueck', typ: asset.typ, ziel: zielAusZeile(asset.row) };
}

/** Bestehendes Asset behaelt seine Variante, wenn der Ordner nichts dazu sagt. */
function alsAsset(typ, ziel, asset) {
  const variant = ziel.variant_name !== undefined ? ziel.variant_name : (asset?.row?.variant_name ?? null);
  return { aktion: 'asset', typ, ziel: { ...ziel, variant_name: variant }, umziehen: !!asset && asset.typ !== typ };
}

/**
 * @param {object} a
 * @param {{name:string, breite?:number|null, hoehe?:number|null}} a.item frisches driveItem
 * @param {object|null} a.eltern Register-Zeile des Eltern-Ordners
 * @param {boolean} [a.elternIstWurzel]
 * @param {boolean} [a.elternOffen] Eltern-Ordner steht noch unbearbeitet im Eingang
 * @param {{typ:string,row:object}|null} [a.asset] bestehende Asset-Zeile (Original)
 * @param {object|null} [a.upload] ablage_upload zu dieser Datei
 * @param {number} [a.versuche] Claims seit der letzten Aenderung (1 = erster)
 * @param {number} [a.jetztMs]
 */
function dateiEinordnen({ item, eltern, elternIstWurzel = false, elternOffen = false, asset = null, upload = null, versuche = 1, jetztMs = Date.now() }) {
  if (systemdatei(item.name)) return { aktion: 'ignorieren', grund: 'systemdatei' };

  // Aus dem CRM hochgeladen: der Client legt die Zeile nach dem Commit an. Kommt sie nicht
  // (Tab zu, Netz weg), gilt nach 10 Minuten, was der Upload wollte.
  if (!asset && upload) {
    const seit = Date.parse(upload.abgeschlossen_at || upload.erstellt_at || '') || 0;
    if (jetztMs - seit < UPLOAD_WARTEN_MS) return { aktion: 'warten', sek: WARTEN_SEK.upload, grund: 'upload_laeuft' };
    const k = upload.kontext || {};
    // Umzug des Bestands: die Datei gehoert zu einer bestehenden Zeile, nie ein zweites Asset
    if (GUELTIGE_TYPEN.has(upload.typ) && k.umzug_asset_id) {
      return { aktion: 'umzug', typ: upload.typ, asset_id: k.umzug_asset_id, upload_id: upload.id };
    }
    if (GUELTIGE_TYPEN.has(upload.typ) && k.kooperation_id) {
      return { aktion: 'asset', typ: upload.typ, ziel: zielAusKontext(k), umziehen: false, quelle: 'upload' };
    }
    // Dokument hochgeladen, Zeile nie geschrieben: der Abgleich traegt die Datei beim Bezug ein
    if (istDokument(upload.typ) && k.bezug_id) {
      return { aktion: 'dokument_upload', typ: upload.typ, upload_id: upload.id };
    }
  }

  if (!eltern || eltern.geloescht_at) {
    if (!elternIstWurzel && (elternOffen || versuche < ELTERN_VERSUCHE)) {
      return { aktion: 'warten', sek: WARTEN_SEK.eltern, grund: 'eltern_unbekannt' };
    }
    if (asset) return zurueck(asset);
    return { aktion: 'unzugeordnet', grund: elternIstWurzel ? 'wurzel' : 'eltern_unbekannt' };
  }

  const ort = ortVon(eltern);
  switch (ort.art) {
    case 'asset':
      return alsAsset(ort.typ, ort.ziel, asset);

    case 'lose': {
      // Alles liegt flach in der Schleife, der Typ kommt aus der Dateiendung (Video oder Bild).
      // Kein Varianten-Ordner: Bestehende Zeilen behalten eine alte Variante, neue haben keine.
      const typ = dateiTyp(item.name) || (asset && (asset.typ === 'video' || asset.typ === 'still') ? asset.typ : null);
      if (!typ) return asset ? zurueck(asset) : { aktion: 'unzugeordnet', grund: 'dateityp' };
      return alsAsset(typ, ort.ziel, asset);
    }

    case 'flach': {
      // Bestehende Zeile behaelt ihre Variante (Tags haengen daran), neue hat keine
      if (asset) return zurueck(asset);
      const typ = dateiTyp(item.name);
      if (!typ) return { aktion: 'unzugeordnet', grund: 'dateityp' };
      return { aktion: 'zurueck', typ, ziel: { ...ort.ziel, variant_name: null } };
    }

    case 'finale_story': {
      // Wie bei Videos: das Seitenverhaeltnis kommt aus den Pixelmassen, nur ohne Format-Ordner
      if (asset?.typ === 'story' && asset.row.is_final) return alsAsset('story', ort.ziel, asset);
      const format = formatAusMass(item.breite, item.hoehe);
      if (format) return alsAsset('story', { ...ort.ziel, variant_name: format }, asset);
      if (!(item.breite && item.hoehe) && versuche < MASS_VERSUCHE) return { aktion: 'warten', sek: WARTEN_SEK.mass, grund: 'kein_mass' };
      if (asset) return zurueck(asset);
      return { aktion: 'unzugeordnet', grund: 'format_unbekannt', breite: item.breite ?? null, hoehe: item.hoehe ?? null };
    }

    case 'finale_video': {
      if (asset?.typ === 'video' && asset.row.is_final) return alsAsset('video', ort.ziel, asset);
      // Bilder in der Finalen Version: direkt als finales Bild, kein Formatordner
      if (dateiTyp(item.name) === 'still') return alsAsset('still', ort.ziel, asset);
      const format = formatAusMass(item.breite, item.hoehe);
      if (format) {
        return { aktion: 'format', typ: 'video', format, ziel: { ...ort.ziel, variant_name: format }, umziehen: !!asset && asset.typ !== 'video' };
      }
      if (!(item.breite && item.hoehe) && versuche < MASS_VERSUCHE) return { aktion: 'warten', sek: WARTEN_SEK.mass, grund: 'kein_mass' };
      if (asset) return zurueck(asset);
      return { aktion: 'unzugeordnet', grund: 'format_unbekannt', breite: item.breite ?? null, hoehe: item.hoehe ?? null };
    }

    case 'frei':
      return asset ? zurueck(asset) : { aktion: 'ignorieren', grund: 'freier_ordner' };
    case 'dokument':
      return asset ? zurueck(asset) : { aktion: 'ignorieren', grund: 'dokument_ohne_crm' };
    case 'ignorieren':
      return asset ? zurueck(asset) : { aktion: 'ignorieren', grund: ort.grund };
    default:
      return asset ? zurueck(asset) : { aktion: 'unzugeordnet', grund: ort.grund };
  }
}

/**
 * Fachordner, den jemand im Finder selbst angelegt hat (Name nach CRM-Muster). Unter Videos/
 * gilt die Ablage aus ADR 0065; Storys/ und Bilder/ (Altbestand) behalten ihr altes Muster.
 */
function fachOrdnerErkennen(eltern, name) {
  const n = String(name || '').trim();
  const typ = eltern.typ;
  if (eltern.art === 'unternehmen') {
    const bereich = bereichAusOrdner(n);
    return bereich ? { art: 'bereich', bereich, soll: NAMEN.bereich(bereich) } : null;
  }
  if (eltern.art === 'typ' && (typ === 'videos' || typ === 'storys' || typ === 'bilder')) {
    const pos = nummer('video', n);
    return pos ? { art: 'video', position: pos } : null;
  }
  if (eltern.art === 'video' && typ === 'storys') {
    const k = nummer('story', n);
    return k ? { art: 'story', story_nummer: k, soll: NAMEN.story(k) } : null;
  }
  if ((eltern.art === 'video' && (typ === 'videos' || typ === 'bilder')) || (eltern.art === 'story' && typ === 'storys')) {
    const v = nummer('schleife', n);
    if (v) return { art: 'schleife', version_number: v, soll: NAMEN.schleife(v) };
    if (MUSTER.finale.test(n)) return { art: 'finale', soll: FINALE_ORDNER };
    return null;
  }
  if ((eltern.art === 'schleife' || eltern.art === 'finale') && typ === 'videos') {
    const k = nummer('story', n);
    if (k) return { art: 'story', story_nummer: k, soll: NAMEN.story(k) };
    if (eltern.art === 'schleife') return null;
    const f = formatAusOrdner(n);
    return f ? { art: 'format', format: formatOrdner(f), soll: formatOrdner(f) } : null;
  }
  if (eltern.art === 'schleife' && typ === 'storys') {
    const v = NAMEN.variante(n);
    return { art: 'variante', variante: v, soll: v };
  }
  return null;
}

/**
 * @param {object} a
 * @param {{item_id:string, name:string, parent_item_id:string|null, geloescht?:boolean}} a.item
 * @param {object|null} a.eigen Register-Zeile des Ordners selbst
 * @param {object|null} a.eltern Register-Zeile des Eltern-Ordners
 */
function ordnerEinordnen({ item, eigen = null, eltern = null, elternIstWurzel = false, elternOffen = false, istWurzel = false, versuche = 1 }) {
  if (item.geloescht) {
    return eigen && !eigen.geloescht_at ? { aktion: 'ordner_geloescht' } : { aktion: 'ignorieren', grund: 'geloescht' };
  }
  if (istWurzel) return { aktion: 'ignorieren', grund: 'wurzel' };

  if (eigen && eigen.geloescht_at) return { aktion: 'wiederherstellen' };

  if (eigen) {
    const verschoben = !!item.parent_item_id && item.parent_item_id !== eigen.parent_item_id;
    // Finder liefert Umlaute als NFD ("Verträge"): gleicher Name, keine Umbenennung
    const umbenannt = !!item.name && item.name.normalize('NFC') !== String(eigen.name || '').normalize('NFC');
    if (eigen.art === 'frei') {
      if (!verschoben && !umbenannt) return { aktion: 'ignorieren', grund: 'unveraendert' };
      if (verschoben && !eltern && !elternIstWurzel && (elternOffen || versuche < ELTERN_VERSUCHE)) {
        return { aktion: 'warten', sek: WARTEN_SEK.eltern, grund: 'eltern_unbekannt' };
      }
      return { aktion: 'frei_aktualisieren', besitz: besitzVon(eltern) };
    }
    // CRM fuehrt Struktur und Namen der Fachordner
    if (verschoben) return { aktion: 'zurueck_verschieben' };
    if (umbenannt) {
      return eigen.art === 'variante'
        ? { aktion: 'variante_umbenennen', variante: NAMEN.variante(item.name) }
        : { aktion: 'zurueck_benennen' };
    }
    return { aktion: 'ignorieren', grund: 'unveraendert' };
  }

  if (!eltern || eltern.geloescht_at) {
    if (elternIstWurzel) return { aktion: 'frei', besitz: {} };
    if (elternOffen || versuche < ELTERN_VERSUCHE) return { aktion: 'warten', sek: WARTEN_SEK.eltern, grund: 'eltern_unbekannt' };
    return { aktion: 'ignorieren', grund: 'eltern_unbekannt' };
  }

  const fach = fachOrdnerErkennen(eltern, item.name);
  if (fach) return { aktion: 'fach', ...fach };
  return { aktion: 'frei', besitz: besitzVon(eltern) };
}

module.exports = {
  dateiEinordnen,
  ordnerEinordnen,
  fachOrdnerErkennen,
  ortVon,
  besitzVon,
  BESITZ,
  zielAusKontext,
  zielAusZeile,
  UPLOAD_WARTEN_MS,
  MASS_VERSUCHE,
  ELTERN_VERSUCHE,
};
