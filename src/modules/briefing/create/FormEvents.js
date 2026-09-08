// FormEvents.js
// Event-Binding fuer den Briefing-Generator: Multistep-Navigation,
// Conditional-Logic (Live-Toggle), Repeatable-Felder, Uploads,
// Unternehmen->Marke-Kaskade, Searchable Selects.

import { BriefingCreate } from './BriefingCreateCore.js';
import { evaluateCondition } from './fieldConfig.js';
import { escapeHtml } from './FieldRenderer.js';
import { icon } from '../../../core/icons/IconSystem.js';

BriefingCreate.prototype.bindMultistepEvents = function() {
  const cancelBtn = document.getElementById('btn-cancel');
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  const submitBtn = document.getElementById('btn-submit');
  const saveDraftBtn = document.getElementById('btn-save-draft');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      window.navigateTo('/briefing');
    });
  }

  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', async () => {
      this.saveCurrentStepData();
      await this.saveDraftToDB();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      this.saveCurrentStepData();
      if (this.currentStep === 2) {
        this._animateAndRender(() => {
          this.currentStep = 1;
          this.isGenerated = false;
          this.render();
        });
      } else {
        this._animateAndRender(() => {
          this.currentStep--;
          this.render();
        });
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (this.validateCurrentStep()) {
        this.saveCurrentStepData();
        this._animateAndRender(() => {
          this.currentStep++;
          this.render();
        });
      }
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      if (this.validateCurrentStep()) {
        this.saveCurrentStepData();
        await this.handleSubmit();
      }
    });
  }

  this.bindConditionalEvents();
  this.bindRepeatableEvents();
  this.bindCascadeEvents();
};

// ---------------------------------------------------------------
// Conditional Logic: Wrapper live ein-/ausblenden
// ---------------------------------------------------------------
BriefingCreate.prototype.bindConditionalEvents = function() {
  const form = document.getElementById('briefing-form');
  if (!form) return;

  form.addEventListener('change', (e) => {
    if (this._isInitializing) return;
    // Geaendertes Feld sofort in formData spiegeln, dann Conditions neu auswerten
    this.saveCurrentStepData();
    this.refreshConditions();
  });
};

BriefingCreate.prototype.refreshConditions = function() {
  const form = document.getElementById('briefing-form');
  if (!form) return;

  form.querySelectorAll('.bf-conditional').forEach(wrapper => {
    const field = wrapper.dataset.conditionField;
    if (!field) return;

    const condition = {};
    if (wrapper.dataset.conditionEquals !== undefined) condition.equals = parseConditionValue(wrapper.dataset.conditionEquals);
    if (wrapper.dataset.conditionIn) condition.in = wrapper.dataset.conditionIn.split(',');
    if (wrapper.dataset.conditionIncludes !== undefined) condition.includes = wrapper.dataset.conditionIncludes;
    if (wrapper.dataset.conditionIncludesAny) condition.includesAny = wrapper.dataset.conditionIncludesAny.split(',');
    condition.field = field;

    wrapper.classList.toggle('hidden', !evaluateCondition(condition, this.formData));
  });
};

function parseConditionValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

// ---------------------------------------------------------------
// Repeatable-Felder (KPI, Text, Upload)
// ---------------------------------------------------------------
BriefingCreate.prototype.bindRepeatableEvents = function() {
  const form = document.getElementById('briefing-form');
  if (!form) return;

  form.addEventListener('click', async (e) => {
    const addBtn = e.target.closest('[data-repeatable-add]');
    if (addBtn) {
      const fieldName = addBtn.dataset.repeatableAdd;
      const container = form.querySelector(`[data-repeatable="${fieldName}"]`);
      if (!container) return;

      const max = parseInt(container.dataset.max || '20', 10);
      if (container.querySelectorAll('[data-repeatable-row]').length >= max) {
        window.toastSystem?.show(`Maximal ${max} Eintraege.`, 'warning');
        return;
      }
      container.insertAdjacentHTML('beforeend', this.buildRepeatableRow(container.dataset.repeatableType, container.querySelectorAll('[data-repeatable-row]').length));
      return;
    }

    const removeBtn = e.target.closest('.bf-repeatable-remove');
    if (removeBtn) {
      removeBtn.closest('[data-repeatable-row]')?.remove();
      this.saveCurrentStepData();
      return;
    }

    const fileTrigger = e.target.closest('[data-file-trigger]');
    if (fileTrigger) {
      const row = fileTrigger.closest('[data-repeatable-row]');
      row?.querySelector('[data-file]')?.click();
      return;
    }
  });

  // Upload-Zeilen: Typ-Wechsel (URL <-> Upload) + Datei-Upload
  form.addEventListener('change', async (e) => {
    const typSelect = e.target.closest('[data-typ]');
    if (typSelect) {
      const row = typSelect.closest('[data-repeatable-row]');
      const isUpload = typSelect.value === 'upload';
      row.querySelector('[data-url]')?.classList.toggle('hidden', isUpload);
      row.querySelector('[data-file-zone]')?.classList.toggle('hidden', !isUpload);
      return;
    }

    const fileInput = e.target.closest('[data-file]');
    if (fileInput && fileInput.files?.length) {
      await this.uploadBriefingAsset(fileInput);
    }
  });
};

