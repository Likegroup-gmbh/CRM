// ShareListDialog.js
// Zugänge für eine Liste anlegen (Link + 6-stelliger Code).
// Create/Rotate/Resend über Edge Function 'share-list'; Liste via RLS.

export class ShareListDialog {
  constructor() {
    this.overlay = null;
    this.entityType = null;
    this.entityId = null;
    this.entityName = '';
    this.codes = {};
    this.emails = [];
    this._emailSearchTimer = null;
    this._emailSearchGen = 0;
  }

  open({ entityType, entityId, entityName = '' }) {
    if (!window.isInternal?.()) return;
    this.entityType = entityType;
    this.entityId = entityId;
    this.entityName = entityName;
    this.codes = {};
    this.emails = [];
    this.render();
    this.loadShares();
  }

  close() {
    clearTimeout(this._emailSearchTimer);
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  render() {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'modal overlay-modal share-list-modal';
    overlay.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Liste teilen</h3>
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
              <label class="form-label" for="share-rechte-select">Rechte</label>
              <select id="share-rechte-select" class="input">
                <option value="ansehen">Nur ansehen</option>
                <option value="feedback">Ansehen + Feedback</option>
              </select>
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
    this.bindEmailTags();
  }

  bindEmailTags() {
    const input = this.overlay.querySelector('#share-email-tag-input');
    const suggestions = this.overlay.querySelector('#share-email-suggestions');
    const tagsEl = this.overlay.querySelector('#share-email-tags');
    if (!input || !suggestions || !tagsEl) return;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        this.commitEmailInput(input, { warn: true });
      } else if (e.key === 'Backspace' && !input.value && this.emails.length) {
        this.emails.pop();
        this.renderEmailTags();
      } else if (e.key === 'Escape') {
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
    const el = this.overlay?.querySelector('#share-email-tags');
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
    const suggestions = this.overlay?.querySelector('#share-email-suggestions');
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
    const suggestions = this.overlay?.querySelector('#share-email-suggestions');
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
    if (gen !== this._emailSearchGen || !this.overlay) return;
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
    const labelInput = this.overlay?.querySelector('#share-label-input');
    const rechteSelect = this.overlay?.querySelector('#share-rechte-select');
    const emailInput = this.overlay?.querySelector('#share-email-tag-input');
    const btn = this.overlay?.querySelector('#share-submit-btn');
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
        <button type="button" class="share-inline-btn" data-copy="${this.escape(link)}">Link kopieren</button>
      </div>` : ''}
    `;
    banner.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => this.copy(btn.dataset.copy, btn));
    });
  }

  async loadShares() {
    const container = this.overlay?.querySelector('#share-recipients');
    if (!container) return;

    const { data, error } = await window.supabase
      .from('list_shares')
      .select('id, token, label, rechte, created_at, last_access_at, expires_at, ends_with_kampagne, share_participants(id, name, last_seen_at)')
      .eq('entity_type', this.entityType)
      .eq('entity_id', this.entityId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      container.className = '';
      container.innerHTML = '<p class="share-dialog-empty">Fehler beim Laden.</p>';
      return;
    }
    if (!data || data.length === 0) {
      container.className = '';
      container.innerHTML = '<p class="share-dialog-empty">Noch keine Zugänge.</p>';
      return;
    }

    const origin = window.location.origin;
    container.className = 'share-access-list';
    container.innerHTML = data.map((share) => {
      const lastAccess = share.last_access_at
        ? `zuletzt ${new Date(share.last_access_at).toLocaleDateString('de-DE')}`
        : 'noch nicht geöffnet';
      const expiry = share.expires_at
        ? `bis ${new Date(share.expires_at).toLocaleDateString('de-DE')}`
        : (share.ends_with_kampagne ? 'endet mit Kampagne' : 'ohne Ablauf');
      const participants = (share.share_participants || [])
        .map((p) => p.name)
        .filter(Boolean);
      const link = `${origin}/share/${share.token}`;
      const freshCode = this.codes[share.id];
      return `
        <div class="share-recipient-row share-access-row" data-share-id="${share.id}">
          <div class="share-recipient-info">
            <span class="share-recipient-email">${this.escape(share.label || 'Zugang')}</span>
            <span class="share-recipient-meta">${lastAccess} · ${expiry}${participants.length ? ` · ${this.escape(participants.join(', '))}` : ''}</span>
            ${freshCode ? `<span class="share-fresh-code">Code: ${this.escape(freshCode)}</span>` : ''}
          </div>
          <div class="share-recipient-actions">
            <select class="share-recipient-rechte" data-share-id="${share.id}" title="Rechte ändern">
              <option value="ansehen" ${share.rechte === 'ansehen' ? 'selected' : ''}>Nur ansehen</option>
              <option value="feedback" ${share.rechte === 'feedback' ? 'selected' : ''}>Ansehen + Feedback</option>
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

export const shareListDialog = new ShareListDialog();

if (typeof window !== 'undefined') {
  window.shareListDialog = shareListDialog;
}
