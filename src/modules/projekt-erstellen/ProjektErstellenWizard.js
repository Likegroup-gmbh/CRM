// ProjektErstellenWizard.js
// Zentrale Wizard-Klasse: verwaltet State, Step-Navigation und Validation-Orchestrierung.
// Jeder Step ist eine eigene Klasse mit einheitlicher Schnittstelle.

import { StepAuftragstyp } from './steps/StepAuftragstyp.js';
import { StepBasisdaten } from './steps/StepBasisdaten.js';
import { StepDetails } from './steps/StepDetails.js';
import { StepKampagnenarten } from './steps/StepKampagnenarten.js';
import { FeedbackCard } from './components/FeedbackCard.js';
import { WizardProgressBar } from './components/WizardProgressBar.js';
import { ProjektErstellenPersistence } from './services/ProjektErstellenPersistence.js';
import { ProjektErstellenValidator } from './services/ProjektErstellenValidator.js';
import { projektErstellenEditLoader } from './services/ProjektErstellenEditLoader.js';
import {
  buildPartialPoPreview,
  generatePoNummer,
  reservePoGesamtNummer
} from '../auftrag/logic/PoNummerGenerator.js';

export class ProjektErstellenWizard {
  constructor(container) {
    this.container = container;
    this.currentStep = 1;
    this.totalSteps = 3;
    this._isContracting = false;

    // Edit-Mode-State -- wird durch initEditMode() gesetzt
    this.isEditMode = false;
    this.editAuftragId = null;
    this.editKampagneId = null;
    this.editRaw = null;

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
        po_gesamt_nummer: null,
        externe_po: '',
        zahlungsziel_tage: null,
        rechnung_gestellt: false,
        rechnung_gestellt_am: null,
        erwarteter_monat_zahlungseingang: null,
        re_faelligkeit: null,
        nettobetrag: null,
        ust_prozent: 19,
        ust_betrag: null,
        bruttobetrag: null,
        anzahl_teilrechnungen: 1,

        auftragsbestaetigungen_files: [],
        rechnungen_files: []
      },
      details: {
        campaign_type: [],
        campaign_blocks: [],
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
        ksk_type: 'fixed',
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
    this._abort = null;
  }

  get isContracting() {
    return this.formData.auftrag?.auftragtype === 'Contracting';
  }

  getStepLabels() {
    return this.isContracting
      ? ['Basisdaten', 'Finanzen']
      : ['Basisdaten', 'Details', 'Kampagne'];
  }

  buildSteps() {
    if (this.isEditMode) {
      // Im Edit-Mode wird der Auftragstyp nicht mehr abgefragt
      return this.isContracting
        ? [new StepBasisdaten(this), new StepDetails(this)]
        : [new StepBasisdaten(this), new StepDetails(this), new StepKampagnenarten(this)];
    }
    return this.isContracting
      ? [new StepAuftragstyp(this), new StepBasisdaten(this), new StepDetails(this)]
      : [new StepAuftragstyp(this), new StepBasisdaten(this), new StepDetails(this), new StepKampagnenarten(this)];
  }

  updateStepsForAuftragtype() {
    const wasContracting = this._isContracting;
    this._isContracting = this.isContracting;
    if (wasContracting === this._isContracting) return;

    const currentStepInstance = this.steps[this.currentStep - 1];
    if (currentStepInstance?.collectData) {
      this.mergeFormData(currentStepInstance.collectData());
    }

    this.steps = this.buildSteps();
    this.totalSteps = this.steps.length;

    if (this.currentStep > this.totalSteps) {
      this.currentStep = this.totalSteps;
    }

    this.progressBar.labels = this.getStepLabels();
    this.progressBar.update(this.getProgressBarStep());
    this.updateNavButtons();
  }

  async init() {
    this._abort?.abort();
    this._abort = new AbortController();

    this._isContracting = this.isContracting;
    this.steps = this.buildSteps();
    this.totalSteps = this.steps.length;

    this.render();

    const activeStep = this.steps[this.currentStep - 1];
    if (activeStep?.onEnter) {
      await activeStep.onEnter();
    }
    this.updateFeedback();
  }

