// CreatorListForm.js
// Anlegen: Formular und Submit (Prototype-Mixin). Der Startscreen mit Instagram- und TikTok-Link
// liegt in CreatorListFormStart.js, der Abruf im Hintergrund in creatorProfilLaden.js.
// Duplikat-Check: DuplicateCheckBinding

import { CreatorList } from './CreatorListCore.js';
import { injectFirmaCreateButton } from './FirmaCreateDrawer.js';
import { injectManagementCreateButton } from './ManagementCreateDrawer.js';
import { bindDuplicateCheck } from '../../core/validation/DuplicateCheckBinding.js';
import { bindGenerationControls, normalizeHandle } from './creatorProfil.js';
import { followerZumSpeichern } from './creatorInstagramPrefill.js';
import { ladeProfileInsFormular } from './creatorProfilLaden.js';
import { mountCreatorBetreuung, syncCreatorBetreuung } from '../ansprechpartner/betreuung.js';
import { connectInstagramSilent } from '../../core/ActionsDropdownEffects.js';

/**
 * @param {object} prefill Formularwerte, z. B. die Handles aus dem Startscreen
 * @param {{ instagram?: string|null, tiktok?: string|null }} links Profil-URLs, die im Hintergrund laden
 */
CreatorList.prototype.renderCreatorForm = function(prefill = {}, links = {}) {
  this._profilLaden?.abbrechen();
  this._profilLaden = null;
  const values = { ...(prefill || {}) };
  const formHtml = window.formSystem.renderFormOnly('creator', values);
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
  injectFirmaCreateButton();
  injectManagementCreateButton();

  const form = document.getElementById('creator-form');
  if (!form) return;
  for (const [name, value] of Object.entries(values)) {
    if (value == null || value === '') continue;
    const field = form.querySelector(`[name="${name}"]`);
    if (field) field.value = value;
  }
  bindGenerationControls(form);
  mountCreatorBetreuung(form);
  form.onsubmit = async (e) => {
    e.preventDefault();
    await this.handleFormSubmit();
  };
  this._duplicateCheck?.destroy();
  this._duplicateCheck = bindDuplicateCheck('creator', form);
  if (!links?.instagram && !links?.tiktok) return;
  const laden = ladeProfileInsFormular(form, links);
  this._profilLaden = laden;
  void laden.fertig.then(() => {
    if (this._profilLaden === laden && form.isConnected) void this._duplicateCheck?.pruefe();
  });
};

CreatorList.prototype.handleFormSubmit = async function() {
  if (this._profilLaden?.laeuft()) {
    window.toastSystem?.show('Profil wird noch geladen', 'info');
    return;
  }
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

    // Checkboxes/Toggles explizit als Boolean setzen (auch wenn nicht angehakt)
    const toggleInputs = form.querySelectorAll('input[type="checkbox"][name]');
    toggleInputs.forEach(input => {
      submitData[input.name] = input.checked;
    });

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
    
    const mail = String(submitData.mail || '').trim();
    const phone = String(submitData.telefonnummer || '').trim();
    const phoneMissing = submitData.telefon_nicht_vorhanden === true;
    if (!mail) validation.errors = { ...(validation.errors || {}), mail: 'Mail ist Pflicht' };
    if (!phone && !phoneMissing) {
      validation.errors = { ...(validation.errors || {}), telefonnummer: 'Telefon ist Pflicht, oder „nicht vorhanden“' };
    }
    if (!mail || (!phone && !phoneMissing)) validation.isValid = false;

    const profil = this._profilLaden?.ergebnis() || {};
    submitData.instagram_follower = followerZumSpeichern(submitData.instagram_follower, profil.instagramFollower);
    submitData.tiktok_follower = followerZumSpeichern(submitData.tiktok_follower, profil.tiktokFollower);

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
      await syncCreatorBetreuung(result.id, form);
      await this.profilbildSetzen(result.id, profil.profilbild);
      await this.auslesenWennNeu(result.id, '', submitData.instagram);

      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'creator', id: result.id, action: 'created', redirect: true }
      }));
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
};

// createEntity laesst Felder ausserhalb der Entity-Registry fallen, darunter das Profilbild
CreatorList.prototype.profilbildSetzen = async function(creatorId, bild) {
  if (!creatorId || !bild?.url || !window.supabase) return;
  const { error } = await window.supabase
    .from('creator')
    .update({ profilbild_url: bild.url, profilbild_thumb_url: bild.thumbUrl || null })
    .eq('id', creatorId);
  if (error) console.warn('Profilbild konnte nicht gespeichert werden', error);
};

CreatorList.prototype.auslesenWennNeu = async function(creatorId, before, after) {
  const next = normalizeHandle(after);
  if (!creatorId || !next || next === normalizeHandle(before)) return;
  window.toastSystem?.show('Instagram-Daten werden geladen', 'info');
  const result = await connectInstagramSilent(creatorId);
  if (!result?.ok) window.toastSystem?.show('Instagram konnte nicht ausgelesen werden', 'error');
};

CreatorList.prototype.showValidationErrors = function(errors) {
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
};

CreatorList.prototype.showSuccessMessage = function(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'alert alert-success';
  successDiv.textContent = message;
  
  const form = document.getElementById('creator-form');
  if (form) {
    form.parentNode.insertBefore(successDiv, form);
  }
};

CreatorList.prototype.showErrorMessage = function(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'alert alert-error';
  errorDiv.textContent = message;
  
  const form = document.getElementById('creator-form');
  if (form) {
    form.parentNode.insertBefore(errorDiv, form);
  }
};
