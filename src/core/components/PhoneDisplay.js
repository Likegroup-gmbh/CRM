/**
 * PhoneDisplay - Utility-Klasse für formatierte Telefonnummer-Anzeige mit Flaggen
 * 
 * Verwendung:
 * - In Listen: PhoneDisplay.render(isoCode, vorwahl, nummer)
 * - In Detail-Views: PhoneDisplay.renderDetailed(...)
 */
export class PhoneDisplay {
  /**
   * Rendert eine Telefonnummer mit Flagge (kompakt für Listen)
   * @param {string} countryIsoCode - ISO-Code des Landes (z.B. 'de', 'nl')
   * @param {string} countryDialCode - Vorwahl (z.B. '+49', '+31')
   * @param {string} phoneNumber - Telefonnummer ohne Vorwahl
   * @returns {string} HTML-String
   */
  static render(countryIsoCode, countryDialCode, phoneNumber) {
    if (!phoneNumber || phoneNumber.trim() === '') {
      return '<span class="phone-display-empty">-</span>';
    }

    const iso = (countryIsoCode || '').toLowerCase();
    const dialCode = countryDialCode || '';
    
    return `
      <span class="phone-display">
        ${iso ? `<span class="fi fi-${iso}" title="${dialCode}"></span>` : ''}
        <span class="phone-number">${dialCode} ${phoneNumber}</span>
      </span>
    `;
  }

  /**
   * Rendert eine Telefonnummer mit Flagge und Ländername (detailliert für Detail-Views)
   * @param {string} countryIsoCode - ISO-Code des Landes
   * @param {string} countryDialCode - Vorwahl
   * @param {string} countryName - Name des Landes
   * @param {string} phoneNumber - Telefonnummer
   * @returns {string} HTML-String
   */
  static renderDetailed(countryIsoCode, countryDialCode, countryName, phoneNumber) {
    if (!phoneNumber || phoneNumber.trim() === '') {
      return '<span class="phone-display-empty">-</span>';
    }

    const iso = (countryIsoCode || '').toLowerCase();
    const dialCode = countryDialCode || '';
    const name = countryName || '';
    
    return `
      <div class="phone-display-detailed">
        <div class="phone-country">
          ${iso ? `<span class="fi fi-${iso}"></span>` : ''}
          <span class="country-name">${name}</span>
        </div>
        <div class="phone-number-full">
          <span class="dial-code">${dialCode}</span>
          <span class="phone-number">${phoneNumber}</span>
        </div>
      </div>
    `;
  }

  /**
   * Rendert einen anklickbaren Telefon-Link
   * @param {string} countryIsoCode - ISO-Code des Landes
   * @param {string} countryDialCode - Vorwahl
   * @param {string} phoneNumber - Telefonnummer
   * @returns {string} HTML-String mit tel: Link
   */
  static renderClickable(countryIsoCode, countryDialCode, phoneNumber) {
    if (!phoneNumber || phoneNumber.trim() === '') {
      return '<span class="phone-display-empty">-</span>';
    }

    const iso = (countryIsoCode || '').toLowerCase();
    const dialCode = countryDialCode || '';
    
    // Entferne alle nicht-numerischen Zeichen für tel: Link
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const cleanDialCode = dialCode.replace(/\D/g, '');
    const telLink = `tel:${cleanDialCode}${cleanNumber}`;
    
    return `
      <a href="${telLink}" class="phone-display phone-display-clickable">
        ${iso ? `<span class="fi fi-${iso}" title="${dialCode}"></span>` : ''}
        <span class="phone-number">${dialCode} ${phoneNumber}</span>
      </a>
    `;
  }

  /**
   * Extrahiert Telefonnummer-Daten aus einem Objekt
   * @param {Object} obj - Objekt mit Land-Daten (z.B. ansprechpartner mit joined eu_laender)
   * @param {string} fieldPrefix - Prefix für Felder (z.B. 'telefonnummer' oder 'telefonnummer_office')
   * @returns {Object} Extrahierte Daten
   */
  static extractPhoneData(obj, fieldPrefix = 'telefonnummer') {
    if (!obj) return null;

    const landField = `${fieldPrefix}_land`;
    const land = obj[landField];

    return {
      isoCode: land?.iso_code || null,
      vorwahl: land?.vorwahl || null,
      name: land?.name_de || land?.name || null,
      nummer: obj[fieldPrefix] || null
    };
  }

  /**
   * Rendert beide Telefonnummern (mobil + office) für einen Ansprechpartner
   * @param {Object} ansprechpartner - Ansprechpartner-Objekt mit joined Land-Daten
   * @returns {string} HTML-String
   */
  static renderBoth(ansprechpartner) {
    if (!ansprechpartner) return '<span class="phone-display-empty">-</span>';

    const mobil = this.extractPhoneData(ansprechpartner, 'telefonnummer');
    const office = this.extractPhoneData(ansprechpartner, 'telefonnummer_office');

    const mobilHtml = mobil?.nummer 
      ? this.renderClickable(mobil.isoCode, mobil.vorwahl, mobil.nummer)
      : '';
    
    const officeHtml = office?.nummer 
      ? this.renderClickable(office.isoCode, office.vorwahl, office.nummer)
      : '';

    if (!mobilHtml && !officeHtml) {
      return '<span class="phone-display-empty">-</span>';
    }

    return `
      <div class="phone-display-both">
        ${mobilHtml ? `<div class="phone-item"><span class="phone-label">Mobil:</span> ${mobilHtml}</div>` : ''}
        ${officeHtml ? `<div class="phone-item"><span class="phone-label">Büro:</span> ${officeHtml}</div>` : ''}
      </div>
    `;
  }
}

