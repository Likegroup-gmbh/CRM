// StepBasisdaten.js
// Step 1 des Projekt-Erstellen-Flows:
// Unternehmen, Marke, Ansprechpartner, Art des Auftrags, Zeitrahmen, Titel.

import { AUFTRAG_TYPES } from '../constants.js';
import { TitelGenerator } from '../components/TitelGenerator.js';

export class StepBasisdaten {
  constructor(wizard) {
    this.wizard = wizard;
    this.host = null;

    this.unternehmenOptions = [];
    this.markenOptionsByUnternehmen = new Map();
    this.ansprechpartnerOptionsByUnternehmen = new Map();

    this.titelGenerator = null;
    this._liveHandler = null;
    this._stammdatenLoaded = false;
  }

  render(host) {
    this.host = host;
    const a = this.wizard.formData.auftrag || {};

    const artOptions = AUFTRAG_TYPES.map(t => `
      <option value="${t.value}" ${a.auftragtype === t.value ? 'selected' : ''}>${t.label}</option>
    `).join('');

    host.innerHTML = `
      <div class="form-section projekt-erstellen-section-stack">
        <div class="form-field">
          <label for="field-pe-unternehmen_id">Unternehmen <span class="required">*</span></label>
          <select id="field-pe-unternehmen_id" name="unternehmen_id" required>
            <option value="">Unternehmen suchen und auswählen...</option>
          </select>
        </div>

        <div class="form-two-col">
          <div class="form-field form-field--half">
            <label for="field-pe-marke_id">Marke</label>
            <select id="field-pe-marke_id" name="marke_id">
              <option value="">Bitte zuerst Unternehmen wählen...</option>
            </select>
          </div>
          <div class="form-field form-field--half">
            <label for="field-pe-ansprechpartner_id">Ansprechpartner <span class="required">*</span></label>
            <select id="field-pe-ansprechpartner_id" name="ansprechpartner_id" required>
              <option value="">Bitte zuerst Unternehmen wählen...</option>
            </select>
          </div>
        </div>

        <div class="form-field">
          <label for="field-pe-auftragtype">Art des Auftrags <span class="required">*</span></label>
          <select id="field-pe-auftragtype" name="auftragtype" required>
            <option value="">Art auswählen...</option>
            ${artOptions}
          </select>
        </div>

        <div class="form-two-col">
          <div class="form-field form-field--half">
            <label for="field-pe-start">Startdatum</label>
            <input type="date" id="field-pe-start" name="start" value="${a.start || ''}">
          </div>
          <div class="form-field form-field--half">
            <label for="field-pe-ende">Enddatum</label>
            <input type="date" id="field-pe-ende" name="ende" value="${a.ende || ''}">
          </div>
        </div>

        <div class="projekt-erstellen-titel-wrap">
          <div class="form-field">
            <label for="field-pe-titel">Titel <span class="required">*</span></label>
            <input type="text" id="field-pe-titel" name="titel" value="${this.escape(a.titel)}" placeholder="Wird aus Marke, Art und Startdatum generiert..." autocomplete="off">
          </div>
          <button type="button" class="secondary-btn" id="pe-titel-reset-btn" title="Vorschlag zurücksetzen" style="display:none;">Vorschlag nutzen</button>
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
    if (!this._stammdatenLoaded) {
      await this.fetchStammdaten();
      this._stammdatenLoaded = true;
    }

    this.populateUnternehmenSelect();
    await this.ensureDependentSelects();

    const a = this.wizard.formData.auftrag;
    if (a.marke_id) this.setSelectValue('field-pe-marke_id', a.marke_id);
    if (a.ansprechpartner_id) this.setSelectValue('field-pe-ansprechpartner_id', a.ansprechpartner_id);
    if (a.auftragtype) this.setSelectValue('field-pe-auftragtype', a.auftragtype);
  }

  bindEvents() {
    const unternehmenSelect = document.getElementById('field-pe-unternehmen_id');
    const markeSelect = document.getElementById('field-pe-marke_id');
    const auftragTypeSelect = document.getElementById('field-pe-auftragtype');
    const startInput = document.getElementById('field-pe-start');

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

    if (unternehmenSelect) {
      unternehmenSelect.addEventListener('change', (e) => {
        const id = e.target.value || null;
        this.wizard.formData.auftrag.unternehmen_id = id;
        this.wizard.formData.auftrag.marke_id = null;
        this.wizard.formData.auftrag.ansprechpartner_id = null;
        this.ensureDependentSelects();
        this.recomputeTitle();
        this.wizard.updateFeedback();
      });
    }

    if (markeSelect) {
      markeSelect.addEventListener('change', (e) => {
        this.wizard.formData.auftrag.marke_id = e.target.value || null;
        this.recomputeTitle();
        this.wizard.updateFeedback();
      });
    }

    if (auftragTypeSelect) {
      auftragTypeSelect.addEventListener('change', (e) => {
        this.wizard.formData.auftrag.auftragtype = e.target.value || null;
        this.recomputeTitle();
        this.wizard.updateFeedback();
      });
    }

    if (startInput) {
      startInput.addEventListener('input', (e) => {
        this.wizard.formData.auftrag.start = e.target.value || null;
        this.recomputeTitle();
        this.wizard.updateFeedback();
      });
    }

    const endeInput = document.getElementById('field-pe-ende');
    if (endeInput) {
      endeInput.addEventListener('input', (e) => {
        this.wizard.formData.auftrag.ende = e.target.value || null;
        this.wizard.updateFeedback();
      });
    }

    const ansprechpartnerSelect = document.getElementById('field-pe-ansprechpartner_id');
    if (ansprechpartnerSelect) {
      ansprechpartnerSelect.addEventListener('change', (e) => {
        this.wizard.formData.auftrag.ansprechpartner_id = e.target.value || null;
        this.wizard.updateFeedback();
      });
    }
  }

  attachLiveUpdate(handler) {
    this._liveHandler = handler;
  }

  async fetchStammdaten() {
    if (!window.supabase) return;
    try {
      const { data: unternehmenRows, error: uErr } = await window.supabase
        .from('unternehmen')
        .select('id, firmenname')
        .order('firmenname');
      if (uErr) throw uErr;
      this.unternehmenOptions = (unternehmenRows || []).map(u => ({
        value: u.id,
        label: u.firmenname || '(ohne Name)'
      }));
    } catch (e) {
      console.warn('⚠️ Unternehmen laden fehlgeschlagen:', e);
    }
  }

  populateUnternehmenSelect() {
    const unternehmenSelect = document.getElementById('field-pe-unternehmen_id');
    if (!unternehmenSelect) return;

    unternehmenSelect.innerHTML = `
      <option value="">Unternehmen suchen und auswählen...</option>
      ${this.unternehmenOptions.map(o => `<option value="${o.value}">${this.escape(o.label)}</option>`).join('')}
    `;

    const currentValue = this.wizard.formData.auftrag.unternehmen_id;
    if (currentValue) unternehmenSelect.value = currentValue;

    // selected-Flag setzen, damit createSimpleSearchableSelect den Label-Text im sichtbaren Input rendert
    const enrichedOptions = this.unternehmenOptions.map(o => ({
      ...o,
      selected: !!currentValue && o.value === currentValue
    }));

    this.enhanceSearchableSelect('field-pe-unternehmen_id', enrichedOptions, {
      name: 'unternehmen_id',
      placeholder: 'Unternehmen suchen und auswählen...',
      value: currentValue || null,
      required: true
    });
  }

  enhanceSearchableSelect(selectId, options, field) {
    const el = document.getElementById(selectId);
    if (!el || !window.formSystem?.reinitializeSearchableSelect) return;

    el.disabled = false;
    if (field?.required) el.setAttribute('required', '');

    window.formSystem.reinitializeSearchableSelect(el, options, {
      placeholder: field?.placeholder || 'Suchen...',
      readonly: field?.readonly === true
    });
  }

  resetSearchableSelect(selectId, placeholder, disabled = true) {
    const el = document.getElementById(selectId);
    if (!el) return;

    const container = el.closest('.form-field') || el.parentNode;
    const oldWrap = container?.querySelector('.searchable-select-container');
    if (oldWrap) oldWrap.remove();

    el.style.display = '';
    el.disabled = disabled;
    el.innerHTML = `<option value="">${this.escape(placeholder)}</option>`;
    el.value = '';
  }

  async loadMarkenFuerUnternehmen(unternehmenId) {
    if (!unternehmenId || this.markenOptionsByUnternehmen.has(unternehmenId)) {
      return this.markenOptionsByUnternehmen.get(unternehmenId) || [];
    }
    try {
      const { data, error } = await window.supabase
        .from('marke')
        .select('id, markenname')
        .eq('unternehmen_id', unternehmenId)
        .order('markenname');
      if (error) throw error;
      const opts = (data || []).map(m => ({ value: m.id, label: m.markenname || '(ohne Name)' }));
      this.markenOptionsByUnternehmen.set(unternehmenId, opts);
      return opts;
    } catch (e) {
      console.warn('⚠️ Marken laden fehlgeschlagen:', e);
      return [];
    }
  }

  async loadAnsprechpartnerFuerUnternehmen(unternehmenId) {
    if (!unternehmenId || this.ansprechpartnerOptionsByUnternehmen.has(unternehmenId)) {
      return this.ansprechpartnerOptionsByUnternehmen.get(unternehmenId) || [];
    }
    try {
      const { data, error } = await window.supabase
        .from('ansprechpartner')
        .select('id, vorname, nachname')
        .eq('unternehmen_id', unternehmenId)
        .order('nachname');
      if (error) throw error;
      const opts = (data || []).map(a => ({
        value: a.id,
        label: [a.vorname, a.nachname].filter(Boolean).join(' ') || '(ohne Name)'
      }));
      this.ansprechpartnerOptionsByUnternehmen.set(unternehmenId, opts);
      return opts;
    } catch (e) {
      console.warn('⚠️ Ansprechpartner laden fehlgeschlagen:', e);
      return [];
    }
  }

  async ensureDependentSelects() {
    const unternehmenId = this.wizard.formData.auftrag.unternehmen_id;
    const markeSelect = document.getElementById('field-pe-marke_id');
    const apSelect = document.getElementById('field-pe-ansprechpartner_id');

    if (!markeSelect || !apSelect) return;

    if (!unternehmenId) {
      this.resetSearchableSelect('field-pe-marke_id', 'Bitte zuerst Unternehmen wählen...');
      this.resetSearchableSelect('field-pe-ansprechpartner_id', 'Bitte zuerst Unternehmen wählen...');
      return;
    }

    this.resetSearchableSelect('field-pe-marke_id', 'Marken werden geladen...');
    this.resetSearchableSelect('field-pe-ansprechpartner_id', 'Ansprechpartner werden geladen...');

    const [markenOpts, apOpts] = await Promise.all([
      this.loadMarkenFuerUnternehmen(unternehmenId),
      this.loadAnsprechpartnerFuerUnternehmen(unternehmenId)
    ]);

    if (this.wizard.formData.auftrag.unternehmen_id !== unternehmenId) {
      return;
    }

    markeSelect.disabled = false;
    markeSelect.innerHTML = `
      <option value="">${markenOpts.length ? 'Marke auswählen...' : 'Keine Marken verfügbar'}</option>
      ${markenOpts.map(o => `<option value="${o.value}">${this.escape(o.label)}</option>`).join('')}
    `;
    if (this.wizard.formData.auftrag.marke_id) {
      markeSelect.value = this.wizard.formData.auftrag.marke_id;
    }
    const enrichedMarkenOpts = markenOpts.map(o => ({
      ...o,
      selected: !!this.wizard.formData.auftrag.marke_id && o.value === this.wizard.formData.auftrag.marke_id
    }));
    this.enhanceSearchableSelect('field-pe-marke_id', enrichedMarkenOpts, {
      name: 'marke_id',
      placeholder: markenOpts.length ? 'Marke suchen und auswählen...' : 'Keine Marken verfügbar',
      value: this.wizard.formData.auftrag.marke_id || null,
      readonly: markenOpts.length === 0
    });

    apSelect.disabled = false;
    apSelect.innerHTML = `
      <option value="">${apOpts.length ? 'Ansprechpartner auswählen...' : 'Keine Ansprechpartner verfügbar'}</option>
      ${apOpts.map(o => `<option value="${o.value}">${this.escape(o.label)}</option>`).join('')}
    `;
    if (this.wizard.formData.auftrag.ansprechpartner_id) {
      apSelect.value = this.wizard.formData.auftrag.ansprechpartner_id;
    }
    const enrichedApOpts = apOpts.map(o => ({
      ...o,
      selected: !!this.wizard.formData.auftrag.ansprechpartner_id && o.value === this.wizard.formData.auftrag.ansprechpartner_id
    }));
    this.enhanceSearchableSelect('field-pe-ansprechpartner_id', enrichedApOpts, {
      name: 'ansprechpartner_id',
      placeholder: apOpts.length ? 'Ansprechpartner suchen und auswählen...' : 'Keine Ansprechpartner verfügbar',
      value: this.wizard.formData.auftrag.ansprechpartner_id || null,
      required: true,
      readonly: apOpts.length === 0
    });
  }

  setSelectValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  recomputeTitle() {
    if (!this.titelGenerator) return;
    const a = this.wizard.formData.auftrag;
    const markeLabel = this.resolveLabel('field-pe-marke_id', a.marke_id);
    this.titelGenerator.recompute({
      markeLabel,
      auftragType: a.auftragtype,
      startDate: a.start
    });
  }

  resolveLabel(selectId, value) {
    if (!value) return null;
    const el = document.getElementById(selectId);
    if (!el) return null;
    const opt = el.querySelector(`option[value="${value}"]`);
    return opt?.textContent || null;
  }

  collectData() {
    const a = this.wizard.formData.auftrag || {};
    // Fallback auf bereits gespeicherte State-Werte, falls DOM (z. B. nach Re-Render durch SearchableSelect) leer ist
    const unternehmenId = document.getElementById('field-pe-unternehmen_id')?.value || a.unternehmen_id || null;
    const markeId = document.getElementById('field-pe-marke_id')?.value || a.marke_id || null;
    const apId = document.getElementById('field-pe-ansprechpartner_id')?.value || a.ansprechpartner_id || null;
    const auftragType = document.getElementById('field-pe-auftragtype')?.value || null;
    const start = document.getElementById('field-pe-start')?.value || null;
    const ende = document.getElementById('field-pe-ende')?.value || null;
    const titel = document.getElementById('field-pe-titel')?.value || '';

    return {
      auftrag: {
        unternehmen_id: unternehmenId,
        marke_id: markeId,
        ansprechpartner_id: apId,
        auftragtype: auftragType,
        start,
        ende,
        titel,
        titel_manuell_geaendert: this.wizard.formData.auftrag.titel_manuell_geaendert
      }
    };
  }

  destroy() {
    this.titelGenerator = null;
  }
}
