// SkripteUtils.js - kleine Helfer fuer das Skripte-Modul

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function badge(text, variant = 'neutral') {
  return `<span class="skripte-badge skripte-badge--${variant}">${escapeHtml(text)}</span>`;
}

export const PERFORMANCE_BADGE_VARIANT = {
  unbewertet: 'neutral',
  erfolgreich: 'success',
  nicht_erfolgreich: 'danger',
  viral: 'viral'
};

export const STATUS_LABELS = {
  entwurf: 'Entwurf',
  feedback_gegeben: 'Feedback gegeben',
  final: 'Final',
  archiviert: 'Archiviert'
};
