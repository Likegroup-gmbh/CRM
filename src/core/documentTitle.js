// documentTitle.js
// Browsertab aus Breadcrumb + Route + ?tab=.
// Liste: die Crumb-Labels. Detail: Seitentyp · Name · Tab.

import { getRouteConfig } from './breadcrumbRoutes.js';
import { parseRoute } from './breadcrumbTrail.js';

const PLACEHOLDER = '...';
const GENERIC_LEAVES = new Set(['...', 'Bearbeiten', 'Neu', 'Neu anlegen']);

// Workflow-Tabs der Produktion und Secondary-Nav der Detailseiten.
// Filter (Offen, Monate, …) stehen hier nicht — unbekannte ?tab=-Werte bleiben draußen.
const TAB_LABELS = {
  briefing: 'Briefing',
  produkte: 'Produkte',
  personas: 'Personas',
  casting: 'Casting',
  castings: 'Castings',
  konzepte: 'Konzepte',
  skripte: 'Skripte',
  vertraege: 'Verträge',
  produktion: 'Produktion',
  kooperation: 'Produktion',
  videos: 'Videos',
  auswertung: 'Auswertung',
  informationen: 'Informationen',
  info: 'Informationen',
  overview: 'Übersicht',
  uebersicht: 'Übersicht',
  stammdaten: 'Stammdaten',
  adresse: 'Adresse',
  finanzen: 'Finanzen',
  versand: 'Versand',
  tasks: 'Aufgaben',
  aufgaben: 'Aufgaben',
  ansprechpartner: 'Ansprechpartner',
  auftraege: 'Aufträge',
  auftragsdetails: 'Auftragsdetails',
  kampagnen: 'Kampagnen',
  briefings: 'Briefings',
  strategien: 'Konzepte',
  sourcing: 'Castings',
  kooperationen: 'Kooperationen',
  rechnungen: 'Rechnungen',
  kundenrechnungen: 'Kundenrechnungen',
  marken: 'Marken',
  creators: 'Creator',
  creator: 'Creator',
  unternehmen: 'Unternehmen',
  instagram: 'Instagram',
  listen: 'Listen',
  management: 'Management',
  firmen: 'Firmen',
  cashflow: 'Budget',
  rechte: 'Rechte'
};

export function tabLabelFor(tab) {
  if (!tab) return null;
  return TAB_LABELS[String(tab).toLowerCase()] || null;
}

function crumbLabels(crumbs) {
  return (crumbs || []).map((crumb) => crumb?.label).filter(Boolean);
}

export function buildDocumentTitle({ crumbs = [], segment = '', tab = null, hasId = false, rolle = null } = {}) {
  const labels = crumbLabels(crumbs);
  const typeLabel = segment ? (getRouteConfig(segment, rolle).label || '') : '';

  if (!hasId) {
    const list = labels.filter((label) => label !== PLACEHOLDER);
    if (list.length) return list.join(' · ');
    return typeLabel || 'CRM';
  }

  const name = [...labels].reverse().find((label) => !GENERIC_LEAVES.has(label)) || '';
  const parts = [];
  if (typeLabel) parts.push(typeLabel);
  if (name && name !== typeLabel) parts.push(name);

  const tabLabel = tabLabelFor(tab);
  if (tabLabel && tabLabel !== typeLabel && tabLabel !== name) parts.push(tabLabel);

  return parts.join(' · ') || 'CRM';
}

function tabFromLocation() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location?.search || '').get('tab');
}

export function refreshDocumentTitle(tabOverride, crumbsOverride) {
  if (typeof document === 'undefined') return;
  const crumbs = crumbsOverride || window.breadcrumbSystem?.currentBreadcrumbs || [];
  const { segment, id } = parseRoute(window.location?.pathname || '');
  const tab = tabOverride !== undefined ? tabOverride : tabFromLocation();
  const rolle = window.currentUser?.rolle?.toLowerCase?.() || null;
  document.title = buildDocumentTitle({
    crumbs,
    segment,
    tab,
    hasId: Boolean(id),
    rolle
  });
}
