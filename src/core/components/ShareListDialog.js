// ShareListDialog.js
// Modal zum Teilen einer Liste (Kampagne / Sourcing / Strategie) per E-Mail.
// Nur für Admin/Mitarbeiter. Versand + Gast-Anlage laufen über die
// Edge Function 'share-list'; Widerruf/Rechte direkt via RLS.

export class ShareListDialog {
  constructor() {
    this.overlay = null;
    this.entityType = null;
    this.entityId = null;
    this.entityName = '';
  }

  open({ entityType, entityId, entityName = '' }) {
    if (!window.isInternal?.()) return;
    this.entityType = entityType;
    this.entityId = entityId;
    this.entityName = entityName;
    this.render();
    this.loadShares();
  }

  close() {
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
        <div class="modal-header share-list-modal-header">
          <div class="drawer-header-left">
            <h3>Liste teilen${this.entityName ? ` – ${this.escape(this.entityName)}` : ''}</h3>
          </div>
          <button type="button" class="modal-close" data-action="close" aria-label="Schließen">&times;</button>
        </div>
        <div class="modal-body">
          <div class="share-dialog-form">
            <div class="share-dialog-form-row">
              <input type="email" id="share-email-input" class="input" placeholder="empfaenger@firma.de" autocomplete="off">
              <select id="share-rechte-select" class="input share-rechte-select">
                <option value="ansehen">Nur ansehen</option>
                <option value="feedback">Ansehen + Feedback</option>
              </select>
              <button id="share-submit-btn" class="primary-btn">Einladen</button>
            </div>
            <textarea id="share-message-input" class="input share-message-input" rows="3" maxlength="500"
                      placeholder="Nachricht (optional) …"></textarea>
          </div>
          <div class="share-dialog-list">
            <h4 class="nutzungsrechte-section-title">Bereits geteilt mit</h4>
            <div id="share-recipients" class="share-dialog-empty">Wird geladen …</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
    overlay.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
    overlay.querySelector('#share-submit-btn').addEventListener('click', () => this.submit());
    overlay.querySelector('#share-email-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submit();
    });
  }

  async submit() {
    const emailInput = this.overlay?.querySelector('#share-email-input');
    const rechteSelect = this.overlay?.querySelector('#share-rechte-select');
    const messageInput = this.overlay?.querySelector('#share-message-input');
    const btn = this.overlay?.querySelector('#share-submit-btn');
    const email = (emailInput?.value || '').trim();
    const message = (messageInput?.value || '').trim().slice(0, 500);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      window.toastSystem?.warning('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Wird gesendet …';

    try {
      const { error } = await window.supabase.functions.invoke('share-list', {
        body: {
          action: 'create',
          entityType: this.entityType,
          entityId: this.entityId,
          email,
          rechte: rechteSelect?.value || 'ansehen',
          ...(message ? { message } : {}),
        },
      });

      if (error) {
        const detail = await this.readFunctionError(error);
        window.toastSystem?.error(detail || 'Teilen fehlgeschlagen.');
        return;
      }

      window.toastSystem?.success(`Einladung an ${email} versendet.`);
      emailInput.value = '';
      if (messageInput) messageInput.value = '';
      this.loadShares();
    } catch (err) {
      console.error('Share fehlgeschlagen:', err);
      window.toastSystem?.error('Teilen fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Einladen';
    }
  }

  async loadShares() {
    const container = this.overlay?.querySelector('#share-recipients');
    if (!container) return;

    const { data, error } = await window.supabase
      .from('list_shares')
      .select('id, email, rechte, created_at, last_access_at, revoked_at, benutzer:gast_benutzer_id (name)')
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
      container.innerHTML = '<p class="share-dialog-empty">Noch mit niemandem geteilt.</p>';
      return;
    }

    container.className = '';
    container.innerHTML = data.map((share) => {
      const name = share.benutzer?.name;
      const initial = (name || share.email || '?').trim().charAt(0).toUpperCase();
      const lastAccess = share.last_access_at
        ? `zuletzt ${new Date(share.last_access_at).toLocaleDateString('de-DE')}`
        : 'noch nicht geöffnet';
      return `
        <div class="share-recipient-row" data-share-id="${share.id}">
          <div class="share-recipient-avatar">${this.escape(initial)}</div>
          <div class="share-recipient-info">
            <span class="share-recipient-email">${this.escape(share.email)}${name ? ` (${this.escape(name)})` : ''}</span>
            <span class="share-recipient-meta">${lastAccess}</span>
          </div>
          <div class="share-recipient-actions">
            <select class="share-recipient-rechte" data-share-id="${share.id}" title="Rechte ändern">
              <option value="ansehen" ${share.rechte === 'ansehen' ? 'selected' : ''}>Nur ansehen</option>
              <option value="feedback" ${share.rechte === 'feedback' ? 'selected' : ''}>Ansehen + Feedback</option>
            </select>
            <button type="button" class="share-recipient-revoke" data-share-id="${share.id}" title="Zugang widerrufen">Widerrufen</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.share-recipient-revoke').forEach((btn) => {
      btn.addEventListener('click', () => this.revoke(btn.dataset.shareId));
    });
    container.querySelectorAll('.share-recipient-rechte').forEach((select) => {
      select.addEventListener('change', () => this.updateRechte(select.dataset.shareId, select.value));
    });
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
