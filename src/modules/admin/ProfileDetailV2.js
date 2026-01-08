// ProfileDetailV2.js (ES6-Modul)
// Moderne Profilseite mit zweispaltigem Layout
// Nutzt einheitliches PersonDetailBase Pattern

import { profileImageUpload } from './ProfileImageUpload.js';
import { PersonDetailBase } from './PersonDetailBase.js';
import { getTabIcon } from '../../core/TabUtils.js';

export class ProfileDetailV2 extends PersonDetailBase {
  constructor() {
    super();
    this.userId = null;
    this.user = null;
    this.unternehmen = [];
    this.marken = [];
    this.auftraege = [];
    this.kampagnen = [];
    this.kooperationen = [];
    this.videos = [];
    this.sprachen = [];
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
    await this.loadActivitiesData();
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
    const { data: unternehmenLinks } = await window.supabase
      .from('kunde_unternehmen')
      .select('unternehmen:unternehmen_id(id, firmenname, webseite, logo_url)')
      .eq('kunde_id', this.userId);
    
    this.unternehmen = (unternehmenLinks || [])
      .map(link => link.unternehmen)
      .filter(Boolean);

    const unternehmenIds = this.unternehmen.map(u => u.id);

    const markenSet = new Set();
    
    const { data: markenLinks } = await window.supabase
      .from('kunde_marke')
      .select('marke:marke_id(id, markenname, logo_url, unternehmen:unternehmen_id(firmenname))')
      .eq('kunde_id', this.userId);
    
    (markenLinks || [])
      .map(link => link.marke)
      .filter(Boolean)
      .forEach(m => markenSet.add(JSON.stringify(m)));

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

    const kampagnenSet = new Map();
    const markenIds = this.marken.map(m => m.id);
    
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

    const kampagnenIds = this.kampagnen.map(k => k.id);
    if (kampagnenIds.length > 0) {
      const { data: kooperationen } = await window.supabase
        .from('kooperationen')
        .select('id, name, status, created_at, kampagne:kampagne_id(kampagnenname)')
        .in('kampagne_id', kampagnenIds)
        .order('created_at', { ascending: false })
        .limit(50);
      
      this.kooperationen = kooperationen || [];
    } else {
      this.kooperationen = [];
    }

    const kooperationenIds = this.kooperationen.map(k => k.id);
    if (kooperationenIds.length > 0) {
      const { data: videos } = await window.supabase
        .from('kooperation_video')
        .select('id, videoname, status, version, created_at, kooperation:kooperation_id(name)')
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
    const { data: unternehmenLinks } = await window.supabase
      .from('mitarbeiter_unternehmen')
      .select('unternehmen:unternehmen_id(id, firmenname, webseite, logo_url)')
      .eq('mitarbeiter_id', this.userId);
    
    this.unternehmen = (unternehmenLinks || [])
      .map(link => link.unternehmen)
      .filter(Boolean);

    const { data: marken } = await window.supabase
      .from('marke_mitarbeiter')
      .select('marke:marke_id(id, markenname, logo_url, unternehmen:unternehmen_id(firmenname))')
      .eq('mitarbeiter_id', this.userId);
    
    this.marken = (marken || [])
      .map(link => link.marke)
      .filter(Boolean);

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

    const kooperationenSet = new Map();
    
    const { data: assignedTasks } = await window.supabase
      .from('kooperation_task')
      .select('entity_id')
      .eq('entity_type', 'kooperation')
      .eq('assigned_to_user_id', this.userId);
    
    const kooperationIdsFromTasks = [...new Set((assignedTasks || []).map(t => t.entity_id))];
    
    if (kooperationIdsFromTasks.length > 0) {
      const { data: kooperationen } = await window.supabase
        .from('kooperationen')
        .select('id, name, status, created_at, kampagne:kampagne_id(kampagnenname)')
        .in('id', kooperationIdsFromTasks)
        .order('created_at', { ascending: false });
      
      (kooperationen || []).forEach(k => kooperationenSet.set(k.id, k));
    }
    
    const kampagnenIds = this.kampagnen.map(k => k.id);
    if (kampagnenIds.length > 0) {
      const { data: kooperationen } = await window.supabase
        .from('kooperationen')
        .select('id, name, status, created_at, kampagne:kampagne_id(kampagnenname)')
        .in('kampagne_id', kampagnenIds)
        .order('created_at', { ascending: false })
        .limit(50);
      
      (kooperationen || []).forEach(k => kooperationenSet.set(k.id, k));
    }
    
    this.kooperationen = Array.from(kooperationenSet.values())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50);

    const allKoopIds = Array.from(kooperationenSet.keys());
    if (allKoopIds.length > 0) {
      const { data: videos } = await window.supabase
        .from('kooperation_video')
        .select('id, videoname, status, version, created_at, kooperation:kooperation_id(name)')
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

  async loadActivitiesData() {
    try {
      const allActivities = [];

      const { data: kampagneHistory } = await window.supabase
        .from('kampagne_history')
        .select('id, old_status, new_status, comment, created_at, kampagne:kampagne_id(kampagnenname)')
        .eq('changed_by', this.userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (kampagneHistory) {
        allActivities.push(...kampagneHistory.map(h => ({
          ...h,
          type: 'kampagne',
          title: 'Kampagne',
          entity_name: h.kampagne?.kampagnenname || 'Unbekannt',
          action: h.old_status && h.new_status ? `Status: ${h.old_status} → ${h.new_status}` : 'Status geändert'
        })));
      }

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
          title: 'Kooperation',
          entity_name: h.kooperation?.name || 'Unbekannt',
          action: h.old_status && h.new_status ? `Status: ${h.old_status} → ${h.new_status}` : 'Status geändert'
        })));
      }

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
          title: 'Aufgabe',
          entity_name: h.task?.title || 'Unbekannt',
          action: this.getActionLabel(h.change_type, h.old_value, h.new_value)
        })));
      }

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

    const mainWrapper = container.closest('.main-wrapper');
    if (mainWrapper) {
      mainWrapper.classList.remove('main-wrapper');
      mainWrapper.classList.add('profile-page-container');
    }

    const isKunde = this.user?.rolle === 'kunde';
    
    // Person-Config für die Sidebar
    const personConfig = {
      name: this.user?.name || 'Unbekannt',
      email: this.user?.email || '',
      subtitle: this.user?.mitarbeiter_klasse?.name || this.user?.rolle || 'Benutzer',
      avatarUrl: this.user?.profile_image_url,
      avatarOnly: true,
      avatarClickable: true,
      lastActivity: this.user?.updated_at
    };

    // Quick Actions
    const quickActions = [];

    // Info-Items für Sidebar
    const sidebarInfo = this.renderProfileInfo();

    // Tab-Navigation (oben über volle Breite)
    const tabNavigation = this.renderProfileTabNavigation(isKunde);

    // Main Content (nur Tab-Content, ohne Navigation)
    const mainContent = this.renderProfileMainContent(isKunde);

    // Layout mit Tabs oben rendern
    const html = this.renderTwoColumnLayout({
      person: personConfig,
      stats: [],
      quickActions,
      sidebarInfo,
      mainContent,
      tabNavigation
    });

    container.innerHTML = html;
  }

  renderProfileInfo() {
    const rolle = this.user?.rolle || 'Nicht definiert';
    const unterrolle = this.user?.unterrolle || 'Keine';
    const mitarbeiterKlasse = this.user?.mitarbeiter_klasse?.name || 'Nicht zugewiesen';
    const sprachenText = this.sprachen.length > 0 
      ? this.sprachen.map(s => s.name).join(', ') 
      : 'Keine Sprachen';

    const items = [
      { label: 'Rolle', value: rolle, badge: true, badgeType: rolle === 'admin' ? 'primary' : 'secondary' }
    ];

    if (unterrolle !== 'Keine') {
      items.push({ label: 'Unterrolle', value: unterrolle, badge: true, badgeType: 'outline' });
    }

    if (mitarbeiterKlasse !== 'Nicht zugewiesen') {
      items.push({ label: 'Klasse', value: mitarbeiterKlasse });
    }

    items.push({ label: 'Sprachen', value: sprachenText });
    items.push({ label: 'Mitglied seit', value: this.formatDate(this.user?.created_at) });

    return this.renderInfoItems(items);
  }

  renderProfileTabNavigation(isKunde) {
    const renderMainTab = (tab, label, count) => `
      <button class="tab-button ${this.activeMainTab === tab ? 'active' : ''}" data-main-tab="${tab}">
        <span class="tab-icon">${getTabIcon(tab)}</span>
        ${label}<span class="tab-count">${count}</span>
      </button>
    `;

    return `
      ${renderMainTab('unternehmen', 'Unternehmen', this.unternehmen.length)}
      ${renderMainTab('marken', 'Marken', this.marken.length)}
      ${!isKunde ? renderMainTab('auftraege', 'Aufträge', this.auftraege.length) : ''}
      ${renderMainTab('kampagnen', 'Kampagnen', this.kampagnen.length)}
      ${renderMainTab('kooperationen', 'Kooperationen', this.kooperationen.length)}
      ${renderMainTab('videos', 'Videos', this.videos.length)}
    `;
  }

  renderProfileMainContent(isKunde) {
    return `
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
                  <a href="/unternehmen/${u.id}" onclick="event.preventDefault(); window.navigateTo('/unternehmen/${u.id}')" class="secondary-btn btn-sm">Details</a>
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
                  <a href="/marke/${m.id}" onclick="event.preventDefault(); window.navigateTo('/marke/${m.id}')" class="secondary-btn btn-sm">Details</a>
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
                  <a href="/auftrag/${a.id}" onclick="event.preventDefault(); window.navigateTo('/auftrag/${a.id}')" class="secondary-btn btn-sm">Details</a>
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
                  <a href="/kampagne/${k.id}" onclick="event.preventDefault(); window.navigateTo('/kampagne/${k.id}')" class="secondary-btn btn-sm">Details</a>
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
              <th>Name</th>
              <th>Kampagne</th>
              <th>Status</th>
              <th>Erstellt am</th>
              <th style="width: 80px; text-align: right;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.kooperationen.map(k => `
              <tr>
                <td>${this.sanitize(k.name)}</td>
                <td>${k.kampagne?.kampagnenname ? this.sanitize(k.kampagne.kampagnenname) : '-'}</td>
                <td><span class="badge badge-secondary">${this.sanitize(k.status || 'Unbekannt')}</span></td>
                <td>${this.formatDate(k.created_at)}</td>
                <td style="text-align: right;">
                  <a href="/kooperation/${k.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${k.id}')" class="secondary-btn btn-sm">Details</a>
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
            </tr>
          </thead>
          <tbody>
            ${this.videos.map(v => `
              <tr>
                <td>${this.sanitize(v.videoname || 'Unbenannt')}</td>
                <td>${v.kooperation?.name ? this.sanitize(v.kooperation.name) : '-'}</td>
                <td><span class="badge badge-outline">V${v.version || 1}</span></td>
                <td><span class="badge badge-secondary">${this.sanitize(v.status || 'Unbekannt')}</span></td>
                <td>${this.formatDate(v.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  bind() {
    // Sidebar Tabs binden (aus Basis-Klasse)
    this.bindSidebarTabs();

    // Avatar Upload Click
    const avatarBtn = document.getElementById('profile-avatar-upload');
    avatarBtn?.addEventListener('click', () => {
      profileImageUpload.open(this.userId, async () => {
        await this.loadUserData();
        await this.render();
        this.bind();
      });
    });

    // Main Tabs
    document.querySelectorAll('[data-main-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.mainTab;
        this.activeMainTab = tab;
        
        document.querySelectorAll('.tab-button').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        
        e.currentTarget.classList.add('active');
        document.getElementById(`main-${tab}`)?.classList.add('active');
      });
    });

    // Edit Profile Action
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="edit-profile"]')) {
        e.preventDefault();
        // TODO: Profil-Bearbeitung implementieren
        console.log('Profil bearbeiten geklickt');
      }
    });
  }

  destroy() {
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
