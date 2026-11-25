// Decken-Stand der geöffneten Kampagne oder Produktion, dieselbe Basis wie die Kacheln.

import { getCampaignTargetTotals } from '../projekt-erstellen/logic/CampaignBudgetFields.js';
import { deckenStandAus } from './platzhalter.js';

export function deckenStandDerSeite(detail) {
  const kampagne = detail?.kampagneData || {};
  const targets = getCampaignTargetTotals({
    blocks: kampagne.campaignBlocks,
    auftragDetails: kampagne.auftragDetails,
    kampagne,
    preferKampagne: true
  });
  const produktionen = detail?.produktionen?.length
    ? detail.produktionen
    : (detail?.produktion ? [detail.produktion] : []);
  return deckenStandAus({
    kontingentVideos: targets.videos,
    creatorBudget: kampagne.creator_budget,
    auftragCreatorBudget: kampagne.auftrag?.creator_budget,
    volumen: kampagne.volumen,
    produktionen
  });
}
