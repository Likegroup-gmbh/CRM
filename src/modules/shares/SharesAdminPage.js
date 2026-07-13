// SharesAdminPage.js
// Admin-/Mitarbeiter-Übersicht aller geteilten Listen (list_shares)
// mit Widerruf und Rechte-Änderung.

const ENTITY_META = {
  kampagne: { label: 'Kampagne', table: 'kampagne', nameColumns: ['eigener_name', 'kampagnenname'], route: (id) => `/kampagne/${id}` },
  sourcing: { label: 'Sourcing', table: 'creator_auswahl', nameColumns: ['name'], route: (id) => `/sourcing/${id}` },
  strategie: { label: 'Strategie', table: 'strategie', nameColumns: ['name'], route: (id) => `/strategie/${id}` },
};

const RECHTE_LABELS = { ansehen: 'Nur ansehen', feedback: 'Ansehen + Feedback' };

export class SharesAdminPage {
  constructor() {
    this.shares = [];
    this.entityNames = new Map();
    this.showRevoked = false;
    this._abort = null;
  }

  async init() {
    if (!window.isInternal?.()) {
      window.content.innerHTML = '<div class="error-message"><p>Keine Berechtigung.</p></div>';
      return;
    }

    window.setHeadline('Geteilte Listen');
    window.content.innerHTML = `
      <div class="table-loading-container" style="min-height: 200px;">
        <div class="table-loading-spinner"></div>
      </div>
    `;

    await this.loadData();
    this.render();
  }

  destroy() {
    if (this._abort) {
      this._abort.abort();
      this._abort = null;
    }
  }

  async loadData() {
    const { data, error } = await window.supabase
      .from('list_shares')
      .select('id, entity_type, entity_id, email, rechte, created_at, last_access_at, revoked_at, benutzer:gast_benutzer_id (name), ersteller:created_by (name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fehler beim Laden der Shares:', error);
      this.shares = [];
      return;
    }
    this.shares = data || [];

    // Entitätsnamen nachladen
    this.entityNames = new Map();
    for (const [type, meta] of Object.entries(ENTITY_META)) {
      const ids = [...new Set(this.shares.filter(s => s.entity_type === type).map(s => s.entity_id))];
      if (ids.length === 0) continue;
      const { data: rows } = await window.supabase
        .from(meta.table)
        .select(`id, ${meta.nameColumns.join(', ')}`)
        .in('id', ids);
      (rows || []).forEach(row => {
        const name = meta.nameColumns.map(c => row[c]).find(v => v && String(v).trim()) || 'Unbenannt';
        this.entityNames.set(`${type}:${row.id}`, name);
      });
    }
  }

  render() {
    this._abort?.abort();
    this._abort = new AbortController();
    const { signal } = this._abort;

    const visible = this.showRevoked ? this.shares : this.shares.filter(s => !s.revoked_at);

    const rows = visible.map(share => {
      const meta = ENTITY_META[share.entity_type] || { label: share.entity_type, route: () => '#' };
      const entityName = this.entityNames.get(`${share.entity_type}:${share.entity_id}`) || '–';
      const isRevoked = !!share.revoked_at;
      const lastAccess = share.last_access_at
        ? new Date(share.last_access_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
        : '–';
      const created = new Date(share.created_at).toLocaleDateString('de-DE');

      return `
        <tr class="${isRevoked ? 'share-row--revoked' : ''}" data-share-id="${share.id}">
          <td><a href="${meta.route(share.entity_id)}" data-route="${meta.route(share.entity_id)}" class="share-entity-link">${this.escape(entityName)}</a></td>
          <td>${meta.label}</td>
          <td>${this.escape(share.email)}</td>
          <td>${this.escape(share.benutzer?.name || '–')}</td>
          <td>
            ${isRevoked
              ? `<span>${RECHTE_LABELS[share.rechte] || share.rechte}</span>`
              : `<select class="input share-admin-rechte" data-share-id="${share.id}" style="font-size:0.82rem;padding:3px 6px;">
                  <option value="ansehen" ${share.rechte === 'ansehen' ? 'selected' : ''}>Nur ansehen</option>
                  <option value="feedback" ${share.rechte === 'feedback' ? 'selected' : ''}>Ansehen + Feedback</option>
                </select>`}
          </td>
          <td>${this.escape(share.ersteller?.name || '–')}</td>
          <td>${created}</td>
          <td>${lastAccess}</td>
          <td>
            ${isRevoked
              ? '<span class="status-badge">Widerrufen</span>'
              : `<button type="button" class="secondary-btn share-admin-revoke" data-share-id="${share.id}">Widerrufen</button>`}
          </td>
        </tr>
      `;
    }).join('');

    window.content.innerHTML = `
      <div class="content-section">
        <div class="page-header">
          <h2 class="page-header-title">Geteilte Listen</h2>
          <div class="page-header-right">
            <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;">
              <input type="checkbox" id="shares-show-revoked" ${this.showRevoked ? 'checked' : ''}>
              Widerrufene anzeigen
            </label>
          </div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Liste</th>
                <th>Typ</th>
                <th>E-Mail</th>
                <th>Name</th>
                <th>Rechte</th>
                <th>Geteilt von</th>
                <th>Geteilt am</th>
                <th>Letzter Zugriff</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="9" style="text-align:center;color:var(--text-secondary,#999);padding:24px;">Keine geteilten Listen vorhanden.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('shares-show-revoked')?.addEventListener('change', (e) => {
      this.showRevoked = e.target.checked;
      this.render();
    }, { signal });

    document.querySelectorAll('.share-admin-revoke').forEach(btn => {
      btn.addEventListener('click', () => this.revoke(btn.dataset.shareId), { signal });
    });

    document.querySelectorAll('.share-admin-rechte').forEach(select => {
      select.addEventListener('change', () => this.updateRechte(select.dataset.shareId, select.value), { signal });
    });

    document.querySelectorAll('.share-entity-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.navigateTo(link.dataset.route);
      }, { signal });
    });
  }

  async revoke(shareId) {
    const { error } = await window.supabase
      .from('list_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', shareId);

    if (error) {
      window.toastSystem?.show('Widerruf fehlgeschlagen', 'error');
      return;
    }
    window.toastSystem?.show('Zugang widerrufen', 'success');
    const share = this.shares.find(s => s.id === shareId);
    if (share) share.revoked_at = new Date().toISOString();
    this.render();
  }

  async updateRechte(shareId, rechte) {
    const { error } = await window.supabase
      .from('list_shares')
      .update({ rechte })
      .eq('id', shareId);

    if (error) {
      window.toastSystem?.show('Rechte-Änderung fehlgeschlagen', 'error');
      this.render();
      return;
    }
    const share = this.shares.find(s => s.id === shareId);
    if (share) share.rechte = rechte;
    window.toastSystem?.show('Rechte aktualisiert', 'success');
  }

  escape(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const sharesAdminPage = new SharesAdminPage();
