// UnternehmenCreate.js
// Erstellungsformular für Unternehmen (Duplikat-Check, Submit, Logo)

import { UnternehmenService } from './services/UnternehmenService.js';

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

      this.setupDuplicateValidation(form);
    }
  }

  setupDuplicateValidation(form) {
    const firmennameField = form.querySelector('#firmenname, input[name="firmenname"]');
    if (!firmennameField) return;

    let messageContainer = firmennameField.parentElement.querySelector('.duplicate-message-container');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.className = 'duplicate-message-container';
      firmennameField.parentElement.appendChild(messageContainer);
    }

    firmennameField.addEventListener('blur', async (e) => {
      await this.validateUnternehmenDuplicate(e.target.value, messageContainer);
    });

    firmennameField.addEventListener('input', () => {
      this.clearDuplicateMessages(messageContainer);
      this.enableSubmitButton();
    });
  }

  async validateUnternehmenDuplicate(firmenname, messageContainer) {
    if (!firmenname || firmenname.trim().length < 2) {
      this.clearDuplicateMessages(messageContainer);
      return;
    }

    if (!window.duplicateChecker) return;

    try {
      const result = await window.duplicateChecker.checkUnternehmen(firmenname, null);

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
      console.error('❌ Fehler bei Duplikat-Validierung:', error);
    }
  }

  showDuplicateError(container, entries) {
    container.innerHTML = `
      <div class="duplicate-error">
        <strong>Dieser Firmenname existiert bereits!</strong>
        ${entries.length > 0 ? `
          <ul class="duplicate-list">
            ${entries.map(entry => `
              <li class="duplicate-list-item">
                <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${entry.id}">
                  ${entry.logo_url ? `<img src="${entry.logo_url}" alt="${entry.firmenname}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                  <span class="duplicate-name">${entry.firmenname}</span>
                </a>
              </li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    `;
    this.bindDuplicateLinks(container, 'unternehmen');
  }

  showDuplicateWarning(container, entries) {
    container.innerHTML = `
      <div class="duplicate-warning">
        <strong>Folgende ähnliche Einträge gefunden:</strong>
        <ul class="duplicate-list">
          ${entries.map(entry => `
            <li class="duplicate-list-item">
              <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${entry.id}">
                ${entry.logo_url ? `<img src="${entry.logo_url}" alt="${entry.firmenname}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                <span class="duplicate-name">${entry.firmenname}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
    this.bindDuplicateLinks(container, 'unternehmen');
  }

  bindDuplicateLinks(container, entityType) {
    container.querySelectorAll('.duplicate-link[data-entity-id]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.entityId;
        if (id && window.navigationSystem) {
          window.navigationSystem.navigateTo(`/${entityType}/${id}`);
        }
      });
    });
  }

  clearDuplicateMessages(container) {
    if (container) container.innerHTML = '';
  }

  disableSubmitButton(disable) {
    const form = document.getElementById('unternehmen-form');
    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = disable;
      submitBtn.style.opacity = disable ? '0.5' : '1';
      submitBtn.style.cursor = disable ? 'not-allowed' : 'pointer';
    }
  }

  enableSubmitButton() {
    this.disableSubmitButton(false);
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
          detail: { entity: 'unternehmen', id: result.id, action: 'created' }
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
