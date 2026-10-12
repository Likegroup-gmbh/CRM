// CreatorDetailEditSubmit.js
// Speichern des Bearbeiten-Formulars der Creator-Akte (Prototype-Mixin)

import { CreatorDetail } from './CreatorDetailCore.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { normalizeHandle } from './creatorProfil.js';
import { syncCreatorBetreuung } from '../ansprechpartner/betreuung.js';
import { connectInstagramSilent } from '../../core/ActionsDropdownEffects.js';

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

      // firma_ids autoritativ setzen (auch leeres Array), damit Entfernen persistiert
      const firmaField = form.querySelector('select[name="firma_ids"], select[name="firma_ids[]"]');
      if (firmaField) {
        const formField = firmaField.closest('.form-field');
        let firmaValues = Array.from(formField?.querySelectorAll('.tag-based-select .tag[data-value]') || [])
          .map(t => t.dataset.value).filter(Boolean);
        if (firmaValues.length === 0) {
          const hidden = formField?.querySelector('select[style*="display: none"]');
          if (hidden) firmaValues = Array.from(hidden.selectedOptions).map(o => o.value).filter(Boolean);
        }
        submitData.firma_ids = [...new Set(firmaValues)];
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

      const previousInstagram = this.creator?.instagram;
      const result = await window.dataService.updateEntity('creator', this.creatorId, submitData);

      if (result.success) {
        await syncCreatorBetreuung(this.creatorId, form);
        const nextHandle = normalizeHandle(submitData.instagram);
        if (nextHandle && nextHandle !== normalizeHandle(previousInstagram)) {
          window.toastSystem?.show('Instagram-Daten werden geladen', 'info');
          connectInstagramSilent(this.creatorId).then((connectResult) => {
            if (!connectResult?.ok) window.toastSystem?.show('Instagram konnte nicht ausgelesen werden', 'error');
          });
        }
        this.showSuccessMessage('Creator erfolgreich aktualisiert!');
        
        setTimeout(async () => {
          tabDataCache.invalidate('creator', this.creatorId);
          await this.loadCriticalData();
          await this.loadManagements();
          await this.loadFirmen();
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
