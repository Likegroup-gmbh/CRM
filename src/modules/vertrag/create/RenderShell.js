// RenderShell.js
// Render-Shell fuer die Vertragserstellung: Schritt 1 (Typwahl), Multistep-Rahmen,
// Progress-Bar, Navigation, Dispatcher zu den typ-spezifischen Step-Renderern.

import { VertraegeCreate } from './VertraegeCreateCore.js';

VertraegeCreate.prototype.render = function() {
    // Verhindere doppeltes Rendern
    if (this._isRendering) {
      console.log('⏳ Render bereits aktiv, überspringe...');
      return;
    }
    this._isRendering = true;
    
    try {
      if (!this.isGenerated) {
        this.renderStep1();
      } else {
        this.renderMultistep();
      }
    } finally {
      // Lock freigeben nach kurzem Delay (für DOM-Updates)
      setTimeout(() => {
        this._isRendering = false;
      }, 50);
    }
};

VertraegeCreate.prototype.renderStep1 = function() {
    const html = `
      <div class="form-page">
        <div class="vertrag-typ-selection">
          <h2>Vertragstyp auswählen</h2>
          <p class="form-hint">Wählen Sie den Vertragstyp aus und klicken Sie auf "Generieren".</p>
          
          <div class="form-field form-field--centered">
            <label for="vertrag-typ">Vertragstyp</label>
            <select id="vertrag-typ" class="form-select">
              <option value="">Bitte wählen...</option>
              <option value="UGC">UGC-Produktionsvertrag</option>
              <option value="Influencer Kooperation">Influencer Kooperation</option>
              <option value="Videograph">Videograph</option>
              <option value="Model">Modelvertrag</option>
            </select>
          </div>
          
          <div class="form-actions form-actions--centered">
            <button type="button" class="mdc-btn mdc-btn--cancel" onclick="window.navigateTo('/vertraege')">
              <span class="mdc-btn__label">Abbrechen</span>
            </button>
            <button type="button" id="btn-generate" class="primary-btn" disabled>
              Generieren
            </button>
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
    this.bindStep1Events();
};

VertraegeCreate.prototype.bindStep1Events = function() {
    const select = document.getElementById('vertrag-typ');
    const generateBtn = document.getElementById('btn-generate');

    if (select) {
      select.addEventListener('change', (e) => {
        this.selectedTyp = e.target.value;
        if (generateBtn) {
          generateBtn.disabled = !this.selectedTyp;
        }
      });
    }

    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        if (this.selectedTyp) {
          this.isGenerated = true;
          this.currentStep = 2;
          this.formData.typ = this.selectedTyp;
          this.render();
        }
      });
    }
};

VertraegeCreate.prototype.renderMultistep = function() {
    const stepContent = this.getStepContent();
    const isEdit = !!this.editId;
    
    const html = `
      <div class="form-page">
        <form id="vertrag-form" data-entity="vertraege">
          <!-- Step Content -->
          <div class="multistep-content">
            ${stepContent}
          </div>
        </form>
      </div>
    `;

    // Erst HTML setzen
    window.setContentSafely(window.content, html);
    
    // Dann Progress Bar in main-wrapper einfügen (NACH setContentSafely!)
    const mainWrapper = document.querySelector('.main-wrapper');
    let progressContainer = document.getElementById('vertrag-progress-container');
    
    if (!progressContainer && mainWrapper) {
      progressContainer = document.createElement('div');
      progressContainer.id = 'vertrag-progress-container';
      progressContainer.className = 'multistep-progress';
      mainWrapper.insertBefore(progressContainer, mainWrapper.firstChild);
    }
    
    if (progressContainer) {
      progressContainer.innerHTML = this.renderProgressBar();
    }
    
    // Events binden
    this.bindProgressBarEvents();
    this.bindMultistepEvents();
    this.initSearchableSelects();
};

VertraegeCreate.prototype.renderProgressBar = function() {
    const steps = [
      { num: 2, label: 'Parteien' },
      { num: 3, label: 'Leistung' },
      { num: 4, label: 'Nutzung' },
      { num: 5, label: 'Vergütung' }
    ];
    
    const isEdit = !!this.editId;
    const selectedLanguage = this.getContractLanguage(this.formData);

    return `
      <div class="progress-steps">
        ${steps.map(step => `
          <div class="progress-step ${this.currentStep >= step.num ? 'active' : ''} ${this.currentStep === step.num ? 'current' : ''}" 
               data-step="${step.num}" 
               class="cursor-pointer"
               title="Zu ${step.label} springen">
            <div class="step-number">${step.num - 1}</div>
            <div class="step-label">${step.label}</div>
          </div>
        `).join('')}
      </div>
      <div class="progress-actions">
        <button type="button" class="mdc-btn mdc-btn--cancel" id="btn-cancel">
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button type="button" id="btn-save-draft" class="secondary-btn" title="Als Entwurf in der Datenbank speichern">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3" />
          </svg>
          <span class="btn-label">Als Entwurf speichern</span>
        </button>
        ${this.currentStep > 2 ? `
          <button type="button" id="btn-prev" class="secondary-btn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Zurück
          </button>
        ` : ''}
        ${this.currentStep === this.totalSteps ? `
          <div class="contract-language-switch" role="group" aria-label="Vertragssprache">
            <span class="contract-language-switch__label">Sprache:</span>
            <button type="button" class="secondary-btn ${selectedLanguage === 'de' ? 'btn-active' : ''}" data-contract-lang="de">
              Deutsch
            </button>
            <button type="button" class="secondary-btn ${selectedLanguage === 'en' ? 'btn-active' : ''}" data-contract-lang="en">
              English
            </button>
          </div>
        ` : ''}
        ${this.currentStep < this.totalSteps ? `
          <button type="button" id="btn-next" class="primary-btn">
            Weiter
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </button>
        ` : `
          <button type="button" id="btn-submit" class="primary-btn">
            ${isEdit ? 'Finalisieren & PDF' : 'Erstellen & PDF'}
          </button>
          <button type="button" id="btn-submit-and-new" class="secondary-btn" title="Vertrag erstellen und mit gleichen Daten neuen starten">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Erstellen & Neu mit gleichen Daten
          </button>
        `}
      </div>
    `;
};

VertraegeCreate.prototype.bindProgressBarEvents = function() {
    const progressContainer = document.getElementById('vertrag-progress-container');
    if (!progressContainer) return;

    const steps = progressContainer.querySelectorAll('.progress-step[data-step]');
    steps.forEach(stepEl => {
      stepEl.addEventListener('click', () => {
        const targetStep = parseInt(stepEl.dataset.step, 10);
        this.goToStep(targetStep);
      });
    });
};

VertraegeCreate.prototype.goToStep = function(targetStep) {
    // Aktuelle Daten speichern bevor wir wechseln
    this.saveCurrentStepData();
    
    // Schritt wechseln
    this.currentStep = targetStep;
    this.render();
};

VertraegeCreate.prototype.getStepContent = function() {
    // Influencer-Vertrag hat andere Steps
    if (this.selectedTyp === 'Influencer Kooperation') {
      switch (this.currentStep) {
        case 2: return this.renderInfluencerStep2(); // Parteien + Agentur
        case 3: return this.renderInfluencerStep3(); // Plattformen & Inhalte
        case 4: return this.renderInfluencerStep4(); // Nutzungsrechte & Buyout
        case 5: return this.renderInfluencerStep5(); // Vergütung & Qualität
        default: return '';
      }
    }
    
    // Videograf-Vertrag
    if (this.selectedTyp === 'Videograph') {
      switch (this.currentStep) {
        case 2: return this.renderVideografStep2(); // Parteien
        case 3: return this.renderVideografStep3(); // Leistungsumfang & Produktion
        case 4: return this.renderVideografStep4(); // Output & Korrektur
        case 5: return this.renderVideografStep5(); // Nutzungsrechte & Vergütung
        default: return '';
      }
    }

    // Model-Vertrag
    if (this.selectedTyp === 'Model') {
      switch (this.currentStep) {
        case 2: return this.renderModelStep2(); // Parteien
        case 3: return this.renderModelStep3(); // Produktion & Einsatz
        case 4: return this.renderModelStep4(); // Nutzungsrechte
        case 5: return this.renderModelStep5(); // Vergütung & Absage
        default: return '';
      }
    }
    
    // UGC-Vertrag (Standard)
    switch (this.currentStep) {
      case 2: return this.renderStep2();
      case 3: return this.renderStep3();
      case 4: return this.renderStep4();
      case 5: return this.renderStep5();
      default: return '';
    }
};
