// creatorTiktokPrefill.js
// Felder fuer das Creator-Formular aus der TikTok-Vorschau (tiktokProfilAbrufen mit link, ADR 0083).
// Dieselben Pruefregeln wie bei Instagram. Ob TikTok Name, Kontakt und Ort fuellen darf,
// entscheidet creatorProfilLaden.js: Instagram hat dort Vorrang.

import { parseSocialLink } from '../../core/format/socialLink.js';
import {
  bildOderLeer,
  followerStufe,
  gueltigeMail,
  nameZuVorNachname,
  ortOderLeer,
  telefonOderLeer
} from './creatorInstagramPrefill.js';

// Zeichenvorrat wie profilName in netlify/functions/_shared/tiktok/eingabe.js
const USERNAME = /^[a-z0-9._]{2,24}$/;
const AUTOR_IM_PFAD = /tiktok\.com\/@([A-Za-z0-9._]+)(?:[/?#]|$)/i;
const NUR_HANDLE = /^@?([A-Za-z0-9._]+)$/;

function gueltig(handle) {
  const name = String(handle || '').toLowerCase();
  return USERNAME.test(name) ? name : null;
}

/**
 * Handle aus Profil-Link, Video- oder Share-Link oder @handle, sonst null.
 * Kurzlinks (vm.tiktok.com) tragen keinen Handle und bleiben null.
 */
export function tiktokProfilHandle(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const parsed = parseSocialLink(text);
  if (parsed.platform === 'tiktok') {
    return gueltig(parsed.type === 'profile' ? parsed.handle : text.match(AUTOR_IM_PFAD)?.[1]);
  }
  if (parsed.platform) return null;
  return gueltig(text.match(NUR_HANDLE)?.[1]);
}

function leereFelder(tiktok) {
  return {
    geladen: false,
    tiktok,
    vorname: '',
    nachname: '',
    mail: '',
    telefonnummer: '',
    lieferadresse_stadt: '',
    tiktok_follower: '',
    profilbild_url: '',
    profilbild_thumb_url: ''
  };
}

/**
 * Formularwerte aus der Vorschau. Passt der Benutzername nicht zum Link,
 * bleibt nur der Handle.
 */
export function formularAusTiktokVorschau(raw, result) {
  const handle = tiktokProfilHandle(raw);
  const username = String(result?.username || '').trim().toLowerCase();
  if (!handle || username !== handle) return leereFelder(handle || String(raw || '').trim());

  const fields = result?.fields || {};
  const name = nameZuVorNachname(fields.name);
  return {
    geladen: true,
    tiktok: handle,
    vorname: name.vorname,
    nachname: name.nachname,
    mail: gueltigeMail(fields.email),
    telefonnummer: telefonOderLeer(fields.telefon),
    lieferadresse_stadt: ortOderLeer(fields.wohnort),
    tiktok_follower: followerStufe(fields.follower_tiktok),
    profilbild_url: bildOderLeer(fields.profile_image_url),
    profilbild_thumb_url: bildOderLeer(fields.profile_image_thumb_url)
  };
}
