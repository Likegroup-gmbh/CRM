const ROUTE_CONFIG = {
  dashboard:          { label: 'Dashboard',         icon: 'icon-dashboard' },
  tasks:              { label: 'Aufgaben',          icon: 'icon-tasks' },
  unternehmen:        { label: 'Unternehmen',       icon: 'icon-building' },
  marke:              { label: 'Marken',             icon: 'icon-tag' },
  ansprechpartner:    { label: 'Ansprechpartner',   icon: 'icon-user-circle' },
  'management-ansprechpartner': { label: 'Management-Ansprechpartner', icon: 'icon-user-circle' },
  'management-creator': { label: 'Management-Creator', icon: 'icon-users' },
  management:         { label: 'Management',        icon: 'icon-building' },
  produkt:            { label: 'Produkte',           icon: 'icon-cube' },
  creator:            { label: 'Creator',            icon: 'icon-users' },
  auftrag:            { label: 'Aufträge',          icon: 'icon-briefcase' },
  'projekt-erstellen': { label: 'Projekt anlegen',   icon: 'icon-briefcase' },
  auftragsdetails:    { label: 'Auftragsdetails',   icon: 'icon-auftragsdetails' },
  kampagne:           { label: 'Kampagne',          icon: 'icon-campaign' },
  strategie:          { label: 'Strategien',        icon: 'icon-lightbulb' },
  sourcing:           { label: 'Sourcing',          icon: 'icon-users' },
  vertraege:          { label: 'Verträge',          icon: 'icon-contract' },
  videos:             { label: 'Videos',             icon: 'icon-video' },
  rechnung:           { label: 'Rechnung',          icon: 'icon-currency-euro' },
  kooperation:        { label: 'Kooperation',       icon: 'icon-campaign' },
  briefing:           { label: 'Briefing',          icon: 'icon-campaign' },
  mitarbeiter:        { label: 'Mitarbeiter',       icon: 'icon-users' },
  'kunden-admin':     { label: 'Kunden',            icon: 'icon-user-circle' },
  'admin/kunden':     { label: 'Kunden',            icon: 'icon-user-circle' },
  kunden:             { label: 'Übersicht',         icon: 'icon-dashboard' },
  tabellen:           { label: 'Tabellen',          icon: 'icon-dashboard' },
  feedback:           { label: 'Feedback',          icon: 'icon-feedback' },
  education:          { label: 'Education',          icon: 'icon-dashboard' },
  'creator-lists':    { label: 'Listen',            icon: 'icon-list' },
  kickoff:            { label: 'Strategiebriefing',  icon: 'icon-tag' },
  contracts:          { label: 'Contracts',          icon: 'icon-contract' },
  ausgangsrechnungen: { label: 'Kundenrechnungen', icon: 'icon-currency-euro' },
  profile:            { label: 'Profil',            icon: 'icon-user-circle' },
  transcribe:         { label: 'Transkription (Test)', icon: 'icon-video' },
  stakeholder:        { label: 'Stakeholder-Übersicht', icon: 'icon-dashboard' },
};

const ROLE_OVERRIDES = {
  kunde: {
    kampagne: { label: 'Meine Kampagnen' },
    kunden:   { label: 'Übersicht' },
  },
  kunde_editor: {
    kampagne: { label: 'Meine Kampagnen' },
    kunden:   { label: 'Übersicht' },
  },
};

export function getRouteConfig(segment, rolle) {
  if (!segment) return { label: '', icon: null };

  const base = ROUTE_CONFIG[segment];

  if (rolle) {
    const override = ROLE_OVERRIDES[rolle]?.[segment];
    if (override) {
      return {
        label: override.label ?? base?.label ?? capitalize(segment),
        icon: override.icon ?? base?.icon ?? null,
      };
    }
  }

  if (base) return { ...base };

  return { label: capitalize(segment), icon: null };
}

export function getRouteLabel(segment, rolle) {
  return getRouteConfig(segment, rolle).label;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
