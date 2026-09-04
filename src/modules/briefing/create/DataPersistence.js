// DataPersistence.js
// Persistierung des Briefing-Generators: Draft speichern, Submit,
// DB-Payload, Validierung, Laden. Sammelt Formulardaten generisch
// anhand der Feld-Definitionen aus fieldConfig.js.

import { BriefingCreate } from './BriefingCreateCore.js';
import { getAllFields, evaluateCondition } from './fieldConfig.js';
import { starteBriefingAuswertung } from './BriefingAuswertung.js';
import { loadBriefingProdukte, syncBriefingProdukte } from '../BriefingProdukte.js';

// ---------------------------------------------------------------
// Formular -> formData (generisch ueber Feld-Schema)
// ---------------------------------------------------------------
BriefingCreate.prototype.saveCurrentStepData = function() {
  const form = document.getElementById('briefing-form');
  if (!form) return;

  for (const field of getAllFields()) {
    switch (field.type) {
      case 'checkbox': {
        const input = form.querySelector(`input[name="${field.name}"]`);
        if (input) this.formData[field.name] = input.checked;
        break;
      }
      case 'checkboxes': {
        const inputs = form.querySelectorAll(`input[name="${field.name}"]`);
        if (inputs.length > 0) {
          this.formData[field.name] = Array.from(inputs).filter(cb => cb.checked).map(cb => cb.value);
        }
        break;
      }
      case 'customMulti': {
        const inputs = form.querySelectorAll(`input[name="${field.name}"]`);
        const customInput = form.querySelector(`input[name="${field.name}__custom"]`);
        if (inputs.length > 0 || customInput) {
          const checked = Array.from(inputs).filter(cb => cb.checked).map(cb => cb.value);
          const custom = (customInput?.value || '')
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);
          this.formData[field.name] = [...checked, ...custom];
        }
        break;
      }
      case 'group': {
        const firstSub = form.querySelector(`[name="${field.name}__${field.fields[0].name}"]`);
        if (firstSub) {
          const obj = {};
          for (const sub of field.fields) {
            const input = form.querySelector(`[name="${field.name}__${sub.name}"]`);
            obj[sub.name] = input?.value || '';
          }
          this.formData[field.name] = obj;
        }
        break;
      }
      case 'channelGroup': {
        const anyChannel = form.querySelector(`[name^="${field.name}__"]`);
        if (anyChannel) {
          const obj = {};
          for (const channel of field.channels) {
            const inputs = form.querySelectorAll(`input[name="${field.name}__${channel.key}"]`);
            if (!channel.formats) {
              const toggle = form.querySelector(`input[name="${field.name}__${channel.key}"]`);
              if (toggle) obj[channel.key] = toggle.checked;
            } else if (inputs.length > 0) {
              obj[channel.key] = Array.from(inputs).filter(cb => cb.checked).map(cb => cb.value);
            }
          }
          const weitere = form.querySelector(`input[name="${field.name}__weitere"]`);
          if (weitere && weitere.value.trim()) obj.weitere = weitere.value.trim();
          this.formData[field.name] = obj;
        }
        break;
      }
      case 'repeatableKpi': {
        const container = form.querySelector(`[data-repeatable="${field.name}"]`);
        if (container) {
          this.formData[field.name] = Array.from(container.querySelectorAll('[data-repeatable-row]'))
            .map(row => ({
              kpi: row.querySelector('[data-kpi]')?.value || '',
              zielwert: row.querySelector('[data-zielwert]')?.value || ''
            }))
            .filter(entry => entry.kpi || entry.zielwert);
        }
        break;
      }
      case 'repeatableText': {
        const container = form.querySelector(`[data-repeatable="${field.name}"]`);
        if (container) {
          this.formData[field.name] = Array.from(container.querySelectorAll('[data-item]'))
            .map(input => input.value.trim())
            .filter(Boolean);
        }
        break;
      }
      case 'repeatableUpload': {
        const container = form.querySelector(`[data-repeatable="${field.name}"]`);
        if (container) {
          this.formData[field.name] = Array.from(container.querySelectorAll('[data-repeatable-row]'))
            .map(row => {
              const typ = row.querySelector('[data-typ]')?.value || 'url';
              if (typ === 'upload') {
                return {
                  typ,
                  value: row.querySelector('[data-value]')?.value || '',
                  label: row.querySelector('[data-label]')?.value || ''
                };
              }
              return { typ, value: row.querySelector('[data-url]')?.value.trim() || '' };
            })
            .filter(entry => entry.value);
        }
        break;
      }
      case 'radio': {
        const checked = form.querySelector(`input[name="${field.name}"]:checked`);
        if (checked) {
          this.formData[field.name] = checked.value === 'true' ? true : checked.value === 'false' ? false : checked.value;
        } else if (form.querySelector(`input[name="${field.name}"]`)) {
          this.formData[field.name] = null;
        }
        break;
      }
      default: {
        const input = form.querySelector(`[name="${field.name}"]`);
        if (input) this.formData[field.name] = input.value;
      }
    }
  }

  if (this.selectedBereich && !this.formData.bereich) {
    this.formData.bereich = this.selectedBereich;
  }

  const produktSelect = form.querySelector('#produkt_ids_hidden')
    || form.querySelector('select[name="produkt_ids[]"]')
    || form.querySelector('[data-entity-multi="produkt_ids"] select[multiple]')
    || form.querySelector('select#produkt_ids');
  if (produktSelect) {
    this.formData.produkt_ids = Array.from(produktSelect.selectedOptions).map(o => o.value);
  }
};

