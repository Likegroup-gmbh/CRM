// Zugang für mehrere freigegebene Skripte eines Creators in einer Kampagne.
// Ein Link, ein Code. Rechte und Creator nutzen das Tabellen-Dropdown.

import { skripteService } from './SkripteService.js';
import {
  paketAuswahl, creatorOptionen, creatorAnzeigeName
} from './skriptPaketModel.js';
import { BLOCKED_TEXT } from '../share/shareRecipientPlan.js';
import { RECHTE, installSkriptPaketDialogView } from './skriptPaketDialogView.js';

export class SkriptPaketDialog {
  constructor() {
    this.overlay = null;
    this.kampagneId = null;
    this.kampagneName = '';
    this.creatorId = null;
    this.skripte = [];
    this.checked = new Set();
    this.paket = null;
    this.share = null;
    this.emails = [];
    this.codes = {};
    this.nameTouched = false;
    this.emailsTouched = false;
    this._onPick = null;
    this._emailSearchTimer = null;
    this._emailSearchGen = 0;
  }

  async open({ kampagneId, kampagneName = '', creatorId = null } = {}) {
    if (!window.isInternal?.()) return;
    if (!kampagneId) {
      window.toastSystem?.warning('Teilen gibt es nur für Skripte mit Kampagne.');
      return;
    }
    this.close();
    this.kampagneId = kampagneId;
    this.kampagneName = kampagneName;
    this.creatorId = creatorId;
    this.skripte = [];
    this.checked = new Set();
    this.paket = null;
    this.share = null;
    this.emails = [];
    this.nameTouched = false;
    this.emailsTouched = false;
    this.renderShell();
    try {
      this.skripte = await skripteService.loadKampagneSkripteMitCreator(kampagneId);
      await this.applyCreator(this.creatorId, { initial: true });
    } catch (err) {
      window.toastSystem?.error(err.message || 'Skripte konnten nicht geladen werden.');
      this.close();
    }
  }

  close() {
    clearTimeout(this._emailSearchTimer);
    if (this._onPick) {
      document.removeEventListener('table-select-change', this._onPick);
      this._onPick = null;
    }
    this.overlay?.remove();
    this.overlay = null;
  }

  renderShell() {
    const overlay = document.createElement('div');
    overlay.className = 'modal overlay-modal share-list-modal skript-paket-modal';
    overlay.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Skripte teilen</h3>
          <button type="button" class="modal-close" data-action="close" aria-label="Schließen">&times;</button>
        </div>
        <div class="modal-body" id="skript-paket-body">
          <p class="modal-description">Freigegebene Skripte werden geladen …</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="mdc-btn mdc-btn--secondary" data-action="cancel">Abbrechen</button>
          <button type="button" id="skript-paket-submit" class="mdc-btn mdc-btn--create">Teilen</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    this.overlay = overlay;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
    overlay.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => this.close());
    overlay.querySelector('#skript-paket-submit').addEventListener('click', () => this.submit());

