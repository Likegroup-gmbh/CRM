// KampagnenartenMapping.js
// Mapping zwischen Kampagnenarten-Namen (aus DB kampagne_art_typen) und Feld-Präfixen

export const KAMPAGNENARTEN_MAPPING = {
  'UGC Paid': {
    prefix: 'ugc_paid',
    hasCreator: true,
    hasBilder: false,
    hasVideographen: false,
    displayName: 'UGC Paid'
  },
  'UGC Organic': {
    prefix: 'ugc_organic',
    hasCreator: true,
    hasBilder: false,
    hasVideographen: false,
    displayName: 'UGC Organic'
  },
  'UGC Pro Paid': {
    prefix: 'ugc_pro_paid',
    hasCreator: true,
    hasBilder: false,
    hasVideographen: false,
    displayName: 'UGC Pro Paid'
  },
  'UGC Pro Organic': {
    prefix: 'ugc_pro_organic',
    hasCreator: true,
    hasBilder: false,
    hasVideographen: false,
    displayName: 'UGC Pro Organic'
  },
  'UGC Video Paid': {
    prefix: 'ugc_video_paid',
    hasCreator: true,
    hasBilder: false,
    hasVideographen: false,
    displayName: 'UGC Video Paid'
  },
  'UGC Video Organic': {
    prefix: 'ugc_video_organic',
    hasCreator: true,
    hasBilder: false,
    hasVideographen: false,
    displayName: 'UGC Video Organic'
  },
  'Influencer Kampagne': { 
    prefix: 'influencer', 
    hasCreator: true, 
    hasBilder: false,  // Influencer hat keine Bilder
    hasVideographen: false,
    displayName: 'Influencer'
  },
  'Story': {
    prefix: 'story',
    hasCreator: true,
    hasBilder: false,
    hasVideographen: false,
    displayName: 'Story'
  },
  'Vorort-Produktion': {
    prefix: 'vor_ort',
    hasCreator: true,
    hasBilder: false,
    hasVideographen: true,
    displayName: 'Vor-Ort-Produktion'
  },
  'Vor-Ort-Produktion': {
    prefix: 'vor_ort',
    hasCreator: true,
    hasBilder: false,
    hasVideographen: true,
    displayName: 'Vor-Ort-Produktion'
  },
  'Vor Ort Produktionen': { 
    prefix: 'vor_ort', 
    hasCreator: true, 
    hasBilder: false,  // Vor Ort hat KEINE Bilder
    hasVideographen: true,  // Nur Vor Ort hat Videographen
    displayName: 'Vor Ort'
  },
  // Legacy-Kompatibilität (kann entfernt werden, sobald Altwerte nicht mehr vorkommen)
  'UGC-Kampagne': {
    prefix: 'ugc_video_organic',
    hasCreator: true,
    hasBilder: false,
    hasVideographen: false,
    displayName: 'UGC Video Organic'
  },
  'UGC Kampagne': {
    prefix: 'ugc_video_organic',
    hasCreator: true,
    hasBilder: false,
    hasVideographen: false,
    displayName: 'UGC Video Organic'
  },
  'IGC Kampagnen': {
    prefix: 'ugc_pro_organic',
    hasCreator: true,
    hasBilder: false,
    hasVideographen: false,
    displayName: 'UGC Pro Organic'
  },
  'IGC Kampagne': {
    prefix: 'ugc_pro_organic',
    hasCreator: true,
    hasBilder: false,
    hasVideographen: false,
    displayName: 'UGC Pro Organic'
  }
};

/**
 * Generiert Feldnamen für eine Kampagnenart
 * @param {string} artName - Name der Kampagnenart (z.B. "UGC Pro Paid")
 * @returns {object|null} - Objekt mit Feldnamen oder null wenn nicht gefunden
 */
export function getFieldsForKampagnenart(artName) {
  const config = KAMPAGNENARTEN_MAPPING[artName];
  if (!config) return null;
  
  const { prefix, hasCreator, hasBilder, hasVideographen } = config;
  
  const fields = {
    video_anzahl: `${prefix}_video_anzahl`,
    budget_info: `${prefix}_budget_info`
  };
  
  if (hasCreator) {
    fields.creator_anzahl = `${prefix}_creator_anzahl`;
  }
  
  if (hasBilder) {
    fields.bilder_anzahl = `${prefix}_bilder_anzahl`;
  }
  
  if (hasVideographen) {
    fields.videographen_anzahl = `${prefix}_videographen_anzahl`;
  }
  
  return fields;
}

