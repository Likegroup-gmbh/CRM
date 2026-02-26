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
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
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
