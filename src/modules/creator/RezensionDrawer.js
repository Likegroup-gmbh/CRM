// RezensionDrawer.js
// Rezension einer Kooperation abgeben oder ändern, geöffnet über das
// Aktionsmenü der Kooperation. Karte und Speichern kommen aus rezension.js.

import {
  loadRezension,
  paintStars,
  readRezensionForm,
  renderKooperationRezension,
  saveRezension,
  syncRezensionForm
} from './rezension.js';
import { icon } from '../../core/icons/IconSystem.js';
import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';

function toast(message, type = 'success') {
  window.toastSystem?.show(message, type);
}

const istVollstaendig = (values) =>
  values.produktionsqualitaet != null && values.kommunikation_verlaesslichkeit != null;

export class RezensionDrawer {
  constructor() {
    this.drawerId = 'rezension-drawer';
    this.rezension = null;
    this._busy = false;
  }

  async open(kooperationId, creatorId) {
    this.kooperationId = kooperationId;
    this.creatorId = creatorId || null;
    this._create('Rezension abgeben');
    this._body('<div class="text-muted">Lädt…</div>');
    try {
      this.rezension = await loadRezension(window.supabase, kooperationId);
    } catch (err) {
      this._body(`<div class="text-muted">Rezension konnte nicht geladen werden.</div>`);
      toast(err.message || String(err), 'error');
      return;
    }
    this._body(renderKooperationRezension(this.rezension, { canEdit: true, mitSpeichern: false }));
    this._bind();
  }

  _root() {
    return document.getElementById('koop-rezension');
  }

  _saveButton() {
    return document.querySelector(`#${this.drawerId} .drawer-footer [data-action="save-rezension"]`);
  }

  _sync() {
    const values = syncRezensionForm(this._root());
    const button = this._saveButton();
    if (button) button.disabled = !istVollstaendig(values);
    return values;
  }

  _bind() {
    const root = this._root();
    if (!root) return;
    this._sync();
    root.addEventListener('click', (e) => {
      const star = e.target.closest('.rezension-star');
      if (!star || star.disabled) return;
      paintStars(star.closest('.rezension-stars'), star.dataset.value);
      this._sync();
    });
  }

  async _save() {
    const root = this._root();
    const button = this._saveButton();
    if (this._busy || !root || button?.disabled) return;
    this._busy = true;
    button?.classList.add('is-loading');
    try {
      await saveRezension(window.supabase, {
        id: this.rezension?.id,
        kooperationId: this.kooperationId,
        creatorId: this.creatorId,
        ...readRezensionForm(root)
      });
      toast('Rezension gespeichert', 'success');
      this.close();
    } catch (err) {
      toast(err.message || String(err), 'error');
      this._sync();
    } finally {
      button?.classList.remove('is-loading');
      this._busy = false;
    }
  }

  _body(html) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (body) body.innerHTML = html;
  }

  _create(titel) {
    this.close(true);
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;
    overlay.addEventListener('click', () => this.close());

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;
    panel.innerHTML = `
      <div class="drawer-header">
        <div><span class="drawer-title">${titel}</span></div>
        <div><button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button></div>
      </div>
      <div class="drawer-body" id="${this.drawerId}-body"></div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--cancel" data-action="cancel">
          <span class="mdc-btn__icon" aria-hidden="true">${icon('x-circle-filled')}</span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button type="button" class="mdc-btn mdc-btn--create" data-action="save-rezension" disabled>
          <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${icon('check-filled')}</span>
          <span class="mdc-btn__spinner" aria-hidden="true">
            <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
              <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
            </svg>
          </span>
          <span class="mdc-btn__label">Speichern</span>
        </button>
      </div>`;
    panel.querySelector('.drawer-close-btn').addEventListener('click', () => this.close());
    panel.querySelector('[data-action="cancel"]').addEventListener('click', () => this.close());
    panel.querySelector('[data-action="save-rezension"]').addEventListener('click', () => this._save());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));
  }

  close(sofort = false) {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    if (!panel && !overlay) return;
    const entfernen = () => { panel?.remove(); overlay?.remove(); };
    if (sofort) {
      entfernen();
      return;
    }
    panel?.classList.remove('show');
    setTimeout(entfernen, DRAWER_EXIT_MS);
  }
}

export function openRezensionDrawer(kooperationId, creatorId) {
  return new RezensionDrawer().open(kooperationId, creatorId);
}
