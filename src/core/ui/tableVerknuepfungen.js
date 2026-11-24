// Klickbare Verknüpfungen für die Standard-Tabellen.
// Darstellung (Pill mit Entity-Icon) liegt in verknuepfungPill.js,
// der Chip mit Popover ab zwei Einträgen in verknuepfungDropdown.js.

import { renderVerknuepfungPill, renderVerknuepfungStack } from './verknuepfungPill.js';
import { renderVerknuepfungDropdown } from './verknuepfungDropdown.js';

const DROPDOWN_AB = 2;

const ROUTE_PREFIX = {
  briefing: '/briefing',
  persona: '/persona',
  produkt: '/produkt',
  casting: '/castings',
  konzept: '/konzepte',
  skript: '/skripte'
};

let clicksBound = false;

export function asList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function hrefFor(item) {
  if (item.route) return item.route;
  const prefix = ROUTE_PREFIX[item.kind];
  if (!prefix || item.id == null || item.id === '') return '';
  return `${prefix}/${encodeURIComponent(item.id)}`;
}

export function ensureVerknuepfungClicks() {
  if (clicksBound || typeof document === 'undefined') return;
  clicksBound = true;
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a.table-link--rel');
    if (!link) return;
    // Neuer Tab oder Fenster: der Browser öffnet den href selbst
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    const href = link.getAttribute('href');
    if (href) window.navigateTo?.(href);
  });
}

/**
 * Eine Verknuepfung als Pill, ab DROPDOWN_AB als Chip mit Popover.
 * @param {object} [opts]
 * @param {string} [opts.label] Eigenes Nomen fuer den Chip statt des Plurals aus kind
 */
export function renderVerknuepfungen(items, { label } = {}) {
  ensureVerknuepfungClicks();
  const gueltig = (items || [])
    .filter((item) => item?.id && item.label)
    .map((item) => ({ item, href: hrefFor(item) }))
    .filter(({ href }) => href);
  const pills = gueltig.map(({ item, href }) => renderVerknuepfungPill({
    kind: item.kind,
    label: item.label,
    href,
    className: 'table-link--rel'
  }));
  if (pills.length < DROPDOWN_AB) return renderVerknuepfungStack(pills);
  return renderVerknuepfungDropdown(pills, { kinds: gueltig.map(({ item }) => item.kind), label });
}

export function namedLinks(rows, { labelKey, kind }) {
  return asList(rows)
    .filter((row) => row?.id && row[labelKey])
    .map((row) => ({ id: row.id, label: row[labelKey], kind }));
}

export function vertragLinks(rows) {
  return asList(rows)
    .filter((row) => row?.id && row.name)
    .map((row) => ({
      id: row.id,
      label: row.name,
      kind: 'vertrag',
      route: `/vertraege/${encodeURIComponent(row.id)}/edit`
    }));
}

export function skriptLinks(rows) {
  return asList(rows)
    .filter((row) => row?.id)
    .map((row) => ({
      id: row.id,
      label: row.titel || row.hook || 'Ohne Titel',
      kind: 'skript'
    }));
}

export function acceptedProduktLinks(rows) {
  return asList(rows)
    .filter((row) => row?.status === 'accepted' && row.produkt?.id && row.produkt?.name)
    .map((row) => ({ id: row.produkt.id, label: row.produkt.name, kind: 'produkt' }));
}

export function acceptedPersonaLinks(rows) {
  return asList(rows)
    .filter((row) => row?.status === 'accepted' && row.persona?.id && row.persona?.name)
    .map((row) => ({ id: row.persona.id, label: row.persona.name, kind: 'persona' }));
}

export function produktLinksFromJunction(rows) {
  return asList(rows)
    .map((row) => row?.produkt)
    .filter((produkt) => produkt?.id && produkt?.name)
    .map((produkt) => ({ id: produkt.id, label: produkt.name, kind: 'produkt' }));
}

export function briefingLinksFromJunction(rows) {
  return namedLinks(asList(rows).map((row) => row?.briefing), {
    labelKey: 'aktivierung_name',
    kind: 'briefing'
  });
}

export function skripteAusStrategie(strategie) {
  const seen = new Set();
  const out = [];
  for (const node of asList(strategie)) {
    for (const item of asList(node?.strategie_items)) {
      for (const skript of asList(item?.skripte)) {
        if (!skript?.id || seen.has(skript.id)) continue;
        seen.add(skript.id);
        out.push(skript);
      }
    }
  }
  return out;
}

export function attachPersonasToBriefings(briefings, personas) {
  const byId = new Map((personas || []).map((persona) => [persona.id, persona]));
  return (briefings || []).map((briefing) => ({
    ...briefing,
    verknuepfte_personas: (briefing.persona_ids || []).map((id) => byId.get(id)).filter(Boolean)
  }));
}

export function attachBriefingsToPersonas(personas, briefings) {
  const byPersona = new Map();
  for (const briefing of briefings || []) {
    for (const personaId of briefing.persona_ids || []) {
      if (!byPersona.has(personaId)) byPersona.set(personaId, []);
      byPersona.get(personaId).push(briefing);
    }
  }
  return (personas || []).map((persona) => ({
    ...persona,
    verknuepfte_briefings: byPersona.get(persona.id) || []
  }));
}
