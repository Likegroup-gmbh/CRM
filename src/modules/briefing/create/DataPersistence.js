// DataPersistence.js
// Persistierung des Briefing-Generators: Draft speichern, Submit,
// DB-Payload, Validierung, Laden. Sammelt Formulardaten generisch
// anhand der Feld-Definitionen aus fieldConfig.js.

import { BriefingCreate } from './BriefingCreateCore.js';
import { getAllFields, flattenFields, FLOW_STEPS, isFieldActive } from './fieldConfig.js';
import { intervallOderNull, videolaengeAusBriefing } from '../videolaenge.js';
import { starteBriefingAuswertung } from './BriefingAuswertung.js';
import { backTarget } from '../../../core/navHerkunft.js';

function collectableFields() {
  const fields = [];
  for (const step of FLOW_STEPS) {
    for (const section of step.sections) {
      fields.push(...flattenFields(section.fields).filter(f => f.type !== 'disclosure'));
    }
  }
  const seen = new Set();
  return fields.filter(f => {
    if (seen.has(f.name)) return false;
    seen.add(f.name);
    return true;
  });
}

// ---------------------------------------------------------------
// Formular -> formData (generisch ueber Feld-Schema)
// ---------------------------------------------------------------
BriefingCreate.prototype.saveCurrentStepData = function() {
  const form = document.getElementById('briefing-form');
  if (!form) return;

  for (const field of collectableFields()) {
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
      case 'sekundenSpanne': {
        const root = form.querySelector(`[data-sekunden-spanne="${field.name}"]`);
        if (root) {
          const von = root.dataset.von;
          const bis = root.dataset.bis;
          this.formData[field.name] = (von === '' || bis === '')
            ? null
            : intervallOderNull(von, bis);
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
      case 'entityMulti': {
        const select = form.querySelector(`#${field.name}_hidden`)
          || form.querySelector(`select[name="${field.name}[]"]`)
          || form.querySelector(`[data-entity-multi="${field.name}"] select[multiple]`)
          || form.querySelector(`select#${field.name}`);
        if (select) {
          this.formData[field.name] = Array.from(select.selectedOptions).map(o => o.value);
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
};

// ---------------------------------------------------------------
// formData -> DB-Payload
// ---------------------------------------------------------------
BriefingCreate.prototype.prepareDataForDB = function() {
  const bereich = this.formData.bereich || this.selectedBereich;

  const data = {
    bereich,
    unternehmen_id: this.formData.unternehmen_id || null,
    marke_id: this.formData.marke_id || null,
    assignee_id: this.formData.assignee_id || null
  };

  for (const field of getAllFields()) {
    if (field.type === 'sekundenSpanne') continue;
    if (!isFieldActive(field.name, { ...this.formData, bereich })) {
      data[field.name] = defaultForField(field);
      continue;
    }

    let value = this.formData[field.name];

    switch (field.type) {
      case 'checkbox':
        data[field.name] = value === true;
        break;
      case 'checkboxes':
      case 'customMulti':
      case 'entityMulti':
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
        data[field.name] = isBooleanRadio(field)
          ? value === true
          : ((value === '' || value === undefined) ? null : value);
        break;
      case 'number': {
        const n = Number(value);
        data[field.name] = (value === '' || value === undefined || value === null || Number.isNaN(n))
          ? null
          : n;
        break;
      }
      default:
        data[field.name] = (value === '' || value === undefined) ? null : value;
    }
  }

  if (bereich === 'influencer_marketing' && (data.tkp === null || data.tkp === undefined)) {
    data.tkp = 25;
  }

  const laenge = intervallOderNull(this.formData.videolaenge?.von, this.formData.videolaenge?.bis);
  data.videolaenge_von = laenge?.von ?? null;
  data.videolaenge_bis = laenge?.bis ?? null;

  mirrorLegacyColumns(data, bereich);
  return data;
};

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
    case 'customMulti':
    case 'entityMulti': return null;
    case 'group':
    case 'channelGroup':
    case 'repeatableKpi':
    case 'repeatableText':
    case 'repeatableUpload': return null;
    default: return null;
  }
}

function mirrorLegacyColumns(data, bereich) {
  const prefix = { influencer_marketing: 'im_', paid_creator_ads: 'pa_', owned_social: 'os_' }[bereich];
  if (!prefix) return;
  data[`${prefix}nischen`] = data.nischen || null;
  data[`${prefix}creator_groessen`] = data.creator_groessen || null;
  data[`${prefix}creator_merkmale`] = data.creator_merkmale || null;
  data[`${prefix}voraussetzungen`] = data.voraussetzungen || null;
  data[`${prefix}voraussetzungen_custom`] = data.produkt_erfahrung || null;
  data[`${prefix}umsetzung`] = data.aufgabe || null;
  data[`${prefix}situationen`] = data.setting || null;
  if (bereich === 'paid_creator_ads') {
    data.pa_channels = data.ad_channels || null;
    data.pa_funnel_stufen = data.funnel_stufen || null;
    data.pa_objectives = data.paid_objectives || null;
    data.pa_ziel_url = data.ziel_url || null;
  } else if (bereich === 'owned_social') {
    data.os_channels = data.publish_channels || null;
    data.os_content_ziele = data.content_ziele || null;
  } else {
    data.im_channels = data.publish_channels || null;
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
      window.toastSystem?.show('Bitte füllen Sie alle Pflichtfelder aus.', 'warning');
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
    await this.persistDraft();
    window.toastSystem?.show(this.editId ? 'Entwurf aktualisiert!' : 'Entwurf gespeichert!', 'success');
    setTimeout(() => {
      window.navigateTo(backTarget('/briefing'));
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

/**
 * Interner Draft ohne Toast und ohne Navigation. Wird vom Liky-Panel
 * aufgerufen, wenn das erste Kundenbriefing hereinkommt und noch keine
 * Briefing-ID existiert.
 */
BriefingCreate.prototype.persistDraft = async function() {
  const data = this.prepareDataForDB();
  data.is_draft = true;

  if (this.editId) {
    const { error } = await window.supabase
      .from('campaign_briefings')
      .update(data)
      .eq('id', this.editId);
    if (error) throw error;
    return this.editId;
  }

  const { data: created, error } = await window.supabase
    .from('campaign_briefings')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  this.editId = created.id;
  return created.id;
};

BriefingCreate.prototype.handleSubmit = async function() {
  if (!this.validateCurrentStep()) return;
  this.saveCurrentStepData();

  if (!this.formData.unternehmen_id) {
    window.toastSystem?.show('Bitte ein Unternehmen zuordnen (Schritt Grundlage).', 'warning');
    return;
  }
  if (!this.formData.aktivierung_name) {
    window.toastSystem?.show('Bitte einen Titel vergeben (Schritt Grundlage).', 'warning');
    return;
  }
  const kampagneId = this.formData.kampagne_id || this._produktionKontext?.kampagneId || null;
  const produktId = this.formData.produkt_id || this._produktionKontext?.produktId || null;
  if (!kampagneId) {
    window.toastSystem?.show('Bitte eine Kampagne zuordnen (Schritt Grundlage).', 'warning');
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

    let auswertungOk = false;
    try {
      await starteBriefingAuswertung({ briefingId: this.editId });
      auswertungOk = true;
    } catch (auswertungError) {
      console.warn('KI-Auswertung:', auswertungError);
    }

    const { ensureBriefingLine } = await import('../../produktion/ProduktionService.js');
    const produktion = await ensureBriefingLine({
      briefing: {
        id: this.editId,
        is_draft: false,
        aktivierung_name: data.aktivierung_name,
        bereich: data.bereich,
        publish_channels: data.publish_channels,
        tkp: data.tkp,
        unternehmen_id: data.unternehmen_id,
        marke_id: data.marke_id,
        kampagne_id: kampagneId,
        produkt_id: produktId
      },
      kampagneId,
      produktId,
      produktionId: this._produktionKontext?.produktionId || null
    });

    window.toastSystem?.show(
      auswertungOk
        ? 'Briefing gespeichert – KI-Auswertung läuft im Hintergrund'
        : (isEdit ? 'Briefing aktualisiert!' : 'Briefing erfolgreich erstellt!'),
      'success'
    );

    setTimeout(() => {
      window.navigateTo(produktion?.id ? `/produktion/${produktion.id}` : backTarget('/briefing'));
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
    const laenge = videolaengeAusBriefing(briefing);
    if (laenge) this.formData.videolaenge = laenge;

    this.formData.bereich = briefing.bereich;
    this.formData.unternehmen_id = briefing.unternehmen_id;
    this.formData.marke_id = briefing.marke_id;
    this.formData.assignee_id = briefing.assignee_id;

    const { data: produktion } = await window.supabase
      .from('produktion')
      .select('id, kampagne_id, produkt_id')
      .eq('briefing_id', id)
      .maybeSingle();
    if (produktion?.id) {
      if (produktion.kampagne_id) this.formData.kampagne_id = produktion.kampagne_id;
      if (produktion.produkt_id) this.formData.produkt_id = produktion.produkt_id;
      this._produktionKontext = {
        kampagneId: this.formData.kampagne_id,
        produktId: this.formData.produkt_id,
        produktionId: produktion.id
      };
      this._linieGesperrt = !!this.formData.kampagne_id;
    }

    await this.refreshProdukte();

    this.selectedBereich = briefing.bereich;
    this.isGenerated = true;
    this.currentStep = 2;
  } catch (error) {
    console.error('Fehler beim Laden des Briefings:', error);
    window.toastSystem?.show('Briefing konnte nicht geladen werden', 'error');
  }
};
