// AuftragListDataLoader.js
// Data-Loading Methoden fuer AuftragList (Prototype-Mixin)

import { AuftragList } from './AuftragListCore.js';
import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { AuftragFilterLogic } from './filters/AuftragFilterLogic.js';

AuftragList.prototype.refreshInactiveTabCount = async function() {
  if (!window.canViewContracts?.() || !window.supabase) return;
  try {
    const inactiveTab = this.activeTab === 'contracts' ? 'auftraege' : 'contracts';
    let query = window.supabase
      .from('auftrag')
      .select('*', { count: 'estimated', head: true });

    if (inactiveTab === 'contracts') {
      query = query.eq('auftragtype', 'Contracting');
    } else {
      query = query.neq('auftragtype', 'Contracting');
    }

    const { count } = await query;
    this.updateTabCount(inactiveTab, count || 0);
  } catch (error) {
    console.warn('⚠️ Tab-Count fuer inaktiven Tab konnte nicht geladen werden:', error);
  }
};

AuftragList.prototype.loadAuftraegeData = async function() {
  const filters = filterSystem.getFilters('auftrag');

  if (this.searchQuery && this.searchQuery.trim().length > 0) {
    filters.auftragsname = this.searchQuery.trim();
  }

  const { data: auftraege, count } = await this.loadAuftraegeWithPagination(
    filters,
    this.pagination.currentPage,
    this.pagination.itemsPerPage,
    'auftraege'
  );

  this.pagination.updateTotal(count);
  await this.updateTable(auftraege, 'auftraege');
  this.pagination.render();
  this.updateTabCount('auftraege', count);
};

AuftragList.prototype.loadContractsData = async function() {
  try {
    const filters = {};
    if (this.searchQuery && this.searchQuery.trim().length > 0) {
      filters.auftragsname = this.searchQuery.trim();
    }

    const { data, count } = await this.loadAuftraegeWithPagination(
      filters,
      this.contractsPagination.currentPage,
      this.contractsPagination.itemsPerPage,
      'contracts'
    );

    this.contractsPagination.updateTotal(count);
    await this.updateTable(data, 'contracts');
    this.contractsPagination.render();
    this.updateTabCount('contracts', count);
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.error('❌ AuftragList.loadContractsData:', error);
  }
};

AuftragList.prototype.loadAuftraegeWithPagination = async function(filters = {}, page = 1, limit = 25, mode = 'auftraege') {
  try {
    if (!window.supabase) {
      const mockData = await window.dataService.loadEntities('auftrag');
      return { data: mockData, count: mockData.length };
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // count: 'estimated' nutzt Postgres-Statistiken statt Full-Scan
    let query = window.supabase
      .from('auftrag')
      .select(`
        id,
        auftragsname,
        auftragtype,
        angebotsnummer,
        status,
        po,
        externe_po,
        re_nr,
        re_faelligkeit,
        zahlungsziel_tage,
        start,
        ende,
        nettobetrag,
        ust_betrag,
        bruttobetrag,
        rechnung_gestellt,
        rechnung_gestellt_am,
        ueberwiesen,
        ueberwiesen_am,
        created_by_id,
        created_at,
        unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url, logo_thumb_url),
        marke:marke_id(id, markenname, logo_url, logo_thumb_url),
        ansprechpartner:ansprechpartner_id(id, vorname, nachname, email, profile_image_url, profile_image_thumb_url),
        created_by:created_by_id(id, name, profile_image_url, profile_image_thumb_url),
        auftrag_details(id),
        kampagne_arten:auftrag_kampagne_art(art:kampagne_art_id(id, name))
      `, { count: 'estimated' });

    if (mode === 'contracts') {
      query = query.eq('auftragtype', 'Contracting');
    } else {
      query = query.neq('auftragtype', 'Contracting');
    }

    if (filters.auftragsname) {
      const search = filters.auftragsname;
      const [{ data: matchU }, { data: matchM }] = await Promise.all([
        window.supabase.from('unternehmen').select('id').ilike('firmenname', `%${search}%`),
        window.supabase.from('marke').select('id').ilike('markenname', `%${search}%`)
      ]);
      const orParts = [`auftragsname.ilike.%${search}%`];
      if (matchU?.length) orParts.push(`unternehmen_id.in.(${matchU.map(u => u.id).join(',')})`);
      if (matchM?.length) orParts.push(`marke_id.in.(${matchM.map(m => m.id).join(',')})`);
      query = query.or(orParts.join(','));
      delete filters.auftragsname;
    }

    query = AuftragFilterLogic.buildSupabaseQuery(query, filters);

    query = query
      .order('created_at', { ascending: false })
      .order('angebotsnummer', { ascending: false, nullsFirst: false })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Fehler beim Laden der Aufträge:', error);
      throw error;
    }

    const createdByFallbacks = await this.loadCreatedByFallbacks(data || []);

    const formattedData = (data || []).map(auftrag => {
      const details = auftrag.auftrag_details;
      const detailsId = Array.isArray(details) ? details[0]?.id : details?.id;

      return {
        ...auftrag,
        has_auftragsdetails: Boolean(detailsId),
        auftragsdetails_id: detailsId || null,
        created_by: auftrag.created_by || createdByFallbacks.get(auftrag.created_by_id) || null,
        unternehmen: auftrag.unternehmen ? {
          id: auftrag.unternehmen.id,
          firmenname: auftrag.unternehmen.firmenname,
          internes_kuerzel: auftrag.unternehmen.internes_kuerzel,
          logo_url: auftrag.unternehmen.logo_url,
          logo_thumb_url: auftrag.unternehmen.logo_thumb_url
        } : null,
        marke: auftrag.marke ? {
          id: auftrag.marke.id,
          markenname: auftrag.marke.markenname,
          logo_url: auftrag.marke.logo_url,
          logo_thumb_url: auftrag.marke.logo_thumb_url
        } : null,
        art_der_kampagne: (auftrag.kampagne_arten || [])
          .map(ka => ka.art?.name)
          .filter(Boolean)
      };
    });

    return { data: formattedData, count: count || 0 };

  } catch (error) {
    console.error('❌ Fehler beim Laden der Aufträge:', error);
    throw error;
  }
};

