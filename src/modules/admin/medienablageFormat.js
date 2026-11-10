// medienablageFormat.js
// Helfer der Medienablage-Seite: Aufruf der Function ablage-stand, Formatierung
// (relative Zeit, Zahlen, Groessen, Ablauf-Ton) und Bestaetigungsdialog.

import { authorizedFetch } from '../../core/auth/getAccessToken.js';
import { escapeHtml } from '../../core/format.js';

const ENDPOINT = '/.netlify/functions/ablage-stand';

export const GB = 1024 ** 3;

export const ZIEL_LABEL = { dropbox: 'Dropbox', sharepoint: 'SharePoint' };

const RELATIV_STUFEN = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
];

export async function postStand(body) {
  const res = await authorizedFetch(ENDPOINT, { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Fehler (${res.status})`);
  return data;
}

/** "vor 5 Minuten" bzw. "in 3 Tagen"; leer ohne gueltiges Datum. */
export function relativ(iso, now = Date.now()) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const sekunden = Math.round((t - now) / 1000);
  if (Math.abs(sekunden) < 60) return 'gerade eben';
  const fmt = new Intl.RelativeTimeFormat('de-DE', { numeric: 'auto' });
  for (const [einheit, laenge] of RELATIV_STUFEN) {
    if (Math.abs(sekunden) >= laenge) return fmt.format(Math.trunc(sekunden / laenge), einheit);
  }
  return 'gerade eben';
}

export const gross = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

export function datumZeit(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

export const zahl = (n, stellen = 0) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: stellen }).format(Number(n) || 0);

export function groesse(bytes) {
  const b = Number(bytes) || 0;
  if (!b) return '–';
  if (b < 1024 ** 2) return `${zahl(Math.max(1, b / 1024))} KB`;
  if (b < GB) return `${zahl(b / 1024 ** 2)} MB`;
  return `${zahl(b / GB, 1)} GB`;
}

/** Fehlend oder abgelaufen ist rot, knapp vor Ablauf gelb. */
export function ablaufTon(iso, warnMs, now = Date.now()) {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t) || t <= now) return 'fehler';
  return t - now < warnMs ? 'warn' : 'ok';
}

export function ablaufWert(iso, now = Date.now()) {
  if (!iso) return 'Unbekannt';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'Unbekannt';
  return t <= now ? `Abgelaufen (${relativ(iso, now)})` : `Läuft ${relativ(iso, now)} ab`;
}

export function setBusy(el, busy) {
  if (!el) return;
  el.disabled = busy;
  if (busy) el.setAttribute('aria-busy', 'true');
  else el.removeAttribute('aria-busy');
}

// Zentrales Modal, wenn geladen; sonst window.confirm. Die Message landet
// im Modal als HTML und wird deshalb hier escaped.
export async function bestaetigen({ title, message, confirmText, danger = false }) {
  if (window.confirmationModal?.open) {
    const result = await window.confirmationModal.open({
      title, message: escapeHtml(message), confirmText, cancelText: 'Abbrechen', danger,
    });
    return !!result?.confirmed;
  }
  return window.confirm(message);
}
