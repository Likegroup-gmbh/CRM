// LinkStrategieItemDrawer.js
// Drawer zum Verknüpfen eines Kampagnen-Videos mit einer Strategie-Idee (Reverse-Flow)

import { buildVideoDisplayName } from './VideoPickerOptions.js';

function truncateText(text, max = 80) {
  const s = String(text || '').trim();
  if (s.length <= max) return s || 'Ohne Beschreibung';
  return `${s.slice(0, max - 1)}…`;
}

export function buildStrategieItemPickerOptions(strategien, items, linkedByItemId, currentVideoId) {
  const strategieMap = new Map((strategien || []).map(s => [s.id, s]));
  const options = [];

  (items || [])
    .filter(item => {
      const linkedVideoId = linkedByItemId.get(item.id);
      return !linkedVideoId || linkedVideoId === currentVideoId;
    })
    .forEach(item => {
      const strategie = strategieMap.get(item.strategie_id);
      options.push({
        value: item.id,
        label: truncateText(item.beschreibung),
        group: strategie?.name || 'Strategie',
        subtitle: item.video_link ? 'Mit Referenz-Video' : 'Idee ohne Link'
      });
    });

  return options.sort((a, b) => {
    const g = a.group.localeCompare(b.group, 'de');
    if (g !== 0) return g;
    return a.label.localeCompare(b.label, 'de');
  });
}

export class LinkStrategieItemDrawer {
  constructor() {
    this.drawerId = 'link-strategie-item-drawer';
    this.video = null;
    this.kooperation = null;
    this.kampagneId = null;
    this.onSuccess = null;
    this.strategien = [];
    this.items = [];
    this.linkedByItemId = new Map();
    this.selectedItemId = null;
  }

  async open({ video, kooperation, kampagneId, onSuccess }) {
    this.video = video;
    this.kooperation = kooperation;
    this.kampagneId = kampagneId;
    this.onSuccess = onSuccess;
    this.selectedItemId = video?.strategie_item_id || null;

    try {
      await this.createDrawer();
      await this.loadData();
      this.renderBody();
      this.bindEvents();
    } catch (error) {
      console.error('Fehler beim Öffnen des LinkStrategieItem-Drawers:', error);
      window.toastSystem?.show('Fehler beim Öffnen', 'error');
    }
  }

  async createDrawer() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Strategie-Idee verknüpfen</span>
          <p class="drawer-subtitle">Wählen Sie eine Idee aus den Strategien dieser Kampagne</p>
        </div>
        <div>
          <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
        </div>
      </div>
      <div class="drawer-body" id="${this.drawerId}-body">
        <div class="drawer-loading-state">Lade Daten...</div>
      </div>
    `;

    overlay.addEventListener('click', () => this.close());
    panel.querySelector('.drawer-close-btn').addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => panel.classList.add('show'));
  }

  async loadData() {
    this.strategien = [];
    this.items = [];
    this.linkedByItemId = new Map();

    if (!this.kampagneId) return;

    const { data: strategien, error: stratError } = await window.supabase
      .from('strategie')
      .select('id, name')
      .eq('kampagne_id', this.kampagneId)
      .order('name');

    if (stratError) throw stratError;
    this.strategien = strategien || [];
    if (this.strategien.length === 0) return;

    const strategieIds = this.strategien.map(s => s.id);

    const { data: items, error: itemsError } = await window.supabase
      .from('strategie_items')
      .select('id, beschreibung, strategie_id, video_link, screenshot_url')
      .in('strategie_id', strategieIds)
      .order('sortierung', { ascending: true });

    if (itemsError) throw itemsError;
    this.items = items || [];

    const { data: kooperationen } = await window.supabase
      .from('kooperationen')
      .select('id')
      .eq('kampagne_id', this.kampagneId);

    const koopIds = (kooperationen || []).map(k => k.id);
    if (koopIds.length === 0) return;

    const { data: linkedVideos, error: linkError } = await window.supabase
      .from('kooperation_videos')
      .select('id, strategie_item_id')
      .in('kooperation_id', koopIds)
      .not('strategie_item_id', 'is', null);

    if (linkError) throw linkError;
    (linkedVideos || []).forEach(v => {
      if (v.strategie_item_id) {
        this.linkedByItemId.set(v.strategie_item_id, v.id);
      }
    });
  }

  renderBody() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const creator = this.kooperation?.creator;
    const creatorName = creator
      ? `${creator.vorname || ''} ${creator.nachname || ''}`.trim()
      : 'Unbekannt';
    const videoLabel = buildVideoDisplayName(this.video, this.kooperation);
    const hasStrategien = this.strategien.length > 0;
    const availableOptions = buildStrategieItemPickerOptions(
      this.strategien,
      this.items,
      this.linkedByItemId,
      this.video?.id
    );
    const hasItems = availableOptions.length > 0;
    const isLinked = !!this.video?.strategie_item_id;

    body.innerHTML = `
      <div class="link-strategie-context">
        <div class="link-strategie-context-row">
          <span class="link-strategie-context-label">Creator</span>
          <span>${this.escapeHtml(creatorName)}</span>
        </div>
        <div class="link-strategie-context-row">
          <span class="link-strategie-context-label">Kooperation</span>
          <span>${this.escapeHtml(this.kooperation?.name || '—')}</span>
        </div>
        <div class="link-strategie-context-row">
          <span class="link-strategie-context-label">Video</span>
          <span>${this.escapeHtml(videoLabel)}</span>
        </div>
      </div>

