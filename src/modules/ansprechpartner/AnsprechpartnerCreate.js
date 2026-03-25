// AnsprechpartnerCreate.js (ES6-Modul)
// Ansprechpartner-Erstellungsseite mit Multi-Select für Marken (wie Unternehmen/Marken)

import { ImageUploadHelper } from '../../core/ImageUploadHelper.js';

export class AnsprechpartnerCreate {
  constructor() {
    this.formData = {};
  }

  // Initialisiere Ansprechpartner-Erstellung
  async init() {
    console.log('🎯 ANSPRECHPARTNERCREATE: Initialisiere Ansprechpartner-Erstellung');
    this.showCreateForm();
  }

  // Show Create Form
  showCreateForm() {
    window.setHeadline('Neuen Ansprechpartner anlegen');
    
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel('Neuer Ansprechpartner');
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

// Exportiere Instanz für globale Nutzung
export const ansprechpartnerCreate = new AnsprechpartnerCreate();
