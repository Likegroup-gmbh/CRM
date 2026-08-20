// MitarbeiterList.js (ES6-Modul)
// Admin: Mitarbeiter verwalten (Übersicht)

import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';

export class MitarbeiterList {
  constructor() {
    this.rows = [];
    this.mitarbeiterKlassen = [];
    this._abortController = null;
  }

  async init() {
    window.setHeadline('Mitarbeiter');
    
    const isAdmin = window.isAdmin() || window.canViewPage?.('mitarbeiter') || window.checkUserPermission('dashboard', 'can_view');
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
      tbody = renderEmptyStateRow({ icon: 'users', title: 'Keine Mitarbeiter vorhanden' }, 5);
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
        ${icon('puzzle', { className: 'size-6' })}`;
      case 'customer success manager':
        return `
        ${icon('user-circle', { className: 'size-6' })}`;
      case 'cutter':
        return `
        ${icon('share-nodes', { className: 'size-6' })}`;
      case 'scripter':
      case 'skripter':
        return `
        ${icon('document-text', { className: 'size-6' })}`;
      case 'projektmanager':
        return `
        ${icon('clipboard', { className: 'size-6' })}`;
      default:
        return actionsDropdown.getHeroIcon('edit');
    }
  }

  bind() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    document.addEventListener('click', (e) => {
      const link = e.target.closest('.table-link');
      if (link && link.dataset.table === 'mitarbeiter') {
        e.preventDefault();
        const id = link.dataset.id;
        window.navigateTo(`/mitarbeiter/${id}`);
      }
    }, { signal });

    // "Rolle ändern" und "Freischalten / Sperren" werden zentral vom
    // globalen ActionsDropdown-Handler verarbeitet (ActionsDropdownHandlers.js)

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
    }, { signal });
  }

  destroy() {
    this._abortController?.abort();
    this._abortController = null;
    window.setContentSafely('');
  }
}

export const mitarbeiterList = new MitarbeiterList();


