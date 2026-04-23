// StepDetails.js
// Step 2 des Projekt-Erstellen-Flows:
// Agenturleistungen, Administrative- und Finanzdaten.

import { AgencyServicesBlock } from '../components/AgencyServicesBlock.js';

export class StepDetails {
  constructor(wizard) {
    this.wizard = wizard;
    this.host = null;
    this.agencyBlock = null;
  }

  render(host) {
    this.host = host;
    const a = this.wizard.formData.auftrag || {};

    host.innerHTML = `
      <div class="form-section projekt-erstellen-section-stack">

        <div>
          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="field-pe-angebotsnummer">Angebotsnummer</label>
              <input type="text" id="field-pe-angebotsnummer" value="${this.escape(a.angebotsnummer)}">
            </div>
            <div class="form-field form-field--half">
              <label for="field-pe-re_nr">Rechnungsnummer</label>
              <input type="text" id="field-pe-re_nr" value="${this.escape(a.re_nr)}">
            </div>
          </div>
          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="field-pe-po">Interne PO</label>
              <input type="text" id="field-pe-po" value="${this.escape(a.po)}" readonly placeholder="Wird beim Speichern automatisch generiert">
            </div>
            <div class="form-field form-field--half">
              <label for="field-pe-externe_po">Externe PO</label>
              <input type="text" id="field-pe-externe_po" value="${this.escape(a.externe_po)}">
            </div>
          </div>
          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="field-pe-zahlungsziel_tage">Zahlungsziel</label>
              <select id="field-pe-zahlungsziel_tage">
                <option value="">Zahlungsziel auswählen...</option>
                <option value="0" ${String(a.zahlungsziel_tage) === '0' ? 'selected' : ''}>Sofort</option>
                <option value="14" ${String(a.zahlungsziel_tage) === '14' ? 'selected' : ''}>14 Tage</option>
                <option value="30" ${String(a.zahlungsziel_tage) === '30' ? 'selected' : ''}>30 Tage</option>
                <option value="45" ${String(a.zahlungsziel_tage) === '45' ? 'selected' : ''}>45 Tage</option>
                <option value="60" ${String(a.zahlungsziel_tage) === '60' ? 'selected' : ''}>60 Tage</option>
              </select>
            </div>
            <div class="form-field form-field--half">
              <label for="field-pe-rechnung_gestellt_am">Rechnung gestellt am</label>
              <input type="date" id="field-pe-rechnung_gestellt_am" value="${a.rechnung_gestellt_am || ''}">
            </div>
          </div>
          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="field-pe-re_faelligkeit">Rechnungsfälligkeit</label>
              <input type="date" id="field-pe-re_faelligkeit" value="${a.re_faelligkeit || ''}">
            </div>
            <div class="form-field form-field--half">
              <label for="field-pe-erwarteter_monat_zahlungseingang">Erwarteter Zahlungseingang</label>
              <input type="date" id="field-pe-erwarteter_monat_zahlungseingang" value="${a.erwarteter_monat_zahlungseingang || ''}">
            </div>
          </div>
        </div>

        <div>
          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="field-pe-nettobetrag">Netto (€)</label>
              <input type="number" id="field-pe-nettobetrag" step="0.01" min="0" value="${a.nettobetrag ?? ''}">
            </div>
            <div class="form-field form-field--half">
              <label for="field-pe-ust_prozent">USt (%)</label>
              <input type="number" id="field-pe-ust_prozent" step="0.01" min="0" value="${a.ust_prozent ?? 19}">
            </div>
          </div>
          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="field-pe-ust_betrag">USt-Betrag (€)</label>
              <input type="number" id="field-pe-ust_betrag" step="0.01" min="0" value="${a.ust_betrag ?? ''}" readonly>
            </div>
            <div class="form-field form-field--half">
              <label for="field-pe-bruttobetrag">Brutto (€)</label>
              <input type="number" id="field-pe-bruttobetrag" step="0.01" min="0" value="${a.bruttobetrag ?? ''}" readonly>
            </div>
          </div>
        </div>

        <div id="pe-agency-host"></div>

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
    // Subsection Styles (nur einmal)
    if (!document.getElementById('projekt-erstellen-step2-styles')) {
      const style = document.createElement('style');
      style.id = 'projekt-erstellen-step2-styles';
      style.textContent = `
        .projekt-erstellen-agency-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-md);
          margin-bottom: var(--space-sm);
        }
        .projekt-erstellen-subsection {
          border-top: var(--border-xs) solid var(--gray-200);
          padding-top: var(--space-md);
          margin-top: var(--space-md);
        }
        .projekt-erstellen-subsection:first-child {
          border-top: none;
          padding-top: 0;
          margin-top: 0;
        }
        .projekt-erstellen-subsection-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-sm);
          margin-bottom: var(--space-sm);
        }
        .section-subtitle {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 var(--space-xs) 0;
        }
        .projekt-erstellen-extras-toolbar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: var(--space-sm);
        }
      `;
      document.head.appendChild(style);
    }
  }

  bindEvents() {
    this.agencyBlock = new AgencyServicesBlock({
      hostId: 'pe-agency-host',
      data: this.wizard.formData.details,
      onChange: (val) => {
        this.wizard.formData.details = { ...this.wizard.formData.details, ...val };
        this.wizard.updateFeedback();
      }
    });
    this.agencyBlock.render();

    const recalcBrutto = () => {
      const net = parseFloat(document.getElementById('field-pe-nettobetrag')?.value);
      const ust = parseFloat(document.getElementById('field-pe-ust_prozent')?.value);
      const ustBetragEl = document.getElementById('field-pe-ust_betrag');
      const bruttoEl = document.getElementById('field-pe-bruttobetrag');
      if (!isNaN(net) && !isNaN(ust)) {
        const u = +(net * ust / 100).toFixed(2);
        const b = +(net + u).toFixed(2);
        if (ustBetragEl) ustBetragEl.value = u;
        if (bruttoEl) bruttoEl.value = b;
        this.wizard.formData.auftrag.ust_betrag = u;
        this.wizard.formData.auftrag.bruttobetrag = b;
      }
    };
    document.getElementById('field-pe-nettobetrag')?.addEventListener('input', recalcBrutto);
    document.getElementById('field-pe-ust_prozent')?.addEventListener('input', recalcBrutto);

    const recalcFaelligkeit = () => {
      const reDate = document.getElementById('field-pe-rechnung_gestellt_am')?.value;
      const ziel = parseInt(document.getElementById('field-pe-zahlungsziel_tage')?.value, 10);
      const fEl = document.getElementById('field-pe-re_faelligkeit');
      if (!fEl) return;
      if (reDate && !isNaN(ziel)) {
        const d = new Date(reDate);
        d.setDate(d.getDate() + ziel);
        fEl.value = d.toISOString().slice(0, 10);
        this.wizard.formData.auftrag.re_faelligkeit = fEl.value;
      }
    };
    document.getElementById('field-pe-rechnung_gestellt_am')?.addEventListener('input', recalcFaelligkeit);
    document.getElementById('field-pe-zahlungsziel_tage')?.addEventListener('change', recalcFaelligkeit);

    // Live update fuer alle Admin + Finance Inputs
    const syncInputs = [
      'field-pe-angebotsnummer', 'field-pe-re_nr', 'field-pe-externe_po',
      'field-pe-zahlungsziel_tage', 'field-pe-rechnung_gestellt_am',
      'field-pe-re_faelligkeit', 'field-pe-erwarteter_monat_zahlungseingang',
      'field-pe-nettobetrag', 'field-pe-ust_prozent'
    ];
    syncInputs.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => {
        this.wizard.onFormDataChange();
      });
    });
  }

  attachLiveUpdate(handler) {
    // onChange passt bereits direkt an; nichts weiteres zu tun.
  }

  collectData() {
    const details = this.agencyBlock
      ? this.agencyBlock.getValue()
      : {
          agency_services_enabled: !!this.wizard.formData.details?.agency_services_enabled,
          retainer_type: this.wizard.formData.details?.retainer_type || 'none',
          retainer_amount: this.wizard.formData.details?.retainer_amount ?? 0,
          extra_services_enabled: !!this.wizard.formData.details?.extra_services_enabled,
          extra_services: Array.isArray(this.wizard.formData.details?.extra_services)
            ? this.wizard.formData.details.extra_services.slice()
            : [],
          percentage_fee_enabled: !!this.wizard.formData.details?.percentage_fee_enabled,
          percentage_fee_value: this.wizard.formData.details?.percentage_fee_value ?? 0,
          percentage_fee_base: this.wizard.formData.details?.percentage_fee_base || 'total_budget',
          ksk_enabled: !!this.wizard.formData.details?.ksk_enabled,
          ksk_type: 'percentage',
          ksk_value: this.wizard.formData.details?.ksk_value ?? 0
        };

    const parseNum = (id) => {
      const v = document.getElementById(id)?.value;
      if (v === '' || v == null) return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };
    const parseInt10 = (id) => {
      const v = document.getElementById(id)?.value;
      if (v === '' || v == null) return null;
      const n = parseInt(v, 10);
      return isNaN(n) ? null : n;
    };

    const auftrag = {
      angebotsnummer: document.getElementById('field-pe-angebotsnummer')?.value || '',
      re_nr: document.getElementById('field-pe-re_nr')?.value || '',
      po: document.getElementById('field-pe-po')?.value || this.wizard.formData.auftrag.po || '',
      externe_po: document.getElementById('field-pe-externe_po')?.value || '',
      zahlungsziel_tage: parseInt10('field-pe-zahlungsziel_tage'),
      rechnung_gestellt_am: document.getElementById('field-pe-rechnung_gestellt_am')?.value || null,
      re_faelligkeit: document.getElementById('field-pe-re_faelligkeit')?.value || null,
      erwarteter_monat_zahlungseingang: document.getElementById('field-pe-erwarteter_monat_zahlungseingang')?.value || null,
      nettobetrag: parseNum('field-pe-nettobetrag'),
      ust_prozent: parseNum('field-pe-ust_prozent'),
      ust_betrag: parseNum('field-pe-ust_betrag'),
      bruttobetrag: parseNum('field-pe-bruttobetrag')
    };

    return { details, auftrag };
  }

  destroy() {
    this.agencyBlock = null;
  }
}
