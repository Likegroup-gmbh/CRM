// CreatorDetailEvents.js
// Event-Handler und UI-Interaktionen fuer CreatorDetail (Prototype-Mixin)

import { CreatorDetail } from './CreatorDetailCore.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { firmaCreateDrawer, injectFirmaCreateButton } from './FirmaCreateDrawer.js';
import { HAUPTADRESSE_QUELLE, normalizeHauptadresseQuelle } from './hauptadresseQuelle.js';
import { activateSecondaryNavTab, getSecondaryNavTabFromEvent } from '../../core/TabUtils.js';
import { bindGenerationControls } from './creatorProfil.js';
import { mountCreatorBetreuung } from '../ansprechpartner/betreuung.js';

CreatorDetail.prototype.bindEvents = function() {
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    this.bindSidebarTabs();

    document.addEventListener('click', (e) => {
      const tab = getSecondaryNavTabFromEvent(e);
      if (tab) {
        e.preventDefault();
        this.switchTab(tab);
      }
    }, { signal });

    document.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('.table-link');
      if (!link) return;
      const { table, id } = link.dataset;
      if (link.dataset.vertragOpen === 'edit' && id) {
        e.preventDefault();
        window.navigateTo(`/vertraege/${id}/edit`);
        return;
      }
      if (!table || !id) return;
      e.preventDefault();
      window.navigateTo(`/${table}/${id}`);
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

    document.addEventListener('click', (e) => {
      const addFirmaBtn = e.target.closest && e.target.closest('#btn-firma-anlegen');
      if (addFirmaBtn) {
        e.preventDefault();
        firmaCreateDrawer.open({
          creatorId: this.creatorId,
          onCreated: async () => {
            await this.loadFirmen();
            this.updateFirmenTab();
            const adresseTab = document.getElementById('tab-adresse');
            if (adresseTab) adresseTab.innerHTML = this.renderAdresseContent();
          }
        });
        return;
      }
      const removeFirmaBtn = e.target.closest && e.target.closest('[data-remove-firma]');
      if (removeFirmaBtn) {
        e.preventDefault();
        this._removeFirmaFromCreator(removeFirmaBtn.getAttribute('data-remove-firma'));
      }
    }, { signal });

    document.addEventListener('change', (e) => {
      if (e.target?.name === 'hauptadresse_quelle' && e.target.closest('.hauptadresse-picker')) {
        this.setHauptadresseQuelle(e.target.value);
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
      if (e.detail?.entity === 'creator_auswahl' && e.detail?.creatorId === this.creatorId) {
        tabDataCache.invalidate('creator', this.creatorId);
        if (this.activeMainTab === 'castings') {
          await this.loadTabData('castings');
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
    activateSecondaryNavTab(tabName);

    const activePane = document.getElementById(`tab-${tabName}`);
    if (activePane && !['adresse'].includes(tabName)) {
      await this.loadTabData(tabName);
    }
};

CreatorDetail.prototype.showEditForm = async function() {
    console.log('🎯 CREATORDETAIL: Zeige Creator-Bearbeitungsformular für ID:', this.creatorId);
    window.setHeadline('Creator bearbeiten');

    // Immer frisch laden, damit Re-Edit den aktuellen Stand zeigt
    await this.loadManagements();
    await this.loadFirmen();
    
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
      management_ids: this.managements && this.managements.length > 0 ? this.managements.map(m => m.id) : [],
      firma_ids: this.firmen && this.firmen.length > 0 ? this.firmen.map(f => f.id) : []
    };
    
    console.log('📋 CREATORDETAIL: Edit-Daten vorbereitet:', {
      sprachen_ids: editData.sprachen_ids,
      branche_ids: editData.branche_ids,
      creator_type_ids: editData.creator_type_ids,
      management_ids: editData.management_ids,
      firma_ids: editData.firma_ids
    });
    
    const formHtml = window.formSystem.renderFormOnly('creator', editData);
    window.setContentSafely(window.content, `
      <div class="form-page">
        ${formHtml}
      </div>
    `);

    window.formSystem.bindFormEvents('creator', editData);
    injectFirmaCreateButton();
    
    const form = document.getElementById('creator-form');
    if (form) {
      bindGenerationControls(form);
      mountCreatorBetreuung(form, { creatorId: this.creatorId });
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
    }
};

CreatorDetail.prototype._removeFirmaFromCreator = async function(firmaId) {
    const { confirmed } = await window.confirmationModal.open({
      title: 'Firma entfernen',
      message: 'Firmen-Zuordnung wirklich entfernen? Die Firma selbst bleibt erhalten und kann jederzeit wieder zugeordnet werden.',
      confirmText: 'Entfernen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!confirmed) return;

    const { error } = await window.supabase
      .from('creator_firma')
      .update({ ist_aktiv: false, updated_at: new Date().toISOString() })
      .eq('creator_id', this.creatorId)
      .eq('firma_id', firmaId)
      .eq('ist_aktiv', true);

    if (error) {
      window.toastSystem?.show('Fehler: ' + error.message, 'error');
    } else {
      window.toastSystem?.success('Firmen-Zuordnung entfernt.');
      await this.loadFirmen();
      this.updateFirmenTab();
      await this._resetHauptadresseIfQuelleMissing('firma');
    }
};

CreatorDetail.prototype.setHauptadresseQuelle = async function(quelle) {
    quelle = normalizeHauptadresseQuelle(quelle);
    if (quelle === HAUPTADRESSE_QUELLE.MANAGEMENT && !(this.managements || []).length) return;
    if (quelle === HAUPTADRESSE_QUELLE.FIRMA && !(this.firmen || []).length) return;

    const { error } = await window.supabase
      .from('creator')
      .update({ hauptadresse_quelle: quelle })
      .eq('id', this.creatorId);

    if (error) {
      window.toastSystem?.show('Hauptadresse konnte nicht gespeichert werden: ' + error.message, 'error');
      return;
    }

    if (this.creator) this.creator.hauptadresse_quelle = quelle;
    window.toastSystem?.success?.('Hauptadresse gespeichert.');
    const adresseTab = document.getElementById('tab-adresse');
    if (adresseTab) adresseTab.innerHTML = this.renderAdresseContent();
};

CreatorDetail.prototype._resetHauptadresseIfQuelleMissing = async function(quelle) {
    if (normalizeHauptadresseQuelle(this.creator?.hauptadresse_quelle) !== quelle) {
      const adresseTab = document.getElementById('tab-adresse');
      if (adresseTab) adresseTab.innerHTML = this.renderAdresseContent();
      return;
    }
    const stillPresent = quelle === HAUPTADRESSE_QUELLE.FIRMA
      ? (this.firmen || []).length > 0
      : (this.managements || []).length > 0;
    if (stillPresent) return;
    await this.setHauptadresseQuelle(HAUPTADRESSE_QUELLE.CREATOR);
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
            if (this._destroyed) return;
            this.render();
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
