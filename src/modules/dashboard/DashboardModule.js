// DashboardModule.js (ES6-Modul)
// Hauptdashboard für CRM-Mitarbeiter

import { KampagneKanbanBoard } from '../kampagne/KampagneKanbanBoard.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

const MAGIC_LINK_ARTICLE_SLUG = 'erste-schritte-nach-ihrem-magic-link';

export class DashboardModule {
  constructor() {
    this.data = {
      stats: {},
      deadlines: [],
      recentActivity: [],
      alerts: [],
      monthlyRevenue: { total: 0, auftraege: [] },
      monthlyExpenses: { total: 0, rechnungen: [] }
    };
    this.refreshInterval = null;
    this.kampagnenView = 'kanban'; // 'list' oder 'kanban' - Standard: kanban
    this.kanbanBoard = null;
    this.kampagnen = [];
    
    // Farben für Umsatz-Balken (verschiedene Farben pro Auftrag)
    this.revenueColors = [
      '#3b82f6', // Blau
      '#8b5cf6', // Lila
      '#f59e0b', // Orange
      '#10b981', // Grün
      '#ef4444', // Rot
      '#06b6d4', // Cyan
      '#ec4899', // Pink
      '#84cc16', // Lime
      '#f97316', // Orange-Rot
      '#6366f1'  // Indigo
    ];
    
    // Farben für Ausgaben-Balken (verschiedene Rot-Töne für Ausgaben)
    this.expenseColors = [
      '#ef4444', // Rot
      '#f97316', // Orange
      '#f59e0b', // Amber
      '#dc2626', // Dunkelrot
      '#ea580c', // Dark Orange
      '#d97706', // Dark Amber
      '#b91c1c', // Rot-700
      '#c2410c', // Orange-700
      '#b45309', // Amber-700
      '#991b1b'  // Rot-800
    ];
  }

