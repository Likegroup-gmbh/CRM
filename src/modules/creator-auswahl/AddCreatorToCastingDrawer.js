// Drawer: CRM-Creator auf ein Casting setzen (Auto-Suggestion, Mitarbeiter-Scope)

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { OHNE_KATEGORIE, parseTeilbereiche } from './castingKategorien.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { icon } from '../../core/icons/IconSystem.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';

const DRAWER_ID = 'add-creator-to-casting-drawer';

/** Text einer Casting-Option in Auswahllisten: "Casting — Kampagne". */
export function castingPickerLabel(liste) {
  const name = liste.name || 'Casting';
  const kampagneName = KampagneUtils.getDisplayName(liste.kampagne);
  if (!liste.kampagne || kampagneName === 'Unbenannte Kampagne') return name;
  return `${name} — ${kampagneName}`;
}

export function openAddCreatorToCastingDrawer(creatorId) {
  const drawer = new AddCreatorToCastingDrawer();
  return drawer.open(creatorId);
}

export class AddCreatorToCastingDrawer {
  constructor() {
    this.drawerId = DRAWER_ID;
    this.creatorId = null;
    this.creatorName = '';
    this.selectedListeId = null;
    this.selectedKategorie = null;
    this.listenById = new Map();
  }

  async open(creatorId) {
    this.creatorId = creatorId;
    this.selectedListeId = null;
    this.selectedKategorie = null;

    try {
      this.createDrawer();
      await this.loadAndRender();
    } catch (error) {
      console.error('Fehler beim Öffnen des Castings-Drawers:', error);
      window.toastSystem?.show(error.message || 'Fehler beim Öffnen', 'error');
      this.close();
    }
  }

