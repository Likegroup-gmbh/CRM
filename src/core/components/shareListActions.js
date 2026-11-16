// Aktionen im Teilen-Drawer: anlegen, Code erneuern, erneut senden, widerrufen, Rechte ändern.
// Alles läuft über shareApi (Edge Function share-list), nichts schreibt direkt in list_shares.

import { shareApi } from '../../modules/share/shareApi.js';

const KEINE_ZUORDNUNG = 'Keine Mail. Zuerst Unternehmen oder Marke zuordnen.';

function erfolgsText(created, plan) {
  if (created && plan?.listLink?.length) return 'Gast-Zugang angelegt, Listen-Link versendet.';
  if (created) return created.mailed ? 'Zugang angelegt, Mail versendet.' : 'Zugang angelegt.';
  if (plan?.listLink?.length) return 'Listen-Link versendet.';
  return null;
}

export function installShareListActions(proto) {
  Object.assign(proto, {
    async submit() {
      const labelInput = this.panel?.querySelector('#share-label-input');
      const rechteSelect = this.panel?.querySelector('#share-rechte-select');
      const btn = this.panel?.querySelector('#share-submit-btn');
      this.emailField?.commit({ warn: false });

      const label = (labelInput?.value || '').trim();
      const plan = await this.refreshPlan();
      if (this.emails.length && !plan) {
        window.toastSystem?.error('Empfänger konnten nicht geprüft werden.');
        return;
      }
      const guestEmails = plan?.guest || [];
      const createsShare = this.emails.length === 0 || guestEmails.length > 0;
      if (createsShare && !label) {
        window.toastSystem?.warning('Bitte einen Namen für den Zugang vergeben.');
        return;
      }
      if (this.emails.length && guestEmails.length === 0 && !plan.listLink.length) {
        window.toastSystem?.warning(KEINE_ZUORDNUNG);
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Wird erstellt …';
      try {
        const created = createsShare
          ? await shareApi.create({
            entityType: this.entityType,
            entityId: this.entityId,
            label,
            rechte: rechteSelect?.value || 'ansehen',
            emails: guestEmails,
          })
          : null;
        // Ohne shareId gibt es keinen Zugang. Mit shareId (auch bei 502) bleibt der Code sichtbar.
        if (created && !created.shareId) {
          window.toastSystem?.error(created.fehler || 'Teilen fehlgeschlagen.');
          return;
        }
        const account = await this.sendAccountLinks(plan?.listLink || []);

        if (created?.code) this.codes[created.shareId] = created.code;
        this.showCreatedBanner(created?.link, created?.code);
        const fehler = created?.fehler || account.error;
        const erfolg = erfolgsText(created, plan);
        if (fehler) window.toastSystem?.warning(fehler);
        else if (erfolg) window.toastSystem?.success(erfolg);
        if (plan?.blocked?.length && !fehler) {
          window.toastSystem?.warning('Einige Adressen haben keine Zuordnung und bekommen keine Mail.');
        }
        if (labelInput) labelInput.value = '';
        this.setEmails([]);
        this.loadShares();
      } catch (err) {
        console.error('Share fehlgeschlagen:', err);
        window.toastSystem?.error('Teilen fehlgeschlagen. Bitte erneut versuchen.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Zugang erstellen';
      }
    },

    async rotate(shareId) {
      const res = await shareApi.rotateCode(shareId);
      if (!res.ok || !res.code) {
        window.toastSystem?.error(res.fehler || 'Code konnte nicht erneuert werden.');
        return;
      }
      this.codes[shareId] = res.code;
      window.toastSystem?.success(`Neuer Code: ${res.code}`);
      this.showCreatedBanner(null, res.code);
      this.loadShares();
    },

    /** Der Server teilt die Tags selbst auf: Gäste bekommen Link und Code, Kundenkonten den Listen-Link. */
    async resend(shareId) {
      const code = this.codes[shareId];
      if (!code) {
        window.toastSystem?.warning('Bitte zuerst den Code erneuern — der alte Code ist nicht mehr lesbar.');
        return;
      }
      this.emailField?.commit({ warn: false });
      if (this.emails.length === 0) {
        window.toastSystem?.warning('E-Mail als Tag eingeben');
        return;
      }
      const res = await shareApi.resend(shareId, { emails: this.emails, code });
      if (!res.ok) {
        window.toastSystem?.error(res.fehler || 'Mail fehlgeschlagen.');
        return;
      }
      if (res.plan && !res.plan.guest?.length && !res.plan.listLink?.length) {
        window.toastSystem?.warning(KEINE_ZUORDNUNG);
        return;
      }
      window.toastSystem?.success('Einladung versendet.');
    },

    async revoke(shareId) {
      const res = await shareApi.revoke(shareId);
      if (!res.ok) {
        window.toastSystem?.error(res.fehler || 'Widerruf fehlgeschlagen.');
        return;
      }
      delete this.codes[shareId];
      window.toastSystem?.success('Zugang widerrufen.');
      this.loadShares();
    },

    async updateRechte(shareId, rechte) {
      const res = await shareApi.update(shareId, { rechte });
      if (!res.ok) {
        window.toastSystem?.error(res.fehler || 'Rechte-Änderung fehlgeschlagen.');
        this.loadShares();
        return;
      }
      window.toastSystem?.success('Rechte aktualisiert.');
    },
  });
}
