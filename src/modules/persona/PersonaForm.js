// PersonaForm.js
// Eigene Seite zum Anlegen und Bearbeiten einer Persona.
// Routen: /marke/:markeId/persona und /unternehmen/:unternehmenId/persona
//         (Bearbeiten jeweils mit ?persona=:id)
//         /persona/new und /persona/:id (Standalone aus der Liste)
//
// Die Seite ist ein Worksheet wie das Produkt (core/doc/DocPage.js via
// PersonaDoc.js): mittig das Schreibdokument, rechts der Liky-Slot, ganz
// unten das Produkte-Band (PersonaProduktPanel.js) - gleiches Layout und
// gleiche Verknuepfungs-Mechanik wie am Produkt.
//
// Im Unternehmens-Kontext steht im Dokument ein Marken-Multiselect. Aus einer
// Marke heraus ist die Zuordnung fix - das Feld wird dort nicht gerendert.

import { PersonaService } from './PersonaService.js';
import { ProduktPersonaService } from '../produkt/ProduktPersonaService.js';
import { renderPersonaDoc, bindPersonaDoc } from './PersonaDoc.js';
import { PersonaProduktPanel } from './PersonaProduktPanel.js';
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
    this.produktPanel = null;
    this._abort = null;
  }

  get isEdit() {
    return !!this.personaId;
  }

  get isStandalone() {
    return window.location.pathname.split('/').filter(Boolean)[0] === 'persona';
  }

  get returnRoute() {
    return this.isStandalone ? '/persona' : `${this.ctx.basePath}?tab=personas`;
  }

  async init(ownerId) {
    this._abort?.abort();
    this._abort = new AbortController();

    this.personaId = new URLSearchParams(window.location.search).get('persona');
    if (this.isStandalone) {
      this.personaId = ownerId && ownerId !== 'new' ? ownerId : null;
    }
    this.persona = null;
    this.markenIds = [];

    try {
      if (this.isStandalone) {
        if (this.personaId) {
          this.persona = await PersonaService.loadOne(this.personaId);
          if (!this.persona) {
            window.toastSystem?.error?.('Persona nicht gefunden');
            window.navigateTo(this.returnRoute);
            return;
          }
          this.markenIds = await PersonaService.loadMarkenIds(this.personaId);
        }
        this.ctx = {
          typ: 'persona',
          markeId: null,
          unternehmenId: this.persona?.unternehmen_id || null,
          owner: null,
          basePath: '/persona',
          listPath: '/persona',
          listLabel: 'Personas',
          ownerLabel: 'Übersicht',
          markenAnzahl: 0
        };
        this.owner = null;
      } else {
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
      }
    } catch (err) {
      console.error('Persona-Formular konnte nicht geladen werden:', err);
      window.ErrorHandler?.handle?.(err, 'PersonaForm.init');
      window.navigateTo(this.isStandalone ? '/persona' : (this.ctx?.basePath || '/marke'));
      return;
    }

    await this.render();
    this.bindEvents();
  }

  async render() {
    const title = this.isEdit
      ? PersonaService.label(this.persona)
      : 'Neue Persona anlegen';

    window.setHeadline(title);

    if (this.isStandalone) {
      // Schlichter Kontext statt nestedSwitcherContext: ctx.basePath ist '/persona',
      // damit wuerde nestedOwnerRoute '/persona/persona?persona=<id>' bauen. Der
      // Fallback '/persona/<id>' ist die korrekte Standalone-Route.
      window.breadcrumbSystem?.updateBreadcrumb([
        { label: 'Personas', url: '/persona', clickable: true },
        { label: this.isEdit ? PersonaService.label(this.persona) : 'Persona anlegen', clickable: false }
      ], null, {
        switcher: this.isEdit ? { segment: 'persona', id: this.personaId } : null
      });
    } else {
      window.breadcrumbSystem?.updateBreadcrumb([
        { label: this.ctx.listLabel, url: this.ctx.listPath, clickable: true },
        { label: this.ctx.ownerLabel, url: this.ctx.basePath, clickable: true },
        { label: 'Personas', url: this.returnRoute, clickable: true },
        { label: this.isEdit ? PersonaService.label(this.persona) : 'Persona anlegen', clickable: false }
      ], null, {
        switcher: this.isEdit ? nestedSwitcherContext('persona', this.personaId, this.ctx) : null
      });
    }

    const formData = this.isEdit
      ? { ...this.persona, marke_ids: this.markenIds, _isEditMode: true, _entityId: this.persona.id }
      : null;

    window.content.innerHTML = renderPersonaDoc(formData, {
      mitMarkenFeld: this.zeigtMarkenFeld,
      mitUnternehmenFeld: this.isStandalone,
      unternehmenId: this.ctx?.unternehmenId || null
    });

    const form = document.getElementById('persona-form');
    bindPersonaDoc(form, formData);

    if (this.isStandalone) {
      this.prepareStandalone(form);
    }

    // Searchable-Selects und Tag-Multiselect (Unternehmen, Branche, Marken)
    await window.formSystem.bindFormEvents('persona', formData);

    this.produktPanel = new PersonaProduktPanel();
    await this.produktPanel.mount(form, {
      personaId: this.personaId,
      getUnternehmenId: () => this.ctx?.unternehmenId
        || form.querySelector('[name="unternehmen_id"]')?.value
        || null
    });
  }

  get zeigtMarkenFeld() {
    if (this.isStandalone) return true;
    return !this.ctx.markeId && this.ctx.markenAnzahl > 0;
  }

  /**
   * Standalone: Unternehmen ist ein sichtbares, pflichtiges Searchable-Select.
   * Im Edit bleibt es readonly, damit die Persona nicht zwischen Unternehmen
   * wandert. Das Marken-Feld bleibt optional, der DirectQueryLoader filtert
   * ueber dependsOn automatisch.
   */
  prepareStandalone(form) {
    if (!form) return;

    if (this.isEdit) {
      const unternehmenField = form.querySelector('[name="unternehmen_id"]');
      if (unternehmenField) {
        unternehmenField.disabled = true;
        unternehmenField.classList.add('is-readonly');
      }
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

    // Abbrechen: Liste oder Personas-Tab der Marke/des Unternehmens
    const cancelBtn = form.querySelector('.mdc-btn--cancel');
    if (cancelBtn) {
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
      name: { type: 'text', minLength: 2, required: true },
      unternehmen_id: { required: true }
    });
    if (!validation.isValid) {
      this.showFieldErrors(form, validation.errors);
      window.toastSystem?.error?.('Bitte Pflichtfelder ausfüllen');
      this.releaseSubmitBtn(submitBtn);
      return;
    }

    submitBtn?.classList.add('is-loading');

    try {
      // Panel konnte den persisted Stand nicht laden: nicht speichern, sonst
      // diffed saveForPersona gegen [] und loescht alle Produkt-Verknuepfungen.
      if (this.produktPanel?.loadFehler) {
        throw new Error('Verknüpfte Produkte konnten nicht geladen werden – bitte Seite neu laden, es wurde nichts gespeichert.');
      }

      let personaId = this.personaId;

      if (this.isEdit) {
        await PersonaService.update(this.personaId, data);
      } else {
        const createCtx = this.isStandalone ? { unternehmenId: data.unternehmen_id } : this.ctx;
        const result = await PersonaService.create(data, createCtx);
        personaId = result.id;
      }

      await PersonaService.saveMarken(personaId, this.collectMarkenIds(data));
      // Erst Marken, dann Produkte: saveMarken macht Delete-all und wuerde
      // die beim Produkt-Attach auto-angehaengten Marken sonst wegwischen.
      await ProduktPersonaService.saveForPersona(personaId, this.produktPanel?.getProduktIds() || []);

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
    if (this.isStandalone) {
      const werte = data.marke_ids;
      if (Array.isArray(werte)) return werte;
      return werte ? [werte] : [];
    }
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
      (el.closest('.form-field') || el.parentNode).appendChild(error);
    }
  }

  destroy() {
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* noop */ }
      this._abort = null;
    }
    this.produktPanel?.destroy?.();
    this.produktPanel = null;
  }
}

export const personaForm = new PersonaForm();
