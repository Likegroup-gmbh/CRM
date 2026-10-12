// instagramDrawerFill.js
// Regeln fuer den Instagram-Abruf im Drawer "Creator hinzufuegen".
// Der Abruf laeuft, bevor die Zeile existiert. Was der Nutzer getippt hat,
// bleibt. Was ein frueherer Abruf eingesetzt hat, zieht der naechste nach.
// Die Followerzahl folgt immer dem aktuellen Profil.

import { parseSocialLink } from '../../core/format/socialLink.js';

export const IG_TEXT_FIELDS = ['name', 'email', 'telefon', 'wohnort', 'notiz'];

const STAT_KEYS = [
  'sourcing_creator_id',
  'ig_views_8',
  'ig_views_30',
  'cpm_ig_8',
  'cpm_ig_30',
  'ig_stats',
  'ig_fetched_at',
  'profile_image_url',
  'profile_image_thumb_url'
];

export function leereIgOwners() {
  return { name: null, email: null, telefon: null, wohnort: null, notiz: null };
}

/** Profil-Handle oder null. Reels, Posts und Freitext loesen keinen Abruf aus. */
export function instagramProfilHandle(raw) {
  const parsed = parseSocialLink(String(raw || '').trim());
  if (parsed.platform !== 'instagram' || parsed.type !== 'profile' || !parsed.handle) return null;
  return parsed.handle.toLowerCase();
}

export function normalizedInstagramUrl(handle) {
  return `https://www.instagram.com/${handle}/`;
}

export function applyPreviewToForm(values, owners, preview) {
  const nextOwners = { ...owners };
  const nextValues = { ...values };
  for (const field of IG_TEXT_FIELDS) {
    if (owners[field] === 'user') continue;
    const incoming = preview[field] == null ? '' : String(preview[field]).trim();
    nextValues[field] = incoming;
    nextOwners[field] = incoming ? 'fetch' : null;
  }
  nextValues.follower_instagram = preview.follower_instagram == null || preview.follower_instagram === ''
    ? ''
    : String(preview.follower_instagram);
  return { values: nextValues, owners: nextOwners };
}

export function markUserEdit(owners, field) {
  if (!IG_TEXT_FIELDS.includes(field)) return owners;
  return { ...owners, [field]: 'user' };
}

/** Stammdaten, die schon einen Wert haben, gelten als Handarbeit. */
export function schuetzeGefuellte(owners, values) {
  const next = { ...owners };
  for (const field of IG_TEXT_FIELDS) {
    if (String(values[field] ?? '').trim()) next[field] = 'user';
  }
  return next;
}

/**
 * Reichweite, Bild und Pool-Bezug nur speichern, wenn sie zum Link im Feld
 * gehoeren. Follower und Textfelder kommen aus dem Formular.
 */
export function statsForSave(payload, linkValue) {
  const handle = instagramProfilHandle(linkValue);
  if (!payload || !handle || String(payload.username || '').toLowerCase() !== handle) return null;
  const stats = { ig_fetch_error: null };
  for (const key of STAT_KEYS) {
    if (payload[key] !== undefined) stats[key] = payload[key];
  }
  return stats;
}
