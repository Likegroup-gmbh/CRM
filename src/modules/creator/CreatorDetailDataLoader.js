// CreatorDetailDataLoader.js
// Data-Loading Methoden fuer CreatorDetail (Prototype-Mixin)

import { CreatorDetail } from './CreatorDetailCore.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';

CreatorDetail.prototype.loadCriticalData = async function() {
    console.log('🔄 CREATORDETAIL: Lade kritische Daten parallel...');
    const startTime = performance.now();
    
    const [
      creatorResult,
      sprachenResult,
      branchenResult,
      typenResult,
      adressenResult
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
        .then(r => r.data || [])
    ]);
    
    if (creatorResult.error) {
      throw new Error(`Fehler beim Laden der Creator-Daten: ${creatorResult.error.message}`);
    }
    
    this.creator = creatorResult.data;
    this.creator.sprachen = sprachenResult;
    this.creator.branchen = branchenResult;
    this.creator.creator_types = typenResult;
    this.creatorAdressen = adressenResult;
    
    const loadTime = (performance.now() - startTime).toFixed(0);
    console.log(`✅ CREATORDETAIL: Kritische Daten geladen in ${loadTime}ms`);
};

CreatorDetail.prototype.loadTabData = async function(tabName) {
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

          case 'management':
            await this.loadManagements();
            this.updateManagementTab();
            break;
        }
        
        const loadTime = (performance.now() - startTime).toFixed(0);
        console.log(`✅ CREATORDETAIL: Tab "${tabName}" geladen in ${loadTime}ms`);
        
      } catch (error) {
        console.error(`❌ CREATORDETAIL: Fehler beim Laden von Tab "${tabName}":`, error);
      }
    });
};

CreatorDetail.prototype.loadKampagnen = async function() {
    const { data: kampagnen, error } = await window.supabase
      .from('kampagne_creator')
      .select(`
        *,
        kampagne:kampagne_id (
          id,
          kampagnenname,
          eigener_name,
          status,
          start,
          deadline,
          unternehmen:unternehmen_id ( id, firmenname ),
          marke:marke_id ( id, markenname )
        )
      `)
      .eq('creator_id', this.creatorId)
      .order('hinzugefuegt_am', { ascending: false });

    this.kampagnen = !error ? (kampagnen || []) : [];

    if (!this.kooperationen?.length) {
      try {
        const { data: koops } = await window.supabase
          .from('kooperationen')
          .select(`
            id, name, status, created_at,
            kampagne:kampagne_id ( id, kampagnenname, eigener_name )
          `)
          .eq('creator_id', this.creatorId)
          .order('created_at', { ascending: false });
        this.kooperationen = koops || [];
      } catch (e) {
        console.warn('⚠️ CREATORDETAIL: Kooperationen für Kampagnen-Merge konnten nicht geladen werden', e);
      }
    }

    await this.mergeKampagnenFromKooperationen();
};

