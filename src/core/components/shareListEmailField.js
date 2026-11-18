// Empfänger im Teilen-Drawer: gemeinsames Mail-Feld, Vorschau der Aufteilung, Listen-Link-Versand.
// Name, Rechte und Beschriftung der Hauptaktion folgen den Empfängern.

import { mountShareEmailField } from './shareEmailField.js';
import { shareApi } from '../../modules/share/shareApi.js';
import { renderRecipientPlanGrouped } from '../../modules/share/shareRecipientPlan.js';
import { standardZugangsName } from '../../modules/share/shareZugangsName.js';

const LEERER_PLAN = { listLink: [], guest: [], blocked: [] };

function planAdressen(plan) {
  return new Set([...plan.listLink, ...plan.guest, ...plan.blocked.map((row) => row.email)]);
}

export function installShareListEmailField(proto) {
  Object.assign(proto, {
    mountEmailField() {
      const container = this.panel?.querySelector('#share-email-field');
      if (!container) return;
      this.emailField = mountShareEmailField(container, {
        emails: this.emails,
        idPrefix: 'share-email',
        inputId: 'share-email-tag-input',
        placeholder: 'Name oder E-Mail …',
        onChange: (emails) => {
          this.emails = emails;
          this.updateForm();
          this.refreshPlan();
        },
      });
      this.updateForm();
    },

    setEmails(emails) {
      this.emails = [...emails];
      this.emailField?.setEmails(this.emails);
      this.updateForm();
      this.refreshPlan();
    },

    /** Der Plan gehört zu genau den aktuell eingetragenen Adressen. */
    planPasst() {
      const adressen = planAdressen(this.plan);
      return adressen.size === this.emails.length && this.emails.every((email) => adressen.has(email));
    },

    nurKonten() {
      return this.emails.length > 0 && this.planPasst()
        && this.plan.guest.length === 0 && this.plan.listLink.length > 0;
    },

    standardName() {
      return standardZugangsName(this.planPasst() ? this.plan.guest : this.emails);
    },

    /** Überschreibt nur ein leeres Feld oder den eigenen letzten Vorschlag, nie Eingetipptes. */
    syncName() {
      const input = this.panel?.querySelector('#share-label-input');
      if (!input || (input.value.trim() && input.value !== this.autoName)) return;
      this.autoName = this.standardName();
      input.value = this.autoName;
    },

    updateSubmitLabel() {
      const btn = this.panel?.querySelector('#share-submit-btn');
      if (!btn || this._sending) return;
      const passt = this.planPasst();
      const anzahl = passt ? this.plan.guest.length + this.plan.listLink.length : this.emails.length;
      const gesperrt = this.emails.length > 0 && passt && anzahl === 0;
      btn.disabled = gesperrt;
      btn.title = gesperrt ? 'Keine der Adressen kann eine Mail bekommen.' : '';
      if (!this.emails.length) btn.textContent = 'Zugang erstellen';
      else if (gesperrt) btn.textContent = 'Keine Mail möglich';
      else if (this.nurKonten()) btn.textContent = 'Listen-Link senden';
      else btn.textContent = `An ${anzahl} Empfänger senden`;
    },

    updateForm() {
      const nurKonten = this.nurKonten();
      const optionen = this.panel?.querySelector('#share-gast-optionen');
      const hinweis = this.panel?.querySelector('#share-nur-konten');
      if (optionen) optionen.hidden = nurKonten;
      if (hinweis) hinweis.hidden = !nurKonten;
      this.syncName();
      this.updateSubmitLabel();
    },

    /** Aktuelle Aufteilung vom Server; null, wenn sie nicht geprüft werden konnte. */
    async refreshPlan() {
      const anfrage = ++this._planGen;
      const plan = this.emails.length
        ? await shareApi.plan({ emails: this.emails, entityType: this.entityType, entityId: this.entityId })
        : { ...LEERER_PLAN };
      if (anfrage === this._planGen) {
        this.plan = plan || { ...LEERER_PLAN };
        renderRecipientPlanGrouped(this.panel?.querySelector('#share-recipient-plan'), plan);
        this.updateForm();
      }
      return plan;
    },

    async sendAccountLinks(emails) {
      const res = await shareApi.sendAccountLinks({ entityType: this.entityType, entityId: this.entityId, emails });
      return { ok: res.ok, error: res.fehler };
    },
  });
}
