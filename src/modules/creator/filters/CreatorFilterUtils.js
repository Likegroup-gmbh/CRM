// CreatorFilterUtils.js (ES6-Modul)
// Creator-spezifische Filter-Hilfsfunktionen

import { BASE_FORMATTERS } from '../../../core/filters/BaseFilterConfig.js';

/**
 * Creator-spezifische Filter-Hilfsfunktionen
 */
export class CreatorFilterUtils {

  /**
   * Formatiere Follower-Anzahl für Anzeige
   */
  static formatFollowerRange(min, max) {
    if (!min && !max) return '';
    
    const formatSingle = (value) => {
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toLocaleString('de-DE');
    };

    if (min && max) {
      return `${formatSingle(min)} - ${formatSingle(max)}`;
    } else if (min) {
      return `ab ${formatSingle(min)}`;
    } else if (max) {
      return `bis ${formatSingle(max)}`;
    }
    return '';
  }

  /**
   * Erstelle Follower-Range Optionen für UI
   */
  static getFollowerRangeOptions() {
    return [
      { value: { min: 0, max: 1000 }, label: '< 1K' },
      { value: { min: 1000, max: 10000 }, label: '1K - 10K' },
      { value: { min: 10000, max: 100000 }, label: '10K - 100K' },
      { value: { min: 100000, max: 1000000 }, label: '100K - 1M' },
      { value: { min: 1000000 }, label: '> 1M' }
    ];
  }

  /**
   * Extrahiere verfügbare Creator-Typen aus Daten
   */
  static extractCreatorTypes(creators) {
    const types = new Set();
    creators.forEach(creator => {
      if (creator.creator_type && creator.creator_type.name) {
        types.add({
          id: creator.creator_type_id,
          name: creator.creator_type.name
        });
      }
    });
    return Array.from(types);
  }

  /**
   * Extrahiere verfügbare Sprachen aus Daten
   */
  static extractLanguages(creators) {
    const languages = new Set();
    creators.forEach(creator => {
      if (creator.sprache && creator.sprache.name) {
        languages.add({
          id: creator.sprache_id,
          name: creator.sprache.name
        });
      }
    });
    return Array.from(languages);
  }

  /**
   * Extrahiere verfügbare Branchen aus Daten
   */
  static extractBranches(creators) {
    const branches = new Set();
    creators.forEach(creator => {
      if (creator.branche && creator.branche.name) {
        branches.add({
          id: creator.branche_id,
          name: creator.branche.name
        });
      }
    });
    return Array.from(branches);
  }

  /**
   * Extrahiere verfügbare Städte aus Daten
   */
  static extractCities(creators) {
    const cities = new Set();
    creators.forEach(creator => {
      if (creator.lieferadresse_stadt) {
        cities.add(creator.lieferadresse_stadt);
      }
    });
    return Array.from(cities).sort();
  }

  /**
   * Extrahiere verfügbare Länder aus Daten
   */
  static extractCountries(creators) {
    const countries = new Set();
    creators.forEach(creator => {
      if (creator.lieferadresse_land) {
        countries.add(creator.lieferadresse_land);
      }
    });
    return Array.from(countries).sort();
  }

  /**
   * Generiere Filter-Statistiken
   */
  static generateFilterStats(creators, filters = {}) {
    const stats = {
      total: creators.length,
      filtered: 0,
      byType: {},
      byLanguage: {},
      byBranch: {},
      byCountry: {},
      averageFollowers: {
        instagram: 0,
        tiktok: 0
      },
      contactInfo: {
        hasEmail: 0,
        hasPhone: 0,
        hasPortfolio: 0
      }
    };

    // Berechne Statistiken für alle Creator
    let instagramTotal = 0;
    let instagramCount = 0;
    let tiktokTotal = 0;
    let tiktokCount = 0;

    creators.forEach(creator => {
      // Typ-Statistiken
      const type = creator.creator_type?.name || 'Unbekannt';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Sprach-Statistiken
      const language = creator.sprache?.name || 'Unbekannt';
      stats.byLanguage[language] = (stats.byLanguage[language] || 0) + 1;

      // Branchen-Statistiken
      const branch = creator.branche?.name || 'Unbekannt';
      stats.byBranch[branch] = (stats.byBranch[branch] || 0) + 1;

      // Länder-Statistiken
      const country = creator.lieferadresse_land || 'Unbekannt';
      stats.byCountry[country] = (stats.byCountry[country] || 0) + 1;

      // Follower-Durchschnitt
      if (creator.instagram_follower && creator.instagram_follower > 0) {
        instagramTotal += creator.instagram_follower;
        instagramCount++;
      }
      if (creator.tiktok_follower && creator.tiktok_follower > 0) {
        tiktokTotal += creator.tiktok_follower;
        tiktokCount++;
      }

      // Kontakt-Info
      if (creator.mail) stats.contactInfo.hasEmail++;
      if (creator.telefonnummer) stats.contactInfo.hasPhone++;
      if (creator.portfolio_link) stats.contactInfo.hasPortfolio++;
    });

    // Durchschnittliche Follower berechnen
    stats.averageFollowers.instagram = instagramCount > 0 ? Math.round(instagramTotal / instagramCount) : 0;
    stats.averageFollowers.tiktok = tiktokCount > 0 ? Math.round(tiktokTotal / tiktokCount) : 0;

    return stats;
  }

