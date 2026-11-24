// VideoBrowserAdapter.js
// Liest die vorhandenen Tabellen für den Videos-Tab (Read-Adapter, keine neuen
// Entitäten). Der Baum entsteht in videoBrowserLogic.buildTree. RLS filtert serverseitig,
// Kunden bekommen dadurch kein Rohmaterial. Die Schreibzugriffe liegen in
// videoBrowserAdapterWrite.js und werden hier weiter exportiert.

import { scopeKoopsByLinie } from '../produktion/ProduktionService.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { mitAblage } from '../../core/ablage/ablageLink.js';
import { ZEIT_SELECT } from './videoBrowserAdapterWrite.js';
import { loadVerknuepfungen } from './videoBrowserVerknuepfungen.js';

export { deleteAsset } from '../../core/assetDelete.js';
export * from './videoBrowserAdapterWrite.js';

const CHUNK = 100;

const KOOP_SELECT = `
  id, name, briefing_id, creator_id, produktion_id, created_at,
  creator:creator_id (id, vorname, nachname, instagram, profilbild_thumb_url, profilbild_url)
`;
// Skript und Posting-Datum lesen auch Kunden (Details der Vollansicht, Kalender)
const VIDEO_SELECT = 'id, kooperation_id, position, titel, thema, video_name, caption, status, posting_datum, skript_id, skript:skript_id(id, titel, status, briefing_id), created_at';
// Nur fürs Team: Content-Deadline (Frist-Tag auf Ausstehenden Videos) und Videoidee (Kunden dürfen
// strategie_items nicht durchgängig lesen) mit Konzept und Produkt.
const VIDEO_SELECT_TEAM = `${VIDEO_SELECT}, content_deadline, strategie_item_id, strategie_item:strategie_item_id(id, beschreibung, strategie_id, produkt:produkt_id(id, name))`;
const STORY_SELECT = 'id, video_id, slot_index, slot_name, created_at';
const VIDEO_ASSET_SELECT = mitAblage('id, video_id, file_url, file_path, version_number, variant_name, titel, ad_manager_name, description, is_current, is_final, source_asset_id, created_at');
const STORY_ASSET_SELECT = mitAblage('id, video_id, story_id, file_url, file_path, file_name, file_size, version_number, is_current, is_final, variant_name, titel, source_asset_id, created_at');
const STILL_SELECT = mitAblage('id, kooperation_id, video_id, file_url, file_path, file_name, file_size, version_number, is_final, variant_name, titel, source_asset_id, created_at');
const ROH_SELECT = mitAblage('id, kooperation_id, file_name, file_path, file_url, file_size, folder_url, titel, created_at');
const ROH_ORDNER_SELECT = 'item_id, parent_item_id, name, pfad, art, kooperation_id';
const TAG_TYP_SELECT = 'id, label, gruppe, kampagne_id';
const VARIANTE_TAG_SELECT = 'video_id, variant_key, tag_typ_id, created_at';
const NOTE_SELECT = 'id, video_id, runde, feedback_typ, text, author_name, created_at, deleted_at';
const STILL_NOTE_SELECT = 'id, video_id, runde, feedback_typ, text, author_name, created_at, deleted_at';

function chunks(list, size = CHUNK) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Eine Tabelle in Blöcken über eine ID-Spalte lesen. Fehler = leere Liste (optionale Daten). */
async function readIn(table, select, column, ids, { optional = true, order } = {}) {
  if (!ids.length) return [];
  const results = await Promise.all(chunks(ids).map(async (part) => {
    let query = window.supabase.from(table).select(select).in(column, part);
    if (order) query = query.order(order, { ascending: true });
    const { data, error } = await query;
    if (error) {
      if (!optional) throw error;
      console.warn(`VideoBrowserAdapter: ${table} nicht lesbar`, error.message || error);
      return [];
    }
    return data || [];
  }));
  return results.flat();
}

