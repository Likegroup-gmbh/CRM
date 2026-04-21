// KampagneListDataLoader.js
// Daten-Laden für KampagneList via Supabase RPC (single-roundtrip)

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { KampagneFilterLogic } from './filters/KampagneFilterLogic.js';
import { debugLog } from './KampagneListUtils.js';

/**
 * Konvertiert UI-Filter in das JSONB-Format der get_kampagnen_list RPC.
 */
function buildRpcFilters(activeFilters) {
  const rpcFilters = {};

  for (const [key, value] of Object.entries(activeFilters)) {
    if (!value) continue;

    switch (key) {
      case 'kampagnenname':
        // Suche wird separat als p_search übergeben, nicht als Filter
        break;

      case 'unternehmen_id':
        rpcFilters.unternehmen_id = value;
        break;

      case 'marke_id':
        rpcFilters.marke_id = value;
        break;

      case 'art_der_kampagne':
        if (Array.isArray(value) && value.length > 0) {
          rpcFilters.art_der_kampagne = value;
        }
        break;

      case 'start':
        if (typeof value === 'object') {
          if (value.from) rpcFilters.start_from = value.from;
          if (value.to) rpcFilters.start_to = value.to;
        }
        break;

      case 'deadline_post_produktion':
        if (typeof value === 'object') {
          if (value.from) rpcFilters.deadline_from = value.from;
          if (value.to) rpcFilters.deadline_to = value.to;
        }
        break;

      case 'has_briefing':
        rpcFilters.has_briefing = !!value;
        break;

      case 'is_overdue':
        rpcFilters.is_overdue = !!value;
        break;

      // Virtual filters (creator_count, duration_days, is_completed) are applied client-side
    }
  }

  return rpcFilters;
}

/**
 * Lädt Kampagnen mit allen Relationen über eine einzige RPC.
 * Gibt { data, count, kampagneArtMap } zurück.
 */
export async function loadKampagnenWithRelations(page = 1, limit = 25, { searchQuery = '' } = {}) {
  const startTime = performance.now();

  try {
    if (!window.supabase) {
      console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
      const data = await window.dataService.loadEntities('kampagne');
      return { data, count: data.length, kampagneArtMap: new Map() };
    }

    const activeFilters = filterSystem.getFilters('kampagne');

    const rpcFilters = buildRpcFilters(activeFilters);
    const searchParam = searchQuery || activeFilters.kampagnenname || null;

    debugLog('🔍 KAMPAGNELIST: RPC-Call mit filters:', rpcFilters, 'search:', searchParam);

    const { data: result, error } = await window.supabase.rpc('get_kampagnen_list', {
      p_page: page,
      p_limit: limit,
      p_search: searchParam,
      p_filters: rpcFilters
    });

    if (error) {
      console.error('❌ Fehler beim RPC get_kampagnen_list:', error);
      throw error;
    }

    const rows = result?.rows || [];
    const totalCount = result?.total_count || 0;

    // art_der_kampagne Typ-Map: zuerst aus RPC-Result, dann aus FilterSystem-Cache,
    // zuletzt Fallback auf separaten DB-Call (nur wenn beides leer)
    const kampagneArtMap = new Map();
    const artTypen = result?.art_typen;
    if (artTypen) {
      artTypen.forEach(t => kampagneArtMap.set(t.id, t.name));
    }

    if (kampagneArtMap.size === 0) {
      const cached = filterSystem.getDynamicFilterData('kampagne')?.art_typen;
      if (cached && cached.length > 0) {
        cached.forEach(t => kampagneArtMap.set(t.value ?? t.id, t.label ?? t.name));
      }
    }

    if (kampagneArtMap.size === 0) {
      const { data: artData } = await window.supabase
        .from('kampagne_art_typen')
        .select('id, name');
      (artData || []).forEach(r => kampagneArtMap.set(r.id, r.name));
    }

    // Daten für Kompatibilität mit bestehendem Renderer formatieren
    const formattedData = rows.map(k => {
      const arr = Array.isArray(k.art_der_kampagne) ? k.art_der_kampagne : [];
      const artDisplay = arr.map(v => {
        const fullName = kampagneArtMap.get(v) || v;
        return fullName.replace(/[-\s]Kampagne[n]?$/i, '');
      });
      return {
        ...k,
        art_der_kampagne_display: artDisplay,
        unternehmen: k.unternehmen || null,
        marke: k.marke || null,
        auftrag: k.auftrag ? {
          auftragsname: k.auftrag.auftragsname,
          details_id: null,
          creator_budget: k.auftrag.creator_budget,
          gesamt_budget: k.auftrag.gesamt_budget,
          bruttobetrag: k.auftrag.bruttobetrag,
          nettobetrag: k.auftrag.nettobetrag
        } : null,
        mitarbeiter: k.mitarbeiter || [],
        ansprechpartner: k.ansprechpartner || [],
        _budgetUsed: parseFloat(k._budgetUsed) || 0,
        _budgetTotal: parseFloat(k._budgetTotal) || 0
      };
    });

    // Virtual Filter client-seitig anwenden (creator_count, duration_days, is_completed)
    const filtered = KampagneFilterLogic.applyVirtualFilters(formattedData, activeFilters);

    const loadTime = (performance.now() - startTime).toFixed(0);
    debugLog(`✅ KAMPAGNELIST: ${filtered.length} Kampagnen geladen in ${loadTime}ms (RPC single-roundtrip)`);

    return { data: filtered, count: totalCount, kampagneArtMap };

  } catch (error) {
    console.error('❌ Fehler beim Laden der Kampagnen:', error);
    const data = await window.dataService.loadEntities('kampagne');
    return { data, count: data.length, kampagneArtMap: new Map() };
  }
}

/**
 * @deprecated Nutze stattdessen RLS für Permission-Filterung
 */
export async function loadUserPermissions() {
  console.warn('⚠️ loadUserPermissions() ist deprecated - RLS filtert automatisch');
  return { data: [] };
}