/**
 * Prüft ob eine Kampagnenart im Mapping existiert
 * @param {string} artName - Name der Kampagnenart
 * @returns {boolean}
 */
export function isKnownKampagnenart(artName) {
  return artName in KAMPAGNENARTEN_MAPPING;
}

/**
 * Gibt alle bekannten Kampagnenarten-Namen zurück
 * @returns {string[]}
 */
export function getAllKampagnenartenNames() {
  return Object.keys(KAMPAGNENARTEN_MAPPING);
}

/**
 * Gibt die Konfiguration für eine Kampagnenart zurück
 * @param {string} artName - Name der Kampagnenart
 * @returns {object|null}
 */
export function getKampagnenartConfig(artName) {
  return KAMPAGNENARTEN_MAPPING[artName] || null;
}

/**
 * Generiert ein einzelnes Stepper-Feld HTML (nutzt secondary-btn wie die bestehenden Stepper)
 * Kompakte Version für Flex-Row Layout
 * @param {string} id - ID des Feldes
 * @param {string} name - Name des Feldes
 * @param {string} label - Label des Feldes
 * @param {string} singularLabel - Singular-Label (z.B. "Video")
 * @param {string} pluralLabel - Plural-Label (z.B. "Videos")
 * @param {string|number} value - Aktueller Wert
 * @param {boolean} readonly - Ob das Feld readonly sein soll
 * @returns {string} - HTML String
 */
function generateStepperFieldHtml(id, name, label, singularLabel, pluralLabel, value = '', readonly = false) {
  const currentValue = parseInt(value, 10) || 0;
  const disabledAttr = readonly ? 'disabled' : '';
  const displayLabel = currentValue === 1 ? singularLabel : pluralLabel;
  
  return `
    <div class="form-field stepper-field">
      <label for="${id}">${label}</label>
      <div class="number-stepper">
        <input type="hidden" id="${id}" name="${name}" min="0" value="${currentValue}" data-singular="${singularLabel}" data-plural="${pluralLabel}">
        <button type="button" class="stepper-btn stepper-minus secondary-btn" data-target="${id}" ${disabledAttr}>−</button>
        <button type="button" class="stepper-btn stepper-plus secondary-btn" data-target="${id}" ${disabledAttr}>+</button>
        <span class="stepper-info">${currentValue} ${displayLabel}</span>
      </div>
    </div>`;
}

/**
 * Generiert HTML für Anzahl-Felder basierend auf einer Kampagnenart (mit Stepper-UI)
 * Alle Felder in einer Reihe mit minimalem Abstand
 * @param {string} artName - Name der Kampagnenart
 * @param {object} values - Werte für die Felder (optional)
 * @param {boolean} readonly - Ob die Felder readonly sein sollen
 * @returns {string} - HTML String
 */
export function generateFieldsHtml(artName, values = {}, readonly = false) {
  const config = KAMPAGNENARTEN_MAPPING[artName];
  if (!config) return '';
  
  const { prefix, hasCreator, hasBilder, hasVideographen, displayName } = config;
  
  // Alle Felder sammeln
  let fields = [];
  
  // Videos immer
  fields.push(generateStepperFieldHtml(
    `${prefix}_video_anzahl`, 
    `${prefix}_video_anzahl`, 
    'Anzahl Videos',
    'Video',
    'Videos',
    values[`${prefix}_video_anzahl`], 
    readonly
  ));
  
  if (hasCreator) {
    fields.push(generateStepperFieldHtml(
      `${prefix}_creator_anzahl`, 
      `${prefix}_creator_anzahl`, 
      'Anzahl Creator',
      'Creator',
      'Creator',
      values[`${prefix}_creator_anzahl`], 
      readonly
    ));
  }
  
  if (hasBilder) {
    fields.push(generateStepperFieldHtml(
      `${prefix}_bilder_anzahl`, 
      `${prefix}_bilder_anzahl`, 
      'Anzahl Bilder',
      'Bild',
      'Bilder',
      values[`${prefix}_bilder_anzahl`], 
      readonly
    ));
  }
  
  if (hasVideographen) {
    fields.push(generateStepperFieldHtml(
      `${prefix}_videographen_anzahl`, 
      `${prefix}_videographen_anzahl`, 
      'Anzahl Videographen',
      'Videograph',
      'Videographen',
      values[`${prefix}_videographen_anzahl`], 
      readonly
    ));
  }
  
  return `
    <fieldset class="kampagnenart-fields form-section-fieldset" data-art="${artName}" data-prefix="${prefix}">
      <legend>${displayName}</legend>
      <div class="stepper-row">
        ${fields.join('')}
      </div>
    </fieldset>`;
}

