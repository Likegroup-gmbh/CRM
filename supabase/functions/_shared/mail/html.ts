/**
 * Mail-System: HTML-Helfer.
 * Alles, was Nutzerdaten in HTML bringt, läuft durch esc() bzw. rich().
 */

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Text mit optional fetten Teilen: 'Hallo' oder ['Hallo ', { fett: 'Welt' }, '.'] */
export type RichText = string | Array<string | { fett: string }>;

export function rich(value: RichText): string {
  if (typeof value === 'string') return esc(value).replace(/\n/g, '<br>');
  return value
    .map((part) => (typeof part === 'string'
      ? esc(part).replace(/\n/g, '<br>')
      : `<strong style="font-weight:600;">${esc(part.fett)}</strong>`))
    .join('');
}

/**
 * Nur http(s)- und mailto-Links kommen in href/src. Alles andere wird leer.
 * Ausnahme: ein reiner Supabase-Platzhalter wie {{ .ConfirmationURL }} (Auth-Templates).
 */
export function safeUrl(value: unknown): string {
  const url = String(value ?? '').trim();
  if (/^\{\{\s*\.[A-Za-z]+\s*\}\}$/.test(url)) return url;
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : '';
}

/** Vornamen- und Nachnamen-Initialen, maximal zwei Buchstaben. */
export function initialen(name: string): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}
