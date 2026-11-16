// Empfänger im Teilen-Drawer: gemeinsames Mail-Feld, Vorschau der Aufteilung, Listen-Link-Versand.

import { mountShareEmailField } from './shareEmailField.js';
import { shareApi } from '../../modules/share/shareApi.js';
import { renderRecipientPlan } from '../../modules/share/shareRecipientPlan.js';

const LEERER_PLAN = { listLink: [], guest: [], blocked: [] };

export function installShareListEmailField(proto) {
  Object.assign(proto, {
    mountEmailField() {
      const container = this.panel?.querySelector('#share-email-field');
      if (!container) return;
      this.emailField = mountShareEmailField(container, {
        emails: this.emails,
        idPrefix: 'share-email',
        inputId: 'share-email-tag-input',
        placeholder: 'E-Mail eingeben …',
        onChange: (emails) => {
          this.emails = emails;
          this.refreshPlan();
        },
      });
    },

    setEmails(emails) {
      this.emails = [...emails];
      this.emailField?.setEmails(this.emails);
      this.refreshPlan();
    },

    /** Aktuelle Aufteilung vom Server; null, wenn sie nicht geprüft werden konnte. */
    async refreshPlan() {
      const anfrage = ++this._planGen;
      const plan = this.emails.length
        ? await shareApi.plan({ emails: this.emails, entityType: this.entityType, entityId: this.entityId })
        : { ...LEERER_PLAN };
      if (anfrage === this._planGen) {
        this.plan = plan;
        renderRecipientPlan(this.panel?.querySelector('#share-recipient-plan'), plan);
      }
      return plan;
    },

    async sendAccountLinks(emails) {
      const res = await shareApi.sendAccountLinks({ entityType: this.entityType, entityId: this.entityId, emails });
      return { ok: res.ok, error: res.fehler };
    },
  });
}
