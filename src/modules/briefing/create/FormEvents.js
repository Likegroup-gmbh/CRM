// FormEvents.js
// Event-Binding fuer den Briefing-Generator: Multistep-Navigation,
// Conditional-Logic (Live-Toggle), Repeatable-Felder, Uploads,
// Unternehmen->Marke-Kaskade, Searchable Selects.

import { BriefingCreate } from './BriefingCreateCore.js';
import { evaluateCondition, getAllFields } from './fieldConfig.js';
import {
  commitZahl, sekundeAnPosition, spreize, zieheGriff
} from '../videolaenge.js';
import { escapeHtml } from './FieldRenderer.js';
import { icon } from '../../../core/icons/IconSystem.js';
import { backTarget } from '../../../core/navHerkunft.js';

BriefingCreate.prototype.bindMultistepEvents = function() {
  const cancelBtn = document.getElementById('btn-cancel');
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  const submitBtn = document.getElementById('btn-submit');
  const saveDraftBtn = document.getElementById('btn-save-draft');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      window.navigateTo(backTarget('/briefing'));
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
  this.bindSekundenSpanne();
};

function spanneLesen(root) {
  const von = root.dataset.von;
  const bis = root.dataset.bis;
  if (von === '' || bis === '' || von == null || bis == null) return null;
  return { von: Number(von), bis: Number(bis) };
}

function spanneSchreiben(root, iv, { forceInputs = false } = {}) {
  const min = Number(root.dataset.min) || 1;
  const max = Number(root.dataset.max) || 180;
  const leer = !iv;
  root.dataset.von = leer ? '' : String(iv.von);
  root.dataset.bis = leer ? '' : String(iv.bis);
  root.querySelector('.sek-spanne')?.classList.toggle('is-empty', leer);

  const pct = (n) => (max === min ? 0 : ((n - min) / (max - min)) * 100);
  const vonPct = leer ? 0 : pct(iv.von);
  const bisPct = leer ? 0 : pct(iv.bis);
  const fill = root.querySelector('[data-fill]');
  if (fill) {
    fill.style.left = `${vonPct}%`;
    fill.style.width = `${Math.max(0, bisPct - vonPct)}%`;
  }
  const vonHandle = root.querySelector('[data-handle="von"]');
  const bisHandle = root.querySelector('[data-handle="bis"]');
  if (vonHandle) vonHandle.style.left = `${vonPct}%`;
  if (bisHandle) bisHandle.style.left = `${bisPct}%`;

  const aktiv = forceInputs ? null : document.activeElement;
  const vonInput = root.querySelector('[data-sek="von"]');
  const bisInput = root.querySelector('[data-sek="bis"]');
  if (vonInput && aktiv !== vonInput) vonInput.value = leer ? '' : String(iv.von);
  if (bisInput && aktiv !== bisInput) bisInput.value = leer ? '' : String(iv.bis);
}

function sekundeAmZeiger(root, event) {
  const track = root.querySelector('[data-track]');
  const rect = track.getBoundingClientRect();
  const ratio = rect.width ? (event.clientX - rect.left) / rect.width : 0;
  return sekundeAnPosition(ratio, Number(root.dataset.min) || 1, Number(root.dataset.max) || 180);
}

BriefingCreate.prototype.bindSekundenSpanne = function() {
  const form = document.getElementById('briefing-form');
  if (!form) return;

  form.querySelectorAll('[data-sekunden-spanne]').forEach(root => {
    const track = root.querySelector('[data-track]');
    track?.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button !== 0) return;
      const handle = e.target.closest?.('[data-handle]');
      const start = spanneLesen(root);
      if (start && start.von !== start.bis && !handle) return;

      const sek = sekundeAmZeiger(root, e);
      let mode;
      let anchor = null;
      if (start && start.von !== start.bis && handle) {
        mode = handle.dataset.handle;
      } else {
        mode = 'spread';
        anchor = (start && start.von === start.bis && handle) ? start.von : sek;
        spanneSchreiben(root, { von: anchor, bis: anchor });
      }

      const move = (ev) => {
        const jetzt = sekundeAmZeiger(root, ev);
        const next = mode === 'spread'
          ? spreize(anchor, jetzt)
          : zieheGriff({ von: start.von, bis: start.bis, seite: mode, sekunde: jetzt });
        if (next) spanneSchreiben(root, next);
      };
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
    });

    root.querySelectorAll('[data-sek]').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
      });
      input.addEventListener('blur', () => {
        const state = spanneLesen(root);
        const next = commitZahl({
          von: state?.von ?? null,
          bis: state?.bis ?? null,
          seite: input.dataset.sek,
          roh: input.value
        });
        spanneSchreiben(root, next, { forceInputs: true });
      });
    });

    root.querySelector('[data-leeren]')?.addEventListener('click', () => {
      spanneSchreiben(root, null, { forceInputs: true });
    });
  });
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
    if (wrapper.dataset.conditionJson) {
      try {
        const condition = JSON.parse(wrapper.dataset.conditionJson);
        wrapper.classList.toggle('hidden', !evaluateCondition(condition, this.formData));
      } catch (err) {
        console.warn('Briefing-Condition unlesbar', err);
      }
      return;
    }
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
    const optionsHtml = firstSelect ? firstSelect.innerHTML : '<option value="">KPI wählen...</option>';
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
      if (!this._linieGesperrt) this.formData.kampagne_id = null;
      this.rebuildMarkeSelect();
      await this.refreshProdukte();
      this.rebuildLinieSelects();
    });
  }

  const markeSelect = document.getElementById('marke_id');
  if (markeSelect) {
    markeSelect.addEventListener('change', async (e) => {
      this.formData.marke_id = e.target.value || null;
      if (!this._linieGesperrt) this.formData.kampagne_id = null;
      await this.refreshProdukte();
      this.rebuildLinieSelects();
    });
  }
};

