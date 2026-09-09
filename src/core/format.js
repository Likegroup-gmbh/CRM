// Zentrale Formatierungshelfer fuer HTML-Ausgaben.
// Einzelne Seiten duerfen duenn delegieren, damit Aufrufstellen unveraendert bleiben.

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatEuro(value) {
  if (value == null || Number.isNaN(Number(value))) return '–';
  // Bewusst kein Intl-currency-Format: das setzt geschuetzte Leerzeichen,
  // die sich in Tests und Textvergleichen schlecht greifen lassen.
  const num = Number(value) || 0;
  return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
