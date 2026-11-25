// UnternehmenCreate.js
// Erstellungsformular für Unternehmen (Submit, Logo). Duplikat-Check: DuplicateCheckBinding

import { UnternehmenService } from './services/UnternehmenService.js';
import { bindDuplicateCheck } from '../../core/validation/DuplicateCheckBinding.js';

export class UnternehmenCreate {
  showCreateForm() {
    console.log('🎯 Zeige Unternehmen-Erstellungsformular');
    window.setHeadline('Neues Unternehmen anlegen');

    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel('Neues Unternehmen');
    }

    const formHtml = window.formSystem.renderFormOnly('unternehmen');
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    window.formSystem.bindFormEvents('unternehmen', null);

    const form = document.getElementById('unternehmen-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };

      this._duplicateCheck?.destroy();
      this._duplicateCheck = bindDuplicateCheck('unternehmen', form);
    }
  }

  async handleFormSubmit() {
    try {
      const form = document.getElementById('unternehmen-form');
      const submitData = window.formSystem.collectSubmitData(form);

      const validation = window.validatorSystem.validateForm(submitData, {
        firmenname: { type: 'text', minLength: 2, required: true },
        invoice_email: { type: 'email' }
      });

      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      const result = await window.dataService.createEntity('unternehmen', submitData);

      if (result.success && result.id) {
        try {
          const { RelationTables } = await import('../../core/form/logic/RelationTables.js');
          const relationTables = new RelationTables();
          await relationTables.handleRelationTables('unternehmen', result.id, submitData, form);
        } catch (relationError) {
          console.error('❌ Junction Tables Fehler:', relationError);
        }

        try {
          await this.saveMitarbeiterRoles(result.id, submitData);
        } catch (mitarbeiterErr) {
          console.error('❌ Mitarbeiter-Rollen Fehler:', mitarbeiterErr);
        }

        try {
          await this.uploadLogo(result.id, form);
        } catch (logoErr) {
          console.error('❌ Logo-Upload Fehler:', logoErr);
        }

        this.showSuccessMessage('Unternehmen erfolgreich erstellt!');

        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'unternehmen', id: result.id, action: 'created', redirect: true }
        }));
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }

    } catch (error) {
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
    const form = document.getElementById('unternehmen-form');
    if (form) form.parentNode.insertBefore(successDiv, form);
  }

  showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.textContent = message;
    const form = document.getElementById('unternehmen-form');
    if (form) form.parentNode.insertBefore(errorDiv, form);
  }

  async saveMitarbeiterRoles(unternehmenId, data) {
    return UnternehmenService.saveMitarbeiterRoles(unternehmenId, data, { deleteExisting: false });
  }

  async uploadLogo(unternehmenId, form) {
    return UnternehmenService.uploadLogo(unternehmenId, form);
  }
}

export const unternehmenCreate = new UnternehmenCreate();
