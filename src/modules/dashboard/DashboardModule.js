// DashboardModule.js (ES6-Modul)
// Hauptdashboard für CRM-Mitarbeiter

export class DashboardModule {
  constructor() {
    this.data = {
      stats: {},
      deadlines: [],
      recentActivity: [],
      alerts: []
    };
    this.refreshInterval = null;
  }

  async init() {
    window.setHeadline('Dashboard');
    await this.loadDashboardData();
    await this.render();
    this.setupEventListeners();
    this.startAutoRefresh();
  }

  async loadDashboardData() {
    try {
      await Promise.all([
        this.loadStats(),
        this.loadUpcomingDeadlines(),
        this.loadRecentActivity(),
        this.loadAlerts()
      ]);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Dashboard-Daten:', error);
    }
  }

  async loadStats() {
    try {
      if (!window.supabase) {
        this.data.stats = this.getMockStats();
        return;
      }

      // Parallele Abfragen für bessere Performance
      const [
        { data: kampagnen },
        { data: auftraege },
        { data: briefings },
        { data: kooperationen },
        { data: creator },
        { data: rechnungen }
      ] = await Promise.all([
        window.supabase.from('kampagne').select('id, status_id, deadline'),
        window.supabase.from('auftrag').select('id, status, ende, re_faelligkeit'),
        window.supabase.from('briefings').select('id, status, deadline'),
        window.supabase.from('kooperationen').select('id, status, content_deadline, skript_deadline'),
        window.supabase.from('creator').select('id'),
        window.supabase.from('rechnungen').select('id, status, zahlungsziel')
      ]);

      this.data.stats = {
        kampagnen: {
          total: kampagnen?.length || 0,
          aktiv: kampagnen?.filter(k => k.status_id === 'active')?.length || 0,
          ueberfaellig: kampagnen?.filter(k => k.deadline && new Date(k.deadline) < new Date())?.length || 0
        },
        auftraege: {
          total: auftraege?.length || 0,
          aktiv: auftraege?.filter(a => a.status === 'aktiv')?.length || 0,
          ueberfaellig: auftraege?.filter(a => a.ende && new Date(a.ende) < new Date())?.length || 0
        },
        briefings: {
          total: briefings?.length || 0,
          offen: briefings?.filter(b => b.status !== 'completed')?.length || 0,
          ueberfaellig: briefings?.filter(b => b.deadline && new Date(b.deadline) < new Date())?.length || 0
        },
        kooperationen: {
          total: kooperationen?.length || 0,
          aktiv: kooperationen?.filter(k => k.status === 'active')?.length || 0
        },
        creator: {
          total: creator?.length || 0
        },
        rechnungen: {
          total: rechnungen?.length || 0,
          offen: rechnungen?.filter(r => r.status !== 'bezahlt')?.length || 0,
          ueberfaellig: rechnungen?.filter(r => r.zahlungsziel && new Date(r.zahlungsziel) < new Date())?.length || 0
        }
      };
    } catch (error) {
      console.error('❌ Fehler beim Laden der Statistiken:', error);
      this.data.stats = this.getMockStats();
    }
  }