/**
 * Generiert HTML für Anzahl-Felder + Budget-Info basierend auf einer Kampagnenart
 * (für Auftragsdetails)
 * @param {string} artName - Name der Kampagnenart
 * @param {object} values - Werte für die Felder (optional)
 * @param {boolean} anzahlReadonly - Ob die Anzahl-Felder readonly sein sollen
 * @returns {string} - HTML String
 */
export function generateFieldsWithBudgetHtml(artName, values = {}, anzahlReadonly = true) {
  const config = KAMPAGNENARTEN_MAPPING[artName];
  if (!config) return '';
  
  const { prefix, hasCreator, hasBilder, hasVideographen, displayName } = config;
  const readonlyAttr = anzahlReadonly ? 'readonly' : '';
  const readonlyStyle = anzahlReadonly ? 'style="background-color: #f5f5f5;"' : '';
  
  let fieldsHtml = `
    <fieldset class="kampagnenart-fields form-section-fieldset" data-art="${artName}" data-prefix="${prefix}">
      <legend>${displayName}</legend>
      <div class="form-two-col">
        <div class="form-field form-field--half">
          <label for="${prefix}_video_anzahl">Anzahl Videos</label>
          <input type="number" id="${prefix}_video_anzahl" name="${prefix}_video_anzahl" 
                 min="0" value="${values[`${prefix}_video_anzahl`] || ''}" 
                 ${readonlyAttr} ${readonlyStyle}>
        </div>`;
  
  if (hasCreator) {
    fieldsHtml += `
        <div class="form-field form-field--half">
          <label for="${prefix}_creator_anzahl">Anzahl Creator</label>
          <input type="number" id="${prefix}_creator_anzahl" name="${prefix}_creator_anzahl" 
                 min="0" value="${values[`${prefix}_creator_anzahl`] || ''}" 
                 ${readonlyAttr} ${readonlyStyle}>
        </div>`;
  }
  
  fieldsHtml += `
      </div>
      <div class="form-two-col">`;
  
  if (hasBilder) {
    fieldsHtml += `
        <div class="form-field form-field--half">
          <label for="${prefix}_bilder_anzahl">Anzahl Bilder</label>
          <input type="number" id="${prefix}_bilder_anzahl" name="${prefix}_bilder_anzahl" 
                 min="0" value="${values[`${prefix}_bilder_anzahl`] || ''}" 
                 ${readonlyAttr} ${readonlyStyle}>
        </div>`;
  }
  
  if (hasVideographen) {
    fieldsHtml += `
        <div class="form-field form-field--half">
          <label for="${prefix}_videographen_anzahl">Anzahl Videographen</label>
          <input type="number" id="${prefix}_videographen_anzahl" name="${prefix}_videographen_anzahl" 
                 min="0" value="${values[`${prefix}_videographen_anzahl`] || ''}" 
                 ${readonlyAttr} ${readonlyStyle}>
        </div>`;
  }
  
  fieldsHtml += `
      </div>
      <div class="form-field form-field--full">
        <label for="${prefix}_budget_info">Budget & Informationen</label>
        <textarea id="${prefix}_budget_info" name="${prefix}_budget_info" rows="4" 
                  class="budget-textarea">${values[`${prefix}_budget_info`] || ''}</textarea>
      </div>
    </fieldset>`;
  
  return fieldsHtml;
}

