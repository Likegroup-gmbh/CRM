// CreatorDetail.js (ES6-Modul)
// Creator-Detailseite mit allen relevanten Informationen
import { renderKampagnenTable } from '../kampagne/KampagneTable.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';

export class CreatorDetail {
  constructor() {
    this.creatorId = null;
    this.creator = null;
    this.notizen = [];
    this.ratings = [];
    this.kampagnen = [];
    this.lists = [];
    this.kooperationen = [];
    this.rechnungen = [];
    this.unternehmen = []; // Neues Feld für Unternehmen
    this.creatorAdressen = []; // Zusätzliche Adressen
    this.eventsBound = false; // Flag um doppeltes Binden zu verhindern
  }

  // Initialisiere Creator-Detailseite
  async init(creatorId) {
    console.log('🎯 CREATORDETAIL: Initialisiere Creator-Detailseite für ID:', creatorId);
    
    this.creatorId = creatorId;
    
    // Prüfen ob dieses Modul noch das aktuelle ist
    if (window.moduleRegistry?.currentModule !== this) {
      console.log('⚠️ CREATORDETAIL: Nicht mehr das aktuelle Modul, breche ab');
      return;
    }
    
    try {
      // Lade kritische Creator-Daten parallel (optimiert!)
      await this.loadCriticalData();
      
      // Breadcrumb aktualisieren
      if (window.breadcrumbSystem && this.creator) {
        const creatorName = [this.creator.vorname, this.creator.nachname].filter(Boolean).join(' ') || 'Details';
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Creator', url: '/creator', clickable: true },
          { label: creatorName, url: `/creator/${this.creatorId}`, clickable: false }
        ]);
      }
      
      // Rendere die Seite
      await this.render();
      
      // Binde Events (nur beim ersten Mal)
      if (!this.eventsBound) {
        this.bindEvents();
        this.eventsBound = true;
      }
      
      // Event-Listener für automatische Cache-Invalidierung
      this.setupCacheInvalidation();
      
