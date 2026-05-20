// ProjektErstellenModule.js
// Route-Handler fuer den neuen Projekt-Erstell-Flow (Wizard).
// Wird bei /projekt-erstellen aufgerufen.

import { ProjektErstellenWizard } from './ProjektErstellenWizard.js';

export class ProjektErstellenModule {
  constructor() {
    this.wizard = null;
  }

  async init() {
    console.log('🚀 ProjektErstellenModule.init()');

    window.setHeadline?.('Neues Projekt anlegen');

    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel?.('Neues Projekt');
    }

    this.destroy();

    this.wizard = new ProjektErstellenWizard(window.content);
    await this.wizard.init();
  }

  async initForEdit(auftragId) {
    console.log('✏️ ProjektErstellenModule.initForEdit()', auftragId);

    window.setHeadline?.('Projekt bearbeiten');

    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel?.('Projekt bearbeiten');
    }

    this.destroy();

    // ?step= Parameter aus URL lesen und weitergeben
    let initialStep;
    try {
      initialStep = new URL(window.location.href).searchParams.get('step') || undefined;
    } catch { /* ignore */ }

    this.wizard = new ProjektErstellenWizard(window.content);
    try {
      await this.wizard.initEditMode(auftragId, { initialStep });
    } catch (e) {
      console.error('❌ ProjektErstellenModule: initEditMode fehlgeschlagen', e);
      window.navigateTo?.(`/auftrag/${auftragId}`);
    }
  }

  showCreateForm() {
    return this.init();
  }

  destroy() {
    if (this.wizard) {
      try {
        this.wizard.destroy();
      } catch (e) {
        console.warn('⚠️ Wizard-Destroy fehlgeschlagen:', e);
      }
      this.wizard = null;
    }
  }
}

export const projektErstellenModule = new ProjektErstellenModule();
