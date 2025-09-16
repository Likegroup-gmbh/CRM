// KampagneDetail.js (ES6-Modul)
// Kampagnen-Detail-Ansicht
import { renderCreatorTable } from '../creator/CreatorTable.js';

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
    this.sourcingCreators = [];
    this.favoriten = [];
    this.rechnungen = [];
    this.history = [];
    this.historyCount = 0;
    this.koopHistory = [];
    this.koopHistoryCount = 0;
  }

  // Initialisiere Kampagnen-Detail
  async init(kampagneId) {
    console.log('🎯 KAMPAGNEDETAIL: Initialisiere Kampagnen-Detailseite für ID:', kampagneId);
    
    this.kampagneId = kampagneId;
    
    // Prüfen ob dieses Modul noch das aktuelle ist
    if (window.moduleRegistry?.currentModule !== this) {
      console.log('⚠️ KAMPAGNEDETAIL: Nicht mehr das aktuelle Modul, breche ab');
      return;
    }
    
    try {
      // Lade alle Kampagnen-Daten
      await this.loadKampagneData();
      
      // Rendere die Seite
      await this.render();
      
      // Binde Events
      this.bindEvents();
      this.bindAnsprechpartnerEvents();
      
      console.log('✅ KAMPAGNEDETAIL: Initialisierung abgeschlossen');
      
    } catch (error) {
      console.error('❌ KAMPAGNEDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'KampagneDetail.init');
    }
  }

  // Kooperationen zur Kampagne laden
  async loadKooperationen() {
    try {
      const { data: koops, error } = await window.supabase
        .from('kooperationen')
        .select('id, name, status, gesamtkosten, videoanzahl, creator_id')
        .eq('kampagne_id', this.kampagneId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Creator Daten mappen
      const creatorIds = Array.from(new Set((koops || []).map(k => k.creator_id).filter(Boolean)));
      let creatorMap = {};
      if (creatorIds.length > 0) {
        const { data: creators } = await window.supabase
          .from('creator')
          .select('id, vorname, nachname')
          .in('id', creatorIds);
        creatorMap = (creators || []).reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
      }

      this.kooperationen = (koops || []).map(k => ({
        ...k,
        creator: creatorMap[k.creator_id] || null
      }));

      // Budgetsumme
      this.koopBudgetSum = this.kooperationen.reduce((sum, k) => sum + (parseFloat(k.gesamtkosten) || 0), 0);
      // Videosumme
      this.koopVideosUsed = this.kooperationen.reduce((sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 0);
      console.log('✅ KAMPAGNEDETAIL: Kooperationen geladen:', this.kooperationen.length, 'Budgetsumme:', this.koopBudgetSum);
    } catch (e) {
      console.error('❌ KAMPAGNEDETAIL: Fehler beim Laden der Kooperationen:', e);
      this.kooperationen = [];
      this.koopBudgetSum = 0;
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
        <td>${formatCurrency(k.gesamtkosten)}</td>
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

  // Lade alle Kampagnen-Daten
  async loadKampagneData() {
    console.log('🔄 KAMPAGNEDETAIL: Lade Kampagnen-Daten...');
    
    try {
      // Kampagnen-Basisdaten laden
      const { data: kampagne, error } = await window.supabase
        .from('kampagne')
        .select(`
          *,
          unternehmen:unternehmen_id(firmenname, webseite, branche_id),
          marke:marke_id(markenname, webseite),
          auftrag:auftrag_id(auftragsname, status, gesamt_budget, creator_budget)
        `)
        .eq('id', this.kampagneId)
        .single();

      if (error) throw error;
      
      this.kampagneData = kampagne;

      // Ansprechpartner aus Junction Table laden
      const { data: ansprechpartnerData, error: ansprechpartnerError } = await window.supabase
        .from('ansprechpartner_kampagne')
        .select(`
          ansprechpartner:ansprechpartner_id(
            id,
            vorname,
            nachname,
            email,
            unternehmen:unternehmen_id(firmenname),
            position:position_id(name)
          )
        `)
        .eq('kampagne_id', this.kampagneId);

      if (!ansprechpartnerError) {
        this.kampagneData.ansprechpartner = ansprechpartnerData?.map(item => item.ansprechpartner).filter(Boolean) || [];
        console.log('✅ KAMPAGNEDETAIL: Ansprechpartner geladen:', this.kampagneData.ansprechpartner.length);
      }
      
      // Alle Mitarbeiter-Rollen aus Junction Table laden
      const { data: allMitarbeiterData, error: mitarbeiterError } = await window.supabase
        .from('kampagne_mitarbeiter')
        .select(`
          role,
          benutzer:mitarbeiter_id(
            id,
            name,
            email
          )
        `)
        .eq('kampagne_id', this.kampagneId);

      if (!mitarbeiterError && allMitarbeiterData) {
        // Nach Rollen aufteilen
        this.kampagneData.mitarbeiter = allMitarbeiterData.filter(item => !item.role || item.role === 'mitarbeiter').map(item => item.benutzer).filter(Boolean);
        this.kampagneData.projektmanager = allMitarbeiterData.filter(item => item.role === 'projektmanager').map(item => item.benutzer).filter(Boolean);
        this.kampagneData.scripter = allMitarbeiterData.filter(item => item.role === 'scripter').map(item => item.benutzer).filter(Boolean);
        this.kampagneData.cutter = allMitarbeiterData.filter(item => item.role === 'cutter').map(item => item.benutzer).filter(Boolean);
        
        console.log('✅ KAMPAGNEDETAIL: Mitarbeiter geladen:', {
          mitarbeiter: this.kampagneData.mitarbeiter.length,
          projektmanager: this.kampagneData.projektmanager.length,
          scripter: this.kampagneData.scripter.length,
          cutter: this.kampagneData.cutter.length
        });
      }

      // Plattformen aus Junction Table laden
      try {
        const { data: plattformData } = await window.supabase
          .from('kampagne_plattformen')
          .select(`
            plattform:plattform_id(
              id,
              name
            )
          `)
          .eq('kampagne_id', this.kampagneId);

        if (plattformData) {
          this.kampagneData.plattformen = plattformData.map(item => item.plattform).filter(Boolean);
          this.kampagneData.plattform_ids = this.kampagneData.plattformen.map(p => p.id);
          console.log('✅ KAMPAGNEDETAIL: Plattformen geladen:', this.kampagneData.plattformen.length);
        }
      } catch (e) {
        console.warn('⚠️ KAMPAGNEDETAIL: Plattformen konnten nicht geladen werden', e);
      }

      // Formate aus Junction Table laden
      try {
        const { data: formatData } = await window.supabase
          .from('kampagne_formate')
          .select(`
            format:format_id(
              id,
              name
            )
          `)
          .eq('kampagne_id', this.kampagneId);

        if (formatData) {
          this.kampagneData.formate = formatData.map(item => item.format).filter(Boolean);
          this.kampagneData.format_ids = this.kampagneData.formate.map(f => f.id);
          console.log('✅ KAMPAGNEDETAIL: Formate geladen:', this.kampagneData.formate.length);
        }
      } catch (e) {
        console.warn('⚠️ KAMPAGNEDETAIL: Formate konnten nicht geladen werden', e);
      }
      
      console.log('✅ KAMPAGNEDETAIL: Kampagnen-Basisdaten geladen:', this.kampagneData);

      // Kampagnen-Arten laden (falls vorhanden)
      if (this.kampagneData.art_der_kampagne && this.kampagneData.art_der_kampagne.length > 0) {
        const { data: kampagneArten, error: artenError } = await window.supabase
          .from('kampagne_art_typen')
          .select('id, name, beschreibung')
          .in('id', this.kampagneData.art_der_kampagne);

        if (!artenError) {
          this.kampagneData.kampagne_art_typen = kampagneArten || [];
          console.log('✅ KAMPAGNEDETAIL: Kampagnen-Arten geladen:', this.kampagneData.kampagne_art_typen.length);
        }
      }

      // Creators laden
      const { data: creator, error: creatorError } = await window.supabase
        .from('kampagne_creator')
        .select(`
          *,
          creator:creator_id(
            id,
            vorname,
            nachname,
            instagram,
            instagram_follower,
            tiktok,
            tiktok_follower,
            mail,
            telefonnummer
          )
        `)
        .eq('kampagne_id', this.kampagneId);

      if (!creatorError) {
        this.creator = creator || [];
        console.log('✅ KAMPAGNEDETAIL: Creators geladen:', this.creator.length);
      }

      // Creator Sourcing: aus eigener Tabelle laden
      try {
        const { data: sourcing } = await window.supabase
          .from('kampagne_creator_sourcing')
          .select(`
            id,
            creator:creator_id (
              id,
              vorname,
              nachname,
              creator_types:creator_creator_type(creator_type:creator_type_id(name)),
              sprachen:creator_sprachen(sprachen:sprache_id(name)),
              branchen:creator_branchen(branchen_creator:branche_id(name)),
              instagram_follower,
              tiktok_follower,
              lieferadresse_stadt,
              lieferadresse_land
            )
          `)
          .eq('kampagne_id', this.kampagneId);
        this.sourcingCreators = (sourcing || []).map(row => {
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
      } catch (e) {
        console.warn('⚠️ KAMPAGNEDETAIL: Creator Sourcing konnte nicht geladen werden', e);
        this.sourcingCreators = [];
      }

      // Favoriten laden
      try {
        const { data: favs } = await window.supabase
          .from('kampagne_creator_favoriten')
          .select(`
            id,
            creator:creator_id (
              id,
              vorname,
              nachname,
              creator_types:creator_creator_type(creator_type:creator_type_id(name)),
              sprachen:creator_sprachen(sprachen:sprache_id(name)),
              branchen:creator_branchen(branchen_creator:branche_id(name)),
              instagram_follower,
              tiktok_follower,
              lieferadresse_stadt,
              lieferadresse_land
            )
          `)
          .eq('kampagne_id', this.kampagneId);
        this.favoriten = (favs || []).map(row => {
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
      } catch (e) {
        console.warn('⚠️ KAMPAGNEDETAIL: Favoriten konnten nicht geladen werden', e);
        this.favoriten = [];
      }

      // Notizen laden
      if (window.notizenSystem) {
        this.notizen = await window.notizenSystem.loadNotizen('kampagne', this.kampagneId);
        console.log('✅ KAMPAGNEDETAIL: Notizen geladen:', this.notizen.length);
      }

      // Ratings laden
      if (window.bewertungsSystem) {
        this.ratings = await window.bewertungsSystem.loadBewertungen('kampagne', this.kampagneId);
        console.log('✅ KAMPAGNEDETAIL: Ratings geladen:', this.ratings.length);
      }

      // Kooperationen laden (mit Creator-Namen) und Budgetsumme berechnen
      await this.loadKooperationen();

      // Rechnungen zur Kampagne laden
      try {
      const { data: rechnungen } = await window.supabase
        .from('rechnung')
        .select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url, kooperation:kooperation_id(id, name), creator:creator_id(id, vorname, nachname)')
        .eq('kampagne_id', this.kampagneId)
        .order('gestellt_am', { ascending: false });
        this.rechnungen = rechnungen || [];
      } catch (_) {
        this.rechnungen = [];
      }

      // History (Statuswechsel) laden
      try {
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
      } catch (_) {
        this.history = [];
        this.historyCount = 0;
      }

      // Kooperationen-History laden (aggregiert)
      try {
        const koopIds = (this.kooperationen || []).map(k => k.id).filter(Boolean);
        if (koopIds.length > 0) {
          const koopMap = (this.kooperationen || []).reduce((acc, k) => { acc[k.id] = k; return acc; }, {});
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
      } catch (_) {
        this.koopHistory = [];
        this.koopHistoryCount = 0;
      }

    } catch (error) {
      console.error('❌ KAMPAGNEDETAIL: Fehler beim Laden der Kampagnen-Daten:', error);
      throw error;
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
        <div class="page-header-left">
          <h1>${window.validatorSystem.sanitizeHtml(this.kampagneData.kampagnenname)}</h1>
          <p>Kampagnen-Details und verwandte Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kampagne')" class="secondary-btn">Zurück zur Übersicht</button>
          ${canEdit ? `<button id="btn-edit-kampagne" class="primary-btn">Bearbeiten</button>` : ''}
          ${canDelete ? `<button id="btn-delete-kampagne" class="danger-btn">Kampagne löschen</button>` : ''}
        </div>
      </div>

      <div class="content-section">
        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="info">
            <i class="icon-information-circle"></i>
            Informationen
          </button>
          ${window.canViewTable && window.canViewTable('kampagne','creators') !== false ? `
          <button class="tab-button" data-tab="creators">
            <i class="icon-users"></i>
            Creator
            <span class="tab-count">${this.creator.length}</span>
          </button>` : ''}
          ${window.canViewTable && window.canViewTable('kampagne','notizen') !== false ? `
          <button class="tab-button" data-tab="notizen">
            <i class="icon-document-text"></i>
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>` : ''}
          ${window.canViewTable && window.canViewTable('kampagne','kooperationen') !== false ? `
          <button class="tab-button" data-tab="koops">
            <i class="icon-link"></i>
            Kooperationen
            <span class="tab-count">${this.kooperationen.length}</span>
          </button>` : ''}
          ${window.canViewTable && window.canViewTable('kampagne','sourcing') !== false ? `
          <button class="tab-button" data-tab="sourcing">
            <i class="icon-user-plus"></i>
            Creator Sourcing
            <span class="tab-count">${this.sourcingCreators.length}</span>
          </button>` : ''}
          ${window.canViewTable && window.canViewTable('kampagne','favoriten') !== false ? `
          <button class="tab-button" data-tab="favs">
            
            Favoriten
            <span class="tab-count">${this.favoriten.length}</span>
          </button>` : ''}
          ${window.canViewTable && window.canViewTable('kampagne','ratings') !== false ? `
          <button class="tab-button" data-tab="ratings">
            
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>` : ''}
          ${window.canViewTable && window.canViewTable('kampagne','history') !== false ? `
          <button class="tab-button" data-tab="history">
            
            History
            <span class="tab-count">${this.historyCount + this.koopHistoryCount}</span>
          </button>` : ''}
          ${window.canViewTable && window.canViewTable('kampagne','rechnungen') !== false ? `
          <button class="tab-button" data-tab="rechnungen">
            <i class="icon-currency-euro"></i>
            Rechnungen
            <span class="tab-count">${this.rechnungen.length}</span>
          </button>` : ''}
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="tab-info">
            <div class="detail-section">
              <h2>Kampagnen Informationen</h2>
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

          <!-- Creators Tab (gebuchte Creator) -->
          <div class="tab-pane" id="tab-creators">
            <div class="detail-section">
              <h2>Creator</h2>
              <div id="creators-list">
                ${this.renderCreatorsList()}
              </div>
            </div>
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="tab-notizen">
            <div class="detail-section">
              <h2>Notizen</h2>
              <div id="notizen-list">
                ${this.renderNotizen()}
              </div>
            </div>
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="tab-ratings">
            <div class="detail-section">
              <h2>Bewertungen</h2>
              <div id="ratings-list">
                ${this.renderRatings()}
              </div>
            </div>
          </div>

          <!-- Kooperationen Tab -->
          <div class="tab-pane" id="tab-koops">
            <div class="detail-section">
              <h2>Kooperationen</h2>
              ${this.renderKooperationen()}
            </div>
          </div>

          <!-- Creator Sourcing Tab (Kandidatenliste) -->
          <div class="tab-pane" id="tab-sourcing">
            <div class="detail-section">
              <h2>Creator Sourcing</h2>
              ${this.renderCreatorSourcing()}
            </div>
          </div>

          <!-- Favoriten Tab -->
          <div class="tab-pane" id="tab-favs">
            <div class="detail-section">
              <h2>Favoriten</h2>
              ${this.renderFavoriten()}
            </div>
          </div>

          <!-- Rechnungen Tab -->
          <div class="tab-pane" id="tab-rechnungen">
            <div class="detail-section">
              <h2>Rechnungen</h2>
              ${this.renderRechnungen()}
            </div>
          </div>

          <!-- History Tab -->
          <div class="tab-pane" id="tab-history">
            <div class="detail-section">
              <h2>History</h2>
              ${this.renderHistory()}
            </div>
          </div>
        </div>
      </div>

      
    `;

    window.setContentSafely(window.content, html);
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
        <button onclick="window.navigateTo('/kampagne')" class="primary-btn">Zurück zur Übersicht</button>
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
        if (pane) pane.innerHTML = `<h2>History</h2>${this.renderHistory()}`;
        const btn = document.querySelector('.tab-button[data-tab="history"] .tab-count');
        if (btn) btn.textContent = String(this.historyCount + this.koopHistoryCount);
      }
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
          favPane.innerHTML = `<h2>Favoriten</h2>${this.renderFavoriten()}`;
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
  switchTab(tabName) {
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

  // Cleanup
  destroy() {
    console.log('🗑️ KAMPAGNEDETAIL: Destroy aufgerufen');
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
    }
    if (this.kampagneData.plattform_ids && Array.isArray(this.kampagneData.plattform_ids)) {
      formData.plattform_ids = this.kampagneData.plattform_ids;
    }
    if (this.kampagneData.format_ids && Array.isArray(this.kampagneData.format_ids)) {
      formData.format_ids = this.kampagneData.format_ids;
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
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kampagne bearbeiten</h1>
          <p>Bearbeiten Sie die Informationen von ${this.kampagneData.kampagnenname}</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kampagne/${this.kampagneId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
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
        this.showSuccessMessage('Kampagne erfolgreich aktualisiert!');
        
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
