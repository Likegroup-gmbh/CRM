// Gruppenachse eines Castings: Briefing-Personas statt Freitext-Kategorien (ADR 0019).

import { PersonaService } from '../persona/PersonaService.js';

export const NICHT_UMSETZEN_KATEGORIE = 'Nicht umsetzen';
export const OHNE_PERSONA_KEY = '__ohne__';
export const NICHT_UMSETZEN_KEY = '__nicht_umsetzen__';

export function personaDisplayLabel(persona) {
  return PersonaService.label(persona);
}

export function isNichtUmsetzen(item) {
  return item?.kategorie === NICHT_UMSETZEN_KATEGORIE || item?.nicht_umsetzen === true;
}

export function personaGroupKey(item) {
  if (isNichtUmsetzen(item)) return NICHT_UMSETZEN_KEY;
  return item?.persona_id || OHNE_PERSONA_KEY;
}

export function pickFirstPersonaId(personaIds, allowedIds = []) {
  const ids = Array.isArray(personaIds) ? personaIds.filter(Boolean) : [];
  if (!ids.length) return null;
  const allowed = (allowedIds || []).filter(Boolean);
  if (!allowed.length) return ids[0];
  const allowedSet = new Set(allowed);
  return ids.find(id => allowedSet.has(id)) || null;
}

export function orderPersonasByIds(rows, ids) {
  const byId = new Map((rows || []).map(p => [p.id, p]));
  return (ids || []).map(id => byId.get(id)).filter(Boolean);
}

export function updatesForGroupKey(groupKey, personaId = null) {
  if (groupKey === NICHT_UMSETZEN_KEY || groupKey === NICHT_UMSETZEN_KATEGORIE) {
    return { kategorie: NICHT_UMSETZEN_KATEGORIE, nicht_umsetzen: true };
  }
  if (groupKey === OHNE_PERSONA_KEY || groupKey === 'Ohne Persona') {
    return { persona_id: null, kategorie: null, nicht_umsetzen: false };
  }
  return {
    persona_id: personaId || groupKey || null,
    kategorie: null,
    nicht_umsetzen: false
  };
}

function orphanLabel(items) {
  const first = (items || [])[0];
  const persona = first?.persona || (first?.persona_name ? { name: first.persona_name } : null);
  if (!persona?.name && !persona?.oberbegriff) return 'Unbekannte Persona';
  return personaDisplayLabel(persona);
}

export function groupItemsByPersona(items = []) {
  const groups = new Map();
  for (const item of items) {
    const key = personaGroupKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

/**
 * Reihenfolge: Briefing-Personas (auch leer) → Orphans → Ohne Persona (nur mit Items)
 * → Nicht umsetzen (nur mit Items).
 */
export function orderedPersonaGroups(items = [], personas = []) {
  const groups = groupItemsByPersona(items);
  const known = new Set((personas || []).map(p => p.id));
  const result = [];

  for (const persona of personas || []) {
    result.push({
      key: persona.id,
      personaId: persona.id,
      label: personaDisplayLabel(persona),
      persona,
      items: groups.get(persona.id) || [],
      variant: ''
    });
  }

  for (const key of groups.keys()) {
    if (key === OHNE_PERSONA_KEY || key === NICHT_UMSETZEN_KEY || known.has(key)) continue;
    const orphanItems = groups.get(key) || [];
    result.push({
      key,
      personaId: key,
      label: orphanLabel(orphanItems),
      persona: null,
      items: orphanItems,
      variant: ''
    });
  }

  const ohne = groups.get(OHNE_PERSONA_KEY) || [];
  if (ohne.length) {
    result.push({
      key: OHNE_PERSONA_KEY,
      personaId: null,
      label: 'Ohne Persona',
      persona: null,
      items: ohne,
      variant: 'default'
    });
  }

  const nichtUmsetzen = groups.get(NICHT_UMSETZEN_KEY) || [];
  if (nichtUmsetzen.length) {
    result.push({
      key: NICHT_UMSETZEN_KEY,
      personaId: null,
      label: NICHT_UMSETZEN_KATEGORIE,
      persona: null,
      items: nichtUmsetzen,
      variant: 'rejected'
    });
  }

  return result;
}

export function reorderSourcingItemsByPersonas(items = [], personas = []) {
  return orderedPersonaGroups(items, personas)
    .flatMap(group => group.items)
    .map((item, index) => ({ ...item, sortierung: index }));
}

export function applyGroupToItem(item, groupKey, personaId = null) {
  return { ...item, ...updatesForGroupKey(groupKey, personaId) };
}
