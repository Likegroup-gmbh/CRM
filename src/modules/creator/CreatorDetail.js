// CreatorDetail.js (ES6-Modul)
// Creator-Detailseite mit allen relevanten Informationen
// Nutzt einheitliches zwei-Spalten-Layout
import { renderKampagnenTable } from '../kampagne/KampagneTable.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';
import { renderTabButton } from '../../core/TabUtils.js';

export class CreatorDetail extends PersonDetailBase {
  constructor() {
    super();
    this.creatorId = null;
    this.creator = null;
    this.notizen = [];
    this.ratings = [];
    this.kampagnen = [];
    this.lists = [];
    this.kooperationen = [];
    this.rechnungen = [];
    this.vertraege = [];
    this.unternehmen = [];
    this.creatorAdressen = [];
    this.eventsBound = false;
    this._cacheInvalidationBound = false;
    this.activeMainTab = 'info';
  }

  async init(creatorId) {
    console.log('🎯 CREATORDETAIL: Initialisiere Creator-Detailseite für ID:', creatorId);
    
    this.creatorId = creatorId;
    
    if (window.moduleRegistry?.currentModule !== this) {
      console.log('⚠️ CREATORDETAIL: Nicht mehr das aktuelle Modul, breche ab');
      return;
    }
    
    try {
      await this.loadCriticalData();
      
      if (window.breadcrumbSystem && this.creator) {
        const creatorName = [this.creator.vorname, this.creator.nachname].filter(Boolean).join(' ') || 'Details';
        const canEdit = window.currentUser?.permissions?.creator?.can_edit !== false;
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Creator', url: '/creator', clickable: true },
          { label: creatorName, url: `/creator/${this.creatorId}`, clickable: false }
        ], {
          id: 'btn-edit-creator',
          canEdit: canEdit
        });
      }
      
      await this.loadActivitiesData();
      await this.render();
      
      if (!this.eventsBound) {
        this.bindEvents();
        this.eventsBound = true;
      }
      
      this.setupCacheInvalidation();
      
