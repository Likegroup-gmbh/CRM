import { describe, expect, it } from 'vitest';
import { generateAuftragTitle } from '../modules/projekt-erstellen/components/TitelGenerator.js';
import { generateBudgetBlockHtml } from '../modules/projekt-erstellen/logic/CampaignBudgetFields.js';

describe('generateAuftragTitle', () => {
  it('setzt das Kürzel an den Anfang', () => {
    const result = generateAuftragTitle({
      unternehmensname: 'GK',
      auftragType: 'ugc',
      startDate: '2026-04-01'
    });
    expect(result).toMatch(/^GK/);
  });

  it('erzeugt Titel ohne Kürzel wenn nicht gesetzt', () => {
    const result = generateAuftragTitle({
      auftragType: 'ugc',
      startDate: '2026-04-01'
    });
    expect(result).toContain('April 2026');
  });

  it('enthält Monat und Jahr aus dem Startdatum', () => {
    const result = generateAuftragTitle({
      unternehmensname: 'ABC',
      startDate: '2026-04-15'
    });
    expect(result).toContain('April 2026');
  });

  it('gibt leeren String bei komplett fehlenden Daten', () => {
    expect(generateAuftragTitle({})).toBe('');
  });
});

describe('generateBudgetBlockHtml', () => {
  const types = [
    { value: 'ugc_paid', label: 'UGC Paid' },
    { value: 'influencer', label: 'Influencer' }
  ];

  it('enthält kein campaign_type <select>', () => {
    const html = generateBudgetBlockHtml({ id: 'b1', campaign_type: 'ugc_paid' }, types, 0);
    expect(html).not.toMatch(/<select[^>]*data-field="campaign_type"/);
  });

  it('speichert campaign_type als data-Attribut am Fieldset', () => {
    const html = generateBudgetBlockHtml({ id: 'b1', campaign_type: 'ugc_paid' }, types, 0);
    expect(html).toContain('data-campaign-type="ugc_paid"');
  });

  it('zeigt das Label der Kampagnenart in der Legend', () => {
    const html = generateBudgetBlockHtml({ id: 'b1', campaign_type: 'influencer' }, types, 0);
    expect(html).toContain('Influencer');
  });

  it('enthält alle relevanten Eingabefelder', () => {
    const html = generateBudgetBlockHtml({ id: 'b1', campaign_type: 'ugc_paid' }, types, 0);
    expect(html).toContain('video_anzahl');
    expect(html).toContain('creator_anzahl');
    expect(html).toContain('einkaufspreis_netto_von');
    expect(html).toContain('verkaufspreis_netto_von');
    expect(html).toContain('budget_info');
  });
});
