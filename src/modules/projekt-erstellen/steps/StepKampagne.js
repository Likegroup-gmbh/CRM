// StepKampagne.js
// Dritter Wizard-Step (Non-Contracting): Projektname + Kampagnenarten + Agenturleistungen.
// Vereint das Titel-Feld (vorher StepBasisdaten) mit den Kampagnenarten (vorher in StepDetails eingebettet).

import { TitelGenerator, generateAuftragTitle } from '../components/TitelGenerator.js';
import { StepKampagnenarten } from './StepKampagnenarten.js';

export class StepKampagne {
  constructor(wizard) {
    this.wizard = wizard;
    this.host = null;
    this.titelGenerator = null;
    this.kampagnenStep = null;
  }

  render(host) {
    this.host = host;
    const a = this.wizard.formData.auftrag || {};

    host.innerHTML = `
      <div class="form-section projekt-erstellen-section-stack">

        <div class="projekt-erstellen-titel-wrap">
          <div class="form-field">
            <label for="field-pe-titel">Projektname <span class="required">*</span></label>
            <input type="text" id="field-pe-titel" name="titel" value="${this.escape(a.titel)}" placeholder="Wird aus Unternehmen, Art und Startdatum generiert..." autocomplete="off">
          </div>
          <button type="button" class="secondary-btn" id="pe-titel-reset-btn" title="Vorschlag zurücksetzen" style="display:none;">Vorschlag nutzen</button>
        </div>

        <div id="pe-kampagnen-host"></div>

      </div>
    `;
  }

  escape(v) {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async onEnter() {
    this.recomputeTitle();

    if (this.kampagnenStep?.onEnter) {
      await this.kampagnenStep.onEnter();
    }
  }

  bindEvents() {
    this.titelGenerator = new TitelGenerator({
      rootEl: this.host,
      onChange: ({ titel, manual, reset }) => {
        if (reset) {
          this.wizard.formData.auftrag.titel_manuell_geaendert = false;
          this.recomputeTitle();
          this.wizard.updateFeedback();
          return;
        }
        this.wizard.formData.auftrag.titel = titel || '';
        this.wizard.formData.auftrag.titel_manuell_geaendert = !!manual;
        this.wizard.updateFeedback();
      }
    });
    this.titelGenerator.bind('field-pe-titel', 'pe-titel-reset-btn');
    this.titelGenerator.setInitial(
      this.wizard.formData.auftrag.titel,
      this.wizard.formData.auftrag.titel_manuell_geaendert
    );

    this._mountKampagnenarten();
  }

  _mountKampagnenarten() {
    const kampagnenHost = document.getElementById('pe-kampagnen-host');
    if (!kampagnenHost) return;

    this.kampagnenStep = new StepKampagnenarten(this.wizard);
    this.kampagnenStep.render(kampagnenHost);
    this.kampagnenStep.bindEvents();
  }

  recomputeTitle() {
    if (!this.titelGenerator) return;
    const a = this.wizard.formData.auftrag;
    const basisdatenStep = this.wizard.steps?.find(s => s.constructor.name === 'StepBasisdaten');
    if (!basisdatenStep) return;
    const unternehmenOption = basisdatenStep.unternehmenOptions?.find(o => o.value === a.unternehmen_id);
    const displayName = unternehmenOption?.internes_kuerzel || unternehmenOption?.label || null;
    this.titelGenerator.recompute({
      unternehmensname: displayName,
      auftragType: a.auftragtype,
      startDate: a.start
    });
  }

  attachLiveUpdate(handler) {
    // Updates laufen direkt ueber TitelGenerator + StepKampagnenarten Events.
  }

  collectData() {
    const titel = document.getElementById('field-pe-titel')?.value || '';

    let details = {};
    let kampagne = {};
    if (this.kampagnenStep) {
      const kData = this.kampagnenStep.collectData();
      if (kData.details) details = kData.details;
      if (kData.kampagne) kampagne = kData.kampagne;
    }

    return {
      auftrag: {
        titel,
        titel_manuell_geaendert: this.wizard.formData.auftrag.titel_manuell_geaendert
      },
      details,
      kampagne
    };
  }

  destroy() {
    this.titelGenerator = null;
    if (this.kampagnenStep?.destroy) this.kampagnenStep.destroy();
    this.kampagnenStep = null;
  }
}
