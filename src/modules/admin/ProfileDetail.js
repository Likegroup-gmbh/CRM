// ProfileDetail.js (ES6-Modul)
// Benutzer-Profil anzeigen und bearbeiten

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';

export class ProfileDetail {
  constructor() {
    this.user = null;
    this.isEditing = false;
  }

  async init() {
    await this.load();
    await this.render();
    this.bind();
  }

  async load() {
    try {
      if (!window.currentUser?.id) {
        throw new Error('Kein Benutzer eingeloggt');
      }

      const { data: user, error } = await window.supabase
        .from('benutzer')
        .select(`
          *,
          mitarbeiter_klasse:mitarbeiter_klasse_id(name, description)
        `)
        .eq('id', window.currentUser.id)
        .single();

      if (error) throw error;
      this.user = user || {};

      console.log('✅ Profil geladen:', this.user);
    } catch (error) {
      console.error('❌ Fehler beim Laden des Profils:', error);
      window.ErrorHandler.handle(error, 'ProfileDetail.load');
    }
  }

  async render() {
    const container = document.getElementById('dashboard-content');
    if (!container) {
      console.error('❌ dashboard-content Container nicht gefunden');
      return;
    }

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h1>Mein Profil</h1>
          <p>Persönliche Informationen und Einstellungen</p>
        </div>
        <div class="page-actions">
          <button id="edit-profile-btn" class="mdc-btn">
            ${icon('pencil-square', { className: 'w-5 h-5' })}
            Profil bearbeiten
          </button>
        </div>
      </div>

      <div class="detail-container">
        <div class="detail-grid">
          <!-- Profil-Informationen -->
          <div class="detail-section">
            <h2>Persönliche Informationen</h2>
            <div class="detail-grid-two">
              <div class="detail-field">
                <label>Name</label>
                <div class="detail-value" id="profile-name">
                  ${this.isEditing ? `
                    <input type="text" id="name-input" class="form-input" value="${this.user.name || ''}" placeholder="Vollständiger Name">
                  ` : (this.user.name || 'Nicht angegeben')}
                </div>
              </div>
              
              <div class="detail-field">
                <label>E-Mail</label>
                <div class="detail-value">${this.user.auth_user_id ? 'Über Supabase Auth verwaltet' : 'Nicht angegeben'}</div>
              </div>
              
              <div class="detail-field">
                <label>Rolle</label>
                <div class="detail-value">
                  <span class="badge badge-${this.user.rolle?.toLowerCase() === 'admin' ? 'primary' : 'secondary'}">
                    ${this.user.rolle || 'Nicht definiert'}
                  </span>
                </div>
              </div>
              
              <div class="detail-field">
                <label>Mitarbeiter-Klasse</label>
                <div class="detail-value">
                  ${this.user.mitarbeiter_klasse?.name || 'Nicht zugewiesen'}
                </div>
              </div>
              
              <div class="detail-field">
                <label>Erstellt am</label>
                <div class="detail-value">${this.formatDate(this.user.created_at)}</div>
              </div>
            </div>
            
            ${this.isEditing ? `
              <div class="form-actions">
                <button id="save-profile-btn" class="mdc-btn">
                  ${icon('check-bold', { className: 'w-5 h-5' })}
                  Speichern
                </button>
                <button id="cancel-edit-btn" class="mdc-btn mdc-btn--secondary">Abbrechen</button>
              </div>
            ` : ''}
          </div>

          <!-- Berechtigungen -->
          <div class="detail-section">
            <h2>Berechtigungen</h2>
            <div class="permissions-grid">
              ${this.renderPermissions()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderProfileInfo() {
    return `
      <div class="detail-section">
        <h2>Persönliche Informationen</h2>
        <div class="detail-grid-two">
          <div class="detail-field">
            <label>Name</label>
            <div class="detail-value">${this.user?.name || 'Nicht angegeben'}</div>
          </div>
          
          <div class="detail-field">
            <label>E-Mail</label>
            <div class="detail-value">${this.user?.auth_user_id ? 'Über Supabase Auth verwaltet' : 'Nicht angegeben'}</div>
          </div>
          
          <div class="detail-field">
            <label>Rolle</label>
            <div class="detail-value">
              <span class="badge badge-${this.user?.rolle?.toLowerCase() === 'admin' ? 'primary' : 'secondary'}">
                ${this.user?.rolle || 'Nicht definiert'}
              </span>
            </div>
          </div>
          
          <div class="detail-field">
            <label>Mitarbeiter-Klasse</label>
            <div class="detail-value">
              ${this.user?.mitarbeiter_klasse?.name || 'Nicht zugewiesen'}
            </div>
          </div>
          
          <div class="detail-field">
            <label>Erstellt am</label>
            <div class="detail-value">${this.formatDate(this.user?.created_at)}</div>
          </div>
        </div>
      </div>
    `;
  }

  renderEditForm() {
    return `
      <div class="detail-section">
        <h2>Profil bearbeiten</h2>
        <div class="detail-grid-two">
          <div class="detail-field">
            <label for="name-input">Name *</label>
            <input type="text" id="name-input" class="form-input" value="${this.user?.name || ''}" placeholder="Vollständiger Name">
          </div>
          
          <div class="detail-field">
            <label>E-Mail</label>
            <div class="detail-value text-muted">Über Supabase Auth verwaltet</div>
          </div>
          
          <div class="detail-field">
            <label>Rolle</label>
            <div class="detail-value text-muted">Wird vom Administrator verwaltet</div>
          </div>
        </div>
        
        <div class="form-actions">
          <button id="save-profile-btn" class="mdc-btn">
            ${icon('check-bold', { className: 'w-5 h-5' })}
            Speichern
          </button>
          <button id="cancel-edit-btn" class="mdc-btn mdc-btn--secondary">
            ${icon('x-mark', { className: 'w-5 h-5' })}
            Abbrechen
          </button>
        </div>
      </div>
    `;
  }

  renderPermissions() {
    if (!this.user?.zugriffsrechte) {
      return `
        <div class="detail-section">
          <h2>Meine Berechtigungen</h2>
          ${renderEmptyState({ icon: 'info', title: 'Keine Berechtigungen definiert' })}
        </div>
      `;
    }

    const permissions = this.user.zugriffsrechte;
    const modules = [
      { key: 'creator', label: 'Creator' },
      { key: 'creator-lists', label: 'Creator-Listen' },
      { key: 'unternehmen', label: 'Unternehmen' },
      { key: 'marke', label: 'Marken' },
      { key: 'auftrag', label: 'Aufträge' },
      { key: 'kampagne', label: 'Kampagnen' },
      { key: 'kooperation', label: 'Kooperationen' },
      { key: 'briefing', label: 'Briefings' },
      { key: 'rechnung', label: 'Rechnungen' },
      { key: 'ansprechpartner', label: 'Ansprechpartner' },
      { key: 'feedback', label: 'Feedback' }
    ];

    return `
      <div class="detail-section">
        <h2>Meine Berechtigungen</h2>
        <p class="text-muted">Diese Berechtigungen werden vom Administrator verwaltet.</p>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Bereich</th>
                <th class="col-w100-center">Lesen</th>
                <th class="col-w100-center">Bearbeiten</th>
                <th class="col-w100-center">Löschen</th>
              </tr>
            </thead>
            <tbody>
              ${modules.map(module => {
                const perm = permissions[module.key];
                const canView = perm?.can_view !== false;
                const canEdit = perm?.can_edit === true;
                const canDelete = perm?.can_delete === true;
                
                return `
                  <tr>
                    <td>${module.label}</td>
                    <td class="u-text-center">
                      <span class="permission-indicator ${canView ? 'granted' : 'denied'}">
                        ${canView ? '✓' : '✗'}
                      </span>
                    </td>
                    <td class="u-text-center">
                      <span class="permission-indicator ${canEdit ? 'granted' : 'denied'}">
                        ${canEdit ? '✓' : '✗'}
                      </span>
                    </td>
                    <td class="u-text-center">
                      <span class="permission-indicator ${canDelete ? 'granted' : 'denied'}">
                        ${canDelete ? '✓' : '✗'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  getEntityLabel(entity) {
    const labels = {
      creator: 'Creator',
      kampagne: 'Kampagnen',
      kooperation: 'Kooperationen', 
      briefing: 'Briefings',
      rechnung: 'Rechnungen',
      unternehmen: 'Unternehmen',
      marke: 'Marken',
      auftrag: 'Aufträge',
      ansprechpartner: 'Ansprechpartner'
    };
    return labels[entity] || entity;
  }

  bind() {
    // Tab-System
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        
        // Alle Tabs deaktivieren
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));
        
        // Aktiven Tab aktivieren
        btn.classList.add('active');
        document.getElementById(`tab-${tabId}`)?.classList.add('active');
      });
    });

    // Edit-Modus aktivieren
    document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
      this.isEditing = !this.isEditing;
      this.render();
    });

    // Speichern
    document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
      await this.saveProfile();
    });

    // Abbrechen
    document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
      this.isEditing = false;
      this.render();
    });
  }

  async saveProfile() {
    try {
      const nameInput = document.getElementById('name-input');
      const newName = nameInput?.value?.trim();

      if (!newName) {
        alert('Name darf nicht leer sein');
        return;
      }

      const { error } = await window.supabase
        .from('benutzer')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', this.user.id);

      if (error) throw error;

      // Update current user
      window.currentUser.name = newName;
      this.user.name = newName;
      
      // Update header initials
      window.setupHeaderUI?.();

      this.isEditing = false;
      await this.render();
      
      alert('Profil erfolgreich aktualisiert');
      console.log('✅ Profil gespeichert');
    } catch (error) {
      console.error('❌ Fehler beim Speichern:', error);
      alert('Fehler beim Speichern des Profils');
    }
  }

  formatDate(dateString) {
    if (!dateString) return 'Unbekannt';
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  destroy() {
    console.log('ProfileDetail: Cleaning up...');
  }
}

export const profileDetail = new ProfileDetail();
