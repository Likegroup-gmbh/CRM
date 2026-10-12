// Wandelt die Filterwerte der Creator-Übersicht in Filterobjekte
// (type, value) für Supabase und den lokalen Abgleich.

import { settleRezensionFilters } from '../rezension.js';

export function processCreatorFilters(filters) {
  const processedFilters = {};
  const settled = settleRezensionFilters(filters);

  for (const [key, value] of Object.entries(settled)) {
    if (key.startsWith('_')) continue;
    // false ist ein gültiger Boolean-Filter ("Hat kein Haustier")
    if (value === '' || value === null || value === undefined) continue;

    switch (key) {
      case 'name':
        processedFilters[key] = {
          type: 'name_search',
          value: value,
          searchFields: ['vorname', 'nachname', 'instagram', 'tiktok']
        };
        break;

      case 'groesse':
        processedFilters[key] = {
          type: 'groesse_in',
          value: Array.isArray(value) ? value : [value]
        };
        break;

      case 'generation':
        processedFilters[key] = {
          type: 'generation',
          value
        };
        break;

      case 'instagram_follower':
      case 'tiktok_follower':
        // Follower-Range Filter
        if (typeof value === 'object') {
          processedFilters[key] = {
            type: 'number_range',
            min: value.min || 0,
            max: value.max || null
          };
        } else {
          processedFilters[key] = {
            type: 'number_min',
            value: parseInt(value)
          };
        }
        break;

      case 'alter':
        // Spezielle Alters-Range Filter (mappt auf alter_min/alter_max)
        if (typeof value === 'object') {
          processedFilters[key] = {
            type: 'age_range',
            min: value.min != null && value.min !== '' ? parseInt(value.min) : null,
            max: value.max != null && value.max !== '' ? parseInt(value.max) : null
          };
        }
        break;

      case 'has_email':
        // Virtual Filter: Email vorhanden
        processedFilters['mail'] = {
          type: 'not_null',
          value: value
        };
        break;

      case 'has_instagram':
        processedFilters['instagram'] = {
          type: 'not_null',
          value: value
        };
        break;

      case 'has_tiktok':
        processedFilters['tiktok'] = {
          type: 'not_null',
          value: value
        };
        break;

      case 'has_phone':
        // Virtual Filter: Telefon vorhanden
        processedFilters['telefonnummer'] = {
          type: 'not_null',
          value: value
        };
        break;

      case 'has_portfolio':
        // Virtual Filter: Portfolio vorhanden
        processedFilters['portfolio_link'] = {
          type: 'not_null',
          value: value
        };
        break;

      case 'created_at':
      case 'updated_at':
        // Datum-Range Filter
        if (typeof value === 'object') {
          processedFilters[key] = {
            type: 'date_range',
            from: value.from || null,
            to: value.to || null
          };
        }
        break;

      case 'lieferadresse_stadt':
      case 'lieferadresse_plz':
        // Stadt-/PLZ-Filter mit Like-Suche
        processedFilters[key] = {
          type: 'text_search',
          value: value
        };
        break;

      case 'ig_engagement_rate':
      case 'budget_letzte_buchung':
        if (typeof value === 'object') {
          processedFilters[key] = {
            type: 'number_range',
            min: value.min ?? null,
            max: value.max ?? null
          };
        }
        break;

      case 'sprache_id':
      case 'branche_id':
      case 'branche':
      case 'creator_type_id':
      case 'kunde_id':
      case 'management_id':
      case 'firma_id':
      case 'besitz_id':
      case 'favorit_von':
      case 'creator_tag_id':
        // M:N-Filter werden in DataService über Junction-Tabellen aufgelöst
        break;

      case 'rezension_min': {
        const min = Number(value);
        if (min >= 1 && min <= 5) {
          processedFilters.rezension_schnitt = { type: 'rezension_min', value: min };
        }
        break;
      }

      case 'rezension_ohne':
        if (value === true) {
          processedFilters.rezension_schnitt = { type: 'rezension_ohne' };
        }
        break;

      default:
        // Standard-Filter (Select, etc.); mehrere Werte aus der Filterspalte: einer davon
        processedFilters[key] = Array.isArray(value)
          ? { type: 'in', value }
          : { type: 'equals', value };
        break;
    }
  }

  return processedFilters;
}
