// ProfileDetail.js (ES6-Modul)
// Benutzer-Profil anzeigen und bearbeiten

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
    const container = document.getElementById('main-content');
    if (!container) return;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h1>Mein Profil</h1>
          <p>Persönliche Informationen und Einstellungen</p>
        </div>
        <div class="page-actions">
          <button id="edit-profile-btn" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
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
                <label>Unterrolle</label>
                <div class="detail-value">
                  ${this.user.unterrolle ? `<span class="badge badge-outline">${this.user.unterrolle}</span>` : 'Keine'}
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
                <button id="save-profile-btn" class="btn btn-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Speichern
                </button>
                <button id="cancel-edit-btn" class="btn btn-secondary">Abbrechen</button>
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

  renderPermissions() {
    const permissions = window.currentUser?.permissions || {};
    const entities = ['creator', 'kampagne', 'kooperation', 'briefing', 'rechnung', 'unternehmen', 'marke', 'auftrag', 'ansprechpartner'];
    
    return entities.map(entity => {
      const perm = permissions[entity] || {};
      return `
        <div class="permission-item">
          <div class="permission-entity">${this.getEntityLabel(entity)}</div>
          <div class="permission-rights">
            <span class="permission-badge ${perm.can_view ? 'active' : ''}">Anzeigen</span>
            <span class="permission-badge ${perm.can_edit ? 'active' : ''}">Bearbeiten</span>
            <span class="permission-badge ${perm.can_delete ? 'active' : ''}">Löschen</span>
          </div>
        </div>
      `;
    }).join('');
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
    // Edit-Modus aktivieren
    document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
      this.isEditing = true;
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
