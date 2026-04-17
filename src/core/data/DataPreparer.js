import { EntityRegistry } from './entities/index.js';

export class DataPreparer {
  constructor() {
    this.entities = EntityRegistry;
  }

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
}
