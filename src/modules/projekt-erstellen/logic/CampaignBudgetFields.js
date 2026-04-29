// CampaignBudgetFields.js
// Wiederholbare Kampagnenart-Bloecke fuer den Projekt-Erstellen Wizard (Step 3).
//
// Persistenz-Mapping: Wizard-Block -> neue Block-Tabelle und aggregiert in alte
// auftrag_details/kampagne-Spalten, damit bestehende Ansichten weiter Daten sehen.

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

export const COUNT_FIELD_SUFFIXES = [
  'video_anzahl',
  'creator_anzahl'
];

export const CAMPAIGN_FIELD_SUFFIXES = [
  ...COUNT_FIELD_SUFFIXES,
  ...BUDGET_FIELD_SUFFIXES
];

export const CAMPAIGN_BLOCK_FIELD_SUFFIXES = [
  ...CAMPAIGN_FIELD_SUFFIXES
];

export const DEFAULT_CAMPAIGN_BLOCK_STATUS = 'offen';

function escapeHtml(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function domId(blockId, suffix) {
  return `pe-budget-${blockId}-${suffix}`;
}

export function getChipPrefix(chipValue) {
  return CHIP_PREFIX_MAP[chipValue] || null;
}

export function createCampaignBlockId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createCampaignBlock(campaignType = 'ugc_paid') {
  return {
    id: createCampaignBlockId(),
    campaign_type: campaignType,
    video_anzahl: null,
    creator_anzahl: null,
    einkaufspreis_netto_von: null,
    einkaufspreis_netto_bis: null,
    verkaufspreis_netto_von: null,
    verkaufspreis_netto_bis: null,
    budget_info: '',
    status: DEFAULT_CAMPAIGN_BLOCK_STATUS
  };
}

function parseNum(value) {
  if (value === '' || value == null) return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

export function normalizeCampaignBlock(block = {}, fallbackType = 'ugc_paid') {
  const normalized = createCampaignBlock(block.campaign_type || fallbackType);
  normalized.id = block.id || createCampaignBlockId();
  normalized.campaign_type = block.campaign_type || fallbackType;
  normalized.video_anzahl = parseNum(block.video_anzahl);
  normalized.creator_anzahl = parseNum(block.creator_anzahl);
  normalized.einkaufspreis_netto_von = parseNum(block.einkaufspreis_netto_von);
  normalized.einkaufspreis_netto_bis = parseNum(block.einkaufspreis_netto_bis);
  normalized.verkaufspreis_netto_von = parseNum(block.verkaufspreis_netto_von);
  normalized.verkaufspreis_netto_bis = parseNum(block.verkaufspreis_netto_bis);
  normalized.budget_info = block.budget_info || '';
  normalized.status = block.status || DEFAULT_CAMPAIGN_BLOCK_STATUS;
  return normalized;
}

export function normalizeCampaignBlocks(details = {}) {
  if (Array.isArray(details.campaign_blocks) && details.campaign_blocks.length > 0) {
    return details.campaign_blocks.map(block => normalizeCampaignBlock(block));
  }

  const legacyTypes = Array.isArray(details.campaign_type) ? details.campaign_type : [];
  const legacyBudgets = details.campaign_budgets || {};
  return legacyTypes.map(chipValue => normalizeCampaignBlock({
    campaign_type: chipValue,
    ...(legacyBudgets[chipValue] || {})
  }, chipValue));
}

export function getCampaignTypesFromBlocks(blocks = [], { unique = false } = {}) {
  const types = (blocks || []).map(block => block.campaign_type).filter(Boolean);
  return unique ? Array.from(new Set(types)) : types;
}

function mergeRange(current, value, mode) {
  const n = parseNum(value);
  if (n == null) return current;
  if (current == null) return n;
  return mode === 'min' ? Math.min(current, n) : Math.max(current, n);
}

export function aggregateCampaignBlocksForLegacy(blocks = []) {
  const aggregated = {};

  (blocks || []).forEach((block, index) => {
    const chipValue = block.campaign_type;
    if (!chipValue) return;

    if (!aggregated[chipValue]) {
      aggregated[chipValue] = {
        video_anzahl: null,
        creator_anzahl: null,
        einkaufspreis_netto_von: null,
        einkaufspreis_netto_bis: null,
        verkaufspreis_netto_von: null,
        verkaufspreis_netto_bis: null,
        budget_info: ''
      };
    }

    const target = aggregated[chipValue];
    const videos = parseNum(block.video_anzahl);
    const creators = parseNum(block.creator_anzahl);
    if (videos != null) target.video_anzahl = (target.video_anzahl || 0) + videos;
    if (creators != null) target.creator_anzahl = (target.creator_anzahl || 0) + creators;

    target.einkaufspreis_netto_von = mergeRange(target.einkaufspreis_netto_von, block.einkaufspreis_netto_von, 'min');
    target.einkaufspreis_netto_bis = mergeRange(target.einkaufspreis_netto_bis, block.einkaufspreis_netto_bis, 'max');
    target.verkaufspreis_netto_von = mergeRange(target.verkaufspreis_netto_von, block.verkaufspreis_netto_von, 'min');
    target.verkaufspreis_netto_bis = mergeRange(target.verkaufspreis_netto_bis, block.verkaufspreis_netto_bis, 'max');

    const info = (block.budget_info || '').trim();
    if (info) {
      const prefix = `${index + 1}.`;
      target.budget_info = target.budget_info ? `${target.budget_info}\n\n${prefix} ${info}` : `${prefix} ${info}`;
    }
  });

  return aggregated;
}

/**
 * Generiert HTML fuer einen wiederholbaren Kampagnenart-Block.
 */
export function generateBudgetBlockHtml(block, campaignTypes = [], index = 0) {
  const v = normalizeCampaignBlock(block);
  const blockId = v.id;
  const label = campaignTypes.find(t => t.value === v.campaign_type)?.label || v.campaign_type || 'Kampagnenart';
  const ids = {
    type: domId(blockId, 'campaign_type'),
    videos: domId(blockId, 'video_anzahl'),
    creators: domId(blockId, 'creator_anzahl'),
    ek_von: domId(blockId, 'einkaufspreis_netto_von'),
    ek_bis: domId(blockId, 'einkaufspreis_netto_bis'),
    vk_von: domId(blockId, 'verkaufspreis_netto_von'),
    vk_bis: domId(blockId, 'verkaufspreis_netto_bis'),
    info: domId(blockId, 'budget_info')
  };

  return `
    <fieldset class="kampagnenart-fields form-section-fieldset projekt-erstellen-campaign-block" data-block-id="${escapeHtml(blockId)}" data-campaign-type="${escapeHtml(v.campaign_type || '')}">
      <div class="projekt-erstellen-campaign-block-header">
        <legend>${escapeHtml(label)} ${index > 0 ? `<span class="projekt-erstellen-campaign-block-index">#${index + 1}</span>` : ''}</legend>
        <button type="button" class="projekt-erstellen-remove-btn" data-action="remove-campaign-block" data-block-id="${escapeHtml(blockId)}">Entfernen</button>
      </div>
      <div class="form-two-col">
        <div class="form-field form-field--half">
          <label for="${ids.videos}">Video-Anzahl</label>
          <input type="number" id="${ids.videos}" data-block-id="${escapeHtml(blockId)}" data-field="video_anzahl"
                 min="0" step="1" value="${v.video_anzahl ?? ''}" placeholder="z.B. 5">
        </div>
        <div class="form-field form-field--half">
          <label for="${ids.creators}">Creator-Anzahl</label>
          <input type="number" id="${ids.creators}" data-block-id="${escapeHtml(blockId)}" data-field="creator_anzahl"
                 min="0" step="1" value="${v.creator_anzahl ?? ''}" placeholder="z.B. 3">
        </div>
      </div>
      <div class="form-two-col">
        <div class="form-field form-field--half">
          <label>Einkaufspreis (Netto)</label>
          <div class="price-range-inputs">
            <input type="number" id="${ids.ek_von}" data-block-id="${escapeHtml(blockId)}" data-field="einkaufspreis_netto_von"
                   min="0" step="0.01" value="${v.einkaufspreis_netto_von ?? ''}" placeholder="Von">
            <span class="range-separator">–</span>
            <input type="number" id="${ids.ek_bis}" data-block-id="${escapeHtml(blockId)}" data-field="einkaufspreis_netto_bis"
                   min="0" step="0.01" value="${v.einkaufspreis_netto_bis ?? ''}" placeholder="Bis">
          </div>
          <small class="form-hint">Preis pro Einheit</small>
        </div>
        <div class="form-field form-field--half">
          <label>Verkaufspreis (Netto)</label>
          <div class="price-range-inputs">
            <input type="number" id="${ids.vk_von}" data-block-id="${escapeHtml(blockId)}" data-field="verkaufspreis_netto_von"
                   min="0" step="0.01" value="${v.verkaufspreis_netto_von ?? ''}" placeholder="Von">
            <span class="range-separator">–</span>
            <input type="number" id="${ids.vk_bis}" data-block-id="${escapeHtml(blockId)}" data-field="verkaufspreis_netto_bis"
                   min="0" step="0.01" value="${v.verkaufspreis_netto_bis ?? ''}" placeholder="Bis">
          </div>
          <small class="form-hint">Preis pro Einheit</small>
        </div>
      </div>
      <div class="form-field form-field--full">
        <label for="${ids.info}">Budget &amp; Informationen</label>
        <textarea id="${ids.info}" data-block-id="${escapeHtml(blockId)}" data-field="budget_info" rows="4"
                  placeholder="Budget, Honorare, spezielle Anmerkungen..."
                  class="budget-textarea">${escapeHtml(v.budget_info || '')}</textarea>
      </div>
    </fieldset>`;
}

/**
 * Liest einen Kampagnenart-Block aus dem DOM.
 */
export function readBudgetValuesFromDom(blockId) {
  const fieldset = document.querySelector(`[data-block-id="${blockId}"].projekt-erstellen-campaign-block`);
  const result = {
    id: blockId,
    campaign_type: fieldset?.dataset?.campaignType || 'ugc_paid',
    status: DEFAULT_CAMPAIGN_BLOCK_STATUS
  };
  CAMPAIGN_BLOCK_FIELD_SUFFIXES.forEach(suffix => {
    const el = document.getElementById(domId(blockId, suffix));
    if (!el) {
      result[suffix] = suffix === 'budget_info' ? '' : null;
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
    CAMPAIGN_FIELD_SUFFIXES.forEach(suffix => {
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
    CAMPAIGN_FIELD_SUFFIXES.forEach(suffix => {
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