// ---------------------------------------------------------------
// formData -> DB-Payload
// ---------------------------------------------------------------
BriefingCreate.prototype.prepareDataForDB = function() {
  const bereich = this.formData.bereich || this.selectedBereich;
  const prefixByBereich = { influencer_marketing: 'im_', paid_creator_ads: 'pa_', owned_social: 'os_' };
  const activePrefix = prefixByBereich[bereich];

  const data = {
    bereich,
    unternehmen_id: this.formData.unternehmen_id || null,
    marke_id: this.formData.marke_id || null,
    assignee_id: this.formData.assignee_id || null
  };

  for (const field of getAllFields()) {
    // Modul-Felder anderer Bereiche explizit leeren
    const isModuleField = /^(im|pa|os)_/.test(field.name);
    if (isModuleField && !field.name.startsWith(activePrefix)) {
      data[field.name] = defaultForField(field);
      continue;
    }

    let value = this.formData[field.name];

    // Nicht erfuellte Conditions -> Feld leeren (keine versteckten Alt-Werte)
    if (field.condition && !evaluateCondition(field.condition, this.formData)) {
      data[field.name] = defaultForField(field);
      continue;
    }

    switch (field.type) {
      case 'checkbox':
        data[field.name] = value === true;
        break;
      case 'checkboxes':
      case 'customMulti':
        data[field.name] = Array.isArray(value) && value.length ? value : null;
        break;
      case 'group':
      case 'channelGroup':
        data[field.name] = value && Object.keys(value).length ? value : null;
        break;
      case 'repeatableKpi':
      case 'repeatableText':
      case 'repeatableUpload':
        data[field.name] = Array.isArray(value) && value.length ? value : null;
        break;
      case 'radio':
        // Boolean-Radios mappen auf NOT-NULL-Boolean-Spalten: unbeantwortet = false
        data[field.name] = isBooleanRadio(field)
          ? value === true
          : ((value === '' || value === undefined) ? null : value);
        break;
      default:
        data[field.name] = (value === '' || value === undefined) ? null : value;
    }
  }

  return data;
}

// Radio mit ausschliesslich true/false-Optionen -> boolean-Spalte (NOT NULL DEFAULT false)
export function isBooleanRadio(field) {
  return field.type === 'radio'
    && Array.isArray(field.options) && field.options.length > 0
    && field.options.every(o => o.value === 'true' || o.value === 'false');
};

function defaultForField(field) {
  switch (field.type) {
    case 'checkbox': return false;
    case 'radio': return isBooleanRadio(field) ? false : null;
    case 'checkboxes':
    case 'customMulti': return null;
    case 'group':
    case 'channelGroup':
    case 'repeatableKpi':
    case 'repeatableText':
    case 'repeatableUpload': return null;
    default: return null;
  }
}

// ---------------------------------------------------------------
// Validierung (nur sichtbare Pflichtfelder)
// ---------------------------------------------------------------
BriefingCreate.prototype.validateCurrentStep = function() {
  const form = document.getElementById('briefing-form');
  if (!form) return true;

  const requiredFields = form.querySelectorAll('[required]');
  for (const field of requiredFields) {
    if (field.closest('.hidden')) continue; // conditional-ausgeblendete Felder ignorieren
    if (!field.value) {
      field.focus();
      window.toastSystem?.show('Bitte fuellen Sie alle Pflichtfelder aus.', 'warning');
      return false;
    }
  }
  return true;
};