  async init() {
    window.setHeadline('Dashboard');
    
    // Breadcrumb für Dashboard
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Dashboard', url: '/dashboard', clickable: false }
      ]);
    }
    
    // Für Kunden: Spezielle Dashboard-Ansicht
    if (window.currentUser?.rolle === 'kunde') {
      await this.renderKundenDashboard();
      this.setupEventListeners();
      this.setupKampagneEventListeners();
      return;
    }
    
    await this.loadDashboardData();
    await this.render();
    this.setupEventListeners();
    this.setupKampagneEventListeners();
  }

  async loadDashboardData() {
    try {
      console.log('🔄 DASHBOARD: Lade Daten... Rolle:', window.currentUser?.rolle);
      
      const loadPromises = [
        this.loadStats(),
        this.loadUpcomingDeadlines()
      ];
      
      // Umsatz und Ausgaben sind jetzt auf der Aufträge-Seite
      
      await Promise.all(loadPromises);
      console.log('✅ DASHBOARD: Daten geladen:', this.data);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Dashboard-Daten:', error);
    }
  }

  // Lade Monatsumsatz (nur für Admins)
  async loadMonthlyRevenue() {
    try {
      if (!window.supabase) {
        this.data.monthlyRevenue = { total: 0, auftraege: [] };
        return;
      }

      // Aktueller Monat Bereich
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];
      const lastDayStr = lastDayOfMonth.toISOString().split('T')[0];

      console.log(`💰 DASHBOARD: Lade Umsatz für ${firstDayStr} bis ${lastDayStr}`);

      // Alle überwiesenen Aufträge im aktuellen Monat laden
      const { data: auftraege, error } = await window.supabase
        .from('auftrag')
        .select(`
          id,
          auftragsname,
          nettobetrag,
          ueberwiesen_am,
          unternehmen:unternehmen_id(firmenname),
          marke:marke_id(markenname)
        `)
        .not('ueberwiesen_am', 'is', null)
        .gte('ueberwiesen_am', firstDayStr)
        .lte('ueberwiesen_am', lastDayStr)
        .order('nettobetrag', { ascending: false });

      if (error) {
        console.error('❌ Fehler beim Laden des Monatsumsatzes:', error);
        this.data.monthlyRevenue = { total: 0, auftraege: [] };
        return;
      }

      // Gesamtsumme berechnen
      const total = (auftraege || []).reduce((sum, a) => sum + (parseFloat(a.nettobetrag) || 0), 0);
      
      this.data.monthlyRevenue = {
        total,
        auftraege: auftraege || [],
        month: now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      };

      console.log(`✅ DASHBOARD: ${auftraege?.length || 0} Aufträge mit Gesamtumsatz ${total.toFixed(2)}€`);

    } catch (error) {
      console.error('❌ Fehler beim Laden des Monatsumsatzes:', error);
      this.data.monthlyRevenue = { total: 0, auftraege: [] };
    }
  }

  // Lade Monatsausgaben (nur für Admins)
  async loadMonthlyExpenses() {
    try {
      if (!window.supabase) {
        this.data.monthlyExpenses = { total: 0, rechnungen: [] };
        return;
      }

      // Aktueller Monat Bereich
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];
      const lastDayStr = lastDayOfMonth.toISOString().split('T')[0];

      console.log(`💸 DASHBOARD: Lade Ausgaben für ${firstDayStr} bis ${lastDayStr}`);

      // Alle bezahlten Rechnungen im aktuellen Monat laden
      const { data: rechnungen, error } = await window.supabase
        .from('rechnung')
        .select(`
          id,
          rechnung_nr,
          nettobetrag,
          bruttobetrag,
          bezahlt_am,
          creator:creator_id(vorname, nachname),
          kooperation:kooperation_id(name)
        `)
        .not('bezahlt_am', 'is', null)
        .gte('bezahlt_am', firstDayStr)
        .lte('bezahlt_am', lastDayStr)
        .order('nettobetrag', { ascending: false });

      if (error) {
        console.error('❌ Fehler beim Laden der Monatsausgaben:', error);
        this.data.monthlyExpenses = { total: 0, rechnungen: [] };
        return;
      }

      // Gesamtsumme berechnen (Netto)
      const total = (rechnungen || []).reduce((sum, r) => sum + (parseFloat(r.nettobetrag) || 0), 0);
      
      this.data.monthlyExpenses = {
        total,
        rechnungen: rechnungen || [],
        month: now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      };

      console.log(`✅ DASHBOARD: ${rechnungen?.length || 0} Rechnungen mit Gesamtausgaben ${total.toFixed(2)}€`);

    } catch (error) {
      console.error('❌ Fehler beim Laden der Monatsausgaben:', error);
      this.data.monthlyExpenses = { total: 0, rechnungen: [] };
    }
  }

  async loadStats() {
    try {
      if (!window.supabase) {
        this.data.stats = this.getMockStats();
        return;
      }

      // Kampagnen mit Status-Name laden
      const { data: kampagnen, error } = await window.supabase
        .from('kampagne')
        .select('id, deadline, status:status_id(id, name)');

      if (error) {
        console.error('❌ Fehler beim Laden der Kampagnen:', error);
        this.data.stats = this.getMockStats();
        return;
      }

      // "Aktiv" = alle die NICHT "Abgeschlossen" sind
      const aktiveKampagnen = (kampagnen || []).filter(k => 
        k.status?.name !== 'Abgeschlossen'
      );
      
      // Überfällig = Deadline in der Vergangenheit UND nicht abgeschlossen
      const ueberfaelligeKampagnen = aktiveKampagnen.filter(k => 
        k.deadline && new Date(k.deadline) < new Date()
      );

      this.data.stats = {
        kampagnen: {
          total: kampagnen?.length || 0,
          aktiv: aktiveKampagnen.length,
          ueberfaellig: ueberfaelligeKampagnen.length
        }
      };
      
      console.log('📊 Dashboard Stats:', this.data.stats);
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

      // Sichtbarkeits-Logik: Nicht-Admins nur zugeordnete Inhalte
      const isAdmin = window.currentUser?.rolle === 'admin';
      let allowedKampagneIds = [];
      let allowedKoopIds = [];
      
      if (!isAdmin) {
        try {
          // 1. Direkt zugeordnete Kampagnen
          const { data: assignedKampagnen } = await window.supabase
            .from('kampagne_mitarbeiter')
            .select('kampagne_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const directKampagnenIds = (assignedKampagnen || []).map(r => r.kampagne_id).filter(Boolean);
          
          // 2. Kampagnen über zugeordnete Marken
          const { data: assignedMarken } = await window.supabase
            .from('marke_mitarbeiter')
            .select('marke_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const markenIds = (assignedMarken || []).map(r => r.marke_id).filter(Boolean);
          
          let markenKampagnenIds = [];
          if (markenIds.length > 0) {
            const { data: markenKampagnen } = await window.supabase
              .from('kampagne')
              .select('id')
              .in('marke_id', markenIds);
            markenKampagnenIds = (markenKampagnen || []).map(k => k.id).filter(Boolean);
          }
          
          // Kombiniere beide Listen und entferne Duplikate
          allowedKampagneIds = [...new Set([...directKampagnenIds, ...markenKampagnenIds])];
          
          // Kooperationen aus erlaubten Kampagnen laden
          if (allowedKampagneIds.length > 0) {
            const { data: koops } = await window.supabase
              .from('kooperationen')
              .select('id')
              .in('kampagne_id', allowedKampagneIds);
            allowedKoopIds = (koops || []).map(k => k.id);
          }
          
          console.log(`🔍 DASHBOARD: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`, {
            direkteKampagnen: directKampagnenIds.length,
            markenKampagnen: markenKampagnenIds.length,
            gesamtKampagnen: allowedKampagneIds.length,
            kooperationen: allowedKoopIds.length
          });
        } catch (error) {
          console.error('❌ Fehler beim Laden der Zuordnungen für Dashboard:', error);
        }
      }

      // Queries mit Sichtbarkeits-Filterung
      let kampagnenQuery = window.supabase
        .from('kampagne')
        .select('id, kampagnenname, eigener_name, deadline, unternehmen:unternehmen_id(firmenname)')
        .lte('deadline', nextWeekStr)
        .gte('deadline', new Date().toISOString().split('T')[0]);
      
      let briefingQuery = window.supabase
        .from('briefings')
        .select('id, product_service_offer, deadline, unternehmen:unternehmen_id(firmenname)')
        .lte('deadline', nextWeekStr)
        .gte('deadline', new Date().toISOString().split('T')[0]);
        
      let koopSkriptQuery = window.supabase
        .from('kooperationen')
        .select('id, name, skript_deadline, creator:creator_id(vorname, nachname)')
        .lte('skript_deadline', nextWeekStr)
        .gte('skript_deadline', new Date().toISOString().split('T')[0]);
        
      let koopContentQuery = window.supabase
        .from('kooperationen')
        .select('id, name, content_deadline, creator:creator_id(vorname, nachname)')
        .lte('content_deadline', nextWeekStr)
        .gte('content_deadline', new Date().toISOString().split('T')[0]);
        
      let rechnungQuery = window.supabase
        .from('rechnungen')
        .select('id, rechnungs_nr, zahlungsziel, unternehmen:unternehmen_id(firmenname)')
        .lte('zahlungsziel', nextWeekStr)
        .gte('zahlungsziel', new Date().toISOString().split('T')[0]);

      // Nicht-Admin Filterung anwenden
      if (!isAdmin) {
        if (allowedKampagneIds.length > 0) {
          kampagnenQuery = kampagnenQuery.in('id', allowedKampagneIds);
          briefingQuery = briefingQuery.in('kampagne_id', allowedKampagneIds);
          rechnungQuery = rechnungQuery.in('kampagne_id', allowedKampagneIds);
        } else {
          // Keine Berechtigung = leere Ergebnisse
          kampagnenQuery = kampagnenQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          briefingQuery = briefingQuery.eq('kampagne_id', '00000000-0000-0000-0000-000000000000');
          rechnungQuery = rechnungQuery.eq('kampagne_id', '00000000-0000-0000-0000-000000000000');
        }
        
        if (allowedKoopIds.length > 0) {
          koopSkriptQuery = koopSkriptQuery.in('id', allowedKoopIds);
          koopContentQuery = koopContentQuery.in('id', allowedKoopIds);
        } else {
          koopSkriptQuery = koopSkriptQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          koopContentQuery = koopContentQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      const [
        { data: kampagnenDeadlines },
        { data: briefingDeadlines },
        { data: kooperationSkriptDeadlines },
        { data: kooperationContentDeadlines },
        { data: rechnungDeadlines }
      ] = await Promise.all([
        kampagnenQuery,
        briefingQuery,
        koopSkriptQuery,
        koopContentQuery,
        rechnungQuery
      ]);

      this.data.deadlines = [
        ...(kampagnenDeadlines?.map(k => ({
          type: 'kampagne',
          id: k.id,
          title: KampagneUtils.getDisplayName(k),
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
          .select('id, kampagnenname, eigener_name, created_at, unternehmen:unternehmen_id(firmenname)')
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
          title: KampagneUtils.getDisplayName(k),
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
        .select('id, kampagnenname, eigener_name, deadline')
        .lt('deadline', now.toISOString())
        .neq('status_id', 'completed');

      overdueKampagnen?.forEach(k => {
        alerts.push({
          type: 'error',
          title: 'Überfällige Kampagne',
          message: `${KampagneUtils.getDisplayName(k)} - Deadline überschritten`,
          url: `/kampagne/${k.id}`,
          timestamp: k.deadline
        });
      });

      // Heute fällige Deadlines
      const today = now.toISOString().split('T')[0];
      const { data: todayDeadlines } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, eigener_name, deadline')
        .eq('deadline', today);

      todayDeadlines?.forEach(k => {
        alerts.push({
          type: 'warning',
          title: 'Deadline heute',
          message: `${KampagneUtils.getDisplayName(k)} - heute fällig`,
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
    // Prüfe ob User pending ist oder blockiert
    const isPending = window.currentUser?.isBlocked === true;
    const blockReason = window.currentUser?.blockReason || 'Ihr Account wartet auf Freischaltung durch einen Administrator';
    
    const html = `
      <div class="dashboard-container">
        <!-- Dashboard Header -->
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

        <!-- Kampagnen Section -->
        <div class="content-section">
          <div class="section-header">
            <h2>Meine Kampagnen</h2>
            <div class="section-header-right">
              <div class="view-toggle">
                <button id="dashboard-btn-view-list" class="secondary-btn ${this.kampagnenView === 'list' ? 'active' : ''}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
                  </svg>
                  Liste
                </button>
                <button id="dashboard-btn-view-kanban" class="secondary-btn ${this.kampagnenView === 'kanban' ? 'active' : ''}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                  </svg>
                  Kanban
                </button>
              </div>
            </div>
          </div>
          <div id="dashboard-kampagnen-content" class="dashboard-kampagnen-section">
            <div id="dashboard-kanban-container" class="${this.kampagnenView === 'kanban' ? '' : 'hidden'}"></div>
            <div id="dashboard-kampagnen-table" class="${this.kampagnenView === 'list' ? '' : 'hidden'}"></div>
          </div>
        </div>
        ` : ''}
      </div>
    `;

    window.setContentSafely(window.content, html);
    
    // Initialisiere Kanban Board für Mitarbeiter/Admins wenn nicht pending
    if (!isPending && this.kampagnenView === 'kanban') {
      await this.initDashboardKanbanBoard();
    } else if (!isPending && this.kampagnenView === 'list') {
      await this.loadKampagnenTable();
    }
  }

  async renderKundenDashboard() {
    const isBlocked = window.currentUser?.isBlocked === true;
    
    if (isBlocked) {
      // Nicht freigeschalteter Kunde - einfache Wartebotschaft
      const html = `
        <div class="dashboard-container">
          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${window.validatorSystem.sanitizeHtml(window.currentUser?.name || 'Unbekannt')}</td>
                  <td>
                    <span class="status-badge status-pending">Wartet auf Freischaltung</span>
                    <div class="status-hint">Ein Administrator wird Ihren Account in Kürze überprüfen und freischalten.</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      window.setContentSafely(window.content, html);
      return;
    }
    
    // Freigeschalteter Kunde - Lade Kampagnen und Kooperationen
    try {
      const [{ data: kampagnen }, { data: kooperationen }] = await Promise.all([
        window.supabase
          .from('kampagne')
          .select('id, kampagnenname, eigener_name, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname), status:status_id(name), status_id')
          .order('created_at', { ascending: false }),
        window.supabase
          .from('kooperationen')
          .select('id, name, kampagne:kampagne_id(kampagnenname, eigener_name), status, creator:creator_id(vorname, nachname)')
          .order('created_at', { ascending: false })
      ]);
      
      const kampagnenRows = (kampagnen || []).map(k => `
        <tr>
          <td><a href="/kampagne/${k.id}" onclick="event.preventDefault(); window.navigateTo('/kampagne/${k.id}')">${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(k))}</a></td>
          <td>${window.validatorSystem.sanitizeHtml(k.unternehmen?.firmenname || '—')}</td>
          <td>${window.validatorSystem.sanitizeHtml(k.marke?.markenname || '—')}</td>
          <td><span class="status-badge">${window.validatorSystem.sanitizeHtml(k.status?.name || '—')}</span></td>
        </tr>
      `).join('');
      
      const koopRows = (kooperationen || []).map(k => `
        <tr>
          <td><a href="/kunden-kooperation/${k.id}" onclick="event.preventDefault(); window.navigateTo('/kunden-kooperation/${k.id}')">${window.validatorSystem.sanitizeHtml(k.name || k.id)}</a></td>
          <td>${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(k.kampagne))}</td>
          <td>${window.validatorSystem.sanitizeHtml(k.creator ? `${k.creator.vorname || ''} ${k.creator.nachname || ''}`.trim() : '—')}</td>
          <td><span class="status-badge status-${(k.status||'').toLowerCase().replace(/\s+/g,'-')}">${window.validatorSystem.sanitizeHtml(k.status || '—')}</span></td>
        </tr>
      `).join('');
      
      const magicLinkArticleUrl = `/education/${MAGIC_LINK_ARTICLE_SLUG}`;
      const html = `
        <div class="dashboard-container">
          <div class="content-section dashboard-kunden-article-card">
            <a href="${magicLinkArticleUrl}" onclick="event.preventDefault(); window.navigateTo('${magicLinkArticleUrl}')" class="dashboard-article-link">
              <div class="dashboard-article-link-inner">
                <span class="dashboard-article-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                </span>
                <div class="dashboard-article-text">
                  <h3 class="dashboard-article-title">Erste Schritte nach Ihrem Magic Link</h3>
                  <p class="dashboard-article-desc">Erfahren Sie, welche Schritte nach der Registrierung folgen.</p>
                </div>
              </div>
            </a>
          </div>
          <div class="content-section">
            <div class="section-header">
              <h2>Meine Kampagnen</h2>
              <div class="section-header-right">
                <div class="view-toggle">
                  <button id="dashboard-kunden-btn-view-list" class="secondary-btn ${this.kampagnenView === 'list' ? 'active' : ''}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
                    </svg>
                    Liste
                  </button>
                  <button id="dashboard-kunden-btn-view-kanban" class="secondary-btn ${this.kampagnenView === 'kanban' ? 'active' : ''}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                    </svg>
                    Kanban
                  </button>
                </div>
              </div>
            </div>
            <div id="dashboard-kunden-kampagnen-content" class="dashboard-kampagnen-section">
              <div id="dashboard-kunden-kanban-container" class="${this.kampagnenView === 'kanban' ? '' : 'hidden'}"></div>
              <div id="dashboard-kunden-kampagnen-table" class="${this.kampagnenView === 'list' ? '' : 'hidden'}">
                <div class="data-table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Kampagne</th>
                        <th>Unternehmen</th>
                        <th>Marke</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>${kampagnenRows || '<tr><td colspan="4" class="loading">Keine Kampagnen</td></tr>'}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          
          <div class="content-section">
            <div class="section-header">
              <h2>Meine Kooperationen</h2>
            </div>
            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Kooperation</th>
                    <th>Kampagne</th>
                    <th>Creator</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>${koopRows || '<tr><td colspan="4" class="loading">Keine Kooperationen</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;
      
      window.setContentSafely(window.content, html);
      
      // Initialisiere Kanban Board für Kunden wenn View = kanban
      if (this.kampagnenView === 'kanban') {
        await this.initDashboardKanbanBoard('dashboard-kunden-kanban-container');
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden des Kunden-Dashboards:', error);
      window.setContentSafely(window.content, '<p class="error">Fehler beim Laden der Daten.</p>');
    }
  }

  renderPendingMessage() {
    return `
      <div class="content-section">
        <div class="pending-user-message">
          <div class="pending-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
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
        ${stats.kampagnen?.ueberfaellig > 0 ? `<div class="stats-alert status-badge danger">${stats.kampagnen.ueberfaellig} überfällig</div>` : ''}
      </div>
    `;
  }

  // Admin-Umsatz-Kachel mit Portfolio-Style Balken
  renderAdminRevenueCard() {
    const revenue = this.data.monthlyRevenue;
    const total = revenue.total || 0;
    const auftraege = revenue.auftraege || [];
    const month = revenue.month || new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    
    // Formatierung für Währung
    const formatCurrency = (value) => {
      return new Intl.NumberFormat('de-DE', { 
        style: 'currency', 
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    };
    
    // Balken generieren (proportional zur Gesamtsumme)
    let barsHtml = '';
    let legendHtml = '';
    
    if (auftraege.length > 0 && total > 0) {
      auftraege.forEach((auftrag, index) => {
        const betrag = parseFloat(auftrag.nettobetrag) || 0;
        const percentage = (betrag / total) * 100;
        const color = this.revenueColors[index % this.revenueColors.length];
        const name = auftrag.auftragsname || auftrag.marke?.markenname || auftrag.unternehmen?.firmenname || 'Auftrag';
        
        // Balken (nur wenn > 0.5%) - width und background-color müssen dynamisch bleiben
        if (percentage > 0.5) {
          barsHtml += `<div class="revenue-bar" style="width: ${percentage}%; background-color: ${color};" title="${name}: ${formatCurrency(betrag)}"></div>`;
        }
        
        // Legende (max. 5 Einträge)
        if (index < 5) {
          legendHtml += `
            <div class="revenue-legend-item">
              <span class="revenue-legend-color" style="background-color: ${color};"></span>
              <span class="revenue-legend-value">${formatCurrency(betrag)}</span>
              <span class="revenue-legend-name">${name.length > 20 ? name.substring(0, 20) + '...' : name}</span>
            </div>
          `;
        }
      });
      
      // "Weitere" anzeigen wenn mehr als 5 Aufträge
      if (auftraege.length > 5) {
        const weitereAnzahl = auftraege.length - 5;
        const weitereBetrag = auftraege.slice(5).reduce((sum, a) => sum + (parseFloat(a.nettobetrag) || 0), 0);
        legendHtml += `
          <div class="revenue-legend-item revenue-legend-item--more">
            <span class="revenue-legend-color" style="background-color: var(--gray-400);"></span>
            <span class="revenue-legend-value">${formatCurrency(weitereBetrag)}</span>
            <span class="revenue-legend-name">+${weitereAnzahl} weitere</span>
          </div>
        `;
      }
    } else {
      barsHtml = '<div class="revenue-bar revenue-bar--empty"></div>';
      legendHtml = '<div class="revenue-legend-empty">Keine Umsätze in diesem Monat</div>';
    }

    return `
      <div class="stats-card stats-card--revenue">
        <div class="revenue-content">
          <span class="revenue-title">Umsatz ${month}</span>
          <div class="revenue-total">
            <span class="revenue-currency">€</span>
            <span class="revenue-amount">${total.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          </div>
          <div class="revenue-bars">
            ${barsHtml}
          </div>
          <div class="revenue-legend">
            ${legendHtml}
          </div>
        </div>
      </div>
    `;
  }

  // Admin-Ausgaben-Kachel mit Portfolio-Style Balken
  renderAdminExpensesCard() {
    const expenses = this.data.monthlyExpenses;
    const total = expenses.total || 0;
    const rechnungen = expenses.rechnungen || [];
    const month = expenses.month || new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    
    // Formatierung für Währung
    const formatCurrency = (value) => {
      return new Intl.NumberFormat('de-DE', { 
        style: 'currency', 
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    };
    
    // Balken generieren (proportional zur Gesamtsumme)
    let barsHtml = '';
    let legendHtml = '';
    
    if (rechnungen.length > 0 && total > 0) {
      rechnungen.forEach((rechnung, index) => {
        const betrag = parseFloat(rechnung.nettobetrag) || 0;
        const percentage = (betrag / total) * 100;
        const color = this.expenseColors[index % this.expenseColors.length];
        // Name: Creator-Name oder Kooperations-Name oder Rechnungsnummer
        const creatorName = rechnung.creator ? `${rechnung.creator.vorname || ''} ${rechnung.creator.nachname || ''}`.trim() : null;
        const name = creatorName || rechnung.kooperation?.name || rechnung.rechnung_nr || 'Rechnung';
        
        // Balken (nur wenn > 0.5%)
        if (percentage > 0.5) {
          barsHtml += `<div class="expense-bar" style="width: ${percentage}%; background-color: ${color};" title="${name}: ${formatCurrency(betrag)}"></div>`;
        }
        
        // Legende (max. 5 Einträge)
        if (index < 5) {
          legendHtml += `
            <div class="expense-legend-item">
              <span class="expense-legend-color" style="background-color: ${color};"></span>
              <span class="expense-legend-value">${formatCurrency(betrag)}</span>
              <span class="expense-legend-name">${name.length > 20 ? name.substring(0, 20) + '...' : name}</span>
            </div>
          `;
        }
      });
      
      // "Weitere" anzeigen wenn mehr als 5 Rechnungen
      if (rechnungen.length > 5) {
        const weitereAnzahl = rechnungen.length - 5;
        const weitereBetrag = rechnungen.slice(5).reduce((sum, r) => sum + (parseFloat(r.nettobetrag) || 0), 0);
        legendHtml += `
          <div class="expense-legend-item expense-legend-item--more">
            <span class="expense-legend-color" style="background-color: var(--gray-400);"></span>
            <span class="expense-legend-value">${formatCurrency(weitereBetrag)}</span>
            <span class="expense-legend-name">+${weitereAnzahl} weitere</span>
          </div>
        `;
      }
    } else {
      barsHtml = '<div class="expense-bar expense-bar--empty"></div>';
      legendHtml = '<div class="expense-legend-empty">Keine Ausgaben in diesem Monat</div>';
    }

    return `
      <div class="stats-card stats-card--expenses">
        <div class="expense-content">
          <span class="expense-title">Ausgaben ${month}</span>
          <div class="expense-total">
            <span class="expense-currency">€</span>
            <span class="expense-amount">${total.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          </div>
          <div class="expense-bars">
            ${barsHtml}
          </div>
          <div class="expense-legend">
            ${legendHtml}
          </div>
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
            <span class="status-badge status-badge-type status-badge-type-${deadline.type}">${typeLabel}</span>
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
        'kampagne': '<span class="status-badge status-badge-type status-badge-type-kampagne">Kampagne</span>',
        'auftrag': '<span class="status-badge status-badge-type status-badge-type-auftrag">Auftrag</span>',
        'briefing': '<span class="status-badge status-badge-type status-badge-type-briefing">Briefing</span>',
        'kooperation': '<span class="status-badge status-badge-type status-badge-type-kooperation">Kooperation</span>'
      }[activity.type] || `<span class="status-badge status-badge-type">${activity.type}</span>`;

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

    // View Toggle Buttons für Mitarbeiter/Admins
    const listBtn = document.getElementById('dashboard-btn-view-list');
    const kanbanBtn = document.getElementById('dashboard-btn-view-kanban');

    if (listBtn) {
      listBtn.addEventListener('click', async () => {
        console.log('🔄 Dashboard: Wechsel zu List-View');
        if (this.kampagnenView === 'list') return; // Bereits in List-View
        
        this.kampagnenView = 'list';
        
        // Cleanup Kanban Board
        if (this.kanbanBoard) {
          this.kanbanBoard.destroy();
          this.kanbanBoard = null;
        }
        
        // Toggle Display via CSS-Klassen
        const kanbanContainer = document.getElementById('dashboard-kanban-container');
        const tableContainer = document.getElementById('dashboard-kampagnen-table');
        if (kanbanContainer) kanbanContainer.classList.add('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');
        
        // Toggle Button States
        listBtn.classList.add('active');
        kanbanBtn.classList.remove('active');
        
        // Lade Tabelle
        await this.loadKampagnenTable();
      });
    }

    if (kanbanBtn) {
      kanbanBtn.addEventListener('click', async () => {
        console.log('🔄 Dashboard: Wechsel zu Kanban-View');
        if (this.kampagnenView === 'kanban') return; // Bereits in Kanban-View
        
        this.kampagnenView = 'kanban';
        
        // Toggle Display via CSS-Klassen
        const kanbanContainer = document.getElementById('dashboard-kanban-container');
        const tableContainer = document.getElementById('dashboard-kampagnen-table');
        if (kanbanContainer) kanbanContainer.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        
        // Toggle Button States
        kanbanBtn.classList.add('active');
        listBtn.classList.remove('active');
        
        // Initialisiere Kanban Board
        await this.initDashboardKanbanBoard();
      });
    }

    // View Toggle Buttons für Kunden
    const kundenListBtn = document.getElementById('dashboard-kunden-btn-view-list');
    const kundenKanbanBtn = document.getElementById('dashboard-kunden-btn-view-kanban');

    if (kundenListBtn) {
      kundenListBtn.addEventListener('click', async () => {
        console.log('🔄 Kunden Dashboard: Wechsel zu List-View');
        if (this.kampagnenView === 'list') return;
        
        this.kampagnenView = 'list';
        
        // Cleanup Kanban Board
        if (this.kanbanBoard) {
          this.kanbanBoard.destroy();
          this.kanbanBoard = null;
        }
        
        // Toggle Display via CSS-Klassen
        const kanbanContainer = document.getElementById('dashboard-kunden-kanban-container');
        const tableContainer = document.getElementById('dashboard-kunden-kampagnen-table');
        if (kanbanContainer) kanbanContainer.classList.add('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');
        
        // Toggle Button States
        kundenListBtn.classList.add('active');
        kundenKanbanBtn.classList.remove('active');
      });
    }

    if (kundenKanbanBtn) {
      kundenKanbanBtn.addEventListener('click', async () => {
        console.log('🔄 Kunden Dashboard: Wechsel zu Kanban-View');
        if (this.kampagnenView === 'kanban') return;
        
        this.kampagnenView = 'kanban';
        
        // Toggle Display via CSS-Klassen
        const kanbanContainer = document.getElementById('dashboard-kunden-kanban-container');
        const tableContainer = document.getElementById('dashboard-kunden-kampagnen-table');
        if (kanbanContainer) kanbanContainer.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        
        // Toggle Button States
        kundenKanbanBtn.classList.add('active');
        kundenListBtn.classList.remove('active');
        
        // Initialisiere Kanban Board
        await this.initDashboardKanbanBoard('dashboard-kunden-kanban-container');
      });
    }
  }

  setupKampagneEventListeners() {
    // Event-Listener für Kampagnen-Updates (bidirektionale Sync)
    this.kampagneUpdatedHandler = (e) => {
      console.log('📢 Dashboard: Kampagne Updated Event empfangen', e.detail);
      if (this.kampagnenView === 'kanban' && this.kanbanBoard) {
        this.kanbanBoard.refresh();
      } else if (this.kampagnenView === 'list') {
        this.loadKampagnenTable();
      }
    };
    
    window.addEventListener('kampagneUpdated', this.kampagneUpdatedHandler);
    
    // Entity Updated Event
    this.entityUpdatedHandler = (e) => {
      if (e.detail.entity === 'kampagne') {
        console.log('📢 Dashboard: Entity Updated Event (kampagne) empfangen', e.detail);
        if (this.kampagnenView === 'kanban' && this.kanbanBoard) {
          this.kanbanBoard.refresh();
        } else if (this.kampagnenView === 'list') {
          this.loadKampagnenTable();
        }
      }
    };
    
    window.addEventListener('entityUpdated', this.entityUpdatedHandler);
    
    console.log('✅ Dashboard: Kampagnen Event-Listener eingerichtet');
  }

  async initDashboardKanbanBoard(containerId = 'dashboard-kanban-container') {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`⚠️ Dashboard Kanban Container '${containerId}' nicht gefunden`);
      return;
    }

    // Cleanup old board
    if (this.kanbanBoard) {
      this.kanbanBoard.destroy();
    }

    // Neue Board-Instanz
    this.kanbanBoard = new KampagneKanbanBoard();
    await this.kanbanBoard.init(container);
    console.log('✅ Dashboard Kanban Board initialisiert');
  }

  async loadKampagnenTable() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        return;
      }

      // Sichtbarkeits-Logik: Nicht-Admins nur zugeordnete Inhalte
      const isAdmin = window.currentUser?.rolle === 'admin';
      let allowedKampagneIds = [];
      
      if (!isAdmin) {
        try {
          // 1. Direkt zugeordnete Kampagnen
          const { data: assignedKampagnen } = await window.supabase
            .from('kampagne_mitarbeiter')
            .select('kampagne_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const directKampagnenIds = (assignedKampagnen || []).map(r => r.kampagne_id).filter(Boolean);
          
          // 2. Kampagnen über zugeordnete Marken
          const { data: assignedMarken } = await window.supabase
            .from('marke_mitarbeiter')
            .select('marke_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const markenIds = (assignedMarken || []).map(r => r.marke_id).filter(Boolean);
          
          let markenKampagnenIds = [];
          if (markenIds.length > 0) {
            const { data: markenKampagnen } = await window.supabase
              .from('kampagne')
              .select('id')
              .in('marke_id', markenIds);
            markenKampagnenIds = (markenKampagnen || []).map(k => k.id).filter(Boolean);
          }
          
          // Kombiniere beide Listen und entferne Duplikate
          allowedKampagneIds = [...new Set([...directKampagnenIds, ...markenKampagnenIds])];
          
          console.log(`🔍 DASHBOARD: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf ${allowedKampagneIds.length} Kampagnen`);
        } catch (error) {
          console.error('❌ Fehler beim Laden der Zuordnungen für Dashboard:', error);
        }
      }

      // Query mit Sichtbarkeits-Filterung
      let kampagnenQuery = window.supabase
        .from('kampagne')
        .select('id, kampagnenname, eigener_name, unternehmen:unternehmen_id(id, firmenname, logo_url), marke:marke_id(id, markenname, logo_url), status_ref:status_id(id, name)')
        .order('created_at', { ascending: false });
      
      // Nicht-Admin Filterung anwenden
      if (!isAdmin && window.currentUser?.rolle !== 'kunde') {
        if (allowedKampagneIds.length > 0) {
          kampagnenQuery = kampagnenQuery.in('id', allowedKampagneIds);
        } else {
          // Keine Berechtigung = leere Ergebnisse
          kampagnenQuery = kampagnenQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      const { data: kampagnen } = await kampagnenQuery;

      // Rendere Tabelle
      const container = document.getElementById('dashboard-kampagnen-table');
      if (!container) return;

      const kampagnenRows = (kampagnen || []).map(k => `
        <tr class="table-row-clickable" onclick="window.navigateTo('/kampagne/${k.id}')">
          <td>${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(k))}</td>
          <td>${window.validatorSystem.sanitizeHtml(k.unternehmen?.firmenname || '—')}</td>
          <td>${window.validatorSystem.sanitizeHtml(k.marke?.markenname || '—')}</td>
          <td><span class="status-badge">${window.validatorSystem.sanitizeHtml(k.status_ref?.name || '—')}</span></td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Kampagne</th>
                <th>Unternehmen</th>
                <th>Marke</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${kampagnenRows || '<tr><td colspan="4" class="loading">Keine Kampagnen</td></tr>'}</tbody>
          </table>
        </div>
      `;
      console.log('✅ Dashboard Kampagnen-Tabelle geladen:', kampagnen?.length || 0);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Dashboard-Kampagnen-Tabelle:', error);
    }
  }

  async refresh() {
    await this.loadDashboardData();
    await this.render();
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    // Cleanup Kanban Board
    if (this.kanbanBoard) {
      console.log('🗑️ Dashboard: Cleanup Kanban Board');
      this.kanbanBoard.destroy();
      this.kanbanBoard = null;
    }
    
    // Cleanup Event-Listener
    if (this.kampagneUpdatedHandler) {
      window.removeEventListener('kampagneUpdated', this.kampagneUpdatedHandler);
      this.kampagneUpdatedHandler = null;
    }
    
    if (this.entityUpdatedHandler) {
      window.removeEventListener('entityUpdated', this.entityUpdatedHandler);
      this.entityUpdatedHandler = null;
    }
    
    console.log('✅ Dashboard: Cleanup abgeschlossen');
  }

  // Mock-Daten für Offline/Test-Modus
  getMockStats() {
    return {
      kampagnen: { total: 12, aktiv: 8, ueberfaellig: 2 }
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