/** Rohmaterial-Ordner aus dem Register: der Fachordner und seine Unterordner (ADR 0070), auch leere. */
async function loadRohOrdner(koopIds) {
  try {
    const results = await Promise.all(chunks(koopIds).map(async (part) => {
      const { data, error } = await window.supabase.from('ablage_ordner').select(ROH_ORDNER_SELECT)
        .in('kooperation_id', part).eq('typ', 'rohmaterial').in('art', ['typ', 'frei']).is('geloescht_at', null);
      if (error) throw error;
      return data || [];
    }));
    return results.flat().filter(o => o.item_id);
  } catch (error) {
    console.warn('VideoBrowserAdapter: ablage_ordner nicht lesbar', error?.message || error);
    return [];
  }
}

/**
 * @param {{ kampagneId: string, produktionId?: string|null, briefingId?: string|null,
 *           linien?: Array<{id: string, name: string}>, team: boolean }} scope
 */
export async function loadVideoBrowserData({ kampagneId, produktionId = null, briefingId = null, linien = [], team }) {
  if (!window.supabase || !kampagneId) {
    return emptyRaw(linien);
  }

  let koopQuery = window.supabase
    .from('kooperationen')
    .select(KOOP_SELECT)
    .eq('kampagne_id', kampagneId)
    .order('name', { ascending: true });
  if (produktionId) koopQuery = koopQuery.eq('produktion_id', produktionId);
  koopQuery = scopeKoopsByLinie(koopQuery, briefingId);

  const { data: kooperationen, error } = await koopQuery;
  if (error) throw error;

  const koopIds = (kooperationen || []).map(k => k.id);
  if (!koopIds.length) return emptyRaw(linien);

  const [videos, stillAssets, rohmaterial, rohOrdner] = await Promise.all([
    readIn('kooperation_videos', team ? VIDEO_SELECT_TEAM : VIDEO_SELECT, 'kooperation_id', koopIds, { optional: false }),
    readIn('kooperation_bilder_asset', STILL_SELECT, 'kooperation_id', koopIds),
    team ? readIn('kooperation_rohmaterial_asset', ROH_SELECT, 'kooperation_id', koopIds) : Promise.resolve([]),
    team ? loadRohOrdner(koopIds) : Promise.resolve([])
  ]);

  const videoIds = videos.map(v => v.id);
  const [stories, videoAssets, slotNotes, zeitkommentare, stillNotes, { ideen, produkte }, links] = await Promise.all([
    readIn('kooperation_story', STORY_SELECT, 'video_id', videoIds),
    readIn('kooperation_video_asset', VIDEO_ASSET_SELECT, 'video_id', videoIds),
    readIn('kooperation_video_comment', NOTE_SELECT, 'video_id', videoIds),
    readIn('kooperation_video_zeitkommentar', ZEIT_SELECT, 'video_id', videoIds),
    readIn('kooperation_still_comment', STILL_NOTE_SELECT, 'video_id', videoIds),
    team ? loadProdukte(videos) : Promise.resolve({ ideen: [], produkte: [] }),
    loadVerknuepfungen({
      client: window.supabase, kampagneId, produktionId, briefingId, kooperationen, videos, team
    })
  ]);

  const storyAssets = await readIn('kooperation_story_asset', STORY_ASSET_SELECT, 'story_id', stories.map(s => s.id));
  const [tagTypen, varianteTags] = await Promise.all([
    loadTagTypen(kampagneId),
    readIn('video_variante_tags', VARIANTE_TAG_SELECT, 'video_id', videoIds)
  ]);

  return {
    tagTypen,
    varianteTags,
    kooperationen: kooperationen || [],
    linien,
    videos,
    stories,
    videoAssets,
    storyAssets,
    stillAssets,
    rohmaterial,
    rohOrdner,
    slotNotes,
    zeitkommentare,
    stillNotes,
    ideen,
    produkte,
    links
  };
}