/**
 * Generiert HTML für Budget-Info + optionales Videoanzahl-Feld (per Toggle)
 * Für die Auftragsdetails-Erstellung - zusätzliche Info getrennt von Kampagnenwerten
 * Enthält Einkaufspreis und Verkaufspreis pro Kampagnenart (jeweils als Preisspanne)
 * @param {string} artName - Name der Kampagnenart
 * @param {object} values - Werte für die Felder (optional)
 * @returns {string} - HTML String
 */
export function generateBudgetOnlyFieldsHtml(artName, values = {}) {
  const config = KAMPAGNENARTEN_MAPPING[artName];
  if (!config) return '';
  
  const { prefix, displayName } = config;
  const videoAnzahlValue = values[`${prefix}_video_anzahl`];
  const hasVideoAnzahl = videoAnzahlValue !== null && videoAnzahlValue !== undefined && videoAnzahlValue !== '';
  
  return `
    <fieldset class="kampagnenart-fields form-section-fieldset" data-art="${artName}" data-prefix="${prefix}">
      <legend>${displayName}</legend>
      <div class="form-field form-field--full">
        <label class="toggle-label" for="${prefix}_video_anzahl_enabled">
          <span class="toggle-text">Anzahl Videos vorhanden?</span>
          <span class="toggle-switch">
            <input 
              type="checkbox" 
              id="${prefix}_video_anzahl_enabled" 
              name="${prefix}_video_anzahl_enabled"
              data-video-toggle="true"
              data-target="${prefix}_video_anzahl"
              ${hasVideoAnzahl ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </span>
        </label>
      </div>
      <div class="form-field form-field--half" data-video-anzahl-wrapper="${prefix}" style="${hasVideoAnzahl ? '' : 'display: none;'}">
        <label for="${prefix}_video_anzahl">Anzahl Videos</label>
        <input 
          type="number" 
          id="${prefix}_video_anzahl" 
          name="${prefix}_video_anzahl" 
          min="0" 
          step="1" 
          value="${hasVideoAnzahl ? videoAnzahlValue : ''}" 
          placeholder="z.B. 5">
      </div>
      <div class="form-two-col">
        <div class="form-field form-field--half">
          <label>Einkaufspreis (Netto)</label>
          <div class="price-range-inputs">
            <input type="number" id="${prefix}_einkaufspreis_netto_von" name="${prefix}_einkaufspreis_netto_von" 
                   min="0" step="0.01" value="${values[`${prefix}_einkaufspreis_netto_von`] || ''}" 
                   placeholder="Von">
            <span class="range-separator">–</span>
            <input type="number" id="${prefix}_einkaufspreis_netto_bis" name="${prefix}_einkaufspreis_netto_bis" 
                   min="0" step="0.01" value="${values[`${prefix}_einkaufspreis_netto_bis`] || ''}" 
                   placeholder="Bis">
          </div>
          <small class="form-hint">Preis pro Video</small>
        </div>
        <div class="form-field form-field--half">
          <label>Verkaufspreis (Netto)</label>
          <div class="price-range-inputs">
            <input type="number" id="${prefix}_verkaufspreis_netto_von" name="${prefix}_verkaufspreis_netto_von" 
                   min="0" step="0.01" value="${values[`${prefix}_verkaufspreis_netto_von`] || ''}" 
                   placeholder="Von">
            <span class="range-separator">–</span>
            <input type="number" id="${prefix}_verkaufspreis_netto_bis" name="${prefix}_verkaufspreis_netto_bis" 
                   min="0" step="0.01" value="${values[`${prefix}_verkaufspreis_netto_bis`] || ''}" 
                   placeholder="Bis">
          </div>
          <small class="form-hint">Preis pro Video</small>
        </div>
      </div>
      <div class="form-field form-field--full">
        <label for="${prefix}_budget_info">Budget & Informationen</label>
        <textarea id="${prefix}_budget_info" name="${prefix}_budget_info" rows="4" 
                  placeholder="Budget, Honorare, spezielle Anmerkungen..."
                  class="budget-textarea">${values[`${prefix}_budget_info`] || ''}</textarea>
      </div>
    </fieldset>`;
}