  /**
   * Erstelle Export-Daten für gefilterte Creator
   */
  static createExportData(creators, includeFields = null) {
    const defaultFields = [
      'vorname',
      'nachname',
      'creator_type',
      'sprache',
      'branche',
      'instagram',
      'instagram_follower',
      'tiktok',
      'tiktok_follower',
      'mail',
      'telefonnummer',
      'lieferadresse_stadt',
      'lieferadresse_land',
      'created_at'
    ];

    const fields = includeFields || defaultFields;

    return creators.map(creator => {
      const exportItem = {};
      
      fields.forEach(field => {
        switch (field) {
          case 'creator_type':
            exportItem[field] = creator.creator_type?.name || '';
            break;
          case 'sprache':
            exportItem[field] = creator.sprache?.name || '';
            break;
          case 'branche':
            exportItem[field] = creator.branche?.name || '';
            break;
          case 'instagram_follower':
          case 'tiktok_follower':
            exportItem[field] = BASE_FORMATTERS.followerCount(creator[field]);
            break;
          case 'created_at':
          case 'updated_at':
            exportItem[field] = BASE_FORMATTERS.date(creator[field]);
            break;
          default:
            exportItem[field] = creator[field] || '';
            break;
        }
      });

      return exportItem;
    });
  }

  /**
   * Validiere Creator-Filter-Eingabe
   */
  static validateFilterInput(field, value) {
    switch (field) {
      case 'instagram_follower':
      case 'tiktok_follower':
        if (typeof value === 'object') {
          if (value.min && (isNaN(value.min) || value.min < 0)) {
            return { isValid: false, error: 'Minimum muss eine positive Zahl sein' };
          }
          if (value.max && (isNaN(value.max) || value.max < 0)) {
            return { isValid: false, error: 'Maximum muss eine positive Zahl sein' };
          }
          if (value.min && value.max && value.min > value.max) {
            return { isValid: false, error: 'Minimum darf nicht größer als Maximum sein' };
          }
        }
        break;

      case 'created_at':
      case 'updated_at':
        if (typeof value === 'object') {
          if (value.from && isNaN(Date.parse(value.from))) {
            return { isValid: false, error: 'Von-Datum ist ungültig' };
          }
          if (value.to && isNaN(Date.parse(value.to))) {
            return { isValid: false, error: 'Bis-Datum ist ungültig' };
          }
          if (value.from && value.to && new Date(value.from) > new Date(value.to)) {
            return { isValid: false, error: 'Von-Datum darf nicht nach Bis-Datum liegen' };
          }
        }
        break;
    }

    return { isValid: true };
  }

  /**
   * Erstelle Suchvorschläge basierend auf bestehenden Daten
   */
  static createSearchSuggestions(creators, field) {
    const suggestions = new Set();

    creators.forEach(creator => {
      let value;
      switch (field) {
        case 'name':
          if (creator.vorname) suggestions.add(creator.vorname);
          if (creator.nachname) suggestions.add(creator.nachname);
          if (creator.vorname && creator.nachname) {
            suggestions.add(`${creator.vorname} ${creator.nachname}`);
          }
          break;
        case 'lieferadresse_stadt':
          if (creator.lieferadresse_stadt) suggestions.add(creator.lieferadresse_stadt);
          break;
        default:
          value = creator[field];
          if (value && typeof value === 'string') {
            suggestions.add(value);
          }
          break;
      }
    });

    return Array.from(suggestions).sort().slice(0, 10); // Top 10 Vorschläge
  }
}

export default CreatorFilterUtils;