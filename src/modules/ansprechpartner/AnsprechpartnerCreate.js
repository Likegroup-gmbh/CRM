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
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Ansprechpartner', url: '/ansprechpartner', clickable: true },
        { label: 'Neuer Ansprechpartner', url: '/ansprechpartner/new', clickable: false }
      ]);
    }
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('ansprechpartner');
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
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
