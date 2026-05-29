// CreatorDetailEvents.js
// Event-Handler und UI-Interaktionen fuer CreatorDetail (Prototype-Mixin)

import { CreatorDetail } from './CreatorDetailCore.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';

CreatorDetail.prototype.bindEvents = function() {
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    this.bindSidebarTabs();

    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-button')) {
        e.preventDefault();
        this.switchTab(e.target.dataset.tab);
      }
    }, { signal });

    document.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('.table-link');
      if (!link) return;
      if (link.dataset.table === 'unternehmen') {
        e.preventDefault();
        window.navigateTo(`/unternehmen/${link.dataset.id}`);
      }
    }, { signal });

    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-edit-creator' || e.target.closest('#btn-edit-creator')) {
        e.preventDefault();
        this.showEditForm();
      }
    }, { signal });

    document.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-kampagne-id')) {
        e.preventDefault();
        const kampagneId = e.target.getAttribute('data-kampagne-id');
        window.navigateTo(`/kampagne/${kampagneId}`);
      }
    }, { signal });

    document.addEventListener('click', (e) => {
      const addBtn = e.target.closest && e.target.closest('#btn-management-zuordnen');
      if (addBtn) {
        e.preventDefault();
        this._showAddManagementDialog();
        return;
      }
      const removeBtn = e.target.closest && e.target.closest('[data-remove-management]');
      if (removeBtn) {
        e.preventDefault();
        this._removeManagementFromCreator(removeBtn.getAttribute('data-remove-management'));
      }
    }, { signal });

    window.addEventListener('entityUpdated', async (e) => {
      if (this._destroyed) return;
      if (e.detail?.entity === 'creator_adressen' && e.detail?.creatorId === this.creatorId) {
        console.log('🔄 CREATORDETAIL: Creator-Adressen aktualisiert, lade Daten neu');
        tabDataCache.invalidate('creator', this.creatorId);
        await this.loadCriticalData();
        if (this._destroyed) return;
        
        const adresseTab = document.getElementById('tab-adresse');
        if (adresseTab) {
          adresseTab.innerHTML = this.renderAdresseContent();
          console.log('✅ CREATORDETAIL: Adresse-Tab erfolgreich aktualisiert');
        }
      }
    }, { signal });

    window.addEventListener('softRefresh', async (e) => {
      if (this._destroyed) return;
      const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
      if (hasActiveForm) {
        console.log('⏸️ CREATORDETAIL: Formular aktiv - Soft-Refresh übersprungen');
        return;
      }
      if (!this.creatorId || !location.pathname.includes('/creator/')) {
        return;
      }
      console.log('🔄 CREATORDETAIL: Soft-Refresh - lade Daten neu');
      tabDataCache.invalidate('creator', this.creatorId);
      await this.loadCriticalData();
      if (this._destroyed) return;
      this.render();
    }, { signal });
};

CreatorDetail.prototype.switchTab = async function(tabName) {
    console.log('🔄 CREATORDETAIL: Wechsle zu Tab:', tabName);
    
    this.activeMainTab = tabName;
    
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activePane = document.getElementById(`tab-${tabName}`);
    
    if (activeButton && activePane) {
      activeButton.classList.add('active');
      activePane.classList.add('active');
      
      if (!['adresse'].includes(tabName)) {
        await this.loadTabData(tabName);
      }
    }
};

CreatorDetail.prototype.showEditForm = async function() {
    console.log('🎯 CREATORDETAIL: Zeige Creator-Bearbeitungsformular für ID:', this.creatorId);
    window.setHeadline('Creator bearbeiten');

    // Immer frisch laden, damit Re-Edit den aktuellen Stand zeigt
    await this.loadManagements();
    
    const intToFollowerRange = (value) => {
      if (!value) return null;
      const ranges = [
        { max: 2500, range: '0-2500' },
        { max: 5000, range: '2500-5000' },
        { max: 10000, range: '5000-10000' },
        { max: 25000, range: '10000-25000' },
        { max: 50000, range: '25000-50000' },
        { max: 100000, range: '50000-100000' },
        { max: 250000, range: '100000-250000' },
        { max: 500000, range: '250000-500000' },
        { max: 1000000, range: '500000-1000000' },
        { max: Infinity, range: '1000000+' }
      ];
      for (const r of ranges) {
        if (value <= r.max) return r.range;
      }
      return '1000000+';
    };
    
    const editData = {
      ...this.creator,
      _isEditMode: true,
      _entityId: this.creatorId,
      instagram_follower: intToFollowerRange(this.creator.instagram_follower),
      tiktok_follower: intToFollowerRange(this.creator.tiktok_follower),
      sprachen_ids: this.creator.sprachen ? this.creator.sprachen.map(s => s.id) : [],
      branche_ids: this.creator.branchen ? this.creator.branchen.map(b => b.id) : [],
      creator_type_ids: this.creator.creator_types ? this.creator.creator_types.map(t => t.id) : [],
      management_ids: this.managements && this.managements.length > 0 ? this.managements.map(m => m.id) : []
    };
    
    console.log('📋 CREATORDETAIL: Edit-Daten vorbereitet:', {
      sprachen_ids: editData.sprachen_ids,
      branche_ids: editData.branche_ids,
      creator_type_ids: editData.creator_type_ids,
      management_ids: editData.management_ids
    });
    
    const formHtml = window.formSystem.renderFormOnly('creator', editData);
    window.setContentSafely(window.content, `
      <div class="form-page">
        ${formHtml}
      </div>
    `);

    window.formSystem.bindFormEvents('creator', editData);
    
    const form = document.getElementById('creator-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
    }
};

