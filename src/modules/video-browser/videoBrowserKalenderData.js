// videoBrowserKalenderData.js
// Daten des Kalenders im Videos-Tab (CONTEXT.md "Kalender (Videos-Tab)"): Kooperationsvideos der Kampagne
// mit ihrem Posting-Datum. Eigene Abfrage statt Baum des Spaltenbrowsers, weil der Umfang
// "Gesamte Kampagne" über die Produktion hinausgeht. RLS filtert serverseitig.

import { koopGehoertZurLinie } from '../produktion/ProduktionService.js';
import { videoName } from './videoBrowserFormat.js';
import { sortBy } from './videoBrowserRow.js';
import { formatDateLocal, parseDateOnly } from '../../core/calendarDates.js';
import { sucheBegriffe, sucheNormal, trifft } from './videoBrowserSuche.js';

const SELECT = `
  id, kooperation_id, position, titel, thema, video_name, posting_datum, created_at,
  kooperation:kooperation_id!inner(
    id, name, produktion_id, briefing_id, kampagne_id,
    creator:creator_id(vorname, nachname, profilbild_url, profilbild_thumb_url),
    linie:briefing_id(id, aktivierung_name)
  )
`;

// Eine Farbe je Linie, über die ID stabil (neue Linien verschieben die anderen nicht)
const LINIE_FARBEN = [
  'var(--blue-500)',
  'var(--purple-500)',
  'var(--green-500)',
  'var(--orange-500)',
  'var(--color-info)',
  'var(--amber-500)',
  'var(--purple-700)',
  'var(--green-700)'
];
const OHNE_LINIE_FARBE = 'var(--gray-400)';

export const OHNE_LINIE = 'Ohne Linie';

/** Alle Kooperationsvideos der Kampagne, mit und ohne Posting-Datum. */
export async function loadPostingVideos(kampagneId) {
  if (!window.supabase || !kampagneId) return [];
  const { data, error } = await window.supabase
    .from('kooperation_videos')
    .select(SELECT)
    .eq('kooperation.kampagne_id', kampagneId);
  if (error) throw error;
  return data || [];
}

/** Posting-Datum setzen (`YYYY-MM-DD`) oder mit `null` entfernen. */
export async function savePostingDatum(videoId, isoDate) {
  const { error } = await window.supabase
    .from('kooperation_videos')
    .update({ posting_datum: isoDate || null })
    .eq('id', videoId);
  if (error) throw error;
}

/** Zeilen mit geändertem Posting-Datum eines Videos (für sofortiges Umspringen und Rücksprung). */
export function mitPostingDatum(rows, videoId, isoDate) {
  return (rows || []).map(r => (r.id === videoId ? { ...r, posting_datum: isoDate || null } : r));
}

export function linieFarbe(linieId) {
  if (!linieId) return OHNE_LINIE_FARBE;
  let hash = 0;
  for (const ch of String(linieId)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return LINIE_FARBEN[hash % LINIE_FARBEN.length];
}

function creatorName(koop) {
  const c = koop?.creator || {};
  return [c.vorname, c.nachname].filter(Boolean).join(' ') || koop?.name || 'Creator';
}

/** Video-Nummer wie im Spaltenbrowser: Position, sonst Rang nach Position und Anlage in der Kooperation. */
function nummernJeVideo(rows) {
  const jeKoop = new Map();
  rows.forEach((r) => {
    const key = r.kooperation_id || r.kooperation?.id;
    if (!jeKoop.has(key)) jeKoop.set(key, []);
    jeKoop.get(key).push(r);
  });
  const nr = new Map();
  jeKoop.forEach((list) => {
    sortBy(list, 'position', 'created_at').forEach((r, idx) => nr.set(r.id, r.position || idx + 1));
  });
  return nr;
}

function imUmfang(row, { umfang, produktionId, linieId }) {
  if (umfang === 'kampagne') return true;
  const koop = row.kooperation || {};
  if (produktionId && koop.produktion_id !== produktionId) return false;
  return koopGehoertZurLinie(koop, linieId);
}

function eintrag(row, nr) {
  const koop = row.kooperation || {};
  const linieId = koop.briefing_id || null;
  const titel = row.titel || row.thema || row.video_name || '';
  const day = parseDateOnly(row.posting_datum);
  const creator = creatorName(koop);
  const label = videoName(nr);
  const linieName = linieId ? (koop.linie?.aktivierung_name || 'Briefing') : OHNE_LINIE;
  return {
    id: row.id,
    kooperationId: koop.id || row.kooperation_id,
    creator,
    creatorBild: koop.creator?.profilbild_thumb_url || koop.creator?.profilbild_url || null,
    nr,
    label,
    titel,
    postingDatum: day ? formatDateLocal(day) : null,
    linie: { id: linieId, name: linieName, farbe: linieFarbe(linieId) },
    suche: sucheNormal([creator, label, row.titel, row.thema, row.video_name, linieId ? linieName : ''].filter(Boolean).join(' '))
  };
}

const nachCreator = (a, b) => a.creator.localeCompare(b.creator, 'de') || a.nr - b.nr;

/**
 * Einträge im Umfang: Videos mit Posting-Datum als Kalender-Events, die übrigen als Liste.
 * Ohne Linie (V1) gehört eine Kooperation zu jeder Linie.
 * @param {object[]} rows - Ergebnis von loadPostingVideos
 * @param {{ umfang: 'auswahl'|'kampagne', produktionId?: string|null, linieId?: string|null }} scope
 * @returns {{ events: object[], ohneDatum: object[] }}
 */
export function kalenderEintraege(rows, scope) {
  const all = rows || [];
  const nr = nummernJeVideo(all);
  const eintraege = all.filter(r => imUmfang(r, scope)).map(r => eintrag(r, nr.get(r.id)));

  const events = eintraege
    .filter(e => e.postingDatum)
    .sort((a, b) => a.postingDatum.localeCompare(b.postingDatum) || nachCreator(a, b))
    .map(e => ({
      id: e.id,
      date: e.postingDatum,
      title: e.creator,
      sub: e.label,
      tooltip: e.titel || undefined,
      draggable: true,
      suche: e.suche
    }));
  const ohneDatum = eintraege.filter(e => !e.postingDatum).sort(nachCreator);
  return { events, ohneDatum };
}

/** Textsuche des Videos-Tabs auf Einträge und Liste: Creator, Video-Nr., Titel, Thema, Videoname, Linie. */
export function filterListe(items, query) {
  const begriffe = sucheBegriffe(query);
  if (!begriffe.length) return items || [];
  return (items || []).filter(e => trifft(e.suche, begriffe));
}
