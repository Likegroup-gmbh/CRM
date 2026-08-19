// TableSelect.js
// Wiederverwendbarer Spaltentyp "Select" fuer Tabellenzellen: Custom-Trigger statt
// nativem <select>, Optionsliste als Portal an document.body (Table-Container
// clippen sonst das Panel weg).
//
// Die Komponente persistiert nichts. Bei Auswahl feuert sie auf document ein
// CustomEvent 'table-select-change' mit { field, itemId, value, element } -
// jede Tabellenansicht haengt ihre eigene Speicherlogik daran.

const CHEVRON_ICON = `<svg class="table-select__chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd" /></svg>`;

const CHECK_ICON = `<svg class="table-select__check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>`;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDot(option) {
  if (!option?.color) return '';
  return `<span class="table-select__dot" style="background:${escapeHtml(option.color)}"></span>`;
}

function renderOption(option, activeValue) {
  const isActive = String(option.value) === String(activeValue);
  const classes = [
    'table-select__item',
    isActive ? 'is-active' : '',
    option.disabled ? 'is-disabled' : ''
  ].filter(Boolean).join(' ');

  return `
    <button type="button"
            class="${classes}"
            role="option"
            aria-selected="${isActive}"
            data-value="${escapeHtml(option.value)}"
            ${option.disabled ? 'disabled' : ''}>
      ${renderDot(option)}
      <span class="table-select__item-label">${escapeHtml(option.label)}</span>
      ${isActive ? CHECK_ICON : ''}
    </button>
  `;
}

/**
 * Ob ein Select fuer den aktuellen Nutzer klickbar ist. Nicht pauschal per
 * Rolle sperren: die Call-Site sagt mit kundeDarfWaehlen explizit, ob der
 * Kunde das Feld setzen darf (z.B. Prio, Kundenfeedback). Default false.
 */
export function tableSelectDisabled({ gastReadonly = false, isKunde = false, kundeDarfWaehlen = false } = {}) {
  if (gastReadonly) return true;
  if (isKunde && !kundeDarfWaehlen) return true;
  return false;
}

/**
 * Zellen-HTML fuer ein Select-Feld.
 *
 * @param {object}   config
 * @param {string}   config.field        Feldname, landet im Change-Event
 * @param {string}   config.itemId       Datensatz-ID, landet im Change-Event
 * @param {string}   config.value        Aktuell gewaehlter Wert
 * @param {Array}    config.options      [{ value, label, color?, disabled? }]
 * @param {boolean}  [config.disabled]   Rendert einen nicht klickbaren Trigger
 * @param {string}   [config.placeholder] Anzeige, wenn kein Wert passt
 * @param {string}   [config.meta]       Zusatzzeile unter dem Trigger (z.B. Datum)
 */
export function renderTableSelect({
  field,
  itemId,
  value,
  options = [],
  disabled = false,
  placeholder = '–',
  meta = ''
} = {}) {
  const active = options.find(o => String(o.value) === String(value));
  const label = active?.label || placeholder;

  const triggerClasses = [
    'table-select__trigger',
    disabled ? 'table-select__trigger--disabled' : '',
    active ? '' : 'table-select__trigger--empty'
  ].filter(Boolean).join(' ');

  const trigger = disabled
    ? `<span class="${triggerClasses}">
         ${renderDot(active)}
         <span class="table-select__label">${escapeHtml(label)}</span>
       </span>`
    : `<button type="button" class="${triggerClasses}" aria-haspopup="listbox" aria-expanded="false">
         ${renderDot(active)}
         <span class="table-select__label">${escapeHtml(label)}</span>
         ${CHEVRON_ICON}
       </button>`;

  return `
    <div class="table-select"
         data-table-select
         data-field="${escapeHtml(field)}"
         data-item-id="${escapeHtml(itemId)}"
         data-value="${escapeHtml(value ?? '')}">
      ${trigger}
      ${meta ? `<div class="table-select__meta">${escapeHtml(meta)}</div>` : ''}
      ${disabled ? '' : `
        <div class="table-select__panel" role="listbox" aria-label="${escapeHtml(field)}">
          ${options.map(o => renderOption(o, value)).join('')}
        </div>
      `}
    </div>
  `;
}

export class TableSelect {
  constructor() {
    this._abortController = null;
  }

  /** Bindet die delegierten Listener einmalig. Weitere Aufrufe sind No-Ops. */
  init() {
    if (this._abortController) return;
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('.table-select__trigger');
      if (trigger && !trigger.classList.contains('table-select__trigger--disabled')) {
        e.preventDefault();
        e.stopPropagation();
        this.toggle(trigger.closest('.table-select'));
        return;
      }

      const item = e.target.closest('.table-select__portal .table-select__item');
      if (item) {
        e.preventDefault();
        e.stopPropagation();
        this.select(item);
        return;
      }

      if (!e.target.closest('.table-select')) this.closeAll();
    }, { signal });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAll();
    }, { signal });

    window.addEventListener('scroll', () => {
      if (document.querySelector('.table-select__portal')) this.closeAll();
    }, { capture: true, signal });

    window.addEventListener('resize', () => this.closeAll(), { signal });
  }

  closeAll() {
    document.querySelectorAll('.table-select__portal').forEach(p => p.remove());
    document.querySelectorAll('.table-select.open').forEach(w => {
      w.classList.remove('open');
      w.querySelector('.table-select__trigger')?.setAttribute('aria-expanded', 'false');
    });
  }

  toggle(wrapper) {
    const isOpen = wrapper?.classList.contains('open');
    this.closeAll();
    if (!wrapper || isOpen) return;
    this.open(wrapper);
  }

  open(wrapper) {
    const source = wrapper.querySelector('.table-select__panel');
    const trigger = wrapper.querySelector('.table-select__trigger');
    if (!source || !trigger) return null;

    const portal = source.cloneNode(true);
    portal.classList.remove('table-select__panel');
    portal.classList.add('table-select__portal');
    portal._sourceWrapper = wrapper;

    document.body.appendChild(portal);
    this.position(trigger, portal);

    wrapper.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => portal.classList.add('show'));
    return portal;
  }

  position(trigger, portal) {
    const rect = trigger.getBoundingClientRect();
    const portalHeight = portal.offsetHeight || portal.scrollHeight || 240;
    const portalWidth = portal.offsetWidth || 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < portalHeight + 8 && rect.top > spaceBelow;

    if (openUp) {
      portal.style.top = Math.max(8, rect.top - portalHeight - 4) + 'px';
      portal.style.transformOrigin = 'bottom left';
    } else {
      portal.style.top = (rect.bottom + 4) + 'px';
      portal.style.transformOrigin = 'top left';
    }

    const left = Math.min(rect.left, window.innerWidth - portalWidth - 8);
    portal.style.left = Math.max(8, left) + 'px';
  }

  select(item) {
    const portal = item.closest('.table-select__portal');
    const wrapper = portal?._sourceWrapper;
    const value = item.dataset.value ?? '';

    this.closeAll();
    if (!wrapper) return;
    if (String(wrapper.dataset.value ?? '') === String(value)) return;

    document.dispatchEvent(new CustomEvent('table-select-change', {
      bubbles: true,
      detail: {
        field: wrapper.dataset.field,
        itemId: wrapper.dataset.itemId,
        value,
        element: wrapper
      }
    }));
  }

  destroy() {
    this.closeAll();
    this._abortController?.abort();
    this._abortController = null;
  }
}

export const tableSelect = new TableSelect();
