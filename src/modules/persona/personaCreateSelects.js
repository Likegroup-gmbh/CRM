// personaCreateSelects.js
// Select-Helfer des Persona-Create-Drawers (Searchable-Select befüllen, setzen,
// sperren, Hinweise). Als Mixin auf den Prototyp gelegt.

import { escapeHtml } from '../../core/format.js';

export function installPersonaCreateSelects(proto) {
  const methods = {
  refreshSearchableSelect(name, options, { placeholder, emptyLabel }) {
    const select = this.el(name);
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${emptyLabel}</option>`
      + options.map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('');
    if (current && [...select.options].some((o) => o.value === current)) select.value = current;
    if (!window.formSystem?.createSimpleSearchableSelect) return;
    window.formSystem.createSimpleSearchableSelect(select, [
      { value: '', label: emptyLabel },
      ...options.map((o) => ({ ...o, selected: o.value === select.value }))
    ], { placeholder });
  },

  setSearchableValue(name, value) {
    const select = this.el(name);
    if (!select) return;
    select.value = value || '';
    const label = select.selectedOptions[0]?.textContent || '';
    const wrap = select.parentNode?.querySelector('.searchable-select-container');
    const hidden = wrap?.querySelector('input[type="hidden"]');
    const input = wrap?.querySelector('.searchable-select-input');
    if (hidden) hidden.value = value || '';
    if (input) input.value = value ? label : '';
  },

  ensureOption(name, value, label) {
    const select = this.el(name);
    if (!select || !value) return;
    if ([...select.options].some((o) => o.value === value)) return;
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label || value;
    select.appendChild(opt);
  },

  lockSearchable(name) {
    const select = this.el(name);
    if (!select) return;
    select.disabled = true;
    const wrap = select.parentNode?.querySelector('.searchable-select-container');
    const input = wrap?.querySelector('.searchable-select-input');
    if (input) {
      input.disabled = true;
      input.readOnly = true;
    }
    wrap?.classList.add('prefilled-locked');
    select.closest('.form-field')?.classList.add('form-field--prefilled');
  },

  setHint(name, message, { html = false } = {}) {
    const hint = this.el(`${name}-hint`);
    if (!hint) return;
    if (!message) {
      hint.hidden = true;
      hint.textContent = '';
      return;
    }
    hint.hidden = false;
    if (html) hint.innerHTML = message;
    else hint.textContent = message;
  },

  value(name) {
    const select = this.el(name);
    if (!select) return '';
    const hidden = select.parentNode?.querySelector(
      `.searchable-select-container input[type="hidden"][name="${name}"], .searchable-select-container input[type="hidden"]`
    );
    return select.value || hidden?.value || '';
  }
  };
  Object.assign(proto, methods);
}