      console.log('✅ CREATORDETAIL: Initialisierung abgeschlossen');
      
    } catch (error) {
      console.error('❌ CREATORDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'CreatorDetail.init');
    }
  }

  async loadCriticalData() {
    console.log('🔄 CREATORDETAIL: Lade kritische Daten parallel...');
    const startTime = performance.now();
    
    const [
      creatorResult,
      sprachenResult,
      branchenResult,
      typenResult,
      adressenResult,
      notizenResult,
      ratingsResult,
      agenturResult
    ] = await parallelLoad([
      () => window.supabase
        .from('creator')
        .select(`*`)
        .eq('id', this.creatorId)
        .single(),
      
      () => window.supabase
        .from('creator_sprachen')
        .select('sprache_id, sprachen:sprache_id(id, name)')
        .eq('creator_id', this.creatorId)
        .then(r => (r.data || []).map(x => x.sprachen).filter(Boolean)),
      
      () => window.supabase
        .from('creator_branchen')
        .select('branche_id, branchen_creator:branche_id(id, name)')
        .eq('creator_id', this.creatorId)
        .then(r => (r.data || []).map(x => x.branchen_creator).filter(Boolean)),
      
      () => window.supabase
        .from('creator_creator_type')
        .select('creator_type_id, creator_type:creator_type_id(id, name)')
        .eq('creator_id', this.creatorId)
        .then(r => (r.data || []).map(x => x.creator_type).filter(Boolean)),
      
      () => window.supabase
        .from('creator_adressen')
        .select('*')
        .eq('creator_id', this.creatorId)
        .order('created_at', { ascending: false })
        .then(r => r.data || []),
      
      () => window.notizenSystem.loadNotizen('creator', this.creatorId),
      
      () => window.bewertungsSystem.loadBewertungen('creator', this.creatorId),
      
      () => window.supabase
        .from('creator_agentur')
        .select('*')
        .eq('creator_id', this.creatorId)
        .maybeSingle()
        .then(r => r.data || null)
    ]);
    
    if (creatorResult.error) {
      throw new Error(`Fehler beim Laden der Creator-Daten: ${creatorResult.error.message}`);
    }
    
    this.creator = creatorResult.data;
    this.creator.sprachen = sprachenResult;
    this.creator.branchen = branchenResult;
    this.creator.creator_types = typenResult;
    this.creatorAdressen = adressenResult;
    this.notizen = notizenResult || [];
    this.ratings = ratingsResult || [];
    
    // Agentur-Daten
    if (agenturResult && agenturResult.ist_aktiv) {
      this.creator.agentur_vertreten = true;
      this.creator.agentur_name = agenturResult.agentur_name;
      this.creator.agentur_adresse = agenturResult.agentur_adresse;
      this.creator.agentur_vertretung = agenturResult.agentur_vertretung;
    }
    
    const loadTime = (performance.now() - startTime).toFixed(0);
    console.log(`✅ CREATORDETAIL: Kritische Daten geladen in ${loadTime}ms`);
  }

  async loadActivitiesData() {
    try {
      const allActivities = [];

      // Kooperationen-History für diesen Creator
      const { data: koopHistory } = await window.supabase
        .from('kooperation_history')
        .select('id, old_status, new_status, comment, created_at, kooperation:kooperation_id(name)')
        .in('kooperation_id', (this.kooperationen || []).map(k => k.id).filter(Boolean))
        .order('created_at', { ascending: false })
        .limit(15);

      if (koopHistory) {
        allActivities.push(...koopHistory.map(h => ({
          ...h,
          type: 'kooperation',
          title: 'Kooperation',
          entity_name: h.kooperation?.name || 'Unbekannt',
          action: h.old_status && h.new_status ? `Status: ${h.old_status} → ${h.new_status}` : 'Status geändert'
        })));
      }

      this.activities = allActivities
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 15);

    } catch (error) {
      console.error('❌ Fehler beim Laden der Activities:', error);
      this.activities = [];
    }
  }
  
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
            
          case 'vertraege':
            await this.loadVertraege();
            this.updateVertraegeTab();
            break;
        }
        
        const loadTime = (performance.now() - startTime).toFixed(0);
        console.log(`✅ CREATORDETAIL: Tab "${tabName}" geladen in ${loadTime}ms`);
        
      } catch (error) {
        console.error(`❌ CREATORDETAIL: Fehler beim Laden von Tab "${tabName}":`, error);
      }
    });
  }
  
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
      
      await this.mergeKampagnenFromKooperationen();
    } catch (e) {
      console.warn('⚠️ CREATORDETAIL: Kooperationen konnten nicht geladen werden', e);
      this.kooperationen = [];
    }
  }
  
  async loadRechnungen() {
    try {
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

  async loadVertraege() {
    try {
      const { data: vertraege } = await window.supabase
        .from('vertraege')
        .select(`
          id, name, typ, is_draft, datei_url, datei_path, created_at,
          kampagne:kampagne_id(id, kampagnenname),
          kunde:kunde_unternehmen_id(id, firmenname)
        `)
        .eq('creator_id', this.creatorId)
        .order('created_at', { ascending: false });
      this.vertraege = vertraege || [];
      console.log('✅ CREATORDETAIL: Verträge geladen:', this.vertraege.length);
    } catch (e) {
      console.warn('⚠️ CREATORDETAIL: Verträge konnten nicht geladen werden', e);
      this.vertraege = [];
    }
  }
  
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
  
  async loadUnternehmen() {
    try {
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
  
  updateKampagnenTab() {
    const container = document.querySelector('#tab-kampagnen');
    if (container) {
      container.innerHTML = this.renderKampagnenContent();
      const btn = document.querySelector('.tab-button[data-tab="kampagnen"] .tab-count');
      if (btn) btn.textContent = String(this.kampagnen?.length || 0);
    }
  }
  
  updateKooperationenTab() {
    const container = document.querySelector('#tab-kooperationen');
    if (container) {
      container.innerHTML = this.renderKooperationenContent();
      const btn = document.querySelector('.tab-button[data-tab="kooperationen"] .tab-count');
      if (btn) btn.textContent = String(this.kooperationen?.length || 0);
    }
  }
  
  updateListenTab() {
    const container = document.querySelector('#tab-listen');
    if (container) {
      container.innerHTML = this.renderListenContent();
      const btn = document.querySelector('.tab-button[data-tab="listen"] .tab-count');
      if (btn) btn.textContent = String(this.lists?.length || 0);
    }
  }
  
  updateUnternehmenTab() {
    const container = document.querySelector('#tab-unternehmen');
    if (container) {
      container.innerHTML = this.renderUnternehmenContent();
      const btn = document.querySelector('.tab-button[data-tab="unternehmen"] .tab-count');
      if (btn) btn.textContent = String(this.unternehmen?.length || 0);
    }
  }
  
  updateRechnungenTab() {
    const container = document.querySelector('#tab-rechnungen');
    if (container) {
      container.innerHTML = this.renderRechnungenContent();
      const btn = document.querySelector('.tab-button[data-tab="rechnungen"] .tab-count');
      if (btn) btn.textContent = String(this.rechnungen?.length || 0);
    }
  }

  updateVertraegeTab() {
    const container = document.querySelector('#tab-vertraege');
    if (container) {
      container.innerHTML = this.renderVertraegeContent();
      const btn = document.querySelector('.tab-button[data-tab="vertraege"] .tab-count');
      if (btn) btn.textContent = String(this.vertraege?.length || 0);
    }
  }

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

    // Person-Config für die Sidebar - nur Profilbild im Header
    const creatorName = [this.creator.vorname, this.creator.nachname].filter(Boolean).join(' ') || 'Unbekannt';
    const personConfig = {
      name: creatorName,
      email: this.creator.mail || '',
      subtitle: this.creator.creator_types?.map(t => t.name).join(', ') || 'Creator',
      avatarUrl: this.creator.profilbild_url,
      lastActivity: this.creator.updated_at,
      avatarOnly: true
    };

    // Quick Actions entfernt - nur Profilbild im Header
    const quickActions = [];

    // Info-Items für Sidebar
    const sidebarInfo = this.renderSidebarInfo();

    // Tab-Navigation (oben über volle Breite)
    const tabNavigation = this.renderTabNavigation();

    // Main Content (nur Tab-Content, ohne Navigation)
    const mainContent = this.renderMainContent();

    // Layout mit Tabs oben rendern
    const html = this.renderTwoColumnLayout({
      person: personConfig,
      stats: [],
      quickActions,
      sidebarInfo,
      tabNavigation,
      mainContent
    });

    window.setContentSafely(window.content, html);
  }

  renderSidebarInfo() {
    // Social Media Icons als klickbare Links
    let socialHtml = '';
    if (this.creator.instagram || this.creator.tiktok) {
      const instagramUrl = this.creator.instagram 
        ? (this.creator.instagram.startsWith('http') ? this.creator.instagram : `https://instagram.com/${this.creator.instagram.replace('@', '')}`)
        : null;
      const tiktokUrl = this.creator.tiktok 
        ? (this.creator.tiktok.startsWith('http') ? this.creator.tiktok : `https://tiktok.com/@${this.creator.tiktok.replace('@', '')}`)
        : null;

      socialHtml = `
        <div class="profile-social-links">
          ${instagramUrl ? `
            <a href="${instagramUrl}" target="_blank" rel="noopener noreferrer" class="social-link social-instagram" title="Instagram: @${this.creator.instagram}">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              ${this.creator.instagram_follower ? `<span class="social-follower">${this.formatNumber(this.creator.instagram_follower)}</span>` : ''}
            </a>
          ` : ''}
          ${tiktokUrl ? `
            <a href="${tiktokUrl}" target="_blank" rel="noopener noreferrer" class="social-link social-tiktok" title="TikTok: @${this.creator.tiktok}">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
              </svg>
              ${this.creator.tiktok_follower ? `<span class="social-follower">${this.formatNumber(this.creator.tiktok_follower)}</span>` : ''}
            </a>
          ` : ''}
        </div>
      `;
    }

    // Reguläre Info-Items
    const items = [
      { label: 'Stadt', value: this.creator.lieferadresse_stadt || '-' },
      { label: 'Land', value: this.creator.lieferadresse_land || '-' }
    ];

    // Sprachen
    if (this.creator.sprachen && this.creator.sprachen.length > 0) {
      items.push({ label: 'Sprachen', value: this.creator.sprachen.map(s => s.name), tags: true });
    }

    // Branchen
    if (this.creator.branchen && this.creator.branchen.length > 0) {
      items.push({ label: 'Branchen', value: this.creator.branchen.map(b => b.name), tags: true });
    }

    // Budget
    if (this.creator.budget_letzte_buchung) {
      items.push({ label: 'Letztes Budget', value: this.formatCurrency(this.creator.budget_letzte_buchung) });
    }

    items.push({ label: 'Erstellt', value: this.formatDate(this.creator.created_at) });

    return socialHtml + this.renderInfoItems(items);
  }

  getTabsConfig() {
    return [
      { tab: 'info', label: 'Informationen', isActive: this.activeMainTab === 'info' },
      { tab: 'kampagnen', label: 'Kampagnen', count: this.kampagnen?.length || 0, isActive: this.activeMainTab === 'kampagnen' },
      { tab: 'kooperationen', label: 'Kooperationen', count: this.kooperationen?.length || 0, isActive: this.activeMainTab === 'kooperationen' },
      { tab: 'listen', label: 'Listen', count: this.lists?.length || 0, isActive: this.activeMainTab === 'listen' },
      { tab: 'unternehmen', label: 'Unternehmen', count: this.unternehmen?.length || 0, isActive: this.activeMainTab === 'unternehmen' },
      { tab: 'rechnungen', label: 'Rechnungen', count: this.rechnungen?.length || 0, isActive: this.activeMainTab === 'rechnungen' },
      { tab: 'vertraege', label: 'Verträge', count: this.vertraege?.length || 0, isActive: this.activeMainTab === 'vertraege' },
      { tab: 'adresse', label: 'Adresse', isActive: this.activeMainTab === 'adresse' },
      { tab: 'notizen', label: 'Notizen', count: this.notizen.length, isActive: this.activeMainTab === 'notizen' },
      { tab: 'ratings', label: 'Bewertungen', count: this.ratings.length, isActive: this.activeMainTab === 'ratings' }
    ];
  }

  renderTabNavigation() {
    const tabs = this.getTabsConfig();
    return tabs.map(t => renderTabButton(t)).join('');
  }

  renderMainContent() {
    return `
      <div class="tab-content">
        <div class="tab-pane ${this.activeMainTab === 'info' ? 'active' : ''}" id="tab-info">
          ${this.renderInfoTab()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'kampagnen' ? 'active' : ''}" id="tab-kampagnen">
          ${this.renderKampagnenContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'kooperationen' ? 'active' : ''}" id="tab-kooperationen">
          ${this.renderKooperationenContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'listen' ? 'active' : ''}" id="tab-listen">
          ${this.renderListenContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'unternehmen' ? 'active' : ''}" id="tab-unternehmen">
          ${this.renderUnternehmenContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'rechnungen' ? 'active' : ''}" id="tab-rechnungen">
          ${this.renderRechnungenContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'vertraege' ? 'active' : ''}" id="tab-vertraege">
          ${this.renderVertraegeContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'adresse' ? 'active' : ''}" id="tab-adresse">
          ${this.renderAdresseContent()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'notizen' ? 'active' : ''}" id="tab-notizen">
          ${window.notizenSystem.renderNotizenContainer(this.notizen, 'creator', this.creatorId)}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'ratings' ? 'active' : ''}" id="tab-ratings">
          ${window.bewertungsSystem.renderBewertungenContainer(this.ratings, 'creator', this.creatorId)}
        </div>
      </div>
    `;
  }

  renderInfoTab() {
    return `
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3 class="section-title">Kontakt</h3>
            <div class="detail-item">
              <label>E-Mail:</label>
              <span>${this.creator.mail || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Telefon:</label>
              <span>${this.creator.telefonnummer || '-'}</span>
            </div>
            ${this.creator.agentur_vertreten ? `
            <div class="detail-item" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color, #e5e7eb);">
              <label>Agentur-Vertretung:</label>
              <span class="status-badge status-aktiv">Ja</span>
            </div>
            <div class="detail-item">
              <label>Agenturname:</label>
              <span>${this.creator.agentur_name || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Agenturadresse:</label>
              <span>${this.creator.agentur_adresse || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Vertreten durch:</label>
              <span>${this.creator.agentur_vertretung || '-'}</span>
            </div>
            ` : ''}
          </div>

          <div class="detail-card">
            <h3 class="section-title">Lieferadresse</h3>
            <div class="detail-item">
              <label>Straße:</label>
              <span>${this.creator.lieferadresse_strasse ? `${this.creator.lieferadresse_strasse} ${this.creator.lieferadresse_hausnummer || ''}`.trim() : '-'}</span>
            </div>
            <div class="detail-item">
              <label>PLZ / Stadt:</label>
              <span>${this.creator.lieferadresse_plz || this.creator.lieferadresse_stadt ? `${this.creator.lieferadresse_plz || ''} ${this.creator.lieferadresse_stadt || ''}`.trim() : '-'}</span>
            </div>
            <div class="detail-item">
              <label>Land:</label>
              <span>${this.creator.lieferadresse_land || '-'}</span>
            </div>
          </div>

          ${this.creator.rechnungsadresse_abweichend ? `
          <div class="detail-card">
            <h3 class="section-title">Rechnungsadresse</h3>
            <div class="detail-item">
              <label>Straße:</label>
              <span>${this.creator.rechnungsadresse_strasse ? `${this.creator.rechnungsadresse_strasse} ${this.creator.rechnungsadresse_hausnummer || ''}`.trim() : '-'}</span>
            </div>
            <div class="detail-item">
              <label>PLZ / Stadt:</label>
              <span>${this.creator.rechnungsadresse_plz || this.creator.rechnungsadresse_stadt ? `${this.creator.rechnungsadresse_plz || ''} ${this.creator.rechnungsadresse_stadt || ''}`.trim() : '-'}</span>
            </div>
            <div class="detail-item">
              <label>Land:</label>
              <span>${this.creator.rechnungsadresse_land || '-'}</span>
            </div>
          </div>
          ` : ''}

          <div class="detail-card">
            <h3 class="section-title">Social Media</h3>
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
            <h3 class="section-title">Profil</h3>
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
            <div class="detail-item">
              <label>Geschlecht:</label>
              <span>${this.creator.geschlecht || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Alter:</label>
              <span>${this.creator.alter_jahre ? `${this.creator.alter_jahre} Jahre` : '-'}</span>
            </div>
            ${this.creator.hat_haustier ? `
            <div class="detail-item">
              <label>Haustier:</label>
              <span>${this.creator.haustier_beschreibung || 'Ja'}</span>
            </div>
            ` : ''}
          </div>

          <div class="detail-card">
            <h3 class="section-title">Finanzen</h3>
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
    `;
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

  renderKampagnenContent() {
    if (!this.kampagnen || this.kampagnen.length === 0) {
      return `<div class="empty-state"><p>Noch keine Kampagnen zugeordnet.</p></div>`;
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

  renderListenContent() {
    if (this.lists.length === 0) {
      return `<div class="empty-state"><p>Noch keiner Liste zugeordnet.</p></div>`;
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

    return `<div class="lists-container">${listsHtml}</div>`;
  }

  renderKooperationenContent() {
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
        <td><span class="status-badge status-${(k.status || 'unknown').toLowerCase().replace(/\s+/g, '-')}">${k.status || '-'}</span></td>
        <td>${k.videoanzahl || 0}</td>
        <td>${k.einkaufspreis_gesamt ? this.formatCurrency(k.einkaufspreis_gesamt) : '-'}</td>
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
              <th>Status</th>
              <th>Videos</th>
              <th>Gesamtkosten</th>
              <th>Erstellt</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  renderRechnungenContent() {
    if (!this.rechnungen || this.rechnungen.length === 0) {
      return `<div class="empty-state"><p>Keine Rechnungen vorhanden.</p></div>`;
    }

    const rows = this.rechnungen.map(r => `
      <tr>
        <td><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${window.validatorSystem.sanitizeHtml(r.rechnung_nr || '—')}</a></td>
        <td>${r.status || '-'}</td>
        <td>${this.formatCurrency(r.nettobetrag)}</td>
        <td>${this.formatCurrency(r.bruttobetrag)}</td>
        <td>${this.formatDate(r.gestellt_am)}</td>
        <td>${this.formatDate(r.bezahlt_am)}</td>
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

  renderVertraegeContent() {
    if (!this.vertraege || this.vertraege.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <h3>Keine Verträge vorhanden</h3>
          <p>Für diesen Creator wurden noch keine Verträge erfasst.</p>
        </div>
      `;
    }

    const getStatusLabel = (isDraft) => isDraft ? 'Entwurf' : 'Final';
    const getStatusClass = (isDraft) => isDraft ? 'draft' : 'aktiv';

    const rows = this.vertraege.map(v => {
      const kampagneName = v.kampagne?.kampagnenname || '-';
      const unternehmenName = v.kunde?.firmenname || '-';
      
      return `
        <tr>
          <td><a href="/vertraege/${v.id}" onclick="event.preventDefault(); window.navigateTo('/vertraege/${v.id}')">${window.validatorSystem.sanitizeHtml(v.name || '—')}</a></td>
          <td>${window.validatorSystem.sanitizeHtml(v.typ || '-')}</td>
          <td><span class="status-badge status-${getStatusClass(v.is_draft)}">${getStatusLabel(v.is_draft)}</span></td>
          <td>${v.kampagne ? `<a href="/kampagnen/${v.kampagne.id}" onclick="event.preventDefault(); window.navigateTo('/kampagnen/${v.kampagne.id}')">${window.validatorSystem.sanitizeHtml(kampagneName)}</a>` : '-'}</td>
          <td>${v.kunde ? `<a href="/unternehmen/${v.kunde.id}" onclick="event.preventDefault(); window.navigateTo('/unternehmen/${v.kunde.id}')">${window.validatorSystem.sanitizeHtml(unternehmenName)}</a>` : '-'}</td>
          <td>${v.datei_url ? `<a href="${v.datei_url}" target="_blank" rel="noopener">PDF</a>` : '-'}</td>
          <td>${this.formatDate(v.created_at)}</td>
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
              <th>Kampagne</th>
              <th>Unternehmen</th>
              <th>Datei</th>
              <th>Erstellt am</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  renderUnternehmenContent() {
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

  renderAdresseContent() {
    const c = this.creator || {};
    const sanitizeVal = (val) => {
      if (val === undefined || val === null || val === '') return '-';
      if (val === '-') return '-';
      return window.validatorSystem.sanitizeHtml(String(val));
    };

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
              <td>${sanitizeVal(c.lieferadresse_strasse)}</td>
              <td>${sanitizeVal(c.lieferadresse_hausnummer)}</td>
              <td>${sanitizeVal(c.lieferadresse_plz)}</td>
              <td>${sanitizeVal(c.lieferadresse_stadt)}</td>
              <td>${sanitizeVal(c.lieferadresse_land)}</td>
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

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  bindEvents() {
    // Sidebar Tabs binden (aus Basis-Klasse)
    this.bindSidebarTabs();

    // Main Tab Navigation
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

    // Edit Creator Button / Action - korrigierter Selektor für Button-ID
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-edit-creator' || e.target.closest('#btn-edit-creator')) {
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
        const notizenTab = document.querySelector('#tab-notizen');
        if (notizenTab) {
          notizenTab.innerHTML = window.notizenSystem.renderNotizenContainer(this.notizen, 'creator', this.creatorId);
        }
      }
    });

    // Creator-Adressen Update Event
    const adressenUpdateHandler = async (e) => {
      if (e.detail?.entity === 'creator_adressen' && e.detail?.creatorId === this.creatorId) {
        console.log('🔄 CREATORDETAIL: Creator-Adressen aktualisiert, lade Daten neu');
        tabDataCache.invalidate('creator', this.creatorId);
        await this.loadCriticalData();
        
        const adresseTab = document.getElementById('tab-adresse');
        if (adresseTab) {
          adresseTab.innerHTML = this.renderAdresseContent();
          console.log('✅ CREATORDETAIL: Adresse-Tab erfolgreich aktualisiert');
        }
      }
    };
    
    if (this.adressenUpdateHandler) {
      window.removeEventListener('entityUpdated', this.adressenUpdateHandler);
    }
    
    this.adressenUpdateHandler = adressenUpdateHandler;
    window.addEventListener('entityUpdated', this.adressenUpdateHandler);

    // Bewertungen Update Event
    window.addEventListener('bewertungenUpdated', async (e) => {
      if (e.detail.entityType === 'creator' && e.detail.entityId === this.creatorId) {
        console.log('🔄 CREATORDETAIL: Bewertungen wurden aktualisiert, lade neu...');
        this.ratings = await window.bewertungsSystem.loadBewertungen('creator', this.creatorId);
        const ratingsTab = document.querySelector('#tab-ratings');
        if (ratingsTab) {
          ratingsTab.innerHTML = window.bewertungsSystem.renderBewertungenContainer(this.ratings, 'creator', this.creatorId);
        }
      }
    });

    // Soft-Refresh bei Realtime-Updates
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
    });
  }

  async switchTab(tabName) {
    console.log('🔄 CREATORDETAIL: Wechsle zu Tab:', tabName);
    
    this.activeMainTab = tabName;
    
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activePane = document.getElementById(`tab-${tabName}`);
    
    if (activeButton && activePane) {
      activeButton.classList.add('active');
      activePane.classList.add('active');
      
      // Lazy load Tab-Daten
      if (!['info', 'notizen', 'ratings', 'adresse'].includes(tabName)) {
        await this.loadTabData(tabName);
      }
    }
  }

  showEditForm() {
    console.log('🎯 CREATORDETAIL: Zeige Creator-Bearbeitungsformular für ID:', this.creatorId);
    window.setHeadline('Creator bearbeiten');
    
    const editData = {
      ...this.creator,
      _isEditMode: true,
      _entityId: this.creatorId,
      sprachen_ids: this.creator.sprachen ? this.creator.sprachen.map(s => s.id) : [],
      branche_ids: this.creator.branchen ? this.creator.branchen.map(b => b.id) : [],
      creator_type_ids: this.creator.creator_types ? this.creator.creator_types.map(t => t.id) : []
    };
    
    console.log('📋 CREATORDETAIL: Edit-Daten vorbereitet:', {
      sprachen_ids: editData.sprachen_ids,
      branche_ids: editData.branche_ids,
      creator_type_ids: editData.creator_type_ids,
      agentur_vertreten: editData.agentur_vertreten,
      agentur_name: editData.agentur_name
    });
    
    const formHtml = window.formSystem.renderFormOnly('creator', editData);
    window.setContentSafely(window.content, `
      <div class="form-page">
        ${formHtml}
      </div>
    `);

    window.formSystem.bindFormEvents('creator', editData);
    
    const form = document.getElementById('creator-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
    }
  }

  async handleEditFormSubmit() {
    try {
      const form = document.getElementById('creator-form');
      const formData = new FormData(form);
      const submitData = {};

      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      tagBasedSelects.forEach(select => {
        const fieldName = select.name;
        
        let hiddenSelect = form.querySelector(`select[name="${fieldName}[]"][style*="display: none"]`);
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${fieldName}"][style*="display: none"]`);
        }
        
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

      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) {
            submitData[cleanKey] = [];
          }
          submitData[cleanKey].push(value);
        } else {
          if (!submitData.hasOwnProperty(key) || !Array.isArray(submitData[key])) {
            submitData[key] = value;
          } else {
            console.log(`⚠️ Überspringe ${key}, bereits als Array gesetzt:`, submitData[key]);
          }
        }
      }

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

      const result = await window.dataService.updateEntity('creator', this.creatorId, submitData);

      if (result.success) {
        this.showSuccessMessage('Creator erfolgreich aktualisiert!');
        
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

  showValidationErrors(errors) {
    console.log('❌ Validierungsfehler:', errors);
    
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
    
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

  setupCacheInvalidation() {
    // Nur einmal binden
    if (this._cacheInvalidationBound) return;
    this._cacheInvalidationBound = true;
    
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'creator' && e.detail.id === this.creatorId) {
        console.log('🔄 CREATORDETAIL: Entity updated - invalidiere Cache');
        tabDataCache.invalidate('creator', this.creatorId);
        
        if (e.detail.action === 'updated') {
          this.loadCriticalData().then(() => {
            const infoTab = document.querySelector('#tab-info');
            if (infoTab && infoTab.classList.contains('active')) {
              infoTab.innerHTML = this.renderInfoTab();
            }
          });
        }
      }
    });
  }

  destroy() {
    console.log('🗑️ CREATORDETAIL: Destroy aufgerufen - räume auf');
    
    tabDataCache.invalidate('creator', this.creatorId);
    this._cacheInvalidationBound = false;
    this.eventsBound = false;
    
    window.setContentSafely('');
    console.log('✅ CREATORDETAIL: Destroy abgeschlossen');
  }
}

export const creatorDetail = new CreatorDetail();
