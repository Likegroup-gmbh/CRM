// ProjektErstellenWizard.js
// Zentrale Wizard-Klasse: verwaltet State, Step-Navigation und Validation-Orchestrierung.
// Jeder Step ist eine eigene Klasse mit einheitlicher Schnittstelle.

import { StepBasisdaten } from './steps/StepBasisdaten.js';
import { StepDetails } from './steps/StepDetails.js';
import { StepKampagnenarten } from './steps/StepKampagnenarten.js';
import { StepKampagne } from './steps/StepKampagne.js';
import { FeedbackCard } from './components/FeedbackCard.js';
import { WizardProgressBar } from './components/WizardProgressBar.js';
import { ProjektErstellenPersistence } from './services/ProjektErstellenPersistence.js';
import { ProjektErstellenValidator } from './services/ProjektErstellenValidator.js';

export class ProjektErstellenWizard {
  constructor(container) {
    this.container = container;
    this.currentStep = 1;
    this.totalSteps = 4;

    this.formData = {
      auftrag: {
        unternehmen_id: null,
        marke_id: null,
        ansprechpartner_id: null,
        auftragtype: null,
        start: null,
        ende: null,
        titel: '',
        titel_manuell_geaendert: false,

        angebotsnummer: '',
        re_nr: '',
        po: '',
        externe_po: '',
        zahlungsziel_tage: null,
        rechnung_gestellt: false,
        rechnung_gestellt_am: null,
        erwarteter_monat_zahlungseingang: null,
        re_faelligkeit: null,
        nettobetrag: null,
        ust_prozent: null,
        ust_betrag: null,
        bruttobetrag: null
      },
      details: {
        campaign_type: [],
        campaign_budgets: {},
        agency_services_enabled: false,
        retainer_type: 'none',
        retainer_amount: 0,
        extra_services_enabled: false,
        extra_services: [],
        percentage_fee_enabled: false,
        percentage_fee_value: 0,
        percentage_fee_base: 'total_budget',
        ksk_enabled: false,
        ksk_type: 'percentage',
        ksk_value: 0
      },
      kampagne: {}
    };

    this.persistence = new ProjektErstellenPersistence();
    this.validator = new ProjektErstellenValidator();

    this.progressBar = null;
    this.feedbackCard = null;
    this.steps = null;

    this._destroyed = false;
  }

  async init() {
    this.steps = [
      new StepBasisdaten(this),
      new StepDetails(this),
      new StepKampagnenarten(this),
      new StepKampagne(this)
    ];

    this.render();

    const activeStep = this.steps[this.currentStep - 1];
    if (activeStep?.onEnter) {
      await activeStep.onEnter();
    }
    this.updateFeedback();
  }

  render() {
    const html = `
      <div class="form-page form-page--split-wizard">
        <div class="form-split-container projekt-erstellen-container">

          <div class="form-split-left">
            <div id="wizard-step-host" class="projekt-erstellen-step-host"></div>
          </div>

          <div class="form-split-right projekt-erstellen-feedback-col">
            <div id="wizard-feedback-host" class="projekt-erstellen-feedback-sticky"></div>
          </div>

        </div>
      </div>
    `;

    this.container.innerHTML = html;

    this.mountProgressShell();

    this.progressBar = new WizardProgressBar(
      document.getElementById('projekt-progress-steps'),
      ['Basisdaten', 'Details', 'Kampagnenarten', 'Kampagne'],
      this.currentStep,
      (targetStep) => this.goToStep(targetStep)
    );
    this.progressBar.render();

    this.feedbackCard = new FeedbackCard(
      document.getElementById('wizard-feedback-host'),
      this
    );
    this.feedbackCard.render();

    this.renderCurrentStep();
    this.bindNavigation();
  }

  mountProgressShell() {
    const mainWrapper = document.querySelector('.main-wrapper');
    if (!mainWrapper) return;

    let container = document.getElementById('projekt-progress-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'projekt-progress-container';
      container.className = 'multistep-progress';
      mainWrapper.insertBefore(container, mainWrapper.firstChild);
    }

    container.innerHTML = `
      <div id="projekt-progress-steps"></div>
      <div class="progress-actions">
        <button type="button" class="secondary-btn" id="wizard-prev-btn">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Zurück
        </button>
        <button type="button" class="primary-btn" id="wizard-next-btn">
          <span id="wizard-next-btn-label">Weiter</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    `;
  }

  bindNavigation() {
    const prevBtn = document.getElementById('wizard-prev-btn');
    const nextBtn = document.getElementById('wizard-next-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.navigate(-1));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.navigate(1));
    }

    this.updateNavButtons();
  }

  updateNavButtons() {
    const prevBtn = document.getElementById('wizard-prev-btn');
    const nextBtn = document.getElementById('wizard-next-btn');
    const nextLabel = document.getElementById('wizard-next-btn-label');
    if (!prevBtn || !nextBtn) return;

    prevBtn.style.visibility = this.currentStep > 1 ? 'visible' : 'hidden';
    if (nextLabel) {
      nextLabel.textContent = this.currentStep === this.totalSteps ? 'Projekt anlegen' : 'Weiter';
    }
  }

