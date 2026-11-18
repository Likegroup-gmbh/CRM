// Namenszelle der Tabellen: Bild links, Name rechts.
// Groesse, Rundung und Abstaende stehen in tabelle-identitaet.css (--size-table-avatar).

import { escapeHtml } from '../format.js';

/** http(s)-URL oder null. Ohne ValidatorSystem (Tests, Gastseiten) nur http(s) durchlassen. */
export function safeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const sanitize = window.validatorSystem?.sanitizeUrl;
  if (typeof sanitize === 'function') return sanitize(url) || null;
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}

function initialVon(name, initial) {
  if (initial) return String(initial).trim().toUpperCase() || '?';
  return String(name || '').replace(/^@/, '').trim().charAt(0).toUpperCase() || '?';
}

/**
 * Bild der Namenszelle: Foto (cover), Logo (contain) oder Initial als Platzhalter.
 * Mit iconHtml steht statt des Initials ein Icon in der Box (Ordner ohne Logo).
 * alt bleibt leer: der Name steht direkt daneben.
 */
export function renderTableAvatar({ url, name = '', initial = '', logo = false, iconHtml = '' } = {}) {
  const safe = safeImageUrl(url);
  if (safe) {
    const klassen = `table-avatar table-avatar-img${logo ? ' table-avatar--logo' : ''}`;
    return `<img src="${escapeHtml(safe)}" alt="" class="${klassen}" loading="lazy">`;
  }
  if (iconHtml) return `<span class="table-avatar table-avatar--icon" aria-hidden="true">${iconHtml}</span>`;
  return `<span class="table-avatar" aria-hidden="true">${escapeHtml(initialVon(name, initial))}</span>`;
}

/**
 * Bild und Name nebeneinander.
 * - avatarHtml oder die Bild-Optionen von renderTableAvatar; avatarHtml '' heisst ohne Bild
 * - nameHtml: fertiges Markup (Link, Text, Eingabefeld), sonst der escapte Name
 * - subHtml: zweite Zeile unter dem Namen (Socials, Herkunft)
 * - badgeHtml: liegt auf dem Bild (Status-Punkt, Detail-Button)
 * - prefixHtml: steht vor dem Bild (Auf-/Zuklappen)
 */
export function renderTableIdentity({
  avatarHtml,
  nameHtml,
  subHtml = '',
  badgeHtml = '',
  prefixHtml = '',
  ...bild
} = {}) {
  const avatar = avatarHtml ?? renderTableAvatar(bild);
  const name = nameHtml ?? escapeHtml(bild.name || '');
  const media = avatar ? `<span class="table-identity__media">${avatar}${badgeHtml}</span>` : '';
  return `<div class="table-identity">${prefixHtml}${media}<div class="table-identity__text">${name}${subHtml}</div></div>`;
}
