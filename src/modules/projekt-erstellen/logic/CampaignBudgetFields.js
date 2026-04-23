// CampaignBudgetFields.js
// Kampagnenart-spezifische Budget-Felder (Einkaufspreis/Verkaufspreis von-bis + Budget-Info)
// fuer den Projekt-Erstellen Wizard (Step 2). Dynamisch pro aktiviertem Chip.
//
// Persistenz-Mapping: Wizard-Chip-Value -> Spalten-Prefix in auftrag_details.
// Neue DB-Spalten fuer ugc_paid_*, ugc_organic_*, story_* wurden per Migration angelegt.
// influencer_* und vor_ort_* existieren bereits aus dem alten Auftrags-Flow.

export const CHIP_PREFIX_MAP = {
  ugc_paid: 'ugc_paid',
  ugc_organic: 'ugc_organic',
  influencer: 'influencer',
  vorort_produktion: 'vor_ort',
  story: 'story'
};

export const BUDGET_FIELD_SUFFIXES = [
  'einkaufspreis_netto_von',
  'einkaufspreis_netto_bis',
  'verkaufspreis_netto_von',
  'verkaufspreis_netto_bis',
  'budget_info'
];

function escapeHtml(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function domId(chipValue, suffix) {
  return `pe-budget-${chipValue}-${suffix}`;
}

export function getChipPrefix(chipValue) {
  return CHIP_PREFIX_MAP[chipValue] || null;
}

/**
 * Generiert HTML fuer einen Budget-Block einer einzelnen Kampagnenart.
 * @param {string} chipValue - z. B. 'ugc_paid'
 * @param {string} chipLabel - Anzeige-Name, z. B. 'UGC Paid'
 * @param {object} values - bereits gespeicherte Werte je Suffix
 */
export function generateBudgetBlockHtml(chipValue, chipLabel, values = {}) {
  const v = values || {};
  const ids = {
    ek_von: domId(chipValue, 'einkaufspreis_netto_von'),
    ek_bis: domId(chipValue, 'einkaufspreis_netto_bis'),
    vk_von: domId(chipValue, 'verkaufspreis_netto_von'),
    vk_bis: domId(chipValue, 'verkaufspreis_netto_bis'),
    info: domId(chipValue, 'budget_info')
  };

  return `
    <fieldset class="kampagnenart-fields form-section-fieldset" data-chip="${chipValue}">
      <legend>${escapeHtml(chipLabel)}</legend>
      <div class="form-two-col">
        <div class="form-field form-field--half">
          <label>Einkaufspreis (Netto)</label>
          <div class="price-range-inputs">
            <input type="number" id="${ids.ek_von}" data-chip="${chipValue}" data-suffix="einkaufspreis_netto_von"
                   min="0" step="0.01" value="${v.einkaufspreis_netto_von ?? ''}" placeholder="Von">
            <span class="range-separator">–</span>
            <input type="number" id="${ids.ek_bis}" data-chip="${chipValue}" data-suffix="einkaufspreis_netto_bis"
                   min="0" step="0.01" value="${v.einkaufspreis_netto_bis ?? ''}" placeholder="Bis">
          </div>
          <small class="form-hint">Preis pro Einheit</small>
        </div>
        <div class="form-field form-field--half">
          <label>Verkaufspreis (Netto)</label>
          <div class="price-range-inputs">
            <input type="number" id="${ids.vk_von}" data-chip="${chipValue}" data-suffix="verkaufspreis_netto_von"
                   min="0" step="0.01" value="${v.verkaufspreis_netto_von ?? ''}" placeholder="Von">
            <span class="range-separator">–</span>
            <input type="number" id="${ids.vk_bis}" data-chip="${chipValue}" data-suffix="verkaufspreis_netto_bis"
                   min="0" step="0.01" value="${v.verkaufspreis_netto_bis ?? ''}" placeholder="Bis">
          </div>
          <small class="form-hint">Preis pro Einheit</small>
        </div>
      </div>
      <div class="form-field form-field--full">
        <label for="${ids.info}">Budget &amp; Informationen</label>
        <textarea id="${ids.info}" data-chip="${chipValue}" data-suffix="budget_info" rows="4"
                  placeholder="Budget, Honorare, spezielle Anmerkungen..."
                  class="budget-textarea">${escapeHtml(v.budget_info || '')}</textarea>
      </div>
    </fieldset>`;
}

function parseNum(value) {
  if (value === '' || value == null) return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

/**
 * Liest die 5 Budget-Werte einer Kampagnenart aus dem DOM.
 */
export function readBudgetValuesFromDom(chipValue) {
  const result = {};
  BUDGET_FIELD_SUFFIXES.forEach(suffix => {
    const el = document.getElementById(domId(chipValue, suffix));
    if (!el) {
      result[suffix] = null;
      return;
    }
    if (suffix === 'budget_info') {
      result[suffix] = el.value || '';
    } else {
      result[suffix] = parseNum(el.value);
    }
  });
  return result;
}

/**
 * Wandelt das wizard.formData.details.campaign_budgets-Objekt in ein flaches
 * DB-Payload (Spaltennamen mit Prefix) um. Nur fuer aktive Chips befuellt;
 * fuer NICHT aktive Chips werden alle zugehoerigen Spalten auf null gesetzt,
 * damit Deaktivieren eines Chips auch in der DB persistiert wird.
 */
export function mapBudgetsToDbColumns(campaignBudgets = {}, activeChips = []) {
  const payload = {};
  const active = new Set(activeChips || []);

  Object.entries(CHIP_PREFIX_MAP).forEach(([chipValue, prefix]) => {
    const isActive = active.has(chipValue);
    const values = (isActive && campaignBudgets[chipValue]) || {};
    BUDGET_FIELD_SUFFIXES.forEach(suffix => {
      const col = `${prefix}_${suffix}`;
      if (!isActive) {
        payload[col] = suffix === 'budget_info' ? null : null;
      } else if (suffix === 'budget_info') {
        payload[col] = values[suffix] || null;
      } else {
        payload[col] = values[suffix] != null && values[suffix] !== '' ? values[suffix] : null;
      }
    });
  });

  return payload;
}

/**
 * Liest aus einer DB-Row (auftrag_details) das campaign_budgets-Objekt
 * zurueck. Wenn activeChips uebergeben wird, werden nur diese aufgenommen,
 * andernfalls alle bekannten Chips.
 */
export function mapDbColumnsToBudgets(detailsRow = {}, activeChips = null) {
  const out = {};
  const chipsToRead = activeChips && activeChips.length ? activeChips : Object.keys(CHIP_PREFIX_MAP);

  chipsToRead.forEach(chipValue => {
    const prefix = CHIP_PREFIX_MAP[chipValue];
    if (!prefix) return;
    const values = {};
    let hasAny = false;
    BUDGET_FIELD_SUFFIXES.forEach(suffix => {
      const col = `${prefix}_${suffix}`;
      const raw = detailsRow[col];
      if (raw != null && raw !== '') {
        values[suffix] = suffix === 'budget_info' ? raw : Number(raw);
        hasAny = true;
      } else {
        values[suffix] = suffix === 'budget_info' ? '' : null;
      }
    });
    if (hasAny || (activeChips && activeChips.includes(chipValue))) {
      out[chipValue] = values;
    }
  });

  return out;
}
