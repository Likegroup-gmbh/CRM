// remoteCustomValue.js
// Wert einer eigenen Spalte, den jemand anderes gespeichert hat, live in die Tabelle
// schreiben. Gilt für Kampagne, Casting und Konzept (gleiche data-Attribute).

import { hasUnsavedTextEdit, rememberTextBaseline } from '../table/textFieldBaseline.js';

/** Zeile aus einem Realtime-Payload. DELETE liefert payload.new = {}. */
export function readCustomValueChange(payload) {
  const row = payload?.new?.custom_column_id ? payload.new : payload?.old;
  if (!row?.custom_column_id || !row.entity_id) return null;
  return {
    columnId: row.custom_column_id,
    entityId: row.entity_id,
    value: payload.eventType === 'DELETE' ? null : (row.value ?? null)
  };
}

export function customValueFields(root, columnId, entityId) {
  if (!root?.querySelectorAll) return [];
  return [...root.querySelectorAll(`[data-custom-column-id="${columnId}"][data-entity-id="${entityId}"]`)];
}

/** Fokus oder ungespeicherter Text: der eigene Save hat Vorrang. */
export function isEditingCustomValue(fields) {
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  return fields.some(f => f === active || hasUnsavedTextEdit(f));
}

/**
 * Schreibt den Wert in die Eingabefelder.
 * @returns {boolean} false, wenn es kein Eingabefeld gibt (Upload, Datum, Nur-Lese):
 *   dann muss die Zelle neu gezeichnet werden.
 */
export function writeCustomValue(fields, value, { onPatched } = {}) {
  const inputs = fields.filter(f => f.matches?.('input, textarea, select'));
  if (!inputs.length) return false;
  const text = value == null ? '' : String(value);
  for (const field of inputs) {
    if (field.type === 'checkbox') {
      const checked = text === 'true';
      if (field.checked === checked) continue;
      field.checked = checked;
    } else {
      if (field.value === text) continue;
      field.value = text;
      rememberTextBaseline(field);
    }
    onPatched?.(field);
    field.classList.add('field-updated');
    setTimeout(() => field.classList.remove('field-updated'), 2000);
  }
  return true;
}
