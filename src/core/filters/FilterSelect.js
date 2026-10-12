// FilterSelect.js
// Wiederverwendbares Dropdown für Filter: Optik wie das Feedback-Select der
// Casting-Liste (TableSelect), als Einzel- oder Mehrfachauswahl, optional mit Suche.
// Einbinden: renderFilterSelect(...) ins HTML, einmal bindFilterSelects(root, { signal }).
// Konfiguration wie die Filter-Config: { id, label, type, options, emptyLabel, placeholder, searchable }.
// type: 'select' und 'boolean' wählen einen Wert, 'multiSelect' mehrere.
// Die Werte stecken in echten Formularfeldern (verstecktes Input bzw. Checkboxen
// mit data-filter-id), Änderungen kommen als normales change-Event an.

import { icon } from '../icons/IconSystem.js';

const SEARCH_FROM = 8;
const SUMMARY_NAMES = 2;
const BOOLEAN_OPTIONS = [
  { value: 'true', label: 'Ja' },
  { value: 'false', label: 'Nein' }
];

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeOptions(filter, options) {
  const list = filter.type === 'boolean' ? BOOLEAN_OPTIONS : (options || filter.options || []);
  return list.map((opt) => ({
    value: String(opt.value ?? opt.id ?? ''),
    label: String(opt.label ?? opt.name ?? opt.value ?? '')
  }));
}

