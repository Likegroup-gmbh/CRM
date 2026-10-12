// CreatorFilterLogic.js (ES6-Modul)
// Creator-spezifische Filter-Verarbeitungslogik

import { BASE_VALIDATORS } from '../../../core/filters/BaseFilterConfig.js';
import {
  GENERATIONEN,
  groesseOf,
  generationOf,
  matchesTokens,
  searchTokens
} from '../creatorProfil.js';
import { matchesRezension, settleRezensionFilters } from '../rezension.js';

/**
 * Creator-spezifische Filter-Verarbeitung
 */
export class CreatorFilterLogic {
  
  /**
   * Verarbeite Creator-spezifische Filter
   */
  static processFilters(filters, rawData = null) {
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
          // Standard-Filter (Select, etc.)
          processedFilters[key] = {
            type: 'equals',
            value: value
          };
          break;
      }
    }

    return processedFilters;
  }

  /**
   * Validiere Creator-spezifische Filter
   */
  static validateFilters(filters) {
    const errors = [];

    // Instagram Follower Validierung
    if (filters.instagram_follower) {
      const follower = filters.instagram_follower;
      if (typeof follower === 'object') {
        if (follower.min && follower.max && follower.min > follower.max) {
          errors.push('Instagram Follower: Minimum darf nicht größer als Maximum sein');
        }
        if (follower.min && follower.min < 0) {
          errors.push('Instagram Follower: Minimum darf nicht negativ sein');
        }
      }
    }

    // TikTok Follower Validierung
    if (filters.tiktok_follower) {
      const follower = filters.tiktok_follower;
      if (typeof follower === 'object') {
        if (follower.min && follower.max && follower.min > follower.max) {
          errors.push('TikTok Follower: Minimum darf nicht größer als Maximum sein');
        }
        if (follower.min && follower.min < 0) {
          errors.push('TikTok Follower: Minimum darf nicht negativ sein');
        }
      }
    }

    // Alter Validierung
    if (filters.alter && typeof filters.alter === 'object') {
      if (filters.alter.min && filters.alter.max && filters.alter.min > filters.alter.max) {
        errors.push('Alter: Minimum darf nicht größer als Maximum sein');
      }
      if (filters.alter.min && filters.alter.min < 0) {
        errors.push('Alter: Minimum darf nicht negativ sein');
      }
    }

    // Datum-Range Validierung
    if (filters.created_at && typeof filters.created_at === 'object') {
      if (!BASE_VALIDATORS.dateRange(filters.created_at)) {
        errors.push('Erstellungsdatum: Von-Datum darf nicht nach Bis-Datum liegen');
      }
    }

    if (filters.updated_at && typeof filters.updated_at === 'object') {
      if (!BASE_VALIDATORS.dateRange(filters.updated_at)) {
        errors.push('Aktualisierungsdatum: Von-Datum darf nicht nach Bis-Datum liegen');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generiere SQL-Query für Creator-Filter (Supabase)
   */
  static buildSupabaseQuery(query, filters) {
    const processedFilters = this.processFilters(filters);

    for (const [field, filter] of Object.entries(processedFilters)) {
      switch (filter.type) {
        case 'name_search':
          query = applyNameTokens(query, filter.value);
          break;

        case 'groesse_in':
          if (filter.value?.length) query = query.in('groesse', filter.value);
          break;

        case 'generation':
          query = applyGeneration(query, filter.value);
          break;

        case 'rezension_min':
          query = query.gte('rezension_schnitt', filter.value);
          break;

        case 'rezension_ohne':
          query = query.is('rezension_schnitt', null);
          break;

        case 'number_range':
          if (filter.min !== null) {
            query = query.gte(field, filter.min);
          }
          if (filter.max !== null) {
            query = query.lte(field, filter.max);
          }
          break;

        case 'number_min':
          query = query.gte(field, filter.value);
          break;

        case 'age_range':
          // Alters-Filter: Prüfe ob Creator im Altersbereich liegt
          // Nutzt alter_min/alter_max mit Fallback auf alter_jahre (Legacy)
          if (filter.min !== null && filter.max !== null) {
            // Beide angegeben: Creator-Range muss überlappen
            // alter_min >= filterMin ODER alter_jahre >= filterMin
            // UND alter_max <= filterMax ODER alter_min <= filterMax (wenn kein alter_max) ODER alter_jahre <= filterMax
            query = query.or(`alter_min.gte.${filter.min},alter_jahre.gte.${filter.min}`);
            query = query.or(`alter_max.lte.${filter.max},alter_min.lte.${filter.max},alter_jahre.lte.${filter.max}`);
          } else if (filter.min !== null) {
            // Nur min: Creator muss mindestens so alt sein
            query = query.or(`alter_min.gte.${filter.min},alter_jahre.gte.${filter.min}`);
          } else if (filter.max !== null) {
            // Nur max: Creator darf höchstens so alt sein
            query = query.or(`alter_max.lte.${filter.max},alter_min.lte.${filter.max},alter_jahre.lte.${filter.max}`);
          }
          break;

        case 'not_null':
          if (filter.value) {
            query = query.not(field, 'is', null);
          } else {
            query = query.is(field, null);
          }
          break;

        case 'date_range':
          if (filter.from) {
            query = query.gte(field, filter.from);
          }
          if (filter.to) {
            query = query.lte(field, filter.to);
          }
          break;

        case 'text_search':
          query = query.ilike(field, `%${filter.value}%`);
          break;

        case 'equals':
          query = query.eq(field, filter.value);
          break;
      }
    }

    return query;
  }

  /**
   * Filtere lokale Daten (für Mock/Offline-Modus)
   */
  static filterLocalData(data, filters) {
    const processedFilters = this.processFilters(filters);

    return data.filter(item => {
      for (const [field, filter] of Object.entries(processedFilters)) {
        if (!this.matchesFilter(item, field, filter)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Prüfe ob ein Item einem Filter entspricht
   */
  static matchesFilter(item, field, filter) {
    const value = item[field];

    switch (filter.type) {
      case 'name_search':
        return matchesTokens(item, searchTokens(filter.value));

      case 'groesse_in':
        return filter.value.includes(item.groesse || groesseOf(item));

      case 'generation':
        return generationOf(item) === filter.value;

      case 'rezension_min':
      case 'rezension_ohne':
        return matchesRezension(item.rezension_schnitt, filter);

      case 'number_range':
        if (filter.min !== null && (value === null || value < filter.min)) return false;
        if (filter.max !== null && (value === null || value > filter.max)) return false;
        return true;

      case 'number_min':
        return value !== null && value >= filter.value;

      case 'not_null':
        return filter.value ? (value !== null && value !== '') : (value === null || value === '');

      case 'date_range':
        if (!value) return false;
        const itemDate = new Date(value);
        if (filter.from && itemDate < new Date(filter.from)) return false;
        if (filter.to && itemDate > new Date(filter.to)) return false;
        return true;

      case 'text_search':
        return value && value.toLowerCase().includes(filter.value.toLowerCase());

      case 'equals':
        return value === filter.value;

      default:
        return true;
    }
  }

  /**
   * Erstelle Filter-Zusammenfassung für UI
   */
  static createFilterSummary(filters) {
    const summary = [];
    const processedFilters = this.processFilters(filters);

    for (const [field, filter] of Object.entries(processedFilters)) {
      let label = '';
      
      switch (filter.type) {
        case 'name_search':
          label = `Name: "${filter.value}"`;
          break;
        case 'number_range':
          if (filter.min && filter.max) {
            label = `${field}: ${filter.min} - ${filter.max}`;
          } else if (filter.min) {
            label = `${field}: ab ${filter.min}`;
          } else if (filter.max) {
            label = `${field}: bis ${filter.max}`;
          }
          break;
        case 'equals':
          label = `${field}: ${filter.value}`;
          break;
      }

      if (label) {
        summary.push({
          field,
          label,
          removable: true
        });
      }
    }

    return summary;
  }
}

function applyNameTokens(query, raw) {
  const tokens = searchTokens(raw);
  for (const token of tokens) {
    const safe = token.replace(/[%_,.()]/g, '');
    if (!safe) continue;
    query = query.or(
      `vorname.ilike.${safe}%,nachname.ilike.${safe}%,instagram.ilike.${safe}%,tiktok.ilike.${safe}%,instagram.ilike.@${safe}%,tiktok.ilike.@${safe}%`
    );
  }
  return query;
}

function applyGeneration(query, label) {
  const band = GENERATIONEN.find((entry) => entry.label === label);
  if (!band) return query;
  const quoted = /[^a-zA-Z0-9_]/.test(label) ? `"${label.replace(/"/g, '')}"` : label;
  const until = band.to == null ? '2999-12-31' : `${band.to}-12-31`;
  const derived = `and(generation_override.is.null,geburtsdatum.gte.${band.from}-01-01,geburtsdatum.lte.${until},or(geschlecht.is.null,geschlecht.not.in.(paar,familie,tier)))`;
  return query.or(`generation_override.eq.${quoted},${derived}`);
}

export default CreatorFilterLogic;