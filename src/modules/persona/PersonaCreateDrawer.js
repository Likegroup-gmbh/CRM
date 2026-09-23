// PersonaCreateDrawer.js
// Rechter Create-Drawer. Kaskade: Unternehmen → Marke → Briefing, Produkt
// optional. Submit legt nichts an, sondern öffnet das Worksheet mit dieser
// Zuordnung.

import { applyFinalisiertFilter } from '../../core/finalisiert.js';
import { icon } from '../../core/icons/IconSystem.js';
import { personaCreateRoute } from './personaCreateScope.js';

const DRAWER_ID = 'persona-create-drawer';
const PREFIX = 'pccreate';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function allowedIds(fn) {
  const ids = await fn?.();
  return ids ?? null;
}

async function loadUnternehmen() {
  const allowed = await allowedIds(window.getAllowedUnternehmenIds);
  if (allowed !== null && allowed.length === 0) return [];

  let query = window.supabase.from('unternehmen').select('id, firmenname').order('firmenname');
  if (allowed !== null) query = query.in('id', allowed);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function loadMarken(unternehmenId) {
  const allowed = await allowedIds(window.getAllowedMarkenIds);
  if (allowed !== null && allowed.length === 0) return [];

  let query = window.supabase
    .from('marke')
    .select('id, markenname')
    .eq('unternehmen_id', unternehmenId)
    .order('markenname');
  if (allowed !== null) query = query.in('id', allowed);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function loadBriefings(unternehmenId, markeId) {
  let query = window.supabase
    .from('campaign_briefings')
    .select('id, aktivierung_name')
    .eq('unternehmen_id', unternehmenId)
    .eq('marke_id', markeId);
  query = applyFinalisiertFilter(query, 'campaign_briefings')
    .order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function loadProdukte(unternehmenId, markeId) {
  const { data, error } = await window.supabase
    .from('produkt_marke')
    .select('produkt:produkt_id(id, name, unternehmen_id)')
    .eq('marke_id', markeId);
  if (error) throw error;
  return (data || [])
    .map((row) => row.produkt)
    .filter((produkt) => produkt && produkt.unternehmen_id === unternehmenId)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'de'));
}

async function loadMarkeRow(markeId) {
  const { data, error } = await window.supabase
    .from('marke')
    .select('id, markenname, unternehmen_id, unternehmen:unternehmen_id(firmenname)')
    .eq('id', markeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function openPersonaCreateDrawer(prefill = null) {
  document.getElementById(`${DRAWER_ID}-overlay`)?.remove();
  document.getElementById(DRAWER_ID)?.remove();
  const drawer = new PersonaCreateDrawer();
  drawer.prefill = prefill || null;
  drawer.open();
}

export function closePersonaCreateDrawer() {
  const overlay = document.getElementById(`${DRAWER_ID}-overlay`);
  const panel = document.getElementById(DRAWER_ID);
  if (panel) {
    panel.classList.remove('show');
    setTimeout(() => {
      overlay?.remove();
      panel?.remove();
    }, 300);
  } else {
    overlay?.remove();
  }
}

class PersonaCreateDrawer {
  constructor() {
    this.prefill = null;
    this.origin = 'liste';
  }

  el(name) {
    return document.getElementById(`${PREFIX}-${name}`) || null;
  }

  async open() {
    this.origin = this.prefill?.origin || 'liste';
    if (this.prefill?.marke_id && !this.prefill.unternehmen_id) {
      await this.resolveMarkePrefill();
    }

    this.mount();
    requestAnimationFrame(() => {
      document.getElementById(DRAWER_ID)?.classList.add('show');
    });
    this.bindStatic();
    try {
      await this.loadUnternehmenOptions();
    } catch (err) {
      console.error('Unternehmen für die Persona konnten nicht geladen werden:', err);
      window.toastSystem?.show?.('Unternehmen konnten nicht geladen werden', 'error');
    }
    this.initDisabledDependents();
    await this.applyPrefill();
    this.syncSubmit();
  }

  async resolveMarkePrefill() {
    try {
      const marke = await loadMarkeRow(this.prefill.marke_id);
      if (!marke) return;
      this.prefill.unternehmen_id = marke.unternehmen_id || null;
      this.prefill.markeName = this.prefill.markeName || marke.markenname || null;
      this.prefill.unternehmenName = this.prefill.unternehmenName || marke.unternehmen?.firmenname || null;
    } catch (err) {
      console.error('Marke für den Persona-Drawer konnte nicht geladen werden:', err);
    }
  }

  mount() {
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${DRAWER_ID}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = DRAWER_ID;
    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Neue Persona</span>
          <p class="drawer-subtitle">Unternehmen, Marke und Briefing</p>
        </div>
        <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
      </div>
      <div class="drawer-body">
        <form id="${PREFIX}-form" class="drawer-form">
          <div class="form-field">
            <label for="${PREFIX}-unternehmen">Unternehmen *</label>
            <select id="${PREFIX}-unternehmen" class="form-input"><option value="">Laden...</option></select>
          </div>
          <div class="form-field">
            <label for="${PREFIX}-marke">Marke *</label>
            <select id="${PREFIX}-marke" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
            <p class="form-hint" id="${PREFIX}-marke-hint" hidden></p>
          </div>
          <div class="form-field">
            <label for="${PREFIX}-briefing">Briefing *</label>
            <select id="${PREFIX}-briefing" class="form-input" disabled><option value="">– Erst Marke wählen –</option></select>
            <p class="form-hint" id="${PREFIX}-briefing-hint" hidden></p>
          </div>
          <div class="form-field">
            <label for="${PREFIX}-produkt">Produkt</label>
            <select id="${PREFIX}-produkt" class="form-input" disabled><option value="">– Erst Briefing wählen –</option></select>
            <p class="form-hint" id="${PREFIX}-produkt-hint" hidden></p>
          </div>
          <div class="drawer-footer">
            <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
              <span class="mdc-btn__icon" aria-hidden="true">${icon('x-circle-filled')}</span>
              <span class="mdc-btn__label">Abbrechen</span>
            </button>
            <button type="submit" class="mdc-btn mdc-btn--create" id="${PREFIX}-submit" disabled>
              <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${icon('check-filled')}</span>
              <span class="mdc-btn__label">Weiter</span>
            </button>
          </div>
        </form>
      </div>
    `;

    overlay.addEventListener('click', () => closePersonaCreateDrawer());
    panel.querySelector('.drawer-close-btn').addEventListener('click', () => closePersonaCreateDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }

  bindStatic() {
    this.el('unternehmen')?.addEventListener('change', () => this.onUnternehmenChange());
    this.el('marke')?.addEventListener('change', () => this.onMarkeChange());
    this.el('briefing')?.addEventListener('change', () => this.onBriefingChange());
    this.el('produkt')?.addEventListener('change', () => this.syncSubmit());
    const form = document.getElementById(`${PREFIX}-form`);
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    form?.querySelector('[data-action="close"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      closePersonaCreateDrawer();
    });
  }

  refreshSearchableSelect(name, options, { placeholder, emptyLabel }) {
    const select = this.el(name);
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${emptyLabel}</option>`
      + options.map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('');
    if (current && [...select.options].some((o) => o.value === current)) select.value = current;
    if (!window.formSystem?.createSimpleSearchableSelect) return;
    window.formSystem.createSimpleSearchableSelect(select, [
      { value: '', label: emptyLabel },
      ...options.map((o) => ({ ...o, selected: o.value === select.value }))
    ], { placeholder });
  }

  setSearchableValue(name, value) {
    const select = this.el(name);
    if (!select) return;
    select.value = value || '';
    const label = select.selectedOptions[0]?.textContent || '';
    const wrap = select.parentNode?.querySelector('.searchable-select-container');
    const hidden = wrap?.querySelector('input[type="hidden"]');
    const input = wrap?.querySelector('.searchable-select-input');
    if (hidden) hidden.value = value || '';
    if (input) input.value = value ? label : '';
  }

  ensureOption(name, value, label) {
    const select = this.el(name);
    if (!select || !value) return;
    if ([...select.options].some((o) => o.value === value)) return;
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label || value;
    select.appendChild(opt);
  }

  lockSearchable(name) {
    const select = this.el(name);
    if (!select) return;
    select.disabled = true;
    const wrap = select.parentNode?.querySelector('.searchable-select-container');
    const input = wrap?.querySelector('.searchable-select-input');
    if (input) {
      input.disabled = true;
      input.readOnly = true;
    }
    wrap?.classList.add('prefilled-locked');
    select.closest('.form-field')?.classList.add('form-field--prefilled');
  }

  setHint(name, message, { html = false } = {}) {
    const hint = this.el(`${name}-hint`);
    if (!hint) return;
    if (!message) {
      hint.hidden = true;
      hint.textContent = '';
      return;
    }
    hint.hidden = false;
    if (html) hint.innerHTML = message;
    else hint.textContent = message;
  }

  value(name) {
    const select = this.el(name);
    if (!select) return '';
    const hidden = select.parentNode?.querySelector(
      `.searchable-select-container input[type="hidden"][name="${name}"], .searchable-select-container input[type="hidden"]`
    );
    return select.value || hidden?.value || '';
  }

  syncSubmit() {
    const btn = this.el('submit');
    if (!btn) return;
    btn.disabled = !(this.value('unternehmen') && this.value('marke') && this.value('briefing'));
  }

  initDisabledDependents() {
    this.resetSelect('marke', '– Erst Unternehmen wählen –');
    this.resetSelect('briefing', '– Erst Marke wählen –');
    this.resetSelect('produkt', '– Erst Briefing wählen –');
  }

  resetSelect(name, emptyLabel) {
    const select = this.el(name);
    if (select) {
      select.disabled = true;
      select.value = '';
    }
    this.refreshSearchableSelect(name, [], {
      placeholder: `${name} suchen…`,
      emptyLabel
    });
    this.setHint(name, '');
  }

  async loadUnternehmenOptions() {
    const rows = await loadUnternehmen();
    this.refreshSearchableSelect('unternehmen', rows.map((u) => ({
      value: u.id,
      label: u.firmenname
    })), { placeholder: 'Unternehmen suchen…', emptyLabel: '– Unternehmen wählen –' });
  }

  async applyPrefill() {
    const prefill = this.prefill;
    if (!prefill?.unternehmen_id) return;

    this.ensureOption('unternehmen', prefill.unternehmen_id, prefill.unternehmenName);
    this.setSearchableValue('unternehmen', prefill.unternehmen_id);
    await this.onUnternehmenChange();
    this.lockSearchable('unternehmen');

    if (!prefill.marke_id) return;
    this.ensureOption('marke', prefill.marke_id, prefill.markeName);
    this.setSearchableValue('marke', prefill.marke_id);
    await this.onMarkeChange();
    this.lockSearchable('marke');
  }

  async onUnternehmenChange() {
    this.resetSelect('marke', '– Erst Unternehmen wählen –');
    this.resetSelect('briefing', '– Erst Marke wählen –');
    this.resetSelect('produkt', '– Erst Briefing wählen –');
    await this.loadMarkenOptions();
    this.syncSubmit();
  }

  async onMarkeChange() {
    this.resetSelect('briefing', '– Erst Marke wählen –');
    this.resetSelect('produkt', '– Erst Briefing wählen –');
    await this.loadBriefingOptions();
    this.syncSubmit();
  }

  async onBriefingChange() {
    this.resetSelect('produkt', '– Erst Briefing wählen –');
    await this.loadProduktOptions();
    this.syncSubmit();
  }

  async loadMarkenOptions() {
    const unternehmenId = this.value('unternehmen');
    const select = this.el('marke');
    if (!select) return;
    if (!unternehmenId) {
      this.resetSelect('marke', '– Erst Unternehmen wählen –');
      return;
    }

    let rows = [];
    try {
      rows = await loadMarken(unternehmenId);
    } catch (err) {
      console.error('Marken konnten nicht geladen werden:', err);
      window.toastSystem?.show?.('Marken konnten nicht geladen werden', 'error');
    }

    select.disabled = rows.length === 0;
    this.refreshSearchableSelect('marke', rows.map((m) => ({
      value: m.id,
      label: m.markenname
    })), {
      placeholder: 'Marke suchen…',
      emptyLabel: rows.length ? '– Marke wählen –' : '– Keine Marke vorhanden –'
    });
    this.setHint('marke', rows.length ? '' : 'Keine Marke für dieses Unternehmen.');
  }

  async loadBriefingOptions() {
    const unternehmenId = this.value('unternehmen');
    const markeId = this.value('marke');
    const select = this.el('briefing');
    if (!select) return;
    if (!unternehmenId || !markeId) {
      this.resetSelect('briefing', '– Erst Marke wählen –');
      return;
    }

    let rows = [];
    try {
      rows = await loadBriefings(unternehmenId, markeId);
    } catch (err) {
      console.error('Briefings konnten nicht geladen werden:', err);
      window.toastSystem?.show?.('Briefings konnten nicht geladen werden', 'error');
    }

    select.disabled = rows.length === 0;
    this.refreshSearchableSelect('briefing', rows.map((b) => ({
      value: b.id,
      label: b.aktivierung_name || 'Briefing'
    })), {
      placeholder: 'Briefing suchen…',
      emptyLabel: rows.length ? '– Briefing wählen –' : '– Kein finalisiertes Briefing –'
    });

    if (!rows.length) {
      const params = new URLSearchParams({ unternehmen: unternehmenId, marke: markeId });
      this.setHint(
        'briefing',
        `Kein finalisiertes Briefing für diese Marke. <a href="/briefing/new?${params}">Briefing anlegen</a>`,
        { html: true }
      );
      this.el('briefing-hint')?.querySelector('a')?.addEventListener('click', (e) => {
        e.preventDefault();
        closePersonaCreateDrawer();
        window.navigateTo?.(`/briefing/new?${params}`);
      });
    } else {
      this.setHint('briefing', '');
    }
  }

  async loadProduktOptions() {
    const unternehmenId = this.value('unternehmen');
    const markeId = this.value('marke');
    const briefingId = this.value('briefing');
    const select = this.el('produkt');
    if (!select) return;
    if (!unternehmenId || !markeId || !briefingId) {
      this.resetSelect('produkt', '– Erst Briefing wählen –');
      return;
    }

    let rows = [];
    try {
      rows = await loadProdukte(unternehmenId, markeId);
    } catch (err) {
      console.error('Produkte konnten nicht geladen werden:', err);
      window.toastSystem?.show?.('Produkte konnten nicht geladen werden', 'error');
    }

    select.disabled = false;
    this.refreshSearchableSelect('produkt', rows.map((p) => ({
      value: p.id,
      label: p.name || 'Produkt'
    })), {
      placeholder: 'Produkt suchen…',
      emptyLabel: rows.length ? '– Kein Produkt –' : '– Kein Produkt dieser Marke –'
    });
    this.setHint('produkt', rows.length ? '' : 'Kein Produkt dieser Marke. Die Persona lässt sich trotzdem anlegen.');
  }

  submit() {
    const unternehmenId = this.value('unternehmen');
    const markeId = this.value('marke');
    const briefingId = this.value('briefing');
    const produktId = this.value('produkt') || null;
    if (!unternehmenId || !markeId || !briefingId) {
      window.toastSystem?.show?.('Unternehmen, Marke und Briefing sind Pflicht', 'error');
      this.syncSubmit();
      return;
    }

    const route = personaCreateRoute(this.origin, {
      unternehmenId,
      markeId,
      briefingId,
      produktId
    });
    closePersonaCreateDrawer();
    window.navigateTo?.(route);
  }
}