// ---------------------------------------------------------------
// Draft / Submit / Load
// ---------------------------------------------------------------
BriefingCreate.prototype.saveDraftToDB = async function() {
  this.saveCurrentStepData();

  const saveDraftBtn = document.getElementById('btn-save-draft');
  const saveDraftLabel = saveDraftBtn?.querySelector('.btn-label');
  if (saveDraftBtn) {
    saveDraftBtn.disabled = true;
    if (saveDraftLabel) saveDraftLabel.textContent = 'Speichert...';
  }

  try {
    const data = this.prepareDataForDB();
    data.is_draft = true;

    if (this.editId) {
      const { error } = await window.supabase
        .from('campaign_briefings')
        .update(data)
        .eq('id', this.editId);
      if (error) throw error;
      await syncBriefingProdukte(this.editId, this.formData.produkt_ids);
      window.toastSystem?.show('Entwurf aktualisiert!', 'success');
    } else {
      const { data: created, error } = await window.supabase
        .from('campaign_briefings')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      this.editId = created.id;
      await syncBriefingProdukte(this.editId, this.formData.produkt_ids);
      window.toastSystem?.show('Entwurf gespeichert!', 'success');
    }

    setTimeout(() => {
      window.navigateTo('/briefing');
    }, 500);
  } catch (error) {
    console.error('Fehler beim Speichern des Entwurfs:', error);
    window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
  } finally {
    if (saveDraftBtn) {
      saveDraftBtn.disabled = false;
      if (saveDraftLabel) saveDraftLabel.textContent = 'Als Entwurf speichern';
    }
  }
};

BriefingCreate.prototype.handleSubmit = async function() {
  if (!this.validateCurrentStep()) return;
  this.saveCurrentStepData();

  if (!this.formData.unternehmen_id) {
    window.toastSystem?.show('Bitte ein Unternehmen zuordnen (Step "Master").', 'warning');
    return;
  }
  if (!this.formData.aktivierung_name) {
    window.toastSystem?.show('Bitte einen Namen fuer die Aktivierung vergeben (Step "Master").', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-submit');
  const isEdit = !!this.editId;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = isEdit ? 'Wird aktualisiert...' : 'Wird erstellt...';
  }

  try {
    const data = this.prepareDataForDB();
    data.is_draft = false;

    if (this.editId) {
      const { error } = await window.supabase
        .from('campaign_briefings')
        .update(data)
        .eq('id', this.editId);
      if (error) throw error;
    } else {
      const { data: created, error } = await window.supabase
        .from('campaign_briefings')
        .insert([data])
        .select('id')
        .single();
      if (error) throw error;
      this.editId = created.id;
    }

    await syncBriefingProdukte(this.editId, this.formData.produkt_ids);

    let auswertungOk = false;
    try {
      await starteBriefingAuswertung({ briefingId: this.editId });
      auswertungOk = true;
    } catch (auswertungError) {
      console.warn('KI-Auswertung:', auswertungError);
    }

    window.toastSystem?.show(
      auswertungOk
        ? 'Briefing gespeichert – KI-Auswertung läuft im Hintergrund'
        : (isEdit ? 'Briefing aktualisiert!' : 'Briefing erfolgreich erstellt!'),
      'success'
    );

    setTimeout(() => {
      window.navigateTo('/briefing');
    }, 500);
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? 'Briefing aktualisieren' : 'Briefing erstellen';
    }
  }
};

BriefingCreate.prototype.loadFromDB = async function(id) {
  try {
    const { data: briefing, error } = await window.supabase
      .from('campaign_briefings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!briefing) return;

    // Alle bekannten Felder uebernehmen (Spaltennamen == formData-Keys)
    this.formData = {};
    for (const field of getAllFields()) {
      if (briefing[field.name] !== undefined && briefing[field.name] !== null) {
        this.formData[field.name] = briefing[field.name];
      }
    }
    this.formData.bereich = briefing.bereich;
    this.formData.unternehmen_id = briefing.unternehmen_id;
    this.formData.marke_id = briefing.marke_id;
    this.formData.assignee_id = briefing.assignee_id;

    const produkte = await loadBriefingProdukte(id);
    this.formData.produkt_ids = produkte.map(p => p.id);
    await this.refreshProdukte();

    this.selectedBereich = briefing.bereich;
    this.isGenerated = true;
    this.currentStep = 2;
  } catch (error) {
    console.error('Fehler beim Laden des Briefings:', error);
    window.toastSystem?.show('Briefing konnte nicht geladen werden', 'error');
  }
};
