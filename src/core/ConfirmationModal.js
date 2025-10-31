// ConfirmationModal.js
// Zentrales, modales Bestätigungs-Dialogsystem für gefährliche Aktionen (Löschen, etc.)

export class ConfirmationModal {
  constructor() {
    this._open = false;
    this._currentModal = null;
  }

  open({ title = 'Löschen bestätigen', message = 'Sind Sie sicher?', confirmText = 'Löschen', cancelText = 'Abbrechen', danger = true } = {}) {
    // Schließe vorheriges Modal falls noch offen
    if (this._open && this._currentModal) {
      console.log('⚠️ ConfirmationModal: Schließe vorheriges Modal');
      this._currentModal.remove();
      this._open = false;
      this._currentModal = null;
    }
    
    this._open = true;

    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal overlay-modal';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" data-action="close">×</button>
          </div>
          <div class="modal-body">
            <p class="confirm-message">${message}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary-btn" data-action="cancel">${cancelText}</button>
            <button type="button" class="${danger ? 'danger-btn' : 'primary-btn'}" data-action="confirm">${confirmText}</button>
          </div>
        </div>`;

      document.body.appendChild(modal);
      this._currentModal = modal;

      const close = (result) => {
        if (!modal.parentNode) return;
        modal.remove();
        this._open = false;
        this._currentModal = null;
        resolve(result);
      };

      // Button Events
      modal.querySelector('[data-action="close"]').addEventListener('click', () => close({ confirmed: false }));
      modal.querySelector('[data-action="cancel"]').addEventListener('click', () => close({ confirmed: false }));
      modal.querySelector('[data-action="confirm"]').addEventListener('click', () => close({ confirmed: true }));

      // Klick außerhalb des Dialogs schließt (nur auf Overlay, nicht im Dialog)
      modal.addEventListener('click', (e) => {
        if (e.target === modal) close({ confirmed: false });
      });

      // Escape schließt
      const onKey = (ev) => { if (ev.key === 'Escape') { window.removeEventListener('keydown', onKey); close({ confirmed: false }); } };
      window.addEventListener('keydown', onKey);
    });
  }
}

export const confirmationModal = new ConfirmationModal();

// Globale Referenz
if (typeof window !== 'undefined') {
  window.confirmationModal = confirmationModal;
}


