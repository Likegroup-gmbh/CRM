// BriefingListDetail.test.js
// Smoke-Tests: BriefingList rendert Zeilen aus campaign_briefings,
// BriefingDetail formatiert die Feldtypen aus fieldConfig korrekt.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BriefingDetail } from '../modules/briefing/BriefingDetail.js';
import { BEREICH_LABELS } from '../modules/briefing/create/fieldConfig.js';

describe('BriefingList Smoke', () => {
  it('BEREICH_LABELS deckt alle Bereiche ab', () => {
    expect(BEREICH_LABELS.influencer_marketing).toBe('Influencer Marketing');
    expect(BEREICH_LABELS.paid_creator_ads).toBe('Paid Creator Ads');
    expect(BEREICH_LABELS.owned_social).toBe('Owned Social');
  });

  it('BriefingList-Modul ist importierbar und Singleton vorhanden', async () => {
    const mod = await import('../modules/briefing/BriefingList.js');
    expect(mod.briefingList).toBeTruthy();
    expect(typeof mod.briefingList.init).toBe('function');
  });
});

describe('BriefingDetail formatValue', () => {
  let detail;

  beforeEach(() => {
    detail = new BriefingDetail();
    detail.briefing = {};
    window.supabase = {
      storage: {
        from: () => ({ getPublicUrl: (p) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) })
      }
    };
  });

  it('leere Werte werden ausgeblendet', () => {
    expect(detail.formatValue({ name: 'x', type: 'text' }, null)).toBeNull();
    expect(detail.formatValue({ name: 'x', type: 'text' }, '')).toBeNull();
    expect(detail.formatValue({ name: 'x', type: 'checkboxes' }, [])).toBeNull();
  });

  it('radio mappt auf Option-Label', () => {
    const field = {
      name: 'ansatz', type: 'radio',
      options: [{ value: 'kampagne', label: 'Kampagne' }, { value: 'always_on', label: 'Always-on' }]
    };
    expect(detail.formatValue(field, 'always_on')).toBe('Always-on');
  });

  it('checkboxes rendern Tags mit Labels', () => {
    const field = {
      name: 'im_funnel_stufen', type: 'checkboxes',
      options: [{ value: 'upper', label: 'Upper Funnel' }, { value: 'lower', label: 'Lower Funnel' }]
    };
    const html = detail.formatValue(field, ['upper', 'lower']);
    expect(html).toContain('Upper Funnel');
    expect(html).toContain('Lower Funnel');
    expect(html).toContain('tag--type');
  });

  it('repeatableKpi zeigt KPI-Label und Zielwert', () => {
    const field = {
      name: 'im_kpis', type: 'repeatableKpi',
      kpiOptions: [{ value: 'reichweite', label: 'Reichweite' }]
    };
    const html = detail.formatValue(field, [{ kpi: 'reichweite', zielwert: '100k' }]);
    expect(html).toContain('Reichweite');
    expect(html).toContain('100k');
  });

  it('channelGroup zeigt nur belegte Channels', () => {
    const field = {
      name: 'im_channels', type: 'channelGroup',
      channels: [
        { key: 'instagram', label: 'Instagram', formats: [{ value: 'reel', label: 'Reel' }] },
        { key: 'tiktok', label: 'TikTok', formats: [{ value: 'video', label: 'TikTok Video' }] }
      ]
    };
    const html = detail.formatValue(field, { instagram: ['reel'], tiktok: [] });
    expect(html).toContain('Instagram');
    expect(html).toContain('Reel');
    expect(html).not.toContain('TikTok');
  });

  it('repeatableUpload verlinkt Uploads ueber Storage-URL', () => {
    const field = { name: 'im_beispiele', type: 'repeatableUpload' };
    const html = detail.formatValue(field, [
      { typ: 'upload', value: 'campaign-briefings/b1/video.mp4', label: 'Beispiel 1' },
      { typ: 'url', value: 'https://example.com/post' }
    ]);
    expect(html).toContain('https://cdn.test/campaign-briefings/b1/video.mp4');
    expect(html).toContain('Beispiel 1');
    expect(html).toContain('https://example.com/post');
  });

  it('escape schuetzt gegen HTML-Injection', () => {
    const html = detail.formatValue({ name: 'aktivierung_name', type: 'text' }, '<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });
});

describe('BriefingDocView', () => {
  let detail;

  const sampleBriefing = {
    bereich: 'influencer_marketing',
    ansatz: 'kampagne',
    is_draft: false,
    aktivierung_name: 'Sommer-Launch TEWH',
    kampagne_thema: 'Barrier Repair Serum Launch',
    creator_rolle: 'Testimonials mit Frustration, Integration, Resultat',
    im_umsetzung: 'Serum in der Abendroutine zeigen',
    im_learnings_vorhanden: true,
    im_learnings_text: 'Hook in den ersten zwei Sekunden',
    content_deadline: '2023-08-11',
    go_live: '2023-08-27',
    maerkte: ['deutschland'],
    sprachen: ['deutsch'],
    im_funnel_stufen: ['upper'],
    im_creator_groessen: ['micro'],
    unternehmen: { firmenname: 'Skincare Brand' },
    marke: { markenname: 'Skincare' },
    produkte: [{ id: 'p1', name: 'Barrier Repair Serum' }, { id: 'p2', name: 'Night Cream' }],
    created_at: '2023-07-01T10:00:00.000Z',
    updated_at: '2023-07-15T10:00:00.000Z'
  };

  beforeEach(async () => {
    const { BriefingDetail } = await import('../modules/briefing/BriefingDetail.js');
    detail = new BriefingDetail();
    detail.briefing = { ...sampleBriefing };
    window.validatorSystem = {
      sanitizeHtml: (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    };
    window.supabase = {
      storage: {
        from: () => ({ getPublicUrl: (p) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) })
      }
    };
  });

  it('klassifiziert Thema als Callout und Learnings als sekundaer', async () => {
    const { classifyField } = await import('../modules/briefing/BriefingDocView.js');
    expect(classifyField({ name: 'kampagne_thema', type: 'textarea' })).toBe('callout');
    expect(classifyField({ name: 'always_on_thema', type: 'textarea' })).toBe('callout');
    expect(classifyField({ name: 'creator_rolle', type: 'textarea' })).toBe('prose');
    expect(classifyField({ name: 'im_umsetzung', type: 'textarea' })).toBe('prose');
    expect(classifyField({ name: 'im_funnel_stufen', type: 'checkboxes' })).toBe('spec');
    expect(classifyField({ name: 'im_creator_groessen', type: 'checkboxes' }, 'Welche Creator suchen wir?')).toBe('creator');
    expect(classifyField({ name: 'im_learnings_text', type: 'textarea' })).toBe('secondary');
    expect(classifyField({ name: 'aktivierung_name', type: 'text' })).toBe('hero');
    expect(classifyField({ name: 'maerkte', type: 'customMulti' })).toBe('meta');
    expect(classifyField({ name: 'im_neue_botschaft', type: 'textarea' })).toBe('prose');
    expect(classifyField({ name: 'im_neue_formate', type: 'checkboxes' })).toBe('spec');
    expect(classifyField({ name: 'im_neue_deadline', type: 'date' })).toBe('spec');
  });

  it('Kompakt filtert Sekundaerfelder, Alle Felder zeigt sie', async () => {
    const { collectPresentation, renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    const presentation = collectPresentation(detail);

    expect(presentation.callout.map(i => i.field.name)).toContain('kampagne_thema');
    expect(presentation.prose.some(g => g.items.some(i => i.field.name === 'creator_rolle'))).toBe(true);
    expect(presentation.prose.some(g => g.items.some(i => i.field.name === 'im_umsetzung'))).toBe(true);
    expect(presentation.specs.some(r => r.html.includes('Upper Funnel'))).toBe(true);
    expect(presentation.creator.some(g => g.items.some(i => i.field.name === 'im_creator_groessen'))).toBe(true);
    expect(presentation.secondary.some(g => g.items.some(i => i.field.name === 'im_learnings_text'))).toBe(true);

    const compact = renderBriefingDoc({ detail, compact: true });
    expect(compact).toContain('Barrier Repair Serum Launch');
    expect(compact).toContain('Sommer-Launch TEWH');
    expect(compact).toContain('Testimonials mit Frustration');
    expect(compact).toContain('Serum in der Abendroutine');
    expect(compact).toContain('Welche Creator suchen wir?');
    expect(compact).toContain('Komprimierte Ansicht');
    expect(compact).toContain('Alle Felder');
    expect(compact).not.toContain('Hook in den ersten zwei Sekunden');
    expect(compact).not.toContain('Erstellt');

    const allFields = renderBriefingDoc({ detail, compact: false });
    expect(allFields).toContain('Hook in den ersten zwei Sekunden');
    expect(allFields).toContain('Erstellt');
    expect(allFields).toContain('Komprimiert');
    expect(allFields).not.toContain('Komprimierte Ansicht');
    expect(allFields.match(/Konkrete Ideen fuer die Umsetzung/g)?.length || 0).toBeLessThanOrEqual(1);
  });

  it('Alle Felder mergt Ideen-Status in die bestehende Ideen-Section', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    detail.briefing = {
      ...detail.briefing,
      im_ideen_status: 'ja',
      im_ideen_text: 'Barrier-Repair in 14 Tagen.'
    };
    const html = renderBriefingDoc({ detail, compact: false });
    const headings = [...html.matchAll(/briefing-doc__heading[\s\S]*?<span>([^<]+)<\/span>/g)].map(m => m[1]);
    expect(headings.filter(h => h === 'Konkrete Ideen fuer die Umsetzung')).toHaveLength(1);
    expect(html).toContain('Barrier-Repair in 14 Tagen.');
    expect(html).toContain('Ja');
  });

  it('Hero zeigt Badges, Unterzeile und Meta-Chips', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    const html = renderBriefingDoc({ detail, compact: true, canDelete: true });
    expect(html).toContain('Kampagne');
    expect(html).toContain('Final');
    expect(html).toContain('Influencer Marketing');
    expect(html).toContain('Skincare Brand');
    expect(html).toContain('Skincare');
    expect(html).toContain('bis');
    expect(html).toContain('Deutschland');
    expect(html).toContain('Deutsch');
    expect(html).toContain('briefing-doc__callout');
    expect(html).toContain('Thema');
    expect(html).toContain('briefing-doc__products');
    expect(html.indexOf('Barrier Repair Serum')).toBeLessThan(html.indexOf('Sommer-Launch TEWH'));
    expect(html.indexOf('Night Cream')).toBeLessThan(html.indexOf('Sommer-Launch TEWH'));
    expect(html).toContain('mdc-btn--delete mdc-btn--sm');
  });

  it('ohne Produkte keine Produktzeile ueber der Headline', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    detail.briefing = { ...detail.briefing, produkte: [] };
    const html = renderBriefingDoc({ detail, compact: true, canDelete: false });
    expect(html).not.toContain('briefing-doc__products');
  });
});
