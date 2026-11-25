// creatorInstagramPrefill.js
// Felder fuer das Creator-Formular aus der Instagram-Vorschau.
// Die Vorschau laeuft vor dem Speichern, derselbe Abruf wie im Casting-Drawer.
// Der Connect nach dem Anlegen schreibt Bio, Posts und die genaue Followerzahl.

import { instagramProfilHandle } from '../creator-auswahl/instagramDrawerFill.js';

const FOLLOWER_STUFEN = [
  [2500, '0-2500'],
  [5000, '2500-5000'],
  [10000, '5000-10000'],
  [25000, '10000-25000'],
  [50000, '25000-50000'],
  [100000, '50000-100000'],
  [250000, '100000-250000'],
  [500000, '250000-500000'],
  [1000000, '500000-1000000']
];

const STUFEN = new Set(FOLLOWER_STUFEN.map(([, value]) => value).concat('1000000+'));

function leereFelder(instagram) {
  return {
    geladen: false,
    instagram,
    vorname: '',
    nachname: '',
    mail: '',
    telefonnummer: '',
    lieferadresse_stadt: '',
    instagram_follower: ''
  };
}

function namesteil(part) {
  return part.length >= 2 && /^[\p{L}][\p{L}\p{M}'’.-]*[\p{L}\p{M}]$/u.test(part);
}

export function nameZuVorNachname(name) {
  const clean = String(name || '')
    .replace(/[^\p{L}\p{M}\s'’.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length !== 2 || !namesteil(parts[0]) || !namesteil(parts[1])) {
    return { vorname: '', nachname: '' };
  }
  return { vorname: parts[0], nachname: parts[1] };
}

function gueltigeMail(value) {
  const mail = String(value || '').trim();
  if (!mail || mail.length > 320) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return '';
  return mail;
}

function telefonOderLeer(value) {
  const telefon = String(value || '').trim();
  const ziffern = telefon.replace(/\D/g, '');
  if (ziffern.length < 6 || ziffern.length > 15) return '';
  return telefon;
}

function ortOderLeer(value) {
  const ort = String(value || '').trim();
  if (ort.length < 2 || ort.length > 80) return '';
  if (!/\p{L}/u.test(ort)) return '';
  if (/https?:|www\./i.test(ort)) return '';
  return ort;
}

/**
 * Unveraenderte Stufe speichert die genaue Followerzahl.
 * Eine andere Stufe bleibt der Formularwert, den das Speichern wie bisher umrechnet.
 */
export function followerZumSpeichern(formValue, original) {
  if (formValue == null || formValue === '' || original == null || original === '') return formValue;
  const zahl = Number(original);
  if (!Number.isFinite(zahl)) return formValue;
  if (followerStufe(zahl) !== String(formValue)) return formValue;
  return zahl;
}

export function followerStufe(value) {
  if (value == null || value === '') return '';
  const text = String(value).trim();
  if (STUFEN.has(text)) return text;
  const num = Number(text);
  if (!Number.isFinite(num) || num < 0) return '';
  for (const [max, stufe] of FOLLOWER_STUFEN) {
    if (num < max) return stufe;
  }
  return '1000000+';
}

/**
 * Formularwerte aus der Vorschau. Passt der Benutzername nicht zum Link,
 * bleibt nur der eingegebene Link.
 */
export function formularAusInstagramVorschau(raw, result) {
  const link = String(raw || '').trim();
  const handle = instagramProfilHandle(raw);
  const username = String(result?.username || '').trim().toLowerCase();
  if (!handle || username !== handle) return leereFelder(link);

  const fields = result?.fields || {};
  const name = nameZuVorNachname(fields.name);
  return {
    geladen: true,
    instagram: handle,
    vorname: name.vorname,
    nachname: name.nachname,
    mail: gueltigeMail(fields.email),
    telefonnummer: telefonOderLeer(fields.telefon),
    lieferadresse_stadt: ortOderLeer(fields.wohnort),
    instagram_follower: followerStufe(fields.follower_instagram)
  };
}
