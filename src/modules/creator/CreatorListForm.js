// CreatorListForm.js
// Anlegeformular, Duplikat-Check und Submit (Prototype-Mixin)

import { CreatorList } from './CreatorListCore.js';
import { injectFirmaCreateButton } from './FirmaCreateDrawer.js';

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

    this.setupDuplicateValidation(form);
  }
};

CreatorList.prototype.setupDuplicateValidation = function(form) {
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
};

CreatorList.prototype.validateCreatorDuplicate = async function(vorname, nachname, messageContainer) {
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
};

CreatorList.prototype.showDuplicateError = function(container, entries) {
  const sanitize = this.sanitize.bind(this);
  const sanitizeImgUrl = (url) => window.validatorSystem?.sanitizeUrl(url);

  container.innerHTML = `
    <div class="duplicate-error">
      <strong>Dieser Creator existiert bereits!</strong>
      ${entries.length > 0 ? `
        <ul class="duplicate-list">
          ${entries.map(entry => {
            const imgSource = entry.profilbild_thumb_url || entry.profilbild_url;
            const safeImgUrl = imgSource ? sanitizeImgUrl(imgSource) : null;
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
};

CreatorList.prototype.showDuplicateWarning = function(container, entries) {
  const sanitize = this.sanitize.bind(this);
  const sanitizeImgUrl = (url) => window.validatorSystem?.sanitizeUrl(url);

  container.innerHTML = `
    <div class="duplicate-warning">
      <strong>Folgende ähnliche Einträge gefunden:</strong>
      <ul class="duplicate-list">
        ${entries.map(entry => {
          const imgSource = entry.profilbild_thumb_url || entry.profilbild_url;
          const safeImgUrl = imgSource ? sanitizeImgUrl(imgSource) : null;
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
};

CreatorList.prototype.bindDuplicateLinks = function(container, entityType) {
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
};

CreatorList.prototype.clearDuplicateMessages = function(container) {
  if (container) {
    container.innerHTML = '';
  }
};

CreatorList.prototype.disableSubmitButton = function(disable) {
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
};

CreatorList.prototype.enableSubmitButton = function() {
  const form = document.getElementById('creator-form');
  if (form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
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
