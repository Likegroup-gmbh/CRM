// CreatorList.js (ES6-Modul)
// Creator-Liste mit neuem Filtersystem - Performance-optimiert
// Basiert auf BasePaginatedList

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { sortDropdown } from '../../core/components/SortDropdown.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { creatorUtils } from './CreatorUtils.js';

export class CreatorList extends BasePaginatedList {
  constructor() {
    super('creator', {
      itemsPerPage: 25,
      headline: 'Creator Übersicht',
      breadcrumbLabel: 'Creator',
      sortField: 'nachname',
      sortAscending: true,
      paginationContainerId: 'pagination-container-creator',
      tbodySelector: '.data-table tbody',
      tableColspan: 14, // Mit Admin-Checkbox
      checkboxClass: 'creator-check',
      selectAllId: 'select-all-creators'
    });
    
    // Zusätzliche Creator-spezifische Properties
    this.selectedCreator = this.selectedItems; // Alias für Kompatibilität
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // IMPLEMENTIERUNG DER ABSTRAKTEN METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Lädt die Creator-Daten für eine Seite
   */
  async loadPageData(page, limit, filters) {
    const result = await window.dataService.loadEntitiesWithPagination(
      'creator',
      filters,
      page,
      limit
    );
    
    return {
      data: result.data || [],
      total: result.total || 0
    };
  }
  
  /**
   * Rendert eine einzelne Creator-Zeile
   */
  renderSingleRow(creator) {
    const isAdmin = this.isAdmin;
    const sanitize = this.sanitize.bind(this);
    
    const externalLinkIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="external-link-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>`;
    
    const formatLink = (url) => {
      if (!url) return '-';
      const safeUrl = window.validatorSystem?.sanitizeUrl(url);
      if (!safeUrl) return '-';
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="table-link-external" title="${sanitize(url)}">${externalLinkIcon}</a>`;
    };
    
    return `
      <tr data-id="${creator.id}">
        ${isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="creator-check" data-id="${creator.id}"></td>` : ''}
        <td class="col-name col-name-with-icon">
          <span class="table-avatar">${(creator.vorname || '?')[0].toUpperCase()}</span>
          <a href="#" class="table-link" data-table="creator" data-id="${creator.id}">
            ${sanitize(`${creator.vorname || ''} ${creator.nachname || ''}`.trim() || '-')}
          </a>
        </td>
        <td>${this.renderLocationTag(creator.lieferadresse_stadt, 'stadt')}</td>
        <td>${this.renderLocationTag(creator.lieferadresse_land, 'land')}</td>
        <td>${creator.mail ? `<a href="mailto:${sanitize(creator.mail)}">${sanitize(creator.mail)}</a>` : '-'}</td>
        <td>${sanitize(creator.telefonnummer || '-')}</td>
        <td>${this.formatAgeRange(creator.alter_min, creator.alter_max, creator.alter_jahre)}</td>
        <td>${this.renderCreatorTypeTags(creator.creator_types)}</td>
        <td>${this.renderBrancheTags(creator.branchen)}</td>
        <td>${formatLink(creator.instagram)}</td>
        <td>${creatorUtils.formatFollowerRange(creator.instagram_follower)}</td>
        <td>${formatLink(creator.tiktok)}</td>
        <td>${creatorUtils.formatFollowerRange(creator.tiktok_follower)}</td>
        <td class="col-actions">
          ${actionBuilder.create('creator', creator.id)}
        </td>
      </tr>
    `;
  }
  
  /**
   * Rendert den Shell-Content (Struktur ohne Daten)
   */
  renderShellContent() {
    const canEdit = this.canEdit;
    const isAdmin = this.isAdmin;
    
    const filterHtml = `<div class="filter-bar">
      <div class="filter-left">
        ${SearchInput.render('creator', { 
          placeholder: 'Creator suchen...', 
          currentValue: this.searchQuery 
        })}
        <div id="sort-dropdown-container"></div>
        <div id="filter-dropdown-container"></div>
      </div>
    </div>`;
    
    return `
      <div class="table-filter-wrapper">
        ${filterHtml}
        <div class="table-actions">
          ${isAdmin ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>` : ''}
          ${canEdit ? '<button id="btn-creator-new" class="primary-btn">Neuen Creator anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${isAdmin ? `<th class="col-checkbox"><input type="checkbox" id="select-all-creators"></th>` : ''}
              <th class="col-name">Name</th>
              <th>Stadt</th>
              <th>Land</th>
              <th>E-Mail</th>
              <th>Telefon</th>
              <th>Alter</th>
              <th>Typ</th>
              <th>Branche</th>
              <th>Insta-Link</th>
              <th>Insta-Follower</th>
              <th>TikTok-Link</th>
              <th>TikTok-Follower</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${isAdmin ? '14' : '13'}" class="no-data">Lade Creator...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination Container -->
      <div class="pagination-container" id="pagination-container-creator"></div>
    `;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // ÜBERSCHRIEBENE METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Initialisiert die Filter-Bar mit Creator-spezifischen Einstellungen
   */
  async initializeFilterBar() {
    // Sort-Dropdown initialisieren
    const sortContainer = document.getElementById('sort-dropdown-container');
    if (sortContainer) {
      sortDropdown.init('creator', sortContainer, {
        nameField: 'nachname',
        defaultSort: 'name_asc',
        onSortChange: (sortConfig) => this.onSortChange(sortConfig)
      });
    }
    
    // Filter-Dropdown initialisieren
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('creator', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }
  
  /**
   * Zusätzliche Events binden (Suche, Creator-New Button)
   */
  bindAdditionalEvents(signal) {
    // Suchfeld Events über globale Komponente
    SearchInput.bind('creator', (value) => this.handleSearch(value), signal);
    
    // Neuen Creator anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-creator-new') {
        e.preventDefault();
        window.navigateTo('/creator/new');
      }
    }, { signal });
    
    // Delete Selected Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-delete-selected') {
        e.preventDefault();
        this.showDeleteSelectedConfirmation();
      }
    }, { signal });
  }
  
  /**
   * Baut die Filter für Creator inkl. Suche
   */
  buildFilters() {
    const filters = super.buildFilters();
    
    // Suchbegriff als name-Filter hinzufügen (sucht in vorname UND nachname)
    if (this.searchQuery && this.searchQuery.trim().length > 0) {
      filters.name = this.searchQuery.trim();
    }
    
    return filters;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // CREATOR-SPEZIFISCHE METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  // Generische Tag-Render-Methode
  _renderTags(items, tagClass) {
    if (!items || items.length === 0) return '-';
    const arr = Array.isArray(items) ? items : [items];
    const sanitize = this.sanitize.bind(this);
    const tags = arr.map(item => {
      const label = typeof item === 'object' ? (item.name || item.label || item) : item;
      return `<span class="tag ${tagClass}">${sanitize(String(label).trim())}</span>`;
    }).join('');
    return `<div class="tags tags-compact">${tags}</div>`;
  }

  renderSprachenTags(sprachen) {
    return this._renderTags(sprachen, 'tag--lang');
  }

  renderBrancheTags(branchen) {
    return this._renderTags(branchen, 'tag--branche');
  }

  renderCreatorTypeTags(typen) {
    return this._renderTags(typen, 'tag--type');
  }

  renderLocationTag(value, type) {
    if (!value || (typeof value === 'string' && !value.trim())) return '-';
    const sanitized = this.sanitize(value);
    return `<span class="tag tag--${type}">${sanitized}</span>`;
  }

  formatAgeRange(min, max, legacy) {
    // Fallback auf altes alter_jahre Feld
    if (!min && !max && legacy) {
      return `${legacy}`;
    }
    if (!min && !max) return '-';
    if (min && max && min !== max) {
      return `${min}-${max}`;
    }
    return `${min || max}`;
  }
  
  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = filterSystem.getFilters('creator');
    return Object.keys(filters).length > 0;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // BULK DELETE
  // ══════════════════════════════════════════════════════════════════════════
  
  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedItems.size;
    if (selectedCount === 0) {
      alert('Keine Creator ausgewählt.');
      return;
    }

    const message = selectedCount === 1 
      ? 'Möchten Sie den ausgewählten Creator wirklich löschen?' 
      : `Möchten Sie die ${selectedCount} ausgewählten Creator wirklich löschen?`;

    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({ title: 'Löschvorgang bestätigen', message, confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true });
      if (res?.confirmed) this.deleteSelectedCreators();
    } else {
      const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
      if (confirmed) this.deleteSelectedCreators();
    }
  }

  async deleteSelectedCreators() {
    const selectedIds = Array.from(this.selectedItems);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Creator...`);
    
    // Optimistisches UI-Update: Zeilen ausblenden
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      const result = await window.dataService.deleteEntities('creator', selectedIds);
      
      if (result.success) {
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} Creator erfolgreich gelöscht.`);
        
        this.deselectAll();
        
        const tbody = document.querySelector('.data-table tbody');
        if (tbody && tbody.children.length === 0) {
          await this.loadData();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'creator', action: 'bulk-deleted', count: result.deletedCount }
        }));
      } else {
        throw new Error(result.error || 'Löschen fehlgeschlagen');
      }
    } catch (error) {
      selectedIds.forEach(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) row.style.opacity = '1';
      });
      
      console.error('❌ Fehler beim Löschen:', error);
      alert(`❌ Fehler beim Löschen: ${error.message}`);
      
      await this.loadData();
    }
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // CREATE FORM (für Routing)
  // ══════════════════════════════════════════════════════════════════════════
  
  showCreateForm() {
    console.log('🎯 Zeige Creator-Erstellungsformular');
    window.setHeadline('Neuen Creator anlegen');
    
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Creator', url: '/creator', clickable: true },
        { label: 'Neuer Creator', url: '/creator/new', clickable: false }
      ]);
    }
    
    const formHtml = window.formSystem.renderFormOnly('creator');
    window.content.innerHTML = `
      <div class="form-split-container">
        <div class="form-split-left">
          <div class="form-page">
            ${formHtml}
          </div>
        </div>
        <div class="form-split-right hidden" id="creator-split-container">
          <div id="creator-embedded-form"></div>
        </div>
      </div>
    `;

    window.formSystem.bindFormEvents('creator', null);
    
    const form = document.getElementById('creator-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
      
      this.setupDuplicateValidation(form);
    }
  }

  setupDuplicateValidation(form) {
    const vornameField = form.querySelector('#vorname, input[name="vorname"]');
    const nachnameField = form.querySelector('#nachname, input[name="nachname"]');
    
    if (!vornameField || !nachnameField) {
      console.warn('⚠️ CREATORLIST: Vorname- oder Nachname-Feld nicht gefunden');
      return;
    }

    let messageContainer = nachnameField.parentElement.querySelector('.duplicate-message-container');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.className = 'duplicate-message-container';
      nachnameField.parentElement.appendChild(messageContainer);
    }

    [vornameField, nachnameField].forEach(field => {
      field.addEventListener('blur', async () => {
        const vorname = vornameField.value.trim();
        const nachname = nachnameField.value.trim();
        
        if (vorname && nachname) {
          await this.validateCreatorDuplicate(vorname, nachname, messageContainer);
        } else {
          this.clearDuplicateMessages(messageContainer);
        }
      });

      field.addEventListener('input', () => {
        this.clearDuplicateMessages(messageContainer);
        this.enableSubmitButton();
      });
    });
  }

  async validateCreatorDuplicate(vorname, nachname, messageContainer) {
    if (!vorname || !nachname || vorname.trim().length < 1 || nachname.trim().length < 1) {
      this.clearDuplicateMessages(messageContainer);
      return;
    }

    if (!window.duplicateChecker) {
      console.warn('⚠️ CREATORLIST: DuplicateChecker nicht verfügbar');
      return;
    }

    try {
      const result = await window.duplicateChecker.checkCreator(vorname, nachname, null);

      if (result.exact) {
        this.showDuplicateError(messageContainer, result.similar);
        this.disableSubmitButton(true);
      } else if (result.similar.length > 0) {
        this.showDuplicateWarning(messageContainer, result.similar);
        this.enableSubmitButton();
      } else {
        this.clearDuplicateMessages(messageContainer);
        this.enableSubmitButton();
      }
    } catch (error) {
      console.error('❌ CREATORLIST: Fehler bei Duplikat-Validierung:', error);
    }
  }

  showDuplicateError(container, entries) {
    const sanitize = this.sanitize.bind(this);
    const sanitizeImgUrl = (url) => window.validatorSystem?.sanitizeUrl(url);
    
    container.innerHTML = `
      <div class="duplicate-error">
        <strong>Dieser Creator existiert bereits!</strong>
        ${entries.length > 0 ? `
          <ul class="duplicate-list">
            ${entries.map(entry => {
              const safeImgUrl = entry.profilbild_url ? sanitizeImgUrl(entry.profilbild_url) : null;
              return `
              <li class="duplicate-list-item">
                <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${sanitize(entry.id)}">
                  ${safeImgUrl ? `<img src="${safeImgUrl}" alt="${sanitize(entry.vorname)} ${sanitize(entry.nachname)}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                  <span class="duplicate-name">${sanitize(entry.vorname)} ${sanitize(entry.nachname)}${entry.instagram ? ` <span class="duplicate-meta">(@${sanitize(entry.instagram)})</span>` : ''}</span>
                </a>
              </li>
            `;}).join('')}
          </ul>
        ` : ''}
      </div>
    `;
    
    this.bindDuplicateLinks(container, 'creator');
  }

  showDuplicateWarning(container, entries) {
    const sanitize = this.sanitize.bind(this);
    const sanitizeImgUrl = (url) => window.validatorSystem?.sanitizeUrl(url);
    
    container.innerHTML = `
      <div class="duplicate-warning">
        <strong>Folgende ähnliche Einträge gefunden:</strong>
        <ul class="duplicate-list">
          ${entries.map(entry => {
            const safeImgUrl = entry.profilbild_url ? sanitizeImgUrl(entry.profilbild_url) : null;
            return `
            <li class="duplicate-list-item">
              <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${sanitize(entry.id)}">
                ${safeImgUrl ? `<img src="${safeImgUrl}" alt="${sanitize(entry.vorname)} ${sanitize(entry.nachname)}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                <span class="duplicate-name">${sanitize(entry.vorname)} ${sanitize(entry.nachname)}${entry.instagram ? ` <span class="duplicate-meta">(@${sanitize(entry.instagram)})</span>` : ''}</span>
              </a>
            </li>
          `;}).join('')}
        </ul>
      </div>
    `;
    
    this.bindDuplicateLinks(container, 'creator');
  }

  bindDuplicateLinks(container, entityType) {
    const links = container.querySelectorAll('.duplicate-link[data-entity-id]');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.entityId;
        if (id) {
          const route = `/${entityType}/${id}`;
          if (window.navigationSystem) {
            window.navigationSystem.navigateTo(route);
          }
        }
      });
    });
  }

  clearDuplicateMessages(container) {
    if (container) {
      container.innerHTML = '';
    }
  }

  disableSubmitButton(disable) {
    const form = document.getElementById('creator-form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = disable;
        if (disable) {
          submitBtn.style.opacity = '0.5';
          submitBtn.style.cursor = 'not-allowed';
        }
      }
    }
  }

  enableSubmitButton() {
    const form = document.getElementById('creator-form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
    }
  }

  async handleFormSubmit() {
    const btn = document.querySelector('.mdc-btn.mdc-btn--create');
    
    if (btn?.dataset.locked === 'true') return;
    if (btn) {
      btn.dataset.locked = 'true';
      btn.classList.add('is-loading');
      const labelEl = btn.querySelector('.mdc-btn__label');
      if (labelEl) labelEl.textContent = 'Wird angelegt…';
    }

    try {
      const form = document.getElementById('creator-form');
      const formData = new FormData(form);
      const submitData = {};

      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      tagBasedSelects.forEach(select => {
        const fieldName = select.name;
        
        let hiddenSelect = form.querySelector(`select[name="${fieldName}[]"][style*="display: none"]`);
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${fieldName}"][style*="display: none"]`);
        }
        
        if (!hiddenSelect) {
          const tagContainer = form.querySelector(`select[name="${fieldName}"]`)?.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            const tags = tagContainer.querySelectorAll('.tag[data-value]');
            const tagValues = Array.from(tags).map(tag => tag.dataset.value).filter(Boolean);
            if (tagValues.length > 0) {
              submitData[fieldName] = tagValues;
              return;
            }
          }
        }
        
        if (hiddenSelect) {
          const values = Array.from(hiddenSelect.selectedOptions).map(opt => opt.value).filter(Boolean);
          if (values.length > 0) {
            submitData[fieldName] = values;
          }
        }
      });

      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) {
            submitData[cleanKey] = [];
          }
          submitData[cleanKey].push(value);
        } else {
          if (!submitData.hasOwnProperty(key) || !Array.isArray(submitData[key])) {
            submitData[key] = value;
          }
        }
      }

      for (const [key, value] of Object.entries(submitData)) {
        if (Array.isArray(value)) {
          submitData[key] = [...new Set(value)];
        }
      }

      const validation = window.validatorSystem.validateForm(submitData, {
        vorname: { type: 'text', minLength: 2, required: true },
        nachname: { type: 'text', minLength: 2, required: true },
        mail: { type: 'email' },
        telefonnummer: { type: 'phone' },
        portfolio_link: { type: 'url' }
      });
      
      if (!validation.isValid) {
        if (btn) {
          btn.dataset.locked = 'false';
          btn.classList.remove('is-loading');
          const labelEl = btn.querySelector('.mdc-btn__label');
          if (labelEl) labelEl.textContent = 'Anlegen';
        }
        this.showValidationErrors(validation.errors);
        return;
      }

      const result = await window.dataService.createEntity('creator', submitData);

      if (result.success) {
        if (btn) {
          btn.classList.remove('is-loading');
          btn.classList.add('is-success');
          const labelEl = btn.querySelector('.mdc-btn__label');
          if (labelEl) labelEl.textContent = 'Creator angelegt';
        }
        
        this.showSuccessMessage('Creator erfolgreich erstellt!');
        
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'creator', id: result.id, action: 'created' } 
        }));
        
        setTimeout(() => {
          window.navigateTo('/creator');
        }, 800);
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }

    } catch (error) {
      if (btn) {
        btn.dataset.locked = 'false';
        btn.classList.remove('is-loading');
        const labelEl = btn.querySelector('.mdc-btn__label');
        if (labelEl) labelEl.textContent = 'Anlegen';
      }
      console.error('❌ Formular-Submit Fehler:', error);
      this.showErrorMessage(error.message);
    }
  }

  showValidationErrors(errors) {
    document.querySelectorAll('.field-error').forEach(el => el.remove());

    Object.entries(errors).forEach(([field, message]) => {
      const fieldElement = document.querySelector(`[name="${field}"]`);
      if (fieldElement) {
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        fieldElement.parentNode.appendChild(errorElement);
      }
    });
  }

  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.textContent = message;
    
    const form = document.getElementById('creator-form');
    if (form) {
      form.parentNode.insertBefore(successDiv, form);
    }
  }

  showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.textContent = message;
    
    const form = document.getElementById('creator-form');
    if (form) {
      form.parentNode.insertBefore(errorDiv, form);
    }
  }
}

// Exportiere Instanz für globale Nutzung
export const creatorList = new CreatorList();
