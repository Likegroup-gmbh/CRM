// searchableSelectDropdown.js
// Dropdown des Searchable-Selects: filtern, gruppieren, lazy rendern (max 50
// initial), Klick auf ein Item. Die Platzhalter-Option erscheint nur ohne
// Suchtext und nur bei gesetztem Wert, dann als Zurücksetzen.

import { escapeHtml } from '../../format.js';
import { applySearchableSelection, isPlaceholderOption } from './searchableSelection.js';

const BATCH_SIZE = 50;

export function installSearchableDropdown(proto) {
  Object.assign(proto, {
    // Dropdown-Items rendern/filtern (DOM-Recycling + Lazy Rendering)
    updateDropdownItems(dropdown, options, filterText, field = null) {
      try { dropdown.parentNode.dataset.options = JSON.stringify(options || []); } catch (_) { }

      const cleanFilterText = filterText.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
      const lowerFilter = cleanFilterText.toLowerCase();
      const hasValue = Boolean(dropdown.parentNode.querySelector('input[type="hidden"]')?.value);

      const filteredOptions = this._filterOptions(options, lowerFilter, hasValue);
      const renderEntries = this._buildRenderEntries(filteredOptions);

      const selectElement = dropdown.parentNode.parentNode.querySelector('select');
      const isPhoneField = selectElement?.dataset?.phoneField === 'true';
      const isCountryField = selectElement?.dataset?.countryField === 'true';

      const exactMatch = options.some(opt =>
        this._optionSearchText(opt).trim() === lowerFilter
      );

      const renderCount = Math.min(renderEntries.length, BATCH_SIZE);

      dropdown.querySelectorAll('.searchable-select-group-header, .searchable-select-item:not(.create-new)').forEach(el => el.remove());

      const fragment = document.createDocumentFragment();
      for (let i = 0; i < renderCount; i++) {
        fragment.appendChild(this._createRenderEntryElement(
          dropdown, renderEntries[i], isPhoneField, isCountryField
        ));
      }
      const createNew = dropdown.querySelector('.create-new');
      if (createNew) {
        dropdown.insertBefore(fragment, createNew);
      } else {
        dropdown.appendChild(fragment);
      }

      dropdown._lazyRenderEntries = renderEntries.length > BATCH_SIZE ? renderEntries : null;
      dropdown._lazyOffset = renderCount;
      dropdown._isPhoneField = isPhoneField;
      dropdown._isCountryField = isCountryField;

      if (renderEntries.length > BATCH_SIZE) {
        if (!dropdown._scrollHandler) {
          dropdown._scrollHandler = () => this._loadMoreItems(dropdown);
          dropdown.addEventListener('scroll', dropdown._scrollHandler, { passive: true });
        }
      } else {
        dropdown._lazyRenderEntries = null;
        dropdown._lazyOffset = 0;
      }

      dropdown.querySelectorAll('.create-new').forEach(el => el.remove());

      if (field?.allowCreate && cleanFilterText.length > 0 && !exactMatch) {
        const createItem = document.createElement('div');
        createItem.className = 'searchable-select-item create-new';
        createItem.innerHTML = `<span class="create-new-icon">+</span> Neu erstellen: <strong>${escapeHtml(cleanFilterText)}</strong>`;

        createItem.addEventListener('click', async () => {
          await this.handleCreateNewOption(dropdown, options, cleanFilterText, field);
        });

        createItem.addEventListener('mouseenter', () => createItem.classList.add('hover'));
        createItem.addEventListener('mouseleave', () => createItem.classList.remove('hover'));

        dropdown.appendChild(createItem);
      }
    },

    _optionSearchText(option) {
      return [option.label, option.subtitle, option.group].filter(Boolean).join(' ').toLowerCase();
    },

    _filterOptions(options, lowerFilter, hasValue = false) {
      return options.filter(option => {
        if (isPlaceholderOption(option)) return hasValue && !lowerFilter;
        return !lowerFilter || this._optionSearchText(option).includes(lowerFilter);
      });
    },

    _buildRenderEntries(filteredOptions) {
      const entries = [];
      let lastGroup = null;

      filteredOptions.forEach(option => {
        const group = option.group || null;
        if (group && group !== lastGroup) {
          entries.push({ type: 'header', group });
          lastGroup = group;
        } else if (!group) {
          lastGroup = null;
        }
        entries.push({ type: 'item', option });
      });

      return entries;
    },

    _createRenderEntryElement(dropdown, entry, isPhoneField, isCountryField) {
      if (entry.type === 'header') {
        const header = document.createElement('div');
        header.className = 'searchable-select-group-header';
        header.textContent = entry.group;
        return header;
      }

      const item = document.createElement('div');
      item.className = 'searchable-select-item';
      if (isPlaceholderOption(entry.option)) item.classList.add('is-placeholder');
      this._fillItemContent(item, entry.option, isPhoneField, isCountryField);
      if (entry.option?.disabled) {
        item.classList.add('is-disabled');
        if (entry.option.disabledReason) item.title = entry.option.disabledReason;
        return item;
      }
      item.onclick = () => this._selectOption(dropdown, entry.option, isPhoneField, isCountryField);
      item.onmouseenter = () => item.classList.add('hover');
      item.onmouseleave = () => item.classList.remove('hover');
      return item;
    },

    _fillItemContent(item, option, isPhoneField, isCountryField) {
      if ((isPhoneField || isCountryField) && option.isoCode) {
        item.textContent = `${this.isoToFlagEmoji(option.isoCode)} ${option.label}`;
        return;
      }

      if (option.subtitle) {
        item.innerHTML = `
          <div class="searchable-select-item-label">${escapeHtml(option.label)}</div>
          <div class="searchable-select-item-subtitle">${escapeHtml(option.subtitle)}</div>
        `;
      } else {
        item.textContent = option.label;
      }
    },

    // Weitere Items beim Scrollen nachladen
    _loadMoreItems(dropdown) {
      if (!dropdown._lazyRenderEntries) return;
      const { scrollTop, scrollHeight, clientHeight } = dropdown;
      if (scrollTop + clientHeight < scrollHeight - 40) return;

      const entries = dropdown._lazyRenderEntries;
      const offset = dropdown._lazyOffset;
      if (offset >= entries.length) return;

      const end = Math.min(offset + BATCH_SIZE, entries.length);
      const isPhoneField = dropdown._isPhoneField;
      const isCountryField = dropdown._isCountryField;

      const fragment = document.createDocumentFragment();
      for (let i = offset; i < end; i++) {
        fragment.appendChild(this._createRenderEntryElement(
          dropdown, entries[i], isPhoneField, isCountryField
        ));
      }

      const createNew = dropdown.querySelector('.create-new');
      if (createNew) {
        dropdown.insertBefore(fragment, createNew);
      } else {
        dropdown.appendChild(fragment);
      }

      dropdown._lazyOffset = end;
    },

    // Click-Handler für Dropdown-Item
    _selectOption(dropdown, option, isPhoneField, isCountryField) {
      const selectEl = dropdown.parentNode.parentNode.querySelector('select');
      let label = option.label;
      if (isPlaceholderOption(option)) {
        label = '';
      } else if (isPhoneField && option.isoCode) {
        const vorwahl = option.vorwahl || '';
        const countryName = option.label.replace(/^\+\d+\s*/, '').trim();
        label = `${this.isoToFlagEmoji(option.isoCode)} ${vorwahl} ${countryName}`.trim();
      } else if (isCountryField && option.isoCode) {
        label = `${this.isoToFlagEmoji(option.isoCode)} ${option.label}`.trim();
      }

      applySearchableSelection(selectEl, {
        value: isPlaceholderOption(option) ? '' : option.value,
        label,
        optionLabel: option.label,
        dataset: {
          isoCode: option.isoCode,
          vorwahl: option.vorwahl
        }
      });
      dropdown.classList.remove('show');
    }
  });
}
