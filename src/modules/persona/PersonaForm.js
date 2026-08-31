// PersonaForm.js
// Eigene Seite zum Anlegen und Bearbeiten einer Persona.
// Routen: /marke/:markeId/persona und /unternehmen/:unternehmenId/persona
//         (Bearbeiten jeweils mit ?persona=:id)
// Layout wie "Marke anlegen": Split-Container, Formular links auf halber Breite.
//
// Im Unternehmens-Kontext steht im Formular ein Marken-Multiselect. Aus einer
// Marke heraus ist die Zuordnung fix - das Feld wird dort entfernt.

import { PersonaService } from './PersonaService.js';
import { resolveOwnerContext } from '../../core/OwnerContext.js';
import { nestedSwitcherContext } from '../../core/breadcrumbSwitcher.js';
import { icon } from '../../core/icons/IconSystem.js';

export class PersonaForm {
  constructor() {
    this.ctx = null;
    this.owner = null;
    this.personaId = null;
    this.persona = null;
    this.markenIds = [];
    this._abort = null;
  }

  get isEdit() {
    return !!this.personaId;
  }

  get returnRoute() {
    return `${this.ctx.basePath}?tab=personas`;
  }

  async init(ownerId) {
    this._abort?.abort();
    this._abort = new AbortController();

    this.personaId = new URLSearchParams(window.location.search).get('persona');
    this.persona = null;
    this.markenIds = [];

    try {
      this.ctx = await resolveOwnerContext(ownerId);
      this.owner = this.ctx.owner;

      if (this.personaId) {
        this.persona = await PersonaService.loadOne(this.personaId, this.ctx);
        if (!this.persona) {
          window.toastSystem?.error?.('Persona nicht gefunden');
          window.navigateTo(this.returnRoute);
          return;
        }
        this.markenIds = await PersonaService.loadMarkenIds(this.personaId);
      }
    } catch (err) {
      console.error('Persona-Formular konnte nicht geladen werden:', err);
      window.ErrorHandler?.handle?.(err, 'PersonaForm.init');
      window.navigateTo(this.ctx?.basePath || '/marke');
      return;
    }

    this.render();
    this.bindEvents();
  }

  render() {
    const title = this.isEdit
      ? PersonaService.label(this.persona)
      : 'Neue Persona anlegen';

    window.setHeadline(title);

    window.breadcrumbSystem?.updateBreadcrumb([
      { label: this.ctx.listLabel, url: this.ctx.listPath, clickable: true },
      { label: this.ctx.ownerLabel, url: this.ctx.basePath, clickable: true },
      { label: 'Personas', url: this.returnRoute, clickable: true },
      { label: this.isEdit ? PersonaService.label(this.persona) : 'Persona anlegen', clickable: false }
    ], null, {
      switcher: this.isEdit ? nestedSwitcherContext('persona', this.personaId, this.ctx) : null
    });

    const formData = this.isEdit
      ? { ...this.persona, marke_ids: this.markenIds, _isEditMode: true, _entityId: this.persona.id }
      : null;
    const formHtml = window.formSystem.renderFormOnly('persona', formData);

    window.content.innerHTML = `
      <div class="form-split-container">
        <div class="form-split-left">
          <div class="form-page">${formHtml}</div>
        </div>
        <div class="form-split-right hidden"></div>
      </div>
    `;

    const form = document.getElementById('persona-form');
    this.prepareMarkenFeld(form);

    window.formSystem.bindFormEvents('persona', formData);
  }

  get zeigtMarkenFeld() {
    return !this.ctx.markeId && this.ctx.markenAnzahl > 0;
  }

  /**
   * Das Marken-Multiselect braucht die unternehmen_id als Filter-Parent
   * (field.filterBy in DirectQueryLoader). Aus einer Marke heraus ist die
   * Zuordnung fix und ein Unternehmen ohne Marken hat nichts zu waehlen -
   * in beiden Faellen fliegt das Feld raus.
   */
  prepareMarkenFeld(form) {
    if (!form) return;

    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = 'unternehmen_id';
    hidden.value = this.ctx.unternehmenId || '';
    form.appendChild(hidden);

    if (!this.zeigtMarkenFeld) {
      form.querySelector('[name="marke_ids"]')?.closest('.form-field')?.remove();
    }
  }

  bindEvents() {
    const form = document.getElementById('persona-form');
    if (!form) return;

    const signal = this._abort?.signal;
    const opts = signal ? { signal } : undefined;

    // bindFormEvents setzt einen eigenen Submit-Handler - der wird hier ersetzt
    form.onsubmit = async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    };

