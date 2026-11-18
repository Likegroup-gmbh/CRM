// Mail-Feld direkt in einer Zugangszeile: an einen bestehenden Zugang nachsenden.
// Immer nur ein Feld offen; neu rendern der Liste schließt es.

import { mountShareEmailField } from './shareEmailField.js';

const ROTIER_HINWEIS = 'Für Gäste wird beim Senden ein neuer Code erzeugt. Der bisherige Code gilt dann nicht mehr für neue Logins.';

export function installShareListRowMail(proto) {
  Object.assign(proto, {
    openRowMail(shareId) {
      if (this.rowMail?.shareId === shareId) {
        this.rowMail.field.input.focus();
        return;
      }
      this.closeRowMail();
      const box = this.panel?.querySelector(`[data-row-mail="${shareId}"]`);
      if (!box) return;
      box.hidden = false;
      box.innerHTML = `
        <div data-row-mail-field></div>
        ${this.codes[shareId] ? '' : `<p class="share-plan-note">${ROTIER_HINWEIS}</p>`}
        <div class="share-row-mail-aktionen">
          <button type="button" class="share-inline-btn" data-row-mail-cancel>Abbrechen</button>
          <button type="button" class="mdc-btn mdc-btn--create mdc-btn--sm" data-row-mail-send>Senden</button>
        </div>`;
      const field = mountShareEmailField(box.querySelector('[data-row-mail-field]'), {
        idPrefix: `share-resend-${shareId}`,
        placeholder: 'Name oder E-Mail …',
      });
      this.rowMail = { shareId, field, box, sending: false };
      box.querySelector('[data-row-mail-send]').addEventListener('click', () => this.sendRowMail());
      box.querySelector('[data-row-mail-cancel]').addEventListener('click', () => this.closeRowMail());
      box.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      field.input.focus({ preventScroll: true });
    },

    closeRowMail() {
      if (!this.rowMail) return;
      const { field, box } = this.rowMail;
      this.rowMail = null;
      field.destroy();
      if (box.isConnected) {
        box.hidden = true;
        box.innerHTML = '';
      }
    },

    async sendRowMail() {
      const rowMail = this.rowMail;
      if (!rowMail || rowMail.sending) return;
      if (!rowMail.field.commit({ warn: true })) return;
      const emails = rowMail.field.emails;
      if (!emails.length) {
        window.toastSystem?.warning('Bitte mindestens eine E-Mail eintragen.');
        return;
      }
      const btn = rowMail.box.querySelector('[data-row-mail-send]');
      rowMail.sending = true;
      btn.disabled = true;
      btn.textContent = 'Wird gesendet …';
      const ok = await this.resend(rowMail.shareId, emails);
      if (ok) {
        if (this.rowMail === rowMail) this.closeRowMail();
        return;
      }
      if (this.codes[rowMail.shareId]) rowMail.box.querySelector('.share-plan-note')?.remove();
      rowMail.sending = false;
      btn.disabled = false;
      btn.textContent = 'Senden';
    },
  });
}
