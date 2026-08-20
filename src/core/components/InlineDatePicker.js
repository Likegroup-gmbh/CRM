import { icon } from '../icons/IconSystem.js';
// InlineDatePicker.js
// Wiederverwendbarer Wrapper um natives input[type="date"] fuer Tabellen/Inline-Editing

export class InlineDatePicker {
  static render({
    id,
    field,
    dateField,
    value = '',
    label = 'Datum',
    inputClass = ''
  } = {}) {
    const safeValue = this.normalizeDateValue(value);
    const classes = ['inline-date-picker__input', inputClass].filter(Boolean).join(' ');

    return `
      <div class="inline-date-picker">
        <input
          type="date"
          class="${classes}"
          data-id="${id || ''}"
          data-field="${field || ''}"
          data-date-field="${dateField || ''}"
          data-previous-value="${safeValue}"
          value="${safeValue}"
          aria-label="${label}"
          title="${label}"
        >
        <button type="button" class="inline-date-picker__button" title="Datum waehlen" aria-label="Datum waehlen">
          ${icon('calendar-days')}
        </button>
      </div>
    `;
  }

  static bind(root = document, signal = null) {
    if (!root) return () => {};
    const eventOptions = signal ? { signal } : {};

    const handleClick = (event) => {
      const button = event.target.closest('.inline-date-picker__button');
      if (!button) return;

      event.preventDefault();
      const wrapper = button.closest('.inline-date-picker');
      const input = wrapper?.querySelector('.inline-date-picker__input');
      if (!input || input.disabled) return;

      input.focus();
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      }
    };

    root.addEventListener('click', handleClick, eventOptions);

    return () => {
      root.removeEventListener('click', handleClick, eventOptions);
    };
  }

  static setValue(input, value) {
    if (!input) return;
    input.value = this.normalizeDateValue(value);
  }

  static getValue(input) {
    if (!input) return '';
    return input.value || '';
  }

  static setDisabled(input, isDisabled) {
    if (!input) return;
    input.disabled = Boolean(isDisabled);
  }

  static normalizeDateValue(dateValue) {
    if (!dateValue) return '';
    const asString = String(dateValue);
    if (/^\d{4}-\d{2}-\d{2}/.test(asString)) {
      return asString.slice(0, 10);
    }
    const parsed = new Date(asString);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  }
}

export const inlineDatePicker = InlineDatePicker;
export default InlineDatePicker;