  async initEditMode(auftragId, { initialStep } = {}) {
    this._abort?.abort();
    this._abort = new AbortController();

    this.isEditMode = true;
    this.editAuftragId = auftragId;

    // Bestehenden Auftrag laden und in formData mappen
    let loaded;
    try {
      loaded = await projektErstellenEditLoader.load(auftragId);
    } catch (e) {
      console.error('❌ ProjektErstellenWizard: Edit-Daten konnten nicht geladen werden', e);
      window.toastSystem?.show('Auftrag konnte nicht geladen werden', 'error');
      throw e;
    }

    this.formData = {
      auftrag: { ...this.formData.auftrag, ...loaded.formData.auftrag },
      details: { ...this.formData.details, ...loaded.formData.details },
      kampagne: { ...this.formData.kampagne, ...loaded.formData.kampagne }
    };
    this.editKampagneId = loaded.raw?.kampagne?.id || null;
    this.editRaw = loaded.raw;

    this._isContracting = this.isContracting;
    this.steps = this.buildSteps();
    this.totalSteps = this.steps.length;

    // initialStep aus benanntem Parameter oder URL ?step= auslesen
    this.currentStep = this._resolveInitialStep(initialStep) || 1;

    this.render();

    const activeStep = this.steps[this.currentStep - 1];
    if (activeStep?.onEnter) {
      await activeStep.onEnter();
    }
    this.updateFeedback();
  }

