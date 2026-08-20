// RenderShell.js
// Render-Shell fuer die Vertragserstellung: Schritt 1 (Typwahl), Multistep-Rahmen,
// Progress-Bar, Navigation, Dispatcher zu den typ-spezifischen Step-Renderern.

import { VertraegeCreate } from './VertraegeCreateCore.js';
import { PageTransitionHelper } from '../../../core/PageTransitionHelper.js';
import { icon } from '../../../core/icons/IconSystem.js';

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
    const types = [
      { value: 'UGC', label: 'UGC-Produktionsvertrag', desc: 'Content-Produktion durch Creator nach Briefing.' },
      { value: 'Influencer Kooperation', label: 'Influencer Kooperation', desc: 'Kooperationsvertrag für Influencer-Kampagnen.' },
      { value: 'Videograph', label: 'Videograph', desc: 'Produktionsvertrag für Videografen und Fotografen.' },
      { value: 'Model', label: 'Modelvertrag', desc: 'Vertrag für Model-Buchungen und Shootings.' },
      { value: 'Contracting', label: 'Contracting', desc: 'Influencer-Marketing-Vertrag direkt zu einem Contracting-Auftrag.' }
    ];

    const cards = types.map(t => `
      <label class="pe-type-card ${this.selectedTyp === t.value ? 'pe-type-card--selected' : ''}" data-value="${t.value}">
        <input type="radio" name="vertrag-typ" value="${t.value}"
               class="pe-type-card__radio" ${this.selectedTyp === t.value ? 'checked' : ''}>
        <div class="pe-type-card__content">
          <span class="pe-type-card__title">${t.label}</span>
          <span class="pe-type-card__desc">${t.desc}</span>
        </div>
      </label>
    `).join('');

    const html = `
      <div class="form-page pe-fade-in">
        <div class="pe-type-selection">
          <h2 class="pe-type-selection__title">Vertragstyp auswählen</h2>
          <p class="pe-type-selection__subtitle">Wählen Sie den Vertragstyp, um fortzufahren.</p>
          <div class="pe-type-card-list">
            ${cards}
          </div>
          <div class="pe-type-selection__actions">
            <button type="button" class="mdc-btn mdc-btn--cancel" onclick="window.navigateTo('/vertraege')">
              <span class="mdc-btn__label">Abbrechen</span>
            </button>
            <button type="button" id="btn-generate" class="mdc-btn" ${this.selectedTyp ? '' : 'disabled'}>
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
    const cards = document.querySelectorAll('.pe-type-card');
    const generateBtn = document.getElementById('btn-generate');

    cards.forEach(card => {
      card.addEventListener('click', () => {
        const value = card.dataset.value;
        if (!value) return;
        cards.forEach(c => c.classList.remove('pe-type-card--selected'));
        card.classList.add('pe-type-card--selected');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        this.selectedTyp = value;
        if (generateBtn) generateBtn.disabled = false;
      });
    });

    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        if (this.selectedTyp) {
          this._animateAndRender(() => {
            this.isGenerated = true;
            this.currentStep = 2;
            this.formData.typ = this.selectedTyp;
            this.render();
          });
        }
      });
    }
};

VertraegeCreate.prototype._animateAndRender = function(renderFn) {
    const formPage = document.querySelector('.form-page');
    PageTransitionHelper.transition(formPage, renderFn, {
      newElementSelector: '.form-page'
    });
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
        <button type="button" id="btn-save-draft" class="mdc-btn mdc-btn--secondary" title="Als Entwurf in der Datenbank speichern">
          ${icon('inbox')}
          <span class="btn-label">Als Entwurf speichern</span>
        </button>
        ${this.currentStep >= 2 ? `
          <button type="button" id="btn-prev" class="mdc-btn mdc-btn--secondary">
            ${icon('arrow-left')}
            Zurück
          </button>
        ` : ''}
        ${this.currentStep === this.totalSteps ? `
          <div class="contract-language-switch" role="group" aria-label="Vertragssprache">
            <span class="contract-language-switch__label">Sprache:</span>
            <button type="button" class="mdc-btn mdc-btn--secondary ${selectedLanguage === 'de' ? 'btn-active' : ''}" data-contract-lang="de">
              Deutsch
            </button>
            <button type="button" class="mdc-btn mdc-btn--secondary ${selectedLanguage === 'en' ? 'btn-active' : ''}" data-contract-lang="en">
              English
            </button>
          </div>
        ` : ''}
        ${this.currentStep < this.totalSteps ? `
          <button type="button" id="btn-next" class="mdc-btn">
            Weiter
            ${icon('arrow-right')}
          </button>
        ` : `
          <button type="button" id="btn-submit" class="mdc-btn">
            ${isEdit ? 'Finalisieren & PDF' : 'Erstellen & PDF'}
          </button>
          <button type="button" id="btn-submit-and-new" class="mdc-btn mdc-btn--secondary" title="Vertrag erstellen und mit gleichen Daten neuen starten">
            ${icon('arrow-path')}
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
    if (targetStep === this.currentStep) return;
    this.saveCurrentStepData();
    this._animateAndRender(() => {
      this.currentStep = targetStep;
      this.render();
    });
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

    // Contracting-Vertrag
    if (this.selectedTyp === 'Contracting') {
      switch (this.currentStep) {
        case 2: return this.renderContractingStep2(); // Parteien (Unternehmen + Auftrag + Creator)
        case 3: return this.renderContractingStep3(); // Plattformen + Content
        case 4: return this.renderContractingStep4(); // Media Buyout + Freigabe
        case 5: return this.renderContractingStep5(); // Vergütung + Exklusivität
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
