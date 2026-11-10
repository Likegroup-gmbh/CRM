// skriptPdfSocial.js
// Creator fuer das Anschreiben und Social-Links (Instagram, TikTok) der Creator-Karte.

import { konzeptCreatorFromSkript } from '../editor/skriptDocCreatorHtml.js';
import { httpUrl } from './skriptPdfLayout.js';

function creatorAusVerknuepfungen(rows) {
  const sorted = [...(rows || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const row of sorted) {
    const creator = row.kooperation?.creator;
    if (!creator) continue;
    const name = [creator.vorname, creator.nachname].filter(Boolean).join(' ').trim();
    const bildUrl = creator.profilbild_url || creator.profilbild_thumb_url || '';
    if (!name && !bildUrl) continue;
    return { name: name || 'Creator', bildUrl, instagram: String(creator.instagram || '').trim() };
  }
  return null;
}

function instagramAusCasting(skript) {
  return String(skript?.strategie_item?.casting_eintrag?.link_instagram || '').trim();
}

/** Genau ein Creator: Kooperation, sonst der der Videoidee. Instagram aus der Casting-Liste. */
export function creatorFuerAnschreiben(skript, verknuepfungen) {
  const ausKooperation = creatorAusVerknuepfungen(verknuepfungen);
  const konzept = konzeptCreatorFromSkript(skript);
  const base = ausKooperation || (konzept?.name ? {
    name: konzept.name,
    bildUrl: konzept.profilbild_url || konzept.profilbild_thumb_url || '',
    instagram: '',
  } : null);
  if (!base) return null;
  const vomCreator = String(
    base.instagram
    || skript?.strategie_item?.casting_eintrag?.creator?.instagram
    || ''
  ).trim();
  return { ...base, instagram: instagramAusCasting(skript) || vomCreator };
}

function tiktokUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/tiktok\.com/i.test(value)) return httpUrl(value);
  const handle = value.replace(/^@/, '').split(/[/?#]/)[0].trim();
  if (!handle) return '';
  return `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
}

function socialZiel(raw, feld) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('tiktok.com')) {
    const url = tiktokUrl(value);
    return url ? { label: 'TikTok', url } : null;
  }
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) {
    const url = instagramUrl(value);
    return url ? { label: 'Instagram', url } : null;
  }
  if (!/^https?:\/\//i.test(value) && !value.includes('.')) {
    const url = feld === 'tiktok' ? tiktokUrl(value) : instagramUrl(value);
    const label = feld === 'tiktok' ? 'TikTok' : 'Instagram';
    return url ? { label, url } : null;
  }
  const url = httpUrl(value);
  return url ? { label: 'Social Media', url } : null;
}

export function socialKarteLinks(item) {
  const kandidaten = [
    socialZiel(item.instagram || item.creator?.instagram, 'instagram'),
    socialZiel(item.tiktok || item.creator?.tiktok, 'tiktok'),
  ];
  const links = [];
  const gesehen = new Set();
  for (const ziel of kandidaten) {
    if (!ziel || gesehen.has(ziel.url)) continue;
    gesehen.add(ziel.url);
    links.push(ziel);
  }
  return links;
}

/** Anzeige rechts in der Creator-Karte: instagram.com/{handle}. */
export function instagramZeile(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const fromUrl = value.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i);
  const handle = (fromUrl?.[1] || value).replace(/^@/, '').replace(/\/$/, '').trim();
  if (!handle) return '';
  return `instagram.com/${handle}`;
}

function instagramUrl(raw) {
  const zeile = instagramZeile(raw);
  if (!zeile) return '';
  const handle = zeile.slice('instagram.com/'.length);
  return `https://instagram.com/${encodeURIComponent(handle)}`;
}
