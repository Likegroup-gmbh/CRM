// Merkt sich den Text eines Feldes beim Fokussieren.
// Ein Blur speichert nur, wenn der Nutzer den Text danach wirklich geändert hat.
// So löscht ein Klick in eine noch leere Caption- oder Feedback-Zelle nichts,
// und ein Neuzeichnen kann einen noch nicht verlassenen Text vorher sichern.

const SKIP_INPUT_TYPES = new Set([
  'checkbox', 'radio', 'file', 'button', 'submit', 'hidden', 'reset', 'image'
]);

export const PROTECTED_TEXT_FIELDS = [
  'caption',
  'transkript',
  'beschreibung',
  'kurzbeschreibung',
  'kunde_anmerkung'
];

export function isGuardedTextField(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  if (tag !== 'TEXTAREA' && tag !== 'INPUT') return false;
  if (SKIP_INPUT_TYPES.has(el.type)) return false;
  if (el.classList?.contains('custom-date-picker__input') || el.classList?.contains('custom-col-date')) {
    return false;
  }
  return true;
}

/** Nur Tabellenzellen. Suche und Formulare behalten ihr bisheriges Speichern. */
function tracksBaseline(el) {
  if (!isGuardedTextField(el)) return false;
  return Boolean(
    el.getAttribute('data-field')
    || el.getAttribute('data-custom-column-id')
    || el.classList.contains('grid-input')
    || el.classList.contains('grid-textarea')
    || el.classList.contains('custom-col-input')
  );
}

export function rememberTextBaseline(el) {
  if (!tracksBaseline(el)) return;
  el.dataset.fieldBaseline = el.value ?? '';
}

/** Selects, Checkboxen und Daten speichern wie bisher. Text nur nach einer echten Änderung. */
export function shouldPersistTextField(el) {
  if (!tracksBaseline(el)) return true;
  if (el.dataset.fieldBaseline === undefined) return false;
  return el.value !== el.dataset.fieldBaseline;
}

/** True nur, wenn der Nutzer einen Tabellentext seit dem Fokus geändert hat. */
export function hasUnsavedTextEdit(el) {
  return tracksBaseline(el) && shouldPersistTextField(el);
}

/**
 * Angezeigten Text nicht durch einen leeren Remote-Wert ersetzen.
 * Selects und Checkboxen sind davon ausgenommen.
 */
export function shouldKeepDisplayedText(field, raw) {
  if (!tracksBaseline(field)) return false;
  if (typeof document !== 'undefined' && field === document.activeElement) return true;
  if (hasUnsavedTextEdit(field)) return true;
  const incomingEmpty = raw == null || String(raw).trim() === '';
  return incomingEmpty && String(field.value ?? '').trim() !== '';
}

/**
 * Patch für ein Zeilen-Update: null oder "" überschreibt keinen vorhandenen Wert.
 * Eine bewusste Leerung setzt den Wert vorher lokal, das Echo trifft dann schon auf leer.
 */
export function mergeKeepingFilled(existing, incoming) {
  if (!incoming) return incoming;
  if (!existing) return { ...incoming };
  const patch = { ...incoming };
  for (const [key, value] of Object.entries(incoming)) {
    const incomingEmpty = value == null || (typeof value === 'string' && value.trim() === '');
    if (!incomingEmpty) continue;
    const local = existing[key];
    const localFilled = local != null && !(typeof local === 'string' && local.trim() === '');
    if (localFilled) delete patch[key];
  }
  return patch;
}

export function bindTextBaseline(root, { signal, onCleanup } = {}) {
  if (!root) return () => {};
  const onFocusIn = (event) => rememberTextBaseline(event.target);
  root.addEventListener('focusin', onFocusIn, signal ? { signal } : undefined);
  const cleanup = () => root.removeEventListener('focusin', onFocusIn);
  onCleanup?.(cleanup);
  return cleanup;
}

/**
 * Ruft commit für jedes Textfeld, dessen Inhalt seit dem Fokus abweicht.
 * commit muss die Baseline selbst setzen, damit der Blur beim Entfernen
 * des Feldes nicht ein zweites Mal schreibt.
 */
const EDITED_TEXT_SELECTOR = [
  'textarea[data-field]',
  'input[data-field]',
  'textarea[data-custom-column-id]',
  'input[data-custom-column-id]'
].join(', ');

export function absorbEditedTextFields(root, commit) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll(EDITED_TEXT_SELECTOR).forEach((el) => {
    if (!isGuardedTextField(el) || !shouldPersistTextField(el)) return;
    commit(el);
  });
}

/**
 * Ein Realtime-Update darf vorhandenen Text nicht durch null oder "" ersetzen.
 * Eine bewusste Leerung läuft über das Feld selbst, nicht über ein veraltetes Payload.
 */
export function mergeRealtimeRow(item, row, fields = PROTECTED_TEXT_FIELDS) {
  if (!item || !row) return item;
  for (const [key, value] of Object.entries(row)) {
    if (fields.includes(key)) {
      const incomingEmpty = value == null || String(value).trim() === '';
      const local = item[key];
      const localHasText = local != null && String(local).trim() !== '';
      if (incomingEmpty && localHasText) continue;
    }
    item[key] = value;
  }
  return item;
}
