// strategiePersonaOptions.js
// Persona an der Videoidee (strategie_items.persona_id): Source of Truth fuer
// das Skript. Das Briefing nennt die Personas der Linie (persona_ids), die
// Videoidee hat genau eine oder keine. Sie schlaegt die Persona des
// Casting-Eintrags; leer faellt beim Anlegen des Skripts auf das Casting zurueck.
//
// Nur fuers Team: Kunden duerfen personas nicht lesen (RLS), die Spalte
// bleibt ihnen verborgen.

/** Wert der Option, die die Persona wieder leert. Gespeichert wird dann null. */
export const STRATEGIE_PERSONA_OFFEN = 'offen';

/** Anzeige-Label einer Persona: "Oberbegriff (Name)", Fallback nur Name. */
export function personaLabel(persona) {
  const name = String(persona?.name || '').trim();
  const oberbegriff = String(persona?.oberbegriff || '').trim();
  if (oberbegriff && name && oberbegriff !== name) return `${oberbegriff} (${name})`;
  return name || oberbegriff || 'Unbenannt';
}

/** Persona-IDs, die das Briefing nennt (ohne Leere und Doppelte). */
export function briefingPersonaIds(briefing) {
  const raw = Array.isArray(briefing?.persona_ids) ? briefing.persona_ids : [];
  return [...new Set(raw.filter(Boolean))];
}

/** Die Persona fuer eine Vorbelegung: nur wenn das Briefing genau eine nennt. */
export function briefingEinzigePersonaId(briefing) {
  const ids = briefingPersonaIds(briefing);
  return ids.length === 1 ? ids[0] : null;
}

/**
 * Optionen fuer das Select: "Keine Persona", dann die Briefing-Personas.
 * Eine am Item gesetzte Persona, die nicht (mehr) im Briefing steht, bleibt als
 * Option sichtbar, damit der Wert nicht still verschwindet.
 * @param {Map<string, object>|null} personaById
 */
export function strategiePersonaOptions(briefing, personaById, item = null) {
  const byId = personaById instanceof Map ? personaById : new Map();
  const ids = briefingPersonaIds(briefing);
  if (item?.persona_id && !ids.includes(item.persona_id)) ids.push(item.persona_id);

  const options = ids
    .map(id => ({ value: id, label: byId.has(id) ? personaLabel(byId.get(id)) : null }))
    .filter(option => option.label)
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));

  return [{ value: STRATEGIE_PERSONA_OFFEN, label: 'Keine Persona', color: 'var(--gray-300)' }, ...options];
}

/** Auswahl im Select (inkl. "Keine Persona"). */
export function isStrategiePersona(value, options = []) {
  return (options || []).some(option => option.value === value);
}

/** Aktueller Wert fuers Select. Leer bleibt '', dann zeigt es den Platzhalter. */
export function getStrategiePersona(item) {
  return item?.persona_id || '';
}

/** Update-Objekt fuer einen gewaehlten Wert. "Keine Persona" leert das Feld. */
export function buildStrategiePersonaUpdates(value) {
  return { persona_id: value && value !== STRATEGIE_PERSONA_OFFEN ? value : null };
}

/** Name fuer die lesende Ansicht. Leer ist ein Gedankenstrich. */
export function renderPersonaName(persona) {
  return persona ? escapeHtml(personaLabel(persona)) : '–';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Laedt die Personas des Briefings und der gesetzten Videoideen als Map.
 * Fehler und fehlende Rechte ergeben eine leere Map, die Spalte bleibt dann leer.
 * @returns {Promise<Map<string, object>>}
 */
export async function loadStrategiePersonas(client, strategie, items = []) {
  const ids = new Set(briefingPersonaIds(strategie?.briefing));
  for (const item of items || []) {
    if (item?.persona_id) ids.add(item.persona_id);
  }
  if (!client || !ids.size) return new Map();

  const { data, error } = await client
    .from('personas')
    .select('id, name, oberbegriff')
    .in('id', [...ids]);
  if (error) {
    console.error('Fehler beim Laden der Personas:', error);
    return new Map();
  }
  return new Map((data || []).map(p => [p.id, p]));
}
