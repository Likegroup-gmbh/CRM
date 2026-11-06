// Bestehende Zugänge im Teilen-Drawer.

export function installShareListAccessList(proto) {
  Object.assign(proto, {
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
          <button type="button" class="share-inline-btn" data-copy="${this.escape(link)}">Gast-Link kopieren</button>
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
              <button type="button" class="share-recipient-revoke" data-copy="${this.escape(link)}">Gast-Link</button>
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
