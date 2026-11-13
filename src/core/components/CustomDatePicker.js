import { icon } from '../icons/IconSystem.js';
// CustomDatePicker.js
// Wiederverwendbarer Datepicker mit eigener Popover-UI (ohne natives input[type="date"] Popup)

const WEEKDAY_LABELS = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const MONTH_SHORT_FORMATTER = new Intl.DateTimeFormat('de-DE', { month: 'short' });
const YEAR_PAGE_SIZE = 12;

export class CustomDatePicker {
  static _boundRoots = new WeakMap();
  static _activePicker = null;

  static render({
    id,
    field,
    dateField,
    value = '',
    label = 'Datum',
    inputClass = '',
    entity = '',
    variant = 'button',
    inputId = '',
    required = false,
    min = '',
    max = '',
    yearSelect = false,
    showToday = true
  } = {}) {
    const safeValue = this.normalizeDateValue(value);
    const safeMin = this.normalizeDateValue(min);
    const safeMax = this.normalizeDateValue(max);
    const viewDate = this.parseISO(safeValue)
      || this.parseISO(this.clampISO(this.formatISO(new Date()), safeMin, safeMax));
    const hasValueClass = safeValue ? 'has-value' : '';
    const pickerAttrs = [
      safeMin ? `data-min="${safeMin}"` : '',
      safeMax ? `data-max="${safeMax}"` : '',
      yearSelect ? 'data-year-select="true"' : ''
    ].filter(Boolean).join(' ');
    const dataAttrs = `
              data-id="${id || ''}"
              data-field="${field || ''}"
              data-date-field="${dateField || ''}"
              ${entity ? `data-entity="${entity}"` : ''}
              data-previous-value="${safeValue}"
              data-iso-value="${safeValue}"
              data-label="${label}"
              aria-label="${label}"`;
    const popover = this.renderPopover({ viewDate, value: safeValue, yearSelect, showToday });

    if (variant === 'native') {
      const classes = ['custom-date-picker__input', inputClass].filter(Boolean).join(' ');
      return `
        <div class="custom-date-picker custom-date-picker--native ${hasValueClass}" data-custom-datepicker data-variant="native" ${pickerAttrs}>
          <div class="custom-date-picker__control">
            <input
              type="date"
              ${inputId ? `id="${inputId}"` : ''}
              class="${classes}"
              ${dataAttrs}
              value="${safeValue}"
              title="${label}"
              autocomplete="off"
              ${required ? 'required' : ''}
            >
          </div>
          ${popover}
        </div>
      `;
    }

    const triggerTitle = safeValue ? `${label}: ${this.formatDisplayDate(safeValue)}` : `${label} setzen`;
    const trigger = `
          <button type="button" class="custom-date-picker__trigger" aria-label="Kalender öffnen" title="${triggerTitle}">
            ${icon('calendar-days')}
          </button>`;

    if (variant === 'text') {
      const classes = ['custom-date-picker__input', inputClass].filter(Boolean).join(' ');
      return `
        <div class="custom-date-picker custom-date-picker--text ${hasValueClass}" data-custom-datepicker data-variant="text" ${pickerAttrs}>
          <div class="custom-date-picker__control">
            <input
              type="text"
              ${inputId ? `id="${inputId}"` : ''}
              class="${classes}"
              ${dataAttrs}
              value="${this.formatDisplayDate(safeValue)}"
              placeholder="TT.MM.JJJJ"
              inputmode="numeric"
              maxlength="10"
              autocomplete="off"
              ${required ? 'required' : ''}
            >
            ${trigger}
          </div>
          ${popover}
        </div>
      `;
    }

    const classes = ['custom-date-picker__input', 'custom-date-picker__value', inputClass].filter(Boolean).join(' ');

    return `
      <div class="custom-date-picker ${hasValueClass}" data-custom-datepicker ${pickerAttrs}>
        <div class="custom-date-picker__control">
          <input
            type="text"
            class="${classes}"
            ${dataAttrs}
            value="${safeValue}"
            title="${label}"
            readonly
            autocomplete="off"
            tabindex="-1"
            aria-hidden="true"
          >
          ${trigger}
        </div>
        ${popover}
      </div>
    `;
  }

