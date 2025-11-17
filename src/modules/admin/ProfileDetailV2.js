// ProfileDetailV2.js (ES6-Modul)
// Moderne Profilseite mit zweispaltigem Layout

import { profileImageUpload } from './ProfileImageUpload.js';

export class ProfileDetailV2 {
  constructor() {
    this.userId = null;
    this.user = null;
    this.unternehmen = [];
    this.marken = [];
    this.auftraege = [];
    this.kampagnen = [];
    this.kooperationen = [];
    this.videos = [];
    this.activities = [];
    this.sprachen = [];
    this.activeSidebarTab = 'info';
    this.activeMainTab = 'unternehmen';
  }

  async init() {
    this.userId = window.currentUser?.id;
    if (!this.userId) {
      console.error('❌ Kein Benutzer eingeloggt');
      return;
    }

    await this.loadAllData();
    await this.render();
    this.bind();
  }

  async loadAllData() {
    await this.loadUserData();
    await this.loadAssignedEntities();
    await this.loadActivities();
  }

  async loadUserData() {
    try {
      const { data: user, error } = await window.supabase
        .from('benutzer')
        .select(`
          *,
          mitarbeiter_klasse:mitarbeiter_klasse_id(name, description)
        `)
        .eq('id', this.userId)
        .single();

      if (error) throw error;
      this.user = user || {};

      // Lade Sprachen wenn vorhanden
      if (this.user.sprachen_ids && this.user.sprachen_ids.length > 0) {
        const { data: sprachen } = await window.supabase
          .from('sprachen')
          .select('name')
          .in('id', this.user.sprachen_ids);
        this.sprachen = sprachen || [];
      }

      console.log('✅ Profil geladen:', this.user);
    } catch (error) {
      console.error('❌ Fehler beim Laden des Profils:', error);
      window.ErrorHandler.handle(error, 'ProfileDetailV2.loadUserData');
    }
  }

  async loadAssignedEntities() {
    const isKunde = this.user?.rolle === 'kunde';

    try {
      if (isKunde) {
        await this.loadKundeEntities();
      } else {
        await this.loadMitarbeiterEntities();
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Entitäten:', error);
    }
  }

  async loadKundeEntities() {
    // 1. Unternehmen über kunde_unternehmen Junction
    const { data: unternehmenLinks } = await window.supabase
      .from('kunde_unternehmen')
      .select('unternehmen:unternehmen_id(id, firmenname, webseite, logo_url)')
      .eq('kunde_id', this.userId);
    
    this.unternehmen = (unternehmenLinks || [])
      .map(link => link.unternehmen)
      .filter(Boolean);

    const unternehmenIds = this.unternehmen.map(u => u.id);

    // 2. Marken - ERWEITERT: über kunde_marke UND über zugeordnete Unternehmen
    const markenSet = new Set();
    
    // 2a. Direkt zugeordnete Marken über kunde_marke
    const { data: markenLinks } = await window.supabase
      .from('kunde_marke')
      .select('marke:marke_id(id, markenname, logo_url, unternehmen:unternehmen_id(firmenname))')
      .eq('kunde_id', this.userId);
    
    (markenLinks || [])
      .map(link => link.marke)
      .filter(Boolean)
      .forEach(m => markenSet.add(JSON.stringify(m)));

    // 2b. Marken über zugeordnete Unternehmen
    if (unternehmenIds.length > 0) {
      const { data: markenViaUnternehmen } = await window.supabase
        .from('marke')
        .select('id, markenname, logo_url, unternehmen:unternehmen_id(firmenname)')
        .in('unternehmen_id', unternehmenIds);
      
      (markenViaUnternehmen || [])
        .filter(Boolean)
        .forEach(m => markenSet.add(JSON.stringify(m)));
    }

    this.marken = Array.from(markenSet).map(m => JSON.parse(m));

    // 3. Kampagnen - ERWEITERT: über Marken UND über Unternehmen
    const kampagnenSet = new Map();
    const markenIds = this.marken.map(m => m.id);
    
    // 3a. Kampagnen über Marken
    if (markenIds.length > 0) {
      const { data: kampagnenViaMarke } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, status, created_at, marke:marke_id(markenname), unternehmen:unternehmen_id(firmenname)')
        .in('marke_id', markenIds)
        .order('created_at', { ascending: false })
        .limit(100);
      
      (kampagnenViaMarke || []).forEach(k => kampagnenSet.set(k.id, k));
    }

    // 3b. Kampagnen über Unternehmen
    if (unternehmenIds.length > 0) {
      const { data: kampagnenViaUnternehmen } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, status, created_at, marke:marke_id(markenname), unternehmen:unternehmen_id(firmenname)')
        .in('unternehmen_id', unternehmenIds)
        .order('created_at', { ascending: false })
        .limit(100);
      
      (kampagnenViaUnternehmen || []).forEach(k => kampagnenSet.set(k.id, k));
    }

    this.kampagnen = Array.from(kampagnenSet.values())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50);

    // 4. Kooperationen über Kampagnen
    const kampagnenIds = this.kampagnen.map(k => k.id);
    if (kampagnenIds.length > 0) {
      const { data: kooperationen } = await window.supabase
        .from('kooperation')
        .select('id, kooperationsname, status, created_at, kampagne:kampagne_id(kampagnenname)')
        .in('kampagne_id', kampagnenIds)
        .order('created_at', { ascending: false })
        .limit(50);
      
      this.kooperationen = kooperationen || [];
    } else {
      this.kooperationen = [];
    }

    // 5. Videos über Kooperationen
    const kooperationenIds = this.kooperationen.map(k => k.id);
    if (kooperationenIds.length > 0) {
      const { data: videos } = await window.supabase
        .from('kooperation_video')
        .select('id, videoname, status, version, created_at, kooperation:kooperation_id(kooperationsname)')
        .in('kooperation_id', kooperationenIds)
        .order('created_at', { ascending: false })
        .limit(50);
      
      this.videos = videos || [];
    } else {
      this.videos = [];
    }

    console.log('✅ Kunde-Entitäten geladen:', {
      unternehmen: this.unternehmen.length,
      marken: this.marken.length,
      kampagnen: this.kampagnen.length,
      kooperationen: this.kooperationen.length,
      videos: this.videos.length
    });
  }

