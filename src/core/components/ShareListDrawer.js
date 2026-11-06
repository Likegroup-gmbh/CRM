// ShareListDrawer.js
// Zugänge für eine Liste anlegen (Link + 6-stelliger Code), als Side-Drawer.
// Create/Rotate/Resend über Edge Function 'share-list'; Liste via RLS.

import { DRAWER_EXIT_MS } from '../animation/drawer.js';
import { renderTableSelect } from './TableSelect.js';
import { installShareListEmailField } from './shareListEmailField.js';
import { installShareListAccessList } from './shareListAccessList.js';
import { accountListUrl } from '../../modules/share/shareRecipientPlan.js';

const DRAWER_ID = 'share-list-drawer';

export class ShareListDrawer {
  constructor() {
    this.overlay = null;
    this.panel = null;
    this._abort = null;
    this.entityType = null;
    this.entityId = null;
    this.entityName = '';
    this.kampagneId = null;
    this.codes = {};
    this.emails = [];
    this.plan = { listLink: [], guest: [], blocked: [] };
    this._emailSearchTimer = null;
    this._emailSearchGen = 0;
  }

  open({ entityType, entityId, entityName = '', kampagneId = null }) {
    if (!window.isInternal?.()) return;
    this.entityType = entityType;
    this.entityId = entityId;
    this.entityName = entityName;
    this.kampagneId = kampagneId || null;
    this.codes = {};
    this.emails = [];
    this.plan = { listLink: [], guest: [], blocked: [] };
    this.render();
    this.loadShares();
  }

  close() {
    clearTimeout(this._emailSearchTimer);
    this._abort?.abort();
    this._abort = null;
    const { panel, overlay } = this;
    this.panel = null;
    this.overlay = null;
    if (!panel && !overlay) return;
    panel?.classList.remove('show');
    setTimeout(() => {
      overlay?.remove();
      panel?.remove();
    }, DRAWER_EXIT_MS);
  }

  entferneAlt() {
    document.getElementById(`${DRAWER_ID}-overlay`)?.remove();
    document.getElementById(DRAWER_ID)?.remove();
  }

  rechteOptions() {
    return this.entityType === 'skript'
      ? [['ansehen', 'Nur ansehen'], ['feedback', 'Ansehen + Bearbeiten']]
      : [['ansehen', 'Nur ansehen'], ['feedback', 'Ansehen + Feedback']];
  }

  skriptScope() {
    return 'einzeln';
  }

  rechteFeld() {
    return renderTableSelect({
      field: 'share-rechte',
      itemId: 'share',
      value: 'ansehen',
      options: this.rechteOptions().map(([value, label]) => ({ value, label })),
      input: 'rechte',
      matchWidth: true
    });
  }

  render() {
    clearTimeout(this._emailSearchTimer);
    this.entferneAlt();
    this._abort?.abort();
    this._abort = new AbortController();
    const { signal } = this._abort;

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${DRAWER_ID}-overlay`;

    const panel = document.createElement('div');
    panel.className = 'drawer-panel share-list-drawer';
    panel.id = DRAWER_ID;
    panel.setAttribute('role', 'dialog');
    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">${this.entityType === 'skript' ? 'Skript teilen' : 'Liste teilen'}</span>
          ${this.entityName ? `<p class="drawer-subtitle">${this.escape(this.entityName)}</p>` : ''}
        </div>
        <button type="button" class="drawer-close-btn" data-action="close" aria-label="Schließen">&times;</button>
      </div>
      <div class="drawer-body">
        <section class="share-drawer-abschnitt">
          <div class="form-group">
            <label class="form-label required" for="share-label-input">Name des Zugangs</label>
            <input type="text" id="share-label-input" class="input" placeholder="z. B. Marketing-Team" maxlength="80">
          </div>
          <div class="form-group">
            <label class="form-label">Rechte</label>
            ${this.rechteFeld()}
          </div>
        </section>

        <section class="share-drawer-abschnitt">
          <h4 class="drawer-section-title">Per E-Mail senden (optional)</h4>
          <div class="form-group">
            <label class="form-label" for="share-email-tag-input">E-Mail-Adressen</label>
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
          <button type="button" class="mdc-btn mdc-btn--secondary" id="share-copy-list-link">Listen-Link kopieren</button>
        </section>

        <div id="share-created-banner" class="share-code-banner" hidden></div>

        <section class="share-drawer-abschnitt">
          <h4 class="drawer-section-title">Zugänge</h4>
          <div id="share-recipients" class="share-dialog-empty">Wird geladen …</div>
        </section>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-action="close">Schließen</button>
        <button type="button" id="share-submit-btn" class="mdc-btn mdc-btn--create">Zugang erstellen</button>
      </div>`;

    const rechteInput = panel.querySelector('[data-field="share-rechte"] [data-table-select-input]');
    if (rechteInput) rechteInput.id = 'share-rechte-select';

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    this.overlay = overlay;
    this.panel = panel;
    requestAnimationFrame(() => panel.classList.add('show'));

    overlay.addEventListener('click', () => this.close(), { signal });
    panel.querySelectorAll('[data-action="close"]').forEach((btn) =>
      btn.addEventListener('click', () => this.close(), { signal }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    }, { signal });
    panel.querySelector('#share-submit-btn').addEventListener('click', () => this.submit(), { signal });
    panel.querySelector('#share-copy-list-link')?.addEventListener('click', (e) => {
      const url = accountListUrl(this.entityType, this.entityId, window.location.origin);
      if (url) this.copy(url, e.currentTarget);
    }, { signal });
    this.bindEmailTags();
  }

  async submit() {
    const labelInput = this.panel?.querySelector('#share-label-input');
    const rechteSelect = this.panel?.querySelector('#share-rechte-select');
    const emailInput = this.panel?.querySelector('#share-email-tag-input');
    const btn = this.panel?.querySelector('#share-submit-btn');
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
      window.toastSystem?.warning('Keine Mail. Zuerst Unternehmen oder Marke zuordnen.');
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
            ...(this.entityType === 'skript' ? { skriptScope: this.skriptScope() } : {}),
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
        window.toastSystem?.warning('Einige Adressen haben keine Zuordnung und bekommen keine Mail.');
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

  async siblingSkriptIds() {
    if (this.entityType !== 'skript' || !this.kampagneId) return null;
    const { data, error } = await window.supabase
      .from('skripte')
      .select('id')
      .eq('kampagne_id', this.kampagneId);
    if (error) return null;
    const ids = (data || []).map((row) => row.id).filter(Boolean);
    if (!ids.includes(this.entityId)) ids.push(this.entityId);
    return ids;
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

installShareListEmailField(ShareListDrawer.prototype);
installShareListAccessList(ShareListDrawer.prototype);

export const shareListDrawer = new ShareListDrawer();

if (typeof window !== 'undefined') {
  window.shareListDrawer = shareListDrawer;
}