  static renderPopover({ viewDate, value, yearSelect, showToday }) {
    const monthLabel = this.capitalizeFirst(MONTH_FORMATTER.format(viewDate));
    const labelHtml = yearSelect
      ? `<button type="button" class="custom-date-picker__month-label custom-date-picker__month-label--button" aria-label="Monat und Jahr wählen">${monthLabel}</button>`
      : `<div class="custom-date-picker__month-label">${monthLabel}</div>`;

    return `
      <div
        class="custom-date-picker__popover"
        data-view="days"
        data-view-month="${viewDate.getMonth()}"
        data-view-year="${viewDate.getFullYear()}"
        data-focused-value="${value || this.formatISO(viewDate)}"
        hidden
      >
        <div class="custom-date-picker__header">
          <button type="button" class="custom-date-picker__nav custom-date-picker__nav--prev" aria-label="Zurück">‹</button>
          ${labelHtml}
          <button type="button" class="custom-date-picker__nav custom-date-picker__nav--next" aria-label="Weiter">›</button>
        </div>
        <div class="custom-date-picker__weekdays">
          ${WEEKDAY_LABELS.map(day => `<span>${day}</span>`).join('')}
        </div>
        <div class="custom-date-picker__days" role="grid"></div>
        ${yearSelect ? '<div class="custom-date-picker__grid" hidden></div>' : ''}
        <div class="custom-date-picker__footer">
          <button type="button" class="custom-date-picker__action" data-action="clear">Löschen</button>
          ${showToday ? '<button type="button" class="custom-date-picker__action" data-action="today">Heute</button>' : ''}
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

      if (picker.dataset.variant === 'native' && event.target.closest('.custom-date-picker__input')) {
        event.preventDefault();
        this.togglePicker(picker);
        return;
      }

      const navButton = event.target.closest('.custom-date-picker__nav');
      if (navButton) {
        event.preventDefault();
        if (navButton.disabled) return;
        this.shiftView(picker, navButton.classList.contains('custom-date-picker__nav--prev') ? -1 : 1);
        return;
      }

      if (event.target.closest('.custom-date-picker__month-label--button')) {
        event.preventDefault();
        this.toggleYearView(picker);
        return;
      }

      const gridItem = event.target.closest('.custom-date-picker__grid-item');
      if (gridItem) {
        event.preventDefault();
        if (gridItem.disabled) return;
        if (gridItem.dataset.year) {
          popover.dataset.viewYear = gridItem.dataset.year;
          popover.dataset.view = 'months';
        } else if (gridItem.dataset.month) {
          popover.dataset.viewMonth = gridItem.dataset.month;
          popover.dataset.view = 'days';
          const { min, max } = this.getRange(picker);
          const firstOfMonth = this.formatISO(new Date(Number(popover.dataset.viewYear), Number(gridItem.dataset.month), 1));
          popover.dataset.focusedValue = this.clampISO(firstOfMonth, min, max);
        }
        this.renderCalendar(picker);
        return;
      }

      const dayButton = event.target.closest('.custom-date-picker__day');
      if (dayButton) {
        event.preventDefault();
        if (dayButton.disabled) return;
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
          const { min, max } = this.getRange(picker);
          if (!this.isInRange(todayIso, min, max)) return;
          this.applyValue(input, todayIso);
          popover.dataset.view = 'days';
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

      if ((popover.dataset.view || 'days') !== 'days') return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) return;
      // Im Textfeld bewegen die Pfeiltasten den Cursor, nicht den Kalender.
      if (event.target === input && picker.dataset.variant === 'text' && event.key !== 'Enter') return;
      event.preventDefault();

      const { min, max } = this.getRange(picker);
      const currentFocused = this.parseISO(popover.dataset.focusedValue) || this.parseISO(input.dataset.isoValue) || new Date();
      let nextFocused = new Date(currentFocused);

      if (event.key === 'ArrowLeft') nextFocused.setDate(currentFocused.getDate() - 1);
      if (event.key === 'ArrowRight') nextFocused.setDate(currentFocused.getDate() + 1);
      if (event.key === 'ArrowUp') nextFocused.setDate(currentFocused.getDate() - 7);
      if (event.key === 'ArrowDown') nextFocused.setDate(currentFocused.getDate() + 7);

      if (event.key === 'Enter') {
        const focusedIso = this.formatISO(currentFocused);
        if (!this.isInRange(focusedIso, min, max)) return;
        this.applyValue(input, focusedIso);
        this.closePicker(picker);
        return;
      }

      nextFocused = this.parseISO(this.clampISO(this.formatISO(nextFocused), min, max));

      const viewMonth = Number(popover.dataset.viewMonth);
      const viewYear = Number(popover.dataset.viewYear);
      if (nextFocused.getMonth() !== viewMonth || nextFocused.getFullYear() !== viewYear) {
        popover.dataset.viewMonth = String(nextFocused.getMonth());
        popover.dataset.viewYear = String(nextFocused.getFullYear());
      }
      popover.dataset.focusedValue = this.formatISO(nextFocused);
      this.renderCalendar(picker);
    };

    const handleNativeMousedown = (event) => {
      const picker = event.target.closest('[data-custom-datepicker][data-variant="native"]');
      if (!picker) return;
      const input = picker.querySelector('.custom-date-picker__input');
      if (event.target === input || event.target.closest('.custom-date-picker__control')?.contains(input)) {
        event.preventDefault();
      }
    };

    const handleTextInput = (event) => {
      const input = this.getTextVariantInput(event.target);
      if (!input) return;
      const picker = input.closest('[data-custom-datepicker]');

      if (event.inputType === 'insertText') {
        if (event.data === '.' && input.value.endsWith('..')) {
          input.value = input.value.slice(0, -1);
        } else if (/^\d{2}$|^\d{1,2}\.\d{2}$/.test(input.value)) {
          input.value += '.';
        }
      }

      const iso = this.parseDisplayDate(input.value, this.getRange(picker));
      input.dataset.isoValue = iso;
      input.classList.remove('is-invalid');
      this.updatePickerVisualState(input);

      if (iso && this._activePicker === picker) {
        const popover = picker.querySelector('.custom-date-picker__popover');
        const date = this.parseISO(iso);
        popover.dataset.view = 'days';
        popover.dataset.viewMonth = String(date.getMonth());
        popover.dataset.viewYear = String(date.getFullYear());
        popover.dataset.focusedValue = iso;
        this.renderCalendar(picker);
      }
    };

    const handleTextFocusout = (event) => {
      const input = this.getTextVariantInput(event.target);
      if (!input) return;
      const text = input.value.trim();
      if (!text) {
        input.dataset.isoValue = '';
        input.classList.remove('is-invalid');
        this.updatePickerVisualState(input);
        return;
      }
      const iso = this.parseDisplayDate(text, this.getRange(input.closest('[data-custom-datepicker]')));
      if (iso) {
        input.value = this.formatDisplayDate(iso);
        input.classList.remove('is-invalid');
      } else {
        input.classList.add('is-invalid');
      }
    };

    root.addEventListener('mousedown', handleNativeMousedown, eventOptions);
    root.addEventListener('click', handleClick, eventOptions);
    root.addEventListener('keydown', handleKeydown, eventOptions);
    root.addEventListener('input', handleTextInput, eventOptions);
    root.addEventListener('focusout', handleTextFocusout, eventOptions);

    const cleanup = () => {
      root.removeEventListener('mousedown', handleNativeMousedown, eventOptions);
      root.removeEventListener('click', handleClick, eventOptions);
      root.removeEventListener('keydown', handleKeydown, eventOptions);
      root.removeEventListener('input', handleTextInput, eventOptions);
      root.removeEventListener('focusout', handleTextFocusout, eventOptions);
      const picker = this._activePicker;
      if (picker && (root.contains(picker) || !picker.isConnected)) {
        this.closeActivePicker();
      }
      this._boundRoots.delete(root);
    };

    this._boundRoots.set(root, { cleanup });
    if (signal) {
      signal.addEventListener('abort', () => {
        if (this._boundRoots.get(root)?.cleanup === cleanup) cleanup();
      }, { once: true });
    }
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
    input.value = this.isTextVariant(input) ? this.formatDisplayDate(safeValue) : safeValue;
    input.classList.remove('is-invalid');
    this.updatePickerVisualState(input);
  }

  static isTextVariant(input) {
    return input?.closest?.('[data-custom-datepicker]')?.dataset.variant === 'text';
  }

  static getTextVariantInput(target) {
    if (!target?.classList?.contains('custom-date-picker__input')) return null;
    return this.isTextVariant(target) ? target : null;
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

    const { min, max } = this.getRange(picker);
    const selectedIso = input.dataset.isoValue || '';
    const baseIso = selectedIso || this.clampISO(this.formatISO(new Date()), min, max);
    const baseDate = this.parseISO(baseIso) || new Date();
    popover.dataset.viewMonth = String(baseDate.getMonth());
    popover.dataset.viewYear = String(baseDate.getFullYear());
    popover.dataset.focusedValue = baseIso;

    // Ohne Wert startet die Jahresauswahl direkt im Jahresraster (z. B. Geburtsdatum).
    const startInYears = picker.dataset.yearSelect === 'true' && !selectedIso;
    popover.dataset.view = startInYears ? 'years' : 'days';
    if (startInYears) {
      popover.dataset.yearPageStart = String(this.getYearPageStart(baseDate.getFullYear(), min, max));
    }

    popover.hidden = false;
    picker.classList.add('is-open');
    this._activePicker = picker;
    this.renderCalendar(picker);

    // Fixed positioning, damit der Popover aus overflow:hidden Containern ausbricht
    // und je nach verfuegbarem Platz nach oben oder unten oeffnet (wie ActionsDropdown).
    this.positionPopover(picker);

    if (this._outsideClickHandler) {
      document.removeEventListener('mousedown', this._outsideClickHandler, true);
    }
    this._outsideClickHandler = (e) => {
      if (!picker.contains(e.target)) {
        this.closePicker(picker);
      }
    };
    document.addEventListener('mousedown', this._outsideClickHandler, true);
  }

  static positionPopover(picker) {
    const popover = picker?.querySelector('.custom-date-picker__popover');
    const anchor = picker?.dataset.variant === 'text'
      ? picker.querySelector('.custom-date-picker__control')
      : picker?.querySelector('.custom-date-picker__trigger') || picker?.querySelector('.custom-date-picker__input');
    if (!popover || !anchor) return;

    const triggerRect = anchor.getBoundingClientRect();
    const popoverHeight = popover.offsetHeight || 280;
    const popoverWidth = popover.offsetWidth || 248;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - triggerRect.bottom;
    const needsFlip = spaceBelow < popoverHeight && triggerRect.top > popoverHeight;

    popover.classList.add('custom-date-picker__popover--fixed');

    if (needsFlip) {
      popover.style.top = 'auto';
      popover.style.bottom = (viewportHeight - triggerRect.top + 4) + 'px';
    } else {
      popover.style.top = (triggerRect.bottom + 4) + 'px';
      popover.style.bottom = 'auto';
    }

    // Horizontal am Trigger ausrichten, aber im Viewport halten (8px Puffer rechts).
    let left = triggerRect.left;
    if (left + popoverWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - popoverWidth - 8);
    }
    popover.style.left = left + 'px';
  }

  static closePicker(picker) {
    const popover = picker?.querySelector('.custom-date-picker__popover');
    if (!popover) return;
    popover.hidden = true;
    popover.classList.remove('custom-date-picker__popover--fixed');
    popover.style.top = '';
    popover.style.bottom = '';
    popover.style.left = '';
    picker.classList.remove('is-open');
    if (this._activePicker === picker) {
      this._activePicker = null;
    }
    if (this._outsideClickHandler) {
      document.removeEventListener('mousedown', this._outsideClickHandler, true);
      this._outsideClickHandler = null;
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

  static shiftView(picker, direction) {
    const popover = picker?.querySelector('.custom-date-picker__popover');
    if (!popover) return;
    const view = popover.dataset.view || 'days';

    if (view === 'years') {
      popover.dataset.yearPageStart = String(Number(popover.dataset.yearPageStart) + direction * YEAR_PAGE_SIZE);
      this.renderCalendar(picker);
      return;
    }

    if (view === 'months') {
      popover.dataset.viewYear = String(Number(popover.dataset.viewYear) + direction);
      this.renderCalendar(picker);
      return;
    }

    this.shiftMonth(picker, direction);
  }

  static toggleYearView(picker) {
    const popover = picker?.querySelector('.custom-date-picker__popover');
    if (!popover) return;

    if (popover.dataset.view === 'years') {
      popover.dataset.view = 'days';
    } else {
      const { min, max } = this.getRange(picker);
      popover.dataset.view = 'years';
      popover.dataset.yearPageStart = String(this.getYearPageStart(Number(popover.dataset.viewYear), min, max));
    }
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

    const grid = popover.querySelector('.custom-date-picker__grid');
    const weekdays = popover.querySelector('.custom-date-picker__weekdays');
    const view = grid ? (popover.dataset.view || 'days') : 'days';
    const { min, max } = this.getRange(picker);
    const selectedValue = input.dataset.isoValue || '';

    daysContainer.hidden = view !== 'days';
    if (weekdays) weekdays.hidden = view !== 'days';
    if (grid) grid.hidden = view === 'days';

    if (view === 'years') {
      const pageStart = Number(popover.dataset.yearPageStart);
      monthLabel.textContent = `${pageStart} – ${pageStart + YEAR_PAGE_SIZE - 1}`;
      grid.innerHTML = this.renderYearItems(pageStart, selectedValue, min, max);
    } else if (view === 'months') {
      monthLabel.textContent = String(year);
      grid.innerHTML = this.renderMonthItems(year, selectedValue, min, max);
    } else {
      const focusedValue = popover.dataset.focusedValue || selectedValue || this.formatISO(new Date());
      const todayValue = this.formatISO(new Date());
      const matrix = this.buildMonthMatrix(year, month);

      monthLabel.textContent = this.capitalizeFirst(MONTH_FORMATTER.format(new Date(year, month, 1)));

      daysContainer.innerHTML = matrix.map(day => {
        const classes = ['custom-date-picker__day'];
        const disabled = !this.isInRange(day.iso, min, max);
        if (!day.isCurrentMonth) classes.push('is-outside-month');
        if (day.iso === selectedValue) classes.push('is-selected');
        if (day.iso === todayValue) classes.push('is-today');
        if (day.iso === focusedValue) classes.push('is-focused');
        if (disabled) classes.push('is-disabled');

        return `
          <button type="button" class="${classes.join(' ')}" data-date="${day.iso}" tabindex="-1"${disabled ? ' disabled' : ''}>
            ${day.date.getDate()}
          </button>
        `;
      }).join('');
    }

    this.updateNavState(popover, view, { year, month, min, max });

    if (popover.classList.contains('custom-date-picker__popover--fixed')) {
      this.positionPopover(picker);
    }
  }

  static renderYearItems(pageStart, selectedValue, min, max) {
    const selectedYear = selectedValue ? Number(selectedValue.slice(0, 4)) : null;
    const currentYear = new Date().getFullYear();
    const minYear = min ? Number(min.slice(0, 4)) : null;
    const maxYear = max ? Number(max.slice(0, 4)) : null;

    return Array.from({ length: YEAR_PAGE_SIZE }, (_, i) => {
      const y = pageStart + i;
      const disabled = (minYear !== null && y < minYear) || (maxYear !== null && y > maxYear);
      const classes = ['custom-date-picker__grid-item'];
      if (y === selectedYear) classes.push('is-selected');
      if (y === currentYear) classes.push('is-today');
      if (disabled) classes.push('is-disabled');
      return `<button type="button" class="${classes.join(' ')}" data-year="${y}"${disabled ? ' disabled' : ''}>${y}</button>`;
    }).join('');
  }

  static renderMonthItems(year, selectedValue, min, max) {
    const selected = this.parseISO(selectedValue);
    const today = new Date();

    return Array.from({ length: 12 }, (_, m) => {
      const firstIso = this.formatISO(new Date(year, m, 1));
      const lastIso = this.formatISO(new Date(year, m + 1, 0));
      const disabled = (min && lastIso < min) || (max && firstIso > max);
      const classes = ['custom-date-picker__grid-item'];
      if (selected && selected.getFullYear() === year && selected.getMonth() === m) classes.push('is-selected');
      if (today.getFullYear() === year && today.getMonth() === m) classes.push('is-today');
      if (disabled) classes.push('is-disabled');
      const label = this.capitalizeFirst(MONTH_SHORT_FORMATTER.format(new Date(year, m, 1)));
      return `<button type="button" class="${classes.join(' ')}" data-month="${m}"${disabled ? ' disabled' : ''}>${label}</button>`;
    }).join('');
  }

  static updateNavState(popover, view, { year, month, min, max }) {
    const prev = popover.querySelector('.custom-date-picker__nav--prev');
    const next = popover.querySelector('.custom-date-picker__nav--next');
    if (!prev || !next) return;

    const minDate = this.parseISO(min);
    const maxDate = this.parseISO(max);
    let prevDisabled = false;
    let nextDisabled = false;

    if (view === 'years') {
      const pageStart = Number(popover.dataset.yearPageStart);
      prevDisabled = Boolean(minDate) && pageStart <= minDate.getFullYear();
      nextDisabled = Boolean(maxDate) && pageStart + YEAR_PAGE_SIZE - 1 >= maxDate.getFullYear();
    } else if (view === 'months') {
      prevDisabled = Boolean(minDate) && year <= minDate.getFullYear();
      nextDisabled = Boolean(maxDate) && year >= maxDate.getFullYear();
    } else {
      const current = year * 12 + month;
      prevDisabled = Boolean(minDate) && current <= minDate.getFullYear() * 12 + minDate.getMonth();
      nextDisabled = Boolean(maxDate) && current >= maxDate.getFullYear() * 12 + maxDate.getMonth();
    }

    prev.disabled = prevDisabled;
    next.disabled = nextDisabled;
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

  static getRange(picker) {
    return {
      min: picker?.dataset?.min || '',
      max: picker?.dataset?.max || ''
    };
  }

  static isInRange(isoValue, min = '', max = '') {
    if (!isoValue) return false;
    return (!min || isoValue >= min) && (!max || isoValue <= max);
  }

  static clampISO(isoValue, min = '', max = '') {
    if (min && isoValue < min) return min;
    if (max && isoValue > max) return max;
    return isoValue;
  }

  // Seiten im 12er-Raster; am Rand des erlaubten Bereichs wird die Seite bündig an min/max geschoben.
  static getYearPageStart(year, min = '', max = '') {
    let start = year - (((year % YEAR_PAGE_SIZE) + YEAR_PAGE_SIZE) % YEAR_PAGE_SIZE);
    const minYear = min ? Number(min.slice(0, 4)) : null;
    const maxYear = max ? Number(max.slice(0, 4)) : null;
    if (maxYear !== null && start + YEAR_PAGE_SIZE - 1 > maxYear) start = maxYear - YEAR_PAGE_SIZE + 1;
    if (minYear !== null && start < minYear) start = minYear;
    return start;
  }

  /**
   * Getippte Eingabe in ISO umwandeln. Akzeptiert TT.MM.JJJJ, T.M.JJJJ, TTMMJJJJ und JJJJ-MM-TT.
   * @returns {string} ISO-Datum oder '' bei ungültigem Datum bzw. außerhalb von min/max.
   */
  static parseDisplayDate(text, { min = '', max = '' } = {}) {
    const value = String(text ?? '').trim();
    let day;
    let month;
    let year;
    let match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/) || value.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (match) {
      [, day, month, year] = match.map(Number);
    } else if ((match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
      [, year, month, day] = match.map(Number);
    } else {
      return '';
    }

    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';

    const iso = this.formatISO(date);
    return this.isInRange(iso, min, max) ? iso : '';
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
