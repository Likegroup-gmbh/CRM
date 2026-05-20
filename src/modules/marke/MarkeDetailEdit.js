// MarkeDetailEdit.js
// Bearbeitungsformular: showEditForm, Logo-Preview, Submit, Validierung

import { MarkeService } from './services/MarkeService.js';
import { FormSubmitHelper } from '../../core/form/FormSubmitHelper.js';

export async function showEditForm(detail) {
  window.setHeadline('Marke bearbeiten');

  const formData = { ...detail.marke };
  formData._isEditMode = true;
  formData._entityId = detail.markeId;

  if (detail.marke.unternehmen_id) {
    formData.unternehmen_id = detail.marke.unternehmen_id;
  } else {
    formData.unternehmen_id = null;
  }

  try {
    const { data: branchenData, error } = await window.supabase
      .from('marke_branchen')
      .select('branche_id')
      .eq('marke_id', detail.markeId);

    if (!error && branchenData && branchenData.length > 0) {
      formData.branche_id = branchenData.map(b => b.branche_id);
    } else {
      formData.branche_id = [];
    }
  } catch (branchenError) {
    console.warn('Fehler beim Laden der Branchen-Daten:', branchenError);
    formData.branche_id = [];
  }

  const formHtml = window.formSystem.renderFormOnly('marke', formData);

  const safeLogoUrl = detail.marke?.logo_url;
  const isValidLogoUrl = safeLogoUrl && /^https?:\/\//i.test(safeLogoUrl);
  const currentLogoHtml = isValidLogoUrl ? `
    <div class="form-logo-display">
      <label class="form-logo-label">Aktuelles Logo:</label>
      <img src="${safeLogoUrl}" alt="${(detail.marke.markenname || '').replace(/"/g, '&quot;')} Logo" class="form-logo-image" />
    </div>
  ` : '';

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

  window.formSystem.bindFormEvents('marke', formData);

  const form = document.getElementById('marke-form');
  if (form) {
    form.dataset.isEditMode = 'true';
    form.dataset.entityType = 'marke';
    form.dataset.entityId = detail.markeId;

    if (formData.unternehmen_id) {
      form.dataset.existingUnternehmenId = formData.unternehmen_id;
    }
    if (formData.branche_id && Array.isArray(formData.branche_id) && formData.branche_id.length > 0) {
      form.dataset.existingBranchenIds = JSON.stringify(formData.branche_id);
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      await handleEditFormSubmit(detail);
    };

    setupLogoPreview(form);
  }
}

export function setupLogoPreview(form) {
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

export async function handleEditFormSubmit(detail) {
  const form = document.getElementById('marke-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn?.innerHTML;

  try {
    if (submitBtn) {
      submitBtn.innerHTML = '<div class="loading-spinner"></div> Wird gespeichert...';
      submitBtn.disabled = true;
    }

    const formData = new FormData(form);
    const tagBasedValues = FormSubmitHelper.collectTagBasedSelects(form);
    const allFormData = FormSubmitHelper.formDataToObject(formData, tagBasedValues);
    if (typeof allFormData.markenname === 'string') allFormData.markenname = allFormData.markenname.trim();

    const validation = window.validatorSystem.validateForm(allFormData, {
      markenname: { type: 'text', minLength: 2, required: true }
    });

    if (!validation.isValid) {
      showValidationErrors(validation.errors);
      if (submitBtn) {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
      return;
    }

    const result = await window.dataService.updateEntity('marke', detail.markeId, allFormData);

    if (result.success) {
      try {
        await MarkeService.uploadLogo(detail.markeId, form);
      } catch (logoError) {
        console.warn('Logo-Upload fehlgeschlagen, aber Marke wurde aktualisiert:', logoError);
      }

      const unternehmenId = detail.marke?.unternehmen_id || allFormData.unternehmen_id;
      try {
        await MarkeService.saveMitarbeiterToMarke(detail.markeId, allFormData, unternehmenId, { deleteExisting: true });
      } catch (mitarbeiterErr) {
        console.error('Mitarbeiter-Zuordnungen:', mitarbeiterErr);
        showErrorMessage(mitarbeiterErr.message || 'Mitarbeiter-Zuordnungen konnten nicht gespeichert werden.');
        if (submitBtn) { submitBtn.innerHTML = originalText; submitBtn.disabled = false; }
        return;
      }

      window.toastSystem.success('Marke erfolgreich aktualisiert!');
      await detail.init(detail.markeId);
    } else {
      throw new Error(result.error || 'Unbekannter Fehler');
    }

  } catch (error) {
    console.error('Formular-Submit Fehler:', error);
    showErrorMessage(error.message);
    if (submitBtn) {
      submitBtn.innerHTML = originalText || 'Speichern';
      submitBtn.disabled = false;
    }
  }
}

export function showValidationErrors(errors) {
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
