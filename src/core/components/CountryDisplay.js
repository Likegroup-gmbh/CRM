/**
 * CountryDisplay - Utility-Klasse für formatierte Länder-Anzeige mit Flaggen
 * 
 * Verwendung:
 * - In Listen: CountryDisplay.render(isoCode, countryName)
 * - Daten extrahieren: CountryDisplay.extractCountryData(obj)
 */
export class CountryDisplay {
  /**
   * Rendert ein Land mit Flagge (kompakt für Listen)
   * @param {string} countryIsoCode - ISO-Code des Landes (z.B. 'de', 'nl')
   * @param {string} countryName - Name des Landes (z.B. 'Deutschland')
   * @returns {string} HTML-String
   */
  static render(countryIsoCode, countryName) {
    if (!countryName || countryName.trim() === '') {
      return '<span class="country-display-empty">-</span>';
    }

    const iso = (countryIsoCode || '').toLowerCase();

    return `
      <span class="country-display">
        ${iso ? `<span class="fi fi-${iso}" title="${countryName}"></span>` : ''}
        <span class="country-name">${countryName}</span>
      </span>
    `;
  }

  /**
   * Extrahiert Land-Daten aus einem Objekt mit gejointem eu_laender
   * @param {Object} obj - Objekt mit Land-Relation (z.B. ansprechpartner mit joined land)
   * @returns {Object|null} { isoCode, name }
   */
  static extractCountryData(obj) {
    if (!obj) return null;

    const land = obj.land;
    if (!land || typeof land !== 'object') return null;

    return {
      isoCode: land.iso_code || null,
      name: land.name_de || land.name || null
    };
  }
}
