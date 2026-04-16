// KampagneListDataLoader.js
// Daten-Laden für KampagneList: Supabase-Queries, Permissions, Formatierung

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { KampagneFilterLogic } from './filters/KampagneFilterLogic.js';
import { KampagneUtils } from './KampagneUtils.js';
import { kampagnenCache, debugLog } from './KampagneListUtils.js';

/**
 * Lädt Kampagnen mit allen Relationen (Supabase-optimiert mit Pagination).
 * Gibt { data, count, statusOptions, kampagneArtMap } zurück.
 */
export async function loadKampagnenWithRelations(page = 1, limit = 25, { searchQuery = '' } = {}) {
  const startTime = performance.now();
  
  try {
    if (!window.supabase) {
      console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
      const data = await window.dataService.loadEntities('kampagne');
      return { data, count: data.length, kampagneArtMap: new Map() };
    }
    
    // Cache-Check: Prüfe ob Daten im Cache sind
    const activeFilters = filterSystem.getFilters('kampagne');
    
    // Suchbegriff VOR Cache-Key hinzufügen, damit der Cache
    // unterschiedliche Suchergebnisse korrekt unterscheidet
    if (searchQuery) {
      activeFilters.kampagnenname = searchQuery;
    }
    
    const cacheKey = JSON.stringify({ ...activeFilters, _page: page, _limit: limit });
    const cachedData = kampagnenCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const [artResult, allowedIds] = await Promise.all([
      window.supabase
        .from('kampagne_art_typen')
        .select('id, name'),
      
      KampagneUtils.loadAllowedKampagneIds()
    ]);
    
    const kampagneArtMap = new Map((artResult.data || []).map(r => [r.id, r.name]));
    
    // Permissions verarbeiten: null = keine Filterung, [] = kein Zugriff, [...ids] = gefiltert
    if (allowedIds !== null && allowedIds.length === 0) {
      return { data: [], count: 0, kampagneArtMap };
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = window.supabase
      .from('kampagne')
      .select(`
        id,
        kampagnenname,
        eigener_name,
        start,
        deadline_strategie,
        deadline_creator_sourcing,
        deadline_video_produktion,
        deadline_post_produktion,
        creatoranzahl,
        videoanzahl,
        art_der_kampagne,
        kampagne_typ,
        created_at,
        unternehmen_id,
        marke_id,
        auftrag_id,
        unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url),
        marke:marke_id(id, markenname, logo_url),
        auftrag:auftrag_id(id, auftragsname, creator_budget, gesamt_budget, bruttobetrag, nettobetrag)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    // Permission-Filterung anwenden (nur wenn allowedIds ein Array ist)
    if (allowedIds !== null && allowedIds.length > 0) {
      query = query.in('id', allowedIds);
    }

    // Filter aus FilterSystem anwenden
    debugLog('🔍 KAMPAGNELIST: Wende Filter an:', activeFilters);
    query = KampagneFilterLogic.buildSupabaseQuery(query, activeFilters);

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Fehler beim Laden der Kampagnen mit Beziehungen:', error);
      throw error;
    }

    // Daten für Kompatibilität formatieren
    const formattedData = data.map(k => {
      const arr = Array.isArray(k.art_der_kampagne) ? k.art_der_kampagne : [];
      const artDisplay = arr.map(v => {
        const fullName = kampagneArtMap.get(v) || v;
        return fullName.replace(/[-\s]Kampagne[n]?$/i, '');
      });
      return {
        ...k,
        art_der_kampagne_display: artDisplay,
        unternehmen: k.unternehmen ? { 
          id: k.unternehmen.id, 
          firmenname: k.unternehmen.firmenname, 
          logo_url: k.unternehmen.logo_url 
        } : null,
        marke: k.marke ? { 
          id: k.marke.id, 
          markenname: k.marke.markenname, 
          logo_url: k.marke.logo_url 
        } : null,
        auftrag: k.auftrag ? { 
          auftragsname: k.auftrag.auftragsname,
          details_id: k.auftrag.auftrag_details?.[0]?.id || null,
          creator_budget: k.auftrag.creator_budget,
          gesamt_budget: k.auftrag.gesamt_budget,
          bruttobetrag: k.auftrag.bruttobetrag,
          nettobetrag: k.auftrag.nettobetrag
        } : null
      };
    });

    // Lade Many-to-Many Beziehungen (z.B. Ansprechpartner) über DataService
    const entityConfig = window.dataService.entities.kampagne;
    if (entityConfig.manyToMany) {
      await window.dataService.loadManyToManyRelations(formattedData, 'kampagne', entityConfig.manyToMany);
    }

    // Lade alle Mitarbeiter für die geladenen Kampagnen über die aggregierte View
    const kampagneIds = formattedData.map(k => k.id).filter(Boolean);
    let mitarbeiterByKampagne = {};

    if (kampagneIds.length > 0) {
      const { data: mitarbeiterData, error: mitarbeiterError } = await window.supabase
        .from('v_kampagne_mitarbeiter_aggregated')
        .select('kampagne_id, mitarbeiter_id, name, rolle, profile_image_url, zuordnungsart')
        .in('kampagne_id', kampagneIds);
      
      if (!mitarbeiterError && mitarbeiterData) {
        mitarbeiterData.forEach(m => {
          if (!mitarbeiterByKampagne[m.kampagne_id]) {
            mitarbeiterByKampagne[m.kampagne_id] = [];
          }
          mitarbeiterByKampagne[m.kampagne_id].push({
            id: m.mitarbeiter_id,
            name: m.name,
            rolle: m.rolle,
            profile_image_url: m.profile_image_url,
            zuordnungsart: m.zuordnungsart
          });
        });
        debugLog('✅ KAMPAGNELIST: Mitarbeiter geladen für', Object.keys(mitarbeiterByKampagne).length, 'Kampagnen');
      } else if (mitarbeiterError) {
        console.error('❌ Fehler beim Laden der Mitarbeiter:', mitarbeiterError);
      }
    }

    // Budget-Verbrauch pro Kampagne aggregieren
    let budgetUsedMap = {};
    if (kampagneIds.length > 0) {
      const { data: koopData } = await window.supabase
        .from('kooperationen')
        .select('kampagne_id, kooperation_videos(verkaufspreis_netto)')
        .in('kampagne_id', kampagneIds);

      (koopData || []).forEach(koop => {
        const sum = (koop.kooperation_videos || [])
          .reduce((s, v) => s + (parseFloat(v.verkaufspreis_netto) || 0), 0);
        budgetUsedMap[koop.kampagne_id] = (budgetUsedMap[koop.kampagne_id] || 0) + sum;
      });
    }

    // Füge Mitarbeiter + Budget zu den formatierten Daten hinzu
    formattedData.forEach(kampagne => {
      if (!kampagne.mitarbeiter || kampagne.mitarbeiter.length === 0) {
        kampagne.mitarbeiter = mitarbeiterByKampagne[kampagne.id] || [];
      }
      kampagne._budgetUsed = budgetUsedMap[kampagne.id] || 0;
      kampagne._budgetTotal = parseFloat(
        kampagne.auftrag?.creator_budget ||
        kampagne.auftrag?.gesamt_budget ||
        kampagne.auftrag?.bruttobetrag ||
        kampagne.auftrag?.nettobetrag || 0
      );
    });

    // Virtual Filter anwenden (z.B. creator_count, duration)
    const filtered = KampagneFilterLogic.applyVirtualFilters(formattedData, activeFilters);

    const loadTime = (performance.now() - startTime).toFixed(0);
    debugLog(`✅ KAMPAGNELIST: ${filtered.length} Kampagnen geladen (von ${formattedData.length} nach Filter) in ${loadTime}ms`);
    
    const result = { data: filtered, count: count || filtered.length, kampagneArtMap };
    kampagnenCache.set(result, cacheKey);
    
    return result;

  } catch (error) {
    console.error('❌ Fehler beim Laden der Kampagnen mit Beziehungen:', error);
    const data = await window.dataService.loadEntities('kampagne');
    return { data, count: data.length, kampagneArtMap: new Map() };
  }
}

/**
 * @deprecated Nutze stattdessen KampagneUtils.loadAllowedKampagneIds()
 */
export async function loadUserPermissions() {
  console.warn('⚠️ loadUserPermissions() ist deprecated - nutze KampagneUtils.loadAllowedKampagneIds()');
  const ids = await KampagneUtils.loadAllowedKampagneIds();
  return { data: ids || [] };
}
