// Bestehende Zugänge im Teilen-Drawer: laden, rendern, Klicks in Zeile und Menü verteilen.
// Das Drei-Punkte-Menü ist ein ActionsDropdown-Portal an document.body, daher die
// Delegation über document.

import { accessRowHtml, codeBlockHtml, einladungsText, gastLink, ROW_RECHTE_FIELD } from './shareListAccessRow.js';

const LEER_TEXT = 'Noch keine Zugänge. Oben Empfänger eintragen oder ohne Mail einen Zugang erstellen.';

export function installShareListAccessList(proto) {
  Object.assign(proto, {
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
      // Frisch angelegte Zugänge bleiben sichtbar, auch wenn die Liste sie noch nicht liefert:
      // der Code ist nur jetzt im Klartext da.
      const ids = new Set(rows.map((share) => share.id));
      Object.keys(this.angelegt).forEach((id) => { if (ids.has(id)) delete this.angelegt[id]; });
      this.shares = [...Object.values(this.angelegt), ...rows];
      this.renderShares();
    },

    renderShares() {
      const container = this.panel?.querySelector('#share-recipients');
      if (!container) return;
      this.closeRowMail();
      const anzahl = this.panel.querySelector('#share-zugaenge-anzahl');
      if (anzahl) anzahl.textContent = this.shares.length ? String(this.shares.length) : '';

      if (this.shares.length === 0) {
        container.className = '';
        container.innerHTML = `<p class="share-dialog-empty">${LEER_TEXT}</p>`;
        return;
      }
      const origin = window.location.origin;
      container.className = 'share-access-list';
      container.innerHTML = this.shares.map((share) => accessRowHtml(share, {
        code: this.codes[share.id],
        origin,
        entityName: this.entityName,
        rechteOptionen: this.rechteOptions(),
        neu: share.id === this.frischId,
      })).join('');

      const neu = this.frischId && container.querySelector(`[data-share-id="${this.frischId}"]`);
      neu?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      this.frischId = null;
    },

    /** Code-Block einer Zeile neu setzen, ohne die Liste (und ein offenes Mail-Feld) neu zu bauen. */
    refreshRowCode(shareId) {
      const share = this.shares.find((s) => s.id === shareId);
      const slot = this.panel?.querySelector(`[data-share-id="${shareId}"] .share-access-code-slot`);
      const code = this.codes[shareId];
      if (!share || !slot) return;
      const link = gastLink(share.token, window.location.origin);
      slot.innerHTML = code ? codeBlockHtml(code, einladungsText({ entityName: this.entityName, link, code })) : '';
    },

    bindAccessList(signal) {
      const container = this.panel?.querySelector('#share-recipients');
      container?.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('[data-copy]');
        if (copyBtn) {
          this.copy(copyBtn.dataset.copy, copyBtn);
          return;
        }
        const linkBtn = e.target.closest('[data-copy-link]');
        if (linkBtn) this.copy(linkBtn.dataset.copyLink, linkBtn, 'Gast-Link kopiert.');
      }, { signal });

      document.addEventListener('click', (e) => {
        const item = e.target.closest('.actions-dropdown-portal .action-item[data-action^="share-"]');
        const quelle = item?.closest('.actions-dropdown-portal')?._sourceContainer;
        if (!item || !quelle || !this.panel?.contains(quelle)) return;
        e.preventDefault();
        this.rowAction(item.dataset.action, item.dataset.id);
      }, { signal });

      document.addEventListener('table-select-change', (e) => {
        const { field, itemId, value, element } = e.detail || {};
        if (field !== ROW_RECHTE_FIELD || !this.panel?.contains(element)) return;
        this.updateRechte(itemId, value);
      }, { signal });
    },

    rowAction(action, shareId) {
      if (action === 'share-mail') this.openRowMail(shareId);
      else if (action === 'share-rotate') this.rotate(shareId);
      else if (action === 'share-revoke') this.confirmRevoke(shareId);
    },
  });
}
