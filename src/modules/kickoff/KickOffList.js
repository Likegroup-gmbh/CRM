import { avatarBubbles } from '../../core/components/AvatarBubbles.js';

export class KickOffList {
  constructor() {
    this.kickoffs = [];
  }

  async init() {
    window.setHeadline('Kick-Offs');
    await this.load();
    this.render();
    this.bindEvents();
  }

  async load() {
    try {
      const { data, error } = await window.supabase
        .from('marke_kickoff')
        .select(`*,
          unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url),
          marke:marke_id(id, markenname, logo_url, unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.kickoffs = data || [];
    } catch (e) {
      console.error('Fehler beim Laden der Kick-Offs:', e);
      this.kickoffs = [];
    }
  }

  _truncate(text, max = 80) {
    if (!text) return '—';
    return text.length > max ? text.slice(0, max) + '...' : text;
  }

  _formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  _isKunde() {
    return window.isKunde();
  }

  _resolveUnternehmen(k) {
    return k.unternehmen || k.marke?.unternehmen || null;
  }

  _renderUnternehmen(k) {
    const u = this._resolveUnternehmen(k);
    if (!u || !u.firmenname) return '-';

    return avatarBubbles.renderBubbles([{
      name: u.firmenname,
      label: u.internes_kuerzel || u.firmenname,
      type: 'org',
      id: u.id,
      entityType: 'unternehmen',
      logo_url: u.logo_url || null
    }], { showLabel: true });
  }

  _renderMarke(k) {
    if (!k.marke || !k.marke.markenname) return '-';

    return avatarBubbles.renderBubbles([{
      name: k.marke.markenname,
      type: 'org',
      id: k.marke.id,
      entityType: 'marke',
      logo_url: k.marke.logo_url || null
    }], { showLabel: true });
  }

  render() {
    const isKunde = this._isKunde();

    const rows = this.kickoffs.map(k => `
      <tr class="table-row-clickable" data-id="${k.id}">
        ${!isKunde ? `<td>${this._renderUnternehmen(k)}</td>` : ''}
        ${!isKunde ? `<td>${this._renderMarke(k)}</td>` : ''}
        <td><div class="tags tags-compact"><span class="tag tag--type">${window.validatorSystem.sanitizeHtml(k.kickoff_type === 'paid' ? 'Paid' : k.kickoff_type === 'organic' ? 'Organic' : (k.kickoff_type || '—'))}</span></div></td>
        <td>${window.validatorSystem.sanitizeHtml(this._truncate(k.brand_essenz))}</td>
        <td>${this._formatDate(k.created_at)}</td>
      </tr>
    `).join('');

    const createBtn = isKunde ? '' : `
      <button class="primary-btn" id="kickoff-create-btn">Neuer Kick-Off</button>
    `;

    const colCount = isKunde ? 3 : 5;

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          ${createBtn}
        </div>
      </div>
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${!isKunde ? '<th>Unternehmen</th>' : ''}
              ${!isKunde ? '<th>Marke</th>' : ''}
              <th>Typ</th>
              <th>Brand-Essenz</th>
              <th>Erstellt am</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="${colCount}" style="text-align: center; padding: var(--space-lg); color: var(--text-secondary);">Keine Kick-Offs vorhanden</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  bindEvents() {
    const rows = document.querySelectorAll('.data-table tbody tr[data-id]');
    rows.forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        window.navigateTo(`/kickoff/${id}`);
      });
    });

    const createBtn = document.getElementById('kickoff-create-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        window.navigateTo('/kickoff-create');
      });
    }
  }

  destroy() {}
}

export const kickOffList = new KickOffList();
