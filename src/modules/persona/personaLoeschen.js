// personaLoeschen.js
// Loeschen-Button und Bestaetigung auf der Persona-Seite.

import { PersonaService } from './PersonaService.js';
import { icon } from '../../core/icons/IconSystem.js';

export function injectPersonaDeleteButton(form, { onClick, signal }) {
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
  const opts = signal ? { signal } : undefined;
  btn.addEventListener('click', onClick, opts);
  actions.insertBefore(btn, actions.firstChild);
}

export async function loeschePersona({ persona, personaId, zurueck }) {
  const res = await window.confirmationModal?.open({
    title: 'Persona löschen?',
    message: `"${PersonaService.label(persona)}" wird endgültig gelöscht. Eine Zielgruppen-DNA dieser Persona wird mit entfernt, Skripte bleiben erhalten.`,
    confirmText: 'Löschen',
    cancelText: 'Abbrechen',
    danger: true
  });
  if (!res?.confirmed) return;

  try {
    await PersonaService.remove(personaId);
    window.toastSystem?.success?.('Persona gelöscht');
    zurueck?.();
  } catch (err) {
    console.error('Persona loeschen fehlgeschlagen:', err);
    window.toastSystem?.error?.('Fehler beim Löschen: ' + err.message);
  }
}