  async loadMitarbeiterEntities() {
    // Unternehmen über mitarbeiter_unternehmen Junction
    const { data: unternehmenLinks } = await window.supabase
      .from('mitarbeiter_unternehmen')
      .select('unternehmen:unternehmen_id(id, firmenname, webseite, logo_url)')
      .eq('mitarbeiter_id', this.userId);
    
    this.unternehmen = (unternehmenLinks || [])
      .map(link => link.unternehmen)
      .filter(Boolean);

    // Marken über marke_mitarbeiter
    const { data: marken } = await window.supabase
      .from('marke_mitarbeiter')
      .select('marke:marke_id(id, markenname, logo_url, unternehmen:unternehmen_id(firmenname))')
      .eq('mitarbeiter_id', this.userId);
    
    this.marken = (marken || [])
      .map(link => link.marke)
      .filter(Boolean);

    // Aufträge
    const markenIds = this.marken.map(m => m.id);
    const unternehmenIds = this.unternehmen.map(u => u.id);
    
    if (markenIds.length > 0 || unternehmenIds.length > 0) {
      let query = window.supabase
        .from('auftrag')
        .select('id, auftragsname, status, created_at, marke:marke_id(markenname), unternehmen:unternehmen_id(firmenname)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (markenIds.length > 0) {
        query = query.in('marke_id', markenIds);
      }
      
      const { data: auftraege } = await query;
      this.auftraege = auftraege || [];
    } else {
      this.auftraege = [];
    }

    // Kampagnen über Marken UND Unternehmen (analog zu Kunde-Logik)
    const kampagnenSet = new Map();
    
    if (markenIds.length > 0) {
      const { data: kampagnenViaMarke } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, status, created_at, marke:marke_id(markenname), unternehmen:unternehmen_id(firmenname)')
        .in('marke_id', markenIds)
        .order('created_at', { ascending: false })
        .limit(100);
      
      (kampagnenViaMarke || []).forEach(k => kampagnenSet.set(k.id, k));
    }
    
    if (unternehmenIds.length > 0) {
      const { data: kampagnenViaUnternehmen } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, status, created_at, marke:marke_id(markenname), unternehmen:unternehmen_id(firmenname)')
        .in('unternehmen_id', unternehmenIds)
        .order('created_at', { ascending: false })
        .limit(100);
      
      (kampagnenViaUnternehmen || []).forEach(k => kampagnenSet.set(k.id, k));
    }
    
    this.kampagnen = Array.from(kampagnenSet.values())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50);