CreatorDetail.prototype.handleEditFormSubmit = async function() {
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
              console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Tags gesammelt:`, tagValues);
              return;
            }
          }
        }
        
        if (hiddenSelect) {
          const values = Array.from(hiddenSelect.selectedOptions).map(opt => opt.value).filter(Boolean);
          if (values.length > 0) {
            submitData[fieldName] = values;
            console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Hidden-Select gesammelt:`, values);
          }
        } else {
          console.warn(`⚠️ Kein Hidden-Select oder Tags für ${fieldName} gefunden`);
        }
      });

      for (const [key, value] of formData.entries()) {
        if (submitData.hasOwnProperty(key) && Array.isArray(submitData[key])) {
          continue;
        }
        if (key.includes('[]')) {
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) {
            submitData[cleanKey] = [];
          }
          submitData[cleanKey].push(value);
        } else {
          submitData[key] = value;
        }
      }

      const toggleInputs = form.querySelectorAll('input[type="checkbox"][name]');
      toggleInputs.forEach(input => {
        submitData[input.name] = input.checked;
      });

      // management_ids autoritativ setzen, damit Entfernen/Hinzufuegen persistiert (auch leeres Array)
      const mgmtField = form.querySelector('select[name="management_ids"], select[name="management_ids[]"]');
      if (mgmtField) {
        const formField = mgmtField.closest('.form-field');
        let mgmtValues = Array.from(formField?.querySelectorAll('.tag-based-select .tag[data-value]') || [])
          .map(t => t.dataset.value).filter(Boolean);
        if (mgmtValues.length === 0) {
          const hidden = formField?.querySelector('select[style*="display: none"]');
          if (hidden) mgmtValues = Array.from(hidden.selectedOptions).map(o => o.value).filter(Boolean);
        }
        submitData.management_ids = [...new Set(mgmtValues)];
      }

      const validation = window.validatorSystem.validateForm(submitData, {
        vorname: { type: 'text', minLength: 2, required: true },
        nachname: { type: 'text', minLength: 2, required: true },
        mail: { type: 'email' },
        telefonnummer: { type: 'phone' },
        portfolio_link: { type: 'url' }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      const result = await window.dataService.updateEntity('creator', this.creatorId, submitData);

      if (result.success) {
        this.showSuccessMessage('Creator erfolgreich aktualisiert!');
        
        setTimeout(async () => {
          tabDataCache.invalidate('creator', this.creatorId);
          await this.loadCriticalData();
          await this.loadManagements();
          await this.render();
          window.navigateTo(`/creator/${this.creatorId}`);
        }, 1500);
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }

    } catch (error) {
      console.error('❌ Edit Formular-Submit Fehler:', error);
      this.showErrorMessage(error.message);
    }
};

CreatorDetail.prototype.showValidationErrors = function(errors) {
    console.log('❌ Validierungsfehler:', errors);
    
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
    
    Object.keys(errors).forEach(fieldName => {
      const field = document.querySelector(`[name="${fieldName}"]`);
      if (field) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.textContent = errors[fieldName];
        errorDiv.style.color = '#dc3545';
        errorDiv.style.fontSize = '0.875rem';
        errorDiv.style.marginTop = '0.25rem';
        
        field.parentNode.appendChild(errorDiv);
        field.style.borderColor = '#dc3545';
      }
    });
};

CreatorDetail.prototype.showSuccessMessage = function(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.textContent = message;
    successDiv.style.cssText = `
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #c3e6cb;
    `;
    
    const formPage = document.querySelector('.form-page');
    if (formPage) {
      formPage.insertBefore(successDiv, formPage.firstChild);
    }
};

CreatorDetail.prototype.showErrorMessage = function(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #f5c6cb;
    `;
    
    const formPage = document.querySelector('.form-page');
    if (formPage) {
      formPage.insertBefore(errorDiv, formPage.firstChild);
    }
};

CreatorDetail.prototype.setupCacheInvalidation = function() {
    if (this._cacheInvalidationBound) return;
    this._cacheInvalidationBound = true;
    
    const signal = this._abortController?.signal;
    
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'creator' && e.detail.id === this.creatorId) {
        console.log('🔄 CREATORDETAIL: Entity updated - invalidiere Cache');
        tabDataCache.invalidate('creator', this.creatorId);
        
        if (e.detail.action === 'updated') {
          this.loadCriticalData().then(() => {
            const infoTab = document.querySelector('#tab-info');
            if (infoTab && infoTab.classList.contains('active')) {
              infoTab.innerHTML = this.renderInfoTab();
            }
          });
        }
      }
    }, signal ? { signal } : undefined);
};

CreatorDetail.prototype.destroy = function() {
    console.log('🗑️ CREATORDETAIL: Destroy aufgerufen - räume auf');
    
    this._destroyed = true;
    
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    
    if (this.adressenUpdateHandler) {
      window.removeEventListener('entityUpdated', this.adressenUpdateHandler);
      this.adressenUpdateHandler = null;
    }
    
    tabDataCache.invalidate('creator', this.creatorId);
    this._cacheInvalidationBound = false;
    this.eventsBound = false;
    
    window.setContentSafely('');
    console.log('✅ CREATORDETAIL: Destroy abgeschlossen');
};
