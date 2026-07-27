// MarkePersonaForm.js
// Eigene Seite zum Anlegen und Bearbeiten einer Persona einer Marke.
// Routen: /marke/:markeId/persona (anlegen), /marke/:markeId/persona?persona=:id (bearbeiten)
// Layout wie "Marke anlegen": Split-Container, Formular links auf halber Breite.

import { MarkePersonaService } from './services/MarkePersonaService.js';

export class MarkePersonaForm {
  constructor() {
    this.markeId = null;
    this.personaId = null;
    this.marke = null;
    this.persona = null;
    this._abort = null;
  }

  get isEdit() {
    return !!this.personaId;
  }

  get returnRoute() {
    return `/marke/${this.markeId}?tab=personas`;
  }

  async init(markeId) {
    this._abort?.abort();
    this._abort = new AbortController();

    this.markeId = markeId;
    this.personaId = new URLSearchParams(window.location.search).get('persona');
    this.marke = null;
    this.persona = null;

    try {
      const { data: marke, error } = await window.supabase
        .from('marke')
        .select('id, markenname')
        .eq('id', markeId)
        .single();
      if (error) throw error;
      this.marke = marke;

      if (this.personaId) {
        this.persona = await MarkePersonaService.loadOne(this.personaId, markeId);
        if (!this.persona) {
          window.toastSystem?.error?.('Persona nicht gefunden');
          window.navigateTo(this.returnRoute);
          return;
        }
      }
    } catch (err) {
      console.error('Persona-Formular konnte nicht geladen werden:', err);
      window.ErrorHandler?.handle?.(err, 'MarkePersonaForm.init');
      window.navigateTo(this.returnRoute);
      return;
    }

    this.render();
    this.bindEvents();
  }

  render() {
    const title = this.isEdit
      ? MarkePersonaService.label(this.persona)
      : 'Neue Persona anlegen';

    window.setHeadline(title);

    window.breadcrumbSystem?.updateBreadcrumb([
      { label: 'Marken', url: '/marke', clickable: true },
      { label: this.marke.markenname || 'Marke', url: this.returnRoute, clickable: true },
      { label: this.isEdit ? MarkePersonaService.label(this.persona) : 'Persona anlegen', clickable: false }
    ]);

    const formData = this.isEdit
      ? { ...this.persona, _isEditMode: true, _entityId: this.persona.id }
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

    window.formSystem.bindFormEvents('persona', formData);
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
    // existiert nicht, deshalb zurueck auf den Personas-Tab der Marke.
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
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
          <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
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
      if (this.isEdit) {
        await MarkePersonaService.update(this.personaId, data);
        window.toastSystem?.success?.('Persona gespeichert');
      } else {
        await MarkePersonaService.create(data, this.markeId);
        window.toastSystem?.success?.('Persona angelegt');
      }
      window.navigateTo(this.returnRoute);
    } catch (err) {
      console.error('Persona speichern fehlgeschlagen:', err);
      window.toastSystem?.error?.('Fehler beim Speichern: ' + err.message);
      this.releaseSubmitBtn(submitBtn);
    }
  }

  /** Der globale SubmitGuard sperrt den Button in der Capture-Phase des Submits. */
  releaseSubmitBtn(btn) {
    btn?.classList.remove('is-loading');
    if (btn) window.submitGuard?.unlockButton?.(btn);
  }

  async handleDelete() {
    const res = await window.confirmationModal?.open({
      title: 'Persona löschen?',
      message: `"${MarkePersonaService.label(this.persona)}" wird endgültig gelöscht. Eine Zielgruppen-DNA dieser Persona wird mit entfernt, Skripte bleiben erhalten.`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!res?.confirmed) return;

    try {
      await MarkePersonaService.remove(this.personaId);
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

export const markePersonaForm = new MarkePersonaForm();
