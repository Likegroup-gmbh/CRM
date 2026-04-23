// FormSearchableSelect.js
// Kapselt die gesamte Searchable-Select-Logik inkl. Phone-/Country-Fields und allowCreate.
// Wird als Handler in FormSystem instanziert; FormSystem delegiert die öffentlichen Methoden.
export class FormSearchableSelect {
  constructor(optionsManager) {
    this.optionsManager = optionsManager;
  }

  // Searchable Selects initialisieren
  initializeSearchableSelects(form) {
    const searchableSelects = form.querySelectorAll('select[data-searchable="true"]');

    searchableSelects.forEach(select => {
      if (select.dataset.phoneField === 'true') {
        console.log(`⏭️ Überspringe Phone-Field ${select.name} - bereits initialisiert`);
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
        console.log('🔧 FORMSYSTEM: Optionen aus DOM extrahiert für Tag-basiertes Select:', options.filter(o => o.selected));
      } else {
        const selectedOptions = options.filter(o => o.selected);
        if (selectedOptions.length > 0) {
          console.log('🎯 FORMSYSTEM: Übergebe selected Optionen an OptionsManager:', selectedOptions.map(o => o.label));
        }
      }
      return this.optionsManager.createTagBasedSelect(selectElement, options, field);
    }

    if (!options || options.length === 0) {
      options = Array.from(selectElement.options)
        .slice(1)
        .map(o => ({ value: o.value, label: o.textContent }));
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

  // Einfache Auto-Suggestion Select erstellen (Hauptlogik - 200+ Zeilen)
  createSimpleSearchableSelect(selectElement, options, field) {
    const existingContainer = selectElement.parentNode.querySelector('.searchable-select-container');
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

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'searchable-select-input' + (isReadonly ? ' is-disabled' : '');
    input.placeholder = field.placeholder || 'Suchen...';
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
    const wasRequired = selectElement.hasAttribute('required');
    if (wasRequired) {
      selectElement.removeAttribute('required');
      input.setAttribute('required', '');
      input.setAttribute('data-was-required', 'true');
    }

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = selectElement.name;
    hiddenInput.id = selectElement.id + '_value';

    if (selectElement.value) {
      hiddenInput.value = selectElement.value;
    }

    selectElement.parentNode.insertBefore(container, selectElement);
    container.appendChild(input);
    container.appendChild(dropdown);
    container.appendChild(hiddenInput);

    const selectedOption = options.find(option => option.selected);
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
      console.log('✅ FORMSYSTEM: Bestehender Wert gesetzt für', field.name, ':', selectedOption.label);
    }

    const updateDropdownPosition = () => {
      if (isPhoneField && dropdown.classList.contains('show')) {
        const rect = input.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.width = `${rect.width}px`;
      }
    };

    input.addEventListener('focus', () => {
      if (isReadonly || input.hasAttribute('data-is-readonly')) {
        return;
      }

      dropdown.classList.add('show');

      if (isPhoneField && input.placeholder && input.value === input.placeholder) {
        input.value = '';
      }

      this.updateDropdownItems(dropdown, options, input.value, field);

      if (isPhoneField) {
        setTimeout(() => {
          updateDropdownPosition();
          window.addEventListener('scroll', updateDropdownPosition, true);
          window.addEventListener('resize', updateDropdownPosition);
        }, 10);
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.classList.remove('show');

        if (isPhoneField) {
          window.removeEventListener('scroll', updateDropdownPosition, true);
          window.removeEventListener('resize', updateDropdownPosition);
        }
      }, 200);
    });

    input.addEventListener('input', () => {
      if (isReadonly || input.hasAttribute('data-is-readonly')) {
        return;
      }

      this.updateDropdownItems(dropdown, options, input.value, field);

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
          opt.label.toLowerCase() === cleanFilterText.toLowerCase()
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
          console.log(`✅ Existierende Option per Enter ausgewählt: ${exactMatch.label}`);
        } else if (field?.allowCreate && cleanFilterText.length > 0) {
          await this.handleCreateNewOption(dropdown, options, cleanFilterText, field);
        }
      }
    });