  async loadUpcomingDeadlines() {
    try {
      if (!window.supabase) {
        this.data.deadlines = this.getMockDeadlines();
        return;
      }

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      const [
        { data: kampagnenDeadlines },
        { data: briefingDeadlines },
        { data: kooperationSkriptDeadlines },
        { data: kooperationContentDeadlines },
        { data: rechnungDeadlines }
      ] = await Promise.all([
        window.supabase
          .from('kampagne')
          .select('id, kampagnenname, deadline, unternehmen:unternehmen_id(firmenname)')
          .lte('deadline', nextWeekStr)
          .gte('deadline', new Date().toISOString().split('T')[0]),
        
        window.supabase
          .from('briefings')
          .select('id, product_service_offer, deadline, unternehmen:unternehmen_id(firmenname)')
          .lte('deadline', nextWeekStr)
          .gte('deadline', new Date().toISOString().split('T')[0]),
        
        window.supabase
          .from('kooperationen')
          .select('id, name, skript_deadline, creator:creator_id(vorname, nachname)')
          .lte('skript_deadline', nextWeekStr)
          .gte('skript_deadline', new Date().toISOString().split('T')[0]),
        
        window.supabase
          .from('kooperationen')
          .select('id, name, content_deadline, creator:creator_id(vorname, nachname)')
          .lte('content_deadline', nextWeekStr)
          .gte('content_deadline', new Date().toISOString().split('T')[0]),
        
        window.supabase
          .from('rechnungen')
          .select('id, rechnungs_nr, zahlungsziel, unternehmen:unternehmen_id(firmenname)')
          .lte('zahlungsziel', nextWeekStr)
          .gte('zahlungsziel', new Date().toISOString().split('T')[0])
      ]);

      this.data.deadlines = [
        ...(kampagnenDeadlines?.map(k => ({
          type: 'kampagne',
          id: k.id,
          title: k.kampagnenname,
          subtitle: k.unternehmen?.firmenname,
          deadline: k.deadline,
          priority: this.getDeadlinePriority(k.deadline),
          url: `/kampagne/${k.id}`
        })) || []),
        
        ...(briefingDeadlines?.map(b => ({
          type: 'briefing',
          id: b.id,
          title: b.product_service_offer,
          subtitle: b.unternehmen?.firmenname,
          deadline: b.deadline,
          priority: this.getDeadlinePriority(b.deadline),
          url: `/briefing/${b.id}`
        })) || []),
        
        ...(kooperationSkriptDeadlines?.map(k => ({
          type: 'kooperation-skript',
          id: k.id,
          title: `Skript: ${k.name || 'Kooperation'}`,
          subtitle: `${k.creator?.vorname} ${k.creator?.nachname}`,
          deadline: k.skript_deadline,
          priority: this.getDeadlinePriority(k.skript_deadline),
          url: `/kooperation/${k.id}`
        })) || []),
        
        ...(kooperationContentDeadlines?.map(k => ({
          type: 'kooperation-content',
          id: k.id,
          title: `Content: ${k.name || 'Kooperation'}`,
          subtitle: `${k.creator?.vorname} ${k.creator?.nachname}`,
          deadline: k.content_deadline,
          priority: this.getDeadlinePriority(k.content_deadline),
          url: `/kooperation/${k.id}`
        })) || []),
        
        ...(rechnungDeadlines?.map(r => ({
          type: 'rechnung',
          id: r.id,
          title: `Rechnung ${r.rechnungs_nr}`,
          subtitle: r.unternehmen?.firmenname,
          deadline: r.zahlungsziel,
          priority: this.getDeadlinePriority(r.zahlungsziel),
          url: `/rechnung/${r.id}`
        })) || [])
      ].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    } catch (error) {
      console.error('❌ Fehler beim Laden der Deadlines:', error);
      this.data.deadlines = this.getMockDeadlines();
    }
  }

