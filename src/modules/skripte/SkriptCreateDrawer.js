// SkriptCreateDrawer.js
// Rechter Create-Drawer analog Konzept/Casting.
// Kaskade: Unternehmen → Konzept → Videoidee. Rest aus der Kette.

import { skripteService } from './SkripteService.js';
import { escapeHtml } from './SkripteUtils.js';
import { buildFreigegebeneVideoideePickerOptions } from '../strategie/strategieItemPicker.js';
import { buildReferenzVideoPayload } from './strategieVorlage.js';
import { resolveSkriptCreatePayload } from './skriptCreateKontext.js';
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
  drawer.prefill = prefill && prefill.unternehmen_id ? prefill : null;
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
    this.konzepte = [];
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
    await this.loadUnternehmen();
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
          <p class="drawer-subtitle">${this.prefill?.kampagne_id ? 'Für diese Kampagne' : 'Unternehmen, Konzept, dann eine freigegebene Videoidee'}</p>
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
            <label for="${PREFIX}-konzept">Konzept *</label>
            <select id="${PREFIX}-konzept" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
          </div>
          <div class="form-field">
            <label for="${PREFIX}-videoidee">Videoidee *</label>
            <select id="${PREFIX}-videoidee" class="form-input" disabled><option value="">– Erst Konzept wählen –</option></select>
            <span class="skripte-hint" id="${PREFIX}-videoidee-hint">Wähle zuerst ein Konzept.</span>
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
    this.el('konzept')?.addEventListener('change', () => this.onKonzeptChange());
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

    if (this.konzepte.length === 1) {
      this.setSearchableValue('konzept', this.konzepte[0].id);
      await this.onKonzeptChange();
      this.lockSearchable('konzept');
    }
  }

  initDisabledDependents() {
    this.refreshSearchableSelect('konzept', [], {
      placeholder: 'Konzept suchen…',
      emptyLabel: '– Erst Unternehmen wählen –'
    });
    this.refreshSearchableSelect('videoidee', [], {
      placeholder: 'Videoidee suchen…',
      emptyLabel: '– Erst Konzept wählen –'
    });
  }

  async loadUnternehmen() {
    this.unternehmen = await skripteService.loadUnternehmen();
    this.refreshSearchableSelect('unternehmen', this.unternehmen.map((u) => ({
      value: u.id,
      label: u.firmenname
    })), { placeholder: 'Unternehmen suchen…', emptyLabel: '– Unternehmen wählen –' });
  }

  async onUnternehmenChange() {
    this.clearVideoidee();
    this.setSearchableValue('konzept', '');
    await this.loadKonzepte();
    await this.loadVideoideen();
  }

  async onKonzeptChange() {
    this.clearVideoidee();
    await this.loadVideoideen();
  }

  async loadKonzepte() {
    const unternehmenId = this.el('unternehmen')?.value || null;
    const select = this.el('konzept');
    if (!select) return;

    if (!unternehmenId) {
      this.konzepte = [];
      select.disabled = true;
      this.refreshSearchableSelect('konzept', [], {
        placeholder: 'Konzept suchen…',
        emptyLabel: '– Erst Unternehmen wählen –'
      });
      return;
    }

    this.konzepte = await skripteService.loadKonzepte({
      unternehmenId,
      kampagneId: this.prefill?.kampagne_id || null
    });
    select.disabled = false;
    this.refreshSearchableSelect('konzept', this.konzepte.map((k) => ({
      value: k.id,
      label: k.name || 'Unbenanntes Konzept'
    })), {
      placeholder: 'Konzept suchen…',
      emptyLabel: this.konzepte.length ? '– Konzept wählen –' : '– Kein Konzept vorhanden –'
    });
  }

  async loadVideoideen() {
    const unternehmenId = this.el('unternehmen')?.value || null;
    const strategieId = this.el('konzept')?.value || null;
    const select = this.el('videoidee');
    const hint = this.el('videoidee-hint');
    if (!select) return;

    this.clearVideoidee();

    if (!strategieId) {
      this.items = [];
      select.disabled = true;
      this.refreshSearchableSelect('videoidee', [], {
        placeholder: 'Videoidee suchen…',
        emptyLabel: '– Erst Konzept wählen –'
      });
      if (hint) hint.textContent = 'Wähle zuerst ein Konzept.';
      return;
    }

    this.items = await skripteService.loadFreigegebeneVideoideen({
      unternehmenId,
      strategieId
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
          window.navigateTo?.(`/konzepte/${strategieId}`);
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
    const strategieId = this.el('konzept')?.value;
    const itemId = this.el('videoidee')?.value;
    if (!unternehmenId) {
      window.toastSystem?.show('Bitte ein Unternehmen wählen', 'error');
      return;
    }
    if (!strategieId) {
      window.toastSystem?.show('Bitte ein Konzept wählen', 'error');
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
      const videoIdee = (item.beschreibung || '').trim();
      if (!videoIdee) throw new Error('Die Videoidee hat keine Beschreibung');

      const personaId = item.casting_eintrag?.persona_id || null;
      const produktIds = await skripteService.loadAcceptedProduktIds(personaId);
      const payload = {
        ...resolveSkriptCreatePayload(item, { produktIds }),
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
