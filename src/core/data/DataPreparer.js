import { EntityRegistry, EntityModules } from './entities/index.js';

export class DataPreparer {
  constructor() {
    this.entities = EntityRegistry;
  }

  async prepareDataForSupabase(data, fieldConfig, entityType) {
    const supabaseData = {};
    const mod = EntityModules[entityType];

    if (mod?.prepareForSupabase) {
      mod.prepareForSupabase(data);
    }
    
    if (!fieldConfig) {
      console.warn('⚠️ fieldConfig ist undefined - verwende Standard-Behandlung');
      return data;
    }
    
    for (const [field, rawValue] of Object.entries(data)) {
      if (mod?.skipFieldForSupabase?.(field, rawValue, this.entities)) {
        continue;
      }

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
      
      if (mod?.transformFieldValue) {
        const result = mod.transformFieldValue(field, value);
        if (result.handled) {
          value = result.value;
        }
      }

      if (mod?.transformFieldForSupabase) {
        const handled = await mod.transformFieldForSupabase(field, value, supabaseData, window.supabase);
        if (handled) continue;
      }
      
      // Spezielle Behandlung für marke_ids - für Ansprechpartner Many-to-Many
      if (field === 'marke_ids' || field === 'marke_ids[]') {
        console.log(`🏷️ Verarbeite ${field} für Ansprechpartner:`, value);
        continue;
      }
      
      // Spezielle Behandlung für sprachen_ids - für Ansprechpartner Many-to-Many
      if (field === 'sprachen_ids' || field === 'sprachen_ids[]') {
        console.log(`🏷️ Verarbeite ${field} für Ansprechpartner:`, value);
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
        field === 'brutto_gesamt_budget'
      ) {
        if (field.endsWith('_ids') || field.endsWith('_ids[]')) {
          const singularField = field.replace('_ids[]', '_id').replace('_ids', '_id');
          
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
      
      let fieldType = null;
      if (Array.isArray(fieldConfig)) {
        const fieldDef = fieldConfig.find(f => f.name === field);
        fieldType = fieldDef?.type;
      } else if (fieldConfig && typeof fieldConfig === 'object') {
        fieldType = fieldConfig[field];
      }
      
      if (fieldType) {
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
            supabaseData[field] = value === 'on' || value === true || value === 'true' ? true : false;
            break;
          default:
            if (fieldType === 'string' && typeof value === 'string' && value.trim() === '') {
              supabaseData[field] = null;
            } else {
              supabaseData[field] = value || null;
            }
        }
      } else {
        if (field === 'created_by_id' || field === 'updated_by_id' || field === 'po_nummer') {
          supabaseData[field] = value || null;
          console.log(`✅ Meta-Feld ${field} übernommen: ${value}`);
        } else {
          console.log(`🔧 Ignoriere unbekanntes Feld für ${entityType}: ${field}`);
        }
      }
    }
    
    return supabaseData;
  }
}
