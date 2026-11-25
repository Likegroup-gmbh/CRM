// auswertungEinheiten.js
// Die Einheiten der Auswertung (ADR 0076): je Kooperationsvideo und angelegter Story eine Einheit,
// auch ohne Finale Version, damit der Report alle möglichen Posts zeigt, bevor es Zahlen gibt.
// Stills gibt es erst als Finale Version. Gelesen wird über den Baum des Videos-Tabs
// (loadVideoBrowserData, buildTree), damit Finale Versionen, Titel und vererbte Tags dieselben
// sind wie dort. Paid-Linien erwarten keinen Post. Kooperationen ohne Linie (V1) gehören zu jeder Linie.

import { loadVideoBrowserData } from '../video-browser/VideoBrowserAdapter.js';
import { buildTree } from '../video-browser/videoBrowserTree.js';
import { FINAL_ID, storyName, videoName } from '../video-browser/videoBrowserFormat.js';
import { listProduktionen } from '../produktion/ProduktionService.js';
import { koopBetrag } from '../produktion/budgetTab.js';

const PAID = 'paid_creator_ads';
const TAG_GRUPPEN = { Persona: 'persona', Ansatz: 'ansatz', Plattform: 'plattform' };

function tagsAus(items, tagById) {
  const tags = { persona: [], ansatz: [], plattform: [] };
  items.flatMap(i => i.tagIds || []).forEach((id) => {
    const tag = tagById.get(id);
    const key = TAG_GRUPPEN[tag?.gruppe];
    if (key && !tags[key].includes(tag.label)) tags[key].push(tag.label);
  });
  return tags;
}

const datei = (item) => ({ id: item.id, ratio: item.type === 'still' ? null : item.ratio, name: item.name, item });

/**
 * Ohne Finale Version zeigt das Poster die passende Datei der jüngsten Feedbackschleife.
 * Nur fürs Poster: `dateien` bleiben die Finalen Versionen (Hinweis, Auswahl der geposteten Datei).
 */
function vorschauAus(row, passt) {
  const item = (row.folders || []).filter(f => f.kind === 'schleife').reverse()
    .map(f => (f.items || []).find(passt)).find(Boolean);
  return item ? datei(item) : null;
}

function gruppiereNach(list, key) {
  const map = new Map();
  list.forEach((item) => {
    if (!map.has(item[key])) map.set(item[key], []);
    map.get(item[key]).push(item);
  });
  return map;
}

/** Geplantes Postdatum des Kooperationsvideos; Link und Zahlen stehen am Post (ADR 0078). */
const vorbelegung = (video) => ({ gepostetAm: video?.posting_datum || null });

/**
 * Einheiten aus dem Baum einer Produktion. Rein, damit es ohne Supabase testbar ist.
 * @param {{ kooperationen: object[] }} tree - Ergebnis von buildTree
 * @param {{ produktion: { id: string, name: string }, tagTypen?: object[], stories?: object[], videos?: object[] }} kontext
 */
