// ShareListDrawer.js
// Zugänge für eine Liste anlegen (Link + 6-stelliger Code), als Side-Drawer.
// Create/Rotate/Resend über Edge Function 'share-list'; Liste via RLS.

import { DRAWER_EXIT_MS } from '../animation/drawer.js';

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

  kannKampagneTeilen() {
    return this.entityType === 'skript' && Boolean(this.kampagneId);
  }

  skriptScope() {
    if (!this.kannKampagneTeilen()) return 'einzeln';
    const checked = this.panel?.querySelector('input[name="share-skript-scope"]:checked');
    return checked?.value === 'einzeln' ? 'einzeln' : 'kampagne';
  }

  skriptScopeField() {
    if (!this.kannKampagneTeilen()) return '';
    return `
      <div class="form-group">
        <span class="form-label">Umfang</span>
        <div class="share-scope-options">
          <label class="share-scope-option">
            <input type="radio" name="share-skript-scope" value="kampagne" checked>
            Alle Skripte dieser Kampagne
          </label>
          <label class="share-scope-option">
            <input type="radio" name="share-skript-scope" value="einzeln">
            Nur dieses Skript
          </label>
        </div>
      </div>
    `;
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
            <label class="form-label" for="share-rechte-select">Rechte</label>
            <select id="share-rechte-select" class="input">
              ${this.rechteOptions().map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
          </div>
          ${this.skriptScopeField()}
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
          </div>
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
    this.bindEmailTags();
  }

  bindEmailTags() {
    const input = this.panel.querySelector('#share-email-tag-input');
    const suggestions = this.panel.querySelector('#share-email-suggestions');
    const tagsEl = this.panel.querySelector('#share-email-tags');
    if (!input || !suggestions || !tagsEl) return;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        this.commitEmailInput(input, { warn: true });
      } else if (e.key === 'Backspace' && !input.value && this.emails.length) {
        this.emails.pop();
        this.renderEmailTags();
      } else if (e.key === 'Escape' && suggestions.style.display !== 'none') {
        // Erst die Vorschläge schließen, der Drawer bleibt offen
        e.stopPropagation();
        this.hideEmailSuggestions();
      }
    });

    input.addEventListener('input', () => {
      if (input.value.includes(',')) {
        const parts = input.value.split(',');
        const rest = parts.pop();
        parts.forEach((part) => this.addEmail(part.trim(), { warn: false }));
        input.value = rest;
      }
      this.schedulePartnerSearch(input.value.trim());
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        this.commitEmailInput(input, { warn: false });
        this.hideEmailSuggestions();
      }, 150);
    });

    suggestions.addEventListener('mousedown', (e) => e.preventDefault());
    suggestions.addEventListener('click', (e) => {
      const item = e.target.closest('.suggestion-item');
      if (!item?.dataset.email) return;
      this.addEmail(item.dataset.email);
      input.value = '';
      this.hideEmailSuggestions();
    });

    tagsEl.addEventListener('click', (e) => {
      const remove = e.target.closest('.tag-remove');
      if (!remove) return;
      this.emails = this.emails.filter((email) => email !== remove.dataset.email);
      this.renderEmailTags();
    });
  }

  commitEmailInput(input, { warn } = {}) {
    if (!input) return;
    const raw = (input.value || '').trim().replace(/,$/, '');
    if (!raw) return;
    if (this.addEmail(raw, { warn })) {
      input.value = '';
      this.hideEmailSuggestions();
    }
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
  }

  addEmail(raw, { warn } = {}) {
    const email = String(raw || '').trim().toLowerCase();
    if (!email) return false;
    if (!this.isValidEmail(email)) {
      if (warn) window.toastSystem?.warning('Ungültige E-Mail-Adresse.');
      return false;
    }
    if (!this.emails.includes(email)) this.emails.push(email);
    this.renderEmailTags();
    return true;
  }

  renderEmailTags() {
    const el = this.panel?.querySelector('#share-email-tags');
    if (!el) return;
    el.innerHTML = this.emails.map((email) => `
      <span class="tag-item" data-email="${this.escape(email)}">
        ${this.escape(email)}
        <span class="tag-remove" data-email="${this.escape(email)}">&times;</span>
      </span>
    `).join('');
  }

  hideEmailSuggestions() {
    this._emailSearchGen += 1;
    const suggestions = this.panel?.querySelector('#share-email-suggestions');
    if (!suggestions) return;
    suggestions.style.display = 'none';
    suggestions.innerHTML = '';
  }

  schedulePartnerSearch(term) {
    clearTimeout(this._emailSearchTimer);
    if (!term) {
      this.hideEmailSuggestions();
      return;
    }
    this._emailSearchTimer = setTimeout(() => this.searchPartners(term), 200);
  }

  async searchPartners(term) {
    const suggestions = this.panel?.querySelector('#share-email-suggestions');
    if (!suggestions || !window.supabase) return;
    const safe = term.replace(/[,()%]/g, '').slice(0, 80);
    if (!safe) {
      this.hideEmailSuggestions();
      return;
    }
    const tagged = new Set(this.emails);
    const gen = ++this._emailSearchGen;
    const { data } = await window.supabase
      .from('ansprechpartner')
      .select('id, vorname, nachname, email, unternehmen:unternehmen_id(firmenname)')
      .or(`vorname.ilike.%${safe}%,nachname.ilike.%${safe}%,email.ilike.%${safe}%`)
      .order('nachname');
    if (gen !== this._emailSearchGen || !this.panel) return;
    const rows = (data || []).filter((ap) => {
      const email = String(ap.email || '').trim().toLowerCase();
      return email && this.isValidEmail(email) && !tagged.has(email);
    });
    if (rows.length === 0) {
      suggestions.innerHTML = '<div class="suggestion-hint">Keine Vorschläge</div>';
      suggestions.style.display = 'block';
      return;
    }
    suggestions.innerHTML = rows.slice(0, 8).map((ap) => {
      const name = `${ap.vorname || ''} ${ap.nachname || ''}`.trim();
      const firma = ap.unternehmen?.firmenname || '';
      const email = String(ap.email).trim();
      const meta = [email, firma].filter(Boolean).join(' · ');
      return `<div class="suggestion-item" data-email="${this.escape(email)}">
        ${this.escape(name || email)}
        ${meta ? `<span class="suggestion-item-meta">${this.escape(meta)}</span>` : ''}
      </div>`;
    }).join('');
    suggestions.style.display = 'block';
  }

  async submit() {
    const labelInput = this.panel?.querySelector('#share-label-input');
    const rechteSelect = this.panel?.querySelector('#share-rechte-select');
    const emailInput = this.panel?.querySelector('#share-email-tag-input');
    const btn = this.panel?.querySelector('#share-submit-btn');
    this.commitEmailInput(emailInput, { warn: false });

    const label = (labelInput?.value || '').trim();
    if (!label) {
      window.toastSystem?.warning('Bitte einen Namen für den Zugang vergeben.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Wird erstellt …';

    try {
      const { data, error } = await window.supabase.functions.invoke('share-list', {
        body: {
          action: 'create',
          entityType: this.entityType,
          entityId: this.entityId,
          label,
          rechte: rechteSelect?.value || 'ansehen',
          endsWithKampagne: true,
          emails: [...this.emails],
          ...(this.entityType === 'skript' ? { skriptScope: this.skriptScope() } : {}),
        },
      });

      const errMsg = data?.error || (error ? (await this.readFunctionError(error)) : null);
      if (errMsg && !data?.shareId) {
        window.toastSystem?.error(errMsg || 'Teilen fehlgeschlagen.');
        return;
      }

      if (data?.shareId && data?.code) this.codes[data.shareId] = data.code;
      this.showCreatedBanner(data?.link, data?.code);
      if (errMsg) {
        window.toastSystem?.warning(errMsg);
      } else {
        window.toastSystem?.success(data?.mailed ? 'Zugang angelegt, Mail versendet.' : 'Zugang angelegt.');
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
    const banner = this.panel?.querySelector('#share-created-banner');
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
        <button type="button" class="share-inline-btn" data-copy="${this.escape(link)}">Link kopieren</button>
      </div>` : ''}
    `;
    banner.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => this.copy(btn.dataset.copy, btn));
    });
    banner.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  async siblingSkriptIds() {
    if (!this.kannKampagneTeilen()) return null;
    const { data, error } = await window.supabase
      .from('skripte')
      .select('id')
      .eq('kampagne_id', this.kampagneId);
    if (error) return null;
    const ids = (data || []).map((row) => row.id).filter(Boolean);
    if (!ids.includes(this.entityId)) ids.push(this.entityId);
    return ids;
  }

  async loadShares() {
    const container = this.panel?.querySelector('#share-recipients');
    if (!container) return;

    const siblingIds = await this.siblingSkriptIds();
    let query = window.supabase
      .from('list_shares')
      .select('id, token, label, rechte, entity_id, skript_scope, created_at, last_access_at, expires_at, ends_with_kampagne, share_participants(id, name, last_seen_at)')
      .eq('entity_type', this.entityType)
      .is('revoked_at', null);
    query = siblingIds
      ? query.in('entity_id', siblingIds)
      : query.eq('entity_id', this.entityId);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      container.className = '';
      container.innerHTML = '<p class="share-dialog-empty">Fehler beim Laden.</p>';
      return;
    }
    const rows = (data || []).filter((share) => (
      !siblingIds || share.entity_id === this.entityId || share.skript_scope === 'kampagne'
    ));
    if (rows.length === 0) {
      container.className = '';
      container.innerHTML = '<p class="share-dialog-empty">Noch keine Zugänge.</p>';
      return;
    }

    const origin = window.location.origin;
    container.className = 'share-access-list';
    container.innerHTML = rows.map((share) => {
      const lastAccess = share.last_access_at
        ? `zuletzt ${new Date(share.last_access_at).toLocaleDateString('de-DE')}`
        : 'noch nicht geöffnet';
      const expiry = share.expires_at
        ? `bis ${new Date(share.expires_at).toLocaleDateString('de-DE')}`
        : (share.ends_with_kampagne ? 'endet mit Kampagne' : 'ohne Ablauf');
      const scopeText = share.skript_scope === 'kampagne' ? ' · alle Skripte' : '';
      const participants = (share.share_participants || [])
        .map((p) => p.name)
        .filter(Boolean);
      const link = `${origin}/share/${share.token}`;
      const freshCode = this.codes[share.id];
      return `
        <div class="share-recipient-row share-access-row" data-share-id="${share.id}">
          <div class="share-recipient-info">
            <span class="share-recipient-email">${this.escape(share.label || 'Zugang')}</span>
            <span class="share-recipient-meta">${lastAccess} · ${expiry}${scopeText}${participants.length ? ` · ${this.escape(participants.join(', '))}` : ''}</span>
            ${freshCode ? `<span class="share-fresh-code">Code: ${this.escape(freshCode)}</span>` : ''}
          </div>
          <div class="share-recipient-actions">
            <select class="share-recipient-rechte" data-share-id="${share.id}" title="Rechte ändern">
              ${this.rechteOptions().map(([value, label]) => `<option value="${value}" ${share.rechte === value ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
            <button type="button" class="share-recipient-revoke" data-copy="${this.escape(link)}">Link</button>
            <button type="button" class="share-recipient-revoke" data-rotate="${share.id}">Code erneuern</button>
            <button type="button" class="share-recipient-revoke" data-mail="${share.id}">Mail</button>
            <button type="button" class="share-recipient-revoke" data-share-id="${share.id}" data-revoke>Widerrufen</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-revoke]').forEach((btn) => {
      btn.addEventListener('click', () => this.revoke(btn.dataset.shareId));
    });
    container.querySelectorAll('.share-recipient-rechte').forEach((select) => {
      select.addEventListener('change', () => this.updateRechte(select.dataset.shareId, select.value));
    });
    container.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => this.copy(btn.dataset.copy, btn));
    });
    container.querySelectorAll('[data-rotate]').forEach((btn) => {
      btn.addEventListener('click', () => this.rotate(btn.dataset.rotate));
    });
    container.querySelectorAll('[data-mail]').forEach((btn) => {
      btn.addEventListener('click', () => this.resend(btn.dataset.mail));
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
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: { action: 'resend', shareId, emails: [...this.emails], code },
    });
    const errMsg = data?.error || (error ? (await this.readFunctionError(error)) : null);
    if (errMsg) {
      window.toastSystem?.error(errMsg);
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

export const shareListDrawer = new ShareListDrawer();

if (typeof window !== 'undefined') {
  window.shareListDrawer = shareListDrawer;
}
