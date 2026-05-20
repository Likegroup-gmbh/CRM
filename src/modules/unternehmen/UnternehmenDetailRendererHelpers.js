// UnternehmenDetailRendererHelpers.js
// Kleine Render-Hilfsfunktionen für Bubble, Tags, Budget, Formatierung

import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export function formatZahlungsziel(tage) {
  if (tage === null || tage === undefined) return '-';
  if (tage === 0) return 'Sofort';
  return `${tage} Tage`;
}

export function formatBoolean(value) {
  return value
    ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: var(--icon-xs); height: var(--icon-xs);"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: var(--icon-xs); height: var(--icon-xs);"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`;
}

export function renderMarkeBubble(detail, marke) {
  if (!marke?.markenname) return '-';
  return avatarBubbles.renderBubbles([{
    name: marke.markenname, type: 'org', id: marke.id,
    entityType: 'marke', logo_url: marke.logo_url || null
  }], { showLabel: true });
}

export function renderPersonBubble(detail, person, entityType = 'mitarbeiter') {
  if (!person) return '-';
  const name = person.name || [person.vorname, person.nachname].filter(Boolean).join(' ');
  if (!name) return '-';
  return avatarBubbles.renderBubbles([{
    name, type: 'person', id: person.id,
    entityType, profile_image_url: person.profile_image_url || null
  }]);
}

export function renderArtTags(detail, artArray) {
  if (!artArray || artArray.length === 0) return '-';
  const arr = Array.isArray(artArray) ? artArray : [artArray];
  return `<div class="tags tags-compact">${arr.map(art => {
    const short = art.replace(/ Kampagne$/i, '');
    return `<span class="tag tag--type">${detail.sanitize(short)}</span>`;
  }).join('')}</div>`;
}

export function renderBudgetProgress(detail, kampagne) {
  const auftrag = kampagne.auftrag_id
    ? detail.auftraege.find(a => a.id === kampagne.auftrag_id)
    : null;
  const budgetTotal = auftrag?.bruttobetrag || 0;
  const budgetUsed = detail.kooperationen
    .filter(k => k.kampagne_id === kampagne.id)
    .reduce((sum, k) => sum + (k.einkaufspreis_gesamt || 0), 0);
  if (budgetTotal <= 0) return '<span class="text-muted">-</span>';
  const pct = KampagneUtils.getProgressPercentage(budgetUsed, budgetTotal);
  const remainPct = Math.max(0, 100 - pct);
  let colorClass = '';
  if (pct >= 90) colorClass = 'summary-progress-fill--danger';
  else if (pct >= 75) colorClass = 'summary-progress-fill--warning';
  return `<div class="budget-progress-cell"><div class="summary-progress"><div class="summary-progress-fill ${colorClass}" style="width: ${pct}%"></div></div><span class="budget-progress-label">${remainPct}%</span></div>`;
}
