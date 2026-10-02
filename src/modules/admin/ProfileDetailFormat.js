// ProfileDetailFormat.js
// Reine Formatierungs-Helfer für die Profilseite (ohne DOM, ohne Supabase)

import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';

/**
 * Liefert YYYY-MM-DD für <input type="date"> oder '' bei ungültigen Werten.
 */
export function dateInputValue(value) {
  if (!value) return '';
  const iso = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
}

/**
 * Formatiert ein Datum ohne Zeitanteil als DD.MM.YYYY ('-' wenn leer).
 */
export function formatDateOnly(value) {
  const iso = dateInputValue(value);
  if (!iso) return '-';
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

/**
 * Klickbares Firmenhandy als HTML ('' wenn keine Nummer hinterlegt).
 */
export function getFirmenhandyDisplayHtml(user) {
  const land = user?.telefonnummer_firmenhandy_land;
  const nummer = user?.telefonnummer_firmenhandy;
  if (!nummer) return '';
  const cleanNumber = String(nummer).replace(/[^\d+\s()/.-]/g, '');
  return PhoneDisplay.renderClickable(land?.iso_code, land?.vorwahl, cleanNumber);
}
