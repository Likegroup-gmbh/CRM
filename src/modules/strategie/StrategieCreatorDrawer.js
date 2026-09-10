// StrategieCreatorDrawer.js
// Verknuepft eine Videoidee mit genau einem Casting-Eintrag aus dem mit dem
// Konzept verknuepften Casting. Der freie CRM-Picker ist ersetzt: Quelle ist
// die Liste, nicht der Stammdatensatz. Altbestand (creator_id/creator_name)
// bleibt als Anzeige stehen, wird aber nicht mehr geschrieben.

import { strategieService } from './StrategieService.js';
import { icon } from '../../core/icons/IconSystem.js';

const DRAWER_ID = 'strategie-creator-drawer';
const OVERLAY_ID = 'strategie-creator-overlay';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function eintragDisplayName(eintrag) {
  return (eintrag?.name || '').trim();
}

export class StrategieCreatorDrawer {
  constructor(detail) {
    this.detail = detail;
    this.item = null;
    this.onSuccess = null;
    this.selectedItemId = null;
    this.castingItems = [];
    this.castingId = null;
  }

  async open(itemId, { onSuccess } = {}) {
    const item = this.detail.items.find(i => i.id === itemId);
    if (!item) {
      window.toastSystem?.show('Item nicht gefunden', 'error');
      return;
    }

    removeStrategieCreatorDrawer();

    this.item = item;
    this.onSuccess = onSuccess || null;
    this.selectedItemId = item.creator_auswahl_item_id || null;
    this.castingItems = [];
    this.castingId = null;

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
          <span class="drawer-title">Creator aus dem Casting</span>
          <p class="drawer-subtitle">${kontext ? escapeHtml(kontext.slice(0, 80)) : (item.video_link ? 'Video' : 'Idee')}</p>
        </div>
        <div>
          <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
        </div>
      </div>
      <div class="drawer-body" id="${DRAWER_ID}-body">
        <div class="drawer-loading-state">Lade Casting…</div>
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

    await this.loadCasting();
    this.renderBody();
    this.bindEvents();
  }

  async loadCasting() {
    try {
      const { castingId, items } = await strategieService.getZuordbareCastingItems(this.item.strategie_id);
      this.castingId = castingId;
      this.castingItems = items;
    } catch (error) {
      console.error('Fehler beim Laden des Castings:', error);
      this.castingId = null;
      this.castingItems = [];
    }
  }

  renderBody() {
    const body = document.getElementById(`${DRAWER_ID}-body`);
    if (!body) return;

    const item = this.item;
    const aktuell = item.casting_eintrag;
    const aktuellName = eintragDisplayName(aktuell)
      || (aktuell?.creator ? `${aktuell.creator.vorname || ''} ${aktuell.creator.nachname || ''}`.trim() : '');

    if (!this.castingId) {
      body.innerHTML = `
        <div class="add-to-video-empty">
          <p>Dieses Konzept ist mit keinem Casting verknüpft.</p>
          <p class="hint">Verknüpfen Sie das Konzept zuerst mit einem Casting, dann können Sie hier einen Eintrag zuordnen.</p>
        </div>
        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
            <span class="mdc-btn__label">Schließen</span>
          </button>
        </div>
      `;
      return;
    }

    const options = this.castingItems.map(e => ({
      value: e.id,
      label: eintragDisplayName(e) || 'Unbekannt',
      subtitle: [e.link_instagram, e.link_tiktok].filter(Boolean).join(', ') || undefined,
      selected: e.id === this.selectedItemId
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
        <label for="strategie-casting-item-select">Eintrag aus dem Casting</label>
        <select id="strategie-casting-item-select" class="form-input">
          <option value="">– Eintrag wählen –</option>
        </select>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        ${item.creator_auswahl_item_id ? `
          <button type="button" id="btn-casting-item-unlink" class="mdc-btn mdc-btn--danger">
            <span class="mdc-btn__label">Zuordnung lösen</span>
          </button>
        ` : ''}
        <button type="button" id="btn-casting-item-connect" class="mdc-btn mdc-btn--create" disabled>
          <span class="mdc-btn__label">Zuordnen</span>
        </button>
      </div>
    `;

    this.initSelect(options);
  }

  initSelect(options) {
    const select = document.getElementById('strategie-casting-item-select');
    if (!select || !window.formSystem) return;

    window.formSystem.createSimpleSearchableSelect(select, options, {
      placeholder: 'Name oder Handle eingeben…'
    });

    if (this.selectedItemId) {
      const btn = document.getElementById('btn-casting-item-connect');
      if (btn) btn.disabled = false;
    }
  }

  bindEvents() {
    document.querySelectorAll(`#${DRAWER_ID} [data-action="close"]`).forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    const select = document.getElementById('strategie-casting-item-select');
    select?.addEventListener('change', () => {
      const hidden = document.getElementById('strategie-casting-item-select_value');
      this.selectedItemId = hidden?.value || null;
      const btn = document.getElementById('btn-casting-item-connect');
      if (btn) btn.disabled = !this.selectedItemId;
    });

    document.getElementById('btn-casting-item-connect')?.addEventListener('click', () => this.handleConnect());
    document.getElementById('btn-casting-item-unlink')?.addEventListener('click', () => this.handleUnlink());
  }

  async handleConnect() {
    if (!this.selectedItemId || !this.item) return;

    const btn = document.getElementById('btn-casting-item-connect');
    try {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-loading');
      }

      await strategieService.assignCastingItem(this.item.id, this.selectedItemId);

      this.item.creator_auswahl_item_id = this.selectedItemId;
      this.item.casting_eintrag = this.castingItems.find(e => e.id === this.selectedItemId) || null;

      window.toastSystem?.show('Casting-Eintrag zugeordnet', 'success');
      if (this.onSuccess) await this.onSuccess();
      this.close();
      this.detail.rerenderItemsTable();
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
    if (!this.item?.creator_auswahl_item_id) return;

    const result = await window.confirmationModal?.open({
      title: 'Zuordnung lösen?',
      message: 'Die Zuordnung zum Casting-Eintrag wird gelöst.',
      confirmText: 'Lösen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!result?.confirmed) return;

    try {
      await strategieService.unassignCastingItem(this.item.id);
      this.item.creator_auswahl_item_id = null;
      this.item.casting_eintrag = null;

      window.toastSystem?.show('Zuordnung gelöst', 'success');
      if (this.onSuccess) await this.onSuccess();
      this.close();
      this.detail.rerenderItemsTable();
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
      setTimeout(() => removeStrategieCreatorDrawer(), 250);
    } else {
      removeStrategieCreatorDrawer();
    }
  }
}

export function removeStrategieCreatorDrawer() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(DRAWER_ID)?.remove();
}
