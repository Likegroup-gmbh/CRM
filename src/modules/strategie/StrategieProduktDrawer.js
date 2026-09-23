// StrategieProduktDrawer.js
// Verknuepft eine Videoidee mit genau einem Produkt aus dem Briefing
// des Konzepts. Quelle ist die Briefing-Liste, nicht der ganze Katalog.

import { strategieService } from './StrategieService.js';

const DRAWER_ID = 'strategie-produkt-drawer';
const OVERLAY_ID = 'strategie-produkt-overlay';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class StrategieProduktDrawer {
  constructor(detail) {
    this.detail = detail;
    this.item = null;
    this.onSuccess = null;
    this.selectedProduktId = null;
    this.produkte = [];
  }

  async open(itemOrId, { onSuccess } = {}) {
    const item = typeof itemOrId === 'object' && itemOrId?.id
      ? itemOrId
      : this.detail?.items?.find(i => i.id === itemOrId);
    if (!item) {
      window.toastSystem?.show('Item nicht gefunden', 'error');
      return;
    }

    removeStrategieProduktDrawer();

    this.item = item;
    this.onSuccess = onSuccess || null;
    this.selectedProduktId = item.produkt_id || null;
    this.produkte = [];

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = OVERLAY_ID;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = DRAWER_ID;

    const kontext = (item.beschreibung || '').trim();

    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Produkt aus dem Briefing</span>
          <p class="drawer-subtitle">${kontext ? escapeHtml(kontext.slice(0, 80)) : (item.video_link ? 'Video' : 'Idee')}</p>
        </div>
        <div>
          <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
        </div>
      </div>
      <div class="drawer-body" id="${DRAWER_ID}-body">
        <div class="drawer-loading-state">Lade Produkte…</div>
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

    await this.loadProdukte();
    this.renderBody();
    this.bindEvents();
  }

  async loadProdukte() {
    try {
      this.produkte = await strategieService.getBriefingProdukte(this.item.strategie_id);
    } catch (error) {
      console.error('Fehler beim Laden der Produkte:', error);
      this.produkte = [];
    }
  }

  renderBody() {
    const body = document.getElementById(`${DRAWER_ID}-body`);
    if (!body) return;

    const item = this.item;
    const aktuellName = (item.produkt?.name || '').trim();

    if (!this.produkte.length) {
      body.innerHTML = `
        <div class="add-to-video-empty">
          <p>Am Briefing hängt kein Produkt.</p>
        </div>
        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
            <span class="mdc-btn__label">Schließen</span>
          </button>
        </div>
      `;
      return;
    }

    const options = this.produkte.map(p => ({
      value: p.id,
      label: p.name || 'Unbenannt',
      selected: p.id === this.selectedProduktId
    }));

    body.innerHTML = `
      ${aktuellName ? `
        <div class="link-strategie-context">
          <div class="link-strategie-context-row">
            <span class="link-strategie-context-label">Aktuell zugeordnet</span>
            <span>${escapeHtml(aktuellName)}</span>
          </div>
        </div>
      ` : ''}
      <div class="form-field">
        <label for="strategie-produkt-select">Produkt</label>
        <select id="strategie-produkt-select" class="form-input">
          <option value="">– Produkt wählen –</option>
        </select>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        ${item.produkt_id ? `
          <button type="button" id="btn-produkt-unlink" class="mdc-btn mdc-btn--danger">
            <span class="mdc-btn__label">Zuordnung lösen</span>
          </button>
        ` : ''}
        <button type="button" id="btn-produkt-connect" class="mdc-btn mdc-btn--create" disabled>
          <span class="mdc-btn__label">Zuordnen</span>
        </button>
      </div>
    `;

    this.initSelect(options);
  }

  initSelect(options) {
    const select = document.getElementById('strategie-produkt-select');
    if (!select || !window.formSystem) return;

    window.formSystem.createSimpleSearchableSelect(select, options, {
      placeholder: 'Produkt eingeben…'
    });

    if (this.selectedProduktId) {
      const btn = document.getElementById('btn-produkt-connect');
      if (btn) btn.disabled = false;
    }
  }

  bindEvents() {
    document.querySelectorAll(`#${DRAWER_ID} [data-action="close"]`).forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    const select = document.getElementById('strategie-produkt-select');
    select?.addEventListener('change', () => {
      const hidden = document.getElementById('strategie-produkt-select_value');
      this.selectedProduktId = hidden?.value || null;
      const btn = document.getElementById('btn-produkt-connect');
      if (btn) btn.disabled = !this.selectedProduktId;
    });

    document.getElementById('btn-produkt-connect')?.addEventListener('click', () => this.handleConnect());
    document.getElementById('btn-produkt-unlink')?.addEventListener('click', () => this.handleUnlink());
  }

  async handleConnect() {
    if (!this.selectedProduktId || !this.item) return;

    const btn = document.getElementById('btn-produkt-connect');
    try {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-loading');
      }

      const produkt = await strategieService.assignProdukt(this.item.id, this.selectedProduktId);
      this.item.produkt_id = produkt.id;
      this.item.produkt = produkt;

      window.toastSystem?.show('Produkt zugeordnet', 'success');
      if (this.onSuccess) await this.onSuccess();
      this.close();
      this.detail?.rerenderItemsTable?.();
    } catch (error) {
      console.error('Fehler beim Zuordnen:', error);
      window.toastSystem?.show(error.message || 'Fehler beim Zuordnen', 'error');
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    }
  }

  async handleUnlink() {
    if (!this.item?.produkt_id) return;

    const result = await window.confirmationModal?.open({
      title: 'Zuordnung lösen?',
      message: 'Die Zuordnung zum Produkt wird gelöst.',
      confirmText: 'Lösen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!result?.confirmed) return;

    try {
      await strategieService.unassignProdukt(this.item.id);
      this.item.produkt_id = null;
      this.item.produkt = null;
      this.item.skript_freigabe = false;
      this.item.skript_freigabe_am = null;
      this.item.skript_freigabe_von = null;

      window.toastSystem?.show('Zuordnung gelöst', 'success');
      if (this.onSuccess) await this.onSuccess();
      this.close();
      this.detail?.rerenderItemsTable?.();
    } catch (error) {
      console.error('Fehler beim Lösen:', error);
      window.toastSystem?.show(error.message || 'Fehler beim Lösen', 'error');
    }
  }

  close() {
    const panel = document.getElementById(DRAWER_ID);
    if (panel) {
      panel.classList.remove('show');
      document.getElementById(OVERLAY_ID)?.classList.remove('active');
      setTimeout(() => removeStrategieProduktDrawer(), 250);
    } else {
      removeStrategieProduktDrawer();
    }
  }
}

export function removeStrategieProduktDrawer() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(DRAWER_ID)?.remove();
}
