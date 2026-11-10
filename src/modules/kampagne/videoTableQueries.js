// videoTableQueries.js
// Supabase-Abfragen der Kooperationen-Videotabelle: IN-Abfragen in Batches,
// Select-Listen und Feedback-Kommentare zu Videos und Stills.

import {
  isMissingFeedbackTypeError,
  VIDEO_FEEDBACK_LEGACY_SELECT,
  VIDEO_FEEDBACK_SELECT
} from '../../core/VideoFeedbackBuckets.js';
import { groupZeitkommentare, ZEITKOMMENTAR_SELECT } from './videoTableZeitkommentare.js';

const BATCH_SIZE = 200;

/** `.in(column, ids)` in Blöcken zu 200 IDs, Ergebnisse zusammengeführt (erster Fehler gewinnt). */
export function batchInQuery(supabaseFrom, selectStr, column, ids, extraFilters) {
  if (ids.length <= BATCH_SIZE) {
    let q = supabaseFrom.select(selectStr).in(column, ids);
    if (extraFilters) q = extraFilters(q);
    return q.then(r => r);
  }
  const batches = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    let q = supabaseFrom.select(selectStr).in(column, ids.slice(i, i + BATCH_SIZE));
    if (extraFilters) q = extraFilters(q);
    batches.push(q);
  }
  return Promise.all(batches).then(results => {
    const merged = { data: [], error: null };
    for (const r of results) {
      if (r.error) { merged.error = r.error; break; }
      if (r.data) merged.data.push(...r.data);
    }
    return merged;
  });
}

const KAMPAGNE_JOIN = 'kampagne:kampagne_id (id, kampagnenname, eigener_name, unternehmen:unternehmen_id(id, firmenname, kein_dropbox), marke:marke_id(id, markenname))';
const STATUS_JOIN = 'status_ref:status_id(id, name)';

/** Kunden sehen keine Preise. */
export function koopSelect(isKunde) {
  return isKunde
    ? `id, name, status_id, posting_datum, vertrag_unterschrieben, nutzungsrechte, tracking_link, typ, videoanzahl, created_at, creator_id, produktion_id, bilder_folder_url, ${STATUS_JOIN}, ${KAMPAGNE_JOIN}`
    : `id, name, status_id, einkaufspreis_netto, einkaufspreis_gesamt, verkaufspreis_zusatzkosten, ksk_selbstzahler, ksk_betrag, posting_datum, vertrag_unterschrieben, nutzungsrechte, tracking_link, typ, videoanzahl, created_at, creator_id, produktion_id, bilder_folder_url, ${STATUS_JOIN}, ${KAMPAGNE_JOIN}`;
}

export const VIDEO_SELECT = 'id, kooperation_id, position, asset_url, content_art, caption, freigabe, link_content, folder_url, story_folder_url, link_produkte, thema, link_skript, skript_freigegeben, drehort, video_name, posting_datum, link_live, stats_views, stats_likes, stats_comments, stats_fetched_at, stats_error, einkaufspreis_netto, verkaufspreis_netto, kampagnenart, skript_deadline, content_deadline, strategie_item_id, strategie_item:strategie_item_id(id, screenshot_url, beschreibung, strategie_id, video_link, produkt:produkt_id(id, name)), skript_id, skript:skript_id(id, titel, status)';

export const CREATOR_SELECT = 'id, vorname, nachname, instagram, instagram_follower, tiktok, tiktok_follower, telefonnummer, lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt, lieferadresse_land';

export const VERSAND_SELECT = 'id, kooperation_id, video_id, versendet, tracking_nummer, produkt_name, produkt_link, strasse, hausnummer, plz, stadt, land, creator_adresse_id';

export async function loadVideoFeedbackComments(videoIds) {
  const sb = window.supabase;
  const load = (selectStr) => batchInQuery(
    sb.from('kooperation_video_comment'),
    selectStr,
    'video_id',
    videoIds,
    q => q.is('deleted_at', null).order('created_at', { ascending: true })
  );

  const result = await load(VIDEO_FEEDBACK_SELECT);
  if (!result.error || !isMissingFeedbackTypeError(result.error)) return result;

  console.warn('feedback_typ fehlt noch in der DB, lade Kommentare im Legacy-Modus.');
  return load(VIDEO_FEEDBACK_LEGACY_SELECT);
}

export async function loadStillFeedbackComments(videoIds) {
  const sb = window.supabase;
  return batchInQuery(
    sb.from('kooperation_still_comment'),
    VIDEO_FEEDBACK_SELECT,
    'video_id',
    videoIds,
    q => q.is('deleted_at', null).order('created_at', { ascending: true })
  );
}

// Optional: fehlt die Tabelle oder greift RLS, bleibt die Zelle beim Text.
export async function loadZeitkommentare(videoIds) {
  const result = await batchInQuery(
    window.supabase.from('kooperation_video_zeitkommentar'),
    ZEITKOMMENTAR_SELECT,
    'video_id',
    videoIds,
    q => q.is('deleted_at', null).order('created_at', { ascending: true })
  );
  if (result?.error) {
    console.warn('⚠️ Kommentare aus dem Videos-Tab konnten nicht geladen werden:', result.error);
    return {};
  }
  return groupZeitkommentare(result?.data);
}