    // Der Abbrechen-Button aus renderFormOnly zeigt fest auf /persona - die Route
    // existiert nicht, deshalb zurueck auf den Personas-Tab.
    const cancelBtn = form.querySelector('.mdc-btn--cancel');
    if (cancelBtn) {
      cancelBtn.removeAttribute('onclick');
      cancelBtn.addEventListener('click', () => window.navigateTo(this.returnRoute), opts);
    }

    if (this.isEdit) {
      this.injectDeleteButton(form, opts);
    }
  }

  injectDeleteButton(form, opts) {
    const actions = form.querySelector('.form-actions');
    if (!actions || actions.querySelector('.persona-delete-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mdc-btn mdc-btn--delete persona-delete-btn';
    btn.innerHTML = `
      <span class="mdc-btn__icon" aria-hidden="true">
        ${icon('trash-alt')}
      </span>
      <span class="mdc-btn__label">Löschen</span>
    `;
    btn.addEventListener('click', () => this.handleDelete(), opts);

    actions.insertBefore(btn, actions.firstChild);
  }

  async handleSubmit() {
    const form = document.getElementById('persona-form');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const data = window.formSystem.collectSubmitData(form);

    this.clearFieldErrors(form);
    const validation = window.validatorSystem.validateForm(data, {
      name: { type: 'text', minLength: 2, required: true }
    });
    if (!validation.isValid) {
      this.showFieldErrors(form, validation.errors);
      window.toastSystem?.error?.('Bitte Pflichtfelder ausfüllen');
      this.releaseSubmitBtn(submitBtn);
      return;
    }

    submitBtn?.classList.add('is-loading');

    try {
      let personaId = this.personaId;

      if (this.isEdit) {
        await PersonaService.update(this.personaId, data);
      } else {
        const result = await PersonaService.create(data, this.ctx);
        personaId = result.id;
      }

      await PersonaService.saveMarken(personaId, this.collectMarkenIds(data));

      window.toastSystem?.success?.(this.isEdit ? 'Persona gespeichert' : 'Persona angelegt');
      window.navigateTo(this.returnRoute);
    } catch (err) {
      console.error('Persona speichern fehlgeschlagen:', err);
      window.toastSystem?.error?.('Fehler beim Speichern: ' + err.message);
      this.releaseSubmitBtn(submitBtn);
    }
  }

  /**
   * Ohne sichtbares Feld bleibt die bestehende Zuordnung erhalten - aus einer
   * Marke heraus kommt sie nur dazu. Sonst zaehlt genau die Auswahl im Tag-Feld.
   */
  collectMarkenIds(data) {
    if (!this.zeigtMarkenFeld) {
      return [...new Set([...this.markenIds, this.ctx.markeId].filter(Boolean))];
    }
    const werte = data.marke_ids;
    if (Array.isArray(werte)) return werte;
    return werte ? [werte] : [];
  }

  /** Der globale SubmitGuard sperrt den Button in der Capture-Phase des Submits. */
  releaseSubmitBtn(btn) {
    btn?.classList.remove('is-loading');
    if (btn) window.submitGuard?.unlockButton?.(btn);
  }

  async handleDelete() {
    const res = await window.confirmationModal?.open({
      title: 'Persona löschen?',
      message: `"${PersonaService.label(this.persona)}" wird endgültig gelöscht. Eine Zielgruppen-DNA dieser Persona wird mit entfernt, Skripte bleiben erhalten.`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!res?.confirmed) return;

    try {
      await PersonaService.remove(this.personaId);
      window.toastSystem?.success?.('Persona gelöscht');
      window.navigateTo(this.returnRoute);
    } catch (err) {
      console.error('Persona loeschen fehlgeschlagen:', err);
      window.toastSystem?.error?.('Fehler beim Löschen: ' + err.message);
    }
  }

  clearFieldErrors(form) {
    form.querySelectorAll('.field-error').forEach(el => el.remove());
  }

  showFieldErrors(form, errors = {}) {
    for (const [field, message] of Object.entries(errors)) {
      const el = form.querySelector(`[name="${field}"]`);
      if (!el) continue;
      const error = document.createElement('div');
      error.className = 'field-error';
      error.textContent = message;
      el.parentNode.appendChild(error);
    }
  }

  destroy() {
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* noop */ }
      this._abort = null;
    }
  }
}

export const personaForm = new PersonaForm();
