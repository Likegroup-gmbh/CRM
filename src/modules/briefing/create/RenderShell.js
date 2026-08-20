// RenderShell.js
// Render-Shell fuer den Briefing-Generator: Schritt 1 (Bereichswahl),
// Multistep-Rahmen, Progress-Bar, Navigation, Dispatcher zu den
// datengetriebenen Step-Renderern (fieldConfig + FieldRenderer).
// 1:1-Pattern wie src/modules/vertrag/create/RenderShell.js.

import { BriefingCreate } from './BriefingCreateCore.js';
import { PageTransitionHelper } from '../../../core/PageTransitionHelper.js';
import { icon } from '../../../core/icons/IconSystem.js';
import { BEREICH_OPTIONS, getStepsForBereich } from './fieldConfig.js';
import { renderStep } from './FieldRenderer.js';

BriefingCreate.prototype.render = function() {
  if (this._isRendering) {
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
    setTimeout(() => {
      this._isRendering = false;
    }, 50);
  }
};

BriefingCreate.prototype.renderStep1 = function() {
  const cards = BEREICH_OPTIONS.map(t => `
    <label class="pe-type-card ${this.selectedBereich === t.value ? 'pe-type-card--selected' : ''}" data-value="${t.value}">
      <input type="radio" name="briefing-bereich" value="${t.value}"
             class="pe-type-card__radio" ${this.selectedBereich === t.value ? 'checked' : ''}>
      <div class="pe-type-card__content">
        <span class="pe-type-card__title">${t.label}</span>
        <span class="pe-type-card__desc">${t.desc}</span>
      </div>
    </label>
  `).join('');

  const html = `
    <div class="form-page pe-fade-in">
      <div class="pe-type-selection">
        <h2 class="pe-type-selection__title">Briefing-Bereich auswaehlen</h2>
        <p class="pe-type-selection__subtitle">Welcher Bereich soll gebrieft werden?</p>
        <div class="pe-type-card-list">
          ${cards}
        </div>
        <div class="pe-type-selection__actions">
          <button type="button" class="mdc-btn mdc-btn--cancel" onclick="window.navigateTo('/briefing')">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="button" id="btn-generate" class="mdc-btn" ${this.selectedBereich ? '' : 'disabled'}>
            Generieren
          </button>
        </div>
      </div>
    </div>
  `;

  window.setContentSafely(window.content, html);
  this.bindStep1Events();
};

BriefingCreate.prototype.bindStep1Events = function() {
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
      this.selectedBereich = value;
      if (generateBtn) generateBtn.disabled = false;
    });
  });

  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      if (this.selectedBereich) {
        this._animateAndRender(() => {
          this.isGenerated = true;
          this.currentStep = 2;
          this.formData.bereich = this.selectedBereich;
          this.render();
        });
      }
    });
  }
};

BriefingCreate.prototype._animateAndRender = function(renderFn) {
  const formPage = document.querySelector('.form-page');
  PageTransitionHelper.transition(formPage, renderFn, {
    newElementSelector: '.form-page'
  });
};

BriefingCreate.prototype.getTotalSteps = function() {
  // Step 1 (Typ) + Master-Steps + Modul-Steps
  return 1 + getStepsForBereich(this.selectedBereich).length;
};

BriefingCreate.prototype.renderMultistep = function() {
  const stepContent = this.getStepContent();

  const html = `
    <div class="form-page">
      <form id="briefing-form" data-entity="campaign_briefings">
        <div class="multistep-content">
          ${stepContent}
        </div>
      </form>
    </div>
  `;

  window.setContentSafely(window.content, html);

  const mainWrapper = document.querySelector('.main-wrapper');
  let progressContainer = document.getElementById('briefing-progress-container');

  if (!progressContainer && mainWrapper) {
    progressContainer = document.createElement('div');
    progressContainer.id = 'briefing-progress-container';
    progressContainer.className = 'multistep-progress';
    mainWrapper.insertBefore(progressContainer, mainWrapper.firstChild);
  }

  if (progressContainer) {
    progressContainer.innerHTML = this.renderProgressBar();
  }

  this.bindProgressBarEvents();
  this.bindMultistepEvents();
  this.initSearchableSelects();
};

BriefingCreate.prototype.renderProgressBar = function() {
  const steps = getStepsForBereich(this.selectedBereich);
  const totalSteps = this.getTotalSteps();
  const isEdit = !!this.editId;

  return `
    <div class="progress-steps">
      ${steps.map((step, index) => {
        const stepNum = index + 2; // Step 1 = Typ-Auswahl
        return `
          <div class="progress-step ${this.currentStep >= stepNum ? 'active' : ''} ${this.currentStep === stepNum ? 'current' : ''}"
               data-step="${stepNum}"
               title="Zu ${step.label} springen">
            <div class="step-number">${index + 1}</div>
            <div class="step-label">${step.label}</div>
          </div>
        `;
      }).join('')}
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
          Zurueck
        </button>
      ` : ''}
      ${this.currentStep < totalSteps ? `
        <button type="button" id="btn-next" class="mdc-btn">
          Weiter
          ${icon('arrow-right')}
        </button>
      ` : `
        <button type="button" id="btn-submit" class="mdc-btn">
          ${isEdit ? 'Briefing aktualisieren' : 'Briefing erstellen'}
        </button>
      `}
    </div>
  `;
};

BriefingCreate.prototype.bindProgressBarEvents = function() {
  const progressContainer = document.getElementById('briefing-progress-container');
  if (!progressContainer) return;

  const steps = progressContainer.querySelectorAll('.progress-step[data-step]');
  steps.forEach(stepEl => {
    stepEl.addEventListener('click', () => {
      const targetStep = parseInt(stepEl.dataset.step, 10);
      this.goToStep(targetStep);
    });
  });
};

BriefingCreate.prototype.goToStep = function(targetStep) {
  if (targetStep === this.currentStep) return;
  this.saveCurrentStepData();
  this._animateAndRender(() => {
    this.currentStep = targetStep;
    this.render();
  });
};

BriefingCreate.prototype.getStepContent = function() {
  const steps = getStepsForBereich(this.selectedBereich);
  const stepDef = steps[this.currentStep - 2]; // Step 2 -> Index 0
  if (!stepDef) return '';
  return renderStep(stepDef, this.formData, this.getFieldContext());
};

BriefingCreate.prototype.getFieldContext = function() {
  return {
    unternehmen: this.unternehmen,
    marke: this.marken,
    benutzer: this.benutzer
  };
};
