// _shared/ablage/asset.js
// Asset-Zeilen fuer SharePoint-Dateien: eine Datei = eine Zeile (drive_id, item_id).
// Upsert statt Insert, damit Commit aus dem CRM und Meldung aus dem Delta-Feed sich nicht doppeln.

const TABELLE = {
  video: 'kooperation_video_asset',
  story: 'kooperation_story_asset',
  still: 'kooperation_bilder_asset',
  roh: 'kooperation_rohmaterial_asset',
};

const TYPEN = Object.keys(TABELLE);

// Spalten, die beim Entfernen gebraucht werden (nur was die jeweilige Tabelle wirklich hat)
const ENTFERNEN_SPALTEN = {
  video: 'id, video_id',
  story: 'id, video_id, story_id',
  still: 'id, video_id',
  roh: 'id',
};

// Promote-Zeilen (Finale per source_asset_id) teilen die Datei; nur Rohmaterial hat keine
const MIT_SOURCE = new Set(['video', 'story', 'still']);

/** Spalten aus dem driveItem (Graph). */
function dateiSpalten(item, { driveId, pfad }) {
  return {
    ablage: 'sharepoint',
    drive_id: driveId,
    item_id: item.id,
    etag: item.eTag || null,
    ctag: item.cTag || null,
    file_url: item.webUrl || null,
    file_path: pfad,
    file_name: item.name,
    file_size: item.size ?? null,
    breite: item.video?.width ?? item.image?.width ?? null,
    hoehe: item.video?.height ?? item.image?.height ?? null,
  };
}

/**
 * Fachliche Spalten je Typ.
 * @param {object} ctx { kooperation_id, kooperation_video_id, story_id, version_number, is_final, variant_name, titel }
 */
function fachSpalten(typ, ctx) {
  const final = !!ctx.is_final;
  const version = final ? 1 : (Number(ctx.version_number) || 1);
  switch (typ) {
    case 'video':
      return {
        video_id: ctx.kooperation_video_id,
        version_number: version,
        variant_name: ctx.variant_name || null,
        is_final: final,
        ...(ctx.titel !== undefined ? { titel: ctx.titel } : {}),
      };
    case 'story':
      return {
        story_id: ctx.story_id,
        video_id: ctx.kooperation_video_id,
        version_number: version,
        variant_name: ctx.variant_name || null,
        is_final: final,
        is_current: !final,
      };
    case 'still':
      return {
        kooperation_id: ctx.kooperation_id,
        video_id: ctx.kooperation_video_id || null,
        version_number: version,
        variant_name: ctx.variant_name || null,
        is_final: final,
        is_current: !final,
      };
    case 'roh':
      return { kooperation_id: ctx.kooperation_id, ...(ctx.folder_url ? { folder_url: ctx.folder_url } : {}) };
    default:
      throw new Error(`Unbekannter Asset-Typ ${typ}`);
  }
}

function nurOriginal(q, typ) {
  return MIT_SOURCE.has(typ) ? q.is('source_asset_id', null) : q;
}

