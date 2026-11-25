// personaZuordnung.js
// Welche Marken und Briefings ein Persona-Save schreiben darf.
// Ein Tag-Feld ohne geladene Optionen liefert []. Das darf bestehende
// Linien nicht lösen, gleiche Falle wie produktion_id am Vertrag.

function alsIdListe(werte) {
  if (Array.isArray(werte)) return werte.filter(Boolean);
  return werte ? [werte] : [];
}

export function tagFeldHatOptionen(fieldName, form = document.getElementById('persona-form')) {
  const select = form?.querySelector?.(`[name="${fieldName}"]`);
  const raw = select?.closest('.form-field')?.querySelector('.tag-based-select')?.dataset?.options;
  if (!raw) return false;
  try {
    const options = JSON.parse(raw);
    return Array.isArray(options) && options.length > 0;
  } catch {
    return false;
  }
}

export function briefingIdsZumSpeichern({ isEdit, createBriefingId, vorhandene = [], submitted }) {
  if (!isEdit && createBriefingId) return [createBriefingId];
  if (isEdit && !tagFeldHatOptionen('briefing_ids')) return [...vorhandene];
  return alsIdListe(submitted);
}

export function markenIdsZumSpeichern({
  isEdit,
  isStandalone,
  zeigtMarkenFeld,
  createMarkeId,
  kontextMarkeId,
  vorhandene = [],
  submitted
}) {
  if (!isEdit && createMarkeId) return [createMarkeId];
  if (!isStandalone && !zeigtMarkenFeld) {
    return [...new Set([...vorhandene, kontextMarkeId].filter(Boolean))];
  }
  if (isEdit && !tagFeldHatOptionen('marke_ids')) return [...vorhandene];
  return alsIdListe(submitted);
}
