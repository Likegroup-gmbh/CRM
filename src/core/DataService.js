// DataService.js (ES6-Modul)
// Zentrale Datenverwaltung für alle Entitäten

export class DataService {
  constructor() {
    this.entities = {
      creator: {
        table: 'creator',
        displayField: 'vorname',
        fields: {
          vorname: 'string',
          nachname: 'string',
          instagram: 'string',
          instagram_follower: 'number',
          tiktok: 'string',
          tiktok_follower: 'number',
          telefonnummer: 'string',
          mail: 'string',
          portfolio_link: 'string',
          budget_letzte_buchung: 'number',
          lieferadresse_strasse: 'string',
          lieferadresse_hausnummer: 'string',
          lieferadresse_plz: 'string',
          lieferadresse_stadt: 'string',
          lieferadresse_land: 'string',
          notiz: 'string'
        },
        relations: {},
        manyToMany: {
          sprachen: {
            table: 'sprachen',
            junctionTable: 'creator_sprachen',
            localKey: 'creator_id',
            foreignKey: 'sprache_id',
            displayField: 'name'
          },
          branchen: {
            table: 'branchen_creator',
            junctionTable: 'creator_branchen',
            localKey: 'creator_id',
            foreignKey: 'branche_id',
            displayField: 'name'
          },
          creator_types: {
            table: 'creator_type',
            junctionTable: 'creator_creator_type',
            localKey: 'creator_id',
            foreignKey: 'creator_type_id',
            displayField: 'name'
          }
        },
        filters: ['vorname', 'nachname'],
        sortBy: 'created_at',
        sortOrder: 'desc'
      },
      ansprechpartner: {
        table: 'ansprechpartner',
        displayField: 'vorname',
        fields: {
          vorname: 'string',
          nachname: 'string',
          unternehmen_id: 'uuid',
          position_id: 'uuid',
          email: 'string',
          telefonnummer: 'string',
          telefonnummer_land_id: 'uuid',
          telefonnummer_office: 'string',
          telefonnummer_office_land_id: 'uuid',
          linkedin: 'string',
          stadt: 'string',
          geburtsdatum: 'date',
          sprache_id: 'uuid',
          notiz: 'string'
        },
        relations: {
          unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
          sprache: { table: 'sprachen', foreignKey: 'sprache_id', displayField: 'name' },
          position: { table: 'positionen', foreignKey: 'position_id', displayField: 'name' },
          telefonnummer_land: { table: 'eu_laender', foreignKey: 'telefonnummer_land_id', displayField: 'name_de' },
          telefonnummer_office_land: { table: 'eu_laender', foreignKey: 'telefonnummer_office_land_id', displayField: 'name_de' }
        },
        manyToMany: {
          unternehmen: {
            table: 'unternehmen',
            junctionTable: 'ansprechpartner_unternehmen',
            localKey: 'ansprechpartner_id',
            foreignKey: 'unternehmen_id',
            displayField: 'firmenname'
          },
          marken: {
            table: 'marke',
            junctionTable: 'ansprechpartner_marke',
            localKey: 'ansprechpartner_id',
            foreignKey: 'marke_id',
            displayField: 'markenname'
          },
          sprachen: {
            table: 'sprachen',
            junctionTable: 'ansprechpartner_sprache',
            localKey: 'ansprechpartner_id',
            foreignKey: 'sprache_id',
            displayField: 'name'
          }
        },
        filters: ['vorname', 'nachname', 'position_id', 'unternehmen_id', 'stadt', 'sprache_id'],
        sortBy: 'created_at',
        sortOrder: 'desc'
      },
      unternehmen: {
        table: 'unternehmen',
        displayField: 'firmenname',
        fields: [
          { name: 'firmenname', type: 'string' },
          { name: 'branche', type: 'string' },
          { name: 'branche_id', type: 'uuid', relationTable: 'unternehmen_branchen', relationField: 'branche_id' },
          { name: 'ansprechpartner', type: 'string' },
          { name: 'telefonnummer', type: 'string' },
          { name: 'invoice_email', type: 'string' },
          { name: 'rechnungsadresse_strasse', type: 'string' },
          { name: 'rechnungsadresse_hausnummer', type: 'string' },
          { name: 'rechnungsadresse_plz', type: 'string' },
          { name: 'rechnungsadresse_stadt', type: 'string' },
          { name: 'rechnungsadresse_land', type: 'string' },
          { name: 'webseite', type: 'string' },
          { name: 'status', type: 'string' },
          { name: 'notiz', type: 'string' }
        ],
        relations: {
          branche: { table: 'branchen', foreignKey: 'branche_id', displayField: 'name' }
        },
        manyToMany: {
          branchen: {
            table: 'branchen',
            junctionTable: 'unternehmen_branchen',
            localKey: 'unternehmen_id',
            foreignKey: 'branche_id',
            displayField: 'name'
          },
          ansprechpartner: {
            table: 'ansprechpartner',
            junctionTable: 'ansprechpartner_unternehmen',
            localKey: 'unternehmen_id',
            foreignKey: 'ansprechpartner_id',
            displayField: 'vorname'
          }
        },
        filters: ['firmenname', 'branche_id', 'status', 'rechnungsadresse_stadt', 'rechnungsadresse_land'],
        sortBy: 'created_at',
        sortOrder: 'desc'
      },
      kampagne: {
        table: 'kampagne',
        displayField: 'kampagnenname',
        fields: {
          kampagnenname: 'string',
          unternehmen_id: 'uuid',
          marke_id: 'uuid',
          auftrag_id: 'uuid',
          ziele: 'string',
          art_der_kampagne: 'array',
          kampagne_typ: 'string',
          start: 'date',
          deadline: 'date',
          kampagnen_nummer: 'number',
          drehort_typ_id: 'uuid',
          drehort_beschreibung: 'string',
          status_id: 'uuid',
          creatoranzahl: 'number',
          videoanzahl: 'number',
          budget_info: 'string'
        },
        relations: {
          unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
          marke: { table: 'marke', foreignKey: 'marke_id', displayField: 'markenname' },
          auftrag: { table: 'auftrag', foreignKey: 'auftrag_id', displayField: 'auftragsname' },
          drehort_typ: { table: 'drehort_typen', foreignKey: 'drehort_typ_id', displayField: 'name' },
          status: { table: 'kampagne_status', foreignKey: 'status_id', displayField: 'name' }
        },
        manyToMany: {
          ansprechpartner: {
            table: 'ansprechpartner',
            junctionTable: 'ansprechpartner_kampagne',
            localKey: 'kampagne_id',
            foreignKey: 'ansprechpartner_id',
            displayField: 'id,vorname,nachname,email'
          }
          ,
          mitarbeiter: {
            table: 'benutzer',
            junctionTable: 'kampagne_mitarbeiter',
            localKey: 'kampagne_id',
            foreignKey: 'mitarbeiter_id',
            displayField: 'name'
          }
        },
        filters: ['kampagnenname', 'unternehmen_id', 'marke_id', 'status_id', 'art_der_kampagne', 'start', 'deadline'],
        sortBy: 'created_at',
        sortOrder: 'desc'
      },
      kooperation: {
        table: 'kooperationen',
        displayField: 'id',
        fields: {
          name: 'string',
          creator_id: 'uuid',
          kampagne_id: 'uuid',
          briefing_id: 'uuid',
          unternehmen_id: 'uuid',
          status: 'string',
          status_id: 'uuid',
          content_art: 'string',
          skript_autor: 'string',
          nettobetrag: 'number',
          zusatzkosten: 'number',
          gesamtkosten: 'number',
          vertrag_unterschrieben: 'boolean',
          vertrag_link: 'string',
          videoanzahl: 'number',
          skript_deadline: 'date',
          skript_link: 'string',
          content_deadline: 'date',
          content_link: 'string',
          bewertung: 'number',
          budget: 'number',
          start_datum: 'date',
          end_datum: 'date',
          notiz: 'string'
        },
        relations: {
          creator: { table: 'creator', foreignKey: 'creator_id', displayField: 'vorname' },
          kampagne: { table: 'kampagne', foreignKey: 'kampagne_id', displayField: 'name' },
          briefing: { table: 'briefings', foreignKey: 'briefing_id', displayField: 'product_service_offer' }
        },
        filters: ['creator_id', 'kampagne_id', 'status', 'budget', 'start_datum', 'end_datum'],
        sortBy: 'created_at',
        sortOrder: 'desc'
      },
      briefing: {
        table: 'briefings',
        displayField: 'product_service_offer',
        fields: {
          product_service_offer: 'string',
          produktseite_url: 'string',
          creator_aufgabe: 'string',
          usp: 'string',
          zielgruppe: 'string',
          zieldetails: 'string',
          deadline: 'date',
          dos: 'string',
          donts: 'string',
          rechtlicher_hinweis: 'string',
          unternehmen_id: 'uuid',
          marke_id: 'uuid',
          kampagne_id: 'uuid',
          status: 'string',
          assignee_id: 'uuid',
          kooperation_id: 'uuid',
          created_at: 'date',
          updated_at: 'date'
        },
        relations: {
          unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
          marke: { table: 'marke', foreignKey: 'marke_id', displayField: 'markenname' },
          kampagne: { table: 'kampagne', foreignKey: 'kampagne_id', displayField: 'kampagnenname' },
          assignee: { table: 'benutzer', foreignKey: 'assignee_id', displayField: 'name' }
        },
        filters: ['product_service_offer', 'unternehmen_id', 'marke_id', 'status', 'assignee_id', 'deadline', 'created_at'],
        sortBy: 'created_at',
        sortOrder: 'desc'
      },
      creator_type: {
        table: 'creator_type',
        displayField: 'name',
        fields: {
          name: 'string',
          beschreibung: 'string'
        },
        filters: ['name'],
        sortBy: 'name',
        sortOrder: 'asc'
      },
      sprachen: {
        table: 'sprachen',
        displayField: 'name',
        fields: {
          name: 'string',
          code: 'string'
        },
        filters: ['name'],
        sortBy: 'name',
        sortOrder: 'asc'
      },
      branchen_creator: {
        table: 'branchen_creator',
        displayField: 'name',
        fields: {
          name: 'string',
          beschreibung: 'string'
        },
        filters: ['name'],
        sortBy: 'name',
        sortOrder: 'asc'
      },
      benutzer: {
        table: 'benutzer',
        displayField: 'name',
        fields: {
          name: 'string',
          email: 'string',
          rolle: 'string',
          unterrolle: 'string',
          zugriffsrechte: 'json',
          auth_user_id: 'uuid',
          profile_image_url: 'string',
          mitarbeiter_klasse_id: 'uuid',
          freigeschaltet: 'boolean',
          updated_at: 'date'
        },
        relations: {
          mitarbeiter_klasse: { table: 'mitarbeiter_klasse', foreignKey: 'mitarbeiter_klasse_id', displayField: 'name' }
        }
      },
      kunden: {
        table: 'benutzer',
        displayField: 'name',
        fields: {
          name: 'string',
          email: 'string',
          rolle: 'string',
          unterrolle: 'string',
          freigeschaltet: 'boolean',
          created_at: 'date',
          updated_at: 'date'
        },
        relations: {},
        manyToMany: {
          unternehmen: {
            table: 'unternehmen',
            junctionTable: 'kunde_unternehmen',
            localKey: 'kunde_id',
            foreignKey: 'unternehmen_id',
            displayField: 'firmenname'
          },
          marken: {
            table: 'marke',
            junctionTable: 'kunde_marke',
            localKey: 'kunde_id',
            foreignKey: 'marke_id',
            displayField: 'markenname'
          }
        },
        filters: ['name', 'email', 'rolle', 'unterrolle'],
        sortBy: 'created_at',
        sortOrder: 'desc'
      },
      kampagne_status: {
        table: 'kampagne_status',
        displayField: 'name',
        fields: {
          name: 'string',
          beschreibung: 'string',
          sort_order: 'number',
          created_at: 'date',
          updated_at: 'date'
        }
      },
      plattform_typen: {
        table: 'plattform_typen',
        displayField: 'name',
        fields: {
          name: 'string',
          beschreibung: 'string',
          created_at: 'date',
          updated_at: 'date'
        }
      },
      format_typen: {
        table: 'format_typen',
        displayField: 'name',
        fields: {
          name: 'string',
          beschreibung: 'string',
          created_at: 'date',
          updated_at: 'date'
        }
      },
      marke: {
        table: 'marke',
        displayField: 'markenname',
        fields: {
          markenname: 'string',
          unternehmen_id: 'uuid',
          webseite: 'string',
          branche: 'string',
          branche_id: 'uuid',               // ← Hinzugefügt für Filter
          created_at: 'date',
          updated_at: 'date'
        },
        relations: {
          unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' }
        },
        manyToMany: {
          branchen: {
            table: 'branchen',
            junctionTable: 'marke_branchen',
            localKey: 'marke_id',
            foreignKey: 'branche_id',
            displayField: 'name'
          },
          ansprechpartner: {
            table: 'ansprechpartner',
            junctionTable: 'ansprechpartner_marke',
            localKey: 'marke_id',
            foreignKey: 'ansprechpartner_id',
            displayField: 'id,vorname,nachname,email'
          },
          mitarbeiter: {
            table: 'benutzer',
            junctionTable: 'marke_mitarbeiter',
            localKey: 'marke_id',
            foreignKey: 'mitarbeiter_id',
            displayField: 'name',
            additionalFields: 'created_at,assigned_by'
          }
        },
        filters: ['markenname', 'unternehmen_id', 'branche_id'],
        sortBy: 'created_at',
        sortOrder: 'desc'
      },
      auftrag: {
        table: 'auftrag',
        displayField: 'auftragsname',
        fields: {
          auftragsname: 'string',
          unternehmen_id: 'uuid',
          marke_id: 'uuid',
          status: 'string',
          ansprechpartner_id: 'uuid',
          po: 'string',
          re_nr: 'string',
          re_faelligkeit: 'date',
          kampagnenanzahl: 'number',
          start: 'date',
          ende: 'date',
          nettobetrag: 'number',
          ust_prozent: 'number',
          ust_betrag: 'number',
          bruttobetrag: 'number',
          rechnung_gestellt: 'boolean',
          ueberwiesen: 'boolean'
        },
        relations: {
          unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
          marke: { table: 'marke', foreignKey: 'marke_id', displayField: 'markenname' },
          ansprechpartner: { table: 'ansprechpartner', foreignKey: 'ansprechpartner_id', displayField: 'vorname' }
        },
        manyToMany: {
          mitarbeiter: {
            table: 'benutzer',
            junctionTable: 'auftrag_mitarbeiter',
            localKey: 'auftrag_id',
            foreignKey: 'mitarbeiter_id',
            displayField: 'name'
          },
          cutter: {
            table: 'benutzer',
            junctionTable: 'auftrag_cutter',
            localKey: 'auftrag_id',
            foreignKey: 'mitarbeiter_id',
            displayField: 'name'
          },
          copywriter: {
            table: 'benutzer',
            junctionTable: 'auftrag_copywriter',
            localKey: 'auftrag_id',
            foreignKey: 'mitarbeiter_id',
            displayField: 'name'
          }
        },
        filters: ['auftragsname', 'status', 'unternehmen_id', 'marke_id', 'ansprechpartner_id'],
        sortBy: 'created_at',
        sortOrder: 'desc'
      },
      auftrag_details: {
        table: 'auftrag_details',
        displayField: 'id',
        fields: {
          auftrag_id: 'uuid',
          kampagnenanzahl: 'number',
          ugc_video_anzahl: 'number',
          ugc_creator_anzahl: 'number',
          ugc_budget_info: 'text',
          influencer_video_anzahl: 'number',
          influencer_creator_anzahl: 'number',
          influencer_budget_info: 'text',
          vor_ort_video_anzahl: 'number',
          vor_ort_creator_anzahl: 'number',
          vor_ort_videographen_anzahl: 'number',
          vor_ort_budget_info: 'text',
          vor_ort_mitarbeiter_video_anzahl: 'number',
          vor_ort_mitarbeiter_videographen_anzahl: 'number',
          vor_ort_mitarbeiter_budget_info: 'text',
          gesamt_videos: 'number',
          gesamt_creator: 'number'
        },
        relations: {
          auftrag: { table: 'auftrag', foreignKey: 'auftrag_id', displayField: 'auftragsname' }
        },
        filters: ['auftrag_id', 'kampagnenanzahl', 'gesamt_videos', 'gesamt_creator', 'created_at'],
        sortBy: 'created_at',
        sortOrder: 'desc'
      }
      ,
      rechnung: {
        table: 'rechnung',
        displayField: 'rechnung_nr',
        fields: {
          rechnung_nr: 'string',
          kooperation_id: 'uuid',
          kampagne_id: 'uuid',
          creator_id: 'uuid',
          auftrag_id: 'uuid',
          unternehmen_id: 'uuid',
          videoanzahl: 'number',
          nettobetrag: 'number',
          zusatzkosten: 'number',
          bruttobetrag: 'number',
          gestellt_am: 'date',
          zahlungsziel: 'date',
          bezahlt_am: 'date',
          status: 'string',
          geprueft: 'boolean',
          pdf_url: 'string',
          pdf_path: 'string',
          created_at: 'date',
          updated_at: 'date'
        },
        relations: {
          unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
          auftrag: { table: 'auftrag', foreignKey: 'auftrag_id', displayField: 'auftragsname' },
          kooperation: { table: 'kooperationen', foreignKey: 'kooperation_id', displayField: 'name' },
          creator: { table: 'creator', foreignKey: 'creator_id', displayField: 'vorname' },
          kampagne: { table: 'kampagne', foreignKey: 'kampagne_id', displayField: 'kampagnenname' }
        },
        filters: ['rechnung_nr', 'kooperation_id', 'kampagne_id', 'unternehmen_id', 'auftrag_id', 'status', 'gestellt_am', 'zahlungsziel', 'bezahlt_am', 'nettobetrag'],
        sortBy: 'created_at',
        sortOrder: 'desc'
      }
      ,
      creator_list: {
        table: 'creator_list',
        displayField: 'name',
        fields: {
          name: 'string',
          beschreibung: 'string',
          created_by: 'uuid',
          created_at: 'date',
          updated_at: 'date'
        },
        relations: {},
        filters: ['name', 'created_at'],
        sortBy: 'created_at',
        sortOrder: 'desc'
      }
    };
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

      // Koop: content_art-Fallback aus erstem Video-Item ableiten (für alte NOT NULL-Constraint)
      if (entityType === 'kooperation' && (!data.content_art || data.content_art === '')) {
        try {
          const firstVideoContent = Object.entries(data)
            .filter(([k, v]) => k.startsWith('video_content_art_') && v)
            .map(([, v]) => v)[0];
          if (firstVideoContent) {
            data.content_art = firstVideoContent;
          } else {
            // Fallback, falls DB noch NOT NULL verlangt
            data.content_art = 'N/A';
          }
        } catch (_) {
          data.content_art = 'N/A';
        }
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
        return this.getMockData(entityType);
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
                    firmenname
                  ),
                  sprache:sprache_id (
                    id,
                    name
                  ),
                  position:position_id (
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
                  )
                `)
                .order('created_at', { ascending: false });

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
                    auftragsname
                  ),
                  creator:creator_id (
                    id,
                    vorname,
                    nachname
                  ),
                  kooperation:kooperation_id (
                    id,
                    name
                  )
                `)
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
            } else {
              // Standard-Query für andere Entitäten
              query = window.supabase
                .from(entityConfig.table)
                .select('*')
                .order('created_at', { ascending: false });
            }

      // Filter anwenden (generisch)
      query = await this.applyFilters(query, filters, entityConfig.fields, entityType);

      // Daten aus Supabase laden
      const { data, error } = await query;

      if (error) {
        console.error(`❌ Supabase Fehler beim Laden von ${entityType}:`, error);
        return [];
      }

      console.log(`✅ ${entityType} aus Supabase geladen:`, data?.length || 0);
      
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
      
      // Lade Many-to-Many Beziehungen falls konfiguriert
      if (data && entityConfig.manyToMany) {
        await this.loadManyToManyRelations(data, entityType, entityConfig.manyToMany);
      }

      // Spezielle Projektion für Creator: Arrays direkt an Top-Level anhängen
      if (entityType === 'creator' && data) {
        data.forEach(c => {
          // ensure arrays exist for rendering
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
          // Für Unternehmen: branche_id, für Marke und Creator: branche_ids
          fieldName = (entityType === 'unternehmen') ? 'branche_id' : 'branche_ids';
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
              } catch (_) {}
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

  // Lade Many-to-Many Beziehungen für Entitäten
  async loadManyToManyRelations(entities, entityType, manyToManyConfig) {
    try {
      for (const [relationName, config] of Object.entries(manyToManyConfig)) {
        console.log(`🔗 Lade Many-to-Many Beziehung: ${entityType}.${relationName}`);
        
        // Sammle alle Entity-IDs
        const entityIds = entities.map(entity => entity.id).filter(id => id);
        
        if (entityIds.length === 0) continue;
        
        // Lade Junction-Daten mit JOIN zur Ziel-Tabelle
        const { data: junctionData, error } = await window.supabase
          .from(config.junctionTable)
          .select(`
            ${config.localKey},
            ${config.foreignKey},
            ${config.table}!${config.foreignKey} (
              id,
              ${config.displayField}
            )
          `)
          .in(config.localKey, entityIds);
        
        if (error) {
          console.error(`❌ Fehler beim Laden der Many-to-Many Beziehung ${relationName}:`, error);
          continue;
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
        
        // Füge Beziehungsdaten zu Entitäten hinzu
        entities.forEach(entity => {
          entity[relationName] = groupedData[entity.id] || [];
        });
        
        console.log(`✅ Many-to-Many Beziehung ${relationName} geladen für ${entities.length} Entitäten`);
      }
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
      // Kooperation: dynamische Video-Felder NICHT in kooperationen schreiben
      if (
        entityType === 'kooperation' && (
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
      
      // Spezielle Behandlung für Marke Many-to-Many Felder
      if (entityType === 'marke' && (
        field === 'branche_ids' || field === 'branche_ids[]'
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
        field === 'plattform_ids' || field === 'plattform_ids[]' ||
        field === 'format_ids' || field === 'format_ids[]'
      )) {
        console.log(`🏷️ Verarbeite ${field} für Kampagne:`, value);
        // Kampagne Many-to-Many Felder werden über handleManyToManyRelations verwaltet - hier überspringen
        continue;
      }
      
      // art_der_kampagne ist ein direktes Array-Feld (kein Junction Table) - normal verarbeiten
      
      // Datei-/virtuelle Felder überspringen (werden separat gehandhabt)
      if (
        field === 'pdf_file' || field.endsWith('_file') ||
        field.endsWith('_ids') || field.endsWith('_ids[]') ||
        field === 'mitarbeiter_ids' || field === 'kampagne_adressen' ||
        field === 'plattform_ids' || field === 'format_ids' ||
        field.startsWith('adressname_') || field.startsWith('strasse_') ||
        field.startsWith('hausnummer_') || field.startsWith('plz_') ||
        field.startsWith('stadt_') || field.startsWith('land_') ||
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
            supabaseData[field] = value ? parseFloat(value) : null;
            break;
          case 'array':
            supabaseData[field] = Array.isArray(value) ? value : (value ? [value] : null);
            break;
          case 'date':
            supabaseData[field] = value ? new Date(value).toISOString() : null;
            break;
          case 'boolean':
            // Toggle-Felder behandeln
            supabaseData[field] = value === 'on' || value === true || value === 'true' ? true : false;
            break;
          default: // string, uuid, etc.
            supabaseData[field] = value || null;
        }
      } else {
        // Felder ohne Konfiguration NICHT übernehmen (um DB-400 zu vermeiden)
        console.log(`🔧 Ignoriere unbekanntes Feld für ${entityType}: ${field}`);
      }
    }
    
    return supabaseData;
  }

  async applyFilters(query, filters, fieldConfig, entityType) {
    for (const [field, value] of Object.entries(filters)) {
      // Spezielle Behandlung für Name-Filter (sucht in vorname UND nachname)
      if (field === 'name' && value) {
        query = query.or(`vorname.ilike.%${value}%,nachname.ilike.%${value}%`);
        continue;
      }
      
      if (value && fieldConfig[field]) {
        const fieldType = fieldConfig[field];
        
        // Stelle sicher, dass der Wert als String behandelt wird
        const stringValue = typeof value === 'object' ? '' : String(value);
        
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
            if (field === 'firmenname' || field === 'markenname' || field === 'name') {
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
              // Spezieller Fix: Unternehmen nach Branche filtern, auch wenn mehrere Branchen als Textfeld gespeichert sind
              if (entityType === 'unternehmen' && field === 'branche_id') {
                try {
                  let branchName = null;
                  if (window.supabase) {
                    const { data: brancheRow, error } = await window.supabase
                      .from('branchen')
                      .select('name')
                      .eq('id', stringValue)
                      .single();
                    if (!error) branchName = brancheRow?.name || null;
                  }
                  if (branchName) {
                    // Treffer wenn entweder die primäre branche_id passt ODER der Name in der kommagetrennten 'branche' enthalten ist
                    query = query.or(`branche_id.eq.${stringValue},branche.ilike.%${branchName}%`);
                  } else {
                    query = query.eq(field, stringValue);
                  }
                } catch (_) {
                  query = query.eq(field, stringValue);
                }
              } else {
                query = query.eq(field, stringValue);
              }
            }
            break;
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
        return this.getMockFilterData(entityType);
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
        return this.getMockFilterData(entityType);
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
      return this.getMockFilterData(entityType);
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

  // Mock-Daten als Fallback
  getMockData(entityType) {
    console.log(`🔍 Lade Mock-Daten für ${entityType}`);
    switch (entityType) {
      case 'unternehmen':
        return [
          {
            id: '1',
            firmenname: 'Beispiel GmbH',
            branche: 'Tech',
            webseite: 'https://beispiel.de',
            created_at: new Date().toISOString()
          },
          {
            id: '2',
            firmenname: 'Test AG',
            branche: 'Business',
            webseite: 'https://test.de',
            created_at: new Date().toISOString()
          }
        ];
      case 'marke':
        return [
          {
            id: '1',
            markenname: 'Beispiel Marke',
            unternehmen_id: '1',
            branche: 'Tech',
            webseite: 'https://marke.de',
            created_at: new Date().toISOString(),
            unternehmen: {
              id: '1',
              firmenname: 'Beispiel GmbH'
            }
          }
        ];
            default:
              return [];
          }
        }

  // Mock-Filter-Daten als Fallback
  getMockFilterData(entityType) {
    const filterData = {
      creator: {
        sprachen: ['Deutsch', 'Englisch', 'Französisch', 'Spanisch'],
        branche: ['Mode', 'Beauty', 'Fitness', 'Food', 'Tech', 'Lifestyle'],
        creator_type: ['Influencer', 'Content Creator', 'Künstler', 'Experte'],
        instagram_follower_min: 1000,
        instagram_follower_max: 1000000
      },
      unternehmen: {
        branche: ['Mode', 'Beauty', 'Fitness', 'Food', 'Tech', 'Lifestyle']
      },
      marke: {
        branche: [
          { value: 'Beauty & Fashion', label: 'Beauty & Fashion' },
          { value: 'Fitness & Gesundheit', label: 'Fitness & Gesundheit' },
          { value: 'Food & Lifestyle', label: 'Food & Lifestyle' },
          { value: 'Gaming', label: 'Gaming' },
          { value: 'Tech', label: 'Tech' },
          { value: 'Travel', label: 'Travel' },
          { value: 'Business', label: 'Business' },
          { value: 'Education', label: 'Education' }
        ],
        unternehmen_id: [
          { value: '1', label: 'Beispiel GmbH' },
          { value: '2', label: 'Test AG' }
        ]
      },
      kampagne: {
        status: ['Aktiv', 'In Planung', 'Abgeschlossen', 'Pausiert'],
        budget_min: 1000,
        budget_max: 50000
      },
      kooperation: {
        status: ['Angefragt', 'Bestätigt', 'In Bearbeitung', 'Abgeschlossen', 'Abgelehnt'],
        budget_min: 500,
        budget_max: 10000
      }
    };

    return filterData[entityType] || {};
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