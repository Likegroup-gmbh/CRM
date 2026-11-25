// Zugang des Skript-Pakets: anlegen, speichern, neue Adressen einladen, Code rotieren,
// erneut senden, widerrufen. Alles über shareApi; Fehlertexte kommen vom Server.

import { shareApi } from '../share/shareApi.js';
import { setPaketSkripte } from './skriptPaketApi.js';
import { renderPaketForm } from './skriptPaketDrawerView.js';

const NUR_GAST = 'Die Auswahl gibt es nur als Gast-Zugang.';

export function installSkriptPaketShareActions(proto) {
  Object.assign(proto, {
    async pruefeEmpfaenger(entityId) {
      const plan = await shareApi.plan({ emails: this.emails, entityType: 'skript_paket', entityId });
      if (!plan) throw new Error('Empfänger konnten nicht geprüft werden.');
      return plan;
    },

    async createShare(paketId, name, rechte) {
      const plan = await this.pruefeEmpfaenger(paketId);
      if (this.emails.length && !plan.guest.length) {
        window.toastSystem?.warning('Für diese Adressen gibt es keinen Gast-Zugang. Die Auswahl kann nur an Personen ohne Kundenkonto gehen.');
        return;
      }
      const res = await shareApi.create({
        entityType: 'skript_paket',
        entityId: paketId,
        label: name,
        rechte,
        emails: plan.guest,
        scriptTitles: this.titelDerAuswahl()
      });
      if (!res.shareId) throw new Error(res.fehler || 'Zugang konnte nicht angelegt werden.');
      this.share = {
        id: res.shareId,
        token: String(res.link || '').split('/').pop(),
        label: name,
        rechte,
        empfaenger_emails: [...plan.guest]
      };
      this.emails = [...plan.guest];
      this.codes[res.shareId] = res.code;
      if (res.fehler) window.toastSystem?.warning(res.fehler);
      else window.toastSystem?.success(plan.guest.length ? 'Zugang angelegt und Mail verschickt.' : 'Zugang angelegt.');
      if (plan.blocked.length) {
        window.toastSystem?.warning(`Adressen mit Kundenkonto wurden nicht angeschrieben. ${NUR_GAST}`);
      }
    },

    async updateShare(name, rechte) {
      const vorher = new Set(this.share.empfaenger_emails || []);
      const plan = await this.pruefeEmpfaenger(this.paket?.id || this.share.entity_id);
      const res = await shareApi.update(this.share.id, { label: name, rechte, emails: plan.guest });
      if (!res.ok) throw new Error(res.fehler || 'Speichern fehlgeschlagen.');
      this.emails = [...plan.guest];
      this.share = { ...this.share, label: name, rechte, empfaenger_emails: [...plan.guest] };
      const neu = plan.guest.filter((email) => !vorher.has(email));
      if (neu.length) await this.ladeNeueEin(neu, plan.guest);
      else window.toastSystem?.success('Auswahl gespeichert.');
      if (plan.blocked.length) {
        window.toastSystem?.warning(`Adressen mit Kundenkonto bleiben ohne Mail. ${NUR_GAST}`);
      }
    },

    /** Neue Adressen am bestehenden Zugang. Der Code liegt nur gehasht vor, ohne ihn geht keine Einladung raus. */
    async ladeNeueEin(neu, alle) {
      let code = this.codes[this.share.id];
      let an = neu;
      if (!code) {
        const wer = neu.length === 1 ? 'Eine neue Adresse' : `${neu.length} neue Adressen`;
        const ok = window.confirm(`${wer} einladen?\nDafür wird der Code erneuert. Alle ${alle.length} Empfänger bekommen eine Mail mit dem neuen Code.`);
        if (!ok) {
          window.toastSystem?.success('Auswahl gespeichert. Neue Adressen haben noch keine Mail.');
          return;
        }
        code = await this.rotateCode();
        if (!code) return;
        an = alle;
      }
      if (await this.sendInvite(an, code)) {
        window.toastSystem?.success(an.length === 1 ? 'Gespeichert und Einladung versendet.' : `Gespeichert und ${an.length} Einladungen versendet.`);
      }
    },

    async rotateCode() {
      const res = await shareApi.rotateCode(this.share.id);
      if (!res.ok || !res.code) {
        window.toastSystem?.error(res.fehler || 'Code konnte nicht erneuert werden.');
        return null;
      }
      this.codes[this.share.id] = res.code;
      return res.code;
    },

    async rotate() {
      const code = await this.rotateCode();
      if (!code) return;
      window.toastSystem?.success(`Neuer Code: ${code}`);
      renderPaketForm(this);
    },

    async sendInvite(emails, code) {
      const res = await shareApi.resend(this.share.id, { emails, code, scriptTitles: this.titelDerAuswahl() });
      if (!res.ok) {
        window.toastSystem?.error(res.fehler || 'Mail fehlgeschlagen.');
        return false;
      }
      return true;
    },

    async resend() {
      const code = this.codes[this.share.id];
      if (!code) {
        window.toastSystem?.warning('Bitte zuerst den Code rotieren. Der bisherige Code ist nicht mehr lesbar.');
        return;
      }
      if (!this.emails.length) {
        window.toastSystem?.warning('Keine E-Mail-Adresse hinterlegt.');
        return;
      }
      const plan = await shareApi.plan({
        emails: this.emails,
        entityType: 'skript_paket',
        entityId: this.paket?.id || this.share.entity_id
      });
      if (!plan?.guest.length) {
        window.toastSystem?.warning('Für diese Adressen gibt es keinen Gast-Zugang.');
        return;
      }
      if (await this.sendInvite(plan.guest, code)) window.toastSystem?.success('Einladung versendet.');
    },

    async revoke({ still = false } = {}) {
      if (this.paket) await setPaketSkripte(this.paket.id, []);
      const res = await shareApi.revoke(this.share.id);
      if (!res.ok) {
        window.toastSystem?.error(res.fehler || 'Widerruf fehlgeschlagen.');
        return;
      }
      this.share = null;
      this.checked = new Set();
      window.toastSystem?.success('Zugang widerrufen.');
      if (!still) renderPaketForm(this);
    },
  });
}
