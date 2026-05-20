// AnsprechpartnerCreate.js (ES6-Modul)
// Ansprechpartner-Erstellungsseite mit Multi-Select für Marken (wie Unternehmen/Marken)

import { ImageUploadHelper } from '../../core/ImageUploadHelper.js';

export class AnsprechpartnerCreate {
  constructor(opts = {}) {
    this.formData = {};
    this.mode = opts.mode || 'unternehmen';
  }

  // Initialisiere Ansprechpartner-Erstellung
  async init() {
    console.log('🎯 ANSPRECHPARTNERCREATE: Initialisiere Ansprechpartner-Erstellung', { mode: this.mode });
    this.showCreateForm();
  }

  // Show Create Form
  showCreateForm() {
    const headline = this.mode === 'management'
      ? 'Neuen Management-Ansprechpartner anlegen'
      : 'Neuen Ansprechpartner anlegen';
    window.setHeadline(headline);

    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel(headline);
    }

    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('ansprechpartner');
    window.content.innerHTML = `
      <div class="form-split-container">
        <div class="form-split-left">
          <div class="form-page">
            ${formHtml}
          </div>
        </div>
        <div class="form-split-right hidden" id="ansprechpartner-split-container">
          <div id="ansprechpartner-embedded-form"></div>
        </div>
      </div>
    `;

    // Formular-Events binden (FormSystem übernimmt Submit-Verarbeitung)
    window.formSystem.bindFormEvents('ansprechpartner', null);

    // Im Unternehmen-Modus: Management-Feld entfernen (irrelevant)
    if (this.mode !== 'management') {
      requestAnimationFrame(() => {
        const mgmtField = document.querySelector('#management_id, [name="management_id"]');
        if (mgmtField) {
          const wrapper = mgmtField.closest('.form-field, .form-group') || mgmtField.parentElement;
          if (wrapper) wrapper.remove();
        }
      });
    }

    // Im Management-Modus: Management-Feld hervorheben + Hint anzeigen
    if (this.mode === 'management') {
      requestAnimationFrame(() => {
        const mgmtField = document.querySelector('#management_id, [name="management_id"]');
        if (mgmtField) {
          const wrapper = mgmtField.closest('.form-field, .form-group') || mgmtField.parentElement;
          if (wrapper && !wrapper.querySelector('.ansprechpartner-mode-hint')) {
            const hint = document.createElement('div');
            hint.className = 'ansprechpartner-mode-hint';
            hint.style.cssText = 'font-size: 12px; color: var(--gray-500, #6b7280); margin-top: 4px;';
            hint.textContent = 'Bitte Management auswählen, damit der Ansprechpartner in der Management-Liste erscheint.';
            wrapper.appendChild(hint);
          }
        }
      });
    }
  }

  // Profilbild-Upload - delegiert an ImageUploadHelper
  async uploadProfileImage(ansprechpartnerId, form) {
    return ImageUploadHelper.uploadProfileImage(ansprechpartnerId, form);
  }

  // Destroy
  destroy() {
    console.log('🎯 ANSPRECHPARTNERCREATE: Destroy');
  }
}

// Exportiere Instanzen für globale Nutzung
export const ansprechpartnerCreate = new AnsprechpartnerCreate({ mode: 'unternehmen' });
export const managementAnsprechpartnerCreate = new AnsprechpartnerCreate({ mode: 'management' });