// Jedes Suchwort muss den Anfang eines Wortes im Namen treffen: „an“ findet „Anna“ und „Annika“.
export function matchesOptionSearch(label, term) {
  const tokens = String(term || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const text = String(label || '').toLowerCase();
  const words = text.split(/[\s\-–/.,()]+/).filter(Boolean);
  return tokens.every((token) => text.startsWith(token) || words.some((word) => word.startsWith(token)));
}

export function summarizeSelection(labels, emptyLabel) {
  if (!labels.length) return emptyLabel;
  if (labels.length <= SUMMARY_NAMES) return labels.join(', ');
  return `${labels[0]} +${labels.length - 1}`;
}

export function renderFilterSelect(filter, value, options, { name = '' } = {}) {
  const multi = filter.type === 'multiSelect';
  const items = normalizeOptions(filter, options);
  const emptyLabel = filter.emptyLabel || 'Alle';
  const selected = new Set(multi ? (Array.isArray(value) ? value.map(String) : []) : []);
  const single = multi ? '' : (value === true ? 'true' : value === false ? 'false' : String(value ?? ''));
  const searchable = filter.searchable || items.length >= SEARCH_FROM;
  const idAttr = filter.id ? ` data-filter-id="${esc(filter.id)}"` : '';
  const labels = multi
    ? items.filter((opt) => selected.has(opt.value)).map((opt) => opt.label)
    : items.filter((opt) => opt.value === single).map((opt) => opt.label);

  const optionHtml = multi
    ? items.map((opt) => `
        <label class="table-select__item filter-select__item" role="option" aria-selected="${selected.has(opt.value)}">
          <input type="checkbox" value="${esc(opt.value)}"${idAttr}${selected.has(opt.value) ? ' checked' : ''}>
          <span class="table-select__item-label">${esc(opt.label)}</span>
        </label>`).join('')
    : [...(filter.noEmpty ? [] : [{ value: '', label: emptyLabel }]), ...items].map((opt) => `
        <button type="button" class="table-select__item filter-select__item" role="option" data-value="${esc(opt.value)}" aria-selected="${opt.value === single}">
          <span class="table-select__item-label">${esc(opt.label)}</span>
          <span class="filter-select__check">${icon('check-filled')}</span>
        </button>`).join('');

  return `
    <div class="filter-select" data-filter-select data-mode="${multi ? 'multi' : 'single'}" data-empty-label="${esc(emptyLabel)}">
      <button type="button" class="filter-select__trigger${labels.length ? '' : ' is-empty'}" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(filter.label || '')}">
        <span class="table-select__label">${esc(summarizeSelection(labels, emptyLabel))}</span>
        <span class="table-select__chevron">${icon('chevron-down')}</span>
      </button>
      ${multi ? '' : `<input type="hidden"${idAttr}${name ? ` name="${esc(name)}"` : ''} value="${esc(single)}">`}
      <div class="filter-select__panel" role="listbox"${multi ? ' aria-multiselectable="true"' : ''} hidden>
        ${searchable ? `
          <div class="filter-select__search">
            <input type="search" class="filter-submenu-input" data-select-search placeholder="${esc(filter.placeholder || 'Suchen...')}" autocomplete="off">
          </div>` : ''}
        <div class="filter-select__options">${optionHtml}</div>
        <p class="filter-select__empty" hidden>Keine Treffer</p>
        ${multi ? `
          <div class="filter-select__foot">
            <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-select-clear>Leeren</button>
            <button type="button" class="mdc-btn mdc-btn--sm" data-select-done>Fertig</button>
          </div>` : ''}
      </div>
    </div>
  `;
}

// Trigger-Text und Markierungen aus den Formularfeldern neu setzen.
export function syncFilterSelect(wrapper) {
  const multi = wrapper.dataset.mode === 'multi';
  const labels = [];
  if (multi) {
    wrapper.querySelectorAll('.filter-select__item').forEach((item) => {
      const on = item.querySelector('input[type="checkbox"]').checked;
      item.setAttribute('aria-selected', String(on));
      if (on) labels.push(item.textContent.trim());
    });
  } else {
    const value = wrapper.querySelector('input[type="hidden"]')?.value ?? '';
    wrapper.querySelectorAll('.filter-select__item').forEach((item) => {
      const on = item.dataset.value === value;
      item.setAttribute('aria-selected', String(on));
      if (on && value !== '') labels.push(item.textContent.trim());
    });
  }
  const trigger = wrapper.querySelector('.filter-select__trigger');
  trigger.classList.toggle('is-empty', !labels.length);
  trigger.querySelector('.table-select__label').textContent = summarizeSelection(labels, wrapper.dataset.emptyLabel);
}

export function syncFilterSelects(root) {
  root.querySelectorAll('[data-filter-select]').forEach(syncFilterSelect);
}

function filterOptions(wrapper, term) {
  let visible = 0;
  wrapper.querySelectorAll('.filter-select__item').forEach((item) => {
    const hit = !item.dataset.value && wrapper.dataset.mode === 'single'
      ? !term
      : matchesOptionSearch(item.textContent.trim(), term);
    item.hidden = !hit;
    if (hit) visible += 1;
  });
  wrapper.querySelector('.filter-select__empty').hidden = visible > 0;
}

function position(wrapper) {
  const trigger = wrapper.querySelector('.filter-select__trigger');
  const panel = wrapper.querySelector('.filter-select__panel');
  const rect = trigger.getBoundingClientRect();
  panel.style.width = `${Math.max(rect.width, 220)}px`;
  panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - panel.offsetWidth - 8))}px`;
  const below = window.innerHeight - rect.bottom;
  const openUp = below < panel.offsetHeight + 8 && rect.top > below;
  panel.style.top = openUp
    ? `${Math.max(8, rect.top - panel.offsetHeight - 4)}px`
    : `${rect.bottom + 4}px`;
}

function close(wrapper, { focus = false } = {}) {
  if (!wrapper?.classList.contains('is-open')) return;
  wrapper.classList.remove('is-open');
  const panel = wrapper.querySelector('.filter-select__panel');
  panel.hidden = true;
  const search = wrapper.querySelector('[data-select-search]');
  if (search?.value) {
    search.value = '';
    filterOptions(wrapper, '');
  }
  const trigger = wrapper.querySelector('.filter-select__trigger');
  trigger.setAttribute('aria-expanded', 'false');
  if (focus) trigger.focus();
}

function open(wrapper) {
  wrapper.classList.add('is-open');
  wrapper.querySelector('.filter-select__panel').hidden = false;
  wrapper.querySelector('.filter-select__trigger').setAttribute('aria-expanded', 'true');
  position(wrapper);
  const search = wrapper.querySelector('[data-select-search]');
  (search || wrapper.querySelector('.filter-select__item:not([hidden])'))?.focus();
}

function emitChange(input) {
  input?.dispatchEvent(new Event('change', { bubbles: true }));
}

export function bindFilterSelects(root, { signal } = {}) {
  let current = null;
  const closeCurrent = (opts) => {
    close(current, opts);
    current = null;
  };

  root.addEventListener('click', (event) => {
    const trigger = event.target.closest('.filter-select__trigger');
    if (trigger) {
      event.preventDefault();
      const wrapper = trigger.closest('[data-filter-select]');
      const wasOpen = wrapper === current;
      closeCurrent();
      if (!wasOpen) {
        open(wrapper);
        current = wrapper;
      }
      return;
    }
    const wrapper = event.target.closest('[data-filter-select]');
    if (!wrapper) return;
    if (event.target.closest('[data-select-done]')) {
      closeCurrent({ focus: true });
      return;
    }
    if (event.target.closest('[data-select-clear]')) {
      const boxes = [...wrapper.querySelectorAll('input[type="checkbox"]:checked')];
      boxes.forEach((box) => { box.checked = false; });
      syncFilterSelect(wrapper);
      emitChange(boxes[0]);
      return;
    }
    const item = event.target.closest('button.filter-select__item');
    if (item) {
      const input = wrapper.querySelector('input[type="hidden"]');
      const changed = input.value !== item.dataset.value;
      input.value = item.dataset.value;
      syncFilterSelect(wrapper);
      closeCurrent({ focus: true });
      if (changed) emitChange(input);
    }
  }, { signal });

  root.addEventListener('change', (event) => {
    const wrapper = event.target.closest('[data-filter-select]');
    if (wrapper && event.target.type === 'checkbox') syncFilterSelect(wrapper);
  }, { signal });

  root.addEventListener('input', (event) => {
    const search = event.target.closest('[data-select-search]');
    if (!search) return;
    const wrapper = search.closest('[data-filter-select]');
    filterOptions(wrapper, search.value);
    position(wrapper);
  }, { signal });

  document.addEventListener('pointerdown', (event) => {
    if (current && !current.contains(event.target)) closeCurrent();
  }, { signal });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && current) {
      event.stopPropagation();
      closeCurrent({ focus: true });
    }
  }, { signal, capture: true });

  window.addEventListener('scroll', (event) => {
    if (!current) return;
    if (current.querySelector('.filter-select__panel').contains(event.target)) return;
    position(current);
  }, { signal, capture: true });

  window.addEventListener('resize', () => closeCurrent(), { signal });
}
