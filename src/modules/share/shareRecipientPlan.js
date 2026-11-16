// Anzeige der Empfänger-Aufteilung eines Zugangs (Listen-Link, Gast-Zugang, Sperre).
// Die Aufteilung selbst macht der Server (share-list Action plan, _shared/share-recipients-plan.ts).

import { escapeHtml } from '../../core/format.js';

export const LIST_LINK_TEXT = 'Listen-Link per Mail';
export const GUEST_TEXT = 'Gast-Zugang mit Link und Code';

export const BLOCKED_TEXT = {
  paket: 'Eine bereits registrierte Ansprechperson kann diese Auswahl nicht per Mail bekommen. Die Auswahl gibt es nur als Gast-Zugang.',
  scope: 'Keine Mail. Zuerst Unternehmen oder Marke zuordnen.',
};

const ACCOUNT_ROUTES = {
  kampagne: (id) => `/kampagne/${id}`,
  sourcing: (id) => `/castings/${id}`,
  strategie: (id) => `/konzepte/${id}`,
  skript: (id) => `/skripte/${id}`,
};

export function accountListPath(entityType, entityId) {
  const build = ACCOUNT_ROUTES[entityType];
  if (!build || !entityId) return null;
  return build(entityId);
}

export function accountListUrl(entityType, entityId, origin = '') {
  const path = accountListPath(entityType, entityId);
  if (!path) return null;
  return `${origin}${path}`;
}

export function recipientPlanRows(plan) {
  if (!plan) return [];
  return [
    ...plan.listLink.map((email) => ({ email, text: LIST_LINK_TEXT })),
    ...plan.guest.map((email) => ({ email, text: GUEST_TEXT })),
    ...plan.blocked.map((row) => ({ email: row.email, text: BLOCKED_TEXT[row.reason] || BLOCKED_TEXT.scope })),
  ];
}

export function renderRecipientPlan(el, plan) {
  if (!el) return;
  el.innerHTML = recipientPlanRows(plan).map((row) => `
    <p class="share-plan-row"><span class="share-plan-email">${escapeHtml(row.email)}</span> ${escapeHtml(row.text)}</p>
  `).join('');
}