  createDrawer() {
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
          <span class="drawer-title">Zu Casting hinzufügen</span>
          <p class="drawer-subtitle" id="${this.drawerId}-subtitle">Casting wählen</p>
        </div>
        <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
      </div>
      <div class="drawer-body" id="${this.drawerId}-body">
        <div class="drawer-loading-state">Lade Castings...</div>
      </div>
    `;

    overlay.addEventListener('click', () => this.close());
    panel.querySelector('.drawer-close-btn').addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));
  }

  async loadAndRender() {
    const [{ data: creator }, listen, assignedIds] = await Promise.all([
      window.supabase
        .from('creator')
        .select('id, vorname, nachname')
        .eq('id', this.creatorId)
        .single(),
      creatorAuswahlService.getAllListen(),
      creatorAuswahlService.getListeIdsForCreator(this.creatorId)
    ]);

    this.creatorName = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim() || 'Creator';
    const subtitle = document.getElementById(`${this.drawerId}-subtitle`);
    if (subtitle) subtitle.textContent = this.creatorName;

    const assigned = new Set(assignedIds);
    const freeListen = (listen || []).filter((liste) => liste?.id && !assigned.has(liste.id));
    this.listenById = new Map(freeListen.map((liste) => [liste.id, liste]));
    const options = freeListen.map((liste) => ({
      value: liste.id,
      label: this.pickerLabel(liste)
    }));

    this.renderBody(options);
    this.bindEvents(options);
  }

  pickerLabel(liste) {
    return castingPickerLabel(liste);
  }

  renderBody(options) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    if (!options.length) {
      body.innerHTML = `
        <div class="add-to-video-empty">
          <p>Kein freies Casting verfügbar.</p>
          <p class="hint">Entweder fehlen Freigaben, oder der Creator hängt schon auf allen sichtbaren Castings.</p>
        </div>
      `;
      return;
    }

    body.innerHTML = `
      <div class="form-field">
        <label for="${this.drawerId}-select">Casting</label>
        <select id="${this.drawerId}-select" class="form-input" data-searchable="true">
          <option value="">– Casting wählen –</option>
        </select>
      </div>
      <div class="form-field" id="${this.drawerId}-kategorie-field" hidden>
        <label for="${this.drawerId}-kategorie">Kategorie</label>
        <select id="${this.drawerId}-kategorie" class="form-input">
          <option value="">${OHNE_KATEGORIE}</option>
        </select>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
          <span class="mdc-btn__icon" aria-hidden="true">${icon('x-circle-filled')}</span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button type="button" class="mdc-btn mdc-btn--create" id="${this.drawerId}-submit" disabled>
          <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${icon('check-filled')}</span>
          <span class="mdc-btn__spinner" aria-hidden="true">
            <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16"><circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/></svg>
          </span>
          <span class="mdc-btn__label">Hinzufügen</span>
        </button>
      </div>
    `;
  }

  bindEvents(options) {
    document.querySelectorAll(`#${this.drawerId} [data-action="close"]`).forEach((btn) => {
      btn.addEventListener('click', () => this.close());
    });

    const select = document.getElementById(`${this.drawerId}-select`);
    if (!select) return;

    if (window.formSystem?.createSimpleSearchableSelect) {
      window.formSystem.createSimpleSearchableSelect(select, options, {
        placeholder: 'Casting oder Kampagne suchen…'
      });
    } else {
      select.innerHTML = `<option value="">– Casting wählen –</option>`
        + options.map((o) => `<option value="${o.value}">${this.escapeHtml(o.label)}</option>`).join('');
    }

    select.addEventListener('change', () => {
      this.selectedListeId = select.value || null;
      this.selectedKategorie = null;
      this.loadKategorienForListe();
    });

    document.getElementById(`${this.drawerId}-kategorie`)?.addEventListener('change', (e) => {
      this.selectedKategorie = e.target.value || null;
    });

    document.getElementById(`${this.drawerId}-submit`)?.addEventListener('click', () => this.submit());
  }

  syncSubmit() {
    const btn = document.getElementById(`${this.drawerId}-submit`);
    if (btn) btn.disabled = !this.selectedListeId;
  }

  /** Kategorie ist optional: das Feld erscheint nur, wenn das Casting welche hat. */
  loadKategorienForListe() {
    const field = document.getElementById(`${this.drawerId}-kategorie-field`);
    const select = document.getElementById(`${this.drawerId}-kategorie`);
    if (!field || !select) return;

    this.selectedKategorie = null;
    select.innerHTML = `<option value="">${OHNE_KATEGORIE}</option>`;

    const liste = this.selectedListeId ? this.listenById.get(this.selectedListeId) : null;
    const kategorien = parseTeilbereiche(liste?.teilbereich);
    if (!kategorien.length) {
      field.hidden = true;
      this.syncSubmit();
      return;
    }

    select.innerHTML = `<option value="">${OHNE_KATEGORIE}</option>`
      + kategorien.map((name) => `<option value="${this.escapeHtml(name)}">${this.escapeHtml(name)}</option>`).join('');
    field.hidden = false;
    this.syncSubmit();
  }

  async submit() {
    if (!this.selectedListeId || !this.creatorId) return;
    const btn = document.getElementById(`${this.drawerId}-submit`);
    try {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-loading');
      }

      await creatorAuswahlService.addCreatorFromStammdaten(
        this.selectedListeId,
        this.creatorId,
        this.selectedKategorie
      );

      tabDataCache.invalidate('creator', this.creatorId);
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: {
          entity: 'creator_auswahl',
          action: 'item-added',
          id: this.selectedListeId,
          creatorId: this.creatorId
        }
      }));
      window.toastSystem?.show('Creator wurde zum Casting hinzugefügt', 'success');
      this.close();
    } catch (error) {
      console.error('Fehler beim Hinzufügen zum Casting:', error);
      window.toastSystem?.show(error.message || 'Hinzufügen fehlgeschlagen', 'error');
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
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

  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text || '').replace(/[&<>"']/g, (m) => map[m]);
  }
}
