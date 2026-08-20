// skript-context.js (Barrel)
// Re-Export der Teildateien unter skript-context/ - die Import-Pfade der
// Functions und Tests bleiben unveraendert.

const { loadContext } = require('./skript-context/load-context');
const {
  fmtSection, fmtSkript, fmtVarianten, produktPreis,
  videoLaengeHinweis, WOERTER_PRO_SEKUNDE,
  kuerzeTranskript, REFERENZ_TRANSKRIPT_MAX
} = require('./skript-context/formatter');
const {
  fmtCampaignBriefing, briefingSkriptSprache, BRIEFING_MAX, CAMPAIGN_BRIEFING_FIELD_NAMES
} = require('./skript-context/briefing-felder');
const { buildReferenzText, buildKontextText } = require('./skript-context/prompt-text');

module.exports = {
  loadContext, fmtSection, fmtSkript, fmtVarianten, produktPreis, buildKontextText,
  videoLaengeHinweis, WOERTER_PRO_SEKUNDE, buildReferenzText, kuerzeTranskript, REFERENZ_TRANSKRIPT_MAX,
  fmtCampaignBriefing, briefingSkriptSprache, BRIEFING_MAX, CAMPAIGN_BRIEFING_FIELD_NAMES
};