  renderCurrentStep() {
    const host = document.getElementById('wizard-step-host');
    if (!host) return;
    const step = this.steps[this.currentStep - 1];
    if (!step) return;

    step.render(host);

    if (step.bindEvents) step.bindEvents();

    if (step.attachLiveUpdate) {
      step.attachLiveUpdate(() => this.onFormDataChange());
    }

    this.updateNavButtons();
    this.progressBar?.update(this.currentStep);
    this.feedbackCard?.update(this.currentStep, this.formData);
  }

  async navigate(direction) {
    const currentStepInstance = this.steps[this.currentStep - 1];

    if (direction > 0) {
      if (currentStepInstance?.collectData) {
        const collected = currentStepInstance.collectData();
        this.mergeFormData(collected);
      }

      const validation = this.validator.validateStep(this.currentStep, this.formData);
      if (!validation.valid) {
        window.toastSystem?.show(validation.errors[0] || 'Bitte alle Pflichtfelder ausfüllen', 'error');
        return;
      }

      if (this.currentStep === this.totalSteps) {
        await this.submit();
        return;
      }

      this.currentStep += 1;
    } else {
      if (currentStepInstance?.collectData) {
        const collected = currentStepInstance.collectData();
        this.mergeFormData(collected);
      }
      if (this.currentStep > 1) this.currentStep -= 1;
    }

    this.renderCurrentStep();
    const activeStep = this.steps[this.currentStep - 1];
    if (activeStep?.onEnter) {
      await activeStep.onEnter();
    }
    this.updateFeedback();
  }

  async goToStep(targetStep) {
    if (targetStep === this.currentStep) return;
    if (targetStep < 1 || targetStep > this.totalSteps) return;

    const currentStepInstance = this.steps[this.currentStep - 1];
    if (currentStepInstance?.collectData) {
      const collected = currentStepInstance.collectData();
      this.mergeFormData(collected);
    }

    if (targetStep > this.currentStep) {
      for (let s = this.currentStep; s < targetStep; s++) {
        const v = this.validator.validateStep(s, this.formData);
        if (!v.valid) {
          window.toastSystem?.show(v.errors[0] || `Schritt ${s} ist noch unvollständig`, 'warning');
          return;
        }
      }
    }

    this.currentStep = targetStep;
    this.renderCurrentStep();
    const activeStep = this.steps[this.currentStep - 1];
    if (activeStep?.onEnter) {
      await activeStep.onEnter();
    }
    this.updateFeedback();
  }

  mergeFormData(partial) {
    if (!partial || typeof partial !== 'object') return;
    if (partial.auftrag) this.formData.auftrag = { ...this.formData.auftrag, ...partial.auftrag };
    if (partial.details) this.formData.details = { ...this.formData.details, ...partial.details };
    if (partial.kampagne) this.formData.kampagne = { ...this.formData.kampagne, ...partial.kampagne };
  }

  onFormDataChange() {
    const currentStepInstance = this.steps[this.currentStep - 1];
    if (currentStepInstance?.collectData) {
      const collected = currentStepInstance.collectData();
      this.mergeFormData(collected);
    }
    this.updateFeedback();
  }

  updateFeedback() {
    this.feedbackCard?.update(this.currentStep, this.formData);
  }

  async submit() {
    const nextBtn = document.getElementById('wizard-next-btn');

    for (let s = 1; s <= this.totalSteps; s++) {
      const v = this.validator.validateStep(s, this.formData);
      if (!v.valid) {
        window.toastSystem?.show(`Schritt ${s}: ${v.errors[0]}`, 'error');
        this.currentStep = s;
        this.renderCurrentStep();
        const activeStep = this.steps[this.currentStep - 1];
        if (activeStep?.onEnter) await activeStep.onEnter();
        this.updateFeedback();
        return;
      }
    }

    const nextLabel = document.getElementById('wizard-next-btn-label');
    try {
      if (nextBtn) nextBtn.disabled = true;
      if (nextLabel) nextLabel.textContent = 'Wird angelegt…';

      const result = await this.persistence.submit({
        formData: this.formData
      });

      if (result.success) {
        window.toastSystem?.show('Projekt erfolgreich angelegt', 'success');

        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'auftrag', action: 'created', id: result.auftragId }
        }));

        setTimeout(() => {
          window.navigateTo?.(`/auftrag/${result.auftragId}`);
        }, 1200);
      } else {
        window.toastSystem?.show(result.error || 'Projekt konnte nicht angelegt werden', 'error');
        if (nextBtn) nextBtn.disabled = false;
        if (nextLabel) nextLabel.textContent = 'Projekt anlegen';
      }
    } catch (e) {
      console.error('❌ Submit Fehler:', e);
      window.toastSystem?.show('Ein unerwarteter Fehler ist aufgetreten', 'error');
      if (nextBtn) nextBtn.disabled = false;
      if (nextLabel) nextLabel.textContent = 'Projekt anlegen';
    }
  }

  destroy() {
    this._destroyed = true;
    if (this.steps) {
      this.steps.forEach(s => {
        if (s?.destroy) {
          try { s.destroy(); } catch (_) { /* noop */ }
        }
      });
      this.steps = null;
    }
    this.progressBar = null;
    this.feedbackCard = null;

    const progressContainer = document.getElementById('projekt-progress-container');
    if (progressContainer) progressContainer.remove();
  }
}
