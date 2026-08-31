// StrategieCreatorDrawer.js
// Verknüpft ein Strategie-Item mit genau einem Creator aus der Datenbank.
// Beim Verbinden wird creator_name mit dem DB-Namen überschrieben, beim
// Lösen bleibt er als Freitext erhalten (nur creator_id wird entfernt).

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

function creatorDisplayName(creator) {
  return `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
}

export class StrategieCreatorDrawer {
  constructor(detail) {
    this.detail = detail;
    this.item = null;
    this.onSuccess = null;
    this.selectedCreatorId = null;
    // id -> Creator aus der Suche, damit beim Verbinden Name und Join-Daten
    // ohne Extra-Query vorliegen
    this.creatorCache = new Map();
  }

  open(itemId, { onSuccess } = {}) {
    const item = this.detail.items.find(i => i.id === itemId);
    if (!item) {
      window.toastSystem?.show('Item nicht gefunden', 'error');
      return;
    }

    removeStrategieCreatorDrawer();

    this.item = item;
    this.onSuccess = onSuccess || null;
    this.selectedCreatorId = item.creator_id || null;
    this.creatorCache = new Map();

    const linkedName = creatorDisplayName(item.creator);
    const kontext = (item.beschreibung || '').trim();

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
          <span class="drawer-title">Creator verbinden</span>
          <p class="drawer-subtitle">${kontext ? escapeHtml(kontext.slice(0, 80)) : (item.video_link ? 'Video' : 'Idee')}</p>
        </div>
        <div>
          <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
        </div>
      </div>
      <div class="drawer-body">
        ${item.creator_id && linkedName ? `
          <div class="link-strategie-context">
            <div class="link-strategie-context-row">
              <span class="link-strategie-context-label">Aktuell verknüpft</span>
              <span>${escapeHtml(linkedName)}</span>
            </div>
          </div>
        ` : ''}
        <div class="form-field">
          <label for="strategie-creator-select">Creator aus der Datenbank</label>
          <select id="strategie-creator-select" class="form-input">
            <option value="">– Creator wählen –</option>
          </select>
        </div>
        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          ${item.creator_id ? `
            <button type="button" id="btn-creator-unlink" class="mdc-btn mdc-btn--danger">
              <span class="mdc-btn__label">Verknüpfung lösen</span>
            </button>
          ` : ''}
          <button type="button" id="btn-creator-connect" class="mdc-btn mdc-btn--create" disabled>
            <span class="mdc-btn__label">Verbinden</span>
          </button>
        </div>
      </div>
    `;

    overlay.addEventListener('click', () => this.close());
    panel.querySelector('.drawer-close-btn').addEventListener('click', () => this.close());
    panel.querySelector('[data-action="close"]')?.addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    this.initCreatorSelect();
    this.bindEvents();
  }

  initCreatorSelect() {
    const select = document.getElementById('strategie-creator-select');
    if (!select || !window.formSystem) return;

    const loadCreators = async (query) => {
      try {
        const creators = await strategieService.searchCreators((query || '').trim());
        creators.forEach(c => this.creatorCache.set(c.id, c));
        return creators.map(c => ({
          value: c.id,
          label: c.name || 'Unbekannt',
          subtitle: [c.instagram, c.tiktok].filter(Boolean).join(', ') || undefined
        }));
      } catch (error) {
        console.error('Fehler bei der Creator-Suche:', error);
        return [];
      }
    };

    // Vorauswahl bei bestehender Verknüpfung: die selected-Option setzt im
    // Searchable-Select sowohl das sichtbare Input als auch den Hidden-Value
    const initialOptions = [];
    if (this.item.creator_id && this.item.creator) {
      const c = this.item.creator;
      const name = creatorDisplayName(c) || this.item.creator_name || 'Unbekannt';
      this.creatorCache.set(c.id, { ...c, name });
      initialOptions.push({ value: c.id, label: name, selected: true });
    }

    window.formSystem.createSimpleSearchableSelect(select, initialOptions, {
      placeholder: 'Name, Instagram oder TikTok eingeben...',
      serverSearch: loadCreators
    });

    if (this.selectedCreatorId) {
      const btn = document.getElementById('btn-creator-connect');
      if (btn) btn.disabled = false;
    }
  }

  bindEvents() {
    const select = document.getElementById('strategie-creator-select');
    select?.addEventListener('change', () => {
      // Der zuverlässige Wert steckt im Hidden-Input des Searchable-Selects
      const hidden = document.getElementById('strategie-creator-select_value');
      this.selectedCreatorId = hidden?.value || null;
      const btn = document.getElementById('btn-creator-connect');
      if (btn) btn.disabled = !this.selectedCreatorId;
    });

    document.getElementById('btn-creator-connect')?.addEventListener('click', () => this.handleConnect());
    document.getElementById('btn-creator-unlink')?.addEventListener('click', () => this.handleUnlink());
  }

  async handleConnect() {
    if (!this.selectedCreatorId || !this.item) return;

    const btn = document.getElementById('btn-creator-connect');
    try {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-loading');
      }

      const creator = this.creatorCache.get(this.selectedCreatorId);
      const name = creator?.name || creatorDisplayName(creator) || null;

      const updates = { creator_id: this.selectedCreatorId, creator_name: name };
      await strategieService.updateStrategieItem(this.item.id, updates);

      Object.assign(this.item, updates);
      if (creator) {
        this.item.creator = {
          id: creator.id,
          vorname: creator.vorname,
          nachname: creator.nachname,
          instagram: creator.instagram,
          tiktok: creator.tiktok
        };
      }

      window.toastSystem?.show('Creator verknüpft', 'success');
      if (this.onSuccess) await this.onSuccess();
      this.close();
      this.detail.rerenderItemsTable();
    } catch (error) {
      console.error('Fehler beim Verknüpfen des Creators:', error);
      window.toastSystem?.show('Fehler beim Verknüpfen', 'error');
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    }
  }

  async handleUnlink() {
    if (!this.item?.creator_id) return;

    const result = await window.confirmationModal?.open({
      title: 'Verknüpfung lösen?',
      message: 'Die Verknüpfung zum Creator wird gelöst. Der Name bleibt als Freitext in der Spalte erhalten.',
      confirmText: 'Lösen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!result?.confirmed) return;

    try {
      await strategieService.updateStrategieItem(this.item.id, { creator_id: null });
      this.item.creator_id = null;
      this.item.creator = null;

      window.toastSystem?.show('Verknüpfung gelöst', 'success');
      if (this.onSuccess) await this.onSuccess();
      this.close();
      this.detail.rerenderItemsTable();
    } catch (error) {
      console.error('Fehler beim Lösen der Creator-Verknüpfung:', error);
      window.toastSystem?.show('Fehler beim Lösen', 'error');
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