BriefingCreate.prototype.buildRepeatableRow = function(type, index) {
  if (type === 'kpi') {
    // KPI-Optionen aus dem sichtbaren Container uebernehmen (erste Zeile als Vorlage)
    const container = document.querySelector('.bf-repeatable[data-repeatable-type="kpi"]');
    const firstSelect = container?.querySelector('select[data-kpi]');
    const optionsHtml = firstSelect ? firstSelect.innerHTML : '<option value="">KPI waehlen...</option>';
    return `
      <div class="bf-repeatable-row" data-repeatable-row>
        <select data-kpi class="bf-repeatable-row__select">${optionsHtml}</select>
        <input type="text" data-zielwert placeholder="Zielwert">
        <button type="button" class="mdc-btn mdc-btn--icon bf-repeatable-remove" title="Entfernen">${icon('trash')}</button>
      </div>
    `;
  }
  if (type === 'text') {
    return `
      <div class="bf-repeatable-row" data-repeatable-row>
        <input type="text" data-item placeholder="Eintrag">
        <button type="button" class="mdc-btn mdc-btn--icon bf-repeatable-remove" title="Entfernen">${icon('trash')}</button>
      </div>
    `;
  }
  // upload
  return `
    <div class="bf-repeatable-row bf-upload-row" data-repeatable-row>
      <span class="bf-upload-row__index">${index + 1}</span>
      <select data-typ class="bf-repeatable-row__select">
        <option value="url" selected>URL</option>
        <option value="upload" >Upload</option>
      </select>
      <input type="url" data-url placeholder="https://...">
      <span class="bf-upload-row__file hidden" data-file-zone>
        <input type="file" data-file class="hidden">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-file-trigger>${icon('upload')} Datei</button>
        <span data-file-label></span>
      </span>
      <input type="hidden" data-value value="">
      <input type="hidden" data-label value="">
      <button type="button" class="mdc-btn mdc-btn--icon bf-repeatable-remove" title="Entfernen">${icon('trash')}</button>
    </div>
  `;
};

// Datei in den documents-Bucket laden, Pfad in der Zeile hinterlegen
BriefingCreate.prototype.uploadBriefingAsset = async function(fileInput) {
  const row = fileInput.closest('[data-repeatable-row]');
  const label = row?.querySelector('[data-file-label]');
  const file = fileInput.files[0];
  if (!row || !file) return;

  try {
    if (label) label.textContent = 'Laedt hoch...';

    const folder = this.editId || `neu-${Date.now()}`;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `campaign-briefings/${folder}/${Date.now()}_${safeName}`;

    const { error } = await window.supabase.storage
      .from('documents')
      .upload(path, file, { upsert: false });

    if (error) throw error;

    row.querySelector('[data-value]').value = path;
    row.querySelector('[data-label]').value = file.name;
    if (label) label.textContent = file.name;
    this.saveCurrentStepData();
    window.toastSystem?.show('Datei hochgeladen', 'success');
  } catch (error) {
    console.error('Upload fehlgeschlagen:', error);
    if (label) label.textContent = 'Upload fehlgeschlagen';
    window.toastSystem?.show(`Upload fehlgeschlagen: ${error.message}`, 'error');
  }
};

// ---------------------------------------------------------------
// Unternehmen -> Marke Kaskade
// ---------------------------------------------------------------
BriefingCreate.prototype.bindCascadeEvents = function() {
  const unternehmenSelect = document.getElementById('unternehmen_id');
  if (unternehmenSelect) {
    unternehmenSelect.addEventListener('change', async (e) => {
      this.formData.unternehmen_id = e.target.value || null;
      this.formData.marke_id = null;
      this.formData.produkt_ids = [];
      this.rebuildMarkeSelect();
      await this.refreshProdukte();
      this.rebuildProduktSelect();
    });
  }

  const markeSelect = document.getElementById('marke_id');
  if (markeSelect) {
    markeSelect.addEventListener('change', async (e) => {
      this.formData.marke_id = e.target.value || null;
      await this.refreshProdukte();
      this.pruneProduktIds();
      this.rebuildProduktSelect();
    });
  }
};

BriefingCreate.prototype.pruneProduktIds = function() {
  const valid = new Set((this.produkte || []).map(p => p.id));
  this.formData.produkt_ids = (this.formData.produkt_ids || []).filter(id => valid.has(id));
};

