// CreateActionGate.js
// Kleines, wiederverwendbares Gate fuer Create-CTAs:
// Permission + Existenz → rendern oder nicht. Existiert die Entity schon,
// faellt der Button weg (Worksheet-Tools ersetzen ihn).

function escapeAttr(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeLabel(str) {
  return window.validatorSystem?.sanitizeHtml(String(str ?? '')) || '';
}

/**
 * @param {{ permission?: string, exists?: boolean, existsReason?: string }} spec
 * @returns {{ renderable: boolean, enabled: boolean, reason: string }}
 */
export function resolveCreateAction({ permission, exists = false, existsReason = '' } = {}) {
  const canCreate = permission ? (window.canCreate?.(permission) ?? false) : true;
  if (!canCreate) {
    return { renderable: false, enabled: false, reason: '' };
  }
  if (exists) {
    return { renderable: false, enabled: false, reason: existsReason || '' };
  }
  return { renderable: true, enabled: true, reason: '' };
}

/**
 * @param {{ action: string, label: string, state: { renderable: boolean, enabled: boolean, reason?: string } }} opts
 * @returns {string}
 */
export function renderCreateButton({ action, label, state }) {
  if (!state?.renderable) return '';
  const disabled = !state.enabled
    ? ` disabled aria-disabled="true"${state.reason ? ` title="${escapeAttr(state.reason)}"` : ''}`
    : '';
  return `<button type="button" class="mdc-btn" data-create-action="${escapeAttr(action)}"${disabled}>${sanitizeLabel(label)}</button>`;
}
