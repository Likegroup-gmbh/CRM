// CreatorListForm.js
// Anlegeformular und Submit (Prototype-Mixin). Duplikat-Check: DuplicateCheckBinding

import { CreatorList } from './CreatorListCore.js';
import { injectFirmaCreateButton } from './FirmaCreateDrawer.js';
import { bindDuplicateCheck } from '../../core/validation/DuplicateCheckBinding.js';

// ══════════════════════════════════════════════════════════════════════════
// CREATE FORM (für Routing)
// ══════════════════════════════════════════════════════════════════════════

CreatorList.prototype.showCreateForm = function() {
  console.log('🎯 Zeige Creator-Erstellungsformular');
  window.setHeadline('Neuen Creator anlegen');

  if (window.breadcrumbSystem) {
    window.breadcrumbSystem.updateDetailLabel('Neuer Creator');
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
  injectFirmaCreateButton();

  const form = document.getElementById('creator-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      await this.handleFormSubmit();
    };

    this._duplicateCheck?.destroy();
    this._duplicateCheck = bindDuplicateCheck('creator', form);
  }
};

CreatorList.prototype.handleFormSubmit = async function() {
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