BriefingCreate.prototype.rebuildProduktSelect = function() {
  const wrapper = document.querySelector('[data-entity-multi="produkt_ids"]');
  if (!wrapper) return;

  wrapper.querySelector('.searchable-select-container')?.remove();
  document.getElementById('produkt_ids_hidden')?.remove();
  wrapper.closest('form')?.querySelector('select[name="produkt_ids[]"]')?.remove();

  let produktSelect = wrapper.querySelector('select#produkt_ids')
    || wrapper.querySelector('select[multiple]');
  if (!produktSelect) {
    produktSelect = document.createElement('select');
    produktSelect.id = 'produkt_ids';
    produktSelect.name = 'produkt_ids';
    produktSelect.multiple = true;
    produktSelect.dataset.searchable = 'true';
    produktSelect.dataset.tagBased = 'true';
    const helper = wrapper.querySelector('.field-helper');
    wrapper.insertBefore(produktSelect, helper);
  }

  produktSelect.style.display = '';
  produktSelect.disabled = false;

  const unternehmenId = this.formData.unternehmen_id;
  const selected = new Set(this.formData.produkt_ids || []);
  const options = unternehmenId ? (this.produkte || []) : [];

  produktSelect.innerHTML = options.map(o => `
    <option value="${escapeHtml(o.id)}" ${selected.has(o.id) ? 'selected' : ''}>${escapeHtml(o.name || o.id)}</option>
  `).join('');
  produktSelect.disabled = !unternehmenId;
  produktSelect.dataset.placeholder = unternehmenId
    ? 'Produkte suchen und hinzufügen...'
    : 'Bitte zuerst Unternehmen waehlen...';

  if (unternehmenId && window.formSystem?.createSearchableSelect) {
    window.formSystem.createSearchableSelect(produktSelect, options.map(o => ({
      value: o.id,
      label: o.name || o.id,
      selected: selected.has(o.id)
    })), {
      name: 'produkt_ids',
      type: 'multiselect',
      tagBased: true,
      placeholder: 'Produkte suchen und hinzufügen...'
    });
  }
};

BriefingCreate.prototype.rebuildMarkeSelect = function() {
  const markeSelect = document.getElementById('marke_id');
  if (!markeSelect) return;

  const container = markeSelect.closest('.form-field');
  const oldSearchable = container?.querySelector('.searchable-select-container');
  if (oldSearchable) oldSearchable.remove();
  markeSelect.style.display = '';

  const unternehmenId = this.formData.unternehmen_id;
  const filtered = unternehmenId ? this.marken.filter(m => m.unternehmen_id === unternehmenId) : [];

  markeSelect.innerHTML = `
    <option value="">${unternehmenId ? 'Marke auswaehlen (optional)...' : 'Bitte zuerst Unternehmen waehlen...'}</option>
    ${filtered.map(m => `<option value="${m.id}">${escapeHtml(m.markenname)}</option>`).join('')}
  `;
  markeSelect.disabled = !unternehmenId;

  if (unternehmenId && window.formSystem?.createSearchableSelect) {
    window.formSystem.createSearchableSelect(markeSelect, filtered.map(m => ({ value: m.id, label: m.markenname })), {
      name: 'marke_id',
      placeholder: 'Marke suchen...',
      value: null
    });
  }
};

// ---------------------------------------------------------------
// Searchable Selects initialisieren
// ---------------------------------------------------------------
BriefingCreate.prototype.initSearchableSelects = function() {
  this._isInitializing = true;

  try {
    const unternehmenSelect = document.getElementById('unternehmen_id');
    if (unternehmenSelect && window.formSystem?.createSearchableSelect) {
      window.formSystem.createSearchableSelect(unternehmenSelect, this.unternehmen.map(u => ({
        value: u.id,
        label: u.firmenname,
        selected: u.id === this.formData.unternehmen_id
      })), {
        name: 'unternehmen_id',
        placeholder: 'Unternehmen suchen...',
        value: this.formData.unternehmen_id || null
      });
    }

    const markeSelect = document.getElementById('marke_id');
    if (markeSelect && window.formSystem?.createSearchableSelect && this.formData.unternehmen_id) {
      const filtered = this.marken.filter(m => m.unternehmen_id === this.formData.unternehmen_id);
      window.formSystem.createSearchableSelect(markeSelect, filtered.map(m => ({
        value: m.id,
        label: m.markenname,
        selected: m.id === this.formData.marke_id
      })), {
        name: 'marke_id',
        placeholder: 'Marke suchen...',
        value: this.formData.marke_id || null
      });
    }

    const assigneeSelect = document.getElementById('assignee_id');
    if (assigneeSelect && window.formSystem?.createSearchableSelect) {
      window.formSystem.createSearchableSelect(assigneeSelect, this.benutzer.map(b => ({
        value: b.id,
        label: b.name,
        selected: b.id === this.formData.assignee_id
      })), {
        name: 'assignee_id',
        placeholder: 'Mitarbeiter suchen...',
        value: this.formData.assignee_id || null
      });
    }

    const produktSelect = document.getElementById('produkt_ids');
    if (produktSelect && window.formSystem?.createSearchableSelect && this.formData.unternehmen_id) {
      const selected = new Set(this.formData.produkt_ids || []);
      window.formSystem.createSearchableSelect(produktSelect, (this.produkte || []).map(p => ({
        value: p.id,
        label: p.name || p.id,
        selected: selected.has(p.id)
      })), {
        name: 'produkt_ids',
        type: 'multiselect',
        tagBased: true,
        placeholder: 'Produkte suchen und hinzufügen...'
      });
    }
  } finally {
    setTimeout(() => { this._isInitializing = false; }, 100);
  }
};