  async loadRecentActivity() {
    try {
      if (!window.supabase) {
        this.data.recentActivity = this.getMockActivity();
        return;
      }

      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastWeekStr = lastWeek.toISOString();

      const [
        { data: recentKampagnen },
        { data: recentAuftraege },
        { data: recentBriefings }
      ] = await Promise.all([
        window.supabase
          .from('kampagne')
          .select('id, kampagnenname, created_at, unternehmen:unternehmen_id(firmenname)')
          .gte('created_at', lastWeekStr)
          .order('created_at', { ascending: false })
          .limit(5),
        
        window.supabase
          .from('auftrag')
          .select('id, auftragsname, created_at, unternehmen:unternehmen_id(firmenname)')
          .gte('created_at', lastWeekStr)
          .order('created_at', { ascending: false })
          .limit(5),
        
        window.supabase
          .from('briefings')
          .select('id, product_service_offer, created_at, unternehmen:unternehmen_id(firmenname)')
          .gte('created_at', lastWeekStr)
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      this.data.recentActivity = [
        ...(recentKampagnen?.map(k => ({
          type: 'kampagne',
          title: k.kampagnenname,
          subtitle: k.unternehmen?.firmenname,
          timestamp: k.created_at,
          url: `/kampagne/${k.id}`
        })) || []),
        ...(recentAuftraege?.map(a => ({
          type: 'auftrag',
          title: a.auftragsname,
          subtitle: a.unternehmen?.firmenname,
          timestamp: a.created_at,
          url: `/auftrag/${a.id}`
        })) || []),
        ...(recentBriefings?.map(b => ({
          type: 'briefing',
          title: b.product_service_offer,
          subtitle: b.unternehmen?.firmenname,
          timestamp: b.created_at,
          url: `/briefing/${b.id}`
        })) || [])
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8);

    } catch (error) {
      console.error('❌ Fehler beim Laden der Aktivitäten:', error);
      this.data.recentActivity = this.getMockActivity();
    }
  }

  async loadAlerts() {
    try {
      if (!window.supabase) {
        this.data.alerts = this.getMockAlerts();
        return;
      }

      const now = new Date();
      const alerts = [];

      // Überfällige Deadlines
      const { data: overdueKampagnen } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, deadline')
        .lt('deadline', now.toISOString())
        .neq('status_id', 'completed');

      overdueKampagnen?.forEach(k => {
        alerts.push({
          type: 'error',
          title: 'Überfällige Kampagne',
          message: `${k.kampagnenname} - Deadline überschritten`,
          url: `/kampagne/${k.id}`,
          timestamp: k.deadline
        });
      });

      // Heute fällige Deadlines
      const today = now.toISOString().split('T')[0];
      const { data: todayDeadlines } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, deadline')
        .eq('deadline', today);

      todayDeadlines?.forEach(k => {
        alerts.push({
          type: 'warning',
          title: 'Deadline heute',
          message: `${k.kampagnenname} - heute fällig`,
          url: `/kampagne/${k.id}`,
          timestamp: k.deadline
        });
      });

      this.data.alerts = alerts.slice(0, 5);

    } catch (error) {
      console.error('❌ Fehler beim Laden der Alerts:', error);
      this.data.alerts = this.getMockAlerts();
    }
  }

  async render() {
    // Prüfe ob User pending ist
    const isPending = window.currentUser?.rolle === 'pending';
    
    const html = `
      <div class="dashboard-container">
        <!-- Dashboard Header -->
        <div class="page-header">
          <div class="page-header-left">
            <h1>Dashboard</h1>
            <p>${isPending ? 'Ihr Account wartet auf Freischaltung durch einen Administrator' : 'Überblick über alle wichtigen Kennzahlen und Deadlines'}</p>
          </div>
          <div class="page-header-right">
            ${!isPending ? `
            <button id="dashboard-refresh" class="secondary-btn">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px; margin-right: 8px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Aktualisieren
            </button>
            ` : ''}
          </div>
        </div>

        ${isPending ? this.renderPendingMessage() : ''}

        ${!isPending ? `
        <!-- KPI Cards -->
        <div class="dashboard-stats">
          ${this.renderStatsCards()}
        </div>

        <!-- Deadlines Section -->
        <div class="content-section">
          <div class="section-header">
            <h2>Anstehende Deadlines</h2>
            <span class="section-count">${this.data.deadlines.length} Einträge</span>
          </div>
          ${this.renderDeadlinesTable()}
        </div>

        <!-- Alerts Section -->
        <div class="content-section">
          <div class="section-header">
            <h2>Wichtige Hinweise</h2>
            <span class="section-count">${this.data.alerts.length} Einträge</span>
          </div>
          ${this.renderAlertsTable()}
        </div>

        <!-- Recent Activity Section -->
        <div class="content-section">
          <div class="section-header">
            <h2>Letzte Aktivitäten</h2>
            <span class="section-count">${this.data.recentActivity.length} Einträge</span>
          </div>
          ${this.renderRecentActivityTable()}
        </div>
        ` : ''}
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  renderPendingMessage() {
    return `
      <div class="content-section">
        <div class="pending-user-message">
          <div class="pending-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 48px; height: 48px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h3>Account wartet auf Freischaltung</h3>
          <p>Ihr Account wurde erfolgreich erstellt und wartet nun auf die Freischaltung durch einen Administrator.</p>
          <div class="pending-details">
            <div class="pending-info">
              <strong>Name:</strong> ${window.currentUser?.name || 'Unbekannt'}
            </div>
            <div class="pending-info">
              <strong>E-Mail:</strong> Aus Sicherheitsgründen ausgeblendet
            </div>
            <div class="pending-info">
              <strong>Status:</strong> <span class="pending-status">Warten auf Freischaltung</span>
            </div>
          </div>
          <div class="pending-actions">
            <p><strong>Was passiert als nächstes?</strong></p>
            <ul>
              <li>Ein Administrator wird Ihren Account in Kürze überprüfen</li>
              <li>Sie erhalten eine E-Mail, sobald Ihr Account freigeschaltet wurde</li>
              <li>Nach der Freischaltung haben Sie Zugriff auf alle freigegebenen Module</li>
            </ul>
          </div>
          <div class="pending-contact">
            <p>Bei Fragen wenden Sie sich bitte an einen Administrator.</p>
          </div>
        </div>
      </div>
      
      <style>
        .pending-user-message {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          max-width: 600px;
          margin: 0 auto;
        }
        
        .pending-icon {
          margin-bottom: 1rem;
          color: #64748b;
        }
        
        .pending-user-message h3 {
          color: #1e293b;
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        .pending-user-message > p {
          color: #64748b;
          font-size: 1.1rem;
          margin-bottom: 1.5rem;
          line-height: 1.6;
        }
        
        .pending-details {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          margin: 1.5rem 0;
          text-align: left;
          border: 1px solid #e2e8f0;
        }
        
        .pending-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #f1f5f9;
        }
        
        .pending-info:last-child {
          border-bottom: none;
        }
        
        .pending-status {
          color: #f59e0b;
          font-weight: 600;
          background: #fef3c7;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
        }
        
        .pending-actions {
          background: #f8fafc;
          border-radius: 8px;
          padding: 1.5rem;
          margin: 1.5rem 0;
          text-align: left;
        }
        
        .pending-actions p {
          margin-bottom: 1rem;
          color: #1e293b;
          font-weight: 600;
        }
        
        .pending-actions ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .pending-actions li {
          color: #64748b;
          padding: 0.5rem 0;
          position: relative;
          padding-left: 1.5rem;
        }
        
        .pending-actions li::before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #10b981;
          font-weight: bold;
        }
        
        .pending-contact {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 0.95rem;
        }
      </style>
    `;
  }

  renderStatsCards() {
    const stats = this.data.stats;
    return `
      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${stats.kampagnen?.aktiv || 0}</div>
          <div class="stats-label">Aktive Kampagnen</div>
          <div class="stats-sublabel">${stats.kampagnen?.total || 0} gesamt</div>
        </div>
        ${stats.kampagnen?.ueberfaellig > 0 ? `<div class="stats-alert">${stats.kampagnen.ueberfaellig} überfällig</div>` : ''}
      </div>

      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${stats.auftraege?.aktiv || 0}</div>
          <div class="stats-label">Aktive Aufträge</div>
          <div class="stats-sublabel">${stats.auftraege?.total || 0} gesamt</div>
        </div>
        ${stats.auftraege?.ueberfaellig > 0 ? `<div class="stats-alert">${stats.auftraege.ueberfaellig} überfällig</div>` : ''}
      </div>

      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 11.625h4.5m-4.5 2.25h4.5m2.121 1.527c-1.171 1.464-3.07 1.464-4.242 0-1.172-1.465-1.172-3.84 0-5.304 1.171-1.464 3.07-1.464 4.242 0M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${stats.briefings?.offen || 0}</div>
          <div class="stats-label">Offene Briefings</div>
          <div class="stats-sublabel">${stats.briefings?.total || 0} gesamt</div>
        </div>
        ${stats.briefings?.ueberfaellig > 0 ? `<div class="stats-alert">${stats.briefings.ueberfaellig} überfällig</div>` : ''}
      </div>

      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12s-1.536.219-2.121.659c-1.172.879-1.172 2.303 0 3.182.879.659 1.879.659 2.758 0L15 13.5M12 6V4.5" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${stats.rechnungen?.offen || 0}</div>
          <div class="stats-label">Offene Rechnungen</div>
          <div class="stats-sublabel">${stats.rechnungen?.total || 0} gesamt</div>
        </div>
        ${stats.rechnungen?.ueberfaellig > 0 ? `<div class="stats-alert">${stats.rechnungen.ueberfaellig} überfällig</div>` : ''}
      </div>

      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${stats.creator?.total || 0}</div>
          <div class="stats-label">Creator</div>
          <div class="stats-sublabel">Im System</div>
        </div>
      </div>
    `;
  }

  renderDeadlinesTable() {
    if (!this.data.deadlines.length) {
      return `
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Titel</th>
                <th>Unternehmen</th>
                <th>Deadline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="no-data">Keine anstehenden Deadlines</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    const rows = this.data.deadlines.map(deadline => {
      const daysUntil = Math.ceil((new Date(deadline.deadline) - new Date()) / (1000 * 60 * 60 * 24));
      const isOverdue = daysUntil < 0;
      const isToday = daysUntil === 0;
      
      const statusBadge = isOverdue ? 
        '<span class="status-badge danger">Überfällig</span>' :
        isToday ? 
        '<span class="status-badge warning">Heute</span>' :
        daysUntil <= 3 ?
        '<span class="status-badge warning">Dringend</span>' :
        '<span class="status-badge info">Normal</span>';

      const typeLabel = {
        'kampagne': 'Kampagne',
        'briefing': 'Briefing', 
        'kooperation-skript': 'Skript',
        'kooperation-content': 'Content',
        'rechnung': 'Rechnung'
      }[deadline.type] || deadline.type;

      return `
        <tr class="table-row-clickable" onclick="window.navigateTo('${deadline.url}')">
          <td>
            <span class="type-badge type-${deadline.type}">${typeLabel}</span>
          </td>
          <td class="cell-main">
            <div class="cell-title">${deadline.title}</div>
          </td>
          <td>${deadline.subtitle || '-'}</td>
          <td>
            <div class="deadline-cell">
              <div class="deadline-date">${new Date(deadline.deadline).toLocaleDateString('de-DE')}</div>
              <div class="deadline-time">${
                isOverdue ? `${Math.abs(daysUntil)} Tage überfällig` :
                isToday ? 'Heute fällig' :
                `in ${daysUntil} Tagen`
              }</div>
            </div>
          </td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Titel</th>
              <th>Unternehmen</th>
              <th>Deadline</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  renderAlertsTable() {
    if (!this.data.alerts.length) {
      return `
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Nachricht</th>
                <th>Zeit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="3" class="no-data">Keine wichtigen Hinweise</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    const rows = this.data.alerts.map(alert => {
      const alertBadge = {
        'error': '<span class="status-badge danger">Fehler</span>',
        'warning': '<span class="status-badge warning">Warnung</span>',
        'info': '<span class="status-badge info">Info</span>'
      }[alert.type] || '<span class="status-badge info">Info</span>';

      return `
        <tr class="table-row-clickable" onclick="window.navigateTo('${alert.url}')">
          <td>${alertBadge}</td>
          <td class="cell-main">
            <div class="cell-title">${alert.title}</div>
            <div class="cell-subtitle">${alert.message}</div>
          </td>
          <td>${this.formatTimeAgo(alert.timestamp)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Nachricht</th>
              <th>Zeit</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  renderRecentActivityTable() {
    if (!this.data.recentActivity.length) {
      return `
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Aktivität</th>
                <th>Unternehmen</th>
                <th>Zeit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="4" class="no-data">Keine letzten Aktivitäten</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    const rows = this.data.recentActivity.map(activity => {
      const typeBadge = {
        'kampagne': '<span class="type-badge type-kampagne">Kampagne</span>',
        'auftrag': '<span class="type-badge type-auftrag">Auftrag</span>',
        'briefing': '<span class="type-badge type-briefing">Briefing</span>',
        'kooperation': '<span class="type-badge type-kooperation">Kooperation</span>'
      }[activity.type] || `<span class="type-badge">${activity.type}</span>`;

      return `
        <tr class="table-row-clickable" onclick="window.navigateTo('${activity.url}')">
          <td>${typeBadge}</td>
          <td class="cell-main">
            <div class="cell-title">${activity.title}</div>
          </td>
          <td>${activity.subtitle || '-'}</td>
          <td>${this.formatTimeAgo(activity.timestamp)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Aktivität</th>
              <th>Unternehmen</th>
              <th>Zeit</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }



  getDeadlinePriority(deadline) {
    const daysUntil = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return 'overdue';
    if (daysUntil === 0) return 'today';
    if (daysUntil <= 3) return 'urgent';
    if (daysUntil <= 7) return 'warning';
    return 'normal';
  }

  getAlertIcon(type) {
    const icons = {
      error: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>`,
      warning: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>`,
      info: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>`
    };
    return icons[type] || icons.info;
  }



  formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) return 'Gerade eben';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return time.toLocaleDateString('de-DE');
  }

  setupEventListeners() {
    // Refresh Button
    const refreshBtn = document.getElementById('dashboard-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refresh());
    }
  }

  async refresh() {
    await this.loadDashboardData();
    await this.render();
  }

  startAutoRefresh() {
    // Refresh alle 5 Minuten
    this.refreshInterval = setInterval(() => {
      this.refresh();
    }, 5 * 60 * 1000);
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Mock-Daten für Offline/Test-Modus
  getMockStats() {
    return {
      kampagnen: { total: 12, aktiv: 8, ueberfaellig: 2 },
      auftraege: { total: 15, aktiv: 10, ueberfaellig: 1 },
      briefings: { total: 8, offen: 5, ueberfaellig: 1 },
      kooperationen: { total: 25, aktiv: 18 },
      creator: { total: 45 },
      rechnungen: { total: 20, offen: 8, ueberfaellig: 3 }
    };
  }

  getMockDeadlines() {
    const today = new Date();
    return [
      {
        type: 'kampagne',
        id: '1',
        title: 'Summer Collection Campaign',
        subtitle: 'Fashion Brand GmbH',
        deadline: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'urgent',
        url: '/kampagne/1'
      },
      {
        type: 'briefing',
        id: '2',
        title: 'Produktvorstellung Sneaker',
        subtitle: 'Sports Company',
        deadline: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'warning',
        url: '/briefing/2'
      }
    ];
  }

  getMockActivity() {
    return [
      {
        type: 'kampagne',
        title: 'Neue Kampagne erstellt',
        subtitle: 'Fashion Brand GmbH',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        url: '/kampagne/1'
      },
      {
        type: 'auftrag',
        title: 'Auftrag abgeschlossen',
        subtitle: 'Tech Startup',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        url: '/auftrag/2'
      }
    ];
  }

  getMockAlerts() {
    return [
      {
        type: 'error',
        title: 'Überfällige Deadline',
        message: 'Kampagne XY ist seit 2 Tagen überfällig',
        url: '/kampagne/1',
        timestamp: new Date().toISOString()
      },
      {
        type: 'warning',
        title: 'Deadline heute',
        message: 'Briefing ABC muss heute fertig werden',
        url: '/briefing/2',
        timestamp: new Date().toISOString()
      }
    ];
  }
}

export const dashboardModule = new DashboardModule();
