// DataService.js (ES6-Modul)
// Zentrale Datenverwaltung für alle Entitäten — Facade

import { EntityRegistry } from './data/entities/index.js';
import { getMockData, getMockFilterData } from './data/MockProvider.js';

export class DataService {
  constructor() {
    this.entities = EntityRegistry;
  }

  // Generische CRUD-Operationen
  async createEntity(entityType, data) {
    try {
      console.log(`✅ ${entityType} erstellt:`, data);
      
      if (!window.supabase || !window.supabase.auth) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        const newEntity = {
          id: Date.now().toString(),
          ...data,
          created_at: new Date().toISOString()
        };
        
        // Mock-Daten in localStorage speichern für Offline-Modus
        const mockData = JSON.parse(localStorage.getItem('mock_data') || '{}');
        if (!mockData[entityType]) {
          mockData[entityType] = [];
        }
        mockData[entityType].push(newEntity);
        localStorage.setItem('mock_data', JSON.stringify(mockData));
        
        console.log(`✅ ${entityType} Mock-Daten gespeichert:`, newEntity);
        return { success: true, id: newEntity.id, data: newEntity };
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

      // Daten für Supabase vorbereiten
      const supabaseData = await this.prepareDataForSupabase(data, entityConfig.fields, entityType);

      // Entität in Supabase erstellen
      const { data: result, error } = await window.supabase
        .from(entityConfig.table)
        .insert([supabaseData])
        .select()
        .single();

      if (error) {
        console.error(`❌ Supabase Fehler beim Erstellen von ${entityType}:`, error);
        return { success: false, error: error.message };
      }

      console.log(`✅ ${entityType} erfolgreich in Supabase erstellt:`, result);
      
      // Many-to-Many Beziehungen verarbeiten (z.B. marke_ids für Ansprechpartner)
      await this.handleManyToManyRelations(entityType, result.id, data);
      
      // Creator-Agentur Beziehung verarbeiten
      if (entityType === 'creator') {
        await this.handleCreatorAgentur(result.id, data);
      }
      
      return { success: true, id: result.id, data: result };
      
    } catch (error) {
      console.error(`❌ Fehler beim Erstellen von ${entityType}:`, error);
      return { success: false, error: error.message };
    }
  }

