// ShareListDialog.js
// Zugänge für eine Liste anlegen (Link + 6-stelliger Code).
// Create/Rotate/Resend über Edge Function 'share-list'; Liste via RLS.

import { renderTableSelect } from './TableSelect.js';
import { installShareListEmailField } from './shareListEmailField.js';
import { installShareListAccessList } from './shareListAccessList.js';
import { accountListUrl } from '../../modules/share/shareRecipientPlan.js';

export class ShareListDialog {
  constructor() {
    this.overlay = null;
    this.entityType = null;
    this.entityId = null;
    this.entityName = '';
    this.codes = {};
    this.emails = [];
    this.plan = { listLink: [], guest: [], blocked: [] };
    this._emailSearchTimer = null;
    this._emailSearchGen = 0;
    this._onRechte = null;
  }

  open({ entityType, entityId, entityName = '' }) {
    if (!window.isInternal?.()) return;
    this.entityType = entityType;
    this.entityId = entityId;
    this.entityName = entityName;
    this.codes = {};
    this.emails = [];
    this.plan = { listLink: [], guest: [], blocked: [] };
    this.render();
    this.loadShares();
  }

  close() {
    clearTimeout(this._emailSearchTimer);
    if (this._onRechte) {
      document.removeEventListener('table-select-change', this._onRechte);
      this._onRechte = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  rechteOptions() {
    return this.entityType === 'skript'
      ? [['ansehen', 'Nur ansehen'], ['feedback', 'Ansehen + Bearbeiten']]
      : [['ansehen', 'Nur ansehen'], ['feedback', 'Ansehen + Feedback']];
  }

  render() {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'modal overlay-modal share-list-modal';
    overlay.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>${this.entityType === 'skript' ? 'Skript teilen' : 'Liste teilen'}</h3>
          <button type="button" class="modal-close" data-action="close" aria-label="Schließen">&times;</button>
        </div>
        <div class="modal-body">
          ${this.entityName ? `<p class="modal-description">Erstelle einen Zugang für: <strong>${this.escape(this.entityName)}</strong></p>` : ''}
          <div class="share-dialog-form">
            <div class="form-group">
              <label class="form-label required" for="share-label-input">Name des Zugangs</label>
              <input type="text" id="share-label-input" class="input" placeholder="z. B. Marketing-Team" maxlength="80">
            </div>
            <div class="form-group">
              <label class="form-label">Rechte</label>
              <input type="hidden" id="share-rechte-select" value="ansehen">
              ${renderTableSelect({
                field: 'share-rechte',
                itemId: 'neu',
                value: 'ansehen',
                options: this.rechteOptions().map(([value, label]) => ({ value, label }))
              })}
            </div>
            <div class="form-group">
              <label class="form-label" for="share-email-tag-input">Per E-Mail versenden (optional)</label>
              <div class="tag-input-container" id="share-email-tag-container">
                <div class="tag-input-wrapper">
                  <div class="selected-tags" id="share-email-tags"></div>
                  <input type="text" class="tag-input" id="share-email-tag-input"
                         placeholder="E-Mail eingeben …" autocomplete="off">
                </div>
                <div class="tag-suggestions" id="share-email-suggestions" style="display:none;"></div>
              </div>
              <div id="share-recipient-plan" class="share-recipient-plan"></div>
            </div>
            <div class="form-group">
              <button type="button" class="mdc-btn mdc-btn--secondary" id="share-copy-list-link">Listen-Link kopieren</button>
            </div>
          </div>
          <div id="share-created-banner" class="share-code-banner" hidden></div>
          <div class="share-dialog-list">
            <h4 class="nutzungsrechte-section-title">Zugänge</h4>
            <div id="share-recipients" class="share-dialog-empty">Wird geladen …</div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="mdc-btn mdc-btn--secondary" data-action="cancel">Abbrechen</button>
          <button type="button" id="share-submit-btn" class="mdc-btn mdc-btn--create">Zugang erstellen</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
    overlay.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => this.close());
    overlay.querySelector('#share-submit-btn').addEventListener('click', () => this.submit());
    overlay.querySelector('#share-copy-list-link')?.addEventListener('click', (e) => {
      const url = accountListUrl(this.entityType, this.entityId, window.location.origin);
      if (url) this.copy(url, e.currentTarget);
    });
    this._onRechte = (e) => this.onRechtePick(e);
    document.addEventListener('table-select-change', this._onRechte);
    this.bindEmailTags();
  }

  onRechtePick(e) {
    const { field, value, element, itemId } = e.detail || {};
    if (!this.overlay?.contains(element)) return;
    element.dataset.value = value;
    const label = this.rechteOptions().find(([v]) => v === value)?.[1];
    const labelEl = element.querySelector('.table-select__label');
    if (labelEl && label) labelEl.textContent = label;
    if (field === 'share-rechte') {
      const hidden = this.overlay.querySelector('#share-rechte-select');
      if (hidden) hidden.value = value;
    }
    if (field === 'share-row-rechte') this.updateRechte(itemId, value);
  }

  async submit() {
    const labelInput = this.overlay?.querySelector('#share-label-input');
    const rechteSelect = this.overlay?.querySelector('#share-rechte-select');
    const emailInput = this.overlay?.querySelector('#share-email-tag-input');
    const btn = this.overlay?.querySelector('#share-submit-btn');
    this.commitEmailInput(emailInput, { warn: false });

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
      window.toastSystem?.warning(plan.blocked[0]?.reason === 'paket'
        ? 'Eine bereits registrierte Ansprechperson kann diese Auswahl nicht per Mail bekommen.'
        : 'Keine Mail. Zuerst Unternehmen oder Marke zuordnen.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Wird erstellt …';

    try {
      let data = null;
      let error = null;
      if (createsShare) {
        const created = await window.supabase.functions.invoke('share-list', {
          body: {
            action: 'create',
            entityType: this.entityType,
            entityId: this.entityId,
            label,
            rechte: rechteSelect?.value || 'ansehen',
            endsWithKampagne: true,
            emails: guestEmails,
          },
        });
        data = created.data;
        error = created.error;
      }
      const account = await this.sendAccountLinks(plan?.listLink || []);

      const errMsg = data?.error || (error ? (await this.readFunctionError(error)) : null);
      if (errMsg && !data?.shareId) {
        window.toastSystem?.error(errMsg || 'Teilen fehlgeschlagen.');
        return;
      }

      if (data?.shareId && data?.code) this.codes[data.shareId] = data.code;
      this.showCreatedBanner(data?.link, data?.code);
      if (errMsg) {
        window.toastSystem?.warning(errMsg);
      } else if (account.unsupported) {
        window.toastSystem?.warning('Listen-Link konnte nicht gesendet werden. Bitte „Listen-Link kopieren“ verwenden.');
      } else if (data?.shareId && plan?.listLink?.length) {
        window.toastSystem?.success('Gast-Zugang angelegt, Listen-Link versendet.');
      } else if (data?.shareId) {
        window.toastSystem?.success(data?.mailed ? 'Zugang angelegt, Mail versendet.' : 'Zugang angelegt.');
      } else if (plan?.listLink?.length) {
        window.toastSystem?.success('Listen-Link versendet.');
      }
      if (plan?.blocked?.length && !errMsg) {
        window.toastSystem?.warning(plan.blocked.some((row) => row.reason === 'scope')
          ? 'Einige Adressen haben keine Zuordnung und bekommen keine Mail.'
          : 'Einige Adressen bekommen keine Mail.');
      }
      if (labelInput) labelInput.value = '';
      if (emailInput) emailInput.value = '';
      this.emails = [];
      this.renderEmailTags();
      this.loadShares();
    } catch (err) {
      console.error('Share fehlgeschlagen:', err);
      window.toastSystem?.error('Teilen fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Zugang erstellen';
    }
  }

  showCreatedBanner(link, code) {
    const banner = this.overlay?.querySelector('#share-created-banner');
    if (!banner || !code) return;
    banner.hidden = false;
    banner.innerHTML = `
      <div class="share-code-banner-title">Zugang angelegt — Code nur jetzt im Klartext</div>
      <div class="share-code-banner-row">
        <span class="share-code-value">${this.escape(code)}</span>
        <button type="button" class="share-inline-btn" data-copy="${this.escape(code)}">Code kopieren</button>
      </div>
      ${link ? `<div class="share-code-banner-row">
        <span class="share-link-value">${this.escape(link)}</span>
        <button type="button" class="share-inline-btn" data-copy="${this.escape(link)}">Gast-Link kopieren</button>
      </div>` : ''}
    `;
    banner.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => this.copy(btn.dataset.copy, btn));
    });
  }

