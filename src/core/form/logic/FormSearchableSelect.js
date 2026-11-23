// FormSearchableSelect.js
// Kapselt die gesamte Searchable-Select-Logik inkl. Phone-/Country-Fields und allowCreate.
// Wird als Handler in FormSystem instanziert; FormSystem delegiert die öffentlichen Methoden.
// Dropdown-Rendering und allowCreate liegen als Mixins in eigenen Dateien.
import { OptionsManager } from '../data/OptionsManager.js';
import { isPlaceholderOption } from './searchableSelection.js';
import { installSearchableDropdown } from './searchableSelectDropdown.js';
import { installSearchableCreate } from './searchableSelectCreate.js';

export { applySearchableSelection } from './searchableSelection.js';

export class FormSearchableSelect {
  constructor(optionsManager) {
    this.optionsManager = optionsManager;
  }

  // Searchable Selects initialisieren
  initializeSearchableSelects(form) {
    const searchableSelects = form.querySelectorAll('select[data-searchable="true"]');

    searchableSelects.forEach(select => {
      if (select.dataset.phoneField === 'true') {
        return;
      }

      this.createSearchableSelect(select, [], {
        placeholder: select.dataset.placeholder || 'Bitte wählen...',
        type: select.multiple ? 'multiselect' : 'select',
        tagBased: select.dataset.tagBased === 'true'
      });
    });
  }

  // Searchable Select erstellen (Tag-based vs Simple)
  createSearchableSelect(selectElement, options, field) {
    const isTagBased = (field?.type === 'multiselect' || selectElement.multiple) &&
      (field?.tagBased === true || selectElement.dataset.tagBased === 'true');

    if (isTagBased) {
      if (!options || options.length === 0) {
        options = Array.from(selectElement.options)
          .slice(1)
          .map(o => ({
            value: o.value,
            label: o.textContent,
            selected: o.selected || false
          }));

    } else {
      const selectedOptions = options.filter(o => o.selected);
      if (selectedOptions.length > 0) {
      }
    }
      return this.optionsManager.createTagBasedSelect(selectElement, options, field);
    }

    if (!options || options.length === 0) {
      options = Array.from(selectElement.options)
        .slice(1)
        .map(o => ({ value: o.value, label: o.textContent, selected: o.selected }));
    }
    return this.createSimpleSearchableSelect(selectElement, options, field);
  }

  // ISO-Code zu Flag-Emoji konvertieren
  isoToFlagEmoji(isoCode) {
    if (!isoCode || isoCode.length !== 2) return '';
    const codePoints = [...isoCode.toUpperCase()].map(char =>
      0x1F1E6 - 65 + char.charCodeAt(0)
    );
    return String.fromCodePoint(...codePoints);
  }