async function findeNachItem(supabase, typ, driveId, itemId) {
  const q = supabase.from(TABELLE[typ]).select('*').eq('drive_id', driveId).eq('item_id', itemId);
  const { data, error } = await nurOriginal(q, typ).maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Sucht die Datei in allen vier Tabellen. -> { typ, row } | null */
async function findeUeberall(supabase, driveId, itemId) {
  for (const typ of TYPEN) {
    const row = await findeNachItem(supabase, typ, driveId, itemId);
    if (row) return { typ, row };
  }
  return null;
}

/**
 * Legt die Zeile an oder aktualisiert sie (gleiches Item). Neuer Inhalt (cTag) -> neues created_at,
 * damit Caches und Poster neu laden.
 * @returns {{ row:object, neu:boolean }}
 */
async function upsert(supabase, typ, werte, { uploadedBy = null, jetzt = new Date().toISOString() } = {}) {
  const tabelle = TABELLE[typ];
  const vorhanden = await findeNachItem(supabase, typ, werte.drive_id, werte.item_id);
  if (vorhanden) return aktualisieren(supabase, typ, vorhanden, werte, { jetzt });

  const { data, error } = await supabase
    .from(tabelle)
    .insert({ ...werte, uploaded_by: uploadedBy, created_at: jetzt })
    .select('*')
    .single();
  if (!error) {
    await aktuellSetzen(supabase, typ, data);
    return { row: data, neu: true };
  }
  if (error.code !== '23505') throw error;
  // parallel angelegt (Commit vs. Delta): die andere Zeile gewinnt, Werte nachziehen
  const andere = await findeNachItem(supabase, typ, werte.drive_id, werte.item_id);
  if (!andere) throw error;
  return aktualisieren(supabase, typ, andere, werte, { jetzt });
}

async function aktualisieren(supabase, typ, row, werte, { jetzt = new Date().toISOString() } = {}) {
  const inhaltNeu = werte.ctag && row.ctag && werte.ctag !== row.ctag;
  const patch = { ...werte };
  if (inhaltNeu) patch.created_at = jetzt;
  const { data, error } = await supabase.from(TABELLE[typ]).update(patch).eq('id', row.id).select('*').single();
  if (error) throw error;
  // Promote-Finals zeigen auf dieselbe Datei: Pfad/Name/Link mitziehen
  if (MIT_SOURCE.has(typ)) {
    const geteilt = { file_path: data.file_path, file_url: data.file_url, file_name: data.file_name, etag: data.etag, ctag: data.ctag };
    await supabase.from(TABELLE[typ]).update(geteilt).eq('source_asset_id', row.id).eq('drive_id', row.drive_id).eq('item_id', row.item_id);
  }
  await aktuellSetzen(supabase, typ, data);
  return { row: data, neu: false };
}

/** is_current wie im Client (Videos per DB-Trigger). */
async function aktuellSetzen(supabase, typ, row) {
  if (typ === 'story' && row.story_id) return flagsFuer(supabase, TABELLE.story, 'story_id', row.story_id);
  if (typ === 'still' && row.video_id) return flagsFuer(supabase, TABELLE.still, 'video_id', row.video_id);
  return null;
}

async function flagsFuer(supabase, tabelle, fk, id) {
  const { data } = await supabase.from(tabelle).select('id, version_number, is_final').eq(fk, id);
  const loop = (data || []).filter((a) => !a.is_final);
  if (!loop.length) return;
  const max = Math.max(...loop.map((a) => a.version_number || 1));
  const alt = loop.filter((a) => (a.version_number || 1) !== max).map((a) => a.id);
  const aktuell = loop.filter((a) => (a.version_number || 1) === max).map((a) => a.id);
  if (alt.length) await supabase.from(tabelle).update({ is_current: false }).in('id', alt);
  if (aktuell.length) await supabase.from(tabelle).update({ is_current: true }).in('id', aktuell);
}

/** Alle Zeilen zu einem Item entfernen (Original + Promote-Finals). -> Anzahl */
async function entfernenNachItem(supabase, typ, driveId, itemId) {
  const tabelle = TABELLE[typ];
  // Spalten je Tabelle: Video hat nur video_id, Still video_id, Rohmaterial keine von beiden, nur Story beide.
  // Eine unbekannte Spalte liesse die Abfrage still scheitern (zeilen: 0) und der Datensatz bliebe stehen.
  const { data: rows, error: leseFehler } = await supabase.from(tabelle).select(ENTFERNEN_SPALTEN[typ]).eq('drive_id', driveId).eq('item_id', itemId);
  if (leseFehler) throw leseFehler;
  if (!rows?.length) return 0;
  if (typ === 'video') {
    // asset_id faellt sonst auf null: die Kommentare stuenden dann bei allen Varianten der Runde
    await supabase.from('kooperation_video_zeitkommentar').update({ deleted_at: new Date().toISOString() }).in('asset_id', rows.map((r) => r.id)).is('deleted_at', null);
  }
  const { error } = await supabase.from(tabelle).delete().in('id', rows.map((r) => r.id));
  if (error) throw error;
  for (const r of rows) await aktuellSetzen(supabase, typ, r);
  return rows.length;
}

/** Bestands-Zeile (Dropbox/OneDrive) auf die SharePoint-Datei umstellen; Promote-Finale ziehen mit. */
async function umstellen(supabase, typ, row, werte) {
  const tabelle = TABELLE[typ];
  const { data, error } = await supabase.from(tabelle).update(werte).eq('id', row.id).select('*').single();
  if (error) throw error;
  if (MIT_SOURCE.has(typ)) {
    const { error: fErr } = await supabase.from(tabelle).update(werte).eq('source_asset_id', row.id);
    if (fErr) throw fErr;
  }
  return data;
}

/** Wird die Datei noch von einer anderen Zeile genutzt (z. B. Promote)? */
async function weitereVerweise(supabase, driveId, itemId, { ausser } = {}) {
  let n = 0;
  for (const typ of TYPEN) {
    let q = supabase.from(TABELLE[typ]).select('id', { count: 'exact', head: true }).eq('drive_id', driveId).eq('item_id', itemId);
    if (ausser?.typ === typ) q = q.neq('id', ausser.id);
    const { count } = await q;
    n += count || 0;
  }
  return n;
}

module.exports = {
  TABELLE,
  TYPEN,
  dateiSpalten,
  fachSpalten,
  findeNachItem,
  findeUeberall,
  upsert,
  aktualisieren,
  aktuellSetzen,
  entfernenNachItem,
  umstellen,
  weitereVerweise,
};
