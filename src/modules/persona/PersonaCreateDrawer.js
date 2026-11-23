// PersonaCreateDrawer.js
// Rechter Create-Drawer. Kaskade: Unternehmen → Marke (optional) → Briefing,
// Produkt optional. Submit legt nichts an, sondern öffnet das Worksheet mit dieser
// Zuordnung.

import { icon } from '../../core/icons/IconSystem.js';
import { personaCreateRoute } from './personaCreateScope.js';
import { installPersonaCreateSelects } from './personaCreateSelects.js';
import { loadUnternehmen, loadMarken, loadBriefings, loadProdukte, loadMarkeRow } from './personaCreateDaten.js';
import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';

const DRAWER_ID = 'persona-create-drawer';
const PREFIX = 'pccreate';

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
    }, DRAWER_EXIT_MS);
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
          <p class="drawer-subtitle">Unternehmen und Briefing, optional Marke</p>
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
            <label for="${PREFIX}-marke">Marke</label>
            <select id="${PREFIX}-marke" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
            <p class="form-hint" id="${PREFIX}-marke-hint" hidden></p>
          </div>
          <div class="form-field">
            <label for="${PREFIX}-briefing">Briefing *</label>
            <select id="${PREFIX}-briefing" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
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

  syncSubmit() {
    const btn = this.el('submit');
    if (!btn) return;
    btn.disabled = !(this.value('unternehmen') && this.value('briefing'));
  }

  initDisabledDependents() {
    this.resetSelect('marke', '– Erst Unternehmen wählen –');
    this.resetSelect('briefing', '– Erst Unternehmen wählen –');
    this.resetSelect('produkt', '– Erst Briefing wählen –');
  }

  resetSelect(name, emptyLabel) {
    this.setSearchableValue(name, '');
    const select = this.el(name);
    if (select) select.disabled = true;
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

    if (prefill.marke_id) {
      this.ensureOption('marke', prefill.marke_id, prefill.markeName);
      this.setSearchableValue('marke', prefill.marke_id);
      await this.onMarkeChange();
      this.lockSearchable('marke');
    }

    if (!prefill.briefing_id) return;
    this.ensureOption('briefing', prefill.briefing_id, prefill.briefingName);
    this.setSearchableValue('briefing', prefill.briefing_id);
    await this.onBriefingChange();
    this.lockSearchable('briefing');

    if (!prefill.produkt_id) return;
    this.ensureOption('produkt', prefill.produkt_id, prefill.produktName);
    this.setSearchableValue('produkt', prefill.produkt_id);
  }

  async onUnternehmenChange() {
    this.resetSelect('marke', '– Erst Unternehmen wählen –');
    this.resetSelect('briefing', '– Erst Unternehmen wählen –');
    this.resetSelect('produkt', '– Erst Briefing wählen –');
    await this.loadMarkenOptions();
    await this.loadBriefingOptions();
    this.syncSubmit();
  }

  async onMarkeChange() {
    this.resetSelect('briefing', '– Erst Unternehmen wählen –');
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
      emptyLabel: rows.length ? '– Keine Marke –' : '– Keine Marke vorhanden –'
    });
    this.setHint('marke', rows.length ? '' : 'Keine Marke für dieses Unternehmen. Das ist in Ordnung, die Persona wird ohne Marke angelegt.');
  }

  async loadBriefingOptions() {
    const unternehmenId = this.value('unternehmen');
    const markeId = this.value('marke') || null;
    const select = this.el('briefing');
    if (!select) return;
    if (!unternehmenId) {
      this.resetSelect('briefing', '– Erst Unternehmen wählen –');
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
      const params = new URLSearchParams({ unternehmen: unternehmenId });
      if (markeId) params.set('marke', markeId);
      this.setHint(
        'briefing',
        `Kein finalisiertes Briefing ${markeId ? 'für diese Marke' : 'ohne Marke'}. <a href="/briefing/new?${params}">Briefing anlegen</a>`,
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
    const markeId = this.value('marke') || null;
    const briefingId = this.value('briefing');
    const select = this.el('produkt');
    if (!select) return;
    if (!unternehmenId || !briefingId) {
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
      emptyLabel: rows.length ? '– Kein Produkt –' : '– Kein Produkt vorhanden –'
    });
    this.setHint('produkt', rows.length ? '' : 'Kein Produkt gefunden. Die Persona lässt sich trotzdem anlegen.');
  }

  submit() {
    const unternehmenId = this.value('unternehmen');
    const markeId = this.value('marke') || null;
    const briefingId = this.value('briefing');
    const produktId = this.value('produkt') || null;
    if (!unternehmenId || !briefingId) {
      window.toastSystem?.show?.('Unternehmen und Briefing sind Pflicht', 'error');
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

installPersonaCreateSelects(PersonaCreateDrawer.prototype);
