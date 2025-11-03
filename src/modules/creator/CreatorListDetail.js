// CreatorListDetail.js (ES6-Modul)
// Detailseite einer Creator-Liste: zeigt alle zugeordneten Creator
import { actionsDropdown } from '../../core/ActionsDropdown.js';
export class CreatorListDetail {
  constructor() {
    this.listId = null;
    this.list = null;
    this.members = [];
  }

  async init(id) {
    this.listId = id;
    await this.load();
    await this.render();
  }

  async load() {
    try {
      const [{ data: list }, { data: members }] = await Promise.all([
        window.supabase.from('creator_list').select('id, name, created_at').eq('id', this.listId).single(),
        window.supabase
          .from('creator_list_member')
          .select(`
            id,
            added_at,
            creator:creator_id (
              id,
              vorname,
              nachname,
              instagram,
              tiktok,
              mail,
              lieferadresse_stadt,
              lieferadresse_land
            )
          `)
          .eq('list_id', this.listId)
          .order('added_at', { ascending: false })
      ]);
      this.list = list || { id: this.listId, name: '-' };
      this.members = (members || []).filter(m => !!m.creator);
    } catch (e) {
      console.error('❌ Fehler beim Laden der Creator-Liste:', e);
      this.list = { id: this.listId, name: '-' };
      this.members = [];
    }
  }

  async render() {
    const count = this.members.length;
    window.setHeadline(`Liste: ${window.validatorSystem.sanitizeHtml(this.list?.name || '-')}`);
    const html = `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Instagram</th>
              <th>TikTok</th>
              <th>E-Mail</th>
              <th>Ort</th>
              <th>Hinzugefügt</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="creator-list-detail-body">
            ${this.members.map(m => this.renderRow(m)).join('') || '<tr><td colspan="7" class="empty">Keine Creator</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    window.setContentSafely(window.content, html);
    // Icons vereinheitlichen
    actionsDropdown.normalizeIcons(document);
    document.getElementById('btn-back-lists')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.navigateTo('/creator-lists');
    });
  }

  renderRow(m) {
    const c = m.creator || {};
    const fullName = [c.vorname, c.nachname].filter(Boolean).join(' ') || c.id || '-';
    const ig = c.instagram ? `@${c.instagram}` : '-';
    const tt = c.tiktok ? `@${c.tiktok}` : '-';
    const mail = c.mail || '-';
    const ort = [c.lieferadresse_stadt, c.lieferadresse_land].filter(Boolean).join(', ') || '-';
    const added = m.added_at ? new Intl.DateTimeFormat('de-DE').format(new Date(m.added_at)) : '-';
    return `
      <tr>
        <td><a href="/creator/${c.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${c.id}')">${window.validatorSystem.sanitizeHtml(fullName)}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(ig)}</td>
        <td>${window.validatorSystem.sanitizeHtml(tt)}</td>
        <td>${window.validatorSystem.sanitizeHtml(mail)}</td>
        <td>${window.validatorSystem.sanitizeHtml(ort)}</td>
        <td>${added}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${c.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${c.id}')">Details anzeigen</a>
              <a href="#" class="action-item" data-action="add_to_campaign" data-id="${c.id}">
                ${actionsDropdown.getHeroIcon('add-to-campaign')}
                Zu Kampagne hinzufügen
              </a>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  destroy() {}
}

export const creatorListDetail = new CreatorListDetail();


