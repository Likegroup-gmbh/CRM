// StrategieVideoideePickerDrawer.js
// Casting-Seite: bestehende Videoidee dem Casting-Eintrag zuordnen.
// Spiegel von StrategieCreatorDrawer, Quelle ist das gepaarte Konzept.

import { strategieService } from './StrategieService.js';

const DRAWER_ID = 'strategie-videoidee-picker-drawer';
const OVERLAY_ID = 'strategie-videoidee-picker-overlay';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function itemLabel(item) {
  const text = (item?.beschreibung || '').trim();
  if (text) return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  return item?.video_link ? 'Video' : 'Idee';
}

export class StrategieVideoideePickerDrawer {
  constructor() {
    this.eintrag = null;
    this.strategieId = null;
    this.onSuccess = null;
    this.selectedItemId = null;
    this.items = [];
  }

  async open({ eintrag, strategieId, onSuccess } = {}) {
    if (!eintrag?.id || !strategieId) {
      window.toastSystem?.show('Casting oder Konzept fehlt', 'error');
      return;
    }

    removeVideoideePickerDrawer();

    this.eintrag = eintrag;
    this.strategieId = strategieId;
    this.onSuccess = onSuccess || null;
    this.selectedItemId = null;
    this.items = [];

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = OVERLAY_ID;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = DRAWER_ID;

    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Mit Videoidee verbinden</span>
          <p class="drawer-subtitle">${escapeHtml(eintrag.name || 'Casting-Eintrag')}</p>
        </div>
        <div>
          <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
        </div>
      </div>
      <div class="drawer-body" id="${DRAWER_ID}-body">
        <div class="drawer-loading-state">Lade Videoideen…</div>
      </div>
    `;

    overlay.addEventListener('click', () => this.close());
    panel.querySelector('.drawer-close-btn').addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    await this.loadItems();
    this.renderBody();
    this.bindEvents();
  }

  async loadItems() {
    try {
      const { items } = await strategieService.getZuordbareVideoideen(
        this.strategieId,
        this.eintrag.id
      );
      this.items = items;
    } catch (error) {
      console.error('Fehler beim Laden der Videoideen:', error);
      this.items = [];
    }
  }

  renderBody() {
    const body = document.getElementById(`${DRAWER_ID}-body`);
    if (!body) return;

    if (!this.items.length) {
      body.innerHTML = `
        <div class="add-to-video-empty">
          <p>Keine Videoideen in diesem Konzept.</p>
        </div>
        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
            <span class="mdc-btn__label">Schließen</span>
          </button>
        </div>
      `;
      return;
    }

    const options = this.items.map(item => ({
      value: item.id,
      label: itemLabel(item),
      subtitle: item.disabled
        ? item.disabledReason
        : (item.eigen ? 'Bereits zugeordnet' : undefined),
      selected: item.eigen,
      disabled: item.disabled,
      disabledReason: item.disabledReason
    }));

    const eigen = this.items.find(i => i.eigen);
    if (eigen) this.selectedItemId = eigen.id;

    body.innerHTML = `
      <div class="form-field">
        <label for="casting-videoidee-select">Videoidee aus dem Konzept</label>
        <select id="casting-videoidee-select" class="form-input">
          <option value="">– Videoidee wählen –</option>
        </select>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button type="button" id="btn-videoidee-connect" class="mdc-btn mdc-btn--create" disabled>
          <span class="mdc-btn__label">Zuordnen</span>
        </button>
      </div>
    `;

    this.initSelect(options);
  }

  initSelect(options) {
    const select = document.getElementById('casting-videoidee-select');
    if (!select || !window.formSystem) return;

    window.formSystem.createSimpleSearchableSelect(select, options, {
      placeholder: 'Beschreibung oder Titel eingeben…'
    });

    if (this.selectedItemId) {
      const chosen = this.items.find(i => i.id === this.selectedItemId);
      const btn = document.getElementById('btn-videoidee-connect');
      if (btn) btn.disabled = !chosen || chosen.disabled;
    }
  }

  bindEvents() {
    document.querySelectorAll(`#${DRAWER_ID} [data-action="close"]`).forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    const select = document.getElementById('casting-videoidee-select');
    select?.addEventListener('change', () => {
      const hidden = document.getElementById('casting-videoidee-select_value');
      this.selectedItemId = hidden?.value || null;
      const chosen = this.items.find(i => i.id === this.selectedItemId);
      const btn = document.getElementById('btn-videoidee-connect');
      if (btn) btn.disabled = !chosen || chosen.disabled;
    });

    document.getElementById('btn-videoidee-connect')?.addEventListener('click', () => this.handleConnect());
  }

  async handleConnect() {
    if (!this.selectedItemId || !this.eintrag) return;
    const chosen = this.items.find(i => i.id === this.selectedItemId);
    if (!chosen || chosen.disabled) {
      window.toastSystem?.show(chosen?.disabledReason || 'Diese Videoidee ist nicht zuordenbar', 'warning');
      return;
    }

    const btn = document.getElementById('btn-videoidee-connect');
    try {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-loading');
      }

      if (!chosen.eigen) {
        await strategieService.assignCastingItem(this.selectedItemId, this.eintrag.id);
      }

      window.toastSystem?.show(
        chosen.eigen ? 'Bereits zugeordnet' : 'Videoidee zugeordnet',
        'success'
      );
      if (this.onSuccess) await this.onSuccess(chosen);
      this.close();
    } catch (error) {
      console.error('Fehler beim Zuordnen der Videoidee:', error);
      window.toastSystem?.show(error.message || 'Fehler beim Zuordnen', 'error');
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    }
  }

  close() {
    const panel = document.getElementById(DRAWER_ID);
    if (panel) {
      panel.classList.remove('show');
      document.getElementById(OVERLAY_ID)?.classList.remove('active');
      setTimeout(() => removeVideoideePickerDrawer(), 250);
    } else {
      removeVideoideePickerDrawer();
    }
  }
}

export function removeVideoideePickerDrawer() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(DRAWER_ID)?.remove();
}
