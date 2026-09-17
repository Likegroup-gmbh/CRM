// SkriptCreateDrawer.js
// Rechter Create-Drawer analog Konzept/Casting.
// Kaskade: Unternehmen → Marke → Kampagne → Produkt → Persona → Branche →
// Briefing → Video aus Konzept. Skript-DNA entfaellt (Master-Regelwerk).

import { skripteService } from './SkripteService.js';
import { escapeHtml } from './SkripteUtils.js';
import { PersonaService } from '../persona/PersonaService.js';
import { BEREICH_LABELS } from '../briefing/create/fieldConfig.js';
import { buildFreigegebeneVideoideePickerOptions } from '../strategie/strategieItemPicker.js';
import { buildReferenzVideoPayload } from './strategieVorlage.js';
import { icon } from '../../core/icons/IconSystem.js';

const DRAWER_ID = 'skript-create-drawer';
const PREFIX = 'skcreate';

function creatorName(item) {
  const eintrag = item?.casting_eintrag;
  if (eintrag?.name) return eintrag.name;
  const c = eintrag?.creator;
  if (c) return `${c.vorname || ''} ${c.nachname || ''}`.trim();
  return item?.creator_name || '–';
}

export function openSkriptCreateDrawer(prefill) {
  closeSkriptCreateDrawer();
  const drawer = new SkriptCreateDrawer();
  drawer.prefill = prefill && prefill.kampagne_id ? prefill : null;
  drawer.open();
}