  _resolveInitialStep(named) {
    const labels = this.getStepLabels().map(l => l.toLowerCase());
    const STEP_MAP = { basis: 'basisdaten', details: 'details', kampagnen: 'kampagne', finanzen: 'finanzen' };

    // 1) Explizit übergebener Name
    let key = named;
    // 2) Fallback: URL-Parameter ?step=
    if (!key) {
      try {
        key = new URL(window.location.href).searchParams.get('step');
      } catch { /* ignore */ }
    }
    if (!key) return null;

    const normalized = STEP_MAP[key.toLowerCase()] || key.toLowerCase();
    const idx = labels.indexOf(normalized);
    return idx >= 0 ? idx + 1 : null;
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
      this.getStepLabels(),
      this.getProgressBarStep(),
      (progressStep) => this.goToStep(this.isEditMode ? progressStep : progressStep + 1)
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
      mainWrapper.insertBefore(container, mainWrapper.firstChild);
    }
    container.className = 'multistep-progress multistep-progress--projekt-erstellen';

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
    const signal = this._abort?.signal;

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.navigate(-1), signal ? { signal } : undefined);
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.navigate(1), signal ? { signal } : undefined);
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
      if (this.currentStep === this.totalSteps) {
        if (this.isEditMode) {
          nextLabel.textContent = 'Änderungen speichern';
        } else {
          nextLabel.textContent = this.isContracting ? 'Contract anlegen' : 'Projekt anlegen';
        }
      } else {
        nextLabel.textContent = 'Weiter';
      }
    }
  }

  get isTypeSelectStep() {
    // Im Edit-Mode gibt es keinen Type-Select-Step
    return !this.isEditMode && this.currentStep === 1;
  }

  // Mappt die aktuelle Step-Position auf die im Validator erwarteten
  // logischen Step-Nummern (1=Auftragstyp, 2=Basisdaten, 3=Details, 4=Kampagne).
  getLogicalStepNumber(stepIndex = this.currentStep) {
    return this.isEditMode ? stepIndex + 1 : stepIndex;
  }

  updateWizardChrome() {
    const progressContainer = document.getElementById('projekt-progress-container');
    const formPage = this.container.querySelector('.form-page--split-wizard');

    if (this.isTypeSelectStep) {
      if (progressContainer) progressContainer.style.display = 'none';
      if (formPage) formPage.classList.add('pe-wizard--type-select');
    } else {
      if (progressContainer) progressContainer.style.display = '';
      if (formPage) formPage.classList.remove('pe-wizard--type-select');
    }
  }

  renderCurrentStep() {
    const host = document.getElementById('wizard-step-host');
    if (!host) return;
    const step = this.steps[this.currentStep - 1];
    if (!step) return;

    this.updateWizardChrome();

    step.render(host);

    if (step.bindEvents) step.bindEvents();

    if (step.attachLiveUpdate) {
      step.attachLiveUpdate(() => this.onFormDataChange());
    }

    this.updateNavButtons();
    if (!this.isTypeSelectStep) {
      this.progressBar?.update(this.getProgressBarStep());
    }
    this.feedbackCard?.update(this.currentStep, this.formData);
  }

  // Mappt currentStep auf den 1-basierten ProgressBar-Index.
  // Create-Mode: Step 1 = Auftragstyp (nicht in Progress), Step 2 = Basisdaten = Progress-Pos 1
  // Edit-Mode: Step 1 = Basisdaten = Progress-Pos 1
  getProgressBarStep() {
    return this.isEditMode ? this.currentStep : Math.max(1, this.currentStep - 1);
  }

  async navigate(direction) {
    const currentStepInstance = this.steps[this.currentStep - 1];
    const leavingTypeSelect = this.isTypeSelectStep && direction > 0;
    const enteringTypeSelect = this.currentStep === 2 && direction < 0;

    if (direction > 0) {
      if (currentStepInstance?.collectData) {
        const collected = currentStepInstance.collectData();
        this.mergeFormData(collected);
      }

      const validation = this.validator.validateStep(this.getLogicalStepNumber(), this.formData);
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

    if (leavingTypeSelect || enteringTypeSelect) {
      await this._animateTransition();
    } else {
      this.renderCurrentStep();
    }

    const activeStep = this.steps[this.currentStep - 1];
    if (activeStep?.onEnter) {
      await activeStep.onEnter();
    }
    this.updateFeedback();
  }

  _animateTransition() {
    return new Promise(resolve => {
      const host = document.getElementById('wizard-step-host');
      const formPage = this.container.querySelector('.form-page--split-wizard');

      if (!host || !formPage) {
        this.renderCurrentStep();
        resolve();
        return;
      }

      formPage.classList.add('pe-fade-out');

      setTimeout(() => {
        this.renderCurrentStep();
        formPage.classList.remove('pe-fade-out');
        formPage.classList.add('pe-fade-in');

        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          formPage.classList.remove('pe-fade-in');
          formPage.removeEventListener('animationend', onDone);
          clearTimeout(fallbackTimer);
          resolve();
        };
        const onDone = () => settle();
        formPage.addEventListener('animationend', onDone);

        const fallbackTimer = setTimeout(settle, 400);
      }, 220);
    });
  }

  async goToStep(targetStep) {
    if (targetStep === this.currentStep) return;
    if (targetStep < 1 || targetStep > this.totalSteps) return;

    const wasTypeSelect = this.isTypeSelectStep;
    const currentStepInstance = this.steps[this.currentStep - 1];
    if (currentStepInstance?.collectData) {
      const collected = currentStepInstance.collectData();
      this.mergeFormData(collected);
    }

    if (targetStep > this.currentStep) {
      for (let s = this.currentStep; s < targetStep; s++) {
        const v = this.validator.validateStep(this.getLogicalStepNumber(s), this.formData);
        if (!v.valid) {
          window.toastSystem?.show(v.errors[0] || `Schritt ${s} ist noch unvollständig`, 'warning');
          return;
        }
      }
    }

    this.currentStep = targetStep;
    const needsTransition = wasTypeSelect || targetStep === 1;

    if (needsTransition) {
      await this._animateTransition();
    } else {
      this.renderCurrentStep();
    }

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

  async ensurePoReserved() {
    if (this.isEditMode) return;

    const a = this.formData.auftrag || {};
    if (a.po_gesamt_nummer) {
      if (!a.po) {
        a.po = buildPartialPoPreview(a.po_gesamt_nummer);
        this.updateFeedback();
      }
      return;
    }

    const result = await reservePoGesamtNummer();
    if (!result.success) {
      console.warn('⚠️ PO-Reservierung fehlgeschlagen:', result.error);
      return;
    }

    a.po_gesamt_nummer = result.gesamtPoNummer;
    a.po = buildPartialPoPreview(result.gesamtPoNummer);
    this.updateFeedback();
  }

  async refreshPoPreview() {
    if (this.isEditMode) return;

    const a = this.formData.auftrag || {};
    if (!a.po_gesamt_nummer || !a.unternehmen_id) return;

    const result = await generatePoNummer(a.unternehmen_id, {
      gesamtPoNummer: a.po_gesamt_nummer
    });

    if (!result.success) {
      console.warn('⚠️ PO-Vorschau konnte nicht aktualisiert werden:', result.error);
      return;
    }

    a.po = result.poNummer;
    this.updateFeedback();
  }

  async submit() {
    const nextBtn = document.getElementById('wizard-next-btn');

    for (let s = 1; s <= this.totalSteps; s++) {
      const v = this.validator.validateStep(this.getLogicalStepNumber(s), this.formData);
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
    const finalLabel = this.isEditMode
      ? 'Änderungen speichern'
      : (this.isContracting ? 'Contract anlegen' : 'Projekt anlegen');

    try {
      if (nextBtn) nextBtn.disabled = true;
      if (nextLabel) nextLabel.textContent = this.isEditMode ? 'Wird gespeichert…' : 'Wird angelegt…';

      const result = this.isEditMode
        ? await this.persistence.submitEdit({
            formData: this.formData,
            auftragId: this.editAuftragId,
            kampagneId: this.editKampagneId,
            existingRaw: this.editRaw
          })
        : await this.persistence.submit({ formData: this.formData });

      if (result.success) {
        const isContract = this.isContracting;
        if (this.isEditMode) {
          window.toastSystem?.show(
            isContract ? 'Contract erfolgreich aktualisiert' : 'Projekt erfolgreich aktualisiert',
            'success'
          );
        } else {
          window.toastSystem?.show(
            isContract ? 'Contract erfolgreich angelegt' : 'Projekt erfolgreich angelegt',
            'success'
          );
        }

        if (Array.isArray(result.uploadErrors) && result.uploadErrors.length > 0) {
          const failedNames = result.uploadErrors.map(e => e.fileName).join(', ');
          window.toastSystem?.show(
            `Hinweis: ${result.uploadErrors.length} Datei(en) konnten nicht hochgeladen werden: ${failedNames}`,
            'warning'
          );
        }

        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: {
            entity: 'auftrag',
            action: this.isEditMode ? 'updated' : 'created',
            id: result.auftragId
          }
        }));
        if (this.isEditMode) {
          window.dispatchEvent(new CustomEvent('entityUpdated', {
            detail: { entity: 'auftrag_details', action: 'updated', auftrag_id: result.auftragId }
          }));
        }
        if (result.kampagneId) {
          window.dispatchEvent(new CustomEvent('entityUpdated', {
            detail: {
              entity: 'kampagne',
              action: this.isEditMode ? 'updated' : 'created',
              id: result.kampagneId
            }
          }));
        }

        setTimeout(() => {
          const target = isContract
            ? `/contracts/${result.auftragId}`
            : `/auftrag/${result.auftragId}`;
          window.navigateTo?.(target);
        }, 1200);
      } else {
        window.toastSystem?.show(
          result.error || (this.isEditMode ? 'Projekt konnte nicht aktualisiert werden' : 'Projekt konnte nicht angelegt werden'),
          'error'
        );
        if (nextBtn) nextBtn.disabled = false;
        if (nextLabel) nextLabel.textContent = finalLabel;
      }
    } catch (e) {
      console.error('❌ Submit Fehler:', e);
      window.toastSystem?.show('Ein unerwarteter Fehler ist aufgetreten', 'error');
      if (nextBtn) nextBtn.disabled = false;
      if (nextLabel) nextLabel.textContent = finalLabel;
    }
  }

  destroy() {
    this._destroyed = true;
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* noop */ }
      this._abort = null;
    }
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
