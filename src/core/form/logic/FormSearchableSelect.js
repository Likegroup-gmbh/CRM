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

  // Einfache Auto-Suggestion Select erstellen
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
    }

    const updateDropdownPosition = () => {
      if (isPhoneField && dropdown.classList.contains('show')) {
        const rect = input.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.width = `${rect.width}px`;
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

      if (field?.serverSearch) {
        try {
          const results = await field.serverSearch(input.value || '');
          options.length = 0;
          options.push(...results);
        } catch (e) { console.error('serverSearch error:', e); }
      }

      this.updateDropdownItems(dropdown, options, field?.serverSearch ? '' : input.value, field);

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
        } else if (field?.allowCreate && cleanFilterText.length > 0) {
          await this.handleCreateNewOption(dropdown, options, cleanFilterText, field);
        }
      }
    });

    if (!field?.serverSearch) {
      this.updateDropdownItems(dropdown, options, '', field);
    }
  }

  // Dropdown-Items rendern/filtern (DOM-Recycling + Lazy Rendering: max 50 initial)
  updateDropdownItems(dropdown, options, filterText, field = null) {
    try { dropdown.parentNode.dataset.options = JSON.stringify(options || []); } catch (_) { }

    const cleanFilterText = filterText.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
    const lowerFilter = cleanFilterText.toLowerCase();

    const filteredOptions = options.filter(option =>
      option.label.toLowerCase().includes(lowerFilter)
    );

    const selectElement = dropdown.parentNode.parentNode.querySelector('select');
    const isPhoneField = selectElement?.dataset?.phoneField === 'true';
    const isCountryField = selectElement?.dataset?.countryField === 'true';

    const exactMatch = options.some(opt =>
      opt.label.toLowerCase() === lowerFilter
    );

    const BATCH_SIZE = 50;
    const renderCount = Math.min(filteredOptions.length, BATCH_SIZE);

    // DOM-Recycling: bestehende Items wiederverwenden statt innerHTML-Nuke
    const existingItems = Array.from(dropdown.querySelectorAll('.searchable-select-item:not(.create-new)'));
    let itemIndex = 0;

    for (let i = 0; i < renderCount; i++) {
      const option = filteredOptions[i];
      let item;

      if (itemIndex < existingItems.length) {
        item = existingItems[itemIndex];
        item.style.display = '';
      } else {
        item = document.createElement('div');
        item.className = 'searchable-select-item';
        const createNew = dropdown.querySelector('.create-new');
        if (createNew) {
          dropdown.insertBefore(item, createNew);
        } else {
          dropdown.appendChild(item);
        }
      }

      if ((isPhoneField || isCountryField) && option.isoCode) {
        item.textContent = `${this.isoToFlagEmoji(option.isoCode)} ${option.label}`;
      } else {
        item.textContent = option.label;
      }

      item.onclick = () => this._selectOption(dropdown, option, isPhoneField, isCountryField);
      item.onmouseenter = () => item.classList.add('hover');
      item.onmouseleave = () => item.classList.remove('hover');

      itemIndex++;
    }

    // Überschüssige Items entfernen
    for (let i = itemIndex; i < existingItems.length; i++) {
      existingItems[i].remove();
    }

    // Bestehende create-new Items entfernen
    dropdown.querySelectorAll('.create-new').forEach(el => el.remove());

    // Lazy Rendering: Scroll-Nachladen für Listen > BATCH_SIZE
    if (filteredOptions.length > BATCH_SIZE) {
      dropdown._lazyOptions = filteredOptions;
      dropdown._lazyOffset = BATCH_SIZE;
      dropdown._isPhoneField = isPhoneField;
      dropdown._isCountryField = isCountryField;

      if (!dropdown._scrollHandler) {
        dropdown._scrollHandler = () => this._loadMoreItems(dropdown);
        dropdown.addEventListener('scroll', dropdown._scrollHandler, { passive: true });
      }
    } else {
      dropdown._lazyOptions = null;
      dropdown._lazyOffset = 0;
    }

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

  // Weitere Items beim Scrollen nachladen
  _loadMoreItems(dropdown) {
    if (!dropdown._lazyOptions) return;
    const { scrollTop, scrollHeight, clientHeight } = dropdown;
    if (scrollTop + clientHeight < scrollHeight - 40) return;

    const BATCH_SIZE = 50;
    const options = dropdown._lazyOptions;
    const offset = dropdown._lazyOffset;
    if (offset >= options.length) return;

    const end = Math.min(offset + BATCH_SIZE, options.length);
    const isPhoneField = dropdown._isPhoneField;
    const isCountryField = dropdown._isCountryField;

    const fragment = document.createDocumentFragment();
    for (let i = offset; i < end; i++) {
      const option = options[i];
      const item = document.createElement('div');
      item.className = 'searchable-select-item';

      if ((isPhoneField || isCountryField) && option.isoCode) {
        item.textContent = `${this.isoToFlagEmoji(option.isoCode)} ${option.label}`;
      } else {
        item.textContent = option.label;
      }

      item.onclick = () => this._selectOption(dropdown, option, isPhoneField, isCountryField);
      item.onmouseenter = () => item.classList.add('hover');
      item.onmouseleave = () => item.classList.remove('hover');

      fragment.appendChild(item);
    }

    const createNew = dropdown.querySelector('.create-new');
    if (createNew) {
      dropdown.insertBefore(fragment, createNew);
    } else {
      dropdown.appendChild(fragment);
    }

    dropdown._lazyOffset = end;
  }

  // Click-Handler für Dropdown-Item
  _selectOption(dropdown, option, isPhoneField, isCountryField) {
    const selectEl = dropdown.parentNode.parentNode.querySelector('select');

    let optionElement = Array.from(selectEl.options).find(opt => opt.value === option.value);
    if (!optionElement) {
      optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      if (option.isoCode) optionElement.dataset.isoCode = option.isoCode;
      if (option.vorwahl) optionElement.dataset.vorwahl = option.vorwahl;
      selectEl.appendChild(optionElement);
    }

    selectEl.value = option.value;

    const hiddenInput = dropdown.parentNode.querySelector('input[type="hidden"]');
    if (hiddenInput) hiddenInput.value = option.value;

    const input = dropdown.parentNode.querySelector('.searchable-select-input');

    if (isPhoneField && option.isoCode) {
      const flagEmoji = this.isoToFlagEmoji(option.isoCode);
      const vorwahl = option.vorwahl || '';
      const countryName = option.label.replace(/^\+\d+\s*/, '').trim();
      input.value = `${flagEmoji} ${vorwahl} ${countryName}`.trim();
    } else if (isCountryField && option.isoCode) {
      input.value = `${this.isoToFlagEmoji(option.isoCode)} ${option.label}`.trim();
    } else {
      input.value = option.label;
    }

    if (input.hasAttribute('data-was-required')) input.setCustomValidity('');

    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    dropdown.classList.remove('show');
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
      }

    } catch (error) {
      console.error('Fehler beim Erstellen der neuen Option:', error);
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
    try {
      const { data, error } = await window.supabase
        .from(table)
        .insert({ [displayField]: value })
        .select()
        .single();

      if (error) {
        console.error(`Fehler beim Erstellen in ${table}:`, error);
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`createLookupEntry fehlgeschlagen:`, err);
      throw err;
    }
  }
}
