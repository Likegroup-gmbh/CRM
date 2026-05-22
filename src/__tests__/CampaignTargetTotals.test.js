import { describe, expect, it } from 'vitest';
import { getCampaignTargetTotals } from '../modules/projekt-erstellen/logic/CampaignBudgetFields.js';

describe('getCampaignTargetTotals', () => {
  it('summiert aus blocks wenn vorhanden', () => {
    const result = getCampaignTargetTotals({
      blocks: [
        { video_anzahl: 10, creator_anzahl: 3, campaign_type: 'ugc_paid' },
        { video_anzahl: 5, creator_anzahl: 2, campaign_type: 'ugc_organic' }
      ],
      auftragDetails: { gesamt_videos: 99, gesamt_creator: 99 },
      kampagne: { videoanzahl: 1, creatoranzahl: 1 }
    });
    expect(result).toEqual({ videos: 15, creators: 5 });
  });

  it('fällt auf gesamt_videos/gesamt_creator zurück wenn keine blocks', () => {
    const result = getCampaignTargetTotals({
      blocks: [],
      auftragDetails: { gesamt_videos: 270, gesamt_creator: 96 },
      kampagne: { videoanzahl: 17, creatoranzahl: 6 }
    });
    expect(result).toEqual({ videos: 270, creators: 96 });
  });

  it('fällt auf Legacy-Spalten zurück wenn gesamt_* leer', () => {
    const result = getCampaignTargetTotals({
      blocks: [],
      auftragDetails: {
        gesamt_videos: 0,
        gesamt_creator: 0,
        campaign_type: ['ugc_paid', 'influencer'],
        ugc_paid_video_anzahl: 8,
        ugc_paid_creator_anzahl: 4,
        influencer_video_anzahl: 3,
        influencer_creator_anzahl: 2
      },
      kampagne: { videoanzahl: 1, creatoranzahl: 1 }
    });
    expect(result).toEqual({ videos: 11, creators: 6 });
  });

  it('fällt auf kampagne.videoanzahl/creatoranzahl zurück als letzter Fallback', () => {
    const result = getCampaignTargetTotals({
      blocks: [],
      auftragDetails: null,
      kampagne: { videoanzahl: 17, creatoranzahl: 6 }
    });
    expect(result).toEqual({ videos: 17, creators: 6 });
  });

  it('gibt 0/0 zurück wenn alles leer', () => {
    const result = getCampaignTargetTotals({});
    expect(result).toEqual({ videos: 0, creators: 0 });
  });

  it('ignoriert blocks mit null-Werten', () => {
    const result = getCampaignTargetTotals({
      blocks: [
        { video_anzahl: null, creator_anzahl: null, campaign_type: 'ugc_paid' }
      ],
      auftragDetails: { gesamt_videos: 50, gesamt_creator: 20 }
    });
    expect(result).toEqual({ videos: 50, creators: 20 });
  });
});
