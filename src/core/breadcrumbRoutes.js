// breadcrumbRoutes.js
// Route-Segment -> Label + Entity-Key. Das Icon wird ueber entityIcons.js aufgeloest.

const ROUTE_CONFIG = {
  dashboard:          { label: 'Dashboard',         entity: 'dashboard' },
  tasks:              { label: 'Aufgaben',          entity: 'tasks' },
  unternehmen:        { label: 'Unternehmen',       entity: 'unternehmen' },
  marke:              { label: 'Marken',             entity: 'marke' },
  ansprechpartner:    { label: 'Ansprechpartner',   entity: 'ansprechpartner' },
  'management-ansprechpartner': { label: 'Management-Ansprechpartner', entity: 'ansprechpartner' },
  'management-creator': { label: 'Management-Creator', entity: 'creator' },
  management:         { label: 'Management',        entity: 'management' },
  produkt:            { label: 'Produkte',           entity: 'produkt' },
  creator:            { label: 'Creator',            entity: 'creator' },
  auftrag:            { label: 'Aufträge',          entity: 'auftrag' },
  'projekt-erstellen': { label: 'Projekt anlegen',   entity: 'projekt-erstellen' },
  auftragsdetails:    { label: 'Auftragsdetails',   entity: 'auftragsdetails' },
  kampagne:           { label: 'Kampagne',          entity: 'kampagne' },
  strategie:          { label: 'Strategien',        entity: 'strategie' },
  sourcing:           { label: 'Sourcing',          entity: 'sourcing' },
  vertraege:          { label: 'Verträge',          entity: 'vertraege' },
  videos:             { label: 'Videos',             entity: 'videos' },
  rechnung:           { label: 'Rechnung',          entity: 'rechnung' },
  kooperation:        { label: 'Kooperation',       entity: 'kooperation' },
  briefing:           { label: 'Briefing',          entity: 'briefing' },
  mitarbeiter:        { label: 'Mitarbeiter',       entity: 'mitarbeiter' },
  'kunden-admin':     { label: 'Kunden',            entity: 'kunden-admin' },
  'admin/kunden':     { label: 'Kunden',            entity: 'kunden-admin' },
  kunde:              { label: 'Kunden',            entity: 'kunden-admin' },
  kunden:             { label: 'Übersicht',         entity: 'kunden' },
  tabellen:           { label: 'Tabellen',          entity: 'tabellen' },
  feedback:           { label: 'Feedback',          entity: 'feedback' },
  education:          { label: 'Education',          entity: 'education' },
  'creator-lists':    { label: 'Listen',            entity: 'creator-lists' },
  contracts:          { label: 'Contracts',          entity: 'vertraege' },
  ausgangsrechnungen: { label: 'Kundenrechnungen', entity: 'ausgangsrechnungen' },
  profile:            { label: 'Profil',            entity: 'profile' },
  transcribe:         { label: 'Transkription (Test)', entity: 'transcribe' },
  stakeholder:        { label: 'Stakeholder-Übersicht', entity: 'stakeholder' },
  skripte:            {
    label: 'Skripte',
    entity: 'skripte',
    children: {
      dna:    { label: 'DNA' },
      master: { label: 'Master-Regelwerk' }
    }
  },
  'ki-usage':         { label: 'KI-Nutzung',         entity: 'ki-usage' },
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
  if (!segment) return { label: '', entity: null };

  const base = ROUTE_CONFIG[segment];

  if (rolle) {
    const override = ROLE_OVERRIDES[rolle]?.[segment];
    if (override) {
      return {
        label: override.label ?? base?.label ?? capitalize(segment),
        entity: override.entity ?? base?.entity ?? null,
      };
    }
  }

  if (base) return { ...base };

  return { label: capitalize(segment), entity: null };
}

export function getRouteLabel(segment, rolle) {
  return getRouteConfig(segment, rolle).label;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
