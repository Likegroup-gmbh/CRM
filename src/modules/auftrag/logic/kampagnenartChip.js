// kampagnenartChip.js
// Chip-Slugs der Kampagnenarten und die Block-Umsatzsumme — ohne Wizard-DOM.
// Quelle für Dashboard und Filterlogik; der Wizard importiert von hier und
// re-exportiert in CampaignBudgetFields.js.

import { getKampagnenartConfig } from './KampagnenartenMapping.js';

export const CHIP_PREFIX_MAP = {
  ugc_paid: 'ugc_paid',
  ugc_organic: 'ugc_organic',
  influencer: 'influencer',
  vorort_produktion: 'vor_ort',
  story: 'story',
  event: 'event',
  whitelisting: 'whitelisting',
  darkposting: 'darkposting'
};

// Reverse-Map: prefix -> chipValue (z.B. 'vor_ort' -> 'vorort_produktion')
export const PREFIX_TO_CHIP_MAP = Object.entries(CHIP_PREFIX_MAP).reduce((acc, [chip, prefix]) => {
  acc[prefix] = chip;
  return acc;
}, {});

/**
 * Wandelt einen kampagne_art_typen.name (z.B. "UGC Paid", "Vor-Ort-Produktion")
 * in den entsprechenden Wizard-Slug (CAMPAIGN_TYPES.value, z.B. "ugc_paid",
 * "vorort_produktion") um. Geht ueber das KAMPAGNENARTEN_MAPPING.prefix als
 * Bruecke und sucht den Chip im invertierten CHIP_PREFIX_MAP.
 *
 * @param {string} name DB-Anzeigename aus kampagne_art_typen
 * @returns {string|null} Wizard-Slug oder null wenn nicht zuordenbar
 */
export function getChipFromKampagnenartName(name) {
  if (!name) return null;
  const config = getKampagnenartConfig(name);
  if (!config?.prefix) return null;
  return PREFIX_TO_CHIP_MAP[config.prefix] || null;
}

function parseNum(value) {
  if (value === '' || value == null) return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

/**
 * Summiert die gepflegten Block-Umsaetze (umsatz_netto). Blocks ohne Wert
 * zaehlen als 0; hasAny zeigt an, ob ueberhaupt ein Wert gepflegt ist.
 */
export function sumBlockUmsatz(blocks = []) {
  return (blocks || []).reduce((acc, block) => {
    const n = parseNum(block.umsatz_netto);
    if (n != null) {
      acc.sum += n;
      acc.hasAny = true;
    }
    return acc;
  }, { sum: 0, hasAny: false });
}