    this._onPick = (e) => this.onPick(e);
    document.addEventListener('table-select-change', this._onPick);
  }

  async applyCreator(creatorId, { initial = false } = {}) {
    this.creatorId = creatorId || null;
    if (this.creatorId) {
      const stand = await skripteService.loadSkriptPaket(this.kampagneId, this.creatorId);
      this.paket = stand.paket;
      this.share = stand.share;
      const auswahl = paketAuswahl({
        skripte: this.skripte,
        creatorId: this.creatorId,
        gespeichertIds: stand.skriptIds,
        hatZugang: Boolean(stand.share)
      });
      this.checked = new Set(auswahl.checkedIds);
      if (initial || !this.emailsTouched) {
        const gespeichert = stand.share?.empfaenger_emails || [];
        if (gespeichert.length) this.emails = [...gespeichert];
        else {
          const mail = this.currentCreator()?.mail;
          this.emails = mail ? [String(mail).trim().toLowerCase()] : [];
        }
      }
    } else {
      this.paket = null;
      this.share = null;
      this.checked = new Set();
      if (!this.emailsTouched) this.emails = [];
    }
    this.renderForm();
  }

  currentCreator() {
    return this.skripte.find((s) => s.creatorId === this.creatorId)?.creator
      || creatorOptionen(this.skripte).find((c) => c.id === this.creatorId)
      || null;
  }

  onPick(e) {
    const { field, value, element } = e.detail || {};
    if (!this.overlay?.contains(element)) return;
    element.dataset.value = value;
    const labelEl = element.querySelector('.table-select__label');
    if (field === 'paket-creator') {
      const creator = creatorOptionen(this.skripte).find((c) => c.id === value);
      if (labelEl && creator) labelEl.textContent = creatorAnzeigeName(creator);
      this.nameTouched = false;
      this.emailsTouched = false;
      this.applyCreator(value);
    }
    if (field === 'paket-rechte') {
      const option = RECHTE.find((o) => o.value === value);
      if (labelEl && option) labelEl.textContent = option.label;
    }
  }

  checkedIds() {
    return [...this.checked];
  }

  titelDerAuswahl() {
    const ids = new Set(this.checkedIds());
    return this.skripte.filter((s) => ids.has(s.id)).map((s) => s.titel);
  }

  async submit() {
    const name = (this.overlay.querySelector('#skript-paket-name')?.value || '').trim();
    const rechte = this.overlay.querySelector('[data-field="paket-rechte"]')?.dataset.value || 'ansehen';
    const emailInput = this.overlay.querySelector('#skript-paket-email');
    if (emailInput?.value) this.addEmail(emailInput.value, { warn: false });
    if (!this.creatorId) {
      window.toastSystem?.warning('Bitte einen Creator wählen.');
      return;
    }
    if (!name) {
      window.toastSystem?.warning('Bitte einen Namen für den Zugang vergeben.');
      return;
    }
    const ids = this.checkedIds();
    const btn = this.overlay.querySelector('#skript-paket-submit');
    btn.disabled = true;
    try {
      if (!ids.length) {
        if (this.share) {
          await this.revoke({ still: true });
          this.renderForm();
        } else window.toastSystem?.warning('Wähle mindestens ein Skript.');
        return;
      }
      const paket = await skripteService.ensureSkriptPaket(this.kampagneId, this.creatorId);
      this.paket = paket;
      await skripteService.setPaketSkripte(paket.id, ids);
      const plan = await this.planRecipients(paket.id);
      if (this.emails.length && !plan) return;
      const guestEmails = plan?.guest || [];
      if (!this.share) {
        if (this.emails.length && guestEmails.length === 0) {
          window.toastSystem?.warning(BLOCKED_TEXT.paket);
          this.renderForm();
          return;
        }
        const { data, error } = await window.supabase.functions.invoke('share-list', {
          body: {
            action: 'create',
            entityType: 'skript_paket',
            entityId: paket.id,
            label: name,
            rechte,
            emails: guestEmails,
            endsWithKampagne: true,
            scriptTitles: this.titelDerAuswahl()
          }
        });
        const errMsg = data?.error || (error ? 'Zugang konnte nicht angelegt werden.' : null);
        if (errMsg && !data?.shareId) throw new Error(errMsg);
        this.share = { id: data.shareId, token: String(data.link || '').split('/').pop(), label: name, rechte, empfaenger_emails: [...this.emails] };
        this.codes[data.shareId] = data.code;
        window.toastSystem?.success(this.emails.length ? 'Zugang angelegt und Mail verschickt.' : 'Zugang angelegt.');
      } else {
        const { data, error } = await window.supabase.functions.invoke('share-list', {
          body: {
            action: 'update',
            shareId: this.share.id,
            label: name,
            rechte,
            emails: guestEmails
          }
        });
        if (error || data?.error) throw new Error(data?.error || 'Speichern fehlgeschlagen.');
        this.share = { ...this.share, label: name, rechte, empfaenger_emails: [...this.emails] };
        window.toastSystem?.success('Auswahl gespeichert.');
      }
      this.renderForm();
    } catch (err) {
      window.toastSystem?.error(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      if (this.overlay) btn.disabled = false;
    }
  }

  async rotate() {
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: { action: 'rotate_code', shareId: this.share.id }
    });
    if (error || data?.error || !data?.code) {
      window.toastSystem?.error(data?.error || 'Code konnte nicht erneuert werden.');
      return;
    }
    this.codes[this.share.id] = data.code;
    window.toastSystem?.success(`Neuer Code: ${data.code}`);
    this.renderForm();
  }

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
    const plan = await this.planRecipients(this.paket?.id);
    if (!plan) return;
    if (!plan.guest.length) {
      window.toastSystem?.warning(BLOCKED_TEXT.paket);
      return;
    }
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: {
        action: 'resend',
        shareId: this.share.id,
        emails: plan.guest,
        code,
        scriptTitles: this.titelDerAuswahl()
      }
    });
    if (error || data?.error) {
      window.toastSystem?.error(data?.error || 'Mail fehlgeschlagen.');
      return;
    }
    window.toastSystem?.success('Einladung versendet.');
  }

  async revoke({ still = false } = {}) {
    await skripteService.setPaketSkripte(this.paket.id, []);
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: { action: 'revoke', shareId: this.share.id }
    });
    if (error || data?.error) {
      window.toastSystem?.error(data?.error || 'Widerruf fehlgeschlagen.');
      return;
    }
    this.share = null;
    this.checked = new Set();
    window.toastSystem?.success('Zugang widerrufen.');
    if (!still) this.renderForm();
  }
}

installSkriptPaketDialogView(SkriptPaketDialog.prototype);

export const skriptPaketDialog = new SkriptPaketDialog();