export function einheitenAusBaum(tree, { produktion, tagTypen = [], stories = [], videos = [] }) {
  const tagById = new Map(tagTypen.map(t => [t.id, t]));
  const videoById = new Map(videos.map(v => [v.id, v]));
  const storyNr = new Map();
  stories.forEach((s, i) => storyNr.set(s.id, (Number.isFinite(s.slot_index) ? s.slot_index : i) + 1));
  const slotsJeVideo = gruppiereNach(stories, 'video_id');
  const out = [];

  for (const koop of tree?.kooperationen || []) {
    const linie = koop.linie ? { id: koop.linie.id, name: koop.linie.name, bereich: koop.linie.bereich || null } : null;
    const basis = {
      kooperationId: koop.id,
      creator: { id: koop.creatorId, name: koop.name, handle: koop.handle, avatarUrl: koop.avatarUrl },
      linie,
      produktion: { id: produktion.id, name: produktion.name },
      erwartet: linie?.bereich !== PAID
    };

    for (const row of koop.rows || []) {
      const finals = (row.folders || []).find(f => f.id === FINAL_ID || f.kind === 'final')?.items || [];
      const finalVideos = finals.filter(i => i.type === 'video');
      out.push({
        ...basis, id: `video:${row.id}`, art: 'video', videoId: row.id, nr: row.number,
        label: videoName(row.number), titel: row.title || '', dateien: finalVideos.map(datei), tags: tagsAus(finalVideos, tagById),
        vorschau: finalVideos.length ? null : vorschauAus(row, i => i.type === 'video'),
        ...vorbelegung(videoById.get(row.id))
      });

      const jeStory = new Map();
      finals.filter(i => i.type === 'story').forEach((i) => {
        const key = i.storyId || i.asset?.story_id;
        if (!jeStory.has(key)) jeStory.set(key, []);
        jeStory.get(key).push(i);
      });
      const slots = (slotsJeVideo.get(row.id) || []).map(s => s.id);
      const storyIds = [...new Set([...slots, ...jeStory.keys()])]
        .map((storyId, idx) => ({ storyId, nr: storyNr.get(storyId) || idx + 1 }))
        .sort((a, b) => a.nr - b.nr);
      storyIds.forEach(({ storyId, nr }) => {
        const items = jeStory.get(storyId) || [];
        out.push({
          ...basis, id: `story:${storyId}`, art: 'story', videoId: row.id, nr,
          label: storyName(nr), titel: '', bezug: videoName(row.number), dateien: items.map(datei), tags: tagsAus(items, tagById),
          vorschau: items.length ? null : vorschauAus(row, i => i.type === 'story' && (i.storyId || i.asset?.story_id) === storyId)
        });
      });

      finals.filter(i => i.type === 'still').forEach((i, idx) => {
        out.push({
          ...basis, id: `still:${i.id}`, art: 'still', videoId: row.id, nr: idx + 1,
          label: `Bild ${idx + 1}`, titel: i.name || '', bezug: videoName(row.number), dateien: [datei(i)], tags: tagsAus([i], tagById)
        });
      });
    }
  }
  return out;
}

/** Gehört die Einheit zur Linie? Ohne Linie (null) gehört alles dazu. */
export function einheitInLinie(einheit, linieId) {
  if (!linieId) return true;
  return !einheit.linie || einheit.linie.id === linieId;
}

async function ladeProduktion(kampagneId, produktion) {
  const raw = await loadVideoBrowserData({
    kampagneId,
    produktionId: produktion.id,
    linien: produktion.linien || [],
    team: true
  });
  const tree = buildTree(raw, { team: true });
  return einheitenAusBaum(tree, { produktion, tagTypen: raw.tagTypen, stories: raw.stories, videos: raw.videos });
}

/** Verbrauch laut Glossar (VK netto plus Zusatzkosten) je Kooperation der Kampagne. */
async function ladeVerbrauch(kampagneId) {
  const { data, error } = await window.supabase
    .from('kooperationen')
    .select('id, produktion_id, briefing_id, verkaufspreis_zusatzkosten, kooperation_videos(verkaufspreis_netto)')
    .eq('kampagne_id', kampagneId);
  if (error) {
    console.warn('Auswertung: Verbrauch nicht lesbar', error.message || error);
    return [];
  }
  return (data || []).map(k => ({ id: k.id, produktionId: k.produktion_id, briefingId: k.briefing_id, betrag: koopBetrag(k).betrag }));
}

/**
 * Einheiten und Verbrauch für eine Produktion oder die ganze Kampagne.
 * @param {{ kampagneId: string, produktion?: object|null, ebene: 'produktion'|'kampagne' }} scope
 * @returns {Promise<{ einheiten: object[], produktionen: object[], verbrauch: object[] }>}
 */
export async function ladeEinheiten({ kampagneId, produktion = null, ebene }) {
  if (!window.supabase || !kampagneId) return { einheiten: [], produktionen: [], verbrauch: [] };
  const produktionen = ebene === 'kampagne' || !produktion
    ? await listProduktionen(kampagneId)
    : [produktion];
  const [listen, verbrauch] = await Promise.all([
    Promise.all(produktionen.map(p => ladeProduktion(kampagneId, p))),
    ladeVerbrauch(kampagneId)
  ]);
  return { einheiten: listen.flat(), produktionen, verbrauch };
}

/** Summe des Verbrauchs für die gewählte Ebene und Linie. */
export function verbrauchFuer(verbrauch, { produktionIds = null, linieId = null } = {}) {
  const ids = produktionIds ? new Set(produktionIds) : null;
  const summe = (verbrauch || [])
    .filter(k => !ids || ids.has(k.produktionId))
    .filter(k => !linieId || !k.briefingId || k.briefingId === linieId)
    .reduce((sum, k) => sum + k.betrag, 0);
  return summe > 0 ? summe : null;
}
