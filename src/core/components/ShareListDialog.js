// ShareListDialog.js
// Modal zum Teilen einer Liste (Kampagne / Sourcing / Strategie) per E-Mail.
// Nur für Admin/Mitarbeiter. Versand + Gast-Anlage laufen über die
// Edge Function 'share-list'; Widerruf/Rechte direkt via RLS.

const RECHTE_LABELS = { ansehen: 'Nur ansehen', feedback: 'Ansehen + Feedback' };

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
    overlay.className = 'modal-overlay share-dialog-overlay';
    overlay.innerHTML = `
      <div class="share-dialog">
        <div class="share-dialog-header">
          <h3>Liste teilen${this.entityName ? ` – ${this.escape(this.entityName)}` : ''}</h3>
          <button type="button" class="share-dialog-close" title="Schließen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20" height="20">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="share-dialog-body">
          <p class="share-dialog-hint">
            Der Empfänger erhält eine E-Mail mit einem Zugangslink — ohne Account,
            gesichert per E-Mail-Code. Der Zugang gilt bis zum Widerruf.
          </p>
          <div class="share-dialog-form">
            <input type="email" id="share-email-input" class="input" placeholder="empfaenger@firma.de" autocomplete="off">
            <select id="share-rechte-select" class="input share-rechte-select">
              <option value="ansehen">Nur ansehen</option>
              <option value="feedback">Ansehen + Feedback</option>
            </select>
            <button id="share-submit-btn" class="primary-btn">Teilen</button>
          </div>
          <p id="share-dialog-message" class="share-dialog-message" style="display:none;"></p>
          <div class="share-dialog-list">
            <h4>Bereits geteilt mit</h4>
            <div id="share-recipients">Wird geladen …</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
    overlay.querySelector('.share-dialog-close').addEventListener('click', () => this.close());
    overlay.querySelector('#share-submit-btn').addEventListener('click', () => this.submit());
    overlay.querySelector('#share-email-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submit();
    });
  }

  showMessage(text, type = 'info') {
    const el = this.overlay?.querySelector('#share-dialog-message');
    if (!el) return;
    el.textContent = text;
    el.className = `share-dialog-message share-dialog-message--${type}`;
    el.style.display = '';
  }

  async submit() {
    const emailInput = this.overlay?.querySelector('#share-email-input');
    const rechteSelect = this.overlay?.querySelector('#share-rechte-select');
    const btn = this.overlay?.querySelector('#share-submit-btn');
    const email = (emailInput?.value || '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.showMessage('Bitte eine gültige E-Mail-Adresse eingeben.', 'error');
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
        },
      });

      if (error) {
        const detail = await this.readFunctionError(error);
        this.showMessage(detail || 'Teilen fehlgeschlagen.', 'error');
        return;
      }

      this.showMessage(`Einladung an ${email} versendet.`, 'success');
      emailInput.value = '';
      this.loadShares();
    } catch (err) {
      console.error('Share fehlgeschlagen:', err);
      this.showMessage('Teilen fehlgeschlagen. Bitte erneut versuchen.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Teilen';
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
      container.innerHTML = '<p class="share-dialog-message share-dialog-message--error">Fehler beim Laden.</p>';
      return;
    }
    if (!data || data.length === 0) {
      container.innerHTML = '<p class="share-dialog-empty">Noch mit niemandem geteilt.</p>';
      return;
    }

    container.innerHTML = data.map((share) => {
      const name = share.benutzer?.name;
      const lastAccess = share.last_access_at
        ? `zuletzt ${new Date(share.last_access_at).toLocaleDateString('de-DE')}`
        : 'noch nicht geöffnet';
      return `
        <div class="share-recipient-row" data-share-id="${share.id}">
          <div class="share-recipient-info">
            <span class="share-recipient-email">${this.escape(share.email)}${name ? ` (${this.escape(name)})` : ''}</span>
            <span class="share-recipient-meta">${RECHTE_LABELS[share.rechte] || share.rechte} · ${lastAccess}</span>
          </div>
          <div class="share-recipient-actions">
            <select class="input share-recipient-rechte" data-share-id="${share.id}">
              <option value="ansehen" ${share.rechte === 'ansehen' ? 'selected' : ''}>Nur ansehen</option>
              <option value="feedback" ${share.rechte === 'feedback' ? 'selected' : ''}>Ansehen + Feedback</option>
            </select>
            <button type="button" class="secondary-btn share-recipient-revoke" data-share-id="${share.id}">Widerrufen</button>
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
      this.showMessage('Widerruf fehlgeschlagen.', 'error');
      return;
    }
    this.showMessage('Zugang widerrufen.', 'success');
    this.loadShares();
  }

  async updateRechte(shareId, rechte) {
    const { error } = await window.supabase
      .from('list_shares')
      .update({ rechte })
      .eq('id', shareId);

    if (error) {
      this.showMessage('Rechte-Änderung fehlgeschlagen.', 'error');
      this.loadShares();
      return;
    }
    this.showMessage('Rechte aktualisiert.', 'success');
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