      console.log('✅ CREATORDETAIL: Initialisierung abgeschlossen');
      
    } catch (error) {
      console.error('❌ CREATORDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'CreatorDetail.init');
    }
  }

  // Lade kritische Creator-Daten PARALLEL (Performance-Optimiert!)
  async loadCriticalData() {
    console.log('🔄 CREATORDETAIL: Lade kritische Daten parallel...');
    const startTime = performance.now();
    
    // Alle kritischen Daten PARALLEL laden
    const [
      creatorResult,
      sprachenResult,
      branchenResult,
      typenResult,
      adressenResult,
      notizenResult,
      ratingsResult
    ] = await parallelLoad([
      // 1. Creator Basisdaten
      () => window.supabase
        .from('creator')
        .select(`*`)
        .eq('id', this.creatorId)
        .single(),
      
      // 2. M:N Sprachen
      () => window.supabase
        .from('creator_sprachen')
        .select('sprache_id, sprachen:sprache_id(id, name)')
        .eq('creator_id', this.creatorId)
        .then(r => (r.data || []).map(x => x.sprachen).filter(Boolean)),
      
      // 3. M:N Branchen
      () => window.supabase
        .from('creator_branchen')
        .select('branche_id, branchen_creator:branche_id(id, name)')
        .eq('creator_id', this.creatorId)
        .then(r => (r.data || []).map(x => x.branchen_creator).filter(Boolean)),
      
      // 4. M:N Creator-Typen
      () => window.supabase
        .from('creator_creator_type')
        .select('creator_type_id, creator_type:creator_type_id(id, name)')
        .eq('creator_id', this.creatorId)
        .then(r => (r.data || []).map(x => x.creator_type).filter(Boolean)),
      
      // 5. Zusätzliche Adressen
      () => window.supabase
        .from('creator_adressen')
        .select('*')
        .eq('creator_id', this.creatorId)
        .order('created_at', { ascending: false })
        .then(r => r.data || []),
      
      // 6. Notizen
      () => window.notizenSystem.loadNotizen('creator', this.creatorId),
      
      // 7. Ratings
      () => window.bewertungsSystem.loadBewertungen('creator', this.creatorId)
    ]);
    
    // Error-Handling
    if (creatorResult.error) {
      throw new Error(`Fehler beim Laden der Creator-Daten: ${creatorResult.error.message}`);
    }
    
    // Daten verarbeiten
    this.creator = creatorResult.data;
    this.creator.sprachen = sprachenResult;
    this.creator.branchen = branchenResult;
    this.creator.creator_types = typenResult;
    this.creatorAdressen = adressenResult;
    this.notizen = notizenResult || [];
    this.ratings = ratingsResult || [];
    
    const loadTime = (performance.now() - startTime).toFixed(0);
    console.log(`✅ CREATORDETAIL: Kritische Daten geladen in ${loadTime}ms`);
  }
  
  // Lazy-Load Tab-spezifische Daten
  async loadTabData(tabName) {
    return await tabDataCache.load('creator', this.creatorId, tabName, async () => {
      console.log(`🔄 CREATORDETAIL: Lade Tab-Daten für "${tabName}"`);
      const startTime = performance.now();
      
      try {
        switch(tabName) {
          case 'kampagnen':
            await this.loadKampagnen();
            this.updateKampagnenTab();
            break;
            
          case 'kooperationen':
            await this.loadKooperationen();
            this.updateKooperationenTab();
            break;
            
          case 'listen':
            await this.loadListen();
            this.updateListenTab();
            break;
            
          case 'unternehmen':
            await this.loadUnternehmen();
            this.updateUnternehmenTab();
            break;
            
          case 'rechnungen':
            await this.loadRechnungen();
            this.updateRechnungenTab();
            break;
        }
        
        const loadTime = (performance.now() - startTime).toFixed(0);
        console.log(`✅ CREATORDETAIL: Tab "${tabName}" geladen in ${loadTime}ms`);
        
      } catch (error) {
        console.error(`❌ CREATORDETAIL: Fehler beim Laden von Tab "${tabName}":`, error);
      }
    });
  }
  
  // Lade Kampagnen
  async loadKampagnen() {
    const { data: kampagnen, error } = await window.supabase
      .from('kampagne_creator')
      .select(`
        *,
        kampagne:kampagne_id (
          id,
          kampagnenname,
          status,
          start,
          deadline,
          unternehmen:unternehmen_id ( id, firmenname ),
          marke:marke_id ( id, markenname )
        )
      `)
      .eq('creator_id', this.creatorId)
      .order('hinzugefuegt_am', { ascending: false });

    if (!error) {
      this.kampagnen = kampagnen || [];
    }
  }
  
  // Lade Kooperationen
  async loadKooperationen() {
    try {
      const { data: koops } = await window.supabase
        .from('kooperationen')
        .select(`
          id, name, status, videoanzahl, einkaufspreis_gesamt,
          kampagne:kampagne_id ( id, kampagnenname ),
          created_at
        `)
        .eq('creator_id', this.creatorId)
        .order('created_at', { ascending: false });
      this.kooperationen = koops || [];
      
      // Kampagnen aus Kooperationen mit Kampagnen aus kampagne_creator zusammenführen
      await this.mergeKampagnenFromKooperationen();
    } catch (e) {
      console.warn('⚠️ CREATORDETAIL: Kooperationen konnten nicht geladen werden', e);
      this.kooperationen = [];
    }
  }
  
  // Lade Rechnungen
  async loadRechnungen() {
    try {
      // Lade Kooperationen falls noch nicht geladen
      if (!this.kooperationen || this.kooperationen.length === 0) {
        await this.loadKooperationen();
      }
      
      const koopIds = (this.kooperationen || []).map(k => k.id).filter(Boolean);
      if (koopIds.length > 0) {
        const { data: rechnungen } = await window.supabase
          .from('rechnung')
          .select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url, kooperation_id')
          .in('kooperation_id', koopIds)
          .order('gestellt_am', { ascending: false });
        this.rechnungen = rechnungen || [];
      } else {
        this.rechnungen = [];
      }
    } catch (_) {
      this.rechnungen = [];
    }
  }
  
  // Lade Listen
  async loadListen() {
    const { data: lists, error } = await window.supabase
      .from('creator_list_member')
      .select(`
        *,
        list:list_id ( id, name, created_at )
      `)
      .eq('creator_id', this.creatorId)
      .order('added_at', { ascending: false });

    if (!error) {
      this.lists = lists || [];
    }
  }
  
  // Lade Unternehmen
  async loadUnternehmen() {
    try {
      // Lade Kampagnen und Kooperationen falls noch nicht geladen
      if (!this.kampagnen || this.kampagnen.length === 0) {
        await this.loadKampagnen();
      }
      if (!this.kooperationen || this.kooperationen.length === 0) {
        await this.loadKooperationen();
      }
      
      const kampUnternehmen = (this.kampagnen || [])
        .map(k => k?.kampagne?.unternehmen)
        .filter(Boolean);
      const koopKampIds = (this.kooperationen || []).map(k => k?.kampagne?.id).filter(Boolean);
      let koopUnternehmen = [];
      if (koopKampIds.length > 0) {
        const { data: kampMeta } = await window.supabase
          .from('kampagne')
          .select('id, unternehmen:unternehmen_id ( id, firmenname )')
          .in('id', Array.from(new Set(koopKampIds)));
        koopUnternehmen = (kampMeta || []).map(k => k.unternehmen).filter(Boolean);
      }
      const all = [...kampUnternehmen, ...koopUnternehmen].filter(Boolean);
      const map = new Map();
      all.forEach(u => { if (u?.id) map.set(u.id, u); });
      this.unternehmen = Array.from(map.values());
    } catch (_) {
      this.unternehmen = [];
    }
  }
  
  // Helper: Merge Kampagnen aus Kooperationen
  async mergeKampagnenFromKooperationen() {
    try {
      const coopCampaigns = (this.kooperationen || [])
        .filter(k => k.kampagne)
        .map(k => ({
          kampagne: {
            id: k.kampagne.id,
            kampagnenname: k.kampagne.kampagnenname,
            status: k.status || null,
            start: null,
            deadline: null,
            unternehmen: null,
            marke: null
          },
          hinzugefuegt_am: k.created_at || null,
          notiz: null
        }));

      const combined = [...(this.kampagnen || []), ...coopCampaigns];
      const seen = new Set();
      this.kampagnen = combined.filter(entry => {
        const id = entry?.kampagne?.id || entry?.kampagne_id || entry?.kampagne?.kampagnenname;
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      // Enrichment: fehlende Unternehmen/Marke zu Kampagnen nachladen
      const allIds = Array.from(new Set(this.kampagnen
        .map(e => e?.kampagne?.id || e?.kampagne_id)
        .filter(Boolean)));
      if (allIds.length > 0) {
        const { data: kampagnenDetails } = await window.supabase
          .from('kampagne')
          .select('id, unternehmen:unternehmen_id ( firmenname ), marke:marke_id ( markenname )')
          .in('id', allIds);
        const detailsMap = (kampagnenDetails || []).reduce((acc, k) => {
          acc[k.id] = k; return acc;
        }, {});

        this.kampagnen = this.kampagnen.map(e => {
          const id = e?.kampagne?.id || e?.kampagne_id;
          const detail = id ? detailsMap[id] : null;
          if (detail) {
            if (!e.kampagne) e.kampagne = { id };
            if (!e.kampagne.unternehmen) e.kampagne.unternehmen = detail.unternehmen || null;
            if (!e.kampagne.marke) e.kampagne.marke = detail.marke || null;
          }
          return e;
        });
      }
    } catch (mergeErr) {
      console.warn('⚠️ CREATORDETAIL: Kampagnen-Merge aus Kooperationen fehlgeschlagen', mergeErr);
    }
  }
  
  // Tab-Update-Methoden
  updateKampagnenTab() {
    const container = document.querySelector('#tab-kampagnen');
    if (container) {
      container.innerHTML = this.renderKampagnen();
      const btn = document.querySelector('.tab-button[data-tab="kampagnen"] .tab-count');
      if (btn) btn.textContent = String(this.kampagnen?.length || 0);
    }
  }
  
  updateKooperationenTab() {
    const container = document.querySelector('#tab-kooperationen');
    if (container) {
      container.innerHTML = this.renderKooperationen();
      const btn = document.querySelector('.tab-button[data-tab="kooperationen"] .tab-count');
      if (btn) btn.textContent = String(this.kooperationen?.length || 0);
    }
  }
  
  updateListenTab() {
    const container = document.querySelector('#tab-listen');
    if (container) {
      container.innerHTML = this.renderListen();
      const btn = document.querySelector('.tab-button[data-tab="listen"] .tab-count');
      if (btn) btn.textContent = String(this.lists?.length || 0);
    }
  }
  
  updateUnternehmenTab() {
    const container = document.querySelector('#tab-unternehmen');
    if (container) {
      container.innerHTML = this.renderUnternehmen();
      const btn = document.querySelector('.tab-button[data-tab="unternehmen"] .tab-count');
      if (btn) btn.textContent = String(this.unternehmen?.length || 0);
    }
  }
  
  updateRechnungenTab() {
    const container = document.querySelector('#tab-rechnungen');
    if (container) {
      container.innerHTML = this.renderRechnungen();
      const btn = document.querySelector('.tab-button[data-tab="rechnungen"] .tab-count');
      if (btn) btn.textContent = String(this.rechnungen?.length || 0);
    }
  }

  // Rendere Creator-Detailseite
  async render() {
    if (!this.creator) {
      window.setHeadline('Creator nicht gefunden');
      window.content.innerHTML = `
        <div class="error-message">
          <p>Der angeforderte Creator wurde nicht gefunden.</p>
        </div>
      `;
      return;
    }

    window.setHeadline(`${this.creator.vorname} ${this.creator.nachname}`);

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <button id="btn-edit-creator" class="primary-btn">Creator bearbeiten</button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="info">
            Informationen
          </button>
          <button class="tab-button" data-tab="kampagnen">
            Kampagnen
            <span class="tab-count">${this.kampagnen?.length || 0}</span>
          </button>
          <button class="tab-button" data-tab="kooperationen">
            Kooperationen
            <span class="tab-count">${this.kooperationen?.length || 0}</span>
          </button>
          <button class="tab-button" data-tab="listen">
            Listen
            <span class="tab-count">${this.lists?.length || 0}</span>
          </button>
          <button class="tab-button" data-tab="unternehmen">
            Unternehmen
            <span class="tab-count">${(this.unternehmen||[]).length || 0}</span>
          </button>
          <button class="tab-button" data-tab="rechnungen">
            Rechnungen
            <span class="tab-count">${this.rechnungen?.length || 0}</span>
          </button>
          <button class="tab-button" data-tab="adresse">
            Adresse
          </button>
          <button class="tab-button" data-tab="notizen">
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="ratings">
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="tab-info">
            <div class="detail-section">
              <div class="detail-grid">
                <div class="detail-card">
                  <h3>Kontakt</h3>
                  <div class="detail-item">
                    <label>E-Mail:</label>
                    <span>${this.creator.mail || '-'}</span>
                  </div>
                  <div class="detail-item">
                    <label>Telefon:</label>
                    <span>${this.creator.telefonnummer || '-'}</span>
                  </div>
                  <div class="detail-item">
                    <label>Stadt:</label>
                    <span>${this.creator.lieferadresse_stadt || '-'}</span>
                  </div>
                  <div class="detail-item">
                    <label>Land:</label>
                    <span>${this.creator.lieferadresse_land || '-'}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Social Media</h3>
                  <div class="detail-item">
                    <label>Instagram:</label>
                    <span>${this.creator.instagram ? `@${this.creator.instagram}` : '-'}</span>
                  </div>
                  <div class="detail-item">
                    <label>Instagram Follower:</label>
                    <span>${this.creator.instagram_follower ? this.formatNumber(this.creator.instagram_follower) : '-'}</span>
                  </div>
                  <div class="detail-item">
                    <label>TikTok:</label>
                    <span>${this.creator.tiktok ? `@${this.creator.tiktok}` : '-'}</span>
                  </div>
                  <div class="detail-item">
                    <label>TikTok Follower:</label>
                    <span>${this.creator.tiktok_follower ? this.formatNumber(this.creator.tiktok_follower) : '-'}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Profil</h3>
                  <div class="detail-item">
                    <label>Typen:</label>
                    <span>${this.renderTagList(this.creator.creator_types)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Sprachen:</label>
                    <span>${this.renderTagList(this.creator.sprachen)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Branchen:</label>
                    <span>${this.renderTagList(this.creator.branchen)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Portfolio:</label>
                    <span>${this.creator.portfolio_link ? `<a href="${this.creator.portfolio_link}" target="_blank">Link</a>` : '-'}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Finanzen</h3>
                  <div class="detail-item">
                    <label>Letztes Budget:</label>
                    <span>${this.creator.budget_letzte_buchung ? this.formatCurrency(this.creator.budget_letzte_buchung) : '-'}</span>
                  </div>
                  <div class="detail-item">
                    <label>Erstellt:</label>
                    <span>${this.formatDate(this.creator.created_at)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Aktualisiert:</label>
                    <span>${this.formatDate(this.creator.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Kampagnen Tab -->
          <div class="tab-pane" id="tab-kampagnen">
            <div class="detail-section">
              ${this.renderKampagnen()}
            </div>
          </div>

          <!-- Kooperationen Tab -->
          <div class="tab-pane" id="tab-kooperationen">
            <div class="detail-section">
              ${this.renderKooperationen()}
            </div>
          </div>

          <!-- Listen Tab -->
          <div class="tab-pane" id="tab-listen">
            <div class="detail-section">
              ${this.renderLists()}
            </div>
          </div>

          <!-- Unternehmen Tab -->
          <div class="tab-pane" id="tab-unternehmen">
            <div class="detail-section">
              ${this.renderUnternehmen()}
            </div>
          </div>
          
          <!-- Rechnungen Tab -->
          <div class="tab-pane" id="tab-rechnungen">
            <div class="detail-section">
              ${this.renderRechnungen()}
            </div>
          </div>

          <!-- Adresse Tab -->
          <div class="tab-pane" id="tab-adresse">
            <div class="detail-section">
              ${this.renderAdresse()}
            </div>
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="tab-notizen">
            <div class="detail-section">
              ${this.renderNotizen()}
            </div>
          </div>

          <!-- Ratings Tab -->
          <div class="tab-pane" id="tab-ratings">
            <div class="detail-section">
              ${this.renderRatings()}
            </div>
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  renderTagList(items) {
    if (!items || items.length === 0) return '-';
    if (Array.isArray(items)) {
      const inner = items.map(it => {
        const label = typeof it === 'object' ? (it.name || it.label || it) : it;
        return `<span class="tag">${String(label).trim()}</span>`;
      }).join('');
      return `<div class="tags">${inner}</div>`;
    }
    if (typeof items === 'object') {
      const label = items.name || items.label;
      return label ? `<div class="tags"><span class="tag">${label}</span></div>` : '-';
    }
    return `<div class="tags"><span class="tag">${String(items)}</span></div>`;
  }

  // Rendere Notizen
  renderNotizen() {
    return window.notizenSystem.renderNotizenContainer(this.notizen, 'creator', this.creatorId);
  }

  // Rendere Ratings
  renderRatings() {
    return window.bewertungsSystem.renderBewertungenContainer(this.ratings, 'creator', this.creatorId);
  }

  // Rendere Kampagnen
  renderKampagnen() {
    if (!this.kampagnen || this.kampagnen.length === 0) {
      return `
        <div class="empty-state">
          <p>Noch keine Kampagnen zugeordnet.</p>
        </div>
      `;
    }

    const flat = this.kampagnen.map(k => {
      const base = k.kampagne || k;
      return {
        id: base.id,
        kampagnenname: base.kampagnenname,
        unternehmen: base.unternehmen || null,
        marke: base.marke || null,
        art_der_kampagne: base.art_der_kampagne,
        status: base.status,
        start: base.start,
        deadline: base.deadline,
        creatoranzahl: base.creatoranzahl,
        videoanzahl: base.videoanzahl,
      };
    });

    return renderKampagnenTable(flat, { showActions: false });
  }

  // Rendere Listen
  renderLists() {
    if (this.lists.length === 0) {
      return `
        <div class="empty-state">
          <p>Noch keiner Liste zugeordnet.</p>
        </div>
      `;
    }

    const listsHtml = this.lists.map(list => `
      <div class="list-card">
        <div class="list-header">
          <h4>${list.list.name}</h4>
          <span class="list-date">Hinzugefügt: ${this.formatDate(list.added_at)}</span>
        </div>
        <div class="list-details">
          <small>Liste erstellt: ${this.formatDate(list.list.created_at)}</small>
        </div>
      </div>
    `).join('');

    return `
      <div class="lists-container">
        ${listsHtml}
      </div>
    `;
  }

  // Rendere Kooperationen
  renderKooperationen() {
    if (this.kooperationen.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🤝</div>
          <h3>Keine Kooperationen vorhanden</h3>
          <p>Für diesen Creator wurden noch keine Kooperationen erstellt.</p>
        </div>
      `;
    }

    const rows = this.kooperationen.map(k => `
      <tr>
        <td>
          <a href="/kooperation/${k.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${k.id}')">
            ${window.validatorSystem.sanitizeHtml(k.name || 'Kooperation')}
          </a>
        </td>
        <td>
          <a href="/kampagne/${k.kampagne?.id || ''}" onclick="event.preventDefault(); window.navigateTo('/kampagne/${k.kampagne?.id || ''}')">
            ${window.validatorSystem.sanitizeHtml(k.kampagne?.kampagnenname || '-')}
          </a>
        </td>
        <td>${window.validatorSystem.sanitizeHtml(k.unternehmen?.firmenname || '-')}</td>
        <td><span class="status-badge status-${(k.status || 'unknown').toLowerCase().replace(/\s+/g, '-')}">${k.status || '-'}</span></td>
        <td>${k.videoanzahl || 0}</td>
        <td>${k.einkaufspreis_gesamt ? this.formatCurrency(k.einkaufspreis_gesamt) : '-'}</td>
        <td>${this.formatDate(k.skript_deadline)}</td>
        <td>${this.formatDate(k.content_deadline)}</td>
        <td>${this.formatDate(k.created_at)}</td>
      </tr>
    `).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kampagne</th>
              <th>Unternehmen</th>
              <th>Status</th>
              <th>Videos</th>
              <th>Gesamtkosten</th>
              <th>Skript Deadline</th>
              <th>Content Deadline</th>
              <th>Erstellt</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  renderRechnungen() {
    if (!this.rechnungen || this.rechnungen.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Rechnungen vorhanden.</p>
        </div>
      `;
    }
    const fmt = (v) => v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-';
    const fDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
    const rows = this.rechnungen.map(r => `
      <tr>
        <td><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${window.validatorSystem.sanitizeHtml(r.rechnung_nr || '—')}</a></td>
        <td>${r.status || '-'}</td>
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

  renderUnternehmen() {
    const items = this.unternehmen || [];
    if (!items.length) {
      return '<p class="empty-state">Keine Unternehmen vorhanden.</p>';
    }
    const rows = items.map(u => `
      <tr>
        <td><a href="/unternehmen/${u.id}" class="table-link" data-table="unternehmen" data-id="${u.id}">${window.validatorSystem.sanitizeHtml(u.firmenname || '—')}</a></td>
      </tr>`).join('');
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Unternehmen</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  renderAdresse() {
    const c = this.creator || {};
    const sanitize = (val) => {
      if (val === undefined || val === null || val === '') return '-';
      if (val === '-') return '-';
      return window.validatorSystem.sanitizeHtml(String(val));
    };

    // Hauptadresse aus Creator-Tabelle als Tabelle
    const hauptAdresseTable = `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Firma</th>
              <th>Straße</th>
              <th>Hausnummer</th>
              <th>PLZ</th>
              <th>Stadt</th>
              <th>Land</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="badge badge-primary">Hauptadresse</span></td>
              <td>-</td>
              <td>${sanitize(c.lieferadresse_strasse)}</td>
              <td>${sanitize(c.lieferadresse_hausnummer)}</td>
              <td>${sanitize(c.lieferadresse_plz)}</td>
              <td>${sanitize(c.lieferadresse_stadt)}</td>
              <td>${sanitize(c.lieferadresse_land)}</td>
              <td>
                ${actionBuilder.create('creator_hauptadresse', this.creatorId)}
              </td>
            </tr>
            ${this.renderZusatzAdressenRows()}
          </tbody>
        </table>
      </div>
    `;

    return `
      <div class="creator-addresses-container">
        <div class="address-section">
          <div class="section-header">
            <h3>Adressen</h3>
            <button 
              class="primary-btn btn-sm" 
              onclick="window.creatorAdressenManager?.open('${this.creatorId}')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px; margin-right: 4px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Neue Adresse hinzufügen
            </button>
          </div>
          ${this.creatorAdressen && this.creatorAdressen.length === 0 
            ? `${hauptAdresseTable}<p class="empty-text" style="margin-top: 1rem; color: #6b7280;">Keine zusätzlichen Adressen hinterlegt.</p>` 
            : hauptAdresseTable
          }
        </div>
      </div>
    `;
  }

  renderZusatzAdressenRows() {
    if (!this.creatorAdressen || this.creatorAdressen.length === 0) {
      return '';
    }

    return this.creatorAdressen.map(adresse => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span>${window.validatorSystem.sanitizeHtml(adresse.adressname)}</span>
            ${adresse.ist_standard ? `
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="var(--color-warning, #f59e0b)" style="width: 18px; height: 18px; flex-shrink: 0;">
                <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" />
              </svg>
            ` : ''}
          </div>
        </td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.firmenname || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.strasse || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.hausnummer || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.plz || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.stadt || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.land || 'Deutschland')}</td>
        <td>
          ${actionBuilder.create('creator_adresse', adresse.id)}
        </td>
      </tr>
    `).join('');
  }

  formatFullAddress(creator) {
    const parts = [
      creator?.lieferadresse_strasse,
      creator?.lieferadresse_hausnummer,
      creator?.lieferadresse_plz,
      creator?.lieferadresse_stadt,
      creator?.lieferadresse_land
    ].filter(Boolean);
    if (!parts.length) return '-';
    return parts.join(', ');
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

    // Tabellen-Links (Unternehmen)
    document.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('.table-link');
      if (!link) return;
      if (link.dataset.table === 'unternehmen') {
        e.preventDefault();
        window.navigateTo(`/unternehmen/${link.dataset.id}`);
      }
    });

    // Edit Creator Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-edit-creator') {
        e.preventDefault();
        this.showEditForm();
      }
    });

    // Kampagne Links
    document.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-kampagne-id')) {
        e.preventDefault();
        const kampagneId = e.target.getAttribute('data-kampagne-id');
        window.navigateTo(`/kampagne/${kampagneId}`);
      }
    });

    // Notizen Update Event
    window.addEventListener('notizenUpdated', async (e) => {
      if (e.detail.entityType === 'creator' && e.detail.entityId === this.creatorId) {
        console.log('🔄 CREATORDETAIL: Notizen wurden aktualisiert, lade neu...');
        this.notizen = await window.notizenSystem.loadNotizen('creator', this.creatorId);
        this.renderNotizen();
      }
    });

    // Creator-Adressen Update Event - mit eindeutiger Kennung
    const adressenUpdateHandler = async (e) => {
      if (e.detail?.entity === 'creator_adressen' && e.detail?.creatorId === this.creatorId) {
        console.log('🔄 CREATORDETAIL: Creator-Adressen aktualisiert, lade Daten neu');
        tabDataCache.invalidate('creator', this.creatorId);
        await this.loadCriticalData();
        
        // Tab neu rendern
        const adresseTab = document.getElementById('tab-adresse');
        console.log('🔍 CREATORDETAIL: Tab-Element gefunden?', !!adresseTab);
        
        if (adresseTab) {
          adresseTab.innerHTML = `
            <div class="detail-section">
              ${this.renderAdresse()}
            </div>
          `;
          console.log('✅ CREATORDETAIL: Adresse-Tab erfolgreich aktualisiert');
        } else {
          console.error('❌ CREATORDETAIL: Tab-Element nicht gefunden!');
        }
      }
    };
    
    // Entferne alte Listener falls vorhanden
    if (this.adressenUpdateHandler) {
      window.removeEventListener('entityUpdated', this.adressenUpdateHandler);
    }
    
    // Speichere Referenz und registriere
    this.adressenUpdateHandler = adressenUpdateHandler;
    window.addEventListener('entityUpdated', this.adressenUpdateHandler);

    // Bewertungen Update Event
    window.addEventListener('bewertungenUpdated', async (e) => {
      if (e.detail.entityType === 'creator' && e.detail.entityId === this.creatorId) {
        console.log('🔄 CREATORDETAIL: Bewertungen wurden aktualisiert, lade neu...');
        this.ratings = await window.bewertungsSystem.loadBewertungen('creator', this.creatorId);
        this.renderRatings();
      }
    });

    // Soft-Refresh bei Realtime-Updates (nur wenn kein Formular aktiv)
    window.addEventListener('softRefresh', async (e) => {
      const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
      if (hasActiveForm) {
        console.log('⏸️ CREATORDETAIL: Formular aktiv - Soft-Refresh übersprungen');
        return;
      }
      if (!this.creatorId || !location.pathname.includes('/creator/')) {
        return;
      }
      console.log('🔄 CREATORDETAIL: Soft-Refresh - lade Daten neu');
      tabDataCache.invalidate('creator', this.creatorId);
      await this.loadCriticalData();
      this.render();
      // Events sind bereits gebunden, nicht erneut binden
    });
  }

  // Tab wechseln
  async switchTab(tabName) {
    console.log('🔄 CREATORDETAIL: Wechsle zu Tab:', tabName);
    
    // UI sofort updaten
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    
    // Gewählten Tab aktivieren
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activePane = document.getElementById(`tab-${tabName}`);
    
    if (activeButton && activePane) {
      activeButton.classList.add('active');
      activePane.classList.add('active');
      
      // Lazy load Tab-Daten (außer für bereits geladene Tabs)
      if (!['info', 'notizen', 'ratings', 'adresse'].includes(tabName)) {
        await this.loadTabData(tabName);
      }
    }
  }

  // Zeige Add Notiz Modal
  showAddNotizModal() {
    // TODO: Implementiere Modal für neue Notiz
    console.log('📝 CREATORDETAIL: Zeige Add Notiz Modal');
  }

  // Zeige Add Rating Modal
  showAddRatingModal() {
    // TODO: Implementiere Modal für neue Bewertung
    console.log('⭐ CREATORDETAIL: Zeige Add Rating Modal');
  }

  // Show Edit Form (für Routing)
  showEditForm() {
    console.log('🎯 CREATORDETAIL: Zeige Creator-Bearbeitungsformular für ID:', this.creatorId);
    window.setHeadline('Creator bearbeiten');
    
    // Creator-Daten für Edit-Mode vorbereiten
    const editData = {
      ...this.creator,
      _isEditMode: true,
      _entityId: this.creatorId,
      // Multi-Select IDs extrahieren
      sprachen_ids: this.creator.sprachen ? this.creator.sprachen.map(s => s.id) : [],
      branche_ids: this.creator.branchen ? this.creator.branchen.map(b => b.id) : [],
      creator_type_ids: this.creator.creator_types ? this.creator.creator_types.map(t => t.id) : []
    };
    
    console.log('📋 CREATORDETAIL: Edit-Daten vorbereitet:', {
      sprachen_ids: editData.sprachen_ids,
      branche_ids: editData.branche_ids,
      creator_type_ids: editData.creator_type_ids
    });
    
    // Formular mit Creator-Daten rendern
    const formHtml = window.formSystem.renderFormOnly('creator', editData);
    window.setContentSafely(window.content, `
      <div class="form-page">
        ${formHtml}
      </div>
    `);

    // Formular-Events binden
    window.formSystem.bindFormEvents('creator', editData);
    
    // Custom Submit Handler für Bearbeitungsformular
    const form = document.getElementById('creator-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
    }
  }

  // Handle Edit Form Submit
  async handleEditFormSubmit() {
    try {
      const form = document.getElementById('creator-form');
      const formData = new FormData(form);
      const submitData = {};

      // Tag-basierte Multi-Selects aus Hidden-Selects sammeln
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      tagBasedSelects.forEach(select => {
        const fieldName = select.name;
        
        // Suche das versteckte Select mit den tatsächlichen Werten
        let hiddenSelect = form.querySelector(`select[name="${fieldName}[]"][style*="display: none"]`);
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${fieldName}"][style*="display: none"]`);
        }
        
        // Alternative: Suche nach Tag-Container und sammle Werte aus Tags
        if (!hiddenSelect) {
          const tagContainer = form.querySelector(`select[name="${fieldName}"]`)?.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            const tags = tagContainer.querySelectorAll('.tag[data-value]');
            const tagValues = Array.from(tags).map(tag => tag.dataset.value).filter(Boolean);
            if (tagValues.length > 0) {
              submitData[fieldName] = tagValues;
              console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Tags gesammelt:`, tagValues);
              return;
            }
          }
        }
        
        if (hiddenSelect) {
          const values = Array.from(hiddenSelect.selectedOptions).map(opt => opt.value).filter(Boolean);
          if (values.length > 0) {
            submitData[fieldName] = values;
            console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Hidden-Select gesammelt:`, values);
          }
        } else {
          console.warn(`⚠️ Kein Hidden-Select oder Tags für ${fieldName} gefunden`);
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

      // Validierung
      const validation = window.validatorSystem.validateForm(submitData, {
        vorname: { type: 'text', minLength: 2, required: true },
        nachname: { type: 'text', minLength: 2, required: true },
        mail: { type: 'email' },
        telefonnummer: { type: 'phone' },
        portfolio_link: { type: 'url' }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      // Creator aktualisieren
      const result = await window.dataService.updateEntity('creator', this.creatorId, submitData);

      if (result.success) {
        this.showSuccessMessage('Creator erfolgreich aktualisiert!');
        
        // Creator-Daten neu laden und zur Detailseite zurückkehren
        setTimeout(async () => {
          tabDataCache.invalidate('creator', this.creatorId);
          await this.loadCriticalData();
          await this.render();
          window.navigateTo(`/creator/${this.creatorId}`);
        }, 1500);
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }

    } catch (error) {
      console.error('❌ Edit Formular-Submit Fehler:', error);
      this.showErrorMessage(error.message);
    }
  }

  // Show Validation Errors
  showValidationErrors(errors) {
    console.log('❌ Validierungsfehler:', errors);
    
    // Alle bestehenden Fehlermeldungen entfernen
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
    
    // Neue Fehlermeldungen anzeigen
    Object.keys(errors).forEach(fieldName => {
      const field = document.querySelector(`[name="${fieldName}"]`);
      if (field) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.textContent = errors[fieldName];
        errorDiv.style.color = '#dc3545';
        errorDiv.style.fontSize = '0.875rem';
        errorDiv.style.marginTop = '0.25rem';
        
        field.parentNode.appendChild(errorDiv);
        field.style.borderColor = '#dc3545';
      }
    });
  }

  // Show Success Message
  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.textContent = message;
    successDiv.style.cssText = `
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #c3e6cb;
    `;
    
    const formPage = document.querySelector('.form-page');
    if (formPage) {
      formPage.insertBefore(successDiv, formPage.firstChild);
    }
  }

  // Show Error Message
  showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #f5c6cb;
    `;
    
    const formPage = document.querySelector('.form-page');
    if (formPage) {
      formPage.insertBefore(errorDiv, formPage.firstChild);
    }
  }

  // Hilfsfunktionen
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  }

  // Setup automatische Cache-Invalidierung bei Entity-Updates
  setupCacheInvalidation() {
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'creator' && e.detail.id === this.creatorId) {
        console.log('🔄 CREATORDETAIL: Entity updated - invalidiere Cache');
        tabDataCache.invalidate('creator', this.creatorId);
        
        // Optional: Reload kritische Daten bei Updates
        if (e.detail.action === 'updated') {
          this.loadCriticalData().then(() => {
            // Aktualisiere nur die Info-Sektion ohne vollständiges Neu-Rendering
            const infoTab = document.querySelector('#tab-info');
            if (infoTab && infoTab.classList.contains('active')) {
              infoTab.innerHTML = this.renderInfo();
            }
          });
        }
      }
    });
  }

  // Cleanup
  destroy() {
    console.log('🗑️ CREATORDETAIL: Destroy aufgerufen - räume auf');
    
    // Invalidiere Tab-Cache für diesen Creator
    tabDataCache.invalidate('creator', this.creatorId);
    
    // Content zurücksetzen
    window.setContentSafely('');
    console.log('✅ CREATORDETAIL: Destroy abgeschlossen');
  }
}

export const creatorDetail = new CreatorDetail(); 