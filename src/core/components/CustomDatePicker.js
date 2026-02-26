// CustomDatePicker.js
// Wiederverwendbarer Datepicker mit eigener Popover-UI (ohne natives input[type="date"] Popup)

const WEEKDAY_LABELS = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

export class CustomDatePicker {
  static _boundRoots = new WeakMap();
  static _activePicker = null;

  static render({
    id,
    field,
    dateField,
    value = '',
    label = 'Datum',
    inputClass = ''
  } = {}) {
    const safeValue = this.normalizeDateValue(value);
    const viewDate = this.parseISO(safeValue) || new Date();
    const viewMonth = viewDate.getMonth();
    const viewYear = viewDate.getFullYear();
    const classes = ['custom-date-picker__input', 'custom-date-picker__value', inputClass].filter(Boolean).join(' ');
    const triggerTitle = safeValue ? `${label}: ${this.formatDisplayDate(safeValue)}` : `${label} setzen`;
    const hasValueClass = safeValue ? 'has-value' : '';

    return `
      <div class="custom-date-picker ${hasValueClass}" data-custom-datepicker>
        <div class="custom-date-picker__control">
          <input
            type="text"
            class="${classes}"
            data-id="${id || ''}"
            data-field="${field || ''}"
            data-date-field="${dateField || ''}"
            data-previous-value="${safeValue}"
            data-iso-value="${safeValue}"
            value="${safeValue}"
            data-label="${label}"
            aria-label="${label}"
            title="${label}"
            readonly
            autocomplete="off"
            tabindex="-1"
            aria-hidden="true"
          >
          <button type="button" class="custom-date-picker__trigger" aria-label="Kalender öffnen" title="${triggerTitle}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          </button>
        </div>
        <div
          class="custom-date-picker__popover"
          data-view-month="${viewMonth}"
          data-view-year="${viewYear}"
          data-focused-value="${safeValue || this.formatISO(new Date())}"
          hidden
        >
          <div class="custom-date-picker__header">
            <button type="button" class="custom-date-picker__nav custom-date-picker__nav--prev" aria-label="Vorheriger Monat">‹</button>
            <div class="custom-date-picker__month-label">${this.capitalizeFirst(MONTH_FORMATTER.format(viewDate))}</div>
            <button type="button" class="custom-date-picker__nav custom-date-picker__nav--next" aria-label="Nächster Monat">›</button>
          </div>
          <div class="custom-date-picker__weekdays">
            ${WEEKDAY_LABELS.map(day => `<span>${day}</span>`).join('')}
          </div>
          <div class="custom-date-picker__days" role="grid"></div>
          <div class="custom-date-picker__footer">
            <button type="button" class="custom-date-picker__action" data-action="clear">Löschen</button>
            <button type="button" class="custom-date-picker__action" data-action="today">Heute</button>
          </div>
        </div>
      </div>
    `;
  }

  static bind(root = document, signal = null) {
    if (!root) return () => {};
    if (this._boundRoots.has(root)) {
      return this._boundRoots.get(root).cleanup;
    }

    const eventOptions = signal ? { signal } : {};

    const handleClick = (event) => {
      const picker = event.target.closest('[data-custom-datepicker]');

      if (!picker && this._activePicker) {
        this.closeActivePicker();
        return;
      }

      if (!picker) return;

      const input = picker.querySelector('.custom-date-picker__input');
      const popover = picker.querySelector('.custom-date-picker__popover');
      if (!input || !popover) return;

      if (event.target.closest('.custom-date-picker__trigger')) {
        event.preventDefault();
        this.togglePicker(picker);
        return;
      }

      if (event.target.closest('.custom-date-picker__nav--prev')) {
        event.preventDefault();
        this.shiftMonth(picker, -1);
        return;
      }

      if (event.target.closest('.custom-date-picker__nav--next')) {
        event.preventDefault();
        this.shiftMonth(picker, 1);
        return;
      }

      const dayButton = event.target.closest('.custom-date-picker__day');
      if (dayButton) {
        event.preventDefault();
        const isoValue = dayButton.dataset.date;
        this.applyValue(input, isoValue);
        this.closePicker(picker);
        return;
      }

      const actionButton = event.target.closest('.custom-date-picker__action');
      if (actionButton) {
        event.preventDefault();
        const action = actionButton.dataset.action;
        if (action === 'today') {
          const today = new Date();
          const todayIso = this.formatISO(today);
          this.applyValue(input, todayIso);
          popover.dataset.viewMonth = String(today.getMonth());
          popover.dataset.viewYear = String(today.getFullYear());
          popover.dataset.focusedValue = todayIso;
          this.renderCalendar(picker);
        } else if (action === 'clear') {
          this.applyValue(input, '');
          this.closePicker(picker);
        }
      }
    };

    const handleKeydown = (event) => {
      if (!this._activePicker) return;
      const picker = this._activePicker;
      const popover = picker.querySelector('.custom-date-picker__popover');
      const input = picker.querySelector('.custom-date-picker__input');
      if (!popover || !input || popover.hidden) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        this.closePicker(picker);
        return;
      }

      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) return;
      event.preventDefault();

