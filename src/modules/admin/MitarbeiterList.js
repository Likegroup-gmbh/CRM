// MitarbeiterList.js (ES6-Modul)
// Admin: Mitarbeiter verwalten (Übersicht)

import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';

export class MitarbeiterList {
  constructor() {
    this.rows = [];
    this.mitarbeiterKlassen = [];
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
      // Lade Mitarbeiter-Klassen für das Aktionsmenü
      if (window.supabase) {
        const { data: klassenData, error: klassenError } = await window.supabase
          .from('mitarbeiter_klasse')
          .select('id, name, description')
          .order('sort_order', { ascending: true });

        if (klassenError) {
          console.warn('⚠️ Fehler beim Laden der Mitarbeiter-Klassen:', klassenError);
        } else {
          this.mitarbeiterKlassen = klassenData || [];
        }
      }

      if (window.supabase) {
        // Lade Mitarbeiterdaten direkt (inkl. E-Mail aus benutzer-Tabelle)
        // Filter: Rolle != 'kunde' (Kunden haben eigene Seite)
        const { data, error } = await window.supabase
          .from('benutzer')
          .select(`
            *,
            mitarbeiter_klasse:mitarbeiter_klasse_id(id, name)
          `)
          .neq('rolle', 'kunde')
          .order('name');

        if (error) {
          console.warn('⚠️ Fehler beim Laden der Mitarbeiter-Liste', error);
          // Fallback ohne email/freigeschaltet Spalte
          const { data: fallback, error: fallbackError } = await window.supabase
            .from('benutzer')
            .select('*, mitarbeiter_klasse:mitarbeiter_klasse_id(id, name)')
            .neq('rolle', 'kunde')
            .order('name');

          if (fallbackError) {
            console.error('❌ Auch Fallback fehlgeschlagen:', fallbackError);
            this.rows = [];
            return;
          }

          this.rows = (fallback || []).map(r => ({
            ...r,
            email: '—',
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

  // Hilfsfunktion: Vollständigen Namen aus Vorname/Nachname oder Fallback auf name
  getDisplayName(user) {
    if (user?.vorname && user?.nachname) {
      return `${user.vorname} ${user.nachname}`;
    }
    return user?.name || 'Unbekannt';
  }

  // Rolle anzeigen: Admin wenn admin, sonst Mitarbeiter-Klasse
  getRolleDisplay(user) {
    if (user.rolle === 'admin') {
      return `<div class="tags tags-compact"><span class="tag">Admin</span></div>`;
    }
    if (user.mitarbeiter_klasse?.name) {
      return `<div class="tags tags-compact"><span class="tag">${window.validatorSystem.sanitizeHtml(user.mitarbeiter_klasse.name)}</span></div>`;
    }
    return '—';
  }

  // Render einzelne Mitarbeiter-Zeile
  renderMitarbeiterRow(u) {
    const freigeschaltetIcon = u.freigeschaltet ?
      '<span class="status-badge success">FREIGESCHALTET</span>' :
      '<span class="status-badge warning">WARTET</span>';

    const actionsMenu = this.renderActionsMenu(u);
    
    const vorname = u.vorname || (u.name ? u.name.split(' ')[0] : '—');
    const nachname = u.nachname || (u.name && u.name.includes(' ') ? u.name.split(' ').slice(1).join(' ') : '—');
    
    const initials = `${vorname[0] || ''}${nachname[0] || ''}`.toUpperCase() || '—';
    const avatar = u.profile_image_url
      ? `<img src="${u.profile_image_url}" alt="${window.validatorSystem.sanitizeHtml(vorname + ' ' + nachname)}" class="table-logo">`
      : `<div class="table-avatar-placeholder table-avatar-round">${window.validatorSystem.sanitizeHtml(initials)}</div>`;

    return `
      <tr data-id="${u.id}">
        <td class="col-vorname">
          <div class="table-user-cell">
            ${avatar}
            ${u.id ? `<a href="#" class="table-link" data-table="mitarbeiter" data-id="${u.id}">${window.validatorSystem.sanitizeHtml(vorname)}</a>` : window.validatorSystem.sanitizeHtml(vorname)}
          </div>
        </td>
        <td class="col-nachname">${window.validatorSystem.sanitizeHtml(nachname)}</td>
        <td>${u.email ? `<a href="mailto:${u.email}" class="table-link email-link">${window.validatorSystem.sanitizeHtml(u.email)}</a>` : '—'}</td>
        <td>${freigeschaltetIcon}</td>
        <td class="col-actions">${actionsMenu}</td>
      </tr>
    `;
  }

  async render() {
    // Hierarchie-Reihenfolge definieren
    const hierarchie = [
      { key: 'admin', label: 'Admin', filter: u => u.rolle === 'admin' },
      { key: 'Management', label: 'Management', filter: u => u.rolle !== 'admin' && u.mitarbeiter_klasse?.name === 'Management' },
      { key: 'Lead', label: 'Lead', filter: u => u.rolle !== 'admin' && u.mitarbeiter_klasse?.name === 'Lead' },
      { key: 'Projektmanagement', label: 'Projektmanagement', filter: u => u.rolle !== 'admin' && u.mitarbeiter_klasse?.name === 'Projektmanagement' },
      { key: 'Strategie', label: 'Strategie', filter: u => u.rolle !== 'admin' && u.mitarbeiter_klasse?.name === 'Strategie' },
      { key: 'Copywriter', label: 'Copywriter', filter: u => u.rolle !== 'admin' && u.mitarbeiter_klasse?.name === 'Copywriter' },
      { key: 'Cutter', label: 'Cutter', filter: u => u.rolle !== 'admin' && u.mitarbeiter_klasse?.name === 'Cutter' },
      { key: 'Back-Office-Buchhaltung', label: 'Back-Office-Buchhaltung', filter: u => u.rolle !== 'admin' && u.mitarbeiter_klasse?.name === 'Back-Office-Buchhaltung' },
      { key: 'ohne', label: 'Ohne Rolle', filter: u => u.rolle !== 'admin' && !u.mitarbeiter_klasse?.name }
    ];

    // Gruppierte Tabellen-Sektionen erstellen
    let tbody = '';
    
    for (const gruppe of hierarchie) {
      const mitarbeiter = this.rows.filter(gruppe.filter);
      
      if (mitarbeiter.length === 0) continue;
      
      // Gruppen-Header
      tbody += `
        <tr class="table-group-header">
          <td colspan="5">
            <div class="table-group-title">
              <span class="table-group-label">${gruppe.label}</span>
              <span class="table-group-count">${mitarbeiter.length}</span>
            </div>
          </td>
        </tr>
      `;
      
      // Mitarbeiter in dieser Gruppe (sortiert nach Name)
      mitarbeiter
        .sort((a, b) => {
          const nameA = this.getDisplayName(a).toLowerCase();
          const nameB = this.getDisplayName(b).toLowerCase();
          return nameA.localeCompare(nameB);
        })
        .forEach(u => {
          tbody += this.renderMitarbeiterRow(u);
        });
    }

    if (!tbody) {
      tbody = '<tr><td colspan="5" class="loading">Keine Mitarbeiter gefunden</td></tr>';
    }

    const html = `
      <div class="page-header">
        <div class="page-header-right">
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table data-table--grouped">
          <thead>
            <tr>
              <th class="col-vorname">Vorname</th>
              <th class="col-nachname">Nachname</th>
              <th>E-Mail</th>
              <th>Status</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${tbody}
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Render Aktionsmenü für Mitarbeiter
  renderActionsMenu(user) {
    return actionBuilder.create('mitarbeiter', user.id, null, {
      statusOptions: this.mitarbeiterKlassen.map(k => ({ id: k.id, name: k.name })),
      currentStatus: user.mitarbeiter_klasse ? { id: user.mitarbeiter_klasse.id, name: user.mitarbeiter_klasse.name } : null
    });
  }

  // Icons für verschiedene Rollen
  getRoleIcon(roleName) {
    const key = String(roleName || '').toLowerCase().trim();
    switch (key) {
      case 'strategie':
      case 'strategy / creator':
        return `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" />
        </svg>`;
      case 'customer success manager':
        return `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>`;
      case 'cutter':
        return `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="m7.848 8.25 1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887a2.165 2.165 0 0 0 1.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863 2.077-1.199m0-3.328a4.323 4.323 0 0 1 2.068-1.379l5.325-1.628a4.5 4.5 0 0 1 2.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.33 4.33 0 0 0 10.607 12m3.736 0 7.794 4.5-.802.215a4.5 4.5 0 0 1-2.48-.043l-5.326-1.629a4.324 4.324 0 0 1-2.068-1.379M14.343 12l-2.882 1.664" />
        </svg>`;
      case 'scripter':
      case 'skripter':
        return `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 11.625h4.5m-4.5 2.25h4.5m2.121 1.527c-1.171 1.464-3.07 1.464-4.242 0-1.172-1.465-1.172-3.84 0-5.304 1.171-1.464 3.07-1.464 4.242 0M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12" />
        </svg>`;
      case 'projektmanager':
        return `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
        </svg>`;
      default:
        return actionsDropdown.getHeroIcon('edit');
    }
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

    // Event-Handler für Rollen-Submenu (generiert von ActionBuilder als .submenu-item)
    document.addEventListener('click', (e) => {
      const submenuItem = e.target.closest('.submenu-item[data-action="set-field"]');
      if (submenuItem) {
        const container = submenuItem.closest('[data-entity-type="mitarbeiter"]');
        if (!container) return;
        e.preventDefault();
        const userId = submenuItem.dataset.id;
        const fieldName = submenuItem.dataset.field;
        const fieldValue = submenuItem.dataset.value;
        const roleName = submenuItem.dataset.statusName;

        this.handleRoleChange(userId, fieldName, fieldValue, roleName);
      }

      const freischaltenItem = e.target.closest('.action-item[data-action="freischalten"]');
      if (freischaltenItem) {
        e.preventDefault();
        const userId = freischaltenItem.dataset.id;
        const user = this.rows.find(r => r.id === userId);
        if (user) {
          this.handleFreischaltenToggle(userId, !user.freigeschaltet);
        }
      }
    });

    // Live-Update bei entityUpdated
    window.addEventListener('entityUpdated', async (evt) => {
      const { entity, id, field, value } = evt.detail || {};
      if (entity !== 'benutzer') return;
      // Nur reagieren, wenn Klasse oder Freischalt-Status geändert wurde
      if (field !== 'mitarbeiter_klasse_id' && field !== 'freigeschaltet') return;

      // Bei Klassen-Änderung: Neu laden und rendern (weil sich Gruppierung ändert)
      if (field === 'mitarbeiter_klasse_id') {
        await this.load();
        await this.render();
        return;
      }

      // Status-Update kann inline passieren
      if (field === 'freigeschaltet') {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (!row) return;
        // Spalten: Vorname(0), Nachname(1), E-Mail(2), Status(3), Aktionen(4)
        const statusCell = row.children[3];
        if (statusCell) {
          statusCell.innerHTML = value
            ? '<span class="status-badge success">FREIGESCHALTET</span>'
            : '<span class="status-badge warning">WARTET</span>';
        }
      }
    });
  }

  // Handler für Rollen-Änderungen
  async handleRoleChange(userId, fieldName, fieldValue, roleName) {
    try {
      console.log(`🔄 Ändere Rolle für Mitarbeiter ${userId} auf "${roleName}"`);
      await actionsDropdown.setField('benutzer', userId, fieldName, fieldValue);
      console.log('✅ Rolle erfolgreich geändert');

      // Aktualisiere die Liste
      await this.load();
      await this.render();
      this.bind();

    } catch (error) {
      console.error('❌ Fehler beim Ändern der Rolle:', error);
    }
  }

  // Handler für Freischalten/Sperren
  async handleFreischaltenToggle(userId, newStatus) {
    try {
      console.log(`${newStatus ? '🔓' : '🔒'} ${newStatus ? 'Schalte' : 'Sperre'} Mitarbeiter ${userId}`);
      await actionsDropdown.setField('benutzer', userId, 'freigeschaltet', newStatus);
      console.log('✅ Status erfolgreich geändert');

      // Aktualisiere die Liste
      await this.load();
      await this.render();
      this.bind();

    } catch (error) {
      console.error('❌ Fehler beim Ändern des Status:', error);
    }
  }

  destroy() {
    window.setContentSafely('');
  }
}

export const mitarbeiterList = new MitarbeiterList();