  async rotate(shareId) {
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: { action: 'rotate_code', shareId },
    });
    const errMsg = data?.error || (error ? (await this.readFunctionError(error)) : null);
    if (errMsg || !data?.code) {
      window.toastSystem?.error(errMsg || 'Code konnte nicht erneuert werden.');
      return;
    }
    this.codes[shareId] = data.code;
    window.toastSystem?.success(`Neuer Code: ${data.code}`);
    this.showCreatedBanner(null, data.code);
    this.loadShares();
  }

  async resend(shareId) {
    const code = this.codes[shareId];
    if (!code) {
      window.toastSystem?.warning('Bitte zuerst den Code erneuern — der alte Code ist nicht mehr lesbar.');
      return;
    }
    if (this.emails.length === 0) {
      window.toastSystem?.warning('E-Mail als Tag eingeben');
      return;
    }
    const plan = await this.refreshPlan();
    if (!plan) {
      window.toastSystem?.error('Empfänger konnten nicht geprüft werden.');
      return;
    }
    let errMsg = null;
    if (plan.guest.length) {
      const { data, error } = await window.supabase.functions.invoke('share-list', {
        body: { action: 'resend', shareId, emails: plan.guest, code },
      });
      errMsg = data?.error || (error ? (await this.readFunctionError(error)) : null);
    }
    const account = await this.sendAccountLinks(plan.listLink);
    if (errMsg) {
      window.toastSystem?.error(errMsg);
      return;
    }
    if (account.unsupported) {
      window.toastSystem?.warning('Listen-Link konnte nicht gesendet werden. Bitte „Listen-Link kopieren“ verwenden.');
      return;
    }
    if (!account.ok) {
      window.toastSystem?.error(account.error || 'Listen-Link konnte nicht gesendet werden.');
      return;
    }
    if (!plan.guest.length && !plan.listLink.length) {
      window.toastSystem?.warning('Keine Mail. Zuerst Unternehmen oder Marke zuordnen.');
      return;
    }
    window.toastSystem?.success('Einladung versendet.');
  }

  async revoke(shareId) {
    const { error } = await window.supabase
      .from('list_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', shareId);

    if (error) {
      window.toastSystem?.error('Widerruf fehlgeschlagen.');
      return;
    }
    delete this.codes[shareId];
    window.toastSystem?.success('Zugang widerrufen.');
    this.loadShares();
  }

  async updateRechte(shareId, rechte) {
    const { error } = await window.supabase
      .from('list_shares')
      .update({ rechte })
      .eq('id', shareId);

    if (error) {
      window.toastSystem?.error('Rechte-Änderung fehlgeschlagen.');
      this.loadShares();
      return;
    }
    window.toastSystem?.success('Rechte aktualisiert.');
  }

  async copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      const prev = btn.textContent;
      btn.textContent = 'Kopiert';
      setTimeout(() => { btn.textContent = prev; }, 1200);
    } catch {
      window.toastSystem?.warning('Kopieren fehlgeschlagen.');
    }
  }

  async readFunctionError(error) {
    try {
      if (error?.context && typeof error.context.json === 'function') {
        const body = await error.context.json();
        return body?.error || null;
      }
    } catch { /* ignore */ }
    return null;
  }

  escape(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

installShareListEmailField(ShareListDialog.prototype);
installShareListAccessList(ShareListDialog.prototype);

export const shareListDialog = new ShareListDialog();

if (typeof window !== 'undefined') {
  window.shareListDialog = shareListDialog;
}
