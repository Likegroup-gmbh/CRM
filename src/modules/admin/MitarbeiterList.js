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
        // Lade Mitarbeiterdaten direkt ohne RPC (da freigeschaltet Spalte eventuell noch nicht existiert)
        const { data, error } = await window.supabase
          .from('benutzer')
          .select(`
            id, 
            name, 
            rolle, 
            unterrolle,
            freigeschaltet,
            mitarbeiter_klasse:mitarbeiter_klasse_id(name)
          `)
          .order('name');
        
        if (error) {
          console.warn('⚠️ Fehler beim Laden der Mitarbeiter-Liste (eventuell fehlt freigeschaltet Spalte)', error);
          // Fallback ohne freigeschaltet Spalte
          const { data: fallback, error: fallbackError } = await window.supabase
            .from('benutzer')
            .select('id, name, rolle, unterrolle, mitarbeiter_klasse:mitarbeiter_klasse_id(name)')
            .order('name');
          
          if (fallbackError) {
            console.error('❌ Auch Fallback fehlgeschlagen:', fallbackError);
            this.rows = [];
            return;
          }
          
          this.rows = (fallback || []).map(r => ({
            ...r,
            freigeschaltet: r.rolle === 'admin' // Default: Admins sind freigeschaltet
          }));
        } else {
          this.rows = data || [];
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
    const tbody = this.rows.map(u => {
      const freigeschaltetIcon = u.freigeschaltet ? 
        '<span class="status-badge success">FREIGESCHALTET</span>' : 
        '<span class="status-badge warning">WARTET</span>';
      
      return `
        <tr>
          <td>${u.id ? `<a href="#" class="table-link" data-table="mitarbeiter" data-id="${u.id}">${window.validatorSystem.sanitizeHtml(u.name || '—')}</a>` : window.validatorSystem.sanitizeHtml(u.name || '—')}</td>
          <td>${window.validatorSystem.sanitizeHtml(u.rolle || '—')}</td>
          <td>${window.validatorSystem.sanitizeHtml(u.email || '—')}</td>
          <td>${window.validatorSystem.sanitizeHtml(u.unterrolle || '—')}</td>
          <td>${window.validatorSystem.sanitizeHtml(u.mitarbeiter_klasse?.name || '—')}</td>
          <td>${freigeschaltetIcon}</td>
        </tr>
      `;
    }).join('');

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
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${tbody || '<tr><td colspan="6" class="loading">Keine Mitarbeiter gefunden</td></tr>'}
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


