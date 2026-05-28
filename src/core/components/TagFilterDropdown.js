// TagFilterDropdown.js
// Multi-Select Tag-Filter Dropdown (clientseitig, analog SortDropdown-Pattern)

export class TagFilterDropdown {
  constructor() {
    this.instances = new Map();
    this._abortController = null;
  }

  init(entityType, containerElement, options = {}) {
    if (!containerElement) return;

    const config = {
      tags: options.tags || [],
      selectedTags: options.selectedTags || [],
      onTagsChange: options.onTagsChange || (() => {}),
      placeholder: options.placeholder || 'Tags filtern'
    };

    const existing = this.instances.get(entityType);
    const selectedTags = existing?.selectedTags ?? config.selectedTags;

    this.instances.set(entityType, { containerElement, config, selectedTags });
    containerElement.innerHTML = this._renderDropdown(entityType);

    if (!this._abortController) {
      this._bindGlobalEvents();
    }
  }

  updateTags(entityType, tags) {
    const instance = this.instances.get(entityType);
    if (!instance) return;
    instance.config.tags = tags || [];
    instance.selectedTags = instance.selectedTags.filter(t => tags.includes(t));
    instance.containerElement.innerHTML = this._renderDropdown(entityType);
  }

  getSelectedTags(entityType) {
    return this.instances.get(entityType)?.selectedTags || [];
  }

  _renderDropdown(entityType) {
    const instance = this.instances.get(entityType);
    if (!instance) return '';
    const { config, selectedTags } = instance;
    const tags = config.tags || [];

    if (tags.length === 0) return '';

    const hasActive = selectedTags.length > 0;
    const label = hasActive ? `${selectedTags.length} Tag${selectedTags.length > 1 ? 's' : ''}` : config.placeholder;

    return `
      <div class="tag-filter-dropdown" data-tag-entity="${entityType}">
        <button class="tag-filter-toggle secondary-btn${hasActive ? ' tag-filter-active' : ''}" aria-expanded="false">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          <span class="tag-filter-label">${label}</span>
          <svg class="tag-filter-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div class="tag-filter-menu">
          ${hasActive ? `<button class="tag-filter-reset" data-tag-entity="${entityType}">Alle zurücksetzen</button>` : ''}
          ${tags.map(tag => `
            <label class="tag-filter-option">
              <input type="checkbox" value="${this._escAttr(tag)}" ${selectedTags.includes(tag) ? 'checked' : ''}>
              <span>${this._escHtml(tag)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }

  _bindGlobalEvents() {
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('.tag-filter-toggle');
      if (toggle) {
        e.preventDefault();
        e.stopPropagation();
        this._toggleMenu(toggle);
        return;
      }

      const reset = e.target.closest('.tag-filter-reset');
      if (reset) {
        e.preventDefault();
        e.stopPropagation();
        const entityType = reset.dataset.tagEntity;
        this._resetTags(entityType);
        return;
      }

      if (e.target.closest('.tag-filter-menu')) return;

      this._closeAll();
    }, { signal });

    document.addEventListener('change', (e) => {
      const checkbox = e.target.closest('.tag-filter-option input[type="checkbox"]');
      if (!checkbox) return;
      const dropdown = checkbox.closest('.tag-filter-dropdown');
      if (!dropdown) return;
      const entityType = dropdown.dataset.tagEntity;
      this._onCheckboxChange(entityType, checkbox.value, checkbox.checked);
    }, { signal });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._closeAll();
    }, { signal });
  }

  _toggleMenu(toggleButton) {
    const dropdown = toggleButton.closest('.tag-filter-dropdown');
    const menu = dropdown?.querySelector('.tag-filter-menu');
    const isOpen = menu?.classList.contains('show');

    this._closeAll();

    if (!isOpen && menu) {
      menu.classList.add('show');
      toggleButton.setAttribute('aria-expanded', 'true');
    }
  }

  _closeAll() {
    document.querySelectorAll('.tag-filter-menu.show').forEach(m => m.classList.remove('show'));
    document.querySelectorAll('.tag-filter-toggle').forEach(t => t.setAttribute('aria-expanded', 'false'));
  }

  _onCheckboxChange(entityType, tagValue, isChecked) {
    const instance = this.instances.get(entityType);
    if (!instance) return;

    if (isChecked) {
      if (!instance.selectedTags.includes(tagValue)) instance.selectedTags.push(tagValue);
    } else {
      instance.selectedTags = instance.selectedTags.filter(t => t !== tagValue);
    }

    this._updateToggleLabel(entityType);
    instance.config.onTagsChange(instance.selectedTags);
  }

  _resetTags(entityType) {
    const instance = this.instances.get(entityType);
    if (!instance) return;

    instance.selectedTags = [];
    this._closeAll();
    instance.containerElement.innerHTML = this._renderDropdown(entityType);
    instance.config.onTagsChange([]);
  }

  _updateToggleLabel(entityType) {
    const instance = this.instances.get(entityType);
    if (!instance) return;
    const dropdown = instance.containerElement.querySelector('.tag-filter-dropdown');
    if (!dropdown) return;

    const label = dropdown.querySelector('.tag-filter-label');
    const toggle = dropdown.querySelector('.tag-filter-toggle');
    const hasActive = instance.selectedTags.length > 0;

    if (label) {
      label.textContent = hasActive
        ? `${instance.selectedTags.length} Tag${instance.selectedTags.length > 1 ? 's' : ''}`
        : instance.config.placeholder;
    }
    toggle?.classList.toggle('tag-filter-active', hasActive);

    const menu = dropdown.querySelector('.tag-filter-menu');
    const existingReset = menu?.querySelector('.tag-filter-reset');
    if (hasActive && !existingReset && menu) {
      menu.insertAdjacentHTML('afterbegin',
        `<button class="tag-filter-reset" data-tag-entity="${entityType}">Alle zurücksetzen</button>`);
    } else if (!hasActive && existingReset) {
      existingReset.remove();
    }
  }

  destroy(entityType = null) {
    if (entityType) {
      this.instances.delete(entityType);
      if (this.instances.size === 0) {
        this._abortController?.abort();
        this._abortController = null;
      }
    } else {
      this.instances.clear();
      this._abortController?.abort();
      this._abortController = null;
    }
  }

  _escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  _escAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const tagFilterDropdown = new TagFilterDropdown();
export default tagFilterDropdown;
