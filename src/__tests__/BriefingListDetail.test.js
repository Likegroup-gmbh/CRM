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