CreatorDetail.prototype.loadKooperationen = async function() {
    try {
      const { data: koops } = await window.supabase
        .from('kooperationen')
        .select(`
          id, name, status, videoanzahl, einkaufspreis_gesamt,
          kampagne:kampagne_id ( id, kampagnenname, eigener_name ),
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
};

CreatorDetail.prototype.loadProfileCounts = async function() {
    const kooperationen = this.kooperationen || [];
    const koopIds = kooperationen.map(k => k.id).filter(Boolean);
    const kooperationenCount = kooperationen.length;

    if (koopIds.length === 0) {
      this.profileCounts = { kooperationen: kooperationenCount, videos: 0 };
      return;
    }

    try {
      const { count, error } = await window.supabase
        .from('kooperation_videos')
        .select('id', { count: 'exact', head: true })
        .in('kooperation_id', koopIds);

      if (error) throw error;

      this.profileCounts = {
        kooperationen: kooperationenCount,
        videos: count || 0
      };
    } catch (error) {
      console.warn('⚠️ CREATORDETAIL: Videoanzahl konnte nicht geladen werden', error);
      this.profileCounts = {
        kooperationen: kooperationenCount,
        videos: 0
      };
    }
};

CreatorDetail.prototype.loadRechnungen = async function() {
    try {
      if (!this.kooperationen || this.kooperationen.length === 0) {
        await this.loadKooperationen();
      }
      
      const koopIds = (this.kooperationen || []).map(k => k.id).filter(Boolean);
      if (koopIds.length > 0) {
        const { data: rechnungen } = await window.supabase
          .from('rechnung')
          .select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url, kooperation_id, rechnung_pdfs(id, file_name, file_path, file_url)')
          .in('kooperation_id', koopIds)
          .order('gestellt_am', { ascending: false });
        this.rechnungen = rechnungen || [];
      } else {
        this.rechnungen = [];
      }
    } catch (_) {
      this.rechnungen = [];
    }
};

CreatorDetail.prototype.loadVertraege = async function() {
    try {
      const { data: vertraege } = await window.supabase
        .from('vertraege')
        .select(`
          id, name, typ, is_draft, datei_url, datei_path, created_at,
          kampagne:kampagne_id(id, kampagnenname, eigener_name),
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
};

CreatorDetail.prototype.loadListen = async function() {
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
};

CreatorDetail.prototype.loadUnternehmen = async function() {
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
};

CreatorDetail.prototype.mergeKampagnenFromKooperationen = async function() {
    try {
      const coopCampaigns = (this.kooperationen || [])
        .filter(k => k.kampagne)
        .map(k => ({
          kampagne: {
            id: k.kampagne.id,
            kampagnenname: k.kampagne.kampagnenname,
            eigener_name: k.kampagne.eigener_name,
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
          .select(`
            id, kampagnenname, eigener_name, status, start, deadline,
            art_der_kampagne, creatoranzahl, videoanzahl,
            unternehmen:unternehmen_id ( id, firmenname ),
            marke:marke_id ( id, markenname )
          `)
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
            if (e.kampagne.status == null && detail.status != null) e.kampagne.status = detail.status;
            if (e.kampagne.start == null && detail.start != null) e.kampagne.start = detail.start;
            if (e.kampagne.deadline == null && detail.deadline != null) e.kampagne.deadline = detail.deadline;
            if (e.kampagne.art_der_kampagne == null && detail.art_der_kampagne != null) {
              e.kampagne.art_der_kampagne = detail.art_der_kampagne;
            }
            if (e.kampagne.creatoranzahl == null && detail.creatoranzahl != null) {
              e.kampagne.creatoranzahl = detail.creatoranzahl;
            }
            if (e.kampagne.videoanzahl == null && detail.videoanzahl != null) {
              e.kampagne.videoanzahl = detail.videoanzahl;
            }
          }
          return e;
        });
      }
    } catch (mergeErr) {
      console.warn('⚠️ CREATORDETAIL: Kampagnen-Merge aus Kooperationen fehlgeschlagen', mergeErr);
    }
};

CreatorDetail.prototype.updateKampagnenTab = function() {
    const container = document.querySelector('#tab-kampagnen');
    if (container) {
      container.innerHTML = this.renderKampagnenContent();
      const btn = document.querySelector('.tab-button[data-tab="kampagnen"] .tab-count');
      if (btn) btn.textContent = String(this.kampagnen?.length || 0);
    }
};

CreatorDetail.prototype.updateKooperationenTab = function() {
    const container = document.querySelector('#tab-kooperationen');
    if (container) {
      container.innerHTML = this.renderKooperationenContent();
      const btn = document.querySelector('.tab-button[data-tab="kooperationen"] .tab-count');
      if (btn) btn.textContent = String(this.kooperationen?.length || 0);
    }
};

CreatorDetail.prototype.updateListenTab = function() {
    const container = document.querySelector('#tab-listen');
    if (container) {
      container.innerHTML = this.renderListenContent();
      const btn = document.querySelector('.tab-button[data-tab="listen"] .tab-count');
      if (btn) btn.textContent = String(this.lists?.length || 0);
    }
};

CreatorDetail.prototype.updateUnternehmenTab = function() {
    const container = document.querySelector('#tab-unternehmen');
    if (container) {
      container.innerHTML = this.renderUnternehmenContent();
      const btn = document.querySelector('.tab-button[data-tab="unternehmen"] .tab-count');
      if (btn) btn.textContent = String(this.unternehmen?.length || 0);
    }
};

CreatorDetail.prototype.updateRechnungenTab = function() {
    const container = document.querySelector('#tab-rechnungen');
    if (container) {
      container.innerHTML = this.renderRechnungenContent();
      const btn = document.querySelector('.tab-button[data-tab="rechnungen"] .tab-count');
      if (btn) btn.textContent = String(this.rechnungen?.length || 0);
    }
};

CreatorDetail.prototype.updateVertraegeTab = function() {
    const container = document.querySelector('#tab-vertraege');
    if (container) {
      container.innerHTML = this.renderVertraegeContent();
      const btn = document.querySelector('.tab-button[data-tab="vertraege"] .tab-count');
      if (btn) btn.textContent = String(this.vertraege?.length || 0);
    }
};

CreatorDetail.prototype.loadManagements = async function() {
    try {
      const { data, error } = await window.supabase
        .from('creator_management')
        .select(`
          management_id,
          ist_aktiv,
          management:management_id (
            id, firmenname, email, telefonnummer, webseite, instagram,
            strasse, hausnummer, plz, stadt, land, logo_url
          )
        `)
        .eq('creator_id', this.creatorId)
        .eq('ist_aktiv', true);

      if (error) {
        console.warn('⚠️ CREATORDETAIL: Management-Daten konnten nicht geladen werden:', error);
        this.managements = [];
        return;
      }

      this.managements = (data || [])
        .filter(item => item.management)
        .map(item => item.management);

      console.log(`✅ CREATORDETAIL: ${this.managements.length} Management(s) geladen`);
    } catch (e) {
      console.warn('⚠️ CREATORDETAIL: Fehler beim Laden der Managements:', e);
      this.managements = [];
    }
};

CreatorDetail.prototype.updateManagementTab = function() {
    const container = document.querySelector('#tab-management');
    if (container) {
      container.innerHTML = this.renderManagementContent();
      const btn = document.querySelector('.tab-button[data-tab="management"] .tab-count');
      if (btn) btn.textContent = String(this.managements?.length || 0);
    }
};