AuftragList.prototype.loadCreatedByFallbacks = async function(auftraege) {
  const missingIds = [...new Set((auftraege || [])
    .filter(auftrag => auftrag.created_by_id && !auftrag.created_by?.name)
    .map(auftrag => auftrag.created_by_id))];

  if (missingIds.length === 0 || !window.supabase) {
    return new Map();
  }

  const fields = 'id, auth_user_id, name, profile_image_url, profile_image_thumb_url';

  try {
    const [{ data: byBenutzerId }, { data: byAuthUserId }] = await Promise.all([
      window.supabase.from('benutzer').select(fields).in('id', missingIds),
      window.supabase.from('benutzer').select(fields).in('auth_user_id', missingIds)
    ]);

    const usersByCreatedById = new Map();
    (byBenutzerId || []).forEach(user => usersByCreatedById.set(user.id, user));
    (byAuthUserId || []).forEach(user => usersByCreatedById.set(user.auth_user_id, user));
    return usersByCreatedById;
  } catch (error) {
    console.warn('⚠️ Erstellt-von-Fallback konnte nicht geladen werden:', error);
    return new Map();
  }
};

AuftragList.prototype.initializeFilterBar = async function() {
  if (this.isKunde) return;
  const filterContainer = document.getElementById('filter-dropdown-container');
  if (filterContainer) {
    await filterDropdown.init('auftrag', filterContainer, {
      onFilterApply: (filters) => this.onFiltersApplied(filters),
      onFilterReset: () => this.onFiltersReset()
    });
  }
};

AuftragList.prototype.onFiltersApplied = function(filters) {
  filterSystem.applyFilters('auftrag', filters);
  this.pagination.reset();
  this.loadAndRender();
};

AuftragList.prototype.onFiltersReset = function() {
  filterSystem.resetFilters('auftrag');
  this.pagination.reset();
  this.loadAndRender();
};

AuftragList.prototype.handleSearch = function(query) {
  if (this._searchDebounceTimer) {
    clearTimeout(this._searchDebounceTimer);
  }

  this._searchDebounceTimer = setTimeout(() => {
    this.searchQuery = query.trim();
    if (this.activeTab === 'contracts') {
      this.contractsPagination.reset();
      this.loadContractsData();
    } else {
      this.pagination.reset();
      this.loadAuftraegeData();
    }
  }, 300);
};
