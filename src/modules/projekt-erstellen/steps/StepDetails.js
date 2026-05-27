// StepDetails.js
// Step 2 des Projekt-Erstellen-Flows:
// Block 1: Angebot & Budget (inkl. Leistungszeitraum)
// Block 2: Dynamische Teilrechnungs-Blöcke (basierend auf anzahl_teilrechnungen)
// Agenturleistungen nur bei Contracting (bei UGC/Vorort -> StepKampagnenarten)

import { AgencyServicesBlock } from '../components/AgencyServicesBlock.js';
import { CustomDatePicker } from '../../../core/components/CustomDatePicker.js';
import { generateAuftragTitle } from '../components/TitelGenerator.js';
import { parseCurrencyInput } from '../../../core/utils/parseCurrency.js';

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

  _ensureTeilrechnungen() {
    const a = this.wizard.formData.auftrag;
    const count = Math.max(1, parseInt(a.anzahl_teilrechnungen, 10) || 1);
    if (!Array.isArray(a.teilrechnungen) || a.teilrechnungen.length === 0) {
      const netto = parseCurrencyInput(a.nettobetrag) || 0;
      const perTR = count > 0 ? +(netto / count).toFixed(2) : 0;
      a.teilrechnungen = Array.from({ length: count }, (_, i) => this._makeTeilrechnung(i + 1, perTR));
    }
  }

  _makeTeilrechnung(position, nettobetrag = 0) {
    const ust = +(nettobetrag * DEFAULT_UST_PROZENT / 100).toFixed(2);
    return {
      position,
      nettobetrag,
      ust_prozent: DEFAULT_UST_PROZENT,
      ust_betrag: ust,
      bruttobetrag: +(nettobetrag + ust).toFixed(2),
      re_nr: '',
      externe_po: '',
      rechnung_gestellt: false,
      rechnung_gestellt_am: null,
      re_faelligkeit: null,
      erwarteter_monat_zahlungseingang: null,
      notiz: '',
      ueberwiesen: false,
      ueberwiesen_am: null
    };
  }

  _recalcTRBrutto(tr) {
    const net = parseCurrencyInput(tr.nettobetrag) || 0;
    tr.ust_betrag = +(net * DEFAULT_UST_PROZENT / 100).toFixed(2);
    tr.bruttobetrag = +(net + tr.ust_betrag).toFixed(2);
  }

  _distributeEvenly() {
    const a = this.wizard.formData.auftrag;
    const netto = parseCurrencyInput(a.nettobetrag) || 0;
    const trs = a.teilrechnungen || [];
    if (trs.length === 0) return;
    const perTR = +(netto / trs.length).toFixed(2);
    trs.forEach(tr => {
      tr.nettobetrag = perTR;
      this._recalcTRBrutto(tr);
    });
  }

  _sumUpFromTeilrechnungen() {
    const a = this.wizard.formData.auftrag;
    const trs = a.teilrechnungen || [];
    const totalNetto = trs.reduce((sum, tr) => sum + (parseCurrencyInput(tr.nettobetrag) || 0), 0);
    a.nettobetrag = +totalNetto.toFixed(2);
    a.ust_betrag = +(totalNetto * DEFAULT_UST_PROZENT / 100).toFixed(2);
    a.bruttobetrag = +(totalNetto + a.ust_betrag).toFixed(2);
  }

  _updateAuftragBruttoFields() {
    const a = this.wizard.formData.auftrag;
    const nettoEl = document.getElementById('field-pe-nettobetrag');
    const ustEl = document.getElementById('field-pe-ust_betrag');
    const bruttoEl = document.getElementById('field-pe-bruttobetrag');
    if (nettoEl) nettoEl.value = a.nettobetrag ?? '';
    if (ustEl) ustEl.value = a.ust_betrag ?? '';
    if (bruttoEl) bruttoEl.value = a.bruttobetrag ?? '';
  }

  render(host) {
    this.host = host;
    const a = this.wizard.formData.auftrag || {};
    this._ensureTeilrechnungen();

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
              <input type="text" inputmode="decimal" id="field-pe-nettobetrag" value="${a.nettobetrag ?? ''}">
            </div>
            <div class="form-field form-field--half">
              <label for="field-pe-ust_betrag">MwSt-Gesamtbetrag (€)</label>
              <input type="text" inputmode="decimal" id="field-pe-ust_betrag" value="${a.ust_betrag ?? ''}" readonly>
            </div>
          </div>
          <div class="form-field form-field--half">
            <label for="field-pe-bruttobetrag">Bruttobetrag (€)</label>
            <input type="text" inputmode="decimal" id="field-pe-bruttobetrag" value="${a.bruttobetrag ?? ''}" readonly>
          </div>
        </div>

        <div id="pe-teilrechnungen-host"></div>

        ${this.isContracting ? '<div id="pe-agency-host"></div>' : ''}

      </div>
    `;

    this._renderTeilrechnungsBlocks();
  }

  _renderTeilrechnungsBlocks() {
    const host = document.getElementById('pe-teilrechnungen-host');
    if (!host) return;

    const a = this.wizard.formData.auftrag;
    const trs = a.teilrechnungen || [];
    const count = trs.length;

    host.innerHTML = trs.map((tr, i) => `
      <div class="projekt-erstellen-subsection pe-teilrechnung-block" data-tr-index="${i}">
        <h5 class="section-subtitle">Teilrechnung ${tr.position} von ${count}</h5>

        <div class="form-two-col">
          <div class="form-field form-field--half">
            <label>Netto (€)</label>
            <input type="text" inputmode="decimal" class="pe-tr-nettobetrag" data-tr-index="${i}" value="${tr.nettobetrag ?? ''}">
          </div>
          <div class="form-field form-field--half">
            <label>USt-Betrag (€)</label>
            <input type="text" inputmode="decimal" class="pe-tr-ust_betrag" data-tr-index="${i}" value="${tr.ust_betrag ?? ''}" readonly>
          </div>
        </div>
        <div class="form-field form-field--half">
          <label>Bruttobetrag (€)</label>
          <input type="text" inputmode="decimal" class="pe-tr-bruttobetrag" data-tr-index="${i}" value="${tr.bruttobetrag ?? ''}" readonly>
        </div>

        <div class="form-two-col">
          <div class="form-field form-field--half">
            <label>Rechnungsnummer</label>
            <input type="text" class="pe-tr-re_nr" data-tr-index="${i}" value="${this.escape(tr.re_nr)}">
          </div>
          <div class="form-field form-field--half">
            <label>Externe PO</label>
            <input type="text" class="pe-tr-externe_po" data-tr-index="${i}" value="${this.escape(tr.externe_po)}">
          </div>
        </div>
        <div class="form-two-col">
          <div class="form-field form-field--half">
            <label>RE gestellt am</label>
            ${CustomDatePicker.render({ id: `pe-tr-rechnung_gestellt_am-${i}`, field: `tr_rechnung_gestellt_am_${i}`, value: tr.rechnung_gestellt_am, label: 'RE gestellt am', variant: 'native', entity: 'projekt-erstellen' })}
          </div>
          <div class="form-field form-field--half">
            <label>Rechnungsfälligkeit</label>
            ${CustomDatePicker.render({ id: `pe-tr-re_faelligkeit-${i}`, field: `tr_re_faelligkeit_${i}`, value: tr.re_faelligkeit, label: 'Rechnungsfälligkeit', variant: 'native', entity: 'projekt-erstellen' })}
          </div>
        </div>
        <div class="form-field">
          <label>Erwarteter Zahlungseingang</label>
          ${CustomDatePicker.render({ id: `pe-tr-erwarteter_monat-${i}`, field: `tr_erwarteter_monat_${i}`, value: tr.erwarteter_monat_zahlungseingang, label: 'Erwarteter Zahlungseingang', variant: 'native', entity: 'projekt-erstellen' })}
        </div>
        <div class="form-field">
          <label>Notiz</label>
          <textarea class="pe-tr-notiz" data-tr-index="${i}" rows="2" placeholder="Optionale Notiz zur Teilrechnung…">${this.escape(tr.notiz)}</textarea>
        </div>
      </div>
    `).join('');

    this._bindTeilrechnungsEvents(host);
  }

  _bindTeilrechnungsEvents(host) {
    host.querySelectorAll('.pe-tr-nettobetrag').forEach(input => {
      input.addEventListener('paste', () => {
        setTimeout(() => {
          const parsed = parseCurrencyInput(input.value);
          if (parsed != null) input.value = parsed;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }, 0);
      });
      input.addEventListener('input', () => {
        const idx = parseInt(input.dataset.trIndex, 10);
        const tr = this.wizard.formData.auftrag.teilrechnungen[idx];
        if (!tr) return;

        tr.nettobetrag = parseCurrencyInput(input.value) || 0;
        this._recalcTRBrutto(tr);

        const block = input.closest('.pe-teilrechnung-block');
        const ustEl = block?.querySelector('.pe-tr-ust_betrag');
        const bruttoEl = block?.querySelector('.pe-tr-bruttobetrag');
        if (ustEl) ustEl.value = tr.ust_betrag;
        if (bruttoEl) bruttoEl.value = tr.bruttobetrag;

        this._sumUpFromTeilrechnungen();
        this._updateAuftragBruttoFields();
        this.wizard.onFormDataChange();
      });
    });

    host.querySelectorAll('.pe-tr-re_nr, .pe-tr-externe_po, .pe-tr-notiz').forEach(input => {
      input.addEventListener('input', () => {
        const idx = parseInt(input.dataset.trIndex, 10);
        const tr = this.wizard.formData.auftrag.teilrechnungen[idx];
        if (!tr) return;

        if (input.classList.contains('pe-tr-re_nr')) tr.re_nr = input.value;
        if (input.classList.contains('pe-tr-externe_po')) tr.externe_po = input.value;
        if (input.classList.contains('pe-tr-notiz')) tr.notiz = input.value;
        this.wizard.onFormDataChange();
      });
    });

    host.addEventListener('change', (e) => {
      if (!e.target.classList?.contains('custom-date-picker__input')) return;
      const field = e.target.dataset.field;
      if (!field || !field.startsWith('tr_')) return;

      const value = CustomDatePicker.getValue(e.target) || null;

      const match = field.match(/^tr_(.+)_(\d+)$/);
      if (!match) return;
      const [, dateField, idxStr] = match;
      const idx = parseInt(idxStr, 10);
      const tr = this.wizard.formData.auftrag.teilrechnungen[idx];
      if (!tr) return;

      if (dateField === 'rechnung_gestellt_am') {
        tr.rechnung_gestellt_am = value;
        this._recalcTRFaelligkeit(idx);
      } else if (dateField === 're_faelligkeit') {
        tr.re_faelligkeit = value;
      } else if (dateField === 'erwarteter_monat') {
        tr.erwarteter_monat_zahlungseingang = value;
      }
      this.wizard.onFormDataChange();
    });
  }

  _recalcTRFaelligkeit(trIndex) {
    const tr = this.wizard.formData.auftrag.teilrechnungen[trIndex];
    if (!tr) return;

    const ziel = parseInt(document.getElementById('field-pe-zahlungsziel_tage')?.value, 10);
    if (isNaN(ziel) || !tr.rechnung_gestellt_am) {
      tr.re_faelligkeit = null;
      tr.erwarteter_monat_zahlungseingang = null;
      const host = document.getElementById('pe-teilrechnungen-host');
      const block = host?.querySelector(`.pe-teilrechnung-block[data-tr-index="${trIndex}"]`);
      const fInput = block?.querySelector(`.custom-date-picker__input[data-field="tr_re_faelligkeit_${trIndex}"]`);
      const ezInput = block?.querySelector(`.custom-date-picker__input[data-field="tr_erwarteter_monat_${trIndex}"]`);
      if (fInput) CustomDatePicker.setValue(fInput, '');
      if (ezInput) CustomDatePicker.setValue(ezInput, '');
      return;
    }

    const d = new Date(tr.rechnung_gestellt_am);
    d.setDate(d.getDate() + ziel);
    const berechnet = d.toISOString().slice(0, 10);

    tr.re_faelligkeit = berechnet;
    tr.erwarteter_monat_zahlungseingang = berechnet;

    const host = document.getElementById('pe-teilrechnungen-host');
    if (!host) return;
    const block = host.querySelector(`.pe-teilrechnung-block[data-tr-index="${trIndex}"]`);
    if (!block) return;

    const fInput = block.querySelector(`.custom-date-picker__input[data-field="tr_re_faelligkeit_${trIndex}"]`);
    const ezInput = block.querySelector(`.custom-date-picker__input[data-field="tr_erwarteter_monat_${trIndex}"]`);
    if (fInput) CustomDatePicker.setValue(fInput, berechnet);
    if (ezInput) CustomDatePicker.setValue(ezInput, berechnet);
  }

  _recalcAllTRFaelligkeiten() {
    const trs = this.wizard.formData.auftrag.teilrechnungen || [];
    trs.forEach((_, i) => this._recalcTRFaelligkeit(i));
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
      const net = parseCurrencyInput(document.getElementById('field-pe-nettobetrag')?.value);
      const ustBetragEl = document.getElementById('field-pe-ust_betrag');
      const bruttoEl = document.getElementById('field-pe-bruttobetrag');
      if (net != null) {
        const u = +(net * DEFAULT_UST_PROZENT / 100).toFixed(2);
        const b = +(net + u).toFixed(2);
        if (ustBetragEl) ustBetragEl.value = u;
        if (bruttoEl) bruttoEl.value = b;
        this.wizard.formData.auftrag.ust_prozent = DEFAULT_UST_PROZENT;
        this.wizard.formData.auftrag.ust_betrag = u;
        this.wizard.formData.auftrag.bruttobetrag = b;
      }
    };

    const nettoEl = document.getElementById('field-pe-nettobetrag');
    const handleNettoPaste = () => {
      setTimeout(() => {
        const parsed = parseCurrencyInput(nettoEl.value);
        if (parsed != null) nettoEl.value = parsed;
        nettoEl.dispatchEvent(new Event('input', { bubbles: true }));
      }, 0);
    };
    nettoEl?.addEventListener('paste', handleNettoPaste);

    nettoEl?.addEventListener('input', () => {
      const net = parseCurrencyInput(nettoEl.value);
      if (net != null) {
        this.wizard.formData.auftrag.nettobetrag = net;
      }
      recalcBrutto();
      this._distributeEvenly();
      this._renderTeilrechnungsBlocks();
      this.wizard.onFormDataChange();
    });
    recalcBrutto();

    document.getElementById('field-pe-anzahl_teilrechnungen')?.addEventListener('input', () => {
      const newCount = Math.max(1, parseInt(document.getElementById('field-pe-anzahl_teilrechnungen')?.value, 10) || 1);
      const a = this.wizard.formData.auftrag;
      a.anzahl_teilrechnungen = newCount;

      const netto = parseCurrencyInput(a.nettobetrag) || 0;
      const perTR = newCount > 0 ? +(netto / newCount).toFixed(2) : 0;
      a.teilrechnungen = Array.from({ length: newCount }, (_, i) => {
        const existing = (a.teilrechnungen || [])[i];
        const tr = this._makeTeilrechnung(i + 1, perTR);
        if (existing) {
          tr.re_nr = existing.re_nr || '';
          tr.externe_po = existing.externe_po || '';
        }
        return tr;
      });

      this._renderTeilrechnungsBlocks();
      this.wizard.onFormDataChange();
    });

    this.host.addEventListener('change', (e) => {
      if (!e.target.classList?.contains('custom-date-picker__input')) return;
      const field = e.target.dataset.field;
      if (!field) return;

      if (field.startsWith('tr_')) return;

      const value = CustomDatePicker.getValue(e.target) || null;

      if (field === 'start') {
        this.wizard.formData.auftrag.start = value;
        this._recomputeTitleFromStart(value);
        this.wizard.updateFeedback();
      } else if (field === 'ende') {
        this.wizard.formData.auftrag.ende = value;
        this.wizard.updateFeedback();
      }
    });

    document.getElementById('field-pe-zahlungsziel_tage')?.addEventListener('change', () => {
      this._recalcAllTRFaelligkeiten();
      this._renderTeilrechnungsBlocks();
      this.wizard.onFormDataChange();
    });

    const syncInputs = [
      'field-pe-angebotsnummer',
      'field-pe-zahlungsziel_tage'
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
    let details = this.isContracting && this.agencyBlock
      ? this.agencyBlock.getValue()
      : {};

    let kampagne = {};

    const parseNum = (id) => {
      const v = document.getElementById(id)?.value;
      if (v === '' || v == null) return null;
      return parseCurrencyInput(v);
    };
    const parseInt10 = (id) => {
      const v = document.getElementById(id)?.value;
      if (v === '' || v == null) return null;
      const n = parseInt(v, 10);
      return isNaN(n) ? null : n;
    };

    const startInput = this._getDateInput('start');
    const endeInput = this._getDateInput('ende');

    const teilrechnungen = this._collectTeilrechnungen();
    const firstTR = teilrechnungen[0] || {};

    const auftrag = {
      start: startInput ? CustomDatePicker.getValue(startInput) || null : null,
      ende: endeInput ? CustomDatePicker.getValue(endeInput) || null : null,
      angebotsnummer: document.getElementById('field-pe-angebotsnummer')?.value?.trim() || '',
      re_nr: firstTR.re_nr || '',
      po: this.wizard.formData.auftrag.po || '',
      externe_po: firstTR.externe_po || '',
      zahlungsziel_tage: parseInt10('field-pe-zahlungsziel_tage'),
      rechnung_gestellt_am: firstTR.rechnung_gestellt_am || null,
      re_faelligkeit: firstTR.re_faelligkeit || null,
      erwarteter_monat_zahlungseingang: firstTR.erwarteter_monat_zahlungseingang || null,
      nettobetrag: parseNum('field-pe-nettobetrag'),
      ust_prozent: DEFAULT_UST_PROZENT,
      ust_betrag: parseNum('field-pe-ust_betrag'),
      bruttobetrag: parseNum('field-pe-bruttobetrag'),
      anzahl_teilrechnungen: parseInt10('field-pe-anzahl_teilrechnungen'),
      teilrechnungen
    };

    return { details, auftrag, kampagne };
  }

  _collectTeilrechnungen() {
    const host = document.getElementById('pe-teilrechnungen-host');
    if (!host) return this.wizard.formData.auftrag.teilrechnungen || [];

    const blocks = host.querySelectorAll('.pe-teilrechnung-block');
    return Array.from(blocks).map((block, i) => {
      const idx = parseInt(block.dataset.trIndex, 10);
      const existing = (this.wizard.formData.auftrag.teilrechnungen || [])[idx] || {};

      const nettoInput = block.querySelector('.pe-tr-nettobetrag');
      const netto = parseCurrencyInput(nettoInput?.value) || 0;
      const ust = +(netto * DEFAULT_UST_PROZENT / 100).toFixed(2);

      const reGestelltInput = block.querySelector(`.custom-date-picker__input[data-field="tr_rechnung_gestellt_am_${idx}"]`);
      const reFaelligkeitInput = block.querySelector(`.custom-date-picker__input[data-field="tr_re_faelligkeit_${idx}"]`);
      const ezInput = block.querySelector(`.custom-date-picker__input[data-field="tr_erwarteter_monat_${idx}"]`);

      return {
        position: i + 1,
        nettobetrag: netto,
        ust_prozent: DEFAULT_UST_PROZENT,
        ust_betrag: ust,
        bruttobetrag: +(netto + ust).toFixed(2),
        re_nr: block.querySelector('.pe-tr-re_nr')?.value || '',
        externe_po: block.querySelector('.pe-tr-externe_po')?.value || '',
        rechnung_gestellt: existing.rechnung_gestellt || false,
        rechnung_gestellt_am: reGestelltInput ? CustomDatePicker.getValue(reGestelltInput) || null : null,
        re_faelligkeit: reFaelligkeitInput ? CustomDatePicker.getValue(reFaelligkeitInput) || null : null,
        erwarteter_monat_zahlungseingang: ezInput ? CustomDatePicker.getValue(ezInput) || null : null,
        notiz: block.querySelector('.pe-tr-notiz')?.value || '',
        ueberwiesen: existing.ueberwiesen || false,
        ueberwiesen_am: existing.ueberwiesen_am || null
      };
    });
  }

  destroy() {
    if (this._datePickerCleanup) {
      this._datePickerCleanup();
      this._datePickerCleanup = null;
    }
    this.agencyBlock = null;
  }
}
