// StepKampagne.js
// Step 4 des Projekt-Erstellen-Flows:
// Grunddaten der ersten Kampagne zu diesem Auftrag.
// Zeitraum und Mengen werden aus Basisdaten bzw. Kampagnenarten übernommen.

export class StepKampagne {
  constructor(wizard) {
    this.wizard = wizard;
    this.host = null;
  }

  render(host) {
    this.host = host;
    const k = this.wizard.formData.kampagne || {};
    const a = this.wizard.formData.auftrag || {};
    const d = this.wizard.formData.details || {};

    const titelSuggestion = a.titel || '';
    const totals = this.calculateTotals(d.campaign_budgets || {}, d.campaign_type || []);
    const zeitraum = a.start || a.ende
      ? `${this.formatDate(a.start)} – ${this.formatDate(a.ende)}`
      : 'Noch kein Zeitraum in den Basisdaten gesetzt';

    host.innerHTML = `
      <div class="form-section projekt-erstellen-section-stack">

        <div class="form-field">
          <label for="field-pe-k-name">Kampagnenname <span class="required">*</span></label>
          <input type="text" id="field-pe-k-name" value="${this.escape(k.kampagnenname || titelSuggestion)}" placeholder="z.B. ${this.escape(titelSuggestion) || 'Kampagnenname'}">
        </div>

        <div class="projekt-erstellen-inline-summary">
          <div class="projekt-erstellen-inline-summary__item">
            <span class="projekt-erstellen-inline-summary__label">Zeitraum aus Basisdaten</span>
            <strong>${this.escape(zeitraum)}</strong>
          </div>
          <div class="projekt-erstellen-inline-summary__item">
            <span class="projekt-erstellen-inline-summary__label">Gesamt Videos</span>
            <strong>${totals.videos}</strong>
          </div>
          <div class="projekt-erstellen-inline-summary__item">
            <span class="projekt-erstellen-inline-summary__label">Gesamt Creator</span>
            <strong>${totals.creators}</strong>
          </div>
        </div>

      </div>
    `;
  }

  calculateTotals(budgets, activeTypes) {
    return (activeTypes || []).reduce((sum, chipValue) => {
      const values = budgets?.[chipValue] || {};
      sum.videos += parseInt(values.video_anzahl, 10) || 0;
      sum.creators += parseInt(values.creator_anzahl, 10) || 0;
      return sum;
    }, { videos: 0, creators: 0 });
  }

  formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
      'field-pe-k-name'
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
    return {
      kampagne: {
        kampagnenname: document.getElementById('field-pe-k-name')?.value || ''
      }
    };
  }

  destroy() {}
}
