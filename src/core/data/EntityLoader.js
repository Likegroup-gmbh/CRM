import { EntityRegistry } from './entities/index.js';
import { getMockData, getMockFilterData } from './MockProvider.js';

export class EntityLoader {
  constructor({ filterApplier, relationManager }) {
    this.entities = EntityRegistry;
    this.filterApplier = filterApplier;
    this.relationManager = relationManager;
  }

  async loadEntities(entityType, filters = {}) {
    try {
      if (!window.supabase || !window.supabase.auth) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        
        // Versuche Mock-Daten aus localStorage zu laden
        const mockData = JSON.parse(localStorage.getItem('mock_data') || '{}');
        if (mockData[entityType] && mockData[entityType].length > 0) {
          console.log(`✅ Mock-Daten für ${entityType} geladen:`, mockData[entityType]);
          return mockData[entityType];
        }
        
        // Fallback zu Standard-Mock-Daten
        return getMockData(entityType);
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

                  // Spezielle Behandlung für Entitäten mit Beziehungen
            let query;
            if (entityType === 'marke') {
              query = window.supabase
                .from(entityConfig.table)
                .select(`
                  *,
                  unternehmen:unternehmen_id (
                    id,
                    firmenname,
                    logo_url
                  )
                `)
                .order('created_at', { ascending: false });

              // Spezielle Filter auf Junction-Tabellen anwenden (Branchen)
              try {
                const getIdFromFilter = (val) => {
                  if (val == null) return null;
                  if (typeof val === 'string') return val;
                  if (typeof val === 'object') {
                    return val.value || val.id || null;
                  }
                  return String(val);
                };
                
                // Branche-Filter
                if (filters && filters.branche_id) {
                  const selectedId = getIdFromFilter(filters.branche_id);
                  console.log('🔍 Filtere Marken nach Branche:', selectedId);
                  
                  const { data: links, error: lerr } = await window.supabase
                    .from('marke_branchen')
                    .select('marke_id')
                    .eq('branche_id', selectedId);
                  
                  if (lerr) {
                    console.error('❌ Fehler beim Laden der Marken-Branchen-Verknüpfungen:', lerr);
                  } else {
                    const markeIds = (links || []).map(r => r.marke_id).filter(Boolean);
                    console.log(`✅ ${markeIds.length} Marken mit Branche ${selectedId} gefunden`);
                    
                    if (markeIds.length === 0) {
                      // Keine Marken mit dieser Branche gefunden
                      return [];
                    }
                    
                    query = query.in('id', markeIds);
                  }
                  
                  // Entferne den Filter aus filters, damit er nicht nochmal angewendet wird
                  delete filters.branche_id;
                }
              } catch (e) {
                console.warn('⚠️ Konnte Marken-Junction-Filter nicht anwenden:', e);
              }
            } else if (entityType === 'creator') {
              // Creator ohne alte FK-Joins (M:N wird separat geladen)
              query = window.supabase
                .from(entityConfig.table)
                .select('*')
                .order('created_at', { ascending: false });

              // Spezielle Filter auf Junction-Tabellen anwenden
              try {
                let idSets = [];
                const getIdFromFilter = (val) => {
                  if (val == null) return null;
                  if (typeof val === 'string') return val;
                  if (typeof val === 'object') {
                    return val.value || val.id || null;
                  }
                  return String(val);
                };
                // Sprache
                if (filters && filters.sprache_id) {
                  const selectedId = getIdFromFilter(filters.sprache_id);
                  const { data: links, error: lerr } = await window.supabase
                    .from('creator_sprachen')
                    .select('creator_id')
                    .eq('sprache_id', selectedId);
                  if (!lerr) {
                    idSets.push(new Set((links || []).map(r => r.creator_id)));
                  }
                  delete filters.sprache_id;
                }
                // Branche
                if (filters && (filters.branche_id || filters.branche)) {
                  const selectedId = getIdFromFilter(filters.branche_id || filters.branche);
                  const { data: links, error: lerr } = await window.supabase
                    .from('creator_branchen')
                    .select('creator_id')
                    .eq('branche_id', selectedId);
                  if (!lerr) {
                    idSets.push(new Set((links || []).map(r => r.creator_id)));
                  }
                  delete filters.branche_id;
                  delete filters.branche;
                }
                // Creator-Typ
                if (filters && filters.creator_type_id) {
                  const selectedId = getIdFromFilter(filters.creator_type_id);
                  const { data: links, error: lerr } = await window.supabase
                    .from('creator_creator_type')
                    .select('creator_id')
                    .eq('creator_type_id', selectedId);
                  if (!lerr) {
                    idSets.push(new Set((links || []).map(r => r.creator_id)));
                  }
                  delete filters.creator_type_id;
                }
                // Schnittmenge bilden
                if (idSets.length > 0) {
                  let intersection = idSets[0];
                  for (let i = 1; i < idSets.length; i++) {
                    intersection = new Set([...intersection].filter(x => idSets[i].has(x)));
                  }
                  const ids = [...intersection];
                  if (ids.length === 0) {
                    return [];
                  }
                  query = query.in('id', ids);
                }
              } catch (e) {
                console.warn('⚠️ Konnte Creator-Junction-Filter nicht anwenden:', e);
              }
            } else if (entityType === 'ansprechpartner') {
              // Ansprechpartner mit JOINs für alle Beziehungen
              query = window.supabase
                .from(entityConfig.table)
                .select(`
                  *,
                  unternehmen:unternehmen_id (
                    id,
                    firmenname,
                    logo_url
                  ),
                  sprache:sprache_id (
                    id,
                    name
                  ),
                  positionen:position_id (
                    id,
                    name
                  ),
                  telefonnummer_land:eu_laender!telefonnummer_land_id (
                    id,
                    name,
                    name_de,
                    iso_code,
                    vorwahl
                  ),
                  telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (
                    id,
                    name,
                    name_de,
                    iso_code,
                    vorwahl
                  ),
                  ansprechpartner_unternehmen (
                    unternehmen:unternehmen_id (
                      id,
                      firmenname,
                      internes_kuerzel,
                      logo_url
                    )
                  ),
                  ansprechpartner_marke (
                    marke:marke_id (
                      id,
                      markenname,
                      logo_url
                    )
                  )
                `)
                .order('created_at', { ascending: false });

              // Spezial: Filter nach erlaubten Ansprechpartner-IDs (Mitarbeiter-Sichtbarkeit)
              if (filters && filters._allowedIds && Array.isArray(filters._allowedIds)) {
                query = query.in('id', filters._allowedIds);
                delete filters._allowedIds;
              }

              // Spezial: Filter nach Sprache über Junction-Tabelle (sprachen M:N)
              if (filters && filters.sprache_id) {
                const selectedLanguageId = String(filters.sprache_id);
                // 1) Hole alle ansprechpartner_ids für die gewählte Sprache
                const { data: apLangLinks, error: apLangErr } = await window.supabase
                  .from('ansprechpartner_sprache')
                  .select('ansprechpartner_id')
                  .eq('sprache_id', selectedLanguageId);
                if (apLangErr) {
                  console.error('❌ Fehler beim Laden der Sprach-Verknüpfungen:', apLangErr);
                }
                const apIds = (apLangLinks || []).map(r => r.ansprechpartner_id).filter(Boolean);
                // Wenn keine Treffer, direkt leere Ergebnismenge zurückgeben
                if (apIds.length === 0) {
                  return [];
                }
                // 2) Haupt-Query auf diese IDs einschränken
                query = query.in('id', apIds);
                // Entferne den Filter, damit applyFilters ihn nicht erneut auf FK anwendet
                delete filters.sprache_id;
              }
            } else if (entityType === 'rechnung') {
              // Rechnungen mit JOINs für Unternehmen und Auftrag
              query = window.supabase
                .from(entityConfig.table)
                .select(`
                  *,
                  unternehmen:unternehmen_id (
                    id,
                    firmenname
                  ),
                  auftrag:auftrag_id (
                    id,
                    auftragsname,
                    auftrag_details (id)
                  ),
                  creator:creator_id (
                    id,
                    vorname,
                    nachname
                  ),
                  kooperation:kooperation_id (
                    id,
                    name
                  ),
                  created_by:created_by_id (
                    id,
                    name,
                    profile_image_url
                  ),
                  vertrag:vertrag_id (
                    id,
                    name,
                    unterschriebener_vertrag_url,
                    dropbox_file_url,
                    datei_url
                  )
                `)
                .order('zahlungsziel', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: false });
            } else if (entityType === 'unternehmen') {
              // Unternehmen mit Many-to-Many JOIN für Branchen
              query = window.supabase
                .from(entityConfig.table)
                .select(`
                  *,
                  unternehmen_branchen (
                    branche_id,
                    branchen (
                      id,
                      name
                    )
                  )
                `)
                .order('created_at', { ascending: false });

              // Spezielle Filter auf Junction-Tabellen anwenden (Branchen)
              try {
                const getIdFromFilter = (val) => {
                  if (val == null) return null;
                  if (typeof val === 'string') return val;
                  if (typeof val === 'object') {
                    return val.value || val.id || null;
                  }
                  return String(val);
                };
                
                // Branche-Filter
                if (filters && filters.branche_id) {
                  const selectedId = getIdFromFilter(filters.branche_id);
                  console.log('🔍 Filtere Unternehmen nach Branche:', selectedId);
                  
                  const { data: links, error: lerr } = await window.supabase
                    .from('unternehmen_branchen')
                    .select('unternehmen_id')
                    .eq('branche_id', selectedId);
                  
                  if (lerr) {
                    console.error('❌ Fehler beim Laden der Branchen-Verknüpfungen:', lerr);
                  } else {
                    const unternehmenIds = (links || []).map(r => r.unternehmen_id).filter(Boolean);
                    console.log(`✅ ${unternehmenIds.length} Unternehmen mit Branche ${selectedId} gefunden`);
                    
                    if (unternehmenIds.length === 0) {
                      // Keine Unternehmen mit dieser Branche gefunden
                      return [];
                    }
                    
                    query = query.in('id', unternehmenIds);
                  }
                  
                  // Entferne den Filter aus filters, damit er nicht nochmal angewendet wird
                  delete filters.branche_id;
                }
              } catch (e) {
                console.warn('⚠️ Konnte Unternehmen-Junction-Filter nicht anwenden:', e);
              }
            } else if (entityType === 'auftragsdetails' || entityType === 'auftrag_details') {
              // Auftragsdetails: Standardquery mit Auftrag-Relation
              query = window.supabase
                .from('auftrag_details')
                .select(`
                  *,
                  auftrag:auftrag_id(id, auftragsname, unternehmen_id, marke_id)
                `)
                .order('created_at', { ascending: false });
              
              // Spezial-Behandlung für auftragsname und auftrag_id Filter
              try {
                // Filter nach Auftragsname (über Relation)
                if (filters && filters.auftragsname) {
                  const auftragsname = filters.auftragsname;
                  console.log('🔍 Filtere Auftragsdetails nach Auftragsname:', auftragsname);
                  
                  // Hole alle Aufträge mit diesem Namen
                  const { data: auftraege, error: aerr } = await window.supabase
                    .from('auftrag')
                    .select('id')
                    .eq('auftragsname', auftragsname);
                  
                  if (aerr) {
                    console.error('❌ Fehler beim Laden der Aufträge:', aerr);
                  } else {
                    const auftragIds = (auftraege || []).map(r => r.id).filter(Boolean);
                    console.log(`✅ ${auftragIds.length} Aufträge mit Name "${auftragsname}" gefunden`);
                    
                    if (auftragIds.length === 0) {
                      // Keine Aufträge mit diesem Namen gefunden
                      return [];
                    }
                    
                    query = query.in('auftrag_id', auftragIds);
                  }
                  
                  // Entferne den Filter aus filters, damit er nicht nochmal angewendet wird
                  delete filters.auftragsname;
                }
                
                // Filter nach Auftrag-ID (direkt)
                if (filters && filters.auftrag_id) {
                  const auftragId = filters.auftrag_id;
                  console.log('🔍 Filtere Auftragsdetails nach Auftrag-ID:', auftragId);
                  
                  query = query.eq('auftrag_id', auftragId);
                  
                  // Entferne den Filter aus filters, damit er nicht nochmal angewendet wird
                  delete filters.auftrag_id;
                }
              } catch (e) {
                console.warn('⚠️ Konnte Auftragsdetails-Filter nicht anwenden:', e);
              }
            } else {
              // Standard-Query für andere Entitäten
              query = window.supabase
                .from(entityConfig.table)
                .select('*')
                .order('created_at', { ascending: false });
            }

      // Filter anwenden (priorisiere FilterLogic wenn vorhanden)
      if (window.filterSystem) {
        const logic = await window.filterSystem.loadEntityLogic(entityType);
        if (logic && logic.buildSupabaseQuery) {
          console.log(`🔧 Nutze spezifische FilterLogic für ${entityType}`);
          query = logic.buildSupabaseQuery(query, filters);
        } else {
          // Fallback: Generische Filter-Anwendung
          query = this.filterApplier.applyFilters(query, filters, entityConfig.fields, entityType);
        }
      } else {
        // Fallback: Generische Filter-Anwendung
        query = this.filterApplier.applyFilters(query, filters, entityConfig.fields, entityType);
      }

      // Daten aus Supabase laden
      const { data, error } = await query;

      if (error) {
        console.error(`❌ Supabase Fehler beim Laden von ${entityType}:`, error);
        return [];
      }

      console.log(`✅ ${entityType} aus Supabase geladen:`, data?.length || 0);

      // Bezahlte Rechnungen nach unten sortieren, offene weiterhin nach zahlungsziel ASC
      if (entityType === 'rechnung' && data) {
        data.sort((a, b) => {
          const aPaid = a.status === 'Bezahlt' ? 1 : 0;
          const bPaid = b.status === 'Bezahlt' ? 1 : 0;
          if (aPaid !== bPaid) return aPaid - bPaid;

          const aDate = a.zahlungsziel ? new Date(a.zahlungsziel) : new Date('9999-12-31');
          const bDate = b.zahlungsziel ? new Date(b.zahlungsziel) : new Date('9999-12-31');
          if (aDate.getTime() !== bDate.getTime()) return aDate - bDate;

          const aCreated = a.created_at ? new Date(a.created_at) : new Date(0);
          const bCreated = b.created_at ? new Date(b.created_at) : new Date(0);
          return bCreated - aCreated;
        });
      }

      // Spezielle Verarbeitung für Unternehmen: Many-to-Many Branchen vereinfachen
      if (entityType === 'unternehmen' && data) {
        data.forEach(unternehmen => {
          // Branchen aus der Junction Table extrahieren
          if (unternehmen.unternehmen_branchen) {
            unternehmen.branchen = unternehmen.unternehmen_branchen
              .map(ub => ub.branchen)
              .filter(Boolean); // Entferne null-Werte
            
            // Cleanup: Entferne die ursprüngliche Junction-Struktur
            delete unternehmen.unternehmen_branchen;
            
            console.log(`📋 Unternehmen ${unternehmen.firmenname}: ${unternehmen.branchen?.length || 0} Branchen geladen`);
          } else {
            unternehmen.branchen = [];
          }
        });
      }
      
      // Spezielle Verarbeitung für Ansprechpartner: Many-to-Many Unternehmen/Marken vereinfachen
      if (entityType === 'ansprechpartner' && data) {
        data.forEach(ap => {
          // Unternehmen aus der Junction Table extrahieren
          if (ap.ansprechpartner_unternehmen) {
            ap.unternehmen = ap.ansprechpartner_unternehmen
              .map(au => au.unternehmen)
              .filter(Boolean); // Entferne null-Werte
            
            // Cleanup: Entferne die ursprüngliche Junction-Struktur
            delete ap.ansprechpartner_unternehmen;
          } else if (!Array.isArray(ap.unternehmen)) {
            // Falls Legacy-Format (Single unternehmen_id), in Array konvertieren
            ap.unternehmen = ap.unternehmen ? [ap.unternehmen] : [];
          }
          
          // Marken aus der Junction Table extrahieren
          if (ap.ansprechpartner_marke) {
            ap.marken = ap.ansprechpartner_marke
              .map(am => am.marke)
              .filter(Boolean); // Entferne null-Werte
            
            // Cleanup: Entferne die ursprüngliche Junction-Struktur
            delete ap.ansprechpartner_marke;
          } else {
            ap.marken = [];
          }
          
          console.log(`📋 Ansprechpartner ${ap.vorname} ${ap.nachname}: ${ap.unternehmen?.length || 0} Unternehmen, ${ap.marken?.length || 0} Marken`);
        });
      }
      
      // Lade Many-to-Many Beziehungen falls konfiguriert
      if (data && entityConfig.manyToMany) {
        console.log(`🔗 DATASERVICE: Lade Many-to-Many für ${entityType}, Config:`, Object.keys(entityConfig.manyToMany));
        await this.relationManager.loadManyToManyRelations(data, entityType, entityConfig.manyToMany);
      }

      // Spezielle Projektion für Creator: Arrays direkt an Top-Level anhängen
      if (entityType === 'creator' && data) {
        data.forEach(c => {
          c.sprachen = c.sprachen || [];
          c.branchen = c.branchen || [];
          c.creator_types = c.creator_types || [];
        });
      }
      
      return data || [];
      
    } catch (error) {
      console.error(`❌ Fehler beim Laden von ${entityType}:`, error);
      return [];
    }
  }

  async loadFilterData(entityType) {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return getMockFilterData(entityType);
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

      // Alle Entitäten laden um Filter-Optionen zu extrahieren
      let query = window.supabase.from(entityConfig.table);
      
      // Spezielle Behandlung für Creator mit JOINs
      if (entityType === 'creator') {
        // Keine alten FK-Joins mehr nötig
        query = query.select('*');
      } else {
        query = query.select('*');
      }
      
      const { data, error } = await query;

      if (error) {
        console.error(`❌ Supabase Fehler beim Laden der Filter-Daten für ${entityType}:`, error);
        return getMockFilterData(entityType);
      }

      // Filter-Optionen aus echten Daten extrahieren
      const filterOptions = await this.filterApplier.extractFilterOptions(data, entityType);
      
      // Für Creator: Zusätzlich die neuen Tabellen direkt laden
      if (entityType === 'creator') {
        try {
          // Creator Types laden
          const { data: creatorTypes, error: ctError } = await window.supabase
            .from('creator_type')
            .select('id, name')
            .order('name');
          
          if (!ctError && creatorTypes) {
            filterOptions.creator_type_id = creatorTypes.map(ct => ({ id: ct.id, name: ct.name }));
          }

          // Sprachen laden
          const { data: sprachen, error: spError } = await window.supabase
            .from('sprachen')
            .select('id, name')
            .order('name');
          
          if (!spError && sprachen) {
            filterOptions.sprache_id = sprachen.map(s => ({ id: s.id, name: s.name }));
          }

          // Branchen laden
          const { data: branchen, error: brError } = await window.supabase
            .from('branchen_creator')
            .select('id, name')
            .order('name');
          
          if (!brError && branchen) {
            filterOptions.branche_id = branchen.map(b => ({ id: b.id, name: b.name }));
          }
        } catch (error) {
          console.error('❌ Fehler beim Laden der Creator-Filter-Optionen:', error);
        }
      }
      
      // Für Unternehmen: Branchen-Tabelle laden
      if (entityType === 'unternehmen') {
        try {
          // Branchen laden
          const { data: branchen, error: brError } = await window.supabase
            .from('branchen')
            .select('id, name, beschreibung')
            .order('name');
          
          if (!brError && branchen) {
            filterOptions.branche_id = branchen.map(b => ({ 
              id: b.id, 
              name: b.name,
              description: b.beschreibung 
            }));
            console.log(`✅ ${branchen.length} Branchen für Unternehmen-Filter geladen`);
          }
        } catch (error) {
          console.error('❌ Fehler beim Laden der Unternehmen-Filter-Optionen:', error);
        }
      }
      
      // Für Marke: Branchen-Tabelle laden
      if (entityType === 'marke') {
        try {
          // Branchen laden
          const { data: branchen, error: brError } = await window.supabase
            .from('branchen')
            .select('id, name, beschreibung')
            .order('name');
          
          if (!brError && branchen) {
            filterOptions.branche_id = branchen.map(b => ({ 
              id: b.id, 
              name: b.name,
              description: b.beschreibung 
            }));
            console.log(`✅ ${branchen.length} Branchen für Marke-Filter geladen`);
          }
        } catch (error) {
          console.error('❌ Fehler beim Laden der Marke-Filter-Optionen:', error);
        }
      }
      
      console.log(`✅ Filter-Daten für ${entityType} geladen:`, filterOptions);
      return filterOptions;

    } catch (error) {
      console.error(`❌ Fehler beim Laden der Filter-Daten für ${entityType}:`, error);
      return getMockFilterData(entityType);
    }
  }

  async loadEntitiesWithPagination(entityType, filters = {}, page = 1, limit = 25) {
    try {
      console.log(`📄 Lade ${entityType} mit Pagination:`, { filters, page, limit });
      
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        const mockData = getMockData(entityType);
        const start = (page - 1) * limit;
        const end = start + limit;
        return {
          data: mockData.slice(start, end),
          total: mockData.length,
          page,
          limit
        };
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

      // Berechne Range für Supabase (0-basiert)
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Basisquery mit Select
      let selectClause = '*';
      
      // Spezielle Select-Klausel für Creator (benötigte Felder für Listen-Ansicht)
      if (entityType === 'creator') {
        selectClause = `
          id,vorname,nachname,mail,telefonnummer,alter_jahre,alter_min,alter_max,
          instagram,instagram_follower,tiktok,tiktok_follower,
          lieferadresse_stadt,lieferadresse_land,
          creator_creator_type(creator_type_id(id,name)),
          creator_branchen(branche_id(id,name))
        `;
      }
      // Spezielle Select-Klausel für Ansprechpartner mit JOINs
      // Hinweis: unternehmen_id FK wurde entfernt - nur noch Many-to-Many über ansprechpartner_unternehmen
      else if (entityType === 'ansprechpartner') {
        selectClause = `
          *,
          sprache:sprache_id (
            id,
            name
          ),
          positionen:position_id (
            id,
            name
          ),
          telefonnummer_land:eu_laender!telefonnummer_land_id (
            id,
            name,
            name_de,
            iso_code,
            vorwahl
          ),
          telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (
            id,
            name,
            name_de,
            iso_code,
            vorwahl
          ),
          land:eu_laender!land_id (
            id,
            name_de,
            iso_code
          ),
          ansprechpartner_marke (
            marke:marke_id (
              id,
              markenname,
              logo_url
            )
          ),
          ansprechpartner_unternehmen (
            unternehmen:unternehmen_id (
              id,
              firmenname,
              internes_kuerzel,
              logo_url
            )
          ),
          kunde_ansprechpartner (kunde_id)
        `;
      }
      
      let query = window.supabase.from(entityConfig.table).select(selectClause, { count: 'exact' });

      // Spezielle Behandlung für _allowedIds Filter (Mitarbeiter-Sichtbarkeit)
      if (filters._allowedIds && Array.isArray(filters._allowedIds)) {
        query = query.in('id', filters._allowedIds);
        delete filters._allowedIds;
      }

      // Spezielle Behandlung für Many-to-Many Filter (z.B. branche_id für Unternehmen)
      if (filters.branche_id && (entityType === 'unternehmen' || entityType === 'marke')) {
        try {
          const junctionTable = entityType === 'unternehmen' ? 'unternehmen_branchen' : 'marke_branchen';
          const fkField = entityType === 'unternehmen' ? 'unternehmen_id' : 'marke_id';
          
          const { data: junctionData, error: junctionError } = await window.supabase
            .from(junctionTable)
            .select(fkField)
            .eq('branche_id', filters.branche_id);
          
          if (junctionError) {
            console.error(`❌ Fehler beim Laden der ${junctionTable}:`, junctionError);
          } else {
            const entityIds = (junctionData || []).map(item => item[fkField]).filter(Boolean);
            console.log(`🔍 Gefundene ${entityType} mit Branche ${filters.branche_id}:`, entityIds.length);
            
            if (entityIds.length > 0) {
              query = query.in('id', entityIds);
            } else {
              // Keine Entities mit dieser Branche
              return {
                data: [],
                total: 0,
                page,
                limit
              };
            }
          }
        } catch (error) {
          console.error(`❌ Exception beim Branche-Filter für ${entityType}:`, error);
        }
      }

      // Creator M:N-Filter über Junction-Tabellen anwenden (Pagination)
      if (entityType === 'creator') {
        try {
          const idSets = [];
          const getIdFromFilter = (val) => {
            if (val == null) return null;
            if (typeof val === 'string') return val;
            if (typeof val === 'object') return val.value || val.id || null;
            return String(val);
          };

          // Sprache
          if (filters.sprache_id) {
            const selectedId = getIdFromFilter(filters.sprache_id);
            const { data: links, error: lerr } = await window.supabase
              .from('creator_sprachen')
              .select('creator_id')
              .eq('sprache_id', selectedId);
            if (!lerr) {
              idSets.push(new Set((links || []).map(r => r.creator_id)));
            }
            delete filters.sprache_id;
          }

          // Branche
          if (filters.branche_id || filters.branche) {
            const selectedId = getIdFromFilter(filters.branche_id || filters.branche);
            const { data: links, error: lerr } = await window.supabase
              .from('creator_branchen')
              .select('creator_id')
              .eq('branche_id', selectedId);
            if (!lerr) {
              idSets.push(new Set((links || []).map(r => r.creator_id)));
            }
            delete filters.branche_id;
            delete filters.branche;
          }

          // Creator-Typ
          if (filters.creator_type_id) {
            const selectedId = getIdFromFilter(filters.creator_type_id);
            const { data: links, error: lerr } = await window.supabase
              .from('creator_creator_type')
              .select('creator_id')
              .eq('creator_type_id', selectedId);
            if (!lerr) {
              idSets.push(new Set((links || []).map(r => r.creator_id)));
            }
            delete filters.creator_type_id;
          }

          // Schnittmenge bilden und auf Creator-IDs einschränken
          if (idSets.length > 0) {
            let intersection = idSets[0];
            for (let i = 1; i < idSets.length; i++) {
              intersection = new Set([...intersection].filter(x => idSets[i].has(x)));
            }

            const ids = [...intersection];
            if (ids.length === 0) {
              return {
                data: [],
                total: 0,
                page,
                limit
              };
            }
            query = query.in('id', ids);
          }
        } catch (error) {
          console.warn('⚠️ Konnte Creator-Junction-Filter (Pagination) nicht anwenden:', error);
        }
      }

      // Andere Filter anwenden (ohne branche_id und interne Sort-Parameter)
      const filtersToApply = {...filters};
      delete filtersToApply.branche_id;
      delete filtersToApply.branche;
      delete filtersToApply.sprache_id;
      delete filtersToApply.creator_type_id;
      delete filtersToApply._sortBy;
      delete filtersToApply._sortOrder;
      delete filtersToApply._allowedIds; // wurde bereits oben behandelt
      
      // Filter anwenden (priorisiere FilterLogic wenn vorhanden)
      if (window.filterSystem) {
        const logic = await window.filterSystem.loadEntityLogic(entityType);
        if (logic && logic.buildSupabaseQuery) {
          console.log(`🔧 Nutze spezifische FilterLogic für ${entityType} (Pagination)`);
          query = logic.buildSupabaseQuery(query, filtersToApply);
        } else {
          query = this.filterApplier.applyFilters(query, filtersToApply, entityConfig.fields, entityType);
        }
      } else {
        query = this.filterApplier.applyFilters(query, filtersToApply, entityConfig.fields, entityType);
      }

      // Sortierung anwenden (Filter-Override hat Vorrang)
      const sortBy = filters._sortBy || entityConfig.sortBy;
      const sortOrder = filters._sortOrder !== undefined ? filters._sortOrder : entityConfig.sortOrder;
      if (sortBy) {
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      }

      // Range für Pagination
      query = query.range(from, to);

      // Query ausführen
      const { data, error, count } = await query;

      if (error) {
        console.error(`❌ Supabase Fehler beim Laden von ${entityType}:`, error);
        throw error;
      }

      console.log(`✅ ${entityType} geladen:`, {
        items: data?.length || 0,
        total: count,
        page,
        limit,
        from,
        to
      });

      // Lade Many-to-Many Beziehungen falls konfiguriert
      if (data && data.length > 0 && entityConfig.manyToMany) {
        console.log(`🔗 DATASERVICE PAGINATION: Lade Many-to-Many für ${entityType}, Config:`, Object.keys(entityConfig.manyToMany));
        await this.relationManager.loadManyToManyRelations(data, entityType, entityConfig.manyToMany);
      }

      // Spezielle Projektion für Creator: Junction-Daten zu flachen Arrays transformieren
      if (entityType === 'creator' && data) {
        data.forEach(c => {
          c.sprachen = c.sprachen || [];
          
          // Branchen aus Junction-Table extrahieren
          if (c.creator_branchen && Array.isArray(c.creator_branchen)) {
            c.branchen = c.creator_branchen
              .map(junction => junction.branche_id?.name)
              .filter(Boolean);
            delete c.creator_branchen;
          } else {
            c.branchen = c.branchen || [];
          }
          
          // Creator Types aus Junction-Table extrahieren
          if (c.creator_creator_type && Array.isArray(c.creator_creator_type)) {
            c.creator_types = c.creator_creator_type
              .map(junction => junction.creator_type_id?.name)
              .filter(Boolean);
            delete c.creator_creator_type;
          } else {
            c.creator_types = c.creator_types || [];
          }
        });
      }

      // Spezielle Projektion für Ansprechpartner: Marken und Unternehmen aus Junction-Tables extrahieren
      if (entityType === 'ansprechpartner' && data) {
        data.forEach(ap => {
          // Marken: Extrahiere aus ansprechpartner_marke Junction-Table
          if (ap.ansprechpartner_marke && Array.isArray(ap.ansprechpartner_marke)) {
            ap.marken = ap.ansprechpartner_marke
              .map(junction => junction.marke)
              .filter(Boolean);
            delete ap.ansprechpartner_marke; // Clean up
          } else {
            ap.marken = [];
          }

          // Unternehmen: Extrahiere aus ansprechpartner_unternehmen Junction-Table (Many-to-Many)
          const unternehmenList = [];
          
          if (ap.ansprechpartner_unternehmen && Array.isArray(ap.ansprechpartner_unternehmen)) {
            ap.ansprechpartner_unternehmen.forEach(junction => {
              if (junction.unternehmen) {
                unternehmenList.push(junction.unternehmen);
              }
            });
            delete ap.ansprechpartner_unternehmen; // Clean up
          }
          
          ap.unternehmen = unternehmenList;

          // Kunde-Verknüpfung (Magic Link): Verknüpft wenn mindestens ein Kunde existiert
          ap.ist_verknuepft = (ap.kunde_ansprechpartner?.length ?? 0) > 0;
          delete ap.kunde_ansprechpartner;
        });
      }

      return {
        data: data || [],
        total: count || 0,
        page,
        limit
      };

    } catch (error) {
      console.error(`❌ Fehler beim Laden von ${entityType} mit Pagination:`, error);
      throw error;
    }
  }

  async executeQuery(query, params = []) {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - kann SQL-Abfrage nicht ausführen');
        return [];
      }

      // Verwende rpc für benutzerdefinierte Abfragen
      const { data: result, error } = await window.supabase
        .rpc('execute_sql', { 
          sql_query: query, 
          sql_params: params 
        });

      if (error) {
        console.error('❌ Fehler bei der SQL-Abfrage:', error);
        return [];
      }

      return result || [];
    } catch (error) {
      console.error('❌ Fehler beim Ausführen der SQL-Abfrage:', error);
      return [];
    }
  }

  async extractFilterOptions(data, entityType) {
    return this.filterApplier.extractFilterOptions(data, entityType);
  }
}