      ${!hasStrategien ? `
        <div class="add-to-video-empty">
          <p>Keine Strategien für diese Kampagne vorhanden.</p>
        </div>
      ` : !hasItems ? `
        <div class="add-to-video-empty">
          <p>Keine freien Strategie-Ideen verfügbar.</p>
          <p class="hint">Alle Ideen sind bereits mit anderen Videos verknüpft.</p>
        </div>
      ` : `
        <div class="form-field">
          <label>Strategie-Idee auswählen</label>
          <select id="select-strategie-item" class="form-input" data-searchable="true">
            <option value="">– Idee wählen –</option>
          </select>
        </div>
        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          ${isLinked ? `
            <button type="button" id="btn-unlink-strategie" class="mdc-btn mdc-btn--danger">
              <span class="mdc-btn__label">Verknüpfung entfernen</span>
            </button>
          ` : ''}
          <button type="button" id="btn-link-strategie" class="mdc-btn mdc-btn--create" disabled>
            <span class="mdc-btn__label">Verknüpfen</span>
          </button>
        </div>
      `}
    `;

    if (hasItems) {
      this.initItemSearchableSelect(availableOptions);
    }
  }

  initItemSearchableSelect(options) {
    const select = document.getElementById('select-strategie-item');
    if (!select || !window.formSystem) return;

    window.formSystem.createSimpleSearchableSelect(select, options, {
      placeholder: 'Strategie oder Idee suchen…'
    });

    if (this.selectedItemId) {
      select.value = this.selectedItemId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const hidden = select.parentNode?.querySelector('input[type="hidden"]');
      if (hidden) hidden.value = this.selectedItemId;
      const option = options.find(o => o.value === this.selectedItemId);
      const input = select.parentNode?.querySelector('.searchable-select-input');
      if (option && input) input.value = option.label;
      const btn = document.getElementById('btn-link-strategie');
      if (btn) btn.disabled = false;
    }
  }

  bindEvents() {
    document.querySelectorAll(`#${this.drawerId} [data-action="close"]`).forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    const select = document.getElementById('select-strategie-item');
    if (select) {
      select.addEventListener('change', (e) => {
        this.selectedItemId = e.target.value || null;
        const btn = document.getElementById('btn-link-strategie');
        if (btn) btn.disabled = !this.selectedItemId;
      });
    }

    document.getElementById('btn-link-strategie')?.addEventListener('click', () => this.handleLink());
    document.getElementById('btn-unlink-strategie')?.addEventListener('click', () => this.handleUnlink());
  }

  async handleLink() {
    if (!this.selectedItemId || !this.video?.id) return;

    const btn = document.getElementById('btn-link-strategie');
    try {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-loading');
      }

      const { error } = await window.supabase
        .from('kooperation_videos')
        .update({ strategie_item_id: this.selectedItemId })
        .eq('id', this.video.id);

      if (error) throw error;

      window.toastSystem?.show('Strategie-Idee erfolgreich verknüpft', 'success');
      window.dispatchEvent(new CustomEvent('strategieItemLinked', {
        detail: { itemId: this.selectedItemId, videoId: this.video.id }
      }));

      if (this.onSuccess) await this.onSuccess();
      this.close();
    } catch (error) {
      console.error('Fehler beim Verknüpfen:', error);
      window.toastSystem?.show('Fehler beim Verknüpfen', 'error');
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    }
  }

  async handleUnlink() {
    if (!this.video?.id) return;

    const result = await window.confirmationModal?.open({
      title: 'Verknüpfung entfernen?',
      message: 'Möchten Sie die Verknüpfung zwischen diesem Video und der Strategie-Idee entfernen?',
      confirmText: 'Entfernen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    try {
      const { error } = await window.supabase
        .from('kooperation_videos')
        .update({ strategie_item_id: null })
        .eq('id', this.video.id);

      if (error) throw error;

      window.toastSystem?.show('Verknüpfung entfernt', 'success');
      if (this.onSuccess) await this.onSuccess();
      this.close();
    } catch (error) {
      console.error('Fehler beim Entfernen:', error);
      window.toastSystem?.show('Fehler beim Entfernen', 'error');
    }
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => this.removeDrawer(), 250);
    } else {
      this.removeDrawer();
    }
  }

  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }

  destroy() {
    this.close();
  }

  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text || '').replace(/[&<>"']/g, m => map[m]);
  }
}

export default LinkStrategieItemDrawer;
