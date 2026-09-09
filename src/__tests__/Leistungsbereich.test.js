import { describe, it, expect } from 'vitest';
import {
  LEISTUNGSBEREICHE,
  LEISTUNGSBEREICH_LABELS,
  bereichForCampaignType,
  leistungsbereichForAuftrag,
  primaerBereichForAuftrag,
} from '../core/budget/leistungsbereich.js';

// ADR 0006 / PRD Schritt 2: Der Leistungsbereich ist die Achse der
// Monatsauswertung. Eine einzige Quelle bildet Kampagnenarten auf Bereiche ab;
// die Tabs der Uebersicht und die Matrix duerfen nicht auseinanderlaufen.

describe('bereichForCampaignType', () => {
  it('fuehrt influencer, story und event zu Influencer Marketing zusammen', () => {
    expect(bereichForCampaignType('influencer')).toBe('influencer_marketing');
    expect(bereichForCampaignType('story')).toBe('influencer_marketing');
    expect(bereichForCampaignType('event')).toBe('influencer_marketing');
  });

  it('bildet die uebrigen Kampagnenarten eins zu eins ab', () => {
    expect(bereichForCampaignType('ugc_paid')).toBe('ugc_paid');
    expect(bereichForCampaignType('ugc_organic')).toBe('ugc_organic');
    expect(bereichForCampaignType('vorort_produktion')).toBe('vorort_produktion');
    expect(bereichForCampaignType('whitelisting')).toBe('whitelisting');
    expect(bereichForCampaignType('darkposting')).toBe('darkposting');
  });

  it('liefert null fuer unbekannte oder fehlende Typen', () => {
    expect(bereichForCampaignType('sonstiges')).toBeNull();
    expect(bereichForCampaignType(null)).toBeNull();
    expect(bereichForCampaignType(undefined)).toBeNull();
  });
});

describe('leistungsbereichForAuftrag', () => {
  it('ordnet Contracting ueber den auftragtype zu, auch ohne Bloecke', () => {
    expect(leistungsbereichForAuftrag({ auftragtype: 'Contracting' }, [])).toBe('contracting');
  });

  it('Contracting schlaegt vorhandene Bloecke', () => {
    const blocks = [{ campaign_type: 'ugc_paid' }];
    expect(leistungsbereichForAuftrag({ auftragtype: 'Contracting' }, blocks)).toBe('contracting');
  });

  it('erkennt auftragtype gross-/kleinschreibungsunabhaengig', () => {
    expect(leistungsbereichForAuftrag({ auftragtype: 'contracting' }, [])).toBe('contracting');
  });

  it('ohne Bloecke landet der Auftrag in Nicht zugeordnet statt in einer geratenen Zuordnung', () => {
    expect(leistungsbereichForAuftrag({ auftragtype: 'Einmalprojekt' }, [])).toBe('nicht_zugeordnet');
    expect(leistungsbereichForAuftrag({}, null)).toBe('nicht_zugeordnet');
  });

  it('ein einziger Bereich ueber alle Bloecke ergibt diesen Bereich', () => {
    const blocks = [{ campaign_type: 'ugc_paid' }, { campaign_type: 'ugc_paid' }];
    expect(leistungsbereichForAuftrag({}, blocks)).toBe('ugc_paid');
  });

  it('influencer + story ist EIN Bereich, nicht Gemischt', () => {
    const blocks = [{ campaign_type: 'influencer' }, { campaign_type: 'story' }];
    expect(leistungsbereichForAuftrag({}, blocks)).toBe('influencer_marketing');
  });

  it('mehrere Bereiche ergeben Gemischt', () => {
    const blocks = [{ campaign_type: 'influencer' }, { campaign_type: 'ugc_paid' }];
    expect(leistungsbereichForAuftrag({}, blocks)).toBe('gemischt');
  });

  it('unbekannte Typen allein erzeugen keinen Bereich', () => {
    const blocks = [{ campaign_type: 'sonstiges' }, { campaign_type: null }];
    expect(leistungsbereichForAuftrag({}, blocks)).toBe('nicht_zugeordnet');
  });

  it('jeder gelieferte Schluessel hat ein Label', () => {
    const blocks = [{ campaign_type: 'influencer' }, { campaign_type: 'ugc_paid' }];
    const key = leistungsbereichForAuftrag({}, blocks);
    expect(LEISTUNGSBEREICH_LABELS[key]).toBeTruthy();
    LEISTUNGSBEREICHE.forEach(b => expect(LEISTUNGSBEREICH_LABELS[b]).toBeTruthy());
  });
});

describe('primaerBereichForAuftrag (Tab-Logik)', () => {
  it('behaltet die bisherige Prioritaet: Influencer schlaegt UGC', () => {
    const blocks = [{ campaign_type: 'ugc_paid' }, { campaign_type: 'influencer' }];
    expect(primaerBereichForAuftrag({}, blocks)).toBe('influencer_marketing');
  });

  it('Contracting geht vor allem anderen', () => {
    const blocks = [{ campaign_type: 'influencer' }];
    expect(primaerBereichForAuftrag({ auftragtype: 'Contracting' }, blocks)).toBe('contracting');
  });

  it('ohne Bloecke bleibt der Auftrag im Gesamt-Tab', () => {
    expect(primaerBereichForAuftrag({ auftragtype: 'Retainer' }, [])).toBe('gesamt');
  });

  it('ugc_paid schlaegt ugc_organic, story zaehlt als influencer', () => {
    expect(primaerBereichForAuftrag({}, [{ campaign_type: 'ugc_organic' }, { campaign_type: 'ugc_paid' }]))
      .toBe('ugc_paid');
    expect(primaerBereichForAuftrag({}, [{ campaign_type: 'ugc_paid' }, { campaign_type: 'story' }]))
      .toBe('influencer_marketing');
  });
});
