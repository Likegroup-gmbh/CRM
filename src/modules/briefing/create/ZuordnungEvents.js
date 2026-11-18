// ZuordnungEvents.js
// Zuordnung des Briefings: Unternehmen -> Marke -> Kampagne -> Produktion.
// Bekannter Kontext (aus Produktion oder Kampagne angelegt) ist gesperrt und unsichtbar,
// sichtbar bleibt nur, was fehlt. Wenn nichts fehlt, verschwindet die ganze Sektion.

import { BriefingCreate } from './BriefingCreateCore.js';
import { escapeHtml } from '../../../core/format.js';

function produktionOptionLabel(row) {
  const name = row?.name || 'Produktion';
  if (row?.budget == null) return name;
  const betrag = Number(row.budget).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  return `${name} · ${betrag}`;
}

/** Sektion „Zuordnung“ ausblenden, sobald kein Feld darin mehr sichtbar ist. */
BriefingCreate.prototype.aktualisiereZuordnung = function() {
  const section = document.querySelector('[data-section="zuordnung"]');
  if (!section) return;
  const offen = [...section.querySelectorAll('.form-field')].some(f => !f.classList.contains('hidden'));
  section.classList.toggle('hidden', !offen);
};

BriefingCreate.prototype.syncZielProduktion = async function() {
  const select = document.getElementById('produktion_id');
  if (!select || !window.supabase) return;
  const field = select.closest('.form-field');
  const kampagneId = this.formData.kampagne_id || this._produktionKontext?.kampagneId || null;
  if (!kampagneId) {
    field?.classList.add('hidden');
    select.required = false;
    this.formData.produktion_id = null;
    this.aktualisiereZuordnung();
    return;
  }

  const { data, error } = await window.supabase
    .from('produktion')
    .select('id, name, budget')
    .eq('kampagne_id', kampagneId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('Produktionen für das Briefing nicht geladen', error);
    return;
  }

  // Eine Produktion nimmt beliebig viele Briefings auf (Linien, ADR 0045).
  const rows = data || [];
  const boundId = this._produktionKontext?.produktionId || null;
  const current = this.formData.produktion_id || boundId || '';
  const placeholder = rows.length ? 'Produktion auswählen...' : 'Keine Produktion – im Auftrag oder in der Kampagne anlegen';
  select.innerHTML = `<option value="">${placeholder}</option>${rows.map(row => `
    <option value="${escapeHtml(row.id)}">${escapeHtml(produktionOptionLabel(row))}</option>
  `).join('')}`;
  select.value = rows.some(row => row.id === current) ? current : '';
  const locked = !!boundId && rows.some(row => row.id === boundId);
  select.disabled = locked;
  select.required = !locked;
  field?.classList.toggle('hidden', locked);
  this.formData.produktion_id = select.value || null;
  this.aktualisiereZuordnung();
};

BriefingCreate.prototype.bindCascadeEvents = function() {
  if (this._linieGesperrt) return;

  document.getElementById('unternehmen_id')?.addEventListener('change', (e) => {
    this.formData.unternehmen_id = e.target.value || null;
    this.formData.marke_id = null;
    this.formData.kampagne_id = null;
    this.rebuildMarkeSelect();
    this.rebuildLinieSelects();
  });

  document.getElementById('marke_id')?.addEventListener('change', (e) => {
    this.formData.marke_id = e.target.value || null;
    this.formData.kampagne_id = null;
    this.rebuildLinieSelects();
  });
};

BriefingCreate.prototype.rebuildLinieSelects = function() {
  const unternehmenId = this.formData.unternehmen_id;
  const markeId = this.formData.marke_id;
  const kampagnen = (this.kampagnen || []).filter(k => {
    if (!unternehmenId || k.unternehmen_id !== unternehmenId) return false;
    if (markeId && k.marke_id && k.marke_id !== markeId) return false;
    return true;
  });
  // Gesperrt: die vorbelegte Kampagne bleibt sichtbar, auch wenn der Filter sie ausschließt.
  if (this._linieGesperrt) {
    const gewaehlt = (this.kampagnen || []).find(k => k.id === this.formData.kampagne_id);
    if (gewaehlt && !kampagnen.some(k => k.id === gewaehlt.id)) kampagnen.unshift(gewaehlt);
  }
  this.rebuildEntitySelect('kampagne_id', kampagnen, {
    labelKey: 'label',
    placeholder: unternehmenId ? 'Kampagne auswählen...' : 'Bitte zuerst Unternehmen wählen...',
    locked: !!this._linieGesperrt
  });
};

