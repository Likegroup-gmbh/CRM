// UnternehmenDetailEdit.js
// Edit-Form, Logo-Upload, Branchen, Ansprechpartner-Entfernung

import { UnternehmenService } from './services/UnternehmenService.js';

export async function showEditForm(detail) {
  try {
    if (window.breadcrumbSystem && detail.unternehmen) {
      window.breadcrumbSystem.updateDetailLabel('Bearbeiten');
    }

    const formData = { ...detail.unternehmen };
    formData._isEditMode = true;
    formData._entityId = detail.unternehmenId;

    if (detail.unternehmen.branche_id && Array.isArray(detail.unternehmen.branche_id)) {
      formData.branche_id = detail.unternehmen.branche_id;
    } else if (!detail.unternehmen.branche_id || detail.unternehmen.branche_id.length === 0) {
      formData.branche_id = [];
    }

    const formHtml = window.formSystem.renderFormOnly('unternehmen', formData);

    const safeLogoUrl = UnternehmenService.sanitizeUrl(detail.unternehmen?.logo_url);
    const currentLogoHtml = (safeLogoUrl && safeLogoUrl !== '#') ? `
      <div class="form-logo-display">
        <label class="form-logo-label">Aktuelles Logo:</label>
        <img src="${safeLogoUrl}" alt="${(detail.unternehmen.firmenname || '').replace(/"/g, '&quot;')} Logo" class="form-logo-image" />
      </div>
    ` : '';

    window.setHeadline(`${detail.unternehmen?.firmenname || 'Unternehmen'} bearbeiten`);
    window.content.innerHTML = `
      <div class="form-page">
        ${currentLogoHtml}
        ${formHtml}
        <div id="logo-preview-container" class="form-logo-preview" style="display: none;">
          <label class="form-logo-label">Neues Logo Vorschau:</label>
          <img id="logo-preview-image" class="form-logo-image" alt="Logo Vorschau" />
        </div>
      </div>
    `;

    await window.formSystem.bindFormEvents('unternehmen', formData);

    const form = document.getElementById('unternehmen-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await handleEditFormSubmit(detail, form);
      };
    }

    setupLogoPreview(form);

  } catch (error) {
    console.error('Fehler beim Anzeigen des Edit-Formulars:', error);
    showErrorMessage('Fehler beim Laden des Formulars: ' + error.message);
  }
}

export function setupLogoPreview(form) {
  if (!form) return;
  const uploaderRoot = form.querySelector('.uploader[data-name="logo_file"]');
  if (!uploaderRoot) return;

  const fileInput = uploaderRoot.querySelector('input[type="file"]');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const previewContainer = document.getElementById('logo-preview-container');
          const previewImage = document.getElementById('logo-preview-image');
          if (previewContainer && previewImage) {
            previewImage.src = event.target.result;
            previewContainer.style.display = 'block';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }
}

