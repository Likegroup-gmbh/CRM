// KampagneDetailTabRenderers.js
// Verbleibende Render-Helfer für die Kampagnen-Detailseite

export function renderAnsprechpartner(ansprechpartner) {
  if (!ansprechpartner || ansprechpartner.length === 0) {
    return '<span class="text-muted">Keine Ansprechpartner zugeordnet</span>';
  }

  const tags = ansprechpartner
    .filter(ap => ap && ap.vorname && ap.nachname)
    .map(ap => {
      const details = [ap.position?.name, ap.unternehmen?.firmenname].filter(Boolean).join(' • ');
      return `<a href="#" class="tag tag--ansprechpartner" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${ap.id}')">
        ${ap.vorname} ${ap.nachname}
        ${details ? `<small style="opacity: 0.8; margin-left: 5px;">(${details})</small>` : ''}
      </a>`;
    })
    .join('');

  return `<div class="tags">${tags}</div>`;
}