      const currentFocused = this.parseISO(popover.dataset.focusedValue) || this.parseISO(input.dataset.isoValue) || new Date();
      let nextFocused = new Date(currentFocused);

      if (event.key === 'ArrowLeft') nextFocused.setDate(currentFocused.getDate() - 1);
      if (event.key === 'ArrowRight') nextFocused.setDate(currentFocused.getDate() + 1);
      if (event.key === 'ArrowUp') nextFocused.setDate(currentFocused.getDate() - 7);
      if (event.key === 'ArrowDown') nextFocused.setDate(currentFocused.getDate() + 7);

      if (event.key === 'Enter') {
        this.applyValue(input, this.formatISO(currentFocused));
        this.closePicker(picker);
        return;
      }

      const viewMonth = Number(popover.dataset.viewMonth);
      const viewYear = Number(popover.dataset.viewYear);
      if (nextFocused.getMonth() !== viewMonth || nextFocused.getFullYear() !== viewYear) {
        popover.dataset.viewMonth = String(nextFocused.getMonth());
        popover.dataset.viewYear = String(nextFocused.getFullYear());
      }
      popover.dataset.focusedValue = this.formatISO(nextFocused);
      this.renderCalendar(picker);
    };

    root.addEventListener('click', handleClick, eventOptions);
    root.addEventListener('keydown', handleKeydown, eventOptions);

    const cleanup = () => {
      root.removeEventListener('click', handleClick, eventOptions);
      root.removeEventListener('keydown', handleKeydown, eventOptions);
      if (this._activePicker && root.contains(this._activePicker)) {
        this.closeActivePicker();
      }
      this._boundRoots.delete(root);
    };

    this._boundRoots.set(root, { cleanup });
    return cleanup;
  }

  static destroy(root = document) {
    const entry = this._boundRoots.get(root);
    if (entry?.cleanup) {
      entry.cleanup();
    }
  }

  static getValue(input) {
    if (!input) return '';
    return input.dataset.isoValue || '';
  }

  static setValue(input, value) {
    if (!input) return;
    const safeValue = this.normalizeDateValue(value);
    input.dataset.isoValue = safeValue;
    input.value = safeValue;
    this.updatePickerVisualState(input);
  }

  static setDisabled(input, isDisabled) {
    if (!input) return;
    const disabled = Boolean(isDisabled);
    input.disabled = disabled;
    const picker = input.closest('[data-custom-datepicker]');
    const trigger = picker?.querySelector('.custom-date-picker__trigger');
    if (trigger) trigger.disabled = disabled;
  }

  static updatePickerVisualState(input) {
    const picker = input.closest('[data-custom-datepicker]');
    if (!picker) return;
    const trigger = picker.querySelector('.custom-date-picker__trigger');
    const label = input.dataset.label || 'Datum';
    const isoValue = input.dataset.isoValue || '';
    const hasValue = Boolean(isoValue);
    picker.classList.toggle('has-value', hasValue);
    if (trigger) {
      trigger.title = hasValue ? `${label}: ${this.formatDisplayDate(isoValue)}` : `${label} setzen`;
    }
  }

  static togglePicker(picker) {
    const popover = picker?.querySelector('.custom-date-picker__popover');
    if (!popover) return;

    if (this._activePicker && this._activePicker !== picker) {
      this.closePicker(this._activePicker);
    }

    if (!popover.hidden) {
      this.closePicker(picker);
      return;
    }

    this.openPicker(picker);
  }

  static openPicker(picker) {
    const popover = picker?.querySelector('.custom-date-picker__popover');
    const input = picker?.querySelector('.custom-date-picker__input');
    if (!popover || !input || input.disabled) return;

    const selectedDate = this.parseISO(input.dataset.isoValue) || new Date();
    popover.dataset.viewMonth = String(selectedDate.getMonth());
    popover.dataset.viewYear = String(selectedDate.getFullYear());
    popover.dataset.focusedValue = input.dataset.isoValue || this.formatISO(new Date());
    popover.hidden = false;
    picker.classList.add('is-open');
    this._activePicker = picker;
    this.renderCalendar(picker);
  }

  static closePicker(picker) {
    const popover = picker?.querySelector('.custom-date-picker__popover');
    if (!popover) return;
    popover.hidden = true;
    picker.classList.remove('is-open');
    if (this._activePicker === picker) {
      this._activePicker = null;
    }
  }

  static closeActivePicker() {
    if (this._activePicker) {
      this.closePicker(this._activePicker);
    }
  }

  static shiftMonth(picker, delta) {
    const popover = picker?.querySelector('.custom-date-picker__popover');
    if (!popover) return;
    const currentMonth = Number(popover.dataset.viewMonth);
    const currentYear = Number(popover.dataset.viewYear);
    const shifted = new Date(currentYear, currentMonth + delta, 1);
    popover.dataset.viewMonth = String(shifted.getMonth());
    popover.dataset.viewYear = String(shifted.getFullYear());
    this.renderCalendar(picker);
  }

  static renderCalendar(picker) {
    const popover = picker?.querySelector('.custom-date-picker__popover');
    const input = picker?.querySelector('.custom-date-picker__input');
    if (!popover || !input) return;

    const month = Number(popover.dataset.viewMonth);
    const year = Number(popover.dataset.viewYear);
    const daysContainer = popover.querySelector('.custom-date-picker__days');
    const monthLabel = popover.querySelector('.custom-date-picker__month-label');
    if (!daysContainer || !monthLabel) return;

    const selectedValue = input.dataset.isoValue || '';
    const focusedValue = popover.dataset.focusedValue || selectedValue || this.formatISO(new Date());
    const todayValue = this.formatISO(new Date());
    const matrix = this.buildMonthMatrix(year, month);

    monthLabel.textContent = this.capitalizeFirst(MONTH_FORMATTER.format(new Date(year, month, 1)));

    daysContainer.innerHTML = matrix.map(day => {
      const classes = ['custom-date-picker__day'];
      if (!day.isCurrentMonth) classes.push('is-outside-month');
      if (day.iso === selectedValue) classes.push('is-selected');
      if (day.iso === todayValue) classes.push('is-today');
      if (day.iso === focusedValue) classes.push('is-focused');

      return `
        <button type="button" class="${classes.join(' ')}" data-date="${day.iso}" tabindex="-1">
          ${day.date.getDate()}
        </button>
      `;
    }).join('');
  }

  static applyValue(input, isoValue) {
    const normalized = this.normalizeDateValue(isoValue);
    const previous = input.dataset.isoValue || '';
    this.setValue(input, normalized);

    if (previous !== normalized) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  static buildMonthMatrix(year, month) {
    const firstDay = new Date(year, month, 1);
    const firstWeekday = (firstDay.getDay() + 6) % 7; // Montag = 0
    const gridStart = new Date(year, month, 1 - firstWeekday);
    const days = [];

    for (let i = 0; i < 42; i += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      days.push({
        date,
        iso: this.formatISO(date),
        isCurrentMonth: date.getMonth() === month
      });
    }

    return days;
  }

  static parseISO(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  static formatISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static formatDisplayDate(isoValue) {
    const parsed = this.parseISO(isoValue);
    if (!parsed) return '';
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}.${month}.${year}`;
  }

  static normalizeDateValue(dateValue) {
    if (!dateValue) return '';
    const asString = String(dateValue);
    if (/^\d{4}-\d{2}-\d{2}/.test(asString)) {
      return asString.slice(0, 10);
    }
    const parsed = new Date(asString);
    if (Number.isNaN(parsed.getTime())) return '';
    return this.formatISO(parsed);
  }

  static capitalizeFirst(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}

export const customDatePicker = CustomDatePicker;
export default CustomDatePicker;