export async function handleEditFormSubmit(detail, form) {
  try {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<div class="loading-spinner"></div> Wird gespeichert...';
    submitBtn.disabled = true;

    const formData = new FormData(form);
    const data = {};
    const allFormData = {};

    // Tag-basierte Multi-Selects
    const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
    tagBasedSelects.forEach(select => {
      let hiddenSelect = form.querySelector(`select[name="${select.name}[]"][style*="display: none"]`);
      if (!hiddenSelect) {
        hiddenSelect = form.querySelector(`select[name="${select.name}"][style*="display: none"]`);
      }
      if (!hiddenSelect) {
        const allSelects = form.querySelectorAll(`select[name="${select.name}"]`);
        if (allSelects.length > 1) hiddenSelect = allSelects[1];
      }
      if (hiddenSelect) {
        const selectedValues = Array.from(hiddenSelect.selectedOptions)
          .map(option => option.value)
          .filter(val => val !== '');
        allFormData[select.name] = selectedValues;
      }
    });

    // Mitarbeiter-Felder explizit sammeln
    const mitarbeiterFields = ['management_ids', 'lead_mitarbeiter_ids', 'mitarbeiter_ids'];
    for (const fieldName of mitarbeiterFields) {
      if (!allFormData[fieldName]) {
        const hiddenSelect = form.querySelector(`select[name="${fieldName}"][style*="display: none"]`);
        if (hiddenSelect) {
          const selectedValues = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
          if (selectedValues.length > 0) {
            allFormData[fieldName] = selectedValues;
          }
        }
        if (!allFormData[fieldName]) {
          const allSelects = form.querySelectorAll(`select[name="${fieldName}"]`);
          for (const sel of allSelects) {
            if (sel.multiple || sel.hasAttribute('multiple')) {
              const selectedValues = Array.from(sel.selectedOptions).map(option => option.value).filter(val => val !== '');
              if (selectedValues.length > 0) {
                allFormData[fieldName] = selectedValues;
                break;
              }
            }
          }
        }
      }
    }

    // Standard FormData sammeln
    for (let [key, value] of formData.entries()) {
      if (!allFormData.hasOwnProperty(key)) {
        if (key.includes('[]')) {
          const cleanKey = key.replace('[]', '');
          if (!allFormData[cleanKey]) allFormData[cleanKey] = [];
          allFormData[cleanKey].push(value);
        } else {
          if (allFormData[key]) {
            if (!Array.isArray(allFormData[key])) allFormData[key] = [allFormData[key]];
            allFormData[key].push(value);
          } else {
            allFormData[key] = value;
          }
        }
      }
    }

    for (let [key, value] of Object.entries(allFormData)) {
      data[key] = Array.isArray(value) ? value : value.trim();
    }

    // Unternehmen aktualisieren
    const result = await window.dataService.updateEntity('unternehmen', detail.unternehmenId, data);

    if (!result.success) {
      throw new Error(result.error || 'Fehler beim Aktualisieren');
    }

    await UnternehmenService.saveMitarbeiterRoles(detail.unternehmenId, data);

    try {
      await UnternehmenService.uploadLogo(detail.unternehmenId, form, { throwOnError: true });
    } catch (logoError) {
      console.warn('Logo-Upload fehlgeschlagen, Unternehmen wurde aktualisiert:', logoError);
    }

    if (window.toastSystem) {
      window.toastSystem.success('Unternehmen erfolgreich aktualisiert!');
    }

    await detail.init(detail.unternehmenId);

  } catch (error) {
    console.error('Fehler beim Aktualisieren:', error);
    if (window.toastSystem) {
      window.toastSystem.show('Fehler beim Aktualisieren: ' + error.message, 'error');
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = 'Speichern';
      submitBtn.disabled = false;
    }
  }
}

export async function removeAnsprechpartner(detail, ansprechpartnerId, unternehmenId) {
  try {
    const { error } = await window.supabase
      .from('ansprechpartner_unternehmen')
      .delete()
      .eq('ansprechpartner_id', ansprechpartnerId)
      .eq('unternehmen_id', unternehmenId);

    if (error) throw error;

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'ansprechpartner', action: 'removed', unternehmenId: unternehmenId }
    }));

  } catch (error) {
    console.error('Fehler beim Entfernen des Ansprechpartners:', error);
    alert('Fehler beim Entfernen: ' + (error.message || 'Unbekannter Fehler'));
  }
}

export function showErrorMessage(message) {
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
}

export async function getBranchenNamen(branchenIds) {
  return UnternehmenService.getBranchenNamen(branchenIds);
}

export async function uploadLogo(detail, unternehmenId, form) {
  return UnternehmenService.uploadLogo(unternehmenId, form, { throwOnError: true });
}

export async function saveUnternehmenBranchen(detail, unternehmenId, brancheIds = null, form = null) {
  return UnternehmenService.saveUnternehmenBranchen(unternehmenId, brancheIds, form);
}