  // Einfache Auto-Suggestion Select erstellen
  createSimpleSearchableSelect(selectElement, options, field) {
    // Existing container ZUERST inspizieren, dann entfernen. Sonst verlieren
    // wir bei einem Reinit den Hidden-Input-Namen (selectElement.name wird im
    // Erstinit unten via removeAttribute geleert).
    const existingContainer = selectElement.parentNode.querySelector('.searchable-select-container');
    const oldHiddenName = existingContainer?.querySelector('input[type="hidden"]')?.name || '';
    const oldHiddenValue = existingContainer?.querySelector('input[type="hidden"]')?.value || '';
    if (existingContainer) {
      existingContainer.remove();
    }

    const isPhoneField = selectElement.dataset.phoneField === 'true';
    const isCountryField = selectElement.dataset.countryField === 'true';

    const isReadonly = selectElement.getAttribute('data-readonly') === 'true' ||
                       selectElement.disabled ||
                       field.readonly === true;

    const container = document.createElement('div');
    container.className = 'searchable-select-container';

    // Ohne Wert zeigt das Feld das Label der Platzhalter-Option, beim Tippen den Suchhinweis.
    const searchPlaceholder = field.placeholder || 'Suchen...';
    const emptyPlaceholder = options.find(isPlaceholderOption)?.label || searchPlaceholder;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'searchable-select-input' + (isReadonly ? ' is-disabled' : '');
    input.placeholder = emptyPlaceholder;
    input.autocomplete = 'new-password';
    input.setAttribute('data-form-type', 'other');
    input.setAttribute('data-lpignore', 'true');
    input.setAttribute('readonly', 'readonly');

    if (isReadonly) {
      input.setAttribute('disabled', 'true');
      input.setAttribute('data-is-readonly', 'true');
    }

    if (!isReadonly) {
      setTimeout(() => {
        input.removeAttribute('readonly');
      }, 100);
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'searchable-select-dropdown';

    selectElement.style.display = 'none';

    // fieldName robust ableiten: bei Erstinit ist selectElement.name gesetzt,
    // bei Reinit ist es leer. Dann auf dataset.fieldName / alten hidden input /
    // id (FormRenderer setzt id="field-${name}") zurueckfallen.
    const idDerivedName = selectElement.id?.startsWith('field-')
      ? selectElement.id.slice('field-'.length)
      : selectElement.id;
    const fieldName = selectElement.name
      || selectElement.dataset.fieldName
      || oldHiddenName
      || idDerivedName
      || '';
    if (fieldName) {
      selectElement.dataset.fieldName = fieldName;
    }
    if (selectElement.name) {
      selectElement.removeAttribute('name');
    }

    const wasRequired = selectElement.hasAttribute('required');
    if (wasRequired) {
      selectElement.removeAttribute('required');
      input.setAttribute('required', '');
      input.setAttribute('data-was-required', 'true');
    }

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = fieldName;
    hiddenInput.id = selectElement.id + '_value';

    // Wert beim Reinit erhalten: erst selectElement.value, dann alter hidden
    // input, dann (falls prefilled) prefilledValue als finaler Fallback.
    const initialValue = selectElement.value
      || oldHiddenValue
      || (selectElement.dataset.prefilled === 'true' ? (selectElement.dataset.prefilledValue || '') : '');
    if (initialValue) {
      hiddenInput.value = initialValue;
    }

    selectElement.parentNode.insertBefore(container, selectElement);
    container.appendChild(input);
    container.appendChild(dropdown);
    container.appendChild(hiddenInput);

    const selectedOption = options.find(option => option.selected && !isPlaceholderOption(option))
      || (initialValue ? options.find(option => option.value === initialValue) : null);
    if (selectedOption) {
      if (isPhoneField && selectedOption.isoCode) {
        const flagEmoji = this.isoToFlagEmoji(selectedOption.isoCode);
        const vorwahl = selectedOption.vorwahl || '';
        const countryName = selectedOption.label.replace(/^\+\d+\s*/, '').trim();
        input.value = `${flagEmoji} ${vorwahl} ${countryName}`.trim();
      } else if (isCountryField && selectedOption.isoCode) {
        const flagEmoji = this.isoToFlagEmoji(selectedOption.isoCode);
        input.value = `${flagEmoji} ${selectedOption.label}`.trim();
      } else {
        input.value = selectedOption.label;
      }
      Array.from(selectElement.options).forEach(opt => {
        if (opt.value === selectedOption.value) {
          opt.selected = true;
        }
      });
      hiddenInput.value = selectedOption.value;
    }

    const updateDropdownPosition = () => {
      if (isPhoneField && dropdown.classList.contains('show')) {
        const rect = input.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.width = `${rect.width}px`;
      }
    };

    // Phone-Field Window-Listener (scroll/resize) werden via AbortController verwaltet,
    // damit sie auch bei Navigation aufgeraeumt werden falls blur nicht feuert.
    // Der Controller wird in OptionsManager._abortControllers registriert und bei
    // OptionsManager.cleanup() (= _globalCleanup() bei Routenwechsel) aborted.
    let phonePositionAbort = null;
    const detachPhonePositionListeners = () => {
      if (phonePositionAbort) {
        phonePositionAbort.abort();
        const idx = OptionsManager._abortControllers.indexOf(phonePositionAbort);
        if (idx >= 0) OptionsManager._abortControllers.splice(idx, 1);
        phonePositionAbort = null;
      }
    };

    input.addEventListener('focus', async () => {
      if (isReadonly || input.hasAttribute('data-is-readonly')) {
        return;
      }

      dropdown.classList.add('show');

      if (isPhoneField && input.placeholder && input.value === input.placeholder) {
        input.value = '';
      }
      input.placeholder = searchPlaceholder;

      // Steht ein gewählter Wert im Input, öffnet das Dropdown trotzdem mit allen Optionen.
      const query = hiddenInput.value ? '' : input.value;

      input.select();

      if (field?.serverSearch) {
        try {
          const results = await field.serverSearch(query);
          options.length = 0;
          options.push(...results);
        } catch (e) { console.error('serverSearch error:', e); }
      }

      this.updateDropdownItems(dropdown, options, field?.serverSearch ? '' : query, field);

      if (isPhoneField) {
        setTimeout(() => {
          updateDropdownPosition();
          detachPhonePositionListeners();
          phonePositionAbort = new AbortController();
          OptionsManager._abortControllers.push(phonePositionAbort);
          const sig = phonePositionAbort.signal;
          window.addEventListener('scroll', updateDropdownPosition, { capture: true, signal: sig });
          window.addEventListener('resize', updateDropdownPosition, { signal: sig });
        }, 10);
      }
    });

    // Der mouseup nach dem Fokus-Klick würde die Markierung aus dem focus-Handler wieder aufheben.
    let keepSelectionOnMouseUp = false;
    input.addEventListener('mousedown', () => { keepSelectionOnMouseUp = document.activeElement !== input; });
    input.addEventListener('mouseup', (e) => {
      if (keepSelectionOnMouseUp) e.preventDefault();
      keepSelectionOnMouseUp = false;
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.classList.remove('show');
        input.placeholder = emptyPlaceholder;

        if (isPhoneField) {
          detachPhonePositionListeners();
        }
      }, 200);
    });