BriefingCreate.prototype.rebuildLinieSelects = function() {
  const unternehmenId = this.formData.unternehmen_id;
  const markeId = this.formData.marke_id;
  const kampagnen = (this.kampagnen || []).filter(k => {
    if (!unternehmenId || k.unternehmen_id !== unternehmenId) return false;
    if (markeId && k.marke_id && k.marke_id !== markeId) return false;
    return true;
  });
  this.rebuildEntitySelect('kampagne_id', kampagnen, {
    labelKey: 'label',
    placeholder: unternehmenId ? 'Kampagne auswählen...' : 'Bitte zuerst Unternehmen wählen...',
    locked: this._linieGesperrt
  });
};

BriefingCreate.prototype.rebuildEntitySelect = function(name, options, { labelKey, placeholder, locked }) {
  const select = document.getElementById(name);
  if (!select) return;

  const container = select.closest('.form-field');
  const oldSearchable = container?.querySelector('.searchable-select-container');
  if (oldSearchable) oldSearchable.remove();
  select.style.display = '';

  const current = this.formData[name] || '';
  const enabled = !!this.formData.unternehmen_id && !locked;
  select.innerHTML = `
    <option value="">${escapeHtml(placeholder)}</option>
    ${options.map(o => `<option value="${o.id}" ${current === o.id ? 'selected' : ''}>${escapeHtml(o[labelKey] || o.id)}</option>`).join('')}
  `;
  select.disabled = !enabled;
  select.value = current;

  if (enabled && window.formSystem?.createSearchableSelect) {
    window.formSystem.createSearchableSelect(select, options.map(o => ({
      value: o.id,
      label: o[labelKey] || o.id,
      selected: o.id === current
    })), {
      name,
      placeholder,
      value: current || null
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
    <option value="">${unternehmenId ? 'Marke auswählen (optional)...' : 'Bitte zuerst Unternehmen wählen...'}</option>
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

    const kampagneSelect = document.getElementById('kampagne_id');
    if (kampagneSelect && !kampagneSelect.disabled && window.formSystem?.createSearchableSelect && this.formData.unternehmen_id) {
      const markeId = this.formData.marke_id;
      const filtered = (this.kampagnen || []).filter(k => {
        if (k.unternehmen_id !== this.formData.unternehmen_id) return false;
        if (markeId && k.marke_id && k.marke_id !== markeId) return false;
        return true;
      });
      window.formSystem.createSearchableSelect(kampagneSelect, filtered.map(k => ({
        value: k.id,
        label: k.label,
        selected: k.id === this.formData.kampagne_id
      })), {
        name: 'kampagne_id',
        placeholder: 'Kampagne suchen...',
        value: this.formData.kampagne_id || null
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

    void this.initNutzungsdauerSelect();
  } finally {
    setTimeout(() => { this._isInitializing = false; }, 100);
  }
};

function uniqueLabels(labels) {
  const out = [];
  const seen = new Set();
  for (const raw of labels) {
    const label = String(raw ?? '').trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

// Einfaches Searchable-Select mit allowCreate (nicht tagBased/Multiselect).
// Vorgaben plus Katalog. createLookupEntry schreibt nur displayField;
// label_norm setzt die Tabelle selbst.
BriefingCreate.prototype.initNutzungsdauerSelect = async function() {
  const select = document.getElementById('nutzungsdauer');
  if (!select || !window.formSystem?.createSearchableSelect) return;

  const field = getAllFields().find(item => item.name === 'nutzungsdauer');
  if (!field?.allowCreate) return;

  let extras = [];
  if (window.supabase) {
    const { data, error } = await window.supabase
      .from(field.table)
      .select(field.displayField)
      .order(field.displayField, { ascending: true });
    if (error) console.error('Nutzungsdauer-Katalog laden fehlgeschlagen:', error);
    else extras = (data || []).map(row => row[field.displayField]);
  }

  const current = String(this.formData.nutzungsdauer || '').trim();
  const currentKey = current.toLowerCase();
  const labels = uniqueLabels([
    ...(field.options || []).map(opt => opt.label),
    ...extras,
    current
  ]);

  window.formSystem.createSearchableSelect(select, labels.map(label => ({
    value: label,
    label,
    selected: Boolean(currentKey) && label.toLowerCase() === currentKey
  })), {
    name: field.name,
    placeholder: field.placeholder,
    allowCreate: true,
    table: field.table,
    displayField: field.displayField,
    valueField: field.valueField
  });
};