export function closeSkriptCreateDrawer() {
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

class SkriptCreateDrawer {
  constructor() {
    this.unternehmen = [];
    this.marken = [];
    this.branchen = [];
    this.briefings = [];
    this.items = [];
    this.selectedItem = null;
    this.prefill = null;
  }

  el(name) {
    return document.getElementById(`${PREFIX}-${name}`) || null;
  }

  async open() {
    this.mount();
    requestAnimationFrame(() => {
      document.getElementById(DRAWER_ID)?.classList.add('show');
    });
    this.bindStatic();
    await Promise.all([
      this.loadUnternehmen(),
      this.loadBranchen()
    ]);
    this.initDisabledDependents();
    await this.applyPrefill();
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
          <span class="drawer-title">Neues Skript</span>
          <p class="drawer-subtitle">${this.prefill?.kampagne_id ? 'Für diese Kampagne' : 'Kontext wählen, dann eine freigegebene Videoidee'}</p>
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
          </div>
          <div class="form-field">
            <label for="${PREFIX}-kampagne">Kampagne *</label>
            <select id="${PREFIX}-kampagne" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
          </div>
          <div class="form-field">
            <label for="${PREFIX}-produkt">Produkt</label>
            <select id="${PREFIX}-produkt" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
          </div>
          <div class="form-field">
            <label for="${PREFIX}-persona">Persona</label>
            <select id="${PREFIX}-persona" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
          </div>
          <div class="form-field">
            <label for="${PREFIX}-branche">Branche</label>
            <select id="${PREFIX}-branche" class="form-input"><option value="">Laden...</option></select>
          </div>
          <div class="form-field">
            <label for="${PREFIX}-briefing">Briefing</label>
            <select id="${PREFIX}-briefing" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
          </div>
          <div class="form-field">
            <label for="${PREFIX}-videoidee">Video aus Konzept *</label>
            <select id="${PREFIX}-videoidee" class="form-input" disabled><option value="">– Erst Kampagne wählen –</option></select>
            <span class="skripte-hint" id="${PREFIX}-videoidee-hint">Wähle zuerst eine Kampagne.</span>
          </div>
          <div class="form-field" id="${PREFIX}-kontext" hidden>
            <label>Creator</label>
            <p class="form-readonly" id="${PREFIX}-creator-anzeige">–</p>
          </div>
          <div class="drawer-footer">
            <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
              <span class="mdc-btn__icon" aria-hidden="true">${icon('x-circle-filled')}</span>
              <span class="mdc-btn__label">Abbrechen</span>
            </button>
            <button type="submit" class="mdc-btn mdc-btn--create" id="${PREFIX}-submit">
              <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${icon('check-filled')}</span>
              <span class="mdc-btn__label">Skript erstellen</span>
            </button>
          </div>
        </form>
      </div>
    `;

    overlay.addEventListener('click', () => closeSkriptCreateDrawer());
    panel.querySelector('.drawer-close-btn').addEventListener('click', () => closeSkriptCreateDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }

  bindStatic() {
    this.el('unternehmen')?.addEventListener('change', () => this.onUnternehmenChange());
    this.el('marke')?.addEventListener('change', () => this.onMarkeChange());
    this.el('kampagne')?.addEventListener('change', () => this.onKampagneChange());
    this.el('videoidee')?.addEventListener('change', () => this.onVideoideeChange());
    const form = document.getElementById(`${PREFIX}-form`);
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    form?.querySelector('[data-action="close"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      closeSkriptCreateDrawer();
    });
  }

  refreshSearchableSelect(name, options, { placeholder, emptyLabel }) {
    const select = this.el(name);
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${emptyLabel}</option>`
      + options.map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('');
    if (current) select.value = current;
    if (!window.formSystem?.createSimpleSearchableSelect) return;
    window.formSystem.createSimpleSearchableSelect(select, [
      { value: '', label: emptyLabel },
      ...options.map((o) => ({ ...o, selected: o.value === current }))
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
    if (select.querySelector(`option[value="${CSS.escape(value)}"]`)) return;
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
    const field = select.closest('.form-field, .form-group');
    if (field) {
      field.classList.add('form-field--prefilled');
      const lbl = field.querySelector('label');
      if (lbl && !lbl.querySelector('.prefill-badge')) {
        const badge = document.createElement('span');
        badge.className = 'prefill-badge';
        badge.textContent = ' (aus Kampagne)';
        lbl.appendChild(badge);
      }
    }
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

    if (prefill.kampagne_id) {
      this.ensureOption('kampagne', prefill.kampagne_id, prefill.kampagneName);
      this.setSearchableValue('kampagne', prefill.kampagne_id);
      await this.onKampagneChange();
      this.lockSearchable('kampagne');
    }
  }

  initDisabledDependents() {
    const empty = '– Erst Unternehmen wählen –';
    this.refreshSearchableSelect('marke', [], { placeholder: 'Marke suchen…', emptyLabel: empty });
    this.refreshSearchableSelect('kampagne', [], { placeholder: 'Kampagne suchen…', emptyLabel: empty });
    this.refreshSearchableSelect('produkt', [], { placeholder: 'Produkt suchen…', emptyLabel: empty });
    this.refreshSearchableSelect('persona', [], { placeholder: 'Persona suchen…', emptyLabel: empty });
    this.refreshSearchableSelect('briefing', [], { placeholder: 'Briefing suchen…', emptyLabel: empty });
    this.refreshSearchableSelect('videoidee', [], {
      placeholder: 'Videoidee suchen…',
      emptyLabel: '– Erst Kampagne wählen –'
    });
  }

  async loadUnternehmen() {
    this.unternehmen = await skripteService.loadUnternehmen();
    this.refreshSearchableSelect('unternehmen', this.unternehmen.map((u) => ({
      value: u.id,
      label: u.firmenname
    })), { placeholder: 'Unternehmen suchen…', emptyLabel: '– Unternehmen wählen –' });
  }

  async loadBranchen() {
    this.branchen = await skripteService.loadBranchen();
    this.refreshSearchableSelect('branche', this.branchen.map((b) => ({
      value: b.id,
      label: b.name
    })), { placeholder: 'Branche suchen…', emptyLabel: '– Keine –' });
  }

  async onUnternehmenChange() {
    const unternehmenId = this.el('unternehmen')?.value;
    const markeSelect = this.el('marke');
    this.clearVideoidee();

    if (!unternehmenId) {
      if (markeSelect) markeSelect.disabled = true;
      this.refreshSearchableSelect('marke', [], {
        placeholder: 'Marke suchen…',
        emptyLabel: '– Erst Unternehmen wählen –'
      });
      this.setSearchableValue('kampagne', '');
      await Promise.all([
        this.loadKampagnen(),
        this.loadProdukteUndPersonas(),
        this.loadBriefings()
      ]);
      await this.loadVideoideen();
      return;
    }

    const unternehmen = this.unternehmen.find((u) => u.id === unternehmenId);
    if (unternehmen?.branche_id) this.setSearchableValue('branche', unternehmen.branche_id);

    this.marken = await skripteService.loadMarken(unternehmenId);
    if (markeSelect) markeSelect.disabled = false;
    this.refreshSearchableSelect('marke', this.marken.map((m) => ({
      value: m.id,
      label: m.markenname
    })), {
      placeholder: 'Marke suchen…',
      emptyLabel: this.marken.length ? '– Keine –' : '– Keine Marke vorhanden –'
    });

    this.setSearchableValue('kampagne', '');
    await Promise.all([
      this.loadKampagnen(),
      this.loadProdukteUndPersonas(),
      this.loadBriefings()
    ]);
    await this.loadVideoideen();
  }

  async onMarkeChange() {
    const markeId = this.el('marke')?.value;
    const marke = this.marken.find((m) => m.id === markeId);
    if (marke?.branche_id) this.setSearchableValue('branche', marke.branche_id);
    this.clearVideoidee();
    this.setSearchableValue('kampagne', '');
    await Promise.all([
      this.loadKampagnen(),
      this.loadProdukteUndPersonas(),
      this.loadBriefings()
    ]);
    await this.loadVideoideen();
  }

  async onKampagneChange() {
    this.clearVideoidee();
    await this.loadVideoideen();
  }

  async loadKampagnen() {
    const unternehmenId = this.el('unternehmen')?.value || null;
    const markeId = this.el('marke')?.value || null;
    const select = this.el('kampagne');
    if (!select) return;

    if (!unternehmenId) {
      select.disabled = true;
      this.refreshSearchableSelect('kampagne', [], {
        placeholder: 'Kampagne suchen…',
        emptyLabel: '– Erst Unternehmen wählen –'
      });
      return;
    }

    const kampagnen = await skripteService.loadKampagnen({ markeId, unternehmenId });
    select.disabled = false;
    this.refreshSearchableSelect('kampagne', kampagnen.map((k) => ({
      value: k.id,
      label: k.eigener_name || k.kampagnenname || k.id
    })), { placeholder: 'Kampagne suchen…', emptyLabel: '– Kampagne wählen –' });
  }

  async loadProdukteUndPersonas() {
    const unternehmenId = this.el('unternehmen')?.value || null;
    const markeId = this.el('marke')?.value || null;
    const produktSelect = this.el('produkt');
    const personaSelect = this.el('persona');
    if (!produktSelect || !personaSelect) return;

    if (!unternehmenId) {
      produktSelect.disabled = true;
      personaSelect.disabled = true;
      this.refreshSearchableSelect('produkt', [], {
        placeholder: 'Produkt suchen…',
        emptyLabel: '– Erst Unternehmen wählen –'
      });
      this.refreshSearchableSelect('persona', [], {
        placeholder: 'Persona suchen…',
        emptyLabel: '– Erst Unternehmen wählen –'
      });
      return;
    }

    const [produkte, personas] = await Promise.all([
      skripteService.loadProdukte({ markeId, unternehmenId }),
      markeId
        ? PersonaService.loadForContext({ markeId })
        : PersonaService.loadForContext({ unternehmenId })
    ]);

    produktSelect.disabled = false;
    this.refreshSearchableSelect('produkt', produkte.map((p) => ({
      value: p.id,
      label: p.name
    })), { placeholder: 'Produkt suchen…', emptyLabel: '– Keins –' });

    personaSelect.disabled = false;
    this.refreshSearchableSelect('persona', personas.map((p) => ({
      value: p.id,
      label: skripteService.personaLabel(p)
    })), { placeholder: 'Persona suchen…', emptyLabel: '– Keine –' });
  }

  async loadBriefings() {
    const unternehmenId = this.el('unternehmen')?.value || null;
    const markeId = this.el('marke')?.value || null;
    const select = this.el('briefing');
    if (!select) return;

    if (!unternehmenId) {
      this.briefings = [];
      select.disabled = true;
      this.refreshSearchableSelect('briefing', [], {
        placeholder: 'Briefing suchen…',
        emptyLabel: '– Erst Unternehmen wählen –'
      });
      return;
    }

    this.briefings = await skripteService.loadBriefings(unternehmenId, markeId || null);
    select.disabled = false;
    this.refreshSearchableSelect('briefing', this.briefings.map((b) => {
      const bereich = BEREICH_LABELS[b.bereich] || '';
      const name = b.aktivierung_name || 'Unbenanntes Briefing';
      return { value: b.id, label: bereich ? `${name} (${bereich})` : name };
    }), { placeholder: 'Briefing suchen…', emptyLabel: '– Keins –' });
  }

  async loadVideoideen() {
    const unternehmenId = this.el('unternehmen')?.value || null;
    const markeId = this.el('marke')?.value || null;
    const kampagneId = this.el('kampagne')?.value || null;
    const select = this.el('videoidee');
    const hint = this.el('videoidee-hint');
    if (!select) return;

    this.clearVideoidee();

    if (!kampagneId) {
      this.items = [];
      select.disabled = true;
      this.refreshSearchableSelect('videoidee', [], {
        placeholder: 'Videoidee suchen…',
        emptyLabel: '– Erst Kampagne wählen –'
      });
      if (hint) hint.textContent = 'Wähle zuerst eine Kampagne.';
      return;
    }

    this.items = await skripteService.loadFreigegebeneVideoideen({
      unternehmenId,
      markeId: markeId || null,
      kampagneId
    });
    const options = buildFreigegebeneVideoideePickerOptions(this.items);
    select.disabled = options.length === 0;
    this.refreshSearchableSelect('videoidee', options, {
      placeholder: 'Videoidee suchen…',
      emptyLabel: options.length ? '– Videoidee wählen –' : '– Keine freigegebenen Videoideen –'
    });

    if (hint) {
      if (!options.length) {
        hint.innerHTML = 'Keine für die Skripterstellung freigegebenen Videoideen. <a href="/konzepte">Im Konzept freigeben</a>.';
        hint.querySelector('a')?.addEventListener('click', (e) => {
          e.preventDefault();
          closeSkriptCreateDrawer();
          window.navigateTo?.('/konzepte');
        });
      } else {
        hint.textContent = 'Nur Ideen, die im Konzept ausdrücklich freigegeben wurden.';
      }
    }
  }

  onVideoideeChange() {
    const id = this.el('videoidee')?.value || '';
    const item = this.items.find((i) => i.id === id) || null;
    this.selectedItem = item;
    this.renderCreator(item);

    const briefingId = item?.strategie?.briefing_id;
    if (briefingId && this.el('briefing') && !this.el('briefing').value) {
      this.setSearchableValue('briefing', briefingId);
    }
  }

  clearVideoidee() {
    this.selectedItem = null;
    this.setSearchableValue('videoidee', '');
    this.renderCreator(null);
  }

  renderCreator(item) {
    const box = this.el('kontext');
    const el = this.el('creator-anzeige');
    if (!box) return;
    if (!item) {
      box.hidden = true;
      if (el) el.textContent = '–';
      return;
    }
    if (el) el.textContent = creatorName(item);
    box.hidden = false;
  }

  async submit() {
    const unternehmenId = this.el('unternehmen')?.value;
    const kampagneId = this.el('kampagne')?.value;
    const itemId = this.el('videoidee')?.value;
    if (!unternehmenId) {
      window.toastSystem?.show('Bitte ein Unternehmen wählen', 'error');
      return;
    }
    if (!kampagneId) {
      window.toastSystem?.show('Bitte eine Kampagne wählen', 'error');
      return;
    }
    if (!itemId) {
      window.toastSystem?.show('Bitte eine freigegebene Videoidee wählen', 'error');
      return;
    }

    const basis = this.items.find((i) => i.id === itemId);
    if (!basis) {
      window.toastSystem?.show('Die gewählte Videoidee ist nicht mehr verfügbar', 'error');
      return;
    }
    if (!basis.creator_auswahl_item_id) {
      window.toastSystem?.show('Die gewählte Vorlage hat keinen Creator aus dem Casting.', 'error');
      return;
    }

    const btn = this.el('submit');
    if (btn) btn.disabled = true;

    try {
      const voll = await skripteService.loadStrategieItem(itemId);
      const item = { ...basis, ...(voll || {}) };
      const strategie = item.strategie || {};
      const videoIdee = (item.beschreibung || '').trim();
      if (!videoIdee) throw new Error('Die Videoidee hat keine Beschreibung');

      const briefingId = this.el('briefing')?.value || strategie.briefing_id || null;
      const briefing = this.briefings.find((b) => b.id === briefingId) || strategie.briefing || null;

      const payload = {
        unternehmen_id: unternehmenId,
        marke_id: this.el('marke')?.value || strategie.marke_id || null,
        kampagne_id: kampagneId,
        produkt_id: this.el('produkt')?.value || null,
        persona_id: this.el('persona')?.value || null,
        branche_id: this.el('branche')?.value || null,
        briefing_id: briefingId,
        briefing,
        bereich: briefing?.bereich || strategie.briefing?.bereich || null,
        strategie_item_id: item.id,
        video_idee: videoIdee,
        mit_dna: false,
        referenz_video: buildReferenzVideoPayload({
          strategieItemId: item.id,
          url: item.video_link,
          transkript: item.transkript,
          beschreibung: item.beschreibung,
          caption: item.caption,
          platform: item.plattform
        })
      };

      const stub = await skripteService.createSkriptStub(payload);
      closeSkriptCreateDrawer();
      window.toastSystem?.show('Skript angelegt – Liky stellt Rückfragen', 'success');
      window.navigateTo(`/skripte/${stub.id}`);
    } catch (err) {
      window.toastSystem?.show(err.message || 'Skript konnte nicht angelegt werden', 'error');
      if (btn) btn.disabled = false;
    }
  }
}