    let debounceTimer = null;
    input.addEventListener('input', () => {
      if (isReadonly || input.hasAttribute('data-is-readonly')) {
        return;
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (field?.serverSearch) {
          try {
            const results = await field.serverSearch(input.value || '');
            options.length = 0;
            options.push(...results);
          } catch (e) { console.error('serverSearch error:', e); }
          this.updateDropdownItems(dropdown, options, '', field);
        } else {
          this.updateDropdownItems(dropdown, options, input.value, field);
        }
      }, field?.serverSearch ? (field.debounceMs || 250) : 150);

      if (input.hasAttribute('data-was-required')) {
        if (input.value.trim() === '') {
          input.setCustomValidity('Dieses Feld ist erforderlich.');
        } else {
          input.setCustomValidity('');
        }
      }
    });

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();

        const cleanFilterText = input.value.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();

        const exactMatch = options.find(opt =>
          !opt.disabled && opt.label.toLowerCase() === cleanFilterText.toLowerCase()
        );

        if (exactMatch) {
          selectElement.value = exactMatch.value;
          input.value = exactMatch.label;
          if (hiddenInput) {
            hiddenInput.value = exactMatch.value;
          }
          if (input.hasAttribute('data-was-required')) {
            input.setCustomValidity('');
          }
          selectElement.dispatchEvent(new Event('change', { bubbles: true }));
          dropdown.classList.remove('show');
        } else if (field?.allowCreate && cleanFilterText.length > 0) {
          await this.handleCreateNewOption(dropdown, options, cleanFilterText, field);
        }
      }
    });

    if (!field?.serverSearch) {
      this.updateDropdownItems(dropdown, options, '', field);
    }
  }

  // Searchable Select reinitialisieren
  reinitializeSearchableSelect(selectElement, options, field) {
    selectElement.style.display = 'none';
    this.createSearchableSelect(selectElement, options, field);
  }
}

installSearchableDropdown(FormSearchableSelect.prototype);
installSearchableCreate(FormSearchableSelect.prototype);
