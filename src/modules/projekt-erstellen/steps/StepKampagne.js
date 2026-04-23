// StepKampagne.js
// Step 3 des Projekt-Erstellen-Flows:
// Grunddaten der ersten Kampagne zu diesem Auftrag.
// Vorbelegung: unternehmen_id, marke_id aus Step 1, art_der_kampagne aus Step 2.

export class StepKampagne {
  constructor(wizard) {
    this.wizard = wizard;
    this.host = null;
  }

  render(host) {
    this.host = host;
    const k = this.wizard.formData.kampagne || {};
    const a = this.wizard.formData.auftrag || {};

    const titelSuggestion = a.titel || '';
    const drehStart = k.start || a.start || '';
    const drehEnde = k.deadline || a.ende || '';

    host.innerHTML = `
      <div class="form-section projekt-erstellen-section-stack">

        <div class="form-field">
          <label for="field-pe-k-name">Kampagnenname <span class="required">*</span></label>
          <input type="text" id="field-pe-k-name" value="${this.escape(k.kampagnenname || titelSuggestion)}" placeholder="z.B. ${this.escape(titelSuggestion) || 'Kampagnenname'}">
        </div>

        <div class="form-two-col">
          <div class="form-field form-field--half">
            <label for="field-pe-k-start">Start</label>
            <input type="date" id="field-pe-k-start" value="${drehStart}">
          </div>
          <div class="form-field form-field--half">
            <label for="field-pe-k-deadline">Deadline</label>
            <input type="date" id="field-pe-k-deadline" value="${drehEnde}">
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field form-field--half">
            <label for="field-pe-k-creatoranzahl">Creator-Anzahl</label>
            <input type="number" id="field-pe-k-creatoranzahl" min="0" value="${k.creatoranzahl ?? ''}">
          </div>
          <div class="form-field form-field--half">
            <label for="field-pe-k-videoanzahl">Video-Anzahl</label>
            <input type="number" id="field-pe-k-videoanzahl" min="0" value="${k.videoanzahl ?? ''}">
          </div>
        </div>

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
    // Vorbelegung aktualisieren falls User nach Step 1/2 zurueck + vor gesprungen ist
    const nameEl = document.getElementById('field-pe-k-name');
    if (nameEl && !nameEl.value && this.wizard.formData.auftrag?.titel) {
      nameEl.value = this.wizard.formData.auftrag.titel;
    }
  }

  bindEvents() {
    const ids = [
      'field-pe-k-name',
      'field-pe-k-start', 'field-pe-k-deadline',
      'field-pe-k-creatoranzahl', 'field-pe-k-videoanzahl'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener('input', () => this.wizard.onFormDataChange());
    });
  }

  attachLiveUpdate(handler) {
    // noop (already handled via bindEvents)
  }

  collectData() {
    const parseNum = (id) => {
      const v = document.getElementById(id)?.value;
      if (v === '' || v == null) return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };

    return {
      kampagne: {
        kampagnenname: document.getElementById('field-pe-k-name')?.value || '',
        start: document.getElementById('field-pe-k-start')?.value || null,
        deadline: document.getElementById('field-pe-k-deadline')?.value || null,
        creatoranzahl: parseNum('field-pe-k-creatoranzahl'),
        videoanzahl: parseNum('field-pe-k-videoanzahl')
      }
    };
  }

  destroy() {}
}
