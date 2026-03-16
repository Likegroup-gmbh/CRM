// KampagneDetail.js (ES6-Modul)
// Kampagnen-Detail-Ansicht
import { renderCreatorTable } from '../creator/CreatorTable.js';
import { KampagneKooperationenVideoTable } from './KampagneKooperationenVideoTable.js';

import { VideoTableColumnVisibilityDrawer } from './VideoTableColumnVisibilityDrawer.js';
import { getTabIcon } from '../../core/TabUtils.js';
import { KampagneUtils } from './KampagneUtils.js';

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
    this.vertraege = [];
    this.history = [];
    this.historyCount = 0;
    this.koopHistory = [];
    this.koopHistoryCount = 0;
    this.kooperationenVideoTable = null;
    
    this.videoColumnVisibilityDrawer = null;
    this.strategien = [];
    this.briefings = [];
    
    // Race Condition Prevention
    this._isMounted = false;
    this._initPromise = null;
  }

  // Initialisiere Kampagnen-Detail
  async init(kampagneId) {
    console.log('🎯 KAMPAGNEDETAIL: Initialisiere Kampagnen-Detailseite für ID:', kampagneId);
    
    // Setze kampagneId früh für Guard-Vergleich
    const previousKampagneId = this.kampagneId;
    this.kampagneId = kampagneId;
    
    // Guard gegen doppelte parallele Initialisierung für DIESELBE Kampagne
    if (this._initPromise && previousKampagneId === kampagneId) {
      console.log('⚠️ KAMPAGNEDETAIL: Init bereits in Arbeit für diese Kampagne, warte...');
      return this._initPromise;
    }
    
    // Setze Mount-Status
    this._isMounted = true;
    
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
    
    // Prüfen ob dieses Modul noch das aktuelle ist
    if (window.moduleRegistry?.currentModule !== this) {
      console.log('⚠️ KAMPAGNEDETAIL: Nicht mehr das aktuelle Modul, breche ab');
      this._isMounted = false;
      return;
    }
    
    // Speichere Promise für Guard
    this._initPromise = (async () => {
    try {
      // Lade kritische Daten (PARALLEL statt sequentiell!)
      await this.loadCriticalData();
      
      // Prüfe Mount-Status vor DOM-Updates
      if (!this._isMounted) {
        console.log('⚠️ KAMPAGNEDETAIL: Nicht mehr gemounted nach Laden');
        return;
      }
      
      // Breadcrumb aktualisieren mit Edit-Button
      if (window.breadcrumbSystem && this.kampagneData) {
        const canEdit = window.currentUser?.permissions?.kampagne?.can_edit || false;
        const rolle = window.currentUser?.rolle?.toLowerCase();
        const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
        window.breadcrumbSystem.updateBreadcrumb([
          { label: isKunde ? 'Meine Kampagnen' : 'Kampagne', url: isKunde ? '/kunden' : '/kampagne', clickable: true },
          { label: KampagneUtils.getDisplayName(this.kampagneData), url: `/kampagne/${this.kampagneId}`, clickable: false }
        ], {
          id: 'btn-edit-kampagne',
          canEdit: canEdit
        });
      }
      
      // Rendere die Seite
      await this.render();
      
      // Binde Events
      this.bindEvents();
      this.bindAnsprechpartnerEvents();
      
      // Lade initialen Tab mit Promise-basierter Logik (statt setTimeout)
      if (window.canViewTable && window.canViewTable('kampagne','kooperationen') !== false) {
        // Warte bis DOM gerendert ist (requestAnimationFrame ist zuverlässiger als setTimeout)
        await this._initVideoTableSafe();
      }
      
      console.log('✅ KAMPAGNEDETAIL: Initialisierung abgeschlossen');
      
    } catch (error) {
      console.error('❌ KAMPAGNEDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'KampagneDetail.init');
    } finally {
      this._initPromise = null;
    }
    })();
    
    return this._initPromise;
  }
  
  // Promise-basierte Video-Tabellen-Initialisierung (Race-Condition-sicher)
  async _initVideoTableSafe() {
    // Warte auf nächsten Animation Frame um DOM-Rendering abzuschließen
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Prüfe ob noch gemounted und aktuelles Modul
    if (!this._isMounted || window.moduleRegistry?.currentModule !== this) {
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
      
      // Prüfe nochmal ob noch gemounted nach async init
      if (!this._isMounted) {
        console.log('⚠️ Nicht mehr gemounted nach Tabellen-Init');
        return;
      }
      
      console.log('✅ Kooperationen-Video-Tabelle initialisiert');
      
      // Update Button-State nach Init
      this.updateToggleApprovedButton();
    } else {
      console.log('✅ Tabelle DOM bereits vorhanden - Skip:', { 
        hasInstance: !!this.kooperationenVideoTable, 
        hasDOM: !!hasDOM 
      });
    }
  }

  // Kooperationen-Tab rendern mit Budget-Progress
  renderKooperationen() {
    const formatCurrency = (v) => v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-';
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    // Für Progress das Creator-Budget verwenden (nicht Gesamtbudget) – nur für Nicht-Kunden (Einkaufspreis)
    const totalBudget = this.kampagneData?.auftrag?.creator_budget || 0;
    const used = this.koopBudgetSum;
    const percent = totalBudget > 0 ? Math.min(100, Math.round((used / totalBudget) * 100)) : 0;
    // Videos
    const totalVideos = this.kampagneData?.videoanzahl || 0;
    const usedVideos = this.koopVideosUsed || 0;
    const remainingVideos = Math.max(0, totalVideos - usedVideos);
    const percentVideos = totalVideos > 0 ? Math.min(100, Math.round((usedVideos / totalVideos) * 100)) : 0;

    const progressHtml = isKunde ? `
      <div class="budget-progress" style="margin-top:0;">
        <div class="budget-header">
          <span>Videos: ${usedVideos} von ${totalVideos} | Rest: ${remainingVideos}</span>
          <span>${percentVideos}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${percentVideos}%"></div></div>
      </div>` : `
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
          ${!isKunde ? `<button class="primary-btn" onclick="window.navigateTo('/kooperation/new')">Kooperation anlegen</button>` : ''}
        </div>
      `;
    }

    const priceLabel = isKunde ? 'Verkaufspreis' : 'Gesamtkosten';
    const rows = this.kooperationen.map(k => `
      <tr>
        <td><a href="/kooperation/${k.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${k.id}')">${window.validatorSystem.sanitizeHtml(k.name || '—')}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(k.creator ? `${k.creator.vorname} ${k.creator.nachname}` : 'Unbekannt')}</td>
        <td>${k.videoanzahl || 0}</td>
        <td><span class="status-badge status-${(k.status || 'unknown').toLowerCase()}">${k.status || '-'}</span></td>
        <td>${formatCurrency(isKunde ? k.verkaufspreis_gesamt : k.einkaufspreis_gesamt)}</td>
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
              <th>${priceLabel}</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Sourcing Tabelle (nutzt zentrale CreatorTable)
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

  renderVertraege() {
    if (!this.vertraege || this.vertraege.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Verträge vorhanden</h3>
          <p>Für diese Kampagne wurden noch keine Verträge erfasst.</p>
        </div>
      `;
    }

    const fDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
    const getStatusLabel = (isDraft) => isDraft ? 'Entwurf' : 'Final';
    const getStatusClass = (isDraft) => isDraft ? 'draft' : 'aktiv';
    const canViewViaPage = window.canViewPage?.('creator');
    const canViewViaPerm = window.currentUser?.permissions?.creator?.can_view;
    const canViewCreator = canViewViaPage !== false && canViewViaPerm !== false;

    const rows = this.vertraege.map(v => {
      const creatorName = v.creator ? `${v.creator.vorname || ''} ${v.creator.nachname || ''}`.trim() : '-';
      
      return `
        <tr>
          <td><a href="/vertraege/${v.id}" onclick="event.preventDefault(); window.navigateTo('/vertraege/${v.id}')">${window.validatorSystem.sanitizeHtml(v.name || '—')}</a></td>
          <td>${window.validatorSystem.sanitizeHtml(v.typ || '-')}</td>
          <td><span class="status-badge status-${getStatusClass(v.is_draft)}">${getStatusLabel(v.is_draft)}</span></td>
          <td>${v.creator ? (canViewCreator ? `<a href="/creator/${v.creator.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${v.creator.id}')">${window.validatorSystem.sanitizeHtml(creatorName)}</a>` : window.validatorSystem.sanitizeHtml(creatorName)) : '-'}</td>
          <td>${v.datei_url ? `<a href="${v.datei_url}" target="_blank" rel="noopener">PDF</a>` : '-'}</td>
          <td>${fDate(v.created_at)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table vertraege-detail-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Typ</th>
              <th>Status</th>
              <th>Creator</th>
              <th>Datei</th>
              <th>Erstellt am</th>
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
        // Kunden: einkaufspreis_* nicht laden (Datenschutz)
        (() => {
          const rolle = window.currentUser?.rolle?.toLowerCase();
          const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
          const koopFields = isKunde
            ? 'id, name, status, verkaufspreis_gesamt, videoanzahl'
            : 'id, name, status, einkaufspreis_gesamt, verkaufspreis_gesamt, videoanzahl';
          return window.supabase
            .from('kooperationen')
            .select(`${koopFields}, creator:creator_id(id, vorname, nachname)`)
            .eq('kampagne_id', this.kampagneId)
            .order('created_at', { ascending: false });
        })()
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
      this.kampagneData.copywriter = [];
      this.kampagneData.strategie = [];
      this.kampagneData.creator_sourcing = [];
      
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
      
      // Mitarbeiter nach Rollen laden (für Edit-Formular)
      const [
        cutterResult, 
        copywriterResult, 
        strategieResult, 
        creatorSourcingResult,
        paidZieleResult,
        organicZieleResult
      ] = await Promise.all([
        window.supabase
          .from('kampagne_mitarbeiter')
          .select('mitarbeiter:mitarbeiter_id(id, name)')
          .eq('kampagne_id', this.kampagneId)
          .eq('role', 'cutter'),
        window.supabase
          .from('kampagne_mitarbeiter')
          .select('mitarbeiter:mitarbeiter_id(id, name)')
          .eq('kampagne_id', this.kampagneId)
          .eq('role', 'copywriter'),
        window.supabase
          .from('kampagne_mitarbeiter')
          .select('mitarbeiter:mitarbeiter_id(id, name)')
          .eq('kampagne_id', this.kampagneId)
          .eq('role', 'strategie'),
        window.supabase
          .from('kampagne_mitarbeiter')
          .select('mitarbeiter:mitarbeiter_id(id, name)')
          .eq('kampagne_id', this.kampagneId)
          .eq('role', 'creator_sourcing'),
        window.supabase
          .from('kampagne_paid_ziele')
          .select('ziel:ziel_id(id, name)')
          .eq('kampagne_id', this.kampagneId),
        window.supabase
          .from('kampagne_organic_ziele')
          .select('ziel:ziel_id(id, name)')
          .eq('kampagne_id', this.kampagneId)
      ]);
      
      // Cutter
      if (cutterResult.data) {
        this.kampagneData.cutter = cutterResult.data.map(item => item.mitarbeiter).filter(Boolean);
        this.kampagneData.cutter_ids = this.kampagneData.cutter.map(c => c.id);
      }
      
      // Copywriter
      if (copywriterResult.data) {
        this.kampagneData.copywriter = copywriterResult.data.map(item => item.mitarbeiter).filter(Boolean);
        this.kampagneData.copywriter_ids = this.kampagneData.copywriter.map(c => c.id);
      }
      
      // Strategie
      if (strategieResult.data) {
        this.kampagneData.strategie = strategieResult.data.map(item => item.mitarbeiter).filter(Boolean);
        this.kampagneData.strategie_ids = this.kampagneData.strategie.map(s => s.id);
      }
      
      // Sourcing
      if (creatorSourcingResult.data) {
        this.kampagneData.creator_sourcing = creatorSourcingResult.data.map(item => item.mitarbeiter).filter(Boolean);
        this.kampagneData.creator_sourcing_ids = this.kampagneData.creator_sourcing.map(c => c.id);
      }
      
      // Paid-Ziele
      if (paidZieleResult.data) {
        this.kampagneData.paid_ziele = paidZieleResult.data.map(item => item.ziel).filter(Boolean);
        this.kampagneData.paid_ziele_ids = this.kampagneData.paid_ziele.map(z => z.id);
      }
      
      // Organic-Ziele
      if (organicZieleResult.data) {
        this.kampagneData.organic_ziele = organicZieleResult.data.map(item => item.ziel).filter(Boolean);
        this.kampagneData.organic_ziele_ids = this.kampagneData.organic_ziele.map(z => z.id);
      }
      
      // Kampagnen-Arten laden (falls vorhanden)
      if (this.kampagneData.art_der_kampagne?.length > 0) {
        const { data: kampagneArten } = await window.supabase
          .from('kampagne_art_typen')
          .select('id, name, beschreibung')
          .in('id', this.kampagneData.art_der_kampagne);
        this.kampagneData.kampagne_art_typen = kampagneArten || [];
      }
      
      // Notizen, Ratings, Strategien, Briefings & Tab-Counts parallel laden
      const [notizenResult, ratingsResult, strategienResult, briefingsResult, sourcingCountResult, vertraegeCountResult, rechnungenCountResult] = await Promise.all([
        window.notizenSystem ? window.notizenSystem.loadNotizen('kampagne', this.kampagneId) : [],
        window.bewertungsSystem ? window.bewertungsSystem.loadBewertungen('kampagne', this.kampagneId) : [],
        window.supabase
          .from('strategie')
          .select(`
            id, name, beschreibung, created_at,
            unternehmen:unternehmen_id(id, firmenname, logo_url),
            marke:marke_id(id, markenname, logo_url),
            created_by_user:created_by(id, name, profile_image_url)
          `)
          .eq('kampagne_id', this.kampagneId)
          .order('created_at', { ascending: false }),
        window.supabase
          .from('briefings')
          .select('id, product_service_offer, deadline, status, created_at, kooperation_id, assignee_id')
          .eq('kampagne_id', this.kampagneId)
          .order('created_at', { ascending: false }),
        window.supabase
          .from('creator_auswahl')
          .select('*', { count: 'exact', head: true })
          .eq('kampagne_id', this.kampagneId),
        window.supabase
          .from('vertraege')
          .select('*', { count: 'exact', head: true })
          .eq('kampagne_id', this.kampagneId),
        window.supabase
          .from('rechnung')
          .select('*', { count: 'exact', head: true })
          .eq('kampagne_id', this.kampagneId)
      ]);
      
      this.notizen = notizenResult || [];
      this.ratings = ratingsResult || [];
      this.strategien = strategienResult.data || [];
      
      if (briefingsResult.error) {
        console.error('❌ KAMPAGNEDETAIL: Fehler beim Laden der Briefings:', briefingsResult.error);
      }
      this.briefings = briefingsResult.data || [];

      this.sourcingListenCount = sourcingCountResult.count || 0;
      this.vertraegeCount = vertraegeCountResult.count || 0;
      this.rechnungenCount = rechnungenCountResult.count || 0;
      
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
        
        case 'vertraege':
          if (!this.vertraege || this.vertraege.length === 0) {
            const { data } = await window.supabase
              .from('vertraege')
              .select(`
                id, name, typ, is_draft, datei_url, datei_path, created_at,
                creator:creator_id(id, vorname, nachname)
              `)
              .eq('kampagne_id', this.kampagneId)
              .order('created_at', { ascending: false });
            this.vertraege = data || [];
            this.updateVertraegeTab();
          }
          break;
          
        case 'history':
          if ((!this.history || this.history.length === 0) && 
              (!this.koopHistory || this.koopHistory.length === 0)) {
            await this.loadHistory();
          }
          break;

        case 'sourcing-listen':
          if (!this.sourcingListen || this.sourcingListen.length === 0) {
            const { data } = await window.supabase
              .from('creator_auswahl')
              .select(`
                id, name, created_at,
                kampagne:kampagne_id(id, kampagnenname),
                unternehmen:unternehmen_id(id, firmenname, logo_url),
                marke:marke_id(id, markenname, logo_url),
                created_by_user:created_by(id, name, profile_image_url)
              `)
              .eq('kampagne_id', this.kampagneId)
              .order('created_at', { ascending: false });
            this.sourcingListen = data || [];
            this.updateSourcingListenTab();
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
    window.setHeadline(`Kampagne: ${KampagneUtils.getDisplayName(this.kampagneData)}`);

    const canEdit = window.currentUser?.permissions?.kampagne?.can_edit || false;
    const canDelete = window.currentUser?.permissions?.kampagne?.can_delete || false;
    const canCreateKooperation = window.currentUser?.permissions?.kooperation?.can_edit || false;
    
    
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

    const rolle = String(window.currentUser?.rolle || '').trim().toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';

    const html = `
      ${canCreateKooperation ? `
      <div class="page-header">
        <div class="page-header-right">
          <button id="btn-new-kooperation" class="primary-btn">Kooperation anlegen</button>
        </div>
      </div>
      ` : ''}

      <div class="content-section">
        <!-- Budget-Kacheln -->
        ${this.renderSummaryCards()}

        <!-- Tab Navigation -->
        <div class="tab-navigation">
          ${window.canViewTable && window.canViewTable('kampagne','kooperationen') !== false ? `
          <button class="tab-button active" data-tab="koops-videos">
            Kooperationen & Videos
          </button>` : `
          <button class="tab-button active" data-tab="info">
            Informationen
          </button>`}
          <button class="tab-button" data-tab="strategien">
            Strategien <span class="tab-count">${this.strategien?.length || 0}</span>
            ${this.formatDeadlineBadge(this.kampagneData.deadline_strategie)}
          </button>
          <button class="tab-button" data-tab="sourcing-listen">
            Sourcing <span class="tab-count">${this.sourcingListenCount || 0}</span>
            ${this.formatDeadlineBadge(this.kampagneData.deadline_creator_sourcing)}
          </button>
          <button class="tab-button" data-tab="briefings">
            Briefings <span class="tab-count">${this.briefings?.length || 0}</span>
            ${this.formatDeadlineBadge(this.kampagneData.deadline_briefing)}
          </button>
          ${!isKunde && window.canViewTable && window.canViewTable('kampagne','kooperationen') !== false ? `
          <button class="tab-button" data-tab="info">
            Informationen
          </button>` : ''}
          ${!isKunde && window.canViewTable && window.canViewTable('kampagne','rechnungen') !== false ? `
          <button class="tab-button" data-tab="rechnungen">
            Rechnungen <span class="tab-count">${this.rechnungenCount || 0}</span>
          </button>` : ''}
          ${!isKunde ? `
          <button class="tab-button" data-tab="vertraege">
            Verträge <span class="tab-count">${this.vertraegeCount || 0}</span>
          </button>` : ''}
          ${!isKunde && window.canViewTable && window.canViewTable('kampagne','notizen') !== false ? `
          <button class="tab-button" data-tab="notizen">
            Notizen
          </button>` : ''}
          ${!isKunde && window.canViewTable && window.canViewTable('kampagne','history') !== false ? `
          <button class="tab-button" data-tab="history">
            History
          </button>` : ''}
          ${!isKunde ? `
          <button class="tab-button" data-tab="mitarbeiter">
            Mitarbeiter
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
                  <h3 class="section-title">Kampagnen-Informationen</h3>
                  <div class="detail-grid-2">
                    <div class="detail-item">
                      <label>Kampagnenname:</label>
                      <span>${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(this.kampagneData))}</span>
                    </div>
                    ${this.kampagneData.eigener_name ? `
                    <div class="detail-item">
                      <label>Auto-generiert:</label>
                      <span class="text-muted">${window.validatorSystem.sanitizeHtml(this.kampagneData.kampagnenname || '-')}</span>
                    </div>
                    ` : ''}
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

                <!-- Deadlines -->
                <div class="detail-card">
                  <h3 class="section-title">Deadlines</h3>
                  <div class="detail-grid">
                    <div class="detail-item">
                      <label>Briefing:</label>
                      <span>${formatDate(this.kampagneData.deadline_briefing)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Strategie:</label>
                      <span>${formatDate(this.kampagneData.deadline_strategie)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Skripte:</label>
                      <span>${formatDate(this.kampagneData.deadline_skripte)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Sourcing:</label>
                      <span>${formatDate(this.kampagneData.deadline_creator_sourcing)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Video Produktion:</label>
                      <span>${formatDate(this.kampagneData.deadline_video_produktion)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Post Produktion:</label>
                      <span>${formatDate(this.kampagneData.deadline_post_produktion)}</span>
                    </div>
                  </div>
                </div>

                <!-- Budget -->
                <div class="detail-card">
                  <h3 class="section-title">Budget</h3>
                  <div class="detail-item">
                    <label>Budget Info:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.budget_info || '-')}</span>
                  </div>
                </div>

                <!-- Unternehmen -->
                <div class="detail-card">
                  <h3 class="section-title">Unternehmen</h3>
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
                  <h3 class="section-title">Marke</h3>
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
                  <h3 class="section-title">Auftrag</h3>
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
                  <h3 class="section-title">Ansprechpartner</h3>
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
              <div class="koops-videos-toolbar">
                ${!isKunde ? `
                <button id="btn-toggle-approved" class="secondary-btn" title="Blende Kooperationen aus, bei denen alle Videos freigegeben sind">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span id="btn-toggle-approved-text">Freigegebene ausblenden</span>
                </button>
                <button id="btn-column-visibility" class="secondary-btn">
                  Sichtbarkeit anpassen
                </button>` : ''}
              </div>
              <div id="kooperationen-videos-container"></div>
            </div>
          </div>` : ''}

          <!-- Strategien Tab -->
          <div class="tab-pane" id="tab-strategien">
            <div class="detail-section">
              ${this.renderStrategien()}
            </div>
          </div>

          <!-- Briefings Tab -->
          <div class="tab-pane" id="tab-briefings">
            <div class="detail-section">
              ${this.renderBriefings()}
            </div>
          </div>

          <!-- Sourcing-Listen Tab -->
          <div class="tab-pane" id="tab-sourcing-listen">
            <div class="detail-section">
              ${this.renderSourcingListen()}
            </div>
          </div>

          <!-- Creators Tab (gebuchte Creator) -->
          <div class="tab-pane" id="tab-creators">
            <div class="detail-section">
              <div id="creators-list">
                ${this.renderCreatorsList()}
              </div>
            </div>
          </div>

          <!-- Sourcing Tab (Kandidatenliste) -->
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

          <!-- Verträge Tab -->
          <div class="tab-pane" id="tab-vertraege">
            <div class="detail-section">
              ${this.renderVertraege()}
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
          ${!isKunde ? `
          <div class="tab-pane" id="tab-history">
            <div class="detail-section">
              ${this.renderHistory()}
            </div>
          </div>
          ` : ''}

          <!-- Mitarbeiter Tab -->
          <div class="tab-pane" id="tab-mitarbeiter">
            <div class="detail-section">
              ${this.renderMitarbeiter()}
            </div>
          </div>
        </div>
      </div>

      
    `;

    window.setContentSafely(window.content, html);
  }

  formatDeadlineBadge(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    let cls = 'tab-deadline';
    if (diffDays < 0) cls += ' tab-deadline--overdue';
    else if (diffDays <= 7) cls += ' tab-deadline--soon';
    const label = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    return `<span class="${cls}">bis ${label}</span>`;
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
          ${window.currentUser?.rolle === 'admin' ? `
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(usedBudget)} von ${formatCurrency(totalBudget)}</div>
            <div class="summary-label">Budget verbraucht</div>
            <div class="summary-progress">
              <div class="summary-progress-fill ${getBudgetProgressColorClass()}" 
                   style="width: ${getProgressPercentage(usedBudget, totalBudget)}%">
              </div>
            </div>
          </div>` : ''}
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

  // Rendere Strategien-Tabelle
  renderStrategien() {
    if (!this.strategien || this.strategien.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Strategien für diese Kampagne vorhanden</p>
        </div>
      `;
    }

    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Avatar-Bubble Rendering
    const renderBubble = (item, type) => {
      if (!item) return '-';
      const name = type === 'unternehmen' ? item.firmenname : 
                   type === 'marke' ? item.markenname : 
                   item.name;
      const logoUrl = item.logo_url || item.profile_image_url;
      const initials = name ? name.substring(0, 2).toUpperCase() : '??';
      
      if (logoUrl) {
        return `<span class="avatar-bubble" title="${name || ''}">
          <img src="${logoUrl}" alt="${name || ''}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
        </span>`;
      }
      return `<span class="avatar-bubble" title="${name || ''}">${initials}</span>`;
    };

    const rows = this.strategien.map(strategie => `
      <tr class="table-row-clickable" data-strategie-id="${strategie.id}">
        <td><strong>${window.validatorSystem.sanitizeHtml(strategie.name || 'Ohne Namen')}</strong></td>
        <td>${strategie.unternehmen ? renderBubble(strategie.unternehmen, 'unternehmen') : '-'}</td>
        <td>${strategie.marke ? renderBubble(strategie.marke, 'marke') : '-'}</td>
        <td>${strategie.created_by_user ? renderBubble(strategie.created_by_user, 'benutzer') : '-'}</td>
        <td>${formatDate(strategie.created_at)}</td>
      </tr>
    `).join('');

    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Erstellt von</th>
              <th>Erstellt am</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  renderSourcingListen() {
    if (!this.sourcingListen || this.sourcingListen.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Sourcing-Listen für diese Kampagne vorhanden</p>
        </div>
      `;
    }

    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const renderBubble = (item, type) => {
      if (!item) return '-';
      const name = type === 'unternehmen' ? item.firmenname :
                   type === 'marke' ? item.markenname :
                   item.name;
      const logoUrl = item.logo_url || item.profile_image_url;
      const initials = name ? name.substring(0, 2).toUpperCase() : '??';
      if (logoUrl) {
        return `<span class="avatar-bubble" title="${name || ''}">
          <img src="${logoUrl}" alt="${name || ''}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
        </span>`;
      }
      return `<span class="avatar-bubble" title="${name || ''}">${initials}</span>`;
    };

    const rows = this.sourcingListen.map(liste => `
      <tr class="table-row-clickable" data-sourcing-liste-id="${liste.id}">
        <td><strong>${window.validatorSystem.sanitizeHtml(liste.name || 'Ohne Namen')}</strong></td>
        <td>${liste.unternehmen ? renderBubble(liste.unternehmen, 'unternehmen') : '-'}</td>
        <td>${liste.marke ? renderBubble(liste.marke, 'marke') : '-'}</td>
        <td>${liste.created_by_user ? renderBubble(liste.created_by_user, 'benutzer') : '-'}</td>
        <td>${formatDate(liste.created_at)}</td>
      </tr>
    `).join('');

    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Erstellt von</th>
              <th>Erstellt am</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // Rendere Briefings
  renderBriefings() {
    if (!this.briefings || this.briefings.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Briefings für diese Kampagne vorhanden</p>
        </div>
      `;
    }

    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Status-Badge Rendering
    const renderStatusBadge = (status) => {
      if (!status) return '-';
      const statusClass = status.toLowerCase().replace(/\s+/g, '-');
      return `<span class="status-badge status-${statusClass}">${status}</span>`;
    };

    const rows = this.briefings.map(briefing => `
      <tr class="table-row-clickable" data-briefing-id="${briefing.id}">
        <td><strong>${window.validatorSystem.sanitizeHtml(briefing.product_service_offer || 'Ohne Titel')}</strong></td>
        <td>${renderStatusBadge(briefing.status)}</td>
        <td>${formatDate(briefing.deadline)}</td>
        <td>${formatDate(briefing.created_at)}</td>
      </tr>
    `).join('');

    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Produkt/Service</th>
              <th>Status</th>
              <th>Deadline</th>
              <th>Erstellt am</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
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

  // Rendere Mitarbeiter-Tab
  renderMitarbeiter() {
    const mitarbeiter = this.kampagneData?.mitarbeiter || [];
    
    if (mitarbeiter.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Mitarbeiter zugeordnet</p>
        </div>
      `;
    }

    // Sortiere nach Zuordnungsart, dann nach Name
    const artOrder = ['Direkt', 'Marke', 'Unternehmen', 'Auftrag'];
    const sorted = [...mitarbeiter].sort((a, b) => {
      const aIdx = artOrder.indexOf(a.zuordnungsart || 'Direkt');
      const bIdx = artOrder.indexOf(b.zuordnungsart || 'Direkt');
      if (aIdx !== bIdx) return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      return (a.name || '').localeCompare(b.name || '');
    });

    // Rolle-Labels für bessere Lesbarkeit
    const rolleLabels = {
      'projektmanager': 'Projektmanager',
      'scripter': 'Scripter',
      'cutter': 'Cutter',
      'copywriter': 'Copywriter',
      'strategie': 'Strategie',
      'creator_sourcing': 'Sourcing'
    };
    
    const rows = sorted.map(m => {
      const initials = (m.name || '?').split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
      const avatar = m.profile_image_url 
        ? `<img src="${m.profile_image_url}" alt="${window.validatorSystem.sanitizeHtml(m.name)}" class="table-avatar table-avatar-round">`
        : `<div class="table-avatar-placeholder table-avatar-round">${initials}</div>`;
      
      const rolleDisplay = rolleLabels[m.rolle] || m.rolle || 'Mitarbeiter';
      
      return `
        <tr>
          <td>${avatar}</td>
          <td>${window.validatorSystem.sanitizeHtml(m.name || '-')}</td>
          <td><span class="tag">${window.validatorSystem.sanitizeHtml(rolleDisplay)}</span></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 50px;">Bild</th>
              <th>Name</th>
              <th>Rolle</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
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
        
        // PERFORMANCE: Kampagne-Daten für Prefill cachen (vermeidet erneuten Supabase-Call)
        if (this.kampagneData) {
          window.kooperationPrefillCache = {
            kampagne_id: this.kampagneId,
            kampagnenname: KampagneUtils.getDisplayName(this.kampagneData),
            unternehmen_id: this.kampagneData.unternehmen_id,
            marke_id: this.kampagneData.marke_id || null,
            unternehmen: this.kampagneData.unternehmen,
            marke: this.kampagneData.marke,
            timestamp: Date.now()
          };
          console.log('📦 PREFILL-CACHE: Kampagne-Daten gecacht für schnelles Prefill', window.kooperationPrefillCache);
        }
        
        window.navigateTo(`/kooperation/new?kampagne_id=${this.kampagneId}`);
      });
    }

    

    // Bearbeiten Button
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-edit-kampagne') || e.target.closest('#btn-edit-kampagne-bottom')) {
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

    // Strategie-Zeile klicken -> zur Strategie-Detailseite navigieren
    document.addEventListener('click', (e) => {
      const row = e.target.closest('#tab-strategien tr[data-strategie-id]');
      if (row) {
        e.preventDefault();
        const strategieId = row.dataset.strategieId;
        if (strategieId) {
          window.navigateTo(`/strategie/${strategieId}`);
        }
      }
    });

    // Sourcing-Liste klicken -> zur Sourcing-Detailseite navigieren
    document.addEventListener('click', (e) => {
      const row = e.target.closest('#tab-sourcing-listen tr[data-sourcing-liste-id]');
      if (row) {
        e.preventDefault();
        const listeId = row.dataset.sourcingListeId;
        if (listeId) {
          window.navigateTo(`/sourcing/${listeId}`);
        }
      }
    });

    // Briefing-Zeile klicken -> zur Briefing-Detailseite navigieren
    document.addEventListener('click', (e) => {
      const row = e.target.closest('#tab-briefings tr[data-briefing-id]');
      if (row) {
        e.preventDefault();
        const briefingId = row.dataset.briefingId;
        if (briefingId) {
          window.navigateTo(`/briefing/${briefingId}`);
        }
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
      const btn = document.querySelector('.tab-button[data-tab="sourcing"] .tab-count');
      if (btn) btn.textContent = String(this.sourcingCreators.length);
    }
  }

  updateSourcingListenTab() {
    const container = document.querySelector('#tab-sourcing-listen .detail-section');
    if (container) {
      container.innerHTML = this.renderSourcingListen();
      const btn = document.querySelector('.tab-button[data-tab="sourcing-listen"] .tab-count');
      if (btn) btn.textContent = String(this.sourcingListen?.length || 0);
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

  updateVertraegeTab() {
    const container = document.querySelector('#tab-vertraege .detail-section');
    if (container) {
      container.innerHTML = this.renderVertraege();
      // Tab-Count aktualisieren
      const btn = document.querySelector('.tab-button[data-tab="vertraege"] .tab-count');
      if (btn) btn.textContent = String(this.vertraege.length);
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
    
    // Setze Mount-Status auf false (verhindert weitere DOM-Updates)
    this._isMounted = false;
    
    // Reset init Promise (damit neuer init() nicht auf altes Promise wartet)
    this._initPromise = null;
    
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

  // Event-Handler für Ansprechpartner-Aktualisierung
  bindAnsprechpartnerEvents() {
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
    formData.copywriter_ids = this.kampagneData.copywriter ? this.kampagneData.copywriter.map(c => c.id) : [];
    formData.strategie_ids = this.kampagneData.strategie ? this.kampagneData.strategie.map(s => s.id) : [];
    formData.creator_sourcing_ids = this.kampagneData.creator_sourcing ? this.kampagneData.creator_sourcing.map(c => c.id) : [];
    formData.paid_ziele_ids = this.kampagneData.paid_ziele ? this.kampagneData.paid_ziele.map(z => z.id) : [];
    formData.organic_ziele_ids = this.kampagneData.organic_ziele ? this.kampagneData.organic_ziele.map(z => z.id) : [];
    
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
        copywriter_ids: formData.copywriter_ids,
        strategie_ids: formData.strategie_ids,
        creator_sourcing_ids: formData.creator_sourcing_ids,
        art_der_kampagne: formData.art_der_kampagne,
        plattform_ids: formData.plattform_ids,
        format_ids: formData.format_ids,
        paid_ziele_ids: formData.paid_ziele_ids,
        organic_ziele_ids: formData.organic_ziele_ids,
        // Kampagnenart-spezifische Felder (für dynamische Stepper im Edit-Mode)
        // Legacy-Fallback: alte ugc_video_anzahl/igc_video_anzahl Werte mappen wenn neue Felder leer
        ugc_pro_paid_video_anzahl: this.kampagneData.ugc_pro_paid_video_anzahl,
        ugc_pro_paid_creator_anzahl: this.kampagneData.ugc_pro_paid_creator_anzahl,
        ugc_pro_paid_bilder_anzahl: this.kampagneData.ugc_pro_paid_bilder_anzahl,
        ugc_pro_organic_video_anzahl: this.kampagneData.ugc_pro_organic_video_anzahl || this.kampagneData.igc_video_anzahl || 0,
        ugc_pro_organic_creator_anzahl: this.kampagneData.ugc_pro_organic_creator_anzahl || this.kampagneData.igc_creator_anzahl || 0,
        ugc_pro_organic_bilder_anzahl: this.kampagneData.ugc_pro_organic_bilder_anzahl || this.kampagneData.igc_bilder_anzahl || 0,
        ugc_video_paid_video_anzahl: this.kampagneData.ugc_video_paid_video_anzahl,
        ugc_video_paid_creator_anzahl: this.kampagneData.ugc_video_paid_creator_anzahl,
        ugc_video_paid_bilder_anzahl: this.kampagneData.ugc_video_paid_bilder_anzahl,
        ugc_video_organic_video_anzahl: this.kampagneData.ugc_video_organic_video_anzahl || this.kampagneData.ugc_video_anzahl || 0,
        ugc_video_organic_creator_anzahl: this.kampagneData.ugc_video_organic_creator_anzahl || this.kampagneData.ugc_creator_anzahl || 0,
        ugc_video_organic_bilder_anzahl: this.kampagneData.ugc_video_organic_bilder_anzahl || this.kampagneData.ugc_bilder_anzahl || 0,
        influencer_video_anzahl: this.kampagneData.influencer_video_anzahl,
        influencer_creator_anzahl: this.kampagneData.influencer_creator_anzahl,
        vor_ort_video_anzahl: this.kampagneData.vor_ort_video_anzahl,
        vor_ort_creator_anzahl: this.kampagneData.vor_ort_creator_anzahl,
        vor_ort_videographen_anzahl: this.kampagneData.vor_ort_videographen_anzahl
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
        // Verarbeite alle Multi-Selects (inklusive art_der_kampagne)
        if (select.name && (select.name.includes('_ids') || select.name.includes('art_der_kampagne'))) {
          const fieldName = select.name.replace('[]', '');
          const selectedValues = Array.from(select.selectedOptions).map(option => option.value).filter(val => val !== '');
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

      // Dynamische Kampagnenart-Felder aus dem Stepper-Container sammeln (sicherstellen bei Edit)
      const kampagnenartContainer = form.querySelector('#kampagnenart-felder-container');
      if (kampagnenartContainer) {
        const stepperInputs = kampagnenartContainer.querySelectorAll('input[type="hidden"]');
        stepperInputs.forEach(input => {
          if (input.name && input.value !== undefined) {
            const value = parseInt(input.value, 10) || 0;
            submitData[input.name] = value;
            console.log(`📊 Stepper-Feld gesammelt: ${input.name} = ${value}`);
          }
        });
      } else {
        console.log('⚠️ KAMPAGNEDETAIL: Kampagnenart-Container nicht gefunden');
      }

      // Aggregiere Gesamtzahlen für Kampagne (für Anzeige & Listen)
      const sumBySuffix = (suffix) => Object.entries(submitData).reduce((sum, [key, val]) => {
        if (!key.endsWith(suffix)) return sum;
        return sum + (parseInt(val, 10) || 0);
      }, 0);
      submitData.videoanzahl = sumBySuffix('_video_anzahl');
      submitData.creatoranzahl = sumBySuffix('_creator_anzahl');

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
          const cw = uniq(toArray(submitData.copywriter_ids));
          const st = uniq(toArray(submitData.strategie_ids));
          const cs = uniq(toArray(submitData.creator_sourcing_ids));
          
          // Immer alte Verknüpfungen löschen (auch wenn keine neuen)
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
          cw.forEach(uid => mitarbeiterRows.push({ kampagne_id: this.kampagneId, mitarbeiter_id: uid, role: 'copywriter' }));
          st.forEach(uid => mitarbeiterRows.push({ kampagne_id: this.kampagneId, mitarbeiter_id: uid, role: 'strategie' }));
          cs.forEach(uid => mitarbeiterRows.push({ kampagne_id: this.kampagneId, mitarbeiter_id: uid, role: 'creator_sourcing' }));
          
          if (mitarbeiterRows.length > 0) {
            await window.supabase.from('kampagne_mitarbeiter').insert(mitarbeiterRows);
            console.log('✅ KAMPAGNEDETAIL: Mitarbeiter-Zuordnungen aktualisiert:', mitarbeiterRows.length);
          }
          
          // 3b. Paid-Ziele Zuordnungen aktualisieren
          const paidZiele = uniq(toArray(submitData.paid_ziele_ids));
          await window.supabase
            .from('kampagne_paid_ziele')
            .delete()
            .eq('kampagne_id', this.kampagneId);
          
          if (paidZiele.length > 0) {
            const paidZieleRows = paidZiele.map(zielId => ({
              kampagne_id: this.kampagneId,
              ziel_id: zielId
            }));
            await window.supabase.from('kampagne_paid_ziele').insert(paidZieleRows);
            console.log('✅ KAMPAGNEDETAIL: Paid-Ziele Zuordnungen aktualisiert:', paidZieleRows.length);
          }
          
          // 3c. Organic-Ziele Zuordnungen aktualisieren
          const organicZiele = uniq(toArray(submitData.organic_ziele_ids));
          await window.supabase
            .from('kampagne_organic_ziele')
            .delete()
            .eq('kampagne_id', this.kampagneId);
          
          if (organicZiele.length > 0) {
            const organicZieleRows = organicZiele.map(zielId => ({
              kampagne_id: this.kampagneId,
              ziel_id: zielId
            }));
            await window.supabase.from('kampagne_organic_ziele').insert(organicZieleRows);
            console.log('✅ KAMPAGNEDETAIL: Organic-Ziele Zuordnungen aktualisiert:', organicZieleRows.length);
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
        
        // Kampagnenart-Felder zu Auftragsdetails übertragen (Aggregation)
        try {
          await this.transferKampagneDataToAuftragsdetails(submitData, this.kampagneId);
        } catch (e) {
          console.warn('⚠️ KAMPAGNEDETAIL: Auftragsdetails-Transfer fehlgeschlagen', e);
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

  /**
   * Überträgt Kampagnenart-spezifische Daten zu auftrag_details
   * @param {object} submitData - Die Formulardaten der Kampagne
   * @param {string} kampagneId - ID der Kampagne
   */
  async transferKampagneDataToAuftragsdetails(submitData, kampagneId) {
    try {
      const auftragId = submitData.auftrag_id || this.kampagneData?.auftrag_id;
      if (!auftragId) {
        console.log('ℹ️ Keine auftrag_id - Auftragsdetails-Transfer übersprungen');
        return;
      }
      
      console.log('🔄 Starte Transfer Kampagnendaten → Auftragsdetails');
      
      // Importiere das Mapping
      const { KAMPAGNENARTEN_MAPPING } = await import('../auftrag/logic/KampagnenartenMapping.js');
      
      // Sammle alle Kampagnenart-spezifischen Felder aus submitData
      const auftragsDetailsUpdate = {};
      let gesamtVideos = 0;
      let gesamtCreator = 0;
      
      // Durchlaufe alle bekannten Kampagnenarten und sammle deren Felder
      for (const [artName, config] of Object.entries(KAMPAGNENARTEN_MAPPING)) {
        const { prefix, hasCreator, hasBilder, hasVideographen } = config;
        
        // Video-Anzahl
        const videoKey = `${prefix}_video_anzahl`;
        if (submitData[videoKey] !== undefined && submitData[videoKey] !== '') {
          const videoAnzahl = parseInt(submitData[videoKey], 10) || 0;
          auftragsDetailsUpdate[videoKey] = videoAnzahl;
          gesamtVideos += videoAnzahl;
        }
        
        // Creator-Anzahl
        if (hasCreator) {
          const creatorKey = `${prefix}_creator_anzahl`;
          if (submitData[creatorKey] !== undefined && submitData[creatorKey] !== '') {
            const creatorAnzahl = parseInt(submitData[creatorKey], 10) || 0;
            auftragsDetailsUpdate[creatorKey] = creatorAnzahl;
            gesamtCreator += creatorAnzahl;
          }
        }
        
        // Bilder-Anzahl
        if (hasBilder) {
          const bilderKey = `${prefix}_bilder_anzahl`;
          if (submitData[bilderKey] !== undefined && submitData[bilderKey] !== '') {
            auftragsDetailsUpdate[bilderKey] = parseInt(submitData[bilderKey], 10) || 0;
          }
        }
        
        // Videographen-Anzahl
        if (hasVideographen) {
          const videographenKey = `${prefix}_videographen_anzahl`;
          if (submitData[videographenKey] !== undefined && submitData[videographenKey] !== '') {
            auftragsDetailsUpdate[videographenKey] = parseInt(submitData[videographenKey], 10) || 0;
          }
        }
      }
      
      // Wenn keine Felder zu übertragen sind, abbrechen
      if (Object.keys(auftragsDetailsUpdate).length === 0) {
        console.log('ℹ️ Keine Kampagnenart-Felder zu übertragen');
        return;
      }
      
      // Gesamtsummen hinzufügen
      auftragsDetailsUpdate.gesamt_videos = gesamtVideos;
      auftragsDetailsUpdate.gesamt_creator = gesamtCreator;
      
      console.log('📊 Auftragsdetails-Update Daten:', auftragsDetailsUpdate);
      
      // Prüfe ob auftrag_details für diesen Auftrag existiert
      const { data: existingDetails, error: checkError } = await window.supabase
        .from('auftrag_details')
        .select('id')
        .eq('auftrag_id', auftragId)
        .maybeSingle();
      
      if (checkError) {
        console.error('❌ Fehler beim Prüfen der Auftragsdetails:', checkError);
        return;
      }
      
      if (existingDetails) {
        // Update bestehende Auftragsdetails
        // Bei Update: Lade alle Kampagnen des Auftrags und summiere deren Werte
        const { data: alleKampagnen, error: kampError } = await window.supabase
          .from('kampagne')
          .select('*')
          .eq('auftrag_id', auftragId);
        
        if (kampError) {
          console.error('❌ Fehler beim Laden aller Kampagnen:', kampError);
          return;
        }
        
        // Sammle Summen aller Kampagnen für jedes Feld
        const aggregatedData = {};
        let totalVideos = 0;
        let totalCreator = 0;
        
        for (const kamp of (alleKampagnen || [])) {
          for (const [artName, config] of Object.entries(KAMPAGNENARTEN_MAPPING)) {
            const { prefix, hasCreator, hasBilder, hasVideographen } = config;
            
            // Video-Anzahl
            const videoKey = `${prefix}_video_anzahl`;
            const videoVal = parseInt(kamp[videoKey], 10) || 0;
            aggregatedData[videoKey] = (aggregatedData[videoKey] || 0) + videoVal;
            totalVideos += videoVal;
            
            // Creator-Anzahl
            if (hasCreator) {
              const creatorKey = `${prefix}_creator_anzahl`;
              const creatorVal = parseInt(kamp[creatorKey], 10) || 0;
              aggregatedData[creatorKey] = (aggregatedData[creatorKey] || 0) + creatorVal;
              totalCreator += creatorVal;
            }
            
            // Bilder-Anzahl
            if (hasBilder) {
              const bilderKey = `${prefix}_bilder_anzahl`;
              aggregatedData[bilderKey] = (aggregatedData[bilderKey] || 0) + (parseInt(kamp[bilderKey], 10) || 0);
            }
            
            // Videographen-Anzahl
            if (hasVideographen) {
              const videographenKey = `${prefix}_videographen_anzahl`;
              aggregatedData[videographenKey] = (aggregatedData[videographenKey] || 0) + (parseInt(kamp[videographenKey], 10) || 0);
            }
          }
        }
        
        // Gesamtsummen
        aggregatedData.gesamt_videos = totalVideos;
        aggregatedData.gesamt_creator = totalCreator;
        
        const { error: updateError } = await window.supabase
          .from('auftrag_details')
          .update(aggregatedData)
          .eq('id', existingDetails.id);
        
        if (updateError) {
          console.error('❌ Fehler beim Update der Auftragsdetails:', updateError);
        } else {
          console.log('✅ Auftragsdetails aktualisiert (aggregiert):', aggregatedData);
        }
      } else {
        // Erstelle neue Auftragsdetails
        const newDetails = {
          auftrag_id: auftragId,
          ...auftragsDetailsUpdate
        };
        
        const { error: insertError } = await window.supabase
          .from('auftrag_details')
          .insert(newDetails);
        
        if (insertError) {
          console.error('❌ Fehler beim Erstellen der Auftragsdetails:', insertError);
        } else {
          console.log('✅ Auftragsdetails erstellt:', newDetails);
        }
      }
      
    } catch (error) {
      console.error('❌ Fehler beim Transfer der Kampagnendaten zu Auftragsdetails:', error);
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
