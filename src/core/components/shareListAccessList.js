// Bestehende Zugänge im Teilen-Drawer.

import { escapeHtml } from '../format.js';

export function installShareListAccessList(proto) {
  Object.assign(proto, {
    showCreatedBanner(link, code) {
      const banner = this.panel?.querySelector('#share-created-banner');
      if (!banner || !code) return;
      banner.hidden = false;
      banner.innerHTML = `
        <div class="share-code-banner-title">Zugang angelegt — Code nur jetzt im Klartext</div>
        <div class="share-code-banner-row">
          <span class="share-code-value">${escapeHtml(code)}</span>
          <button type="button" class="share-inline-btn" data-copy="${escapeHtml(code)}">Code kopieren</button>
        </div>
        ${link ? `<div class="share-code-banner-row">
          <span class="share-link-value">${escapeHtml(link)}</span>
          <button type="button" class="share-inline-btn" data-copy="${escapeHtml(link)}">Gast-Link kopieren</button>
        </div>` : ''}
      `;
      banner.querySelectorAll('[data-copy]').forEach((btn) => {
        btn.addEventListener('click', () => this.copy(btn.dataset.copy, btn));
      });
      banner.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    },

    async loadShares() {
      const container = this.panel?.querySelector('#share-recipients');
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
      const rows = data || [];
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
        const participants = (share.share_participants || [])
          .map((p) => p.name)
          .filter(Boolean);
        const link = `${origin}/share/${share.token}`;
        const freshCode = this.codes[share.id];
        return `
          <div class="share-recipient-row share-access-row" data-share-id="${share.id}">
            <div class="share-recipient-info">
              <span class="share-recipient-email">${escapeHtml(share.label || 'Zugang')}</span>
              <span class="share-recipient-meta">${lastAccess} · ${expiry}${participants.length ? ` · ${escapeHtml(participants.join(', '))}` : ''}</span>
              ${freshCode ? `<span class="share-fresh-code">Code: ${escapeHtml(freshCode)}</span>` : ''}
            </div>
            <div class="share-recipient-actions">
              <select class="share-recipient-rechte" data-share-id="${share.id}" title="Rechte ändern">
                ${this.rechteOptions().map(([value, label]) => `<option value="${value}" ${share.rechte === value ? 'selected' : ''}>${label}</option>`).join('')}
              </select>
              <button type="button" class="share-recipient-revoke" data-copy="${escapeHtml(link)}">Gast-Link</button>
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
    },
  });
}
