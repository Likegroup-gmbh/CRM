// Kooperations-Bubbles auf der Creator-Kachel: Marken aus der Plattform
// (intern klickbar) plus Instagram-Werbepartner (externer Link oder Initialen).

import { avatarBubbles } from '../../core/components/AvatarBubbles.js';

export const MAX_COOP_BUBBLES = 6;

/**
 * Normalisiert ig_brand_mentions: Eintrag kann String (alt) oder
 * Objekt {handle,name,profile_pic,profile_pic_thumb} (neu) sein.
 */
export function normalizeBrandMentions(creator) {
  const raw = Array.isArray(creator?.ig_brand_mentions) ? creator.ig_brand_mentions : [];
  return raw
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        return { handle: entry, name: null, profile_pic: null, profile_pic_thumb: null };
      }
      if (typeof entry === 'object' && entry.handle) {
        return {
          handle: String(entry.handle),
          name: entry.name || null,
          profile_pic: entry.profile_pic || null,
          profile_pic_thumb: entry.profile_pic_thumb || null
        };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Plattform-Marken pro Creator in einem Batch-Query, dedupliziert nach marke.id,
 * neueste Kooperation zuerst.
 * @returns {Promise<Map<string, Array<object>>>} creator_id -> Marken
 */
export async function ladeKooperationMarken(supabase, creatorIds) {
  const { data, error } = await supabase
    .from('kooperationen')
    .select('creator_id, created_at, kampagne:kampagne_id(marke:marke_id(id,markenname,logo_url,logo_thumb_url))')
    .in('creator_id', creatorIds)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const byCreator = new Map();
  for (const row of data || []) {
    const marke = row.kampagne?.marke;
    if (!marke?.id) continue;
    if (!byCreator.has(row.creator_id)) byCreator.set(row.creator_id, new Map());
    const marks = byCreator.get(row.creator_id);
    if (!marks.has(marke.id)) marks.set(marke.id, marke);
  }
  return new Map([...byCreator].map(([id, marks]) => [id, [...marks.values()]]));
}

/**
 * Gemischte Bubble-Reihe: Plattform-Marken zuerst, dann Instagram-Werbepartner.
 * Dedupe ueber den Namen (case-insensitive). Ohne Eintraege ein Platzhalter.
 */
export function renderKoopBubbles(platformMarks, igBrands) {
  const items = [];
  const seen = new Set();

  for (const m of platformMarks || []) {
    const name = m.markenname || 'Marke';
    seen.add(name.trim().toLowerCase());
    items.push({
      name,
      type: 'org',
      id: m.id,
      entityType: 'marke',
      logo_url: m.logo_url || null,
      thumb_url: m.logo_thumb_url || null
    });
  }

  for (const b of igBrands || []) {
    const name = b.name || `@${b.handle}`;
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      name,
      type: 'org',
      logo_url: b.profile_pic || null,
      thumb_url: b.profile_pic_thumb || null,
      href: `https://instagram.com/${String(b.handle).replace('@', '')}`
    });
  }

  if (!items.length) return '<span class="creator-card__coops-leer">Keine Angabe</span>';
  return avatarBubbles.renderBubbles(items, { maxVisible: MAX_COOP_BUBBLES });
}
