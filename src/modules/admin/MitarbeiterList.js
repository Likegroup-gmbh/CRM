// MitarbeiterList.js (ES6-Modul)
// Admin: Mitarbeiter verwalten (Übersicht)

export class MitarbeiterList {
  constructor() {
    this.rows = [];
  }

  async init() {
    window.setHeadline('Mitarbeiter');
    const isAdmin = window.currentUser?.rolle === 'admin' || window.canViewPage?.('mitarbeiter') || window.checkUserPermission('dashboard', 'can_view');
    if (!isAdmin) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Keine Berechtigung.</p>
        </div>
      `;
      return;
    }

    await this.load();
    await this.render();
    this.bind();
  }

  async load() {
    try {
      if (window.supabase) {
        // E-Mail aus auth.users joinen
        const { data, error } = await window.supabase
          .rpc('execute_sql', { sql_query: `
            select u.id, u.name, u.rolle, u.unterrolle,
                   u.auth_user_id, u.mitarbeiter_klasse_id,
                   mk.name as klasse_name,
                   au.email
            from public.benutzer u
            left join public.mitarbeiter_klasse mk on mk.id = u.mitarbeiter_klasse_id
            left join auth.users au on au.id = u.auth_user_id
            order by u.name` });
        if (error) {
          console.warn('⚠️ Mitarbeiter-Liste via RPC fehlgeschlagen, fallback ohne Email', error);
          const { data: fallback } = await window.supabase
            .from('benutzer')
            .select('id, name, rolle, unterrolle, mitarbeiter_klasse:mitarbeiter_klasse_id(name)')
            .order('name');
          this.rows = fallback || [];
        } else {
          this.rows = (data || []).map(r => ({
            id: r.id,
            name: r.name,
            rolle: r.rolle,
            unterrolle: r.unterrolle,
            email: r.email,
            mitarbeiter_klasse: { name: r.klasse_name }
          }));
        }
      } else {
        this.rows = await window.dataService.loadEntities('benutzer');
      }
    } catch (e) {
      console.error('❌ Fehler beim Laden der Mitarbeiter:', e);
      this.rows = [];
    }
  }

  async render() {
    const tbody = this.rows.map(u => `
      <tr>
        <td>${u.id ? `<a href="#" class="table-link" data-table="mitarbeiter" data-id="${u.id}">${window.validatorSystem.sanitizeHtml(u.name || '—')}</a>` : window.validatorSystem.sanitizeHtml(u.name || '—')}</td>
        <td>${window.validatorSystem.sanitizeHtml(u.rolle || '—')}</td>
        <td>${window.validatorSystem.sanitizeHtml(u.email || '—')}</td>
        <td>${window.validatorSystem.sanitizeHtml(u.unterrolle || '—')}</td>
        <td>${window.validatorSystem.sanitizeHtml(u.mitarbeiter_klasse?.name || '—')}</td>
      </tr>
    `).join('');

    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Mitarbeiter</h1>
          <p>Benutzerverwaltung und Rechte</p>
        </div>
        <div class="page-header-right">
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Rolle</th>
              <th>E-Mail</th>
              <th>Unterrolle</th>
              <th>Kategorie</th>
            </tr>
          </thead>
          <tbody>
            ${tbody || '<tr><td colspan="3" class="loading">Keine Mitarbeiter gefunden</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  bind() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('.table-link');
      if (link && link.dataset.table === 'mitarbeiter') {
        e.preventDefault();
        const id = link.dataset.id;
        window.navigateTo(`/mitarbeiter/${id}`);
      }
    });
  }

  destroy() {
    window.setContentSafely('');
  }
}

export const mitarbeiterList = new MitarbeiterList();