/** Produkt der Videoideen hinter den Videos (Meta-Zeile in Spalte 0). Fehler = keine Produkte. */
async function loadProdukte(videos) {
  const ideeIds = [...new Set(videos.map(v => v.strategie_item_id).filter(Boolean))];
  const ideen = await readIn('strategie_items', 'id, produkt_id', 'id', ideeIds);
  const produktIds = [...new Set(ideen.map(i => i.produkt_id).filter(Boolean))];
  const produkte = await readIn('produkt', 'id, name', 'id', produktIds);
  return { ideen, produkte };
}

function emptyRaw(linien) {
  return {
    kooperationen: [], linien, videos: [], stories: [], videoAssets: [],
    storyAssets: [], stillAssets: [], rohmaterial: [], rohOrdner: [], slotNotes: [], zeitkommentare: [], stillNotes: [],
    tagTypen: [], varianteTags: [], ideen: [], produkte: [], links: {}
  };
}

/** Katalog: globale Tags und die dieser Kampagne. Fehlt die Tabelle noch, gibt es keine Tags. */
async function loadTagTypen(kampagneId) {
  try {
    const { data, error } = await window.supabase
      .from('video_tag_typen')
      .select(TAG_TYP_SELECT)
      .or(`kampagne_id.is.null,kampagne_id.eq.${kampagneId}`);
    if (error) {
      console.warn('VideoBrowserAdapter: video_tag_typen nicht lesbar', error.message || error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('VideoBrowserAdapter: video_tag_typen nicht lesbar', err?.message || err);
    return [];
  }
}

/* ---- Tags an Varianten ---- */

/** Tag an eine Variante hängen. Ein zweites Mal derselben Zuordnung ist kein Fehler. */
export async function insertVarianteTag({ videoId, variantKey, tagTypId }) {
  const row = { video_id: videoId, variant_key: variantKey, tag_typ_id: tagTypId };
  const { data, error } = await window.supabase
    .from('video_variante_tags')
    .insert(row)
    .select(VARIANTE_TAG_SELECT)
    .single();
  // 23505 = gibt es schon (zweiter Tab, doppelter Klick): der Zustand stimmt trotzdem
  if (error?.code === '23505') return { ...row, created_at: new Date().toISOString() };
  if (error) throw error;
  return data;
}

export async function deleteVarianteTag({ videoId, variantKey, tagTypId }) {
  const { error } = await window.supabase
    .from('video_variante_tags')
    .delete()
    .eq('video_id', videoId)
    .eq('variant_key', variantKey)
    .eq('tag_typ_id', tagTypId);
  if (error) throw error;
}

/** Neuen Tag im Katalog anlegen (Gruppe "Eigene", gilt für die Kampagne). */
export async function createTagTyp({ label, gruppe = 'Eigene', kampagneId = null }) {
  const { data, error } = await window.supabase
    .from('video_tag_typen')
    .insert({ label, gruppe, kampagne_id: kampagneId })
    .select(TAG_TYP_SELECT)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Pfadkontext für Dropbox-Uploads einer Kooperation (gleiche Felder wie der
 * Rohmaterial-Upload und der Video-Upload-Drawer).
 * @returns {Promise<{ pathContext: object, creatorName: string, keinDropbox: boolean }>}
 */
export async function loadUploadContext(kooperationId) {
  const { data, error } = await window.supabase
    .from('kooperationen')
    .select(`
      id, name,
      creator:creator_id (vorname, nachname),
      kampagne:kampagne_id (
        id, kampagnenname, eigener_name,
        unternehmen:unternehmen_id (id, firmenname, kein_dropbox),
        marke:marke_id (id, markenname)
      )
    `)
    .eq('id', kooperationId)
    .single();
  if (error) throw error;
  const kamp = data.kampagne || {};
  return {
    pathContext: {
      unternehmen: kamp.unternehmen?.firmenname || '',
      marke: kamp.marke?.markenname || '',
      kampagne: KampagneUtils.getDisplayName(kamp),
      kooperation: data.name || ''
    },
    creatorName: [data.creator?.vorname, data.creator?.nachname].filter(Boolean).join(' '),
    keinDropbox: !!kamp.unternehmen?.kein_dropbox
  };
}
