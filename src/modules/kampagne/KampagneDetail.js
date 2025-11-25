// KampagneDetail.js (ES6-Modul)
// Kampagnen-Detail-Ansicht
import { renderCreatorTable } from '../creator/CreatorTable.js';
import { KampagneKooperationenVideoTable } from './KampagneKooperationenVideoTable.js';
import { VideoCreateDrawer } from './VideoCreateDrawer.js';
import { VideoTableColumnVisibilityDrawer } from './VideoTableColumnVisibilityDrawer.js';

export class KampagneDetail {
  constructor() {
    this.kampagneId = null;
    this.kampagneData = null;
    this.creator = [];
    this.notizen = [];
    this.ratings = [];
    this.kooperationen = [];
    this.koopBudgetSum = 0;
    this.koopVideosUsed = 0;
    this.koopCreatorsUsed = 0;
    this.sourcingCreators = [];
    this.favoriten = [];
    this.rechnungen = [];
    this.history = [];
    this.historyCount = 0;
    this.koopHistory = [];
    this.koopHistoryCount = 0;
    this.kooperationenVideoTable = null;
    this.videoCreateDrawer = null;
    this.videoColumnVisibilityDrawer = null;
  }

  // Initialisiere Kampagnen-Detail
  async init(kampagneId) {
    console.log('🎯 KAMPAGNEDETAIL: Initialisiere Kampagnen-Detailseite für ID:', kampagneId);
    
    // WICHTIG: IMMER Cleanup alte Tabellen-Instanz falls vorhanden
    // (auch wenn gleiche kampagneId, weil der Container neu gerendert wird)
    if (this.kooperationenVideoTable) {
      console.log('🧹 Cleanup alte Kooperationen-Video-Tabelle', {
        alteKampagneId: this.kooperationenVideoTable.kampagneId,
        neueKampagneId: kampagneId
      });
      if (typeof this.kooperationenVideoTable.destroy === 'function') {
        this.kooperationenVideoTable.destroy();
      }
      this.kooperationenVideoTable = null;
    }
    
    this.kampagneId = kampagneId;
    
    // Prüfen ob dieses Modul noch das aktuelle ist
    if (window.moduleRegistry?.currentModule !== this) {
      console.log('⚠️ KAMPAGNEDETAIL: Nicht mehr das aktuelle Modul, breche ab');
      return;
    }
    
    try {
      // Lade kritische Daten (PARALLEL statt sequentiell!)
      await this.loadCriticalData();
      
      // Breadcrumb aktualisieren
      if (window.breadcrumbSystem && this.kampagneData) {
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Kampagne', url: '/kampagne', clickable: true },
          { label: this.kampagneData.kampagnenname || 'Details', url: `/kampagne/${this.kampagneId}`, clickable: false }
        ]);
      }
      
      // Rendere die Seite
      await this.render();
      
      // Binde Events
      this.bindEvents();
      this.bindAnsprechpartnerEvents();
      
      // Lade initialen Tab direkt nach render
      // WICHTIG: Nach render() und bindEvents() damit der DOM vollständig ist
      if (window.canViewTable && window.canViewTable('kampagne','kooperationen') !== false) {
        // Verwende setTimeout mit längerer Verzögerung damit alte Instanz sicher beendet ist
        setTimeout(async () => {
          // Prüfe ob noch aktuelles Modul
          if (window.moduleRegistry?.currentModule !== this) {
            console.log('⚠️ Nicht mehr aktuelles Modul, überspringe Tabellen-Init');
            return;
          }
          
          const container = document.getElementById('kooperationen-videos-container');
          if (!container) {
            console.error('❌ Container nicht gefunden beim initialen Load');
            return;
          }
          
          const hasDOM = container.querySelector('.grid-wrapper');
          
          console.log('🔍 Container-Status beim Init:', {
            containerExists: !!container,
            hasDOM: !!hasDOM,
            hasInstance: !!this.kooperationenVideoTable,
            containerIsEmpty: container.innerHTML.trim() === ''
          });
          
          // Lade Tabelle wenn kein DOM vorhanden ist (egal ob Instanz existiert)
          if (!hasDOM) {
            console.log('🔄 Lade Kooperationen-Video-Tabelle (DOM fehlt)');
            // Erstelle neue Instanz nur wenn noch keine existiert
            if (!this.kooperationenVideoTable) {
              this.kooperationenVideoTable = new KampagneKooperationenVideoTable(this.kampagneId);
            }
            await this.kooperationenVideoTable.init('kooperationen-videos-container');
            console.log('✅ Kooperationen-Video-Tabelle initialisiert');
            
            // Update Button-State nach Init
            this.updateToggleApprovedButton();
          } else {
            console.log('✅ Tabelle DOM bereits vorhanden - Skip:', { 
              hasInstance: !!this.kooperationenVideoTable, 
              hasDOM: !!hasDOM 
            });
          }
        }, 200); // Längere Verzögerung um Race Conditions mit destroy() zu vermeiden
      }
      
