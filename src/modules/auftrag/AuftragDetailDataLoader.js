// AuftragDetailDataLoader.js
// Kritische Daten: Auftrag, Creator, Team, Details, Kampagnen, Kooperationen und Videos
// (Prototype-Mixin von AuftragDetail)

import { AuftragDetail } from './AuftragDetailCore.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { summeKskSelbstzahler } from '../../core/budget/kskSelbstzahler.js';

Object.assign(AuftragDetail.prototype, {
  // Lade kritische Daten parallel
  async loadCriticalData() {
    console.log('🔄 AUFTRAGDETAIL: Lade kritische Daten parallel...');
    const startTime = performance.now();
    
    try {
      // Alle kritischen Daten PARALLEL laden
      const [
        auftragResult,
        creatorResult,
        mitarbeiterResult,
        cutterResult,
        copywriterResult,
        auftragsDetailsResult,
        artDerKampagneResult
      ] = await parallelLoad([
        // 1. Auftrags-Basisdaten mit Relations
        () => window.supabase
          .from('auftrag')
          .select(`
            *,
            marke:marke_id(markenname),
            unternehmen:unternehmen_id(firmenname)
          `)
          .eq('id', this.auftragId)
          .single(),
        
        // 2. Creator
        () => window.supabase
          .from('creator_auftrag')
          .select(`creator:creator_id(*)`)
          .eq('auftrag_id', this.auftragId),
        
        // 3. Mitarbeiter
        () => window.supabase
          .from('auftrag_mitarbeiter')
          .select('mitarbeiter_id')
          .eq('auftrag_id', this.auftragId),
        
        // 4. Cutter
        () => window.supabase
          .from('auftrag_cutter')
          .select('mitarbeiter_id')
          .eq('auftrag_id', this.auftragId),
        
        // 5. Copywriter
        () => window.supabase
          .from('auftrag_copywriter')
          .select('mitarbeiter_id')
          .eq('auftrag_id', this.auftragId),
        
        // 6. Auftragsdetails
        () => window.supabase
          .from('auftrag_details')
          .select('*')
          .eq('auftrag_id', this.auftragId)
          .maybeSingle(),
        
        // 7. Art der Kampagne aus Junction-Table
        () => window.supabase
          .from('auftrag_kampagne_art')
          .select('kampagne_art_id')
          .eq('auftrag_id', this.auftragId)
      ]);
      
      // Daten verarbeiten
      if (auftragResult.error) throw auftragResult.error;
      this.auftrag = auftragResult.data;
      
      // Creator verarbeiten
      if (!creatorResult.error) {
        this.creator = creatorResult.data?.map(item => item.creator) || [];
      }
      
      // Mitarbeiter-IDs sammeln und parallel laden
      const mitarbeiterIds = mitarbeiterResult.data?.map(item => item.mitarbeiter_id).filter(Boolean) || [];
      const cutterIds = cutterResult.data?.map(item => item.mitarbeiter_id).filter(Boolean) || [];
      const copywriterIds = copywriterResult.data?.map(item => item.mitarbeiter_id).filter(Boolean) || [];
      
      // Alle Benutzer-IDs sammeln (unique)
      const allIds = [...new Set([...mitarbeiterIds, ...cutterIds, ...copywriterIds])];
      
      // Benutzer parallel laden
      if (allIds.length > 0) {
        const { data: benutzerData } = await window.supabase
          .from('benutzer')
          .select('id, name')
          .in('id', allIds);
        
        const benutzerMap = (benutzerData || []).reduce((acc, b) => { acc[b.id] = b; return acc; }, {});
        
        this.auftrag.mitarbeiter = mitarbeiterIds.map(id => benutzerMap[id]).filter(Boolean);
        this.auftrag.cutter = cutterIds.map(id => benutzerMap[id]).filter(Boolean);
        this.auftrag.copywriter = copywriterIds.map(id => benutzerMap[id]).filter(Boolean);
      } else {
        this.auftrag.mitarbeiter = [];
        this.auftrag.cutter = [];
        this.auftrag.copywriter = [];
      }
      
      // Ansprechpartner laden (falls vorhanden)
      if (this.auftrag.ansprechpartner_id) {
        try {
          const { data: ansprechpartnerData } = await window.supabase
            .from('ansprechpartner')
            .select('id, vorname, nachname, email')
            .eq('id', this.auftrag.ansprechpartner_id)
            .single();
          
          if (ansprechpartnerData) {
            this.auftrag.ansprechpartner = ansprechpartnerData;
          }
        } catch (e) {
          console.warn('⚠️ AUFTRAGDETAIL: Fehler beim Laden des Ansprechpartners:', e);
        }
      }
      
      // Auftragsdetails verarbeiten
      if (!auftragsDetailsResult.error) {
        this.auftragsDetails = auftragsDetailsResult.data;
      } else {
        this.auftragsDetails = null;
      }

      // Teilrechnungen laden (Zahlungsstand sitzt an der Teilrechnung,
      // sobald welche existieren — der Kopf ist dann kein Zahlungsstand mehr)
      const { data: teilrechnungen } = await window.supabase
        .from('auftrag_teilrechnung')
        .select('id, position, ueberwiesen, ueberwiesen_am')
        .eq('auftrag_id', this.auftragId)
        .order('position', { ascending: true });
      this.teilrechnungen = teilrechnungen || [];
      
      // Art der Kampagne verarbeiten (aus Junction-Table) und Namen laden
      if (!artDerKampagneResult.error && artDerKampagneResult.data) {
        const kampagneArtIds = artDerKampagneResult.data.map(item => item.kampagne_art_id).filter(Boolean);
        this.auftrag.art_der_kampagne = kampagneArtIds;
        
        // Namen der Kampagnenarten laden
        if (kampagneArtIds.length > 0) {
          const { data: kampagneArtTypen } = await window.supabase
            .from('kampagne_art_typen')
            .select('id, name')
            .in('id', kampagneArtIds);
          
          this.auftrag.art_der_kampagne_namen = (kampagneArtTypen || []).map(t => t.name);
          console.log('🎨 AUFTRAGDETAIL: art_der_kampagne_namen geladen:', this.auftrag.art_der_kampagne_namen);
        } else {
          this.auftrag.art_der_kampagne_namen = [];
        }
        
        console.log('🎨 AUFTRAGDETAIL: art_der_kampagne IDs geladen:', this.auftrag.art_der_kampagne);
      } else {
        this.auftrag.art_der_kampagne = [];
        this.auftrag.art_der_kampagne_namen = [];
      }
      
      // Lade Kooperationen und Videos für Budget-Anzeige
      await this.loadKooperationenVideos();
      
      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ AUFTRAGDETAIL: Kritische Daten geladen in ${loadTime}ms`);
      
    } catch (error) {
      console.error('❌ AUFTRAGDETAIL: Fehler beim Laden der kritischen Daten:', error);
      throw error;
    }
  },

  // Lade Kooperationen und Videos für Budget-Anzeige
  async loadKooperationenVideos() {
    try {
      // Lade alle Kampagnen des Auftrags
      const { data: kampagnen } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, videoanzahl, creatoranzahl')
        .eq('auftrag_id', this.auftragId);
      
      this.kampagnen = kampagnen || [];
      this.targetVideoCount = this.kampagnen.reduce((sum, k) => sum + (k.videoanzahl || 0), 0);
      this.targetCreatorCount = this.kampagnen.reduce((sum, k) => sum + (k.creatoranzahl || 0), 0);
      const kampagneIds = this.kampagnen.map(k => k.id);
      
      if (kampagneIds.length === 0) {
        this.kooperationen = [];
        this.videos = [];
        this.realVideoCount = 0;
        this.realCreatorCount = 0;
        this.usedBudget = 0;
        this.usedVideoCount = 0;
        return;
      }
      
      // Lade alle Kooperationen der Kampagnen
      const { data: kooperationen } = await window.supabase
        .from('kooperationen')
        .select(`
          id,
          name,
          typ,
          videoanzahl,
          einkaufspreis_netto,
          verkaufspreis_netto,
          einkaufspreis_gesamt,
          ksk_selbstzahler,
          ksk_betrag,
          kampagne_id,
          creator:creator_id (
            id,
            vorname,
            nachname
          )
        `)
        .in('kampagne_id', kampagneIds)
        .order('created_at', { ascending: false });
      
      this.kooperationen = (kooperationen || []).map(koop => ({
        ...koop,
        kampagne: this.kampagnen.find(k => k.id === koop.kampagne_id)
      }));
      
      // Lade Videos + Rechnungsstatus für alle Kooperationen
      if (this.kooperationen.length > 0) {
        const koopIds = this.kooperationen.map(k => k.id);
        const { data: videoData } = await window.supabase
          .from('kooperation_videos')
          .select('id, titel, thema, content_art, kooperation_id, asset_url, link_content, einkaufspreis_netto, verkaufspreis_netto')
          .in('kooperation_id', koopIds);
        
        this.videos = videoData || [];
      } else {
        this.videos = [];
      }
      
      // Berechne realVideoCount und realCreatorCount
      this.realVideoCount = this.videos.length;
      
      // Anzahl einzigartiger Creator
      const uniqueCreatorIds = new Set();
      this.kooperationen.forEach(koop => {
        if (koop.creator?.id) {
          uniqueCreatorIds.add(koop.creator.id);
        }
      });
      this.realCreatorCount = uniqueCreatorIds.size;
      
      // EK-Verbrauch inkl. KSK-Selbstzahler-Aufschlaege
      this.usedBudget = this.kooperationen.reduce((sum, koop) => sum + (parseFloat(koop.einkaufspreis_netto) || 0), 0)
        + summeKskSelbstzahler(this.kooperationen);
      this.usedVideoCount = this.kooperationen.reduce((sum, koop) => sum + (parseInt(koop.videoanzahl, 10) || 0), 0);
      
      console.log(`✅ AUFTRAGDETAIL: ${this.kooperationen.length} Kooperationen, ${this.realCreatorCount} Creator und ${this.realVideoCount} Videos geladen`);
    } catch (error) {
      console.error('❌ AUFTRAGDETAIL: Fehler beim Laden von Kooperationen/Videos:', error);
      this.kooperationen = [];
      this.videos = [];
      this.realVideoCount = 0;
      this.realCreatorCount = 0;
      this.usedBudget = 0;
      this.usedVideoCount = 0;
      this.targetVideoCount = 0;
      this.targetCreatorCount = 0;
    }
  },
});