  async updateEntity(entityType, id, data) {
    try {
      console.log(`✅ ${entityType} aktualisiert:`, id, data);
      
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return { success: true, id: id, data: data };
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

      // Daten für Supabase vorbereiten
      const supabaseData = await this.prepareDataForSupabase(data, entityConfig.fields, entityType);

      // Entität in Supabase aktualisieren
      const { data: result, error } = await window.supabase
        .from(entityConfig.table)
        .update(supabaseData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`❌ Supabase Fehler beim Aktualisieren von ${entityType}:`, error);
        return { success: false, error: error.message };
      }

      console.log(`✅ ${entityType} erfolgreich in Supabase aktualisiert:`, result);
      
      // Many-to-Many Beziehungen verarbeiten (z.B. branche_id für Unternehmen)
      await this.handleManyToManyRelations(entityType, id, data);
      
      // Creator-Agentur Beziehung verarbeiten
      if (entityType === 'creator') {
        await this.handleCreatorAgentur(id, data);
      }
      
      return { success: true, id: id, data: result };
      
    } catch (error) {
      console.error(`❌ Fehler beim Aktualisieren von ${entityType}:`, error);
      return { success: false, error: error.message };
    }
  }

  async deleteEntity(entityType, id) {
    try {
      console.log(`🗑️ Lösche ${entityType}:`, id);
      
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return { success: true, id: id };
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

      // Keine Bestätigung mehr - wird von aufrufender Stelle gehandhabt
      // Entität direkt in Supabase löschen
      const { error } = await window.supabase
        .from(entityConfig.table)
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`❌ Supabase Fehler beim Löschen von ${entityType}:`, error);
        return { success: false, error: error.message };
      }

      console.log(`✅ ${entityType} erfolgreich gelöscht:`, id);
      return { success: true, id: id };
      
    } catch (error) {
      console.error(`❌ Fehler beim Löschen von ${entityType}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Batch-Delete für bessere Performance
  async deleteEntities(entityType, ids) {
    try {
      if (!ids || ids.length === 0) {
        return { success: true, deletedCount: 0 };
      }

      console.log(`🗑️ Batch-Lösche ${ids.length} ${entityType}...`);

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return { success: true, deletedCount: ids.length };
      }

      const entityConfig = this.entities[entityType];
      if (!entityConfig) {
        throw new Error(`Unbekannte Entität: ${entityType}`);
      }

      // Ein einziger Supabase-Call für alle IDs
      const { error, count } = await window.supabase
        .from(entityConfig.table)
        .delete({ count: 'exact' })
        .in('id', ids);

      if (error) {
        console.error(`❌ Batch-Delete Fehler für ${entityType}:`, error);
        return { success: false, error: error.message };
      }

      console.log(`✅ ${count || ids.length} ${entityType} erfolgreich gelöscht`);
      return { success: true, deletedCount: count || ids.length };
      
    } catch (error) {
      console.error(`❌ Fehler beim Batch-Delete von ${entityType}:`, error);
      return { success: false, error: error.message };
    }
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
          query = this.applyFilters(query, filters, entityConfig.fields, entityType);
        }
      } else {
        // Fallback: Generische Filter-Anwendung
        query = this.applyFilters(query, filters, entityConfig.fields, entityType);
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
        await this.loadManyToManyRelations(data, entityType, entityConfig.manyToMany);
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

  // Verarbeite Many-to-Many Beziehungen beim Erstellen/Aktualisieren
  async handleManyToManyRelations(entityType, entityId, data) {
    try {
      const entityConfig = this.entities[entityType];
      if (!entityConfig || !entityConfig.manyToMany) return;

      for (const [relationName, config] of Object.entries(entityConfig.manyToMany)) {
        // Prüfe ob entsprechende _ids Daten vorhanden sind
        let fieldName;
        if (relationName === 'sprachen') {
          fieldName = 'sprachen_ids';
        } else if (relationName === 'branchen') {
          // Für Unternehmen und Marke: branche_id, für Creator: branche_ids
          fieldName = (entityType === 'unternehmen' || entityType === 'marke') ? 'branche_id' : 'branche_ids';
        } else if (relationName === 'creator_types') {
          fieldName = 'creator_type_ids';
        } else if (relationName === 'marken') {
          fieldName = 'marke_ids';
        } else if (relationName === 'unternehmen') {
          // Für Ansprechpartner ist unternehmen eine 1:1 Beziehung, nicht Many-to-Many
          if (entityType === 'ansprechpartner') {
            fieldName = 'unternehmen_id';
          } else {
            fieldName = 'unternehmen_ids';
          }
        } else if (relationName === 'mitarbeiter') {
          fieldName = 'mitarbeiter_ids';
        } else if (relationName === 'cutter') {
          fieldName = 'cutter_ids';
        } else if (relationName === 'copywriter') {
          fieldName = 'copywriter_ids';
        } else if (relationName === 'kampagne_arten') {
          fieldName = 'art_der_kampagne';
        } else {
          fieldName = `${relationName.slice(0, -1)}_ids`;
        }
        // Eingabewerte für M:N robust ermitteln und zu Array normalisieren
        // Bevorzuge explizite Array-Varianten, ansonsten Strings aufsplitten/JSON-parsen
        const bracketValue = data[`${fieldName}[]`];
        const plainValue = data[fieldName];
        
        const parseToArray = (val) => {
          if (val == null) return [];
          if (Array.isArray(val)) return val;
          if (typeof val === 'string') {
            const trimmed = val.trim();
            // JSON-Array-String
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
              try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed;
              } catch (err) { /* JSON-Parse fehlgeschlagen, versuche nächstes Format */ }
            }
            // Komma-separierte Liste
            if (trimmed.includes(',')) {
              return trimmed.split(',').map(s => s.trim()).filter(Boolean);
            }
            // Einzelner Wert
            return trimmed ? [trimmed] : [];
          }
          // Fallback: einzelner Wert
          return [val];
        };
        
        // Bevorzugung: Arrays gehen vor Strings; plainValue hat Vorrang, wenn es ein Array ist
        let fieldData = null;
        if (Array.isArray(plainValue)) fieldData = plainValue;
        else if (Array.isArray(bracketValue)) fieldData = bracketValue;
        else if (plainValue != null) fieldData = plainValue;
        else fieldData = bracketValue;
        
        // Debug: Zeige verfügbare Daten für dieses Feld
        console.log(`🔍 DATASERVICE: Prüfe ${fieldName} für ${entityType}.${relationName}:`, {
          fieldData,
          'data[fieldName]': data[fieldName],
          'data[fieldName + []]': data[`${fieldName}[]`],
          allDataKeys: Object.keys(data)
        });
        
        // Für Ansprechpartner: Unternehmen braucht spezielle Behandlung
        // - Legacy: unternehmen_id in Haupttabelle (bereits gesetzt)
        // - Modern: Junction Table ansprechpartner_unternehmen
        if (entityType === 'ansprechpartner' && relationName === 'unternehmen') {
          console.log(`🔗 Spezielle Behandlung für ${entityType}.${relationName} (Legacy + Junction Table)`);
          
          // Prüfe ob unternehmen_id gesetzt ist (wird als unternehmen_id übergeben, nicht unternehmen_ids)
          // Kann als Array oder String kommen - normalisiere zu String
          let unternehmenId = data.unternehmen_id;
          if (Array.isArray(unternehmenId)) {
            unternehmenId = unternehmenId[0]; // Nimm erstes Element aus Array
            console.log(`📦 unternehmen_id war Array, extrahiere erstes Element: ${unternehmenId}`);
          }
          
          if (unternehmenId) {
            console.log(`📝 Erstelle Junction Table Eintrag für Unternehmen ${unternehmenId}`);
            
            // Lösche ggf. bestehende Verknüpfungen (bei Update)
            const { error: deleteError } = await window.supabase
              .from('ansprechpartner_unternehmen')
              .delete()
              .eq('ansprechpartner_id', entityId);
            
            if (deleteError) {
              console.error(`❌ Fehler beim Löschen bestehender Unternehmen-Verknüpfungen:`, deleteError);
            }
            
            // Erstelle Junction Table Eintrag
            const { error: insertError } = await window.supabase
              .from('ansprechpartner_unternehmen')
              .insert([{
                ansprechpartner_id: entityId,
                unternehmen_id: unternehmenId
              }]);
            
            if (insertError) {
              console.error(`❌ Fehler beim Erstellen der Unternehmen-Verknüpfung:`, insertError);
            } else {
              console.log(`✅ Unternehmen-Verknüpfung erstellt für Ansprechpartner ${entityId} mit Unternehmen ${unternehmenId}`);
            }
          }
          continue; // Überspringe normale Many-to-Many Logik
        }

        if (!fieldData) continue;

        console.log(`🔗 Verarbeite Many-to-Many Beziehung: ${entityType}.${relationName} für ${fieldName}:`, fieldData);
        
        // Sicherstellen, dass fieldData ein Array ist und Duplikate/Leereinträge entfernen
        const relatedIds = Array.from(new Set(parseToArray(fieldData).filter(Boolean)));
        
        // Bestehende Beziehungen löschen
        const { error: deleteError } = await window.supabase
          .from(config.junctionTable)
          .delete()
          .eq(config.localKey, entityId);
          
        if (deleteError) {
          console.error(`❌ Fehler beim Löschen bestehender ${relationName} Beziehungen:`, deleteError);
          continue;
        }
        
        // Neue Beziehungen erstellen
        if (relatedIds.length > 0 && relatedIds[0]) {
          const insertData = relatedIds
            .filter(id => id) // Leere IDs herausfiltern
            .map(relatedId => ({
              [config.localKey]: entityId,
              [config.foreignKey]: relatedId
            }));
          
          if (insertData.length > 0) {
            const { error: insertError } = await window.supabase
              .from(config.junctionTable)
              .insert(insertData);
              
            if (insertError) {
              console.error(`❌ Fehler beim Erstellen neuer ${relationName} Beziehungen:`, insertError);
            } else {
              console.log(`✅ ${relationName} Beziehungen erstellt: ${insertData.length} Einträge`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Fehler beim Verarbeiten der Many-to-Many Beziehungen:`, error);
    }
  }

  // Creator-Agentur Beziehung verarbeiten (1:1 mit ist_aktiv Flag)
  async handleCreatorAgentur(creatorId, data) {
    try {
      // Prüfe ob Agentur-Toggle aktiv ist
      const agenturVertreten = data.agentur_vertreten === 'on' || 
                               data.agentur_vertreten === true || 
                               data.agentur_vertreten === 'true';
      
      console.log(`🏢 Creator-Agentur für ${creatorId}: vertreten=${agenturVertreten}`);
      
      // Prüfe ob bereits ein Eintrag existiert
      const { data: existingAgentur, error: selectError } = await window.supabase
        .from('creator_agentur')
        .select('id')
        .eq('creator_id', creatorId)
        .maybeSingle();
      
      if (selectError) {
        console.error('❌ Fehler beim Prüfen der Creator-Agentur:', selectError);
        return;
      }
      
      const agenturData = {
        creator_id: creatorId,
        ist_aktiv: agenturVertreten,
        agentur_name: agenturVertreten ? (data.agentur_name || null) : null,
        agentur_adresse: agenturVertreten ? (data.agentur_adresse || null) : null,
        agentur_vertretung: agenturVertreten ? (data.agentur_vertretung || null) : null,
        updated_at: new Date().toISOString()
      };
      
      if (existingAgentur) {
        // Update existierenden Eintrag
        const { error: updateError } = await window.supabase
          .from('creator_agentur')
          .update(agenturData)
          .eq('id', existingAgentur.id);
        
        if (updateError) {
          console.error('❌ Fehler beim Aktualisieren der Creator-Agentur:', updateError);
        } else {
          console.log(`✅ Creator-Agentur aktualisiert für ${creatorId}`);
        }
      } else if (agenturVertreten) {
        // Nur neuen Eintrag erstellen wenn Toggle aktiv
        agenturData.created_at = new Date().toISOString();
        
        const { error: insertError } = await window.supabase
          .from('creator_agentur')
          .insert([agenturData]);
        
        if (insertError) {
          console.error('❌ Fehler beim Erstellen der Creator-Agentur:', insertError);
        } else {
          console.log(`✅ Creator-Agentur erstellt für ${creatorId}`);
        }
      }
    } catch (error) {
      console.error('❌ Fehler bei handleCreatorAgentur:', error);
    }
  }

  // Lade Many-to-Many Beziehungen für Entitäten (optimiert: parallel)
  async loadManyToManyRelations(entities, entityType, manyToManyConfig) {
    try {
      // Sammle alle Entity-IDs einmal
      const entityIds = entities.map(entity => entity.id).filter(id => id);
      if (entityIds.length === 0) return;
      
      // Bereite alle M:N-Requests vor und führe sie parallel aus
      const relationEntries = Object.entries(manyToManyConfig);
      const promises = relationEntries.map(async ([relationName, config]) => {
        try {
          // Lade Junction-Daten mit JOIN zur Ziel-Tabelle
          const { data: junctionData, error } = await window.supabase
            .from(config.junctionTable)
            .select(`
              ${config.localKey},
              ${config.table}!${config.foreignKey} (
                id,
                ${config.displayField}
              )
            `)
            .in(config.localKey, entityIds);
          
          if (error) {
            console.error(`❌ M:N ${relationName}:`, error.message);
            return { relationName, groupedData: {} };
          }
          
          // Gruppiere Daten nach Entity-ID
          const groupedData = {};
          junctionData?.forEach(item => {
            const entityId = item[config.localKey];
            if (!groupedData[entityId]) {
              groupedData[entityId] = [];
            }
            if (item[config.table]) {
              groupedData[entityId].push(item[config.table]);
            }
          });
          
          return { relationName, groupedData };
        } catch (err) {
          console.error(`❌ M:N ${relationName} Exception:`, err);
          return { relationName, groupedData: {} };
        }
      });
      
      // Warte auf alle parallelen Requests
      const results = await Promise.all(promises);
      
      // Füge Beziehungsdaten zu Entitäten hinzu
      results.forEach(({ relationName, groupedData }) => {
        entities.forEach(entity => {
          entity[relationName] = groupedData[entity.id] || [];
        });
      });
      
      console.log(`✅ M:N für ${entityType}: ${relationEntries.length} Beziehungen parallel geladen`);
    } catch (error) {
      console.error(`❌ Fehler beim Laden der Many-to-Many Beziehungen:`, error);
    }
  }

  // Hilfsmethoden
  async prepareDataForSupabase(data, fieldConfig, entityType) {
    const supabaseData = {};
    // Vorverarbeitung für spezielle Mappings
    if (entityType === 'auftrag') {
      // Falls das Formular ein berechnetes Feld 'brutto_gesamt_budget' liefert, mappe es auf das bestehende DB-Feld 'bruttobetrag'
      if (data && data.brutto_gesamt_budget && !data.bruttobetrag) {
        data.bruttobetrag = data.brutto_gesamt_budget;
      }
    }
    
    // Sicherheitscheck für fieldConfig
    if (!fieldConfig) {
      console.warn('⚠️ fieldConfig ist undefined - verwende Standard-Behandlung');
      return data;
    }
    
    for (const [field, rawValue] of Object.entries(data)) {
      // Kooperation: dynamische Video-Felder und rein clientseitige Hilfsfelder NICHT in kooperationen schreiben
      if (
        entityType === 'kooperation' && (
          field === 'einkaufspreis_ust_prozent' ||
          field.startsWith('video_') ||
          field.startsWith('adressname_') || field.startsWith('strasse_') || field.startsWith('hausnummer_') ||
          field.startsWith('plz_') || field.startsWith('stadt_') || field.startsWith('land_') || field.startsWith('notiz_')
        )
      ) {
        console.log(`🔧 Überspringe dynamisches Feld für ${entityType}: ${field}`);
        continue;
      }
      // Normalisiere Wert (z. B. wenn versehentlich als JSON-Array-String übergeben)
      let value = rawValue;
      if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            value = parsed;
          }
        } catch (_) {
          // ignore parse error, keep original value
        }
      }
      
      // Konvertiere Follower-Bereiche zu Integer für Creator
      if (entityType === 'creator' && (field === 'instagram_follower' || field === 'tiktok_follower')) {
        if (value && typeof value === 'string') {
          // Konvertiere Bereich-String zu Maximalwert
          const followerRangeToInt = {
            '0-2500': 2500,
            '2500-5000': 5000,
            '5000-10000': 10000,
            '10000-25000': 25000,
            '25000-50000': 50000,
            '50000-100000': 100000,
            '100000-250000': 250000,
            '250000-500000': 500000,
            '500000-1000000': 1000000,
            '1000000+': 1500000
          };
          value = followerRangeToInt[value] || null;
          console.log(`🔢 Konvertiere ${field}: "${rawValue}" → ${value}`);
        }
      }
      
      // Spezielle Behandlung für branche_id - prüfe ob Junction Table verwendet wird
      if (field === 'branche_id' && entityType === 'unternehmen') {
        console.log(`🏷️ Verarbeite ${field}:`, value);
        
        // Prüfe ob es ein Relation-Field ist (für Junction Table)
        const fieldConfig = this.entities[entityType]?.fields?.find(f => f.name === field);
        const isRelationField = fieldConfig?.relationTable && fieldConfig?.relationField;
        
        if (isRelationField) {
          // Junction Table wird verwendet - NICHT in Haupttabelle speichern
          console.log(`🔧 ${field} ist Relation-Field - wird von RelationTables verarbeitet`);
          continue; // Überspringe dieses Feld für die Haupttabelle
        } else if (value) {
          // Legacy: branche_id direkt setzen
          supabaseData.branche_id = value;
          console.log(`✅ branche_id gesetzt: ${value}`);
          
          // Branche-Namen für Legacy-Feld laden
          try {
            const { data: branche, error } = await window.supabase
              .from('branchen')
              .select('id, name')
              .eq('id', value)
              .single();
            
            if (!error && branche) {
              supabaseData.branche = branche.name;
              console.log(`✅ branche Namen gesetzt: ${supabaseData.branche}`);
            }
          } catch (error) {
            console.error('❌ Fehler beim Laden der Branche-Namen:', error);
          }
        }
        continue;
      }
      
      // Spezielle Behandlung für marke_ids - für Ansprechpartner Many-to-Many
      if (field === 'marke_ids' || field === 'marke_ids[]') {
        console.log(`🏷️ Verarbeite ${field} für Ansprechpartner:`, value);
        // marke_ids wird über Many-to-Many Relation verwaltet - hier überspringen
        // Die Verarbeitung erfolgt in createEntityWithRelations
        continue;
      }
      
      // Spezielle Behandlung für sprachen_ids - für Ansprechpartner Many-to-Many
      if (field === 'sprachen_ids' || field === 'sprachen_ids[]') {
        console.log(`🏷️ Verarbeite ${field} für Ansprechpartner:`, value);
        // sprachen_ids wird über Many-to-Many Relation verwaltet - hier überspringen
        // Die Verarbeitung erfolgt in handleManyToManyRelations
        continue;
      }
      
      // Spezielle Behandlung für Creator Many-to-Many Felder
      if (entityType === 'creator' && (
        field === 'sprachen_ids' || field === 'sprachen_ids[]' ||
        field === 'branchen_ids' || field === 'branchen_ids[]' ||
        field === 'creator_type_ids' || field === 'creator_type_ids[]'
      )) {
        console.log(`🏷️ Verarbeite ${field} für Creator:`, value);
        // Creator Many-to-Many Felder werden über handleManyToManyRelations verwaltet - hier überspringen
        continue;
      }
      
      // Spezielle Behandlung für Creator-Agentur Felder (werden in separater Tabelle gespeichert)
      if (entityType === 'creator' && (
        field === 'agentur_vertreten' ||
        field === 'agentur_name' ||
        field === 'agentur_adresse' ||
        field === 'agentur_vertretung'
      )) {
        console.log(`🏢 Überspringe Agentur-Feld ${field} für Haupttabelle (wird in creator_agentur gespeichert)`);
        continue;
      }
      
      // Spezielle Behandlung für Marke Many-to-Many Felder
      if (entityType === 'marke' && (
        field === 'branche_id' || field === 'branche_id[]'
      )) {
        console.log(`🏷️ Verarbeite ${field} für Marke:`, value);
        // Marke Many-to-Many Felder werden über handleManyToManyRelations verwaltet - hier überspringen
        continue;
      }
      
      // Spezielle Behandlung für Ansprechpartner Many-to-Many Felder
      if (entityType === 'ansprechpartner' && (
        field === 'marke_ids' || field === 'marke_ids[]' ||
        field === 'sprachen_ids' || field === 'sprachen_ids[]'
      )) {
        console.log(`🏷️ Verarbeite ${field} für Ansprechpartner:`, value);
        // Ansprechpartner Many-to-Many Felder werden über handleManyToManyRelations verwaltet - hier überspringen
        continue;
      }
      
      // Spezielle Behandlung für unternehmen_id bei Ansprechpartner
      // Das Feld kann als Array kommen, muss aber als String gespeichert werden
      if (entityType === 'ansprechpartner' && field === 'unternehmen_id') {
        if (Array.isArray(value)) {
          supabaseData.unternehmen_id = value[0]; // Nimm erstes Element
          console.log(`📦 unternehmen_id war Array, extrahiere für Haupttabelle: ${supabaseData.unternehmen_id}`);
        } else {
          supabaseData.unternehmen_id = value;
        }
        continue;
      }
      
      // Spezielle Behandlung für Kampagne Many-to-Many Felder
      if (entityType === 'kampagne' && (
        field === 'ansprechpartner_ids' || field === 'ansprechpartner_ids[]' ||
        field === 'mitarbeiter_ids' || field === 'mitarbeiter_ids[]' ||
        field === 'pm_ids' || field === 'pm_ids[]' ||
        field === 'scripter_ids' || field === 'scripter_ids[]' ||
        field === 'cutter_ids' || field === 'cutter_ids[]' ||
        field === 'copywriter_ids' || field === 'copywriter_ids[]' ||
        field === 'strategie_ids' || field === 'strategie_ids[]' ||
        field === 'creator_sourcing_ids' || field === 'creator_sourcing_ids[]' ||
        field === 'organic_ziele_ids' || field === 'organic_ziele_ids[]' ||
        field === 'plattform_ids' || field === 'plattform_ids[]' ||
        field === 'format_ids' || field === 'format_ids[]'
      )) {
        console.log(`🏷️ Verarbeite ${field} für Kampagne:`, value);
        // Kampagne Many-to-Many Felder werden über handleManyToManyRelations verwaltet - hier überspringen
        continue;
      }
      
      // art_der_kampagne: Für Kampagne ist es ein direktes Array-Feld, für Auftrag wird es über Junction Table verwaltet
      if (entityType === 'auftrag' && (field === 'art_der_kampagne' || field === 'art_der_kampagne[]')) {
        console.log(`🏷️ Verarbeite ${field} für Auftrag:`, value);
        // Auftrag art_der_kampagne wird über handleManyToManyRelations verwaltet - hier überspringen
        continue;
      }
      
      // Datei-/virtuelle Felder überspringen (werden separat gehandhabt)
      if (
        field === 'pdf_file' || field.endsWith('_file') ||
        field.endsWith('_ids') || field.endsWith('_ids[]') ||
        field === 'mitarbeiter_ids' || field === 'kampagne_adressen' ||
        field === 'plattform_ids' || field === 'format_ids' ||
        field.startsWith('adressname_') || field.startsWith('strasse_') ||
        field.startsWith('hausnummer_') || field.startsWith('plz_') ||
        field.startsWith('stadt_') || (field.startsWith('land_') && field !== 'land_id') ||
        field.startsWith('notiz_') ||
        // Auftragsformular: berechnetes Formularfeld, existiert nicht als Kolumne
        field === 'brutto_gesamt_budget'
      ) {
        // Wenn es ein *_ids Feld ist und es ein entsprechendes *_id Feld in der Entity gibt, setze dieses auf den ersten Wert (Fallback/Kompatibilität)
        if (field.endsWith('_ids') || field.endsWith('_ids[]')) {
          const singularField = field.replace('_ids[]', '_id').replace('_ids', '_id');
          
          // Prüfe ob das singular Feld existiert
          let hasUuidField = false;
          if (Array.isArray(fieldConfig)) {
            hasUuidField = fieldConfig.some(f => f.name === singularField && f.type === 'uuid');
          } else if (fieldConfig && typeof fieldConfig === 'object') {
            hasUuidField = fieldConfig[singularField] === 'uuid';
          }
          
          if (hasUuidField) {
            const arr = Array.isArray(value) ? value : (value ? [value] : []);
            supabaseData[singularField] = arr.length > 0 ? arr[0] : null;
            console.log(`✅ Setze ${singularField} aus ${field}:`, supabaseData[singularField]);
          }
        }
        console.log(`🔧 Überspringe virtuelles Feld: ${field}`);
        continue;
      }
      
      // Feldkonfiguration finden (fieldConfig kann Array oder Objekt sein)
      let fieldType = null;
      if (Array.isArray(fieldConfig)) {
        const fieldDef = fieldConfig.find(f => f.name === field);
        fieldType = fieldDef?.type;
      } else if (fieldConfig && typeof fieldConfig === 'object') {
        fieldType = fieldConfig[field];
      }
      
      if (fieldType) {
        // Falls ein einzelnes Feld (z. B. *_id oder uuid) als Array kommt, den ersten Wert verwenden
        if (Array.isArray(value) && (fieldType === 'uuid' || field.endsWith('_id'))) {
          value = value.length > 0 ? value[0] : null;
        }

        switch (fieldType) {
          case 'number':
            supabaseData[field] = (value !== null && value !== undefined && value !== '') ? parseFloat(value) : null;
            break;
          case 'array':
            supabaseData[field] = Array.isArray(value) ? value : (value ? [value] : null);
            break;
          case 'date':
            supabaseData[field] = value ? new Date(value).toISOString() : null;
            break;
          case 'boolean':
          case 'toggle':
            // Toggle-Felder behandeln
            supabaseData[field] = value === 'on' || value === true || value === 'true' ? true : false;
            break;
          default: // string, uuid, etc.
            // Leere/Whitespace-Strings als null, damit UNIQUE-Constraints (z. B. angebotsnummer) nicht mehrfach '' bekommen
            if (fieldType === 'string' && typeof value === 'string' && value.trim() === '') {
              supabaseData[field] = null;
            } else {
              supabaseData[field] = value || null;
            }
        }
      } else {
        // Ausnahme: Meta-Felder und automatisch generierte Felder immer übernehmen
        if (field === 'created_by_id' || field === 'updated_by_id' || field === 'po_nummer') {
          supabaseData[field] = value || null;
          console.log(`✅ Meta-Feld ${field} übernommen: ${value}`);
        } else {
          // Felder ohne Konfiguration NICHT übernehmen (um DB-400 zu vermeiden)
          console.log(`🔧 Ignoriere unbekanntes Feld für ${entityType}: ${field}`);
        }
      }
    }
    
    return supabaseData;
  }

  /**
   * Generische Filter-Anwendung
   * Wendet Filter basierend auf Feld-Typen an
   */
  applyFilters(query, filters, fieldConfig, entityType) {
    for (const [field, value] of Object.entries(filters)) {
      // Ignoriere null/undefined/empty
      if (!value || value === '') continue;
      
      // Stelle sicher, dass der Wert als String behandelt wird
      const stringValue = typeof value === 'object' ? '' : String(value);
      
      // Spezielle Behandlung für Name-Filter (Entity-spezifisch)
      if (field === 'name' && value) {
        switch (entityType) {
          case 'unternehmen':
            query = query.ilike('firmenname', `%${value}%`);
            break;
          case 'marke':
            query = query.ilike('markenname', `%${value}%`);
            break;
          case 'auftrag':
            query = query.ilike('auftragsname', `%${value}%`);
            break;
          case 'ansprechpartner':
          case 'creator':
          default:
            // Suche in vorname UND nachname
            query = query.or(`vorname.ilike.%${value}%,nachname.ilike.%${value}%`);
            break;
        }
        continue;
      }
      
      // Prüfe ob Feld im Config definiert ist
      const fieldType = fieldConfig[field];
      
      if (fieldType) {
        // Feld ist im Config definiert - nutze Typ-spezifische Logik
        switch (fieldType) {
          case 'number':
            if (filters[`${field}_min`]) {
              query = query.gte(field, parseFloat(filters[`${field}_min`]));
            }
            if (filters[`${field}_max`]) {
              query = query.lte(field, parseFloat(filters[`${field}_max`]));
            }
            // Unterstütze Objekt-Form {min,max}
            if (typeof value === 'object') {
              if (value.min != null && value.min !== '') {
                query = query.gte(field, parseFloat(value.min));
              }
              if (value.max != null && value.max !== '') {
                query = query.lte(field, parseFloat(value.max));
              }
            }
            break;
          case 'string':
            // Für Text-Felder verwende ilike für bessere Suche
            if (field === 'firmenname' || field === 'markenname' || field === 'name' || field === 'stadt') {
              query = query.ilike(field, `%${stringValue}%`);
            } else {
              query = query.eq(field, stringValue);
            }
            break;
          case 'array':
            // Array-Felder: Prüfe ob das Array den Wert enthält
            if (Array.isArray(value)) {
              // Mehrere Werte: Prüfe ob mindestens einer enthalten ist
              query = query.overlaps(field, value);
            } else {
              // Einzelner Wert: Prüfe ob enthalten
              query = query.contains(field, [stringValue]);
            }
            break;
          case 'date':
            if (filters[`${field}_from`]) {
              query = query.gte(field, filters[`${field}_from`]);
            }
            if (filters[`${field}_to`]) {
              query = query.lte(field, filters[`${field}_to`]);
            }
            // Unterstütze Objekt-Form {from,to} oder {min,max}
            if (typeof value === 'object') {
              const from = value.from ?? value.min;
              const to = value.to ?? value.max;
              if (from) {
                query = query.gte(field, from);
              }
              if (to) {
                query = query.lte(field, to);
              }
            }
            break;
          case 'uuid':
            // UUID-Felder für Beziehungen - stelle sicher, dass es ein gültiger UUID ist
            if (stringValue && stringValue !== '[object Object]') {
              query = query.eq(field, stringValue);
            }
            break;
        }
      } else {
        // Feld ist NICHT im Config - nutze intelligente Fallback-Logik
        console.log(`📋 Fallback-Filter für ${field} (nicht im fieldConfig)`);
        
        // UUID-Pattern erkennen (für Foreign Keys)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stringValue);
        
        if (isUuid || field.endsWith('_id')) {
          // Foreign Key / UUID
          query = query.eq(field, stringValue);
        } else if (field === 'firmenname' || field === 'markenname' || field === 'kampagnenname' || 
                   field === 'stadt' || field === 'land' || field === 'auftragsname') {
          // Text-Felder: Partial-Match mit ilike
          query = query.ilike(field, `%${stringValue}%`);
        } else if (typeof value === 'boolean') {
          // Boolean-Felder
          query = query.eq(field, value);
        } else if (typeof value === 'number') {
          // Numerische Felder
          query = query.eq(field, value);
        } else {
          // Default: Exakte Übereinstimmung
          query = query.eq(field, stringValue);
        }
      }
    }
    
    return query;
  }

  // Spezielle Methoden für Kompatibilität
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
      const filterOptions = await this.extractFilterOptions(data, entityType);
      
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

  /**
   * Lädt Entitäten mit Pagination
   * @param {string} entityType - Typ der Entität
   * @param {Object} filters - Filter-Objekt
   * @param {number} page - Aktuelle Seite (1-basiert)
   * @param {number} limit - Anzahl Items pro Seite
   * @returns {Promise<Object>} { data, total, page, limit }
   */
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
          query = this.applyFilters(query, filtersToApply, entityConfig.fields, entityType);
        }
      } else {
        query = this.applyFilters(query, filtersToApply, entityConfig.fields, entityType);
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
        await this.loadManyToManyRelations(data, entityType, entityConfig.manyToMany);
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

  // Direkte SQL-Abfragen ausführen
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

  // Filter-Optionen aus echten Daten extrahieren
  async extractFilterOptions(data, entityType) {
    const filterOptions = {};

    if (entityType === 'creator') {
      // Neue Methode: Lade alle verfügbaren Optionen aus den Referenz-Tabellen
      try {
        // Creator Types laden
        const { data: creatorTypes, error: ctError } = await window.supabase
          .from('creator_type')
          .select('id, name')
          .order('name');
        
        if (!ctError && creatorTypes) {
          // Sowohl alte als auch neue Keys setzen für Kompatibilität
          const options = creatorTypes.map(ct => ({ id: ct.id, name: ct.name }));
          filterOptions.creator_type = options;
          filterOptions.creator_type_id = options;
        }

        // Sprachen laden
        const { data: sprachen, error: spError } = await window.supabase
          .from('sprachen')
          .select('id, name')
          .order('name');
        
        if (!spError && sprachen) {
          // Sowohl alte als auch neue Keys setzen für Kompatibilität
          const options = sprachen.map(s => ({ id: s.id, name: s.name }));
          filterOptions.sprache = options;
          filterOptions.sprache_id = options;
        }

        // Branchen laden
        const { data: branchen, error: brError } = await window.supabase
          .from('branchen_creator')
          .select('id, name')
          .order('name');
        
        if (!brError && branchen) {
          // Sowohl alte als auch neue Keys setzen für Kompatibilität
          const options = branchen.map(b => ({ id: b.id, name: b.name }));
          filterOptions.branche = options;
          filterOptions.branche_id = options;
        }
      } catch (error) {
        console.error('❌ Fehler beim Laden der Filter-Optionen:', error);
      }

      // Instagram Follower Range
      const followerValues = data
        .map(item => item.instagram_follower)
        .filter(follower => follower && follower > 0)
        .sort((a, b) => a - b);
      
      if (followerValues.length > 0) {
        filterOptions.instagram_follower_min = Math.min(...followerValues);
        filterOptions.instagram_follower_max = Math.max(...followerValues);
      }

      // Stadt (String-Feld)
      const allStaedte = new Set();
      data.forEach(item => {
        if (item.lieferadresse_stadt) {
          allStaedte.add(item.lieferadresse_stadt);
        }
      });
      filterOptions.lieferadresse_stadt = Array.from(allStaedte).sort();

      // Land (String-Feld)
      const allLaender = new Set();
      data.forEach(item => {
        if (item.lieferadresse_land) {
          allLaender.add(item.lieferadresse_land);
        }
      });
      filterOptions.lieferadresse_land = Array.from(allLaender).sort();

    } else if (entityType === 'unternehmen') {
      // Branche (String-Feld)
      const allBranchen = new Set();
      data.forEach(item => {
        if (item.branche) {
          allBranchen.add(item.branche);
        }
      });
      filterOptions.branche = Array.from(allBranchen).sort();

      // Status (String-Feld)
      const allStatus = new Set();
      data.forEach(item => {
        if (item.status) {
          allStatus.add(item.status);
        }
      });
      filterOptions.status = Array.from(allStatus).sort();

      // Stadt (String-Feld)
      const allStaedte = new Set();
      data.forEach(item => {
        if (item.rechnungsadresse_stadt) {
          allStaedte.add(item.rechnungsadresse_stadt);
        }
      });
      filterOptions.rechnungsadresse_stadt = Array.from(allStaedte).sort();

      // Land (String-Feld)
      const allLaender = new Set();
      data.forEach(item => {
        if (item.rechnungsadresse_land) {
          allLaender.add(item.rechnungsadresse_land);
        }
      });
      filterOptions.rechnungsadresse_land = Array.from(allLaender).sort();

    } else if (entityType === 'kampagne') {
      // Status (String-Feld)
      const allStatus = new Set();
      data.forEach(item => {
        if (item.status) {
          allStatus.add(item.status);
        }
      });
      filterOptions.status = Array.from(allStatus).sort();

      // Budget Range
      const budgetValues = data
        .map(item => item.budget)
        .filter(budget => budget && budget > 0)
        .sort((a, b) => a - b);
      
      if (budgetValues.length > 0) {
        filterOptions.budget_min = Math.min(...budgetValues);
        filterOptions.budget_max = Math.max(...budgetValues);
      }

    } else if (entityType === 'kooperation') {
      // Status (String-Feld)
      const allStatus = new Set();
      data.forEach(item => {
        if (item.status) {
          allStatus.add(item.status);
        }
      });
      filterOptions.status = Array.from(allStatus).sort();

      // Budget Range
      const budgetValues = data
        .map(item => item.budget)
        .filter(budget => budget && budget > 0)
        .sort((a, b) => a - b);
      
      if (budgetValues.length > 0) {
        filterOptions.budget_min = Math.min(...budgetValues);
        filterOptions.budget_max = Math.max(...budgetValues);
      }
    } else if (entityType === 'ansprechpartner') {
      // Positionen (UUID-Feld) - Lade alle verfügbaren Positionen
      try {
        const { data: positionen, error } = await window.supabase
          .from('positionen')
          .select('id, name')
          .order('sort_order, name');

        if (!error && positionen) {
          filterOptions.position_id = positionen.map(p => ({
            value: p.id,
            label: p.name
          }));
        }
      } catch (error) {
        console.error('❌ Fehler beim Laden der Positionen für Ansprechpartner-Filter:', error);
      }

      // Sprachen (UUID-Feld) - Lade alle verfügbaren Sprachen
      try {
        const { data: sprachen, error } = await window.supabase
          .from('sprachen')
          .select('id, name')
          .order('name');

        if (!error && sprachen) {
          filterOptions.sprache_id = sprachen.map(s => ({
            value: s.id,
            label: s.name
          }));
        }
      } catch (error) {
        console.error('❌ Fehler beim Laden der Sprachen für Ansprechpartner-Filter:', error);
      }

      // Stadt (String-Feld) - Distinct values aus der Datenbank
      const allStaedte = new Set();
      data.forEach(item => {
        if (item.stadt) {
          allStaedte.add(item.stadt);
        }
      });
      filterOptions.stadt = Array.from(allStaedte).sort();

      // Unternehmen (UUID-Feld) - Lade alle verfügbaren Unternehmen
      try {
        const { data: unternehmen, error } = await window.supabase
          .from('unternehmen')
          .select('id, firmenname')
          .order('firmenname');

        if (!error && unternehmen) {
          filterOptions.unternehmen_id = unternehmen.map(u => ({
            value: u.id,
            label: u.firmenname
          }));
        }
      } catch (error) {
        console.error('❌ Fehler beim Laden der Unternehmen für Ansprechpartner-Filter:', error);
      }

    } else if (entityType === 'marke') {
      // Branche (String-Feld)
      const allBranchen = new Set();
      data.forEach(item => {
        if (item.branche) {
          allBranchen.add(item.branche);
        }
      });
      filterOptions.branche = Array.from(allBranchen).sort();

      // Unternehmen (UUID-Feld) - Lade Unternehmen-Namen
      const unternehmenIds = [...new Set(data.map(item => item.unternehmen_id).filter(Boolean))];
      if (unternehmenIds.length > 0) {
        try {
          const { data: unternehmen, error } = await window.supabase
            .from('unternehmen')
            .select('id, firmenname')
            .in('id', unternehmenIds);

          if (!error && unternehmen) {
            filterOptions.unternehmen_id = unternehmen.map(u => ({
              value: u.id,
              label: u.firmenname
            }));
          }
        } catch (error) {
          console.error('❌ Fehler beim Laden der Unternehmen für Marken-Filter:', error);
        }
      }
    }

    return filterOptions;
  }

  // Delegates zu MockProvider (Backward-Kompatibilität)
  getMockData(entityType) {
    return getMockData(entityType);
  }

  getMockFilterData(entityType) {
    return getMockFilterData(entityType);
  }
}

// Exportiere Instanz
export const dataService = new DataService();

// Globale Verfügbarkeit für Kompatibilität
if (typeof window !== 'undefined') {
  window.DataService = dataService;
  
  // Alte Service-Namen für Kompatibilität
  window.CreatorService = {
    loadFilterData: () => dataService.loadFilterData('creator'),
    loadCreators: (filters) => dataService.loadEntities('creator', filters),
    createEntity: (data) => dataService.createEntity('creator', data),
    updateEntity: (id, data) => dataService.updateEntity('creator', id, data),
    deleteEntity: (id) => dataService.deleteEntity('creator', id)
  };
} 