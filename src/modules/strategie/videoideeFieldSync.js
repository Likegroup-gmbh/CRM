// videoideeFieldSync.js
// Gleiches Feld in Tabelle und Drawer. Das fokussierte Element bleibt stehen.

export function fieldSignature(el) {
  if (!el) return '';
  if (el.type === 'checkbox') return el.checked ? '1' : '0';
  return String(el.value ?? '');
}

export function cssEscape(value) {
  const raw = String(value);
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(raw);
  return raw.replace(/"/g, '\\"');
}

export function syncVideoideeField(itemId, field, value, source) {
  if (itemId == null || !field) return;
  const selector = `[data-field="${cssEscape(field)}"][data-item-id="${cssEscape(itemId)}"]`;
  document.querySelectorAll(selector).forEach((el) => {
    if (el === source || el === document.activeElement) return;
    writeControl(el, value);
  });
}

export function syncCustomPeer(source) {
  if (!source?.dataset?.customColumnId || !source.dataset.entityId) return;
  const selector = `[data-custom-column-id="${cssEscape(source.dataset.customColumnId)}"][data-entity-id="${cssEscape(source.dataset.entityId)}"]`;
  const value = source.type === 'checkbox' ? source.checked : source.value;
  document.querySelectorAll(selector).forEach((el) => {
    if (el === source || el === document.activeElement) return;
    writeControl(el, value);
  });
}

function writeControl(el, value) {
  if (el.type === 'checkbox') el.checked = value === true || value === 'true';
  else if ('value' in el) el.value = value ?? '';
  if (el.dataset) el.dataset.videoideeSaved = fieldSignature(el);
}
