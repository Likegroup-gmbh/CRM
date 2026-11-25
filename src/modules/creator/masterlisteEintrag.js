// Eintrag ohne Creator-Datensatz: Formular "Neuer Creator" -> Zeilenwerte
// und Zeile -> Formular "Creator anlegen".

import { parseSocialLink } from '../../core/format/socialLink.js';
import { normalizeHandle } from './creatorProfil.js';
import { followerStufe, nameZuVorNachname } from './creatorInstagramPrefill.js';

function text(value) {
  return String(value ?? '').trim();
}

function teileName(name) {
  const strikt = nameZuVorNachname(name);
  if (strikt.vorname) return strikt;
  const [vorname = '', ...rest] = text(name).split(/\s+/).filter(Boolean);
  return { vorname, nachname: rest.join(' ') };
}

/** Formularwerte fuer "Creator anlegen" aus einem Eintrag ohne Creator (Handarbeit vor Pool). */
export function prefillOhneDatensatz(member) {
  const eigen = member?.eigen || {};
  const pool = member?.pool || {};
  const name = teileName(eigen.name || pool.name);
  return {
    vorname: name.vorname,
    nachname: name.nachname,
    mail: eigen.email || pool.email || '',
    telefonnummer: eigen.telefon || pool.telefon || '',
    instagram: member?.igUsername || '',
    instagram_follower: followerStufe(pool.follower_instagram ?? eigen.follower_instagram),
    tiktok: normalizeHandle(eigen.link_tiktok),
    tiktok_follower: followerStufe(eigen.follower_tiktok),
    lieferadresse_stadt: eigen.wohnort || pool.wohnort || '',
    profilbild_url: pool.profile_image_url || ''
  };
}

function ganzzahl(value) {
  const raw = text(value).replace(/[.\s]/g, '');
  if (!raw) return null;
  const zahl = Number(raw);
  return Number.isFinite(zahl) && zahl >= 0 ? Math.round(zahl) : null;
}

function tiktokLink(raw) {
  const value = text(raw);
  if (!value) return null;
  const parsed = parseSocialLink(value);
  if (parsed.platform === 'tiktok' && parsed.type === 'profile' && parsed.handle) {
    return `https://www.tiktok.com/@${parsed.handle.toLowerCase()}`;
  }
  if (/^@?[A-Za-z0-9._]{1,30}$/.test(value)) return `https://www.tiktok.com/@${value.replace(/^@/, '').toLowerCase()}`;
  return value;
}

/**
 * Formular "Neuer Creator" -> Zeilenwerte oder Fehler.
 * Creator Art und Name sind Pflicht wie im Casting; der Instagram-Link ist optional,
 * muss aber ein Profil sein.
 */
export function eintragAusFormular(values, { erlaubteTypen = [] } = {}) {
  const typ = text(values?.typ);
  const name = text(values?.name);
  if (!typ || !name) return { fehler: 'Bitte Creator Art und Name ausfüllen' };
  if (erlaubteTypen.length && !erlaubteTypen.includes(typ)) return { fehler: 'Ungültige Creator Art' };

  const linkInstagram = text(values?.link_instagram);
  let handle = null;
  if (linkInstagram) {
    const parsed = parseSocialLink(linkInstagram);
    if (parsed.platform !== 'instagram' || parsed.type !== 'profile' || !parsed.handle) {
      return { fehler: 'Bitte einen Instagram-Profil-Link einfügen (kein Reel oder Post)' };
    }
    handle = parsed.handle.toLowerCase();
  }

  return {
    handle,
    werte: {
      name,
      typ,
      follower_instagram: ganzzahl(values?.follower_instagram),
      link_tiktok: tiktokLink(values?.link_tiktok),
      follower_tiktok: ganzzahl(values?.follower_tiktok),
      wohnort: text(values?.wohnort) || null,
      email: text(values?.email) || null,
      telefon: text(values?.telefon) || null
    }
  };
}