    this.updateDropdownItems(dropdown, options, '', field);
  }

  // Dropdown-Items rendern/filtern
  updateDropdownItems(dropdown, options, filterText, field = null) {
    dropdown.innerHTML = '';

    const cleanFilterText = filterText.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();

    const filteredOptions = options.filter(option =>
      option.label.toLowerCase().includes(cleanFilterText.toLowerCase())
    );

    const selectElement = dropdown.parentNode.parentNode.querySelector('select');
    const isPhoneField = selectElement?.dataset?.phoneField === 'true';
    const isCountryField = selectElement?.dataset?.countryField === 'true';

    const exactMatch = options.some(opt =>
      opt.label.toLowerCase() === cleanFilterText.toLowerCase()
    );

    filteredOptions.forEach(option => {
      const item = document.createElement('div');
      item.className = 'searchable-select-item';

      if ((isPhoneField || isCountryField) && option.isoCode) {
        const flagEmoji = this.isoToFlagEmoji(option.isoCode);
        item.textContent = `${flagEmoji} ${option.label}`;
      } else {
        item.textContent = option.label;
      }

      item.addEventListener('click', () => {
        const selectEl = dropdown.parentNode.parentNode.querySelector('select');

        let optionElement = Array.from(selectEl.options).find(opt => opt.value === option.value);
        if (!optionElement) {
          optionElement = document.createElement('option');
          optionElement.value = option.value;
          optionElement.textContent = option.label;
          if (option.isoCode) {
            optionElement.dataset.isoCode = option.isoCode;
          }
          if (option.vorwahl) {
            optionElement.dataset.vorwahl = option.vorwahl;
          }
          selectEl.appendChild(optionElement);
        }

        selectEl.value = option.value;

        const hiddenInput = dropdown.parentNode.querySelector('input[type="hidden"]');
        if (hiddenInput) {
          hiddenInput.value = option.value;
        }

        const input = dropdown.parentNode.querySelector('.searchable-select-input');

        if (isPhoneField && option.isoCode) {
          const flagEmoji = this.isoToFlagEmoji(option.isoCode);
          const vorwahl = option.vorwahl || '';
          const countryName = option.label.replace(/^\+\d+\s*/, '').trim();
          input.value = `${flagEmoji} ${vorwahl} ${countryName}`.trim();
        } else if (isCountryField && option.isoCode) {
          const flagEmoji = this.isoToFlagEmoji(option.isoCode);
          input.value = `${flagEmoji} ${option.label}`.trim();
        } else {
          input.value = option.label;
        }

        if (input.hasAttribute('data-was-required')) {
          input.setCustomValidity('');
        }

        selectEl.dispatchEvent(new Event('change', { bubbles: true }));

        dropdown.classList.remove('show');

        console.log(`✅ Searchable Select ${selectEl.name} aktualisiert: ${option.label} → ${option.value}`);
      });

      item.addEventListener('mouseenter', () => item.classList.add('hover'));
      item.addEventListener('mouseleave', () => item.classList.remove('hover'));

      dropdown.appendChild(item);
    });

    if (field?.allowCreate && cleanFilterText.length > 0 && !exactMatch) {
      const createItem = document.createElement('div');
      createItem.className = 'searchable-select-item create-new';
      createItem.innerHTML = `<span class="create-new-icon">+</span> Neu erstellen: <strong>${cleanFilterText}</strong>`;

      createItem.addEventListener('click', async () => {
        await this.handleCreateNewOption(dropdown, options, cleanFilterText, field);
      });

      createItem.addEventListener('mouseenter', () => createItem.classList.add('hover'));
      createItem.addEventListener('mouseleave', () => createItem.classList.remove('hover'));

      dropdown.appendChild(createItem);
    }
  }

  // Neue Option erstellen und auswählen (allowCreate Feature)
  async handleCreateNewOption(dropdown, options, newValue, field) {
    try {
      const newEntry = await this.createLookupEntry(field.table, field.displayField, newValue);

      const newOption = {
        value: newEntry[field.valueField],
        label: newEntry[field.displayField],
        selected: false
      };

      options.push(newOption);

      const selectElement = dropdown.parentNode.parentNode.querySelector('select');
      const input = dropdown.parentNode.querySelector('.searchable-select-input');
      const hiddenInput = dropdown.parentNode.querySelector('input[type="hidden"]');

      const optionElement = document.createElement('option');
      optionElement.value = newOption.value;
      optionElement.textContent = newOption.label;
      selectElement.appendChild(optionElement);

      selectElement.value = newOption.value;
      input.value = newOption.label;
      if (hiddenInput) {
        hiddenInput.value = newOption.value;
      }

      if (input.hasAttribute('data-was-required')) {
        input.setCustomValidity('');
      }

      selectElement.dispatchEvent(new Event('change', { bubbles: true }));

      dropdown.classList.remove('show');

      if (window.staticDataCache) {
        window.staticDataCache.invalidate(field.table);
        console.log(`🗑️ Cache invalidiert für ${field.table}`);
      }

      console.log(`✅ Neue Option erstellt und ausgewählt: ${newOption.label} → ${newOption.value}`);
    } catch (error) {
      console.error('❌ Fehler beim Erstellen der neuen Option:', error);
      alert(`Fehler beim Erstellen: ${error.message || 'Unbekannter Fehler'}`);
    }
  }

  // Searchable Select reinitialisieren
  reinitializeSearchableSelect(selectElement, options, field) {
    selectElement.style.display = 'none';
    this.createSearchableSelect(selectElement, options, field);
  }

  // Neuen Lookup-Eintrag in DB erstellen (für allowCreate Feature)
  async createLookupEntry(table, displayField, value) {
    console.log(`🆕 Erstelle neuen Eintrag in ${table}: ${value}`);

    try {
      const { data, error } = await window.supabase
        .from(table)
        .insert({ [displayField]: value })
        .select()
        .single();

      if (error) {
        console.error(`❌ Fehler beim Erstellen in ${table}:`, error);
        throw error;
      }

      console.log(`✅ Neuer Eintrag erstellt:`, data);
      return data;
    } catch (err) {
      console.error(`❌ createLookupEntry fehlgeschlagen:`, err);
      throw err;
    }
  }
}
