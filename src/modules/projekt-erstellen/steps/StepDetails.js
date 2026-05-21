// StepDetails.js
// Step 2 des Projekt-Erstellen-Flows:
// Block 1: Angebot & Budget (inkl. Leistungszeitraum)
// Block 2: Rechnung
// Agenturleistungen nur bei Contracting (bei UGC/Vorort -> StepKampagnenarten)

import { AgencyServicesBlock } from '../components/AgencyServicesBlock.js';
import { CustomDatePicker } from '../../../core/components/CustomDatePicker.js';
import { generateAuftragTitle } from '../components/TitelGenerator.js';

const DEFAULT_UST_PROZENT = 19;

export class StepDetails {
  constructor(wizard) {
    this.wizard = wizard;
    this.host = null;
    this.agencyBlock = null;
    this.angebotsnummerOptions = [];
    this._datePickerCleanup = null;
  }

  get isContracting() {
    return this.wizard.formData.auftrag?.auftragtype === 'Contracting';
  }

  render(host) {
    this.host = host;
    const a = this.wizard.formData.auftrag || {};

    host.innerHTML = `
      <div class="form-section projekt-erstellen-section-stack">

        <div class="projekt-erstellen-subsection">
          <h5 class="section-subtitle">Angebot & Budget</h5>

          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="field-pe-angebotsnummer">Angebotsnummer <span class="required">*</span></label>
              <input type="text" id="field-pe-angebotsnummer" list="field-pe-angebotsnummer-options" value="${this.escape(a.angebotsnummer)}" required>
              <datalist id="field-pe-angebotsnummer-options"></datalist>
            </div>
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
          </div>

          <div class="form-field">
            <span class="section-subtitle" style="font-size: var(--text-xs); margin-bottom: var(--space-xs); display: block;">Leistungszeitraum</span>
            <div class="form-two-col">
              <div class="form-field form-field--half">
                <label for="field-pe-start">von</label>
                ${CustomDatePicker.render({ id: 'pe-start', field: 'start', value: a.start, label: 'von', variant: 'native', entity: 'projekt-erstellen' })}
              </div>
              <div class="form-field form-field--half">
                <label for="field-pe-ende">bis</label>
                ${CustomDatePicker.render({ id: 'pe-ende', field: 'ende', value: a.ende, label: 'bis', variant: 'native', entity: 'projekt-erstellen' })}
              </div>
            </div>
          </div>

          <div class="form-field">
            <label for="field-pe-anzahl_teilrechnungen">Anzahl Rechnungen / Teilrechnungen</label>
            <input type="number" id="field-pe-anzahl_teilrechnungen" min="1" step="1" value="${a.anzahl_teilrechnungen ?? 1}">
          </div>

          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="field-pe-nettobetrag">Netto (€)</label>
              <input type="number" id="field-pe-nettobetrag" step="0.01" min="0" value="${a.nettobetrag ?? ''}">
            </div>
            <div class="form-field form-field--half">
              <label for="field-pe-ust_betrag">MwSt-Gesamtbetrag (€)</label>
              <input type="number" id="field-pe-ust_betrag" step="0.01" min="0" value="${a.ust_betrag ?? ''}" readonly>
            </div>
          </div>
          <div class="form-field form-field--half">
            <label for="field-pe-bruttobetrag">Bruttobetrag (€)</label>
            <input type="number" id="field-pe-bruttobetrag" step="0.01" min="0" value="${a.bruttobetrag ?? ''}" readonly>
          </div>
        </div>

        <div class="projekt-erstellen-subsection">
          <h5 class="section-subtitle">Rechnung</h5>

          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="field-pe-re_nr">Rechnungsnummer</label>
              <input type="text" id="field-pe-re_nr" value="${this.escape(a.re_nr)}">
            </div>
            <div class="form-field form-field--half">
              <label for="field-pe-externe_po">Externe PO</label>
              <input type="text" id="field-pe-externe_po" value="${this.escape(a.externe_po)}">
            </div>
          </div>
          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="field-pe-rechnung_gestellt_am">RE gestellt am</label>
              ${CustomDatePicker.render({ id: 'pe-rechnung_gestellt_am', field: 'rechnung_gestellt_am', value: a.rechnung_gestellt_am, label: 'RE gestellt am', variant: 'native', entity: 'projekt-erstellen' })}
            </div>
            <div class="form-field form-field--half">
              <label for="field-pe-re_faelligkeit">Rechnungsfälligkeit</label>
              ${CustomDatePicker.render({ id: 'pe-re_faelligkeit', field: 're_faelligkeit', value: a.re_faelligkeit, label: 'Rechnungsfälligkeit', variant: 'native', entity: 'projekt-erstellen' })}
            </div>
          </div>
          <div class="form-field">
            <label for="field-pe-erwarteter_monat_zahlungseingang">Erwarteter Zahlungseingang</label>
            ${CustomDatePicker.render({ id: 'pe-erwarteter_monat_zahlungseingang', field: 'erwarteter_monat_zahlungseingang', value: a.erwarteter_monat_zahlungseingang, label: 'Erwarteter Zahlungseingang', variant: 'native', entity: 'projekt-erstellen' })}
          </div>
        </div>

        ${this.isContracting ? '<div id="pe-agency-host"></div>' : ''}

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

    await this.loadAngebotsnummerOptions();
    this.populateAngebotsnummerOptions();
  }

  async loadAngebotsnummerOptions() {
    if (!window.supabase) return;

    try {
      const { data, error } = await window.supabase
        .from('auftrag')
        .select('angebotsnummer')
        .not('angebotsnummer', 'is', null)
        .order('angebotsnummer', { ascending: false });

      if (error) throw error;

      this.angebotsnummerOptions = [...new Set(
        (data || [])
          .map(row => row?.angebotsnummer?.trim())
          .filter(Boolean)
      )];
    } catch (e) {
      console.warn('⚠️ Angebotsnummern laden fehlgeschlagen:', e);
      this.angebotsnummerOptions = [];
    }
  }

  populateAngebotsnummerOptions() {
    const datalist = document.getElementById('field-pe-angebotsnummer-options');
    if (!datalist) return;

    datalist.innerHTML = this.angebotsnummerOptions
      .map(value => `<option value="${this.escape(value)}"></option>`)
      .join('');
  }

  _getDateInput(field) {
    return this.host?.querySelector(`.custom-date-picker__input[data-field="${field}"]`);
  }

  bindEvents() {
    this._datePickerCleanup = CustomDatePicker.bind(this.host);

    if (this.isContracting) {
      this.agencyBlock = new AgencyServicesBlock({
        hostId: 'pe-agency-host',
        data: this.wizard.formData.details,
        mode: 'reduced',
        onChange: (val) => {
          this.wizard.formData.details = { ...this.wizard.formData.details, ...val };
          this.wizard.updateFeedback();
        }
      });
      this.agencyBlock.render();
    }

    const recalcBrutto = () => {
      const net = parseFloat(document.getElementById('field-pe-nettobetrag')?.value);
      const ustBetragEl = document.getElementById('field-pe-ust_betrag');
      const bruttoEl = document.getElementById('field-pe-bruttobetrag');
      if (!isNaN(net)) {
        const u = +(net * DEFAULT_UST_PROZENT / 100).toFixed(2);
        const b = +(net + u).toFixed(2);
        if (ustBetragEl) ustBetragEl.value = u;
        if (bruttoEl) bruttoEl.value = b;
        this.wizard.formData.auftrag.ust_prozent = DEFAULT_UST_PROZENT;
        this.wizard.formData.auftrag.ust_betrag = u;
        this.wizard.formData.auftrag.bruttobetrag = b;
      }
    };
    document.getElementById('field-pe-nettobetrag')?.addEventListener('input', recalcBrutto);
    recalcBrutto();

    const recalcFaelligkeit = () => {
      const reInput = this._getDateInput('rechnung_gestellt_am');
      const reDate = reInput ? CustomDatePicker.getValue(reInput) : '';
      const ziel = parseInt(document.getElementById('field-pe-zahlungsziel_tage')?.value, 10);
      const fInput = this._getDateInput('re_faelligkeit');
      const ezInput = this._getDateInput('erwarteter_monat_zahlungseingang');
      if (!fInput) return;
      if (reDate && !isNaN(ziel)) {
        const d = new Date(reDate);
        d.setDate(d.getDate() + ziel);
        const berechnet = d.toISOString().slice(0, 10);
        CustomDatePicker.setValue(fInput, berechnet);
        this.wizard.formData.auftrag.re_faelligkeit = berechnet;
        if (ezInput) {
          CustomDatePicker.setValue(ezInput, berechnet);
          this.wizard.formData.auftrag.erwarteter_monat_zahlungseingang = berechnet;
        }
      }
    };

    // Leistungszeitraum change -> formData + Titel-Recompute
    this.host.addEventListener('change', (e) => {
      if (!e.target.classList?.contains('custom-date-picker__input')) return;
      const field = e.target.dataset.field;
      if (!field) return;

      const value = CustomDatePicker.getValue(e.target) || null;

      if (field === 'start') {
        this.wizard.formData.auftrag.start = value;
        this._recomputeTitleFromStart(value);
        this.wizard.updateFeedback();
      } else if (field === 'ende') {
        this.wizard.formData.auftrag.ende = value;
        this.wizard.updateFeedback();
      } else if (field === 'rechnung_gestellt_am') {
        this.wizard.formData.auftrag.rechnung_gestellt_am = value;
        recalcFaelligkeit();
        this.wizard.updateFeedback();
      } else if (field === 're_faelligkeit') {
        this.wizard.formData.auftrag.re_faelligkeit = value;
        this.wizard.updateFeedback();
      } else if (field === 'erwarteter_monat_zahlungseingang') {
        this.wizard.formData.auftrag.erwarteter_monat_zahlungseingang = value;
        this.wizard.updateFeedback();
      }
    });

    document.getElementById('field-pe-zahlungsziel_tage')?.addEventListener('change', recalcFaelligkeit);

    const syncInputs = [
      'field-pe-angebotsnummer', 'field-pe-re_nr', 'field-pe-externe_po',
      'field-pe-zahlungsziel_tage',
      'field-pe-nettobetrag',
      'field-pe-anzahl_teilrechnungen'
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

  _recomputeTitleFromStart(startValue) {
    const a = this.wizard.formData.auftrag;
    if (a.titel_manuell_geaendert) return;

    const basisdatenStep = this.wizard.steps?.find(s => s.constructor.name === 'StepBasisdaten');
    if (!basisdatenStep) return;

    const unternehmenOption = basisdatenStep.unternehmenOptions?.find(o => o.value === a.unternehmen_id);
    const displayName = unternehmenOption?.internes_kuerzel || unternehmenOption?.label || null;
    const generated = generateAuftragTitle({
      unternehmensname: displayName,
      auftragType: a.auftragtype,
      startDate: startValue
    });

    if (generated) {
      a.titel = generated;
      const titelInput = document.getElementById('field-pe-titel');
      if (titelInput) titelInput.value = generated;
    }
  }

  attachLiveUpdate(handler) {
    // onChange passt bereits direkt an; nichts weiteres zu tun.
  }

  collectData() {
    const details = this.isContracting && this.agencyBlock
      ? this.agencyBlock.getValue()
      : {};

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

    const startInput = this._getDateInput('start');
    const endeInput = this._getDateInput('ende');
    const reGestelltInput = this._getDateInput('rechnung_gestellt_am');
    const reFaelligkeitInput = this._getDateInput('re_faelligkeit');
    const ezInput = this._getDateInput('erwarteter_monat_zahlungseingang');

    const auftrag = {
      start: startInput ? CustomDatePicker.getValue(startInput) || null : null,
      ende: endeInput ? CustomDatePicker.getValue(endeInput) || null : null,
      angebotsnummer: document.getElementById('field-pe-angebotsnummer')?.value?.trim() || '',
      re_nr: document.getElementById('field-pe-re_nr')?.value || '',
      po: this.wizard.formData.auftrag.po || '',
      externe_po: document.getElementById('field-pe-externe_po')?.value || '',
      zahlungsziel_tage: parseInt10('field-pe-zahlungsziel_tage'),
      rechnung_gestellt_am: reGestelltInput ? CustomDatePicker.getValue(reGestelltInput) || null : null,
      re_faelligkeit: reFaelligkeitInput ? CustomDatePicker.getValue(reFaelligkeitInput) || null : null,
      erwarteter_monat_zahlungseingang: ezInput ? CustomDatePicker.getValue(ezInput) || null : null,
      nettobetrag: parseNum('field-pe-nettobetrag'),
      ust_prozent: DEFAULT_UST_PROZENT,
      ust_betrag: parseNum('field-pe-ust_betrag'),
      bruttobetrag: parseNum('field-pe-bruttobetrag'),
      anzahl_teilrechnungen: parseInt10('field-pe-anzahl_teilrechnungen')
    };

    return { details, auftrag };
  }

  destroy() {
    if (this._datePickerCleanup) {
      this._datePickerCleanup();
      this._datePickerCleanup = null;
    }
    this.agencyBlock = null;
  }
}
