// Aktionen im Teilen-Drawer: anlegen, Code erneuern, nachsenden, widerrufen, Rechte ändern.
// Alles läuft über shareApi (Edge Function share-list), nichts schreibt direkt in list_shares.

import { shareApi } from '../../modules/share/shareApi.js';
import { standardZugangsName } from '../../modules/share/shareZugangsName.js';
import { confirmationModal } from '../ConfirmationModal.js';
import { escapeHtml } from '../format.js';
import { einladungsText } from './shareListAccessRow.js';

const KEINE_ZUORDNUNG = 'Keine Mail. Zuerst Unternehmen oder Marke zuordnen.';

function erfolgsText(created, plan, kopiert) {
  if (kopiert) return 'Zugang angelegt, Link und Code kopiert.';
  if (created && plan?.listLink?.length) return 'Gast-Zugang angelegt, Listen-Link versendet.';
  if (created) return created.mailed ? 'Zugang angelegt, Mail versendet.' : 'Zugang angelegt.';
  if (plan?.listLink?.length) return 'Listen-Link versendet.';
  return null;
}

function tokenAusLink(link) {
  return String(link || '').split('/share/')[1] || '';
}

export function installShareListActions(proto) {
  Object.assign(proto, {
    async submit() {
      if (this._sending) return;
      const labelInput = this.panel?.querySelector('#share-label-input');
      const rechteInput = this.panel?.querySelector('#share-rechte-select');
      const btn = this.panel?.querySelector('#share-submit-btn');
      this.emailField?.commit({ warn: false });

      const plan = await this.refreshPlan();
      if (this.emails.length && !plan) {
        window.toastSystem?.error('Empfänger konnten nicht geprüft werden.');
        return;
      }
      const guestEmails = plan?.guest || [];
      const createsShare = this.emails.length === 0 || guestEmails.length > 0;
      if (this.emails.length && guestEmails.length === 0 && !plan.listLink.length) {
        window.toastSystem?.warning(KEINE_ZUORDNUNG);
        return;
      }
      const label = (labelInput?.value || '').trim() || standardZugangsName(guestEmails);
      const rechte = rechteInput?.value || 'ansehen';
      const mitMail = this.emails.length > 0;

      this._sending = true;
      btn.disabled = true;
      btn.textContent = createsShare ? 'Wird erstellt …' : 'Wird gesendet …';
      try {
        const created = createsShare
          ? await shareApi.create({
            entityType: this.entityType,
            entityId: this.entityId,
            label,
            rechte,
            emails: guestEmails,
          })
          : null;
        // Ohne shareId gibt es keinen Zugang. Mit shareId (auch bei 502) bleibt der Code sichtbar.
        if (created && !created.shareId) {
          window.toastSystem?.error(created.fehler || 'Teilen fehlgeschlagen.');
          return;
        }
        const account = await this.sendAccountLinks(plan?.listLink || []);

        if (created?.code) this.merkeAngelegt(created, { label, rechte });
        const kopiert = Boolean(created?.code && created.link && !mitMail)
          && await this.copyQuiet(einladungsText({ entityName: this.entityName, link: created.link, code: created.code }));
        const fehler = created?.fehler || account.error;
        const erfolg = erfolgsText(created, plan, kopiert);
        if (fehler) window.toastSystem?.warning(fehler);
        else if (erfolg) window.toastSystem?.success(erfolg);
        if (plan?.blocked?.length && !fehler) {
          window.toastSystem?.warning('Einige Adressen haben keine Zuordnung und bekommen keine Mail.');
        }
        if (labelInput) labelInput.value = '';
        this.setEmails([]);
        await this.loadShares();
      } catch (err) {
        console.error('Share fehlgeschlagen:', err);
        window.toastSystem?.error('Teilen fehlgeschlagen. Bitte erneut versuchen.');
      } finally {
        this._sending = false;
        btn.disabled = false;
        this.updateSubmitLabel();
      }
    },

    /** Neuer Zugang samt Code, bis die Liste ihn selbst liefert. */
    merkeAngelegt(created, { label, rechte }) {
      this.codes[created.shareId] = created.code;
      this.frischId = created.shareId;
      const token = tokenAusLink(created.link);
      if (!token) return;
      this.angelegt[created.shareId] = {
        id: created.shareId,
        token,
        label,
        rechte,
        created_at: new Date().toISOString(),
        last_access_at: null,
        expires_at: null,
        ends_with_kampagne: true,
        share_participants: [],
      };
    },

    async rotate(shareId, { leise = false } = {}) {
      const res = await shareApi.rotateCode(shareId);
      if (!res.ok || !res.code) {
        window.toastSystem?.error(res.fehler || 'Code konnte nicht erneuert werden.');
        return null;
      }
      this.codes[shareId] = res.code;
      this.refreshRowCode(shareId);
      if (!leise) window.toastSystem?.success('Neuer Code erzeugt. Der alte gilt nicht mehr für neue Logins.');
      return res.code;
    },

    /**
     * Nachsenden an einen bestehenden Zugang. Der alte Code liegt nur gehasht vor:
     * Sind Gäste dabei und ist kein frischer Code bekannt, wird vorher rotiert.
     * Kundenkonten bekommen den Listen-Link und brauchen keinen Code.
     */
    async resend(shareId, emails = []) {
      if (!emails.length) {
        window.toastSystem?.warning('E-Mail als Tag eingeben');
        return false;
      }
      let code = this.codes[shareId] || '';
      if (!code) {
        const plan = await shareApi.plan({ emails, entityType: this.entityType, entityId: this.entityId });
        if (!plan) {
          window.toastSystem?.error('Empfänger konnten nicht geprüft werden.');
          return false;
        }
        if (!plan.guest.length && !plan.listLink.length) {
          window.toastSystem?.warning(KEINE_ZUORDNUNG);
          return false;
        }
        if (plan.guest.length) {
          code = await this.rotate(shareId, { leise: true });
          if (!code) return false;
        }
      }
      const res = await shareApi.resend(shareId, { emails, code });
      if (!res.ok) {
        window.toastSystem?.error(res.fehler || 'Mail fehlgeschlagen.');
        return false;
      }
      if (res.plan && !res.plan.guest?.length && !res.plan.listLink?.length) {
        window.toastSystem?.warning(KEINE_ZUORDNUNG);
        return false;
      }
      window.toastSystem?.success('Einladung versendet.');
      return true;
    },

    async confirmRevoke(shareId) {
      const share = this.shares.find((s) => s.id === shareId);
      const { confirmed } = await confirmationModal.open({
        title: 'Zugang widerrufen',
        message: `„${escapeHtml(share?.label || 'Zugang')}“ verliert sofort den Zugriff. Link und Code funktionieren danach nicht mehr.`,
        confirmText: 'Widerrufen',
      });
      if (confirmed) await this.revoke(shareId);
    },

    async revoke(shareId) {
      const res = await shareApi.revoke(shareId);
      if (!res.ok) {
        window.toastSystem?.error(res.fehler || 'Widerruf fehlgeschlagen.');
        return;
      }
      delete this.codes[shareId];
      delete this.angelegt[shareId];
      window.toastSystem?.success('Zugang widerrufen.');
      await this.loadShares();
    },

    async updateRechte(shareId, rechte) {
      const res = await shareApi.update(shareId, { rechte });
      if (!res.ok) {
        window.toastSystem?.error(res.fehler || 'Rechte-Änderung fehlgeschlagen.');
        this.loadShares();
        return;
      }
      const share = this.shares.find((s) => s.id === shareId);
      if (share) share.rechte = rechte;
      window.toastSystem?.success('Rechte aktualisiert.');
    },
  });
}
