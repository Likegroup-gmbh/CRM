// briefingLikySpec.js
// Spec für Liky am Briefing: aus briefingFelder.json (über fieldConfig) abgeleitet und an
// briefing-pdf-background geschickt. valueShape sagt dem Modell, in welcher Form ein Wert
// erwartet wird, sonst binden die Werte nicht an die Widgets.

import { inhaltsFelder } from './fieldConfig.js';

function valueShape(field) {
  switch (field.type) {
    case 'date': return 'string "YYYY-MM-DD"';
    case 'checkbox': return 'true | false';
    case 'checkboxes': return 'array von options.value (strings)';
    case 'videolaenge': return 'object { von: Sekunden, bis: Sekunden }; Mindestlänge als { von: Sekunden, bis: null }';
    case 'produktListe': return 'array von { name, url, kurzbeschreibung, usp, loesung } (strings), ein Objekt pro Produkt';
    case 'ideenListe': return 'array von { text: string, verbindlich: boolean }, ein Eintrag pro Idee oder Link';
    default: return 'string';
  }
}

/** Felder des Creator-Briefings ohne Zuordnung (die ist vor dem Upload gewählt). */
export function buildSpec(_bereich) {
  return inhaltsFelder().map((field) => ({
    name: field.name,
    label: field.label,
    type: field.type,
    valueShape: valueShape(field),
    options: field.options?.map((o) => ({ value: o.value, label: o.label })),
    fields: field.fields?.map((f) => ({ name: f.name, label: f.label, type: f.type })),
    hint: field.helper || field.placeholder || null
  }));
}

/** Liky-Text nach dem Extract. */
export function formatExtractResult(result = {}, applied = [], skipped = []) {
  const lines = [];
  if (applied.length) lines.push(`${applied.length} Felder gefüllt. Was ich nur vermute, ist markiert.`);
  if (!applied.length && skipped.length) lines.push('Alles war schon ausgefüllt - ich habe nichts angerührt.');
  else if (skipped.length) lines.push(`${skipped.length} Felder waren schon voll, die bleiben wie sie sind.`);
  if (result.missing?.length) {
    lines.push(`Noch offen: ${result.missing.join(', ')}`);
  }
  if (result.unternehmen_hint && !result.unternehmen_hint.passt) {
    lines.push(`Achtung: Das PDF nennt „${result.unternehmen_hint.name}“ - das gewählte Unternehmen bleibt.`);
  }
  return lines.join('\n') || 'Fertig, schau es dir an.';
}