    // Kooperationen über zugewiesene Tasks UND über Kampagnen
    const kooperationenSet = new Map();
    
    // Via Tasks
    const { data: assignedTasks } = await window.supabase
      .from('kooperation_task')
      .select('entity_id')
      .eq('entity_type', 'kooperation')
      .eq('assigned_to_user_id', this.userId);
    
    const kooperationIdsFromTasks = [...new Set((assignedTasks || []).map(t => t.entity_id))];
    
    if (kooperationIdsFromTasks.length > 0) {
      const { data: kooperationen } = await window.supabase
        .from('kooperation')
        .select('id, kooperationsname, status, created_at, kampagne:kampagne_id(kampagnenname)')
        .in('id', kooperationIdsFromTasks)
        .order('created_at', { ascending: false });
      
      (kooperationen || []).forEach(k => kooperationenSet.set(k.id, k));
    }
    
    // Via Kampagnen
    const kampagnenIds = this.kampagnen.map(k => k.id);
    if (kampagnenIds.length > 0) {
      const { data: kooperationen } = await window.supabase
        .from('kooperation')
        .select('id, kooperationsname, status, created_at, kampagne:kampagne_id(kampagnenname)')
        .in('kampagne_id', kampagnenIds)
        .order('created_at', { ascending: false })
        .limit(50);
      
      (kooperationen || []).forEach(k => kooperationenSet.set(k.id, k));
    }
    