      console.log('✅ KAMPAGNEDETAIL: Initialisierung abgeschlossen');
      
    } catch (error) {
      console.error('❌ KAMPAGNEDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'KampagneDetail.init');
    }
  }

  // Kooperationen-Tab rendern mit Budget-Progress
  renderKooperationen() {
    const formatCurrency = (v) => v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-';
    // Für Progress das Creator-Budget verwenden (nicht Gesamtbudget)
    const totalBudget = this.kampagneData?.auftrag?.creator_budget || 0;
    const used = this.koopBudgetSum;
    const percent = totalBudget > 0 ? Math.min(100, Math.round((used / totalBudget) * 100)) : 0;
    // Videos
    const totalVideos = this.kampagneData?.videoanzahl || 0;
    const usedVideos = this.koopVideosUsed || 0;
    const remainingVideos = Math.max(0, totalVideos - usedVideos);
    const percentVideos = totalVideos > 0 ? Math.min(100, Math.round((usedVideos / totalVideos) * 100)) : 0;

    const progressHtml = `
      <div class="budget-progress">
        <div class="budget-header">
          <span>Aufgebraucht: ${formatCurrency(used)} von ${formatCurrency(totalBudget)}</span>
          <span>${percent}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
      </div>
      <div class="budget-progress" style="margin-top:12px;">
        <div class="budget-header">
          <span>Videos: ${usedVideos} von ${totalVideos} | Rest: ${remainingVideos}</span>
          <span>${percentVideos}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${percentVideos}%"></div></div>
      </div>`;

    if (!this.kooperationen || this.kooperationen.length === 0) {
      return `
        ${progressHtml}
        <div class="empty-state">
          <p>Keine Kooperationen verknüpft</p>
          <button class="primary-btn" onclick="window.navigateTo('/kooperation/new')">Kooperation anlegen</button>
        </div>
      `;
    }

    const rows = this.kooperationen.map(k => `
      <tr>
        <td><a href="/kooperation/${k.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${k.id}')">${window.validatorSystem.sanitizeHtml(k.name || '—')}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(k.creator ? `${k.creator.vorname} ${k.creator.nachname}` : 'Unbekannt')}</td>
        <td>${k.videoanzahl || 0}</td>
        <td><span class="status-badge status-${(k.status || 'unknown').toLowerCase()}">${k.status || '-'}</span></td>
        <td>${formatCurrency(k.einkaufspreis_gesamt)}</td>
      </tr>
    `).join('');

    return `
      ${progressHtml}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Creator</th>
              <th>Videos</th>
              <th>Status</th>
              <th>Gesamtkosten</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Creator Sourcing Tabelle (nutzt zentrale CreatorTable)
  renderCreatorSourcing() {
    if (!this.sourcingCreators || this.sourcingCreators.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Creator gefunden.</p>
        </div>
      `;
    }
    return `
      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all-sourcing" class="secondary-btn">Alle auswählen</button>
        </div>
      </div>
      ${renderCreatorTable(this.sourcingCreators, { showFavoriteAction: true, showSelection: true, kampagneId: this.kampagneId })}
    `;
  }

  renderFavoriten() {
    if (!this.favoriten || this.favoriten.length === 0) {
      return `
        <div class="empty-state">
          <p>Noch keine Favoriten.</p>
        </div>
      `;
    }
    return `
      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all-favs" class="secondary-btn">Alle auswählen</button>
        </div>
      </div>
      ${renderCreatorTable(this.favoriten, { showFavoritesMenu: true, showSelection: true, kampagneId: this.kampagneId })}
    `;
  }

   renderRechnungen() {
     if (!this.rechnungen || this.rechnungen.length === 0) {
       return `
         <div class="empty-state">
           <p>Keine Rechnungen zu dieser Kampagne.</p>
         </div>
       `;
     }
     const fmt = (v) => v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-';
     const fDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
     const rows = this.rechnungen.map(r => `
       <tr>
         <td><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${window.validatorSystem.sanitizeHtml(r.rechnung_nr || '—')}</a></td>
         <td><span class="status-badge status-${(r.status||'unknown').toLowerCase()}">${r.status || '-'}</span></td>
         <td>${r.creator ? window.validatorSystem.sanitizeHtml(`${r.creator.vorname || ''} ${r.creator.nachname || ''}`.trim() || '-') : '-'}</td>
         <td>${r.kooperation ? `<a href="/kooperation/${r.kooperation.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${r.kooperation.id}')">${window.validatorSystem.sanitizeHtml(r.kooperation.name || r.kooperation.id)}</a>` : '-'}</td>
         <td>${fmt(r.nettobetrag)}</td>
         <td>${fmt(r.bruttobetrag)}</td>
         <td>${fDate(r.gestellt_am)}</td>
         <td>${fDate(r.bezahlt_am)}</td>
         <td>${r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" rel="noopener">PDF</a>` : '-'}</td>
       </tr>
     `).join('');
     return `
       <div class="data-table-container">
         <table class="data-table">
           <thead>
              <tr>
                <th>Rechnungs-Nr</th>
                <th>Status</th>
                <th>Creator</th>
                <th>Kooperation</th>
                <th>Netto</th>
                <th>Brutto</th>
                <th>Gestellt</th>
                <th>Bezahlt</th>
                <th>Beleg</th>
              </tr>
           </thead>
           <tbody>${rows}</tbody>
         </table>
       </div>
     `;
   }

  // Lade kritische Daten parallel (Performance-optimiert)
  async loadCriticalData() {
    console.log('🔄 KAMPAGNEDETAIL: Lade kritische Daten parallel...');
    const startTime = performance.now();
    
    try {
      // ALLE kritischen Queries PARALLEL ausführen
      const [
        kampagneResult,
        ansprechpartnerResult,
        mitarbeiterResult,
        kooperationenResult
      ] = await Promise.all([
        // 1. Kampagne mit Relations (für Header & Info-Tab)
        window.supabase
          .from('kampagne')
          .select(`
            *,
            unternehmen:unternehmen_id(firmenname, webseite, branche_id),
            marke:marke_id(markenname, webseite),
            auftrag:auftrag_id(auftragsname, status, gesamt_budget, creator_budget, bruttobetrag, nettobetrag)
          `)
          .eq('id', this.kampagneId)
          .single(),
        
        // 2. Ansprechpartner (für Tab-Count & Info-Tab)
        window.supabase
          .from('ansprechpartner_kampagne')
          .select(`
            ansprechpartner:ansprechpartner_id(
              id, vorname, nachname, email,
              unternehmen:unternehmen_id(firmenname),
              position:position_id(name)
            )
          `)
          .eq('kampagne_id', this.kampagneId),
        
        // 3. Mitarbeiter (für Tab-Count & Info-Tab) - über aggregierte View
        window.supabase
          .from('v_kampagne_mitarbeiter_aggregated')
          .select('mitarbeiter_id, name, rolle, profile_image_url, zuordnungsart')
          .eq('kampagne_id', this.kampagneId),
        
        // 4. Kooperationen mit Creator (für Tab-Count & koops-videos)
        // Creator-Daten direkt joinen statt nachzuladen!
        window.supabase
          .from('kooperationen')
          .select(`
            id, name, status, einkaufspreis_gesamt, verkaufspreis_gesamt, videoanzahl,
            creator:creator_id(id, vorname, nachname)
          `)
          .eq('kampagne_id', this.kampagneId)
          .order('created_at', { ascending: false })
      ]);
      
      // Fehler-Handling
      if (kampagneResult.error) throw kampagneResult.error;
      
      // Kampagnen-Daten verarbeiten
      this.kampagneData = kampagneResult.data;
      
      // Ansprechpartner
      this.kampagneData.ansprechpartner = ansprechpartnerResult.data
        ?.map(item => item.ansprechpartner)
        .filter(Boolean) || [];
      
      // Mitarbeiter verarbeiten (aus aggregierter View)
      const mitarbeiterData = mitarbeiterResult.data || [];
      this.kampagneData.mitarbeiter = mitarbeiterData.map(m => ({
        id: m.mitarbeiter_id,
        name: m.name,
        rolle: m.rolle,
        profile_image_url: m.profile_image_url,
        zuordnungsart: m.zuordnungsart
      }));
      // Deprecated roles (falls UI noch darauf zugreift)
      this.kampagneData.projektmanager = [];
      this.kampagneData.scripter = [];
      this.kampagneData.cutter = [];
      
      // Kooperationen (Creator bereits gejoined)
      this.kooperationen = kooperationenResult.data || [];
      this.koopBudgetSum = this.kooperationen.reduce(
        (sum, k) => sum + (parseFloat(k.einkaufspreis_gesamt) || 0), 
        0
      );
      this.koopVideosUsed = this.kooperationen.reduce(
        (sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 
        0
      );
      
      // Anzahl einzigartiger Creator berechnen
      const uniqueCreatorIds = new Set();
      this.kooperationen.forEach(koop => {
        if (koop.creator?.id) {
          uniqueCreatorIds.add(koop.creator.id);
        }
      });
      this.koopCreatorsUsed = uniqueCreatorIds.size;
      
      // Plattformen & Formate parallel laden (für Info-Tab)
      const [plattformResult, formatResult] = await Promise.all([
        window.supabase
          .from('kampagne_plattformen')
          .select('plattform:plattform_id(id, name)')
          .eq('kampagne_id', this.kampagneId),
        
        window.supabase
          .from('kampagne_formate')
          .select('format:format_id(id, name)')
          .eq('kampagne_id', this.kampagneId)
      ]);
      
      if (plattformResult.data) {
        this.kampagneData.plattformen = plattformResult.data
          .map(item => item.plattform)
          .filter(Boolean);
        this.kampagneData.plattform_ids = this.kampagneData.plattformen.map(p => p.id);
      }
      
      if (formatResult.data) {
        this.kampagneData.formate = formatResult.data
          .map(item => item.format)
          .filter(Boolean);
        this.kampagneData.format_ids = this.kampagneData.formate.map(f => f.id);
      }
      
      // Kampagnen-Arten laden (falls vorhanden)
      if (this.kampagneData.art_der_kampagne?.length > 0) {
        const { data: kampagneArten } = await window.supabase
          .from('kampagne_art_typen')
          .select('id, name, beschreibung')
          .in('id', this.kampagneData.art_der_kampagne);
        this.kampagneData.kampagne_art_typen = kampagneArten || [];
      }
      
      // Notizen & Ratings parallel laden (nur Counts für Tabs)
      if (window.notizenSystem) {
        this.notizen = await window.notizenSystem.loadNotizen('kampagne', this.kampagneId);
      }
      if (window.bewertungsSystem) {
        this.ratings = await window.bewertungsSystem.loadBewertungen('kampagne', this.kampagneId);
      }
      
      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ KAMPAGNEDETAIL: Kritische Daten geladen in ${loadTime}ms`);
      
    } catch (error) {
      console.error('❌ KAMPAGNEDETAIL: Fehler beim Laden der kritischen Daten:', error);
      throw error;
    }
  }

  // Lade History für Lazy Loading (Performance-optimiert)
  async loadHistory() {
    try {
      // Kampagnen-History laden
      const { data: hist } = await window.supabase
        .from('kampagne_history')
        .select('id, old_status, new_status, comment, created_at, benutzer:changed_by(name)')
        .eq('kampagne_id', this.kampagneId)
        .order('created_at', { ascending: false });
      
      this.history = (hist || []).map(h => ({
        id: h.id,
        old_status: h.old_status || null,
        new_status: h.new_status || null,
        comment: h.comment || '',
        created_at: h.created_at,
        user_name: h.benutzer?.name || '-'
      }));
      this.historyCount = this.history.length;
      
      // Kooperationen-History laden
      const koopIds = (this.kooperationen || []).map(k => k.id).filter(Boolean);
      if (koopIds.length > 0) {
        const koopMap = (this.kooperationen || []).reduce((acc, k) => { 
          acc[k.id] = k; 
          return acc; 
        }, {});
        
        const { data: khist } = await window.supabase
          .from('kooperation_history')
          .select('id, kooperation_id, old_status, new_status, comment, created_at, benutzer:changed_by(name)')
          .in('kooperation_id', koopIds)
          .order('created_at', { ascending: false });
        
        this.koopHistory = (khist || []).map(h => ({
          id: h.id,
          kooperation_id: h.kooperation_id,
          kooperation_name: koopMap[h.kooperation_id]?.name || h.kooperation_id,
          old_status: h.old_status || null,
          new_status: h.new_status || null,
          comment: h.comment || '',
          created_at: h.created_at,
          user_name: h.benutzer?.name || '-'
        }));
        this.koopHistoryCount = this.koopHistory.length;
      } else {
        this.koopHistory = [];
        this.koopHistoryCount = 0;
      }
      
      // Tab updaten
      this.updateHistoryTab();
      
    } catch (e) {
      console.error('❌ KAMPAGNEDETAIL: Fehler beim Laden der History:', e);
      this.history = [];
      this.koopHistory = [];
      this.historyCount = 0;
      this.koopHistoryCount = 0;
    }
  }

  // Lade Tab-spezifische Daten on-demand (Performance-optimiert)
  async loadTabData(tabName) {
    // Nur laden wenn noch nicht geladen
    const loadingKey = `_${tabName}Loaded`;
    if (this[loadingKey]) {
      console.log(`✅ KAMPAGNEDETAIL: Tab ${tabName} bereits geladen`);
      return;
    }
    
    console.log(`🔄 KAMPAGNEDETAIL: Lade Daten für Tab: ${tabName}`);
    const startTime = performance.now();
    
    try {
      switch(tabName) {
        case 'creators':
          if (!this.creator || this.creator.length === 0) {
            const { data } = await window.supabase
              .from('kampagne_creator')
              .select(`
                *,
                creator:creator_id(
                  id, vorname, nachname, instagram, instagram_follower,
                  tiktok, tiktok_follower, mail, telefonnummer
                )
              `)
              .eq('kampagne_id', this.kampagneId);
            this.creator = data || [];
            this.updateCreatorsTab();
          }
          break;
          
        case 'sourcing':
          if (!this.sourcingCreators || this.sourcingCreators.length === 0) {
            const { data } = await window.supabase
              .from('kampagne_creator_sourcing')
              .select(`
                id,
                creator:creator_id (
                  id, vorname, nachname,
                  creator_types:creator_creator_type(creator_type:creator_type_id(name)),
                  sprachen:creator_sprachen(sprachen:sprache_id(name)),
                  branchen:creator_branchen(branchen_creator:branche_id(name)),
                  instagram_follower, tiktok_follower,
                  lieferadresse_stadt, lieferadresse_land
                )
              `)
              .eq('kampagne_id', this.kampagneId);
            
            this.sourcingCreators = (data || []).map(row => {
              const c = row.creator || {};
              return {
                id: c.id,
                vorname: c.vorname,
                nachname: c.nachname,
                creator_types: (c.creator_types || []).map(x => x.creator_type).filter(Boolean),
                sprachen: (c.sprachen || []).map(x => x.sprachen).filter(Boolean),
                branchen: (c.branchen || []).map(x => x.branchen_creator).filter(Boolean),
                instagram_follower: c.instagram_follower,
                tiktok_follower: c.tiktok_follower,
                lieferadresse_stadt: c.lieferadresse_stadt,
                lieferadresse_land: c.lieferadresse_land,
              };
            });
            this.updateSourcingTab();
          }
          break;
          
        case 'favs':
          if (!this.favoriten || this.favoriten.length === 0) {
            const { data } = await window.supabase
              .from('kampagne_creator_favoriten')
              .select(`
                id,
                creator:creator_id (
                  id, vorname, nachname,
                  creator_types:creator_creator_type(creator_type:creator_type_id(name)),
                  sprachen:creator_sprachen(sprachen:sprache_id(name)),
                  branchen:creator_branchen(branchen_creator:branche_id(name)),
                  instagram_follower, tiktok_follower,
                  lieferadresse_stadt, lieferadresse_land
                )
              `)
              .eq('kampagne_id', this.kampagneId);
            
            this.favoriten = (data || []).map(row => {
              const c = row.creator || {};
              return {
                id: c.id,
                vorname: c.vorname,
                nachname: c.nachname,
                creator_types: (c.creator_types || []).map(x => x.creator_type).filter(Boolean),
                sprachen: (c.sprachen || []).map(x => x.sprachen).filter(Boolean),
                branchen: (c.branchen || []).map(x => x.branchen_creator).filter(Boolean),
                instagram_follower: c.instagram_follower,
                tiktok_follower: c.tiktok_follower,
                lieferadresse_stadt: c.lieferadresse_stadt,
                lieferadresse_land: c.lieferadresse_land,
              };
            });
            this.updateFavoritenTab();
          }
          break;
          
        case 'rechnungen':
          if (!this.rechnungen || this.rechnungen.length === 0) {
            const { data } = await window.supabase
              .from('rechnung')
              .select(`
                id, rechnung_nr, status, nettobetrag, bruttobetrag,
                gestellt_am, bezahlt_am, pdf_url,
                kooperation:kooperation_id(id, name),
                creator:creator_id(id, vorname, nachname)
              `)
              .eq('kampagne_id', this.kampagneId)
              .order('gestellt_am', { ascending: false });
            this.rechnungen = data || [];
            this.updateRechnungenTab();
          }
          break;
          
        case 'history':
          if ((!this.history || this.history.length === 0) && 
              (!this.koopHistory || this.koopHistory.length === 0)) {
            await this.loadHistory();
          }
          break;
      }
      
      this[loadingKey] = true;
      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ KAMPAGNEDETAIL: Tab ${tabName} Daten geladen in ${loadTime}ms`);
      
    } catch (error) {
      console.error(`❌ KAMPAGNEDETAIL: Fehler beim Laden von Tab ${tabName}:`, error);
    }
  }

  // Rendere Kampagnen-Detail
  async render() {
    if (!this.kampagneData) {
      this.showNotFound();
      return;
    }

    // Setze Headline
    window.setHeadline(`Kampagne: ${this.kampagneData.kampagnenname}`);

    const canEdit = window.currentUser?.permissions?.kampagne?.can_edit || false;
    const canDelete = window.currentUser?.permissions?.kampagne?.can_delete || false;
    const canCreateKooperation = window.currentUser?.permissions?.kooperation?.can_edit || false;
    const canCreateVideo = window.currentUser?.permissions?.kooperation?.can_edit || false;
    
    // Hilfsfunktionen für Formatierung
    const formatDate = (date) => {
      return date ? new Date(date).toLocaleDateString('de-DE') : '-';
    };

    const formatCurrency = (value) => {
      return value ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value) : '-';
    };

    const formatArray = (array) => {
      if (!array) return '-';
      if (Array.isArray(array)) {
        return array.map(item => item.name || item).join(', ');
      }
      return String(array);
    };

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          ${canCreateKooperation ? `<button id="btn-new-kooperation" class="primary-btn" ">Kooperation anlegen</button>` : ''}
          ${canCreateVideo ? `<button id="btn-new-video" class="primary-btn" ">Video anlegen</button>` : ''}
          ${canEdit ? `<button id="btn-edit-kampagne" class="primary-btn" ">Bearbeiten</button>` : ''}
          ${canDelete ? `<button id="btn-delete-kampagne" class="danger-btn">Kampagne löschen</button>` : ''}
        </div>
      </div>

      <div class="content-section">
        <!-- Budget-Kacheln -->
        ${this.renderSummaryCards()}

        <!-- Tab Navigation -->
        <div class="tab-navigation">
          ${window.canViewTable && window.canViewTable('kampagne','kooperationen') !== false ? `
          <button class="tab-button active" data-tab="koops-videos">
            Kooperationen & Videos
            <span class="tab-count">${this.kooperationen.length}</span>
          </button>` : `
          <button class="tab-button active" data-tab="info">
            Informationen
          </button>`}
          ${window.currentUser?.rolle !== 'kunde' && window.canViewTable && window.canViewTable('kampagne','kooperationen') !== false ? `
          <button class="tab-button" data-tab="info">
            Informationen
          </button>` : ''}
          ${window.currentUser?.rolle !== 'kunde' && window.canViewTable && window.canViewTable('kampagne','rechnungen') !== false ? `
          <button class="tab-button" data-tab="rechnungen">
            Rechnungen
            <span class="tab-count">${this.rechnungen?.length || 0}</span>
          </button>` : ''}
          ${window.currentUser?.rolle !== 'kunde' && window.canViewTable && window.canViewTable('kampagne','notizen') !== false ? `
          <button class="tab-button" data-tab="notizen">
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>` : ''}
          ${window.canViewTable && window.canViewTable('kampagne','history') !== false ? `
          <button class="tab-button" data-tab="history">
            History
            <span class="tab-count">${this.historyCount + this.koopHistoryCount}</span>
          </button>` : ''}
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane ${window.canViewTable && window.canViewTable('kampagne','kooperationen') !== false ? '' : 'active'}" id="tab-info">
            <div class="detail-section">
              <div class="detail-grid">
                <!-- Hauptinformationen -->
                <div class="detail-card">
                  <h3>Kampagnen-Informationen</h3>
                  <div class="detail-grid-2">
                    <div class="detail-item">
                      <label>Kampagnenname:</label>
                      <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.kampagnenname)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Status:</label>
                      <span class="status-badge status-${this.kampagneData.status?.toLowerCase() || 'unknown'}">
                        ${this.kampagneData.status || '-'}
                      </span>
                    </div>
                    <div class="detail-item">
                      <label>Art der Kampagne:</label>
                      <span>${formatArray(this.kampagneData.kampagne_art_typen)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Kampagnen-Nummer:</label>
                      <span>${this.kampagneData.kampagnen_nummer || '-'}</span>
                    </div>
                    <div class="detail-item">
                      <label>Start:</label>
                      <span>${formatDate(this.kampagneData.start)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Deadline:</label>
                      <span>${formatDate(this.kampagneData.deadline)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Drehort:</label>
                      <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.drehort || '-')}</span>
                    </div>
                    <div class="detail-item">
                      <label>Creator Anzahl:</label>
                      <span>${this.kampagneData.creatoranzahl || 0}</span>
                    </div>
                    <div class="detail-item">
                      <label>Video Anzahl:</label>
                      <span>${this.kampagneData.videoanzahl || 0}</span>
                    </div>
                  </div>
                </div>

                <!-- Ziele und Budget -->
                <div class="detail-card">
                  <h3>Ziele & Budget</h3>
                  <div class="detail-item">
                    <label>Ziele:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.ziele || '-')}</span>
                  </div>
                  <div class="detail-item">
                    <label>Budget Info:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.budget_info || '-')}</span>
                  </div>
                </div>

                <!-- Unternehmen -->
                <div class="detail-card">
                  <h3>Unternehmen</h3>
                  <div class="detail-item">
                    <label>Firmenname:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.unternehmen?.firmenname || 'Unbekannt')}</span>
                  </div>
                  <div class="detail-item">
                    <label>Webseite:</label>
                    <span>${this.kampagneData.unternehmen?.webseite ? `<a href="${this.kampagneData.unternehmen.webseite}" target="_blank">${this.kampagneData.unternehmen.webseite}</a>` : '-'}</span>
                  </div>
                  <div class="detail-item">
                    <label>Branche:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.unternehmen?.branche_id || '-')}</span>
                  </div>
                </div>

                <!-- Marke -->
                <div class="detail-card">
                  <h3>Marke</h3>
                  <div class="detail-item">
                    <label>Markenname:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.marke?.markenname || 'Unbekannt')}</span>
                  </div>
                  <div class="detail-item">
                    <label>Webseite:</label>
                    <span>${this.kampagneData.marke?.webseite ? `<a href="${this.kampagneData.marke.webseite}" target="_blank">${this.kampagneData.marke.webseite}</a>` : '-'}</span>
                  </div>
                </div>

                <!-- Auftrag -->
                <div class="detail-card">
                  <h3>Auftrag</h3>
                  <div class="detail-item">
                    <label>Auftragsname:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.auftrag?.auftragsname || 'Unbekannt')}</span>
                  </div>
                  <div class="detail-item">
                    <label>Status:</label>
                    <span class="status-badge status-${this.kampagneData.auftrag?.status?.toLowerCase() || 'unknown'}">
                      ${this.kampagneData.auftrag?.status || '-'}
                    </span>
                  </div>
                  <div class="detail-item">
                    <label>Gesamt Budget:</label>
                    <span>${formatCurrency(this.kampagneData.auftrag?.gesamt_budget)}${this.koopBudgetSum ? ` (aufgebraucht: ${formatCurrency(this.koopBudgetSum)})` : ''}</span>
                  </div>
                  <div class="detail-item">
                    <label>Creator Budget:</label>
                    <span>${formatCurrency(this.kampagneData.auftrag?.creator_budget)}${this.koopBudgetSum ? ` (aufgebraucht: ${formatCurrency(this.koopBudgetSum)})` : ''}</span>
                  </div>
                </div>

                <!-- Ansprechpartner -->
                <div class="detail-card">
                  <h3>Ansprechpartner
                    <button class="btn-add-ansprechpartner-kampagne btn btn-sm btn-primary" style="margin-left: 10px;">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4" style="margin-right: 5px;">
                        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                      </svg>
                      Hinzufügen
                    </button>
                  </h3>
                  <div class="detail-item">
                    ${this.renderAnsprechpartner()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Kooperationen & Videos Tab -->
          ${window.canViewTable && window.canViewTable('kampagne','kooperationen') !== false ? `
          <div class="tab-pane active" id="tab-koops-videos">
            <div class="detail-section">
              <div style="margin-bottom: 16px; display: flex; justify-content: flex-end; gap: 8px;">
                <button id="btn-toggle-approved" class="secondary-btn" title="Blende Kooperationen aus, bei denen alle Videos freigegeben sind">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span id="btn-toggle-approved-text">Freigegebene ausblenden</span>
                </button>
                ${window.currentUser?.rolle !== 'kunde' ? `
                <button id="btn-column-visibility" class="secondary-btn">
                  Sichtbarkeit anpassen
                </button>` : ''}
              </div>
              <div id="kooperationen-videos-container"></div>
            </div>
          </div>` : ''}

          <!-- Creators Tab (gebuchte Creator) -->
          <div class="tab-pane" id="tab-creators">
            <div class="detail-section">
              <div id="creators-list">
                ${this.renderCreatorsList()}
              </div>
            </div>
          </div>

          <!-- Creator Sourcing Tab (Kandidatenliste) -->
          <div class="tab-pane" id="tab-sourcing">
            <div class="detail-section">
              ${this.renderCreatorSourcing()}
            </div>
          </div>

          <!-- Favoriten Tab -->
          <div class="tab-pane" id="tab-favs">
            <div class="detail-section">
              ${this.renderFavoriten()}
            </div>
          </div>

          <!-- Rechnungen Tab -->
          <div class="tab-pane" id="tab-rechnungen">
            <div class="detail-section">
              ${this.renderRechnungen()}
            </div>
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="tab-notizen">
            <div class="detail-section">
              <div id="notizen-list">
                ${this.renderNotizen()}
              </div>
            </div>
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="tab-ratings">
            <div class="detail-section">
              <div id="ratings-list">
                ${this.renderRatings()}
              </div>
            </div>
          </div>

          <!-- History Tab -->
          <div class="tab-pane" id="tab-history">
            <div class="detail-section">
              ${this.renderHistory()}
            </div>
          </div>
        </div>
      </div>

      
    `;

    window.setContentSafely(window.content, html);
  }

  // Rendere Summary-Kacheln
  renderSummaryCards() {
    const num = (v) => v || v === 0 ? new Intl.NumberFormat('de-DE').format(v) : '-';
    const formatCurrency = (v) => {
      if (v === null || v === undefined) return '-';
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    };

    // Budget-Daten - mehrere Fallbacks
    const totalBudget = parseFloat(
      this.kampagneData?.auftrag?.creator_budget || 
      this.kampagneData?.auftrag?.gesamt_budget || 
      this.kampagneData?.auftrag?.bruttobetrag || 
      this.kampagneData?.auftrag?.nettobetrag || 
      0
    );
    const usedBudget = this.koopBudgetSum || 0;
    
    // Video-Daten
    const totalVideos = this.kampagneData?.videoanzahl || 0;
    const usedVideos = this.koopVideosUsed || 0;
    
    // Creator-Daten
    const totalCreators = this.kampagneData?.creatoranzahl || 0;
    const usedCreators = this.koopCreatorsUsed || 0;

    // Progress-Prozentsätze
    const getProgressPercentage = (current, total) => {
      if (!total || total <= 0) return 0;
      return Math.min(100, Math.round((current / total) * 100));
    };

    // Progress-Farben
    const getProgressColorClass = (current, total) => {
      if (!total || total <= 0) return '';
      const percentage = getProgressPercentage(current, total);
      if (percentage >= 100) return 'summary-progress-fill--success';
      if (percentage >= 75) return 'summary-progress-fill--warning';
      return '';
    };

    const getBudgetProgressColorClass = () => {
      const percentage = getProgressPercentage(usedBudget, totalBudget);
      if (percentage >= 90) return 'summary-progress-fill--danger';
      if (percentage >= 75) return 'summary-progress-fill--warning';
      return '';
    };

    return `
      <div class="auftragsdetails-summary" style="margin-bottom: var(--space-xl);">
        <div class="summary-cards">
          <div class="summary-card">
            <div class="summary-value">${num(usedVideos)} von ${num(totalVideos)}</div>
            <div class="summary-label">Aktuell gebuchte Videos</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getProgressColorClass(usedVideos, totalVideos)}" 
                   style="width: ${getProgressPercentage(usedVideos, totalVideos)}%">
              </div>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${num(usedCreators)} von ${num(totalCreators)}</div>
            <div class="summary-label">Aktuell gebuchte Creator</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getProgressColorClass(usedCreators, totalCreators)}" 
                   style="width: ${getProgressPercentage(usedCreators, totalCreators)}%">
              </div>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(usedBudget)} von ${formatCurrency(totalBudget)}</div>
            <div class="summary-label">Budget verbraucht</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getBudgetProgressColorClass()}" 
                   style="width: ${getProgressPercentage(usedBudget, totalBudget)}%">
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Rendere Creators-Liste
  renderCreatorsList() {
    if (!this.creator || this.creator.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Creators dieser Kampagne zugewiesen</p>
          <button id="btn-add-creator" class="primary-btn">Creator hinzufügen</button>
        </div>
      `;
    }

    // Tabellenansicht nutzen
    const flatCreators = this.creator.map(row => ({
      id: row.creator?.id,
      vorname: row.creator?.vorname,
      nachname: row.creator?.nachname,
      creator_types: row.creator?.creator_types || [],
      sprachen: row.creator?.sprachen || [],
      branchen: row.creator?.branchen || [],
      instagram_follower: row.creator?.instagram_follower,
      tiktok_follower: row.creator?.tiktok_follower,
      lieferadresse_stadt: row.creator?.lieferadresse_stadt,
      lieferadresse_land: row.creator?.lieferadresse_land,
    }));

    // Stelle sicher, dass die Tabelle importiert ist
    // eslint-disable-next-line no-undef
    const tableHtml = renderCreatorTable(flatCreators);

    return `${tableHtml}`;
  }

  // Rendere Notizen
  renderNotizen() {
    if (!this.notizen || this.notizen.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Notizen vorhanden</p>
          <button id="btn-add-notiz" class="primary-btn">Notiz hinzufügen</button>
        </div>
      `;
    }

    const notizenHtml = this.notizen.map(notiz => `
      <div class="notiz-card">
        <div class="notiz-header">
          <span>${notiz.user_name || 'Unbekannt'}</span>
          <span>${new Date(notiz.created_at).toLocaleDateString('de-DE')}</span>
        </div>
        <div class="notiz-content">
          <p>${window.validatorSystem.sanitizeHtml(notiz.text)}</p>
        </div>
      </div>
    `).join('');

    return `
      <div class="notizen-container">
        ${notizenHtml}
      </div>
      <div class="notizen-actions">
        <button id="btn-add-notiz" class="primary-btn">Notiz hinzufügen</button>
      </div>
    `;
  }

  // Rendere Bewertungen
  renderRatings() {
    if (!this.ratings || this.ratings.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Bewertungen vorhanden</p>
          <button id="btn-add-rating" class="primary-btn">Bewertung hinzufügen</button>
        </div>
      `;
    }

    const ratingsHtml = this.ratings.map(rating => `
      <div class="rating-card">
        <div class="rating-header">
          <span>${rating.user_name || 'Unbekannt'}</span>
          <span>${new Date(rating.created_at).toLocaleDateString('de-DE')}</span>
        </div>
        <div class="rating-stars">
          ${Array.from({ length: 5 }, (_, i) => `
            <span class="star ${i < rating.rating ? 'filled' : ''}">★</span>
          `).join('')}
        </div>
      </div>
    `).join('');

    return `
      <div class="ratings-container">
        ${ratingsHtml}
      </div>
      <div class="ratings-actions">
        <button id="btn-add-rating" class="primary-btn">Bewertung hinzufügen</button>
      </div>
    `;
  }

  // Rendere History (Status-Änderungen)
  renderHistory() {
    if (!this.history || this.history.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Historie vorhanden</p>
        </div>
      `;
    }

    const fDateTime = (d) => d ? new Date(d).toLocaleString('de-DE') : '-';
    const rows = this.history.map(h => `
      <tr>
        <td>${fDateTime(h.created_at)}</td>
        <td>${window.validatorSystem.sanitizeHtml(h.user_name || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(h.old_status || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(h.new_status || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(h.comment || '')}</td>
      </tr>
    `).join('');
    const kampagneSection = `
      <div class="data-table-container">
        <h3 style="margin:8px 0;">Kampagne</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>User</th>
              <th>Alt</th>
              <th>Neu</th>
              <th>Kommentar</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    const koopRows = (this.koopHistory || []).map(h => `
      <tr>
        <td>${fDateTime(h.created_at)}</td>
        <td>${window.validatorSystem.sanitizeHtml(h.user_name || '-')}</td>
        <td><a href="/kooperation/${h.kooperation_id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${h.kooperation_id}')">${window.validatorSystem.sanitizeHtml(h.kooperation_name || '—')}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(h.old_status || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(h.new_status || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(h.comment || '')}</td>
      </tr>
    `).join('');

    const koopSection = `
      <div class="data-table-container" style="margin-top:16px;">
        <h3 style="margin:8px 0;">Kooperationen</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>User</th>
              <th>Kooperation</th>
              <th>Alt</th>
              <th>Neu</th>
              <th>Kommentar</th>
            </tr>
          </thead>
          <tbody>${koopRows}</tbody>
        </table>
      </div>`;

    return `${kampagneSection}${koopSection}`;
  }

  // Zeige "Nicht gefunden" Ansicht
  showNotFound() {
    window.setHeadline('Kampagne nicht gefunden');
    window.content.innerHTML = `
      <div class="error-message">
        <h2>Kampagne nicht gefunden</h2>
        <p>Die angeforderte Kampagne konnte nicht gefunden werden.</p>
      </div>
    `;
  }

  // Binde Events
  bindEvents() {
    // Tab Navigation
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-button')) {
        e.preventDefault();
        this.switchTab(e.target.dataset.tab);
      }
    });

    // Kooperation anlegen Button
    const btnNewKooperation = document.getElementById('btn-new-kooperation');
    if (btnNewKooperation) {
      btnNewKooperation.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🎯 Kooperation anlegen Button geklickt, kampagneId:', this.kampagneId);
        window.navigateTo(`/kooperation/new?kampagne_id=${this.kampagneId}`);
      });
    }

    // Video anlegen Button
    const btnNewVideo = document.getElementById('btn-new-video');
    if (btnNewVideo) {
      btnNewVideo.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🎯 Video anlegen Button geklickt, kampagneId:', this.kampagneId);
        if (!this.videoCreateDrawer) {
          this.videoCreateDrawer = new VideoCreateDrawer();
        }
        this.videoCreateDrawer.open(this.kampagneId);
      });
    }

    // Event-Listener für videoCreated Event (Live-Update der Tabelle)
    window.addEventListener('videoCreated', async (event) => {
      console.log('🎬 Video erstellt Event empfangen:', event.detail);
      // Reload der Tabelle ohne Seitenneuladung
      if (this.kooperationenVideoTable) {
        await this.kooperationenVideoTable.refresh();
        console.log('✅ Tabelle nach Video-Erstellung aktualisiert');
      }
    });

    // Bearbeiten Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-edit-kampagne' || e.target.id === 'btn-edit-kampagne-bottom') {
        e.preventDefault();
        window.navigateTo(`/kampagne/${this.kampagneId}/edit`);
      }
    });

    // Creator hinzufügen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-add-creator') {
        e.preventDefault();
        this.showAddCreatorModal();
      }
    });

    // Notiz hinzufügen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-add-notiz') {
        e.preventDefault();
        this.showAddNotizModal();
      }
    });

    // Bewertung hinzufügen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-add-rating') {
        e.preventDefault();
        this.showAddRatingModal();
      }
    });

    // Spalten-Sichtbarkeit Button (delegiert)
    const columnVisibilityHandler = (e) => {
      if (e.target.id === 'btn-column-visibility') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.showColumnVisibilityDrawer();
      }
    };
    // Entferne alten Handler falls vorhanden
    document.removeEventListener('click', this._columnVisibilityHandler);
    this._columnVisibilityHandler = columnVisibilityHandler;
    document.addEventListener('click', this._columnVisibilityHandler);

    // Toggle Freigegebene Button (delegiert)
    const toggleApprovedHandler = (e) => {
      if (e.target.id === 'btn-toggle-approved' || e.target.closest('#btn-toggle-approved')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        if (this.kooperationenVideoTable) {
          this.kooperationenVideoTable.toggleApprovedFilter();
          
          // Update Button-Text
          const btnText = document.getElementById('btn-toggle-approved-text');
          if (btnText) {
            btnText.textContent = this.kooperationenVideoTable.hideApprovedKooperationen 
              ? 'Freigegebene anzeigen' 
              : 'Freigegebene ausblenden';
          }
          
          // Update Button-Style für aktiven Zustand
          const btn = document.getElementById('btn-toggle-approved');
          if (btn) {
            if (this.kooperationenVideoTable.hideApprovedKooperationen) {
              btn.classList.add('btn-active');
            } else {
              btn.classList.remove('btn-active');
            }
          }
        }
      }
    };
    // Entferne alten Handler falls vorhanden
    document.removeEventListener('click', this._toggleApprovedHandler);
    this._toggleApprovedHandler = toggleApprovedHandler;
    document.addEventListener('click', this._toggleApprovedHandler);

    // Löschen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-delete-kampagne') {
        e.preventDefault();
        this.showDeleteConfirmation();
      }
    });

    // Notizen Update Event
    window.addEventListener('notizenUpdated', async (e) => {
      if (e.detail.entityType === 'kampagne' && e.detail.entityId === this.kampagneId) {
        console.log('🔄 KAMPAGNEDETAIL: Notizen wurden aktualisiert, lade neu...');
        this.notizen = await window.notizenSystem.loadNotizen('kampagne', this.kampagneId);
        this.renderNotizen();
      }
    });

    // Bewertungen Update Event
    window.addEventListener('bewertungenUpdated', async (e) => {
      if (e.detail.entityType === 'kampagne' && e.detail.entityId === this.kampagneId) {
        console.log('🔄 KAMPAGNEDETAIL: Bewertungen wurden aktualisiert, lade neu...');
        this.ratings = await window.bewertungsSystem.loadBewertungen('kampagne', this.kampagneId);
        this.renderRatings();
      }
    });

    // Refresh bei Kooperations-Status-Änderungen (History updaten)
    window.addEventListener('entityUpdated', async (e) => {
      if (e.detail?.entity === 'kooperation') {
        await this.loadKampagneData();
        const pane = document.querySelector('#tab-history .detail-section');
        if (pane) pane.innerHTML = `${this.renderHistory()}`;
        const btn = document.querySelector('.tab-button[data-tab="history"] .tab-count');
        if (btn) btn.textContent = String(this.historyCount + this.koopHistoryCount);
      }
    });

    // Soft-Refresh bei Realtime-Updates (nur wenn kein Formular aktiv)
    window.addEventListener('softRefresh', async (e) => {
      // Prüfe ob ein Formular aktiv ist (Edit-Form oder Create-Drawer)
      const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
      
      if (hasActiveForm) {
        console.log('⏸️ KAMPAGNEDETAIL: Formular aktiv - Soft-Refresh übersprungen');
        return;
      }
      
      // Nur wenn auf Kampagne-Detail-Seite
      if (!this.kampagneId || !location.pathname.includes('/kampagne/')) {
        return;
      }
      
      console.log('🔄 KAMPAGNEDETAIL: Soft-Refresh - lade Daten neu');
      await this.loadKampagneData();
      this.render();
      this.bindEvents();
    });

    // Zu Favoriten hinzufügen (nur im Sourcing-Tab vorhanden)
    document.addEventListener('click', async (e) => {
      const addFav = e.target.closest('.action-item.add-favorite');
      if (!addFav) return;
      e.preventDefault();
      const creatorId = addFav.dataset.creatorId;
      const kampagneId = addFav.dataset.kampagneId || this.kampagneId;
      try {
        await window.supabase
          .from('kampagne_creator_favoriten')
          .insert({ kampagne_id: kampagneId, creator_id: creatorId });
        // Favoriten neu laden
        const { data: favs } = await window.supabase
          .from('kampagne_creator_favoriten')
          .select(`
            creator:creator_id ( id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land )
          `)
          .eq('kampagne_id', kampagneId);
        this.favoriten = (favs || []).map(row => ({
          id: row.creator?.id,
          vorname: row.creator?.vorname,
          nachname: row.creator?.nachname,
          instagram_follower: row.creator?.instagram_follower,
          tiktok_follower: row.creator?.tiktok_follower,
          lieferadresse_stadt: row.creator?.lieferadresse_stadt,
          lieferadresse_land: row.creator?.lieferadresse_land,
        }));
        // Tab neu rendern
        const favPane = document.querySelector('#tab-favs .detail-section');
        if (favPane) {
          favPane.innerHTML = `${this.renderFavoriten()}`;
        }
        alert('Zu Favoriten hinzugefügt.');
      } catch (err) {
        console.error('❌ Fehler beim Hinzufügen zu Favoriten', err);
        alert('Hinzufügen zu Favoriten fehlgeschlagen.');
      }
    });

    // Alle auswählen: Sourcing
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all-sourcing') {
        e.preventDefault();
        document.querySelectorAll('#tab-sourcing .creator-check').forEach(cb => { cb.checked = true; });
      }
    });

    // Alle auswählen: Favoriten
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all-favs') {
        e.preventDefault();
        document.querySelectorAll('#tab-favs .creator-check').forEach(cb => { cb.checked = true; });
      }
    });

    // Favoriten: Zu Kampagne hinzufügen (in finale Auswahl)
    document.addEventListener('click', async (e) => {
      const assign = e.target.closest('.action-item.assign-to-campaign');
      if (!assign) return;
      e.preventDefault();
      const creatorId = assign.dataset.creatorId;
      const kampagneId = assign.dataset.kampagneId || this.kampagneId;
      try {
        await window.supabase
          .from('kampagne_creator')
          .insert({ kampagne_id: kampagneId, creator_id: creatorId });
        // optional: aus Favoriten entfernen
        await window.supabase
          .from('kampagne_creator_favoriten')
          .delete()
          .eq('kampagne_id', kampagneId)
          .eq('creator_id', creatorId);
        // Reload creators und favoriten
        const [{ data: creators }, { data: favs }] = await Promise.all([
          window.supabase
            .from('kampagne_creator')
            .select(`*, creator:creator_id(id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land)`) 
            .eq('kampagne_id', kampagneId),
          window.supabase
            .from('kampagne_creator_favoriten')
            .select(`creator:creator_id(id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land)`) 
            .eq('kampagne_id', kampagneId),
        ]);
        this.creator = (creators || []);
        this.favoriten = (favs || []).map(row => ({
          id: row.creator?.id,
          vorname: row.creator?.vorname,
          nachname: row.creator?.nachname,
          instagram_follower: row.creator?.instagram_follower,
          tiktok_follower: row.creator?.tiktok_follower,
          lieferadresse_stadt: row.creator?.lieferadresse_stadt,
          lieferadresse_land: row.creator?.lieferadresse_land,
        }));
        // Re-render Tabs
        const favPane = document.querySelector('#tab-favs .detail-section');
        if (favPane) favPane.innerHTML = `<h2>Favoriten</h2>${this.renderFavoriten()}`;
        const creatorsPane = document.querySelector('#tab-creators #creators-list');
        if (creatorsPane) creatorsPane.innerHTML = this.renderCreatorsList();
        // Tab Counts aktualisieren
        const favBtn = document.querySelector('.tab-button[data-tab="favs"] .tab-count');
        if (favBtn) favBtn.textContent = String(this.favoriten.length);
        const creatorsBtn = document.querySelector('.tab-button[data-tab="creators"] .tab-count');
        if (creatorsBtn) creatorsBtn.textContent = String(this.creator.length);
        // automatischer Tab-Wechsel zum Creator-Tab
        this.switchTab('creators');
      } catch (err) {
        console.error('❌ Fehler beim Hinzufügen zur Kampagne', err);
        alert('Hinzufügen zur Kampagne fehlgeschlagen.');
      }
    });

    // Favoriten: Entfernen
    document.addEventListener('click', async (e) => {
      const remove = e.target.closest('.action-item.remove-favorite');
      if (!remove) return;
      e.preventDefault();
      const creatorId = remove.dataset.creatorId;
      const kampagneId = remove.dataset.kampagneId || this.kampagneId;
      try {
        await window.supabase
          .from('kampagne_creator_favoriten')
          .delete()
          .eq('kampagne_id', kampagneId)
          .eq('creator_id', creatorId);
        // Favoriten neu laden und Tab refreshen
        const { data: favs } = await window.supabase
          .from('kampagne_creator_favoriten')
          .select(`creator:creator_id(id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land)`) 
          .eq('kampagne_id', kampagneId);
        this.favoriten = (favs || []).map(row => ({
          id: row.creator?.id,
          vorname: row.creator?.vorname,
          nachname: row.creator?.nachname,
          instagram_follower: row.creator?.instagram_follower,
          tiktok_follower: row.creator?.tiktok_follower,
          lieferadresse_stadt: row.creator?.lieferadresse_stadt,
          lieferadresse_land: row.creator?.lieferadresse_land,
        }));
        const favPane = document.querySelector('#tab-favs .detail-section');
        if (favPane) favPane.innerHTML = `<h2>Favoriten</h2>${this.renderFavoriten()}`;
        const favBtn = document.querySelector('.tab-button[data-tab="favs"] .tab-count');
        if (favBtn) favBtn.textContent = String(this.favoriten.length);
      } catch (err) {
        console.error('❌ Fehler beim Entfernen aus Favoriten', err);
        alert('Entfernen aus Favoriten fehlgeschlagen.');
      }
    });
  }

  // Tab wechseln
  async switchTab(tabName) {
    console.log('🔄 KAMPAGNEDETAIL: Wechsle zu Tab:', tabName);
    
    // Alle Tab-Buttons deaktivieren
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Alle Tab-Panes ausblenden
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    
    // Gewählten Tab aktivieren
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activePane = document.getElementById(`tab-${tabName}`);
    
    if (activeButton && activePane) {
      activeButton.classList.add('active');
      activePane.classList.add('active');
      console.log('  ✅ Tab aktiviert:', tabName);
      
      // CSS-Klasse für Overflow-Kontrolle setzen/entfernen
      const mainContent = document.querySelector('.main-content');
      if (tabName === 'koops-videos') {
        mainContent?.classList.add('kampagne-detail-grid-active');
      } else {
        mainContent?.classList.remove('kampagne-detail-grid-active');
      }
      
      // Kooperationen-Video-Tabelle lazy-loaden
      if (tabName === 'koops-videos') {
        const container = document.getElementById('kooperationen-videos-container');
        
        // Prüfe ob bereits initialisiert
        const hasInstance = !!this.kooperationenVideoTable;
        const hasDOM = container?.querySelector('.grid-wrapper');
        
        console.log('  🔍 Tabelle-Status:', { hasInstance, hasDOM });
        
        // Nur laden wenn komplett neu
        if (!hasInstance && !hasDOM) {
          console.log('  🔄 Lade Kooperationen-Video-Tabelle...');
          this.kooperationenVideoTable = new KampagneKooperationenVideoTable(this.kampagneId);
          await this.kooperationenVideoTable.init('kooperationen-videos-container');
          console.log('  ✅ Kooperationen-Video-Tabelle geladen');
        } else {
          console.log('  ✅ Kooperationen-Video-Tabelle bereits vorhanden');
        }
      }
      
      // NEU: Tab-spezifische Daten lazy-loaden (Performance-optimiert)
      if (!['koops-videos', 'info', 'notizen', 'ratings'].includes(tabName)) {
        await this.loadTabData(tabName);
      }
      
      // Nach dem Laden: Prüfe nochmal ob der Tab noch active ist
      console.log('  🔍 NACH dem Laden - Pane hat noch active class:', activePane.classList.contains('active'));
    } else {
      console.error('❌ Tab oder Pane nicht gefunden!', { tabName, activeButton: !!activeButton, activePane: !!activePane });
    }
  }

  // Zeige "Creator hinzufügen" Modal
  showAddCreatorModal() {
    console.log('🎯 Zeige "Creator hinzufügen" Modal');
    alert('Funktion zum Hinzufügen von Creators wird implementiert...');
  }

  // Zeige "Notiz hinzufügen" Modal
  showAddNotizModal() {
    console.log('🎯 Zeige "Notiz hinzufügen" Modal');
    if (window.notizenSystem) {
      window.notizenSystem.showAddNotizModal('kampagne', this.kampagneId);
    }
  }

  // Zeige "Bewertung hinzufügen" Modal
  showAddRatingModal() {
    console.log('🎯 Zeige "Bewertung hinzufügen" Modal');
    if (window.bewertungsSystem) {
      window.bewertungsSystem.showAddRatingModal('kampagne', this.kampagneId);
    }
  }

  // Zeige Spalten-Sichtbarkeit Drawer
  showColumnVisibilityDrawer() {
    if (!this.videoColumnVisibilityDrawer) {
      this.videoColumnVisibilityDrawer = new VideoTableColumnVisibilityDrawer(this.kampagneId);
    }
    this.videoColumnVisibilityDrawer.open();
  }

  // Update Toggle-Button-State
  updateToggleApprovedButton() {
    if (!this.kooperationenVideoTable) {
      console.log('⚠️ updateToggleApprovedButton: Keine Tabellen-Instanz');
      return;
    }
    
    const btn = document.getElementById('btn-toggle-approved');
    const btnText = document.getElementById('btn-toggle-approved-text');
    
    console.log('🔘 Update Button-State:', {
      hasBtn: !!btn,
      hasBtnText: !!btnText,
      filterActive: this.kooperationenVideoTable.hideApprovedKooperationen
    });
    
    if (btn && btnText) {
      const isHiding = this.kooperationenVideoTable.hideApprovedKooperationen;
      
      btnText.textContent = isHiding 
        ? 'Freigegebene anzeigen' 
        : 'Freigegebene ausblenden';
      
      if (isHiding) {
        btn.classList.add('btn-active');
      } else {
        btn.classList.remove('btn-active');
      }
      
      console.log(`✅ Button aktualisiert: "${btnText.textContent}", active=${isHiding}`);
    }
  }

  // Zeige Lösch-Bestätigung
  showDeleteConfirmation() {
    const confirmed = confirm('Sind Sie sicher, dass Sie diese Kampagne löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.');
    if (confirmed) {
      this.deleteKampagne();
    }
  }

  // Lösche Kampagne
  async deleteKampagne() {
    try {
      const { error } = await window.supabase
        .from('kampagne')
        .delete()
        .eq('id', this.kampagneId);
      
      if (error) {
        throw error;
      }

      // Event auslösen für Listen-Update
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'kampagne', action: 'deleted', id: this.kampagneId }
      }));
      
      // Zurück zur Liste
      window.navigateTo('/kampagne');
    } catch (error) {
      console.error('❌ Fehler beim Löschen der Kampagne:', error);
      alert('Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  // Tab-Update-Methoden für Lazy Loading (Performance-optimiert)
  updateCreatorsTab() {
    const container = document.querySelector('#tab-creators #creators-list');
    if (container) {
      container.innerHTML = this.renderCreatorsList();
      // Tab-Count aktualisieren
      const btn = document.querySelector('.tab-button[data-tab="creators"] .tab-count');
      if (btn) btn.textContent = String(this.creator.length);
    }
  }

  updateSourcingTab() {
    const container = document.querySelector('#tab-sourcing .detail-section');
    if (container) {
      container.innerHTML = this.renderCreatorSourcing();
      // Tab-Count aktualisieren
      const btn = document.querySelector('.tab-button[data-tab="sourcing"] .tab-count');
      if (btn) btn.textContent = String(this.sourcingCreators.length);
    }
  }

  updateFavoritenTab() {
    const container = document.querySelector('#tab-favs .detail-section');
    if (container) {
      container.innerHTML = this.renderFavoriten();
      // Tab-Count aktualisieren
      const btn = document.querySelector('.tab-button[data-tab="favs"] .tab-count');
      if (btn) btn.textContent = String(this.favoriten.length);
    }
  }

  updateRechnungenTab() {
    const container = document.querySelector('#tab-rechnungen .detail-section');
    if (container) {
      container.innerHTML = this.renderRechnungen();
      // Tab-Count aktualisieren
      const btn = document.querySelector('.tab-button[data-tab="rechnungen"] .tab-count');
      if (btn) btn.textContent = String(this.rechnungen.length);
    }
  }

  updateHistoryTab() {
    const container = document.querySelector('#tab-history .detail-section');
    if (container) {
      container.innerHTML = this.renderHistory();
      // Tab-Count aktualisieren
      const btn = document.querySelector('.tab-button[data-tab="history"] .tab-count');
      if (btn) btn.textContent = String(this.historyCount + this.koopHistoryCount);
    }
  }

  // Cleanup
  destroy() {
    console.log('🗑️ KAMPAGNEDETAIL: Destroy aufgerufen');
    
    // Cleanup der Kooperationen-Video-Tabelle (inkl. Floating-Scrollbar)
    if (this.kooperationenVideoTable && typeof this.kooperationenVideoTable.destroy === 'function') {
      console.log('🗑️ KAMPAGNEDETAIL: Cleanup Kooperationen-Video-Tabelle');
      this.kooperationenVideoTable.destroy();
      this.kooperationenVideoTable = null;
    }
    
    // Entferne CSS-Klasse von main-content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.classList.remove('kampagne-detail-grid-active');
      console.log('✅ KAMPAGNEDETAIL: CSS-Klasse "kampagne-detail-grid-active" entfernt');
    }
    
    // Sicherheits-Cleanup: Entferne alle Kampagnen-Floating-Scrollbars
    const floatingScrollbars = document.querySelectorAll('.floating-scrollbar-kampagne');
    floatingScrollbars.forEach(scrollbar => {
      if (scrollbar.parentNode) {
        scrollbar.parentNode.removeChild(scrollbar);
        console.log('✅ KAMPAGNEDETAIL: Floating-Scrollbar aus DOM entfernt (Fallback)');
      }
    });
    
    // Content zurücksetzen
    window.setContentSafely('');
    console.log('✅ KAMPAGNEDETAIL: Destroy abgeschlossen');
  }

  // Render Ansprechpartner für Detail-Ansicht
  renderAnsprechpartner() {
    if (!this.kampagneData.ansprechpartner || this.kampagneData.ansprechpartner.length === 0) {
      return '<span class="text-muted">Keine Ansprechpartner zugeordnet</span>';
    }

    // Ansprechpartner als klickbare Tags mit Details
    const ansprechpartnerTags = this.kampagneData.ansprechpartner
      .filter(ap => ap && ap.vorname && ap.nachname) // Nur gültige Ansprechpartner
      .map(ap => {
        const details = [
          ap.position?.name,
          ap.unternehmen?.firmenname
        ].filter(Boolean).join(' • ');
        
        return `<a href="#" class="tag tag--ansprechpartner" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${ap.id}')">
          ${ap.vorname} ${ap.nachname}
          ${details ? `<small style="opacity: 0.8; margin-left: 5px;">(${details})</small>` : ''}
        </a>`;
      })
      .join('');

    return `<div class="tags">${ansprechpartnerTags}</div>`;
  }

  // Event-Handler für Ansprechpartner hinzufügen Button
  bindAnsprechpartnerEvents() {
    const addButton = document.querySelector('.btn-add-ansprechpartner-kampagne');
    if (addButton) {
      addButton.addEventListener('click', () => {
        window.actionsDropdown.openAddAnsprechpartnerToKampagneModal(this.kampagneId);
      });
    }

    // Event-Listener für automatische Aktualisierung
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'ansprechpartner' && e.detail.action === 'added' && e.detail.kampagneId === this.kampagneId) {
        this.loadKampagneData().then(() => {
          this.render();
        });
      }
    });
  }

  // Bearbeitungsformular anzeigen
  showEditForm() {
    console.log('🎯 KAMPAGNEDETAIL: Zeige Bearbeitungsformular');
    window.setHeadline('Kampagne bearbeiten');
    
    // Daten für FormSystem vorbereiten
    const formData = { ...this.kampagneData };
    
    // Edit-Mode Flags setzen
    formData._isEditMode = true;
    formData._entityId = this.kampagneId;
    
    // Verknüpfte IDs für das Formular setzen
    if (this.kampagneData.unternehmen_id) {
      formData.unternehmen_id = this.kampagneData.unternehmen_id;
      console.log('🏢 KAMPAGNEDETAIL: Unternehmen-ID für Edit-Mode:', this.kampagneData.unternehmen_id);
    }
    if (this.kampagneData.marke_id) {
      formData.marke_id = this.kampagneData.marke_id;
      console.log('🏷️ KAMPAGNEDETAIL: Marke-ID für Edit-Mode:', this.kampagneData.marke_id);
    }
    if (this.kampagneData.auftrag_id) {
      formData.auftrag_id = this.kampagneData.auftrag_id;
      console.log('📋 KAMPAGNEDETAIL: Auftrag-ID für Edit-Mode:', this.kampagneData.auftrag_id);
    }
    
    // Multi-Select IDs extrahieren für Edit-Mode
    formData.ansprechpartner_ids = this.kampagneData.ansprechpartner ? this.kampagneData.ansprechpartner.map(a => a.id) : [];
    formData.mitarbeiter_ids = this.kampagneData.mitarbeiter ? this.kampagneData.mitarbeiter.map(m => m.id) : [];
    formData.pm_ids = this.kampagneData.projektmanager ? this.kampagneData.projektmanager.map(p => p.id) : [];
    formData.scripter_ids = this.kampagneData.scripter ? this.kampagneData.scripter.map(s => s.id) : [];
    formData.cutter_ids = this.kampagneData.cutter ? this.kampagneData.cutter.map(c => c.id) : [];
    
    // Single-Select IDs korrekt setzen
    if (this.kampagneData.status_id) {
      formData.status_id = this.kampagneData.status_id;
    }
    if (this.kampagneData.drehort_typ_id) {
      formData.drehort_typ_id = this.kampagneData.drehort_typ_id;
    }
    
    // Array-Felder korrekt formatieren
    if (this.kampagneData.art_der_kampagne && Array.isArray(this.kampagneData.art_der_kampagne)) {
      formData.art_der_kampagne = this.kampagneData.art_der_kampagne;
      console.log('🎨 KAMPAGNEDETAIL: art_der_kampagne gesetzt:', this.kampagneData.art_der_kampagne);
    } else {
      console.log('⚠️ KAMPAGNEDETAIL: art_der_kampagne NICHT gesetzt oder nicht Array:', this.kampagneData.art_der_kampagne);
    }
    if (this.kampagneData.plattform_ids && Array.isArray(this.kampagneData.plattform_ids)) {
      formData.plattform_ids = this.kampagneData.plattform_ids;
    }
    if (this.kampagneData.format_ids && Array.isArray(this.kampagneData.format_ids)) {
      formData.format_ids = this.kampagneData.format_ids;
    }
    
    // Kampagne-Typ explizit setzen
    if (this.kampagneData.kampagne_typ) {
      formData.kampagne_typ = this.kampagneData.kampagne_typ;
      console.log('🏷️ KAMPAGNEDETAIL: kampagne_typ gesetzt:', this.kampagneData.kampagne_typ);
    } else {
      console.log('⚠️ KAMPAGNEDETAIL: kampagne_typ NICHT gesetzt');
    }
    
    console.log('📋 KAMPAGNEDETAIL: Multi-Select IDs extrahiert:', {
      ansprechpartner_ids: formData.ansprechpartner_ids,
      mitarbeiter_ids: formData.mitarbeiter_ids,
      pm_ids: formData.pm_ids,
      scripter_ids: formData.scripter_ids,
      cutter_ids: formData.cutter_ids,
      status_id: formData.status_id,
      drehort_typ_id: formData.drehort_typ_id,
      art_der_kampagne: formData.art_der_kampagne,
      plattform_ids: formData.plattform_ids,
      format_ids: formData.format_ids
    });
    
    console.log('📋 KAMPAGNEDETAIL: FormData für Rendering:', formData);
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('kampagne', formData);
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden mit vorbereiteten Daten
    window.formSystem.bindFormEvents('kampagne', formData);
    
    // Form-Datasets für DynamicDataLoader setzen
    const form = document.getElementById('kampagne-form');
    if (form) {
      form.dataset.isEditMode = 'true';
      form.dataset.entityType = 'kampagne';
      form.dataset.entityId = this.kampagneId;
      
      // Edit-Mode Daten als JSON für DynamicDataLoader - WICHTIGE REIHENFOLGE beachten!
      const editModeData = {
        // Single-Select Felder zuerst - in Abhängigkeits-Reihenfolge
        unternehmen_id: formData.unternehmen_id,
        marke_id: formData.marke_id,
        auftrag_id: formData.auftrag_id,
        status_id: formData.status_id,
        drehort_typ_id: formData.drehort_typ_id,
        kampagne_typ: formData.kampagne_typ,
        // Multi-Select Felder
        ansprechpartner_ids: formData.ansprechpartner_ids,
        mitarbeiter_ids: formData.mitarbeiter_ids,
        pm_ids: formData.pm_ids,
        scripter_ids: formData.scripter_ids,
        cutter_ids: formData.cutter_ids,
        art_der_kampagne: formData.art_der_kampagne,
        plattform_ids: formData.plattform_ids,
        format_ids: formData.format_ids
      };
      
      form.dataset.editModeData = JSON.stringify(editModeData);
      
      console.log('📋 KAMPAGNEDETAIL: EditModeData gesetzt:', editModeData);
      console.log('🎨 KAMPAGNEDETAIL: art_der_kampagne in editModeData:', editModeData.art_der_kampagne);
      
      // Bestehende Werte für Auto-Suggestion verfügbar machen
      if (formData.unternehmen_id) {
        form.dataset.existingUnternehmenId = formData.unternehmen_id;
      }
      if (formData.marke_id) {
        form.dataset.existingMarkeId = formData.marke_id;
      }
      if (formData.auftrag_id) {
        form.dataset.existingAuftragId = formData.auftrag_id;
      }
      
      console.log('📋 KAMPAGNEDETAIL: Form-Datasets gesetzt:', {
        isEditMode: form.dataset.isEditMode,
        entityType: form.dataset.entityType,
        entityId: form.dataset.entityId,
        existingUnternehmenId: form.dataset.existingUnternehmenId,
        existingMarkeId: form.dataset.existingMarkeId,
        existingAuftragId: form.dataset.existingAuftragId,
        editModeData: 'Set'
      });
      
      // Custom Submit Handler für Bearbeitungsformular
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
      
      console.log('🔍 KAMPAGNEDETAIL: Form Datasets gesetzt:', {
        entityId: form.dataset.entityId,
        isEditMode: form.dataset.isEditMode,
        entityType: form.dataset.entityType,
        existingUnternehmenId: form.dataset.existingUnternehmenId,
        existingMarkeId: form.dataset.existingMarkeId,
        existingAuftragId: form.dataset.existingAuftragId
      });
      
      // Race Condition Problem gelöst - kein Timeout-Hack mehr nötig!
      // Die Werte werden jetzt korrekt über DynamicDataLoader.loadDirectQueryOptions() gesetzt
    }
  }

  // Handler für Formular-Submission
  async handleEditFormSubmit() {
    console.log('📝 KAMPAGNEDETAIL: Verarbeite Formular-Submission...');
    
    const form = document.querySelector('form[data-entity-type="kampagne"]');
    if (!form) {
      console.error('❌ Formular nicht gefunden');
      return;
    }

    try {
      const formData = new FormData(form);
      const submitData = {};

      // Tag-basierte Multi-Selects aus Hidden-Selects sammeln (wie bei Creator)
      const hiddenSelects = form.querySelectorAll('select[style*="display: none"], select[style*="display:none"]');
      hiddenSelects.forEach(select => {
        if (select.name && select.name.includes('_ids')) {
          const fieldName = select.name.replace('[]', '');
          const selectedValues = Array.from(select.selectedOptions).map(option => option.value);
          if (selectedValues.length > 0) {
            submitData[fieldName] = selectedValues;
            console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Hidden-Select gesammelt:`, selectedValues);
          }
        }
      });

      // FormData zu Objekt konvertieren (aber Tag-basierte Felder nicht überschreiben)
      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          // Multi-Select behandeln
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) {
            submitData[cleanKey] = [];
          }
          submitData[cleanKey].push(value);
        } else {
          // Nur setzen wenn nicht bereits als Array von Tag-basierten Feldern gesetzt
          if (!submitData.hasOwnProperty(key) || !Array.isArray(submitData[key])) {
          submitData[key] = value;
          } else {
            console.log(`⚠️ Überspringe ${key}, bereits als Array gesetzt:`, submitData[key]);
          }
        }
      }

      console.log('📋 KAMPAGNEDETAIL: Submit-Daten gesammelt:', submitData);

      // Daten über DataService aktualisieren
      const result = await window.dataService.updateEntity('kampagne', this.kampagneId, submitData);
      
      if (result) {
        // Nach Update: Junction Table Beziehungen aktualisieren (Plattformen & Formate)
        try {
          // Hilfsfunktionen
          const toArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);
          const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
          
          // 1. Plattformen aktualisieren
          if (submitData.plattform_ids !== undefined) {
            const plattformIds = uniq(toArray(submitData.plattform_ids));
            
            // Alte Verknüpfungen löschen
            await window.supabase
              .from('kampagne_plattformen')
              .delete()
              .eq('kampagne_id', this.kampagneId);
            
            // Neue Verknüpfungen erstellen
            if (plattformIds.length > 0) {
              const plattformRows = plattformIds.map(plattformId => ({
                kampagne_id: this.kampagneId,
                plattform_id: plattformId
              }));
              await window.supabase.from('kampagne_plattformen').insert(plattformRows);
              console.log('✅ KAMPAGNEDETAIL: Plattform-Verknüpfungen aktualisiert:', plattformRows.length);
            } else {
              console.log('ℹ️ KAMPAGNEDETAIL: Keine Plattformen ausgewählt');
            }
          }
          
          // 2. Formate aktualisieren
          if (submitData.format_ids !== undefined) {
            const formatIds = uniq(toArray(submitData.format_ids));
            
            // Alte Verknüpfungen löschen
            await window.supabase
              .from('kampagne_formate')
              .delete()
              .eq('kampagne_id', this.kampagneId);
            
            // Neue Verknüpfungen erstellen
            if (formatIds.length > 0) {
              const formatRows = formatIds.map(formatId => ({
                kampagne_id: this.kampagneId,
                format_id: formatId
              }));
              await window.supabase.from('kampagne_formate').insert(formatRows);
              console.log('✅ KAMPAGNEDETAIL: Format-Verknüpfungen aktualisiert:', formatRows.length);
            } else {
              console.log('ℹ️ KAMPAGNEDETAIL: Keine Formate ausgewählt');
            }
          }
          
          // 3. Mitarbeiter-Zuordnungen aktualisieren (alle Rollen)
          const mitarbeiter = uniq(toArray(submitData.mitarbeiter_ids));
          const pm = uniq(toArray(submitData.pm_ids));
          const sc = uniq(toArray(submitData.scripter_ids));
          const cu = uniq(toArray(submitData.cutter_ids));
          
          if (mitarbeiter.length > 0 || pm.length > 0 || sc.length > 0 || cu.length > 0) {
            // Alte Verknüpfungen löschen
            await window.supabase
              .from('kampagne_mitarbeiter')
              .delete()
              .eq('kampagne_id', this.kampagneId);
            
            // Neue Verknüpfungen erstellen
            const mitarbeiterRows = [];
            mitarbeiter.forEach(uid => mitarbeiterRows.push({ kampagne_id: this.kampagneId, mitarbeiter_id: uid, role: 'projektmanager' }));
            pm.forEach(uid => mitarbeiterRows.push({ kampagne_id: this.kampagneId, mitarbeiter_id: uid, role: 'projektmanager' }));
            sc.forEach(uid => mitarbeiterRows.push({ kampagne_id: this.kampagneId, mitarbeiter_id: uid, role: 'scripter' }));
            cu.forEach(uid => mitarbeiterRows.push({ kampagne_id: this.kampagneId, mitarbeiter_id: uid, role: 'cutter' }));
            
            if (mitarbeiterRows.length > 0) {
              await window.supabase.from('kampagne_mitarbeiter').insert(mitarbeiterRows);
              console.log('✅ KAMPAGNEDETAIL: Mitarbeiter-Zuordnungen aktualisiert:', mitarbeiterRows.length);
            }
          }
          
          // 4. Ansprechpartner-Zuordnungen aktualisieren
          if (submitData.ansprechpartner_ids !== undefined) {
            const ansprechpartnerIds = uniq(toArray(submitData.ansprechpartner_ids));
            
            // Alte Verknüpfungen löschen
            await window.supabase
              .from('ansprechpartner_kampagne')
              .delete()
              .eq('kampagne_id', this.kampagneId);
            
            // Neue Verknüpfungen erstellen
            if (ansprechpartnerIds.length > 0) {
              const ansprechpartnerRows = ansprechpartnerIds.map(apId => ({
                kampagne_id: this.kampagneId,
                ansprechpartner_id: apId
              }));
              await window.supabase.from('ansprechpartner_kampagne').insert(ansprechpartnerRows);
              console.log('✅ KAMPAGNEDETAIL: Ansprechpartner-Zuordnungen aktualisiert:', ansprechpartnerRows.length);
            }
          }
          
        } catch (e) {
          console.warn('⚠️ KAMPAGNEDETAIL: Junction Table Updates konnten nicht vollständig durchgeführt werden', e);
        }
        
        this.showSuccessMessage('Kampagne erfolgreich aktualisiert!');
        
        // Event auslösen für Listen-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'kampagne', action: 'updated', id: this.kampagneId }
        }));
        
        // Zurück zur Detailseite nach kurzer Verzögerung
        setTimeout(() => {
          window.navigateTo(`/kampagne/${this.kampagneId}`);
        }, 1500);
      }

    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren der Kampagne:', error);
      this.showErrorMessage('Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  // Zeige Erfolgsmeldung
  showSuccessMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success';
    alertDiv.textContent = message;
    
    const form = document.getElementById('kampagne-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }

  // Zeige Fehlermeldung
  showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger';
    alertDiv.textContent = message;
    
    const form = document.getElementById('kampagne-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }
}

// Exportiere Instanz für globale Nutzung
export const kampagneDetail = new KampagneDetail(); 
