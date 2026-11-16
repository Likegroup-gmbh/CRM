// _shared/ablage/umzug-rest.js
// Was vom Umzug uebrig ist, fuer die Admin-Seite Medienablage: alle Zeilen aus ablage_umzug,
// die nicht fertig sind und nicht einfach noch laufen (Fehler, Uebersprungene, Wiederholungen),
// mit Dateiname, Kampagne und Kooperation. Die Gruende uebersetzt die Seite in Klartext.
// Lesend; ein Fehler beim Anreichern laesst die Zeilen ohne Kontext stehen.

// Medien-Assets: Tabelle und ob sie ueber das Video oder direkt an der Kooperation haengen
const MEDIEN = {
  video: { tabelle: 'kooperation_video_asset', ueber: 'video' },
  story: { tabelle: 'kooperation_story_asset', ueber: 'video' },
  still: { tabelle: 'kooperation_bilder_asset', ueber: 'kooperation' },
  roh: { tabelle: 'kooperation_rohmaterial_asset', ueber: 'kooperation' },
};
const SPALTEN = 'id, unternehmen_id, typ, asset_id, quelle, status, grund, versuche, quelle_ref, ziel_name';
// Mehr Zeilen zeigt die Seite nicht; die Zahl der Unternehmen ist klein, der Rest bleibt in der DB
const MAX_ZEILEN = 1000;
const BATCH = 100;

const eindeutig = (liste) => [...new Set(liste.filter(Boolean))];

function dateiAusRef(ref) {
  const teil = String(ref || '').split(/[?#]/)[0].split('/').filter(Boolean).pop() || null;
  if (!teil) return null;
  try {
    return decodeURIComponent(teil);
  } catch {
    return teil;
  }
}

async function ueberIds(supabase, tabelle, spalten, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const { data, error } = await supabase.from(tabelle).select(spalten).in('id', ids.slice(i, i + BATCH));
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

const nachId = (liste) => new Map(liste.map((x) => [x.id, x]));

/** -> Map `typ:asset_id` -> { datei, kampagne, kooperation } fuer die Medien-Zeilen. */
async function kontextLaden(supabase, zeilen) {
  const assets = new Map();
  for (const [typ, def] of Object.entries(MEDIEN)) {
    const ids = eindeutig(zeilen.filter((z) => z.typ === typ).map((z) => z.asset_id));
    if (!ids.length) continue;
    const spalten = def.ueber === 'video' ? 'id, file_name, titel, video_id' : 'id, file_name, titel, kooperation_id';
    for (const a of await ueberIds(supabase, def.tabelle, spalten, ids)) assets.set(`${typ}:${a.id}`, a);
  }
  const videos = nachId(await ueberIds(supabase, 'kooperation_videos', 'id, kooperation_id', eindeutig([...assets.values()].map((a) => a.video_id))));
  const koopVon = (a) => a.kooperation_id || videos.get(a.video_id)?.kooperation_id || null;
  const koops = nachId(await ueberIds(supabase, 'kooperationen', 'id, name, kampagne_id', eindeutig([...assets.values()].map(koopVon))));
  const kampagnen = nachId(await ueberIds(supabase, 'kampagne', 'id, kampagnenname', eindeutig([...koops.values()].map((k) => k.kampagne_id))));

  const out = new Map();
  for (const [schluessel, a] of assets) {
    const k = koops.get(koopVon(a));
    out.set(schluessel, {
      datei: a.file_name || a.titel || null,
      kooperation: k?.name || null,
      kampagne: kampagnen.get(k?.kampagne_id)?.kampagnenname || null,
    });
  }
  return out;
}

function createUmzugRest({ supabase, driveId }) {
  async function zeilen() {
    const { data, error } = await supabase.from('ablage_umzug').select(SPALTEN)
      .eq('drive_id', driveId).in('status', ['fehler', 'uebersprungen', 'offen'])
      .order('erstellt_at', { ascending: true }).range(0, MAX_ZEILEN - 1);
    if (error) throw error;
    // "offen" ohne Fehlversuch ist normaler Fortschritt, kein Rest
    return (data || []).filter((z) => z.status !== 'offen' || Number(z.versuche) > 0);
  }

  /** -> [{ id, unternehmen_id, bereich, typ, status, grund, versuche, datei, kampagne, kooperation }] */
  async function laden() {
    const liste = await zeilen();
    const kontext = await kontextLaden(supabase, liste).catch((err) => {
      console.warn('[ablage-stand] Umzug-Rest ohne Kontext:', err.message);
      return new Map();
    });
    return liste.map((z) => {
      const k = kontext.get(`${z.typ}:${z.asset_id}`) || {};
      return {
        id: z.id,
        unternehmen_id: z.unternehmen_id,
        bereich: MEDIEN[z.typ] ? 'medien' : 'dokumente',
        typ: z.typ,
        status: z.status,
        grund: z.grund,
        versuche: Number(z.versuche) || 0,
        datei: k.datei || z.ziel_name || (z.quelle === 'onedrive' ? null : dateiAusRef(z.quelle_ref)),
        kampagne: k.kampagne || null,
        kooperation: k.kooperation || null,
      };
    });
  }

  return { laden };
}

module.exports = { createUmzugRest, MAX_ZEILEN };
