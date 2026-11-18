// RenderShell.js
// Render-Shell fuer den Briefing-Generator: Multistep-Rahmen, Progress-Bar, Navigation,
// Dispatcher zu den datengetriebenen Step-Renderern (fieldConfig + FieldRenderer).
// 1:1-Pattern wie src/modules/vertrag/create/RenderShell.js.

import { BriefingCreate } from './BriefingCreateCore.js';
import { PageTransitionHelper } from '../../../core/PageTransitionHelper.js';
import { icon } from '../../../core/icons/IconSystem.js';
import { getStepsForBereich } from './fieldConfig.js';
import { renderStep } from './FieldRenderer.js';
import { renderLikyComposer, renderLikySend, renderLikyColumn, renderLikyEingabe } from '../../../core/chat/likyComposer.js';
import { likyCapability } from '../../../core/chat/likyCapabilities.js';
import { BriefingLikyPanel } from './BriefingLikyPanel.js';

BriefingCreate.prototype.render = function() {
  if (this._isRendering) {
    return;
  }
  this._isRendering = true;

  try {
    this.renderMultistep();
  } finally {
    setTimeout(() => {
      this._isRendering = false;
    }, 50);
  }
};

BriefingCreate.prototype._animateAndRender = function(renderFn) {
  const formPage = document.querySelector('.form-page');
  PageTransitionHelper.transition(formPage, renderFn, {
    newElementSelector: '.form-page'
  });
};

BriefingCreate.prototype.getTotalSteps = function() {
  return getStepsForBereich(this.selectedBereich).length;
};

BriefingCreate.prototype.renderMultistep = function() {
  const stepContent = this.getStepContent();
  // Zentraler Schalter: steht briefing nicht in likyCapabilities, gibt es
  // den Multistep ohne Liky-Spalte (Layout wie vor ADR 0008).
  const mitLiky = !!likyCapability('briefing');

  const formHtml = `
        <form id="briefing-form" data-entity="campaign_briefings">
          <div class="multistep-content">
            ${stepContent}
          </div>
        </form>`;

  const likySide = `
        <aside class="doc__side briefing-liky-side">
          ${renderLikyColumn({
            feedId: 'briefing-liky-feed',
            composer: renderLikyComposer({
              composerId: 'briefing-liky-composer',
              label: 'Kundenbriefing',
              labelFor: 'briefing-liky-input',
              inputHtml: `
                <div class="doc-chat__chips" id="briefing-liky-chips"></div>
                ${renderLikyEingabe({
                  id: 'briefing-liky-input',
                  extraAttrs: 'spellcheck="false"',
                  placeholder: 'Kundenbriefing (PDF) hier reinziehen …'
                })}
              `,
              sendHtml: renderLikySend({ id: 'briefing-liky-send', title: 'Absenden' })
            })
          })}
        </aside>`;

  const html = mitLiky
    ? `<div class="form-page form-page--briefing">
      <div class="doc__shell">
        ${formHtml}
        ${likySide}
      </div>
    </div>`
    : `<div class="form-page form-page--briefing">${formHtml}</div>`;

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
  this.mountLikyPanel();
};

BriefingCreate.prototype.mountLikyPanel = function() {
  if (!document.getElementById('briefing-liky-feed')) return;
  if (!this.likyPanel) {
    this.likyPanel = new BriefingLikyPanel(this);
  }
  this.likyPanel.mount();
};

BriefingCreate.prototype.renderProgressBar = function() {
  const steps = getStepsForBereich(this.selectedBereich);
  const totalSteps = this.getTotalSteps();
  const isEdit = !!this.editId;

  return `
    <div class="progress-steps">
      ${steps.map((step, index) => {
        const stepNum = index + 1;
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
      ${this.currentStep > 1 ? `
        <button type="button" id="btn-prev" class="mdc-btn mdc-btn--secondary">
          ${icon('arrow-left')}
          Zurück
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
  const stepDef = steps[this.currentStep - 1];
  if (!stepDef) return '';
  return renderStep(stepDef, this.formData, this.getFieldContext());
};

BriefingCreate.prototype.getFieldContext = function() {
  return {
    unternehmen: this.unternehmen,
    marke: this.marken,
    kampagne: this.kampagnen,
    // Kein gesperrtes Häkchen: der Typ folgt aus der Content-Verwendung (bereichAbleiten.js)
    bereich: null,
    linieGesperrt: !!this._linieGesperrt,
    produktionGebunden: !!this._produktionKontext?.produktionId
  };
};