BriefingCreate.prototype.rebuildEntitySelect = function(name, options, { labelKey, placeholder, locked = false }) {
  const select = document.getElementById(name);
  if (!select) return;

  select.closest('.form-field')?.querySelector('.searchable-select-container')?.remove();
  select.style.display = '';

  const current = this.formData[name] || '';
  const enabled = !!this.formData.unternehmen_id && !locked;
  select.innerHTML = `
    <option value="">${escapeHtml(placeholder)}</option>
    ${options.map(o => `<option value="${escapeHtml(o.id)}" ${current === o.id ? 'selected' : ''}>${escapeHtml(o[labelKey] || o.id)}</option>`).join('')}
  `;
  select.disabled = !enabled;
  select.value = current;

  if (enabled && window.formSystem?.createSearchableSelect) {
    window.formSystem.createSearchableSelect(select, options.map(o => ({
      value: o.id,
      label: o[labelKey] || o.id,
      selected: o.id === current
    })), { name, placeholder, value: current || null });
  }
};

BriefingCreate.prototype.rebuildMarkeSelect = function() {
  const markeSelect = document.getElementById('marke_id');
  if (!markeSelect) return;

  markeSelect.closest('.form-field')?.querySelector('.searchable-select-container')?.remove();
  markeSelect.style.display = '';

  const unternehmenId = this.formData.unternehmen_id;
  const filtered = unternehmenId ? this.marken.filter(m => m.unternehmen_id === unternehmenId) : [];
  const gesperrt = !!this._linieGesperrt;
  const aktuell = this.formData.marke_id || '';
  if (gesperrt && aktuell && !filtered.some(m => m.id === aktuell)) {
    const gewaehlt = this.marken.find(m => m.id === aktuell);
    if (gewaehlt) filtered.unshift(gewaehlt);
  }
  markeSelect.innerHTML = `
    <option value="">${gesperrt ? '–' : (unternehmenId ? 'Marke auswählen (optional)...' : 'Bitte zuerst Unternehmen wählen...')}</option>
    ${filtered.map(m => `<option value="${escapeHtml(m.id)}" ${gesperrt && aktuell === m.id ? 'selected' : ''}>${escapeHtml(m.markenname)}</option>`).join('')}
  `;
  markeSelect.disabled = gesperrt || !unternehmenId;
  if (gesperrt) markeSelect.value = aktuell;

  if (!gesperrt && unternehmenId && window.formSystem?.createSearchableSelect) {
    window.formSystem.createSearchableSelect(markeSelect, filtered.map(m => ({ value: m.id, label: m.markenname })), {
      name: 'marke_id',
      placeholder: 'Marke suchen...',
      value: null
    });
  }
};

function searchable(select, options, { name, placeholder, value }) {
  if (!select || !window.formSystem?.createSearchableSelect) return;
  window.formSystem.createSearchableSelect(select, options, { name, placeholder, value: value || null });
}

BriefingCreate.prototype.initSearchableSelects = function() {
  this._isInitializing = true;
  try {
    if (this._linieGesperrt) return;
    const { unternehmen_id: unternehmenId, marke_id: markeId, kampagne_id: kampagneId } = this.formData;

    searchable(document.getElementById('unternehmen_id'), this.unternehmen.map(u => ({
      value: u.id, label: u.firmenname, selected: u.id === unternehmenId
    })), { name: 'unternehmen_id', placeholder: 'Unternehmen suchen...', value: unternehmenId });

    if (!unternehmenId) return;
    searchable(document.getElementById('marke_id'), this.marken
      .filter(m => m.unternehmen_id === unternehmenId)
      .map(m => ({ value: m.id, label: m.markenname, selected: m.id === markeId })),
    { name: 'marke_id', placeholder: 'Marke suchen...', value: markeId });

    const kampagneSelect = document.getElementById('kampagne_id');
    if (kampagneSelect && !kampagneSelect.disabled) {
      searchable(kampagneSelect, (this.kampagnen || [])
        .filter(k => k.unternehmen_id === unternehmenId && (!markeId || !k.marke_id || k.marke_id === markeId))
        .map(k => ({ value: k.id, label: k.label, selected: k.id === kampagneId })),
      { name: 'kampagne_id', placeholder: 'Kampagne suchen...', value: kampagneId });
    }
  } finally {
    setTimeout(() => { this._isInitializing = false; }, 100);
  }
};