    this.kooperationen = Array.from(kooperationenSet.values())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50);

    // Videos
    const allKoopIds = Array.from(kooperationenSet.keys());
    if (allKoopIds.length > 0) {
      const { data: videos } = await window.supabase
        .from('kooperation_video')
        .select('id, videoname, status, version, created_at, kooperation:kooperation_id(kooperationsname)')
        .in('kooperation_id', allKoopIds)
        .order('created_at', { ascending: false })
        .limit(50);
      
      this.videos = videos || [];
    } else {
      this.videos = [];
    }

    console.log('✅ Mitarbeiter-Entitäten geladen:', {
      unternehmen: this.unternehmen.length,
      marken: this.marken.length,
      auftraege: this.auftraege.length,
      kampagnen: this.kampagnen.length,
      kooperationen: this.kooperationen.length,
      videos: this.videos.length
    });
  }

  async loadActivities() {
    try {
      const allActivities = [];

      // Kampagne History
      const { data: kampagneHistory } = await window.supabase
        .from('kampagne_history')
        .select('id, old_status, new_status, comment, created_at, kampagne:kampagne_id(name)')
        .eq('changed_by', this.userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (kampagneHistory) {
        allActivities.push(...kampagneHistory.map(h => ({
          ...h,
          type: 'kampagne',
          entity_name: h.kampagne?.name || 'Unbekannt',
          action: this.getActionLabel('status_changed', h.old_status, h.new_status)
        })));
      }

      // Kooperation History
      const { data: kooperationHistory } = await window.supabase
        .from('kooperation_history')
        .select('id, old_status, new_status, comment, created_at, kooperation:kooperation_id(name)')
        .eq('changed_by', this.userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (kooperationHistory) {
        allActivities.push(...kooperationHistory.map(h => ({
          ...h,
          type: 'kooperation',
          entity_name: h.kooperation?.name || 'Unbekannt',
          action: this.getActionLabel('status_changed', h.old_status, h.new_status)
        })));
      }

      // Task History
      const { data: taskHistory } = await window.supabase
        .from('kooperation_task_history')
        .select('id, change_type, old_value, new_value, created_at, task:task_id(title)')
        .eq('changed_by', this.userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (taskHistory) {
        allActivities.push(...taskHistory.map(h => ({
          ...h,
          type: 'task',
          entity_name: h.task?.title || 'Unbekannt',
          action: this.getActionLabel(h.change_type, h.old_value, h.new_value)
        })));
      }

      // Sortiere alle Activities nach Datum
      this.activities = allActivities.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      ).slice(0, 30);

    } catch (error) {
      console.error('❌ Fehler beim Laden der Activities:', error);
      this.activities = [];
    }
  }

  getActionLabel(changeType, oldValue, newValue) {
    const labels = {
      status_changed: `Status geändert${oldValue && newValue ? ` von "${oldValue}" zu "${newValue}"` : ''}`,
      created: 'Erstellt',
      assigned: 'Zugewiesen',
      commented: 'Kommentiert',
      attachment_added: 'Anhang hinzugefügt',
      priority_changed: 'Priorität geändert',
      due_date_changed: 'Fälligkeitsdatum geändert',
      updated: 'Aktualisiert'
    };
    return labels[changeType] || changeType;
  }

  async render() {
    const container = document.getElementById('dashboard-content');
    if (!container) {
      console.error('❌ dashboard-content Container nicht gefunden');
      return;
    }

    // Finde den main-wrapper und ersetze die Klasse
    const mainWrapper = container.closest('.main-wrapper');
    if (mainWrapper) {
      mainWrapper.classList.remove('main-wrapper');
      mainWrapper.classList.add('profile-page-container');
    }

    const isKunde = this.user?.rolle === 'kunde';
    
    container.innerHTML = `
      <div class="profile-detail-layout">
        <!-- Linke Spalte: Sidebar -->
        <div class="profile-sidebar">
          ${this.renderSidebar()}
        </div>

        <!-- Rechte Spalte: Haupt-Content -->
        <div class="profile-main-content">
          ${this.renderMainContent(isKunde)}
        </div>
      </div>
    `;
  }

  renderSidebar() {
    const userName = this.user?.name || 'Unbekannt';
    const userEmail = this.user?.email || 'Keine E-Mail';
    const initials = this.getInitials(userName);

    return `
      <div class="profile-sidebar-card">
        <!-- Avatar Section -->
        <div class="profile-avatar-section">
          <div class="profile-avatar-large profile-avatar-clickable" id="profile-avatar-upload">
            ${this.user?.profile_image_url 
              ? `<img src="${this.user.profile_image_url}" alt="${userName}" />` 
              : `<div class="profile-initials-large">${initials}</div>`
            }
            <div class="profile-avatar-overlay">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
          </div>
          <h2 class="profile-name">${this.sanitize(userName)}</h2>
          <p class="profile-email">${this.sanitize(userEmail)}</p>
        </div>

        <!-- Sidebar Tabs -->
        <div class="profile-info-tabs">
          <button class="profile-sidebar-tab ${this.activeSidebarTab === 'info' ? 'active' : ''}" data-sidebar-tab="info">
            Info
          </button>
          <button class="profile-sidebar-tab ${this.activeSidebarTab === 'activities' ? 'active' : ''}" data-sidebar-tab="activities">
            Activities
          </button>
        </div>

        <!-- Sidebar Tab Content -->
        <div class="profile-sidebar-content">
          <div class="profile-sidebar-pane ${this.activeSidebarTab === 'info' ? 'active' : ''}" id="sidebar-info">
            ${this.renderInfoTab()}
          </div>
          <div class="profile-sidebar-pane ${this.activeSidebarTab === 'activities' ? 'active' : ''}" id="sidebar-activities">
            ${this.renderActivitiesTab()}
          </div>
        </div>
      </div>
    `;
  }

  renderInfoTab() {
    const rolle = this.user?.rolle || 'Nicht definiert';
    const unterrolle = this.user?.unterrolle || 'Keine';
    const mitarbeiterKlasse = this.user?.mitarbeiter_klasse?.name || 'Nicht zugewiesen';
    const sprachenText = this.sprachen.length > 0 
      ? this.sprachen.map(s => s.name).join(', ') 
      : 'Keine Sprachen';

    return `
      <div class="profile-info-section">
        <div class="profile-info-item">
          <div class="info-label">Rolle</div>
          <div class="info-value">
            <span class="badge badge-${rolle === 'admin' ? 'primary' : 'secondary'}">${this.sanitize(rolle)}</span>
          </div>
        </div>
        
        ${unterrolle !== 'Keine' ? `
          <div class="profile-info-item">
            <div class="info-label">Unterrolle</div>
            <div class="info-value">
              <span class="badge badge-outline">${this.sanitize(unterrolle)}</span>
            </div>
          </div>
        ` : ''}
        
        ${mitarbeiterKlasse !== 'Nicht zugewiesen' ? `
          <div class="profile-info-item">
            <div class="info-label">Mitarbeiter-Klasse</div>
            <div class="info-value">${this.sanitize(mitarbeiterKlasse)}</div>
          </div>
        ` : ''}
        
        <div class="profile-info-item">
          <div class="info-label">Sprachen</div>
          <div class="info-value">${this.sanitize(sprachenText)}</div>
        </div>
        
        <div class="profile-info-item">
          <div class="info-label">Mitglied seit</div>
          <div class="info-value">${this.formatDate(this.user?.created_at)}</div>
        </div>
      </div>
    `;
  }

  renderActivitiesTab() {
    if (this.activities.length === 0) {
      return '<div class="empty-state"><p>Keine Aktivitäten vorhanden.</p></div>';
    }

    return `
      <div class="timeline">
        ${this.activities.map(activity => `
          <div class="timeline-entry">
            <div class="timeline-icon"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <strong>${this.sanitize(activity.type)}</strong>
                <span class="timeline-date">${this.formatDateTime(activity.created_at)}</span>
              </div>
              <div class="timeline-body">
                <div class="timeline-entity">${this.sanitize(activity.entity_name)}</div>
                <div class="timeline-action">${this.sanitize(activity.action)}</div>
                ${activity.comment ? `<div class="timeline-comment">${this.sanitize(activity.comment)}</div>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderMainContent(isKunde) {
    return `
      <!-- Main Tabs -->
      <div class="tab-navigation">
        <button class="tab-button ${this.activeMainTab === 'unternehmen' ? 'active' : ''}" data-main-tab="unternehmen">
          Unternehmen
          <span class="tab-count">${this.unternehmen.length}</span>
        </button>
        <button class="tab-button ${this.activeMainTab === 'marken' ? 'active' : ''}" data-main-tab="marken">
          Marken
          <span class="tab-count">${this.marken.length}</span>
        </button>
        ${!isKunde ? `
          <button class="tab-button ${this.activeMainTab === 'auftraege' ? 'active' : ''}" data-main-tab="auftraege">
            Aufträge
            <span class="tab-count">${this.auftraege.length}</span>
          </button>
        ` : ''}
        <button class="tab-button ${this.activeMainTab === 'kampagnen' ? 'active' : ''}" data-main-tab="kampagnen">
          Kampagnen
          <span class="tab-count">${this.kampagnen.length}</span>
        </button>
        <button class="tab-button ${this.activeMainTab === 'kooperationen' ? 'active' : ''}" data-main-tab="kooperationen">
          Kooperationen
          <span class="tab-count">${this.kooperationen.length}</span>
        </button>
        <button class="tab-button ${this.activeMainTab === 'videos' ? 'active' : ''}" data-main-tab="videos">
          Videos
          <span class="tab-count">${this.videos.length}</span>
        </button>
      </div>

      <!-- Main Tab Content -->
      <div class="tab-content">
        <div class="tab-pane ${this.activeMainTab === 'unternehmen' ? 'active' : ''}" id="main-unternehmen">
          ${this.renderUnternehmenTab()}
        </div>
        <div class="tab-pane ${this.activeMainTab === 'marken' ? 'active' : ''}" id="main-marken">
          ${this.renderMarkenTab()}
        </div>
        ${!isKunde ? `
          <div class="tab-pane ${this.activeMainTab === 'auftraege' ? 'active' : ''}" id="main-auftraege">
            ${this.renderAuftraegeTab()}
          </div>
        ` : ''}
        <div class="tab-pane ${this.activeMainTab === 'kampagnen' ? 'active' : ''}" id="main-kampagnen">
          ${this.renderKampagnenTab()}
        </div>
        <div class="tab-pane ${this.activeMainTab === 'kooperationen' ? 'active' : ''}" id="main-kooperationen">
          ${this.renderKooperationenTab()}
        </div>
        <div class="tab-pane ${this.activeMainTab === 'videos' ? 'active' : ''}" id="main-videos">
          ${this.renderVideosTab()}
        </div>
      </div>
    `;
  }

  renderUnternehmenTab() {
    if (this.unternehmen.length === 0) {
      return '<div class="empty-state"><p>Keine Unternehmen zugeordnet.</p></div>';
    }

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Firmenname</th>
              <th>Website</th>
              <th style="width: 80px; text-align: right;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.unternehmen.map(u => `
              <tr>
                <td>
                  <div class="entity-with-logo">
                    ${u.logo_url ? `<img src="${u.logo_url}" alt="${u.firmenname}" class="entity-logo" />` : ''}
                    <span>${this.sanitize(u.firmenname)}</span>
                  </div>
                </td>
                <td>${u.webseite ? `<a href="${u.webseite}" target="_blank" rel="noopener">${this.sanitize(u.webseite)}</a>` : '-'}</td>
                <td style="text-align: right;">
                  <div class="actions-dropdown-container" data-entity-type="unternehmen">
                    <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                        <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                      </svg>
                    </button>
                    <div class="actions-dropdown">
                      <a href="#" class="action-item" data-action="view" data-id="${u.id}">Details anzeigen</a>
                    </div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderMarkenTab() {
    if (this.marken.length === 0) {
      return '<div class="empty-state"><p>Keine Marken zugeordnet.</p></div>';
    }

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Markenname</th>
              <th>Unternehmen</th>
              <th style="width: 80px; text-align: right;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.marken.map(m => `
              <tr>
                <td>
                  <div class="entity-with-logo">
                    ${m.logo_url ? `<img src="${m.logo_url}" alt="${m.markenname}" class="entity-logo" />` : ''}
                    <span>${this.sanitize(m.markenname)}</span>
                  </div>
                </td>
                <td>${m.unternehmen?.firmenname ? this.sanitize(m.unternehmen.firmenname) : '-'}</td>
                <td style="text-align: right;">
                  <div class="actions-dropdown-container" data-entity-type="marke">
                    <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                        <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                      </svg>
                    </button>
                    <div class="actions-dropdown">
                      <a href="#" class="action-item" data-action="view" data-id="${m.id}">Details anzeigen</a>
                    </div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderAuftraegeTab() {
    if (this.auftraege.length === 0) {
      return '<div class="empty-state"><p>Keine Aufträge zugeordnet.</p></div>';
    }

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Auftragsname</th>
              <th>Marke</th>
              <th>Status</th>
              <th>Erstellt am</th>
              <th style="width: 80px; text-align: right;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.auftraege.map(a => `
              <tr>
                <td>${this.sanitize(a.auftragsname)}</td>
                <td>${a.marke?.markenname ? this.sanitize(a.marke.markenname) : '-'}</td>
                <td><span class="badge badge-secondary">${this.sanitize(a.status || 'Unbekannt')}</span></td>
                <td>${this.formatDate(a.created_at)}</td>
                <td style="text-align: right;">
                  <div class="actions-dropdown-container" data-entity-type="auftrag">
                    <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                        <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                      </svg>
                    </button>
                    <div class="actions-dropdown">
                      <a href="#" class="action-item" data-action="view" data-id="${a.id}">Details anzeigen</a>
                    </div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderKampagnenTab() {
    if (this.kampagnen.length === 0) {
      return '<div class="empty-state"><p>Keine Kampagnen zugeordnet.</p></div>';
    }

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kampagnenname</th>
              <th>Marke</th>
              <th>Status</th>
              <th>Erstellt am</th>
              <th style="width: 80px; text-align: right;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.kampagnen.map(k => `
              <tr>
                <td>${this.sanitize(k.kampagnenname)}</td>
                <td>${k.marke?.markenname ? this.sanitize(k.marke.markenname) : (k.unternehmen?.firmenname ? this.sanitize(k.unternehmen.firmenname) : '-')}</td>
                <td><span class="badge badge-secondary">${this.sanitize(k.status || 'Unbekannt')}</span></td>
                <td>${this.formatDate(k.created_at)}</td>
                <td style="text-align: right;">
                  <div class="actions-dropdown-container" data-entity-type="kampagne">
                    <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                        <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                      </svg>
                    </button>
                    <div class="actions-dropdown">
                      <a href="#" class="action-item" data-action="view" data-id="${k.id}">Details anzeigen</a>
                    </div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderKooperationenTab() {
    if (this.kooperationen.length === 0) {
      return '<div class="empty-state"><p>Keine Kooperationen zugeordnet.</p></div>';
    }

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kooperationsname</th>
              <th>Kampagne</th>
              <th>Status</th>
              <th>Erstellt am</th>
              <th style="width: 80px; text-align: right;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.kooperationen.map(k => `
              <tr>
                <td>${this.sanitize(k.kooperationsname)}</td>
                <td>${k.kampagne?.kampagnenname ? this.sanitize(k.kampagne.kampagnenname) : '-'}</td>
                <td><span class="badge badge-secondary">${this.sanitize(k.status || 'Unbekannt')}</span></td>
                <td>${this.formatDate(k.created_at)}</td>
                <td style="text-align: right;">
                  <div class="actions-dropdown-container" data-entity-type="kooperation">
                    <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                        <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                      </svg>
                    </button>
                    <div class="actions-dropdown">
                      <a href="#" class="action-item" data-action="view" data-id="${k.id}">Details anzeigen</a>
                    </div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderVideosTab() {
    if (this.videos.length === 0) {
      return '<div class="empty-state"><p>Keine Videos zugeordnet.</p></div>';
    }

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Videoname</th>
              <th>Kooperation</th>
              <th>Version</th>
              <th>Status</th>
              <th>Erstellt am</th>
              <th style="width: 80px; text-align: right;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.videos.map(v => `
              <tr>
                <td>${this.sanitize(v.videoname || 'Unbenannt')}</td>
                <td>${v.kooperation?.kooperationsname ? this.sanitize(v.kooperation.kooperationsname) : '-'}</td>
                <td><span class="badge badge-outline">V${v.version || 1}</span></td>
                <td><span class="badge badge-secondary">${this.sanitize(v.status || 'Unbekannt')}</span></td>
                <td>${this.formatDate(v.created_at)}</td>
                <td style="text-align: right;">
                  <div class="actions-dropdown-container" data-entity-type="video">
                    <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                        <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                      </svg>
                    </button>
                    <div class="actions-dropdown">
                      <a href="#" class="action-item" data-action="view" data-id="${v.id}">Details anzeigen</a>
                    </div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  bind() {
    // Avatar Upload Click
    const avatarBtn = document.getElementById('profile-avatar-upload');
    avatarBtn?.addEventListener('click', () => {
      profileImageUpload.open(this.userId, async () => {
        // Nach Upload neu laden
        await this.loadUserData();
        await this.render();
        this.bind();
      });
    });

    // Sidebar Tabs
    document.querySelectorAll('[data-sidebar-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.sidebarTab;
        this.activeSidebarTab = tab;
        
        // Update UI
        document.querySelectorAll('.profile-sidebar-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.profile-sidebar-pane').forEach(p => p.classList.remove('active'));
        
        e.currentTarget.classList.add('active');
        document.getElementById(`sidebar-${tab}`)?.classList.add('active');
      });
    });

    // Main Tabs
    document.querySelectorAll('[data-main-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.mainTab;
        this.activeMainTab = tab;
        
        // Update UI
        document.querySelectorAll('.tab-button').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        
        e.currentTarget.classList.add('active');
        document.getElementById(`main-${tab}`)?.classList.add('active');
      });
    });
  }

  getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  sanitize(text) {
    if (!text) return '';
    return window.validatorSystem?.sanitizeHtml?.(String(text)) ?? String(text);
  }

  formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  }

  formatDateTime(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  destroy() {
    // Stelle die original main-wrapper Klasse wieder her
    const container = document.getElementById('dashboard-content');
    if (container) {
      const mainWrapper = container.closest('.profile-page-container');
      if (mainWrapper) {
        mainWrapper.classList.remove('profile-page-container');
        mainWrapper.classList.add('main-wrapper');
      }
    }
    console.log('ProfileDetailV2: Cleaning up...');
  }
}

export const profileDetailV2 = new ProfileDetailV2();

