// BriefingListDetail.test.js
// Smoke-Tests: BriefingList rendert Zeilen aus campaign_briefings,
// BriefingDetail formatiert die Feldtypen aus fieldConfig korrekt.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BriefingDetail } from '../modules/briefing/BriefingDetail.js';
import { BriefingList } from '../modules/briefing/BriefingList.js';
import { BEREICH_LABELS } from '../modules/briefing/create/fieldConfig.js';
import { BriefingCreate } from '../modules/briefing/create/BriefingCreateCore.js';

describe('BriefingList Smoke', () => {
  it('BEREICH_LABELS deckt alle Bereiche ab', () => {
    expect(BEREICH_LABELS.influencer_marketing).toBe('Influencer');
    expect(BEREICH_LABELS.paid_creator_ads).toBe('Paid');
    expect(BEREICH_LABELS.owned_social).toBe('Organic');
  });

  it('BriefingList-Modul ist importierbar und Singleton vorhanden', async () => {
    const mod = await import('../modules/briefing/BriefingList.js');
    expect(mod.briefingList).toBeTruthy();
    expect(typeof mod.briefingList.init).toBe('function');
  });

  it('createUrl gibt Ordner-Kontext mit und lässt Ohne-Marke weg', () => {
    const list = new BriefingList();
    expect(list.createUrl()).toBe('/briefing/new');

    list.currentUnternehmenId = 'u1';
    expect(list.createUrl()).toBe('/briefing/new?unternehmen=u1');

    list.currentMarkeId = 'm1';
    expect(list.createUrl()).toBe('/briefing/new?unternehmen=u1&marke=m1');

    list._ohneMarke = true;
    expect(list.createUrl()).toBe('/briefing/new?unternehmen=u1');
  });
});

describe('BriefingCreate Prefill', () => {
  it('applyQueryPrefill setzt Unternehmen und Marke, ignoriert marke=ohne', () => {
    const original = window.location.search;
    const instance = new BriefingCreate();

    window.history.replaceState({}, '', '/briefing/new?unternehmen=u1&marke=m1');
    instance.applyQueryPrefill();
    expect(instance.formData.unternehmen_id).toBe('u1');
    expect(instance.formData.marke_id).toBe('m1');

    instance.formData = {};
    window.history.replaceState({}, '', '/briefing/new?unternehmen=u1&marke=ohne');
    instance.applyQueryPrefill();
    expect(instance.formData.unternehmen_id).toBe('u1');
    expect(instance.formData.marke_id).toBeUndefined();

    window.history.replaceState({}, '', original || '/');
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
    is_draft: false,
    aktivierung_name: 'Sommer-Launch TEWH',
    beschreibung: 'Barrier Repair Serum Launch',
    aufgabe: 'Serum in der Abendroutine zeigen',
    learnings_text: 'Hook in den ersten zwei Sekunden',
    nischen: ['beauty'],
    creator_groessen: ['micro'],
    funnel_stufen: ['upper'],
    unternehmen: { firmenname: 'Skincare Brand' },
    marke: { markenname: 'Skincare', logo_url: 'https://cdn.test/skincare.svg' },
    produkte: [{ id: 'p1', name: 'Barrier Repair Serum' }, { id: 'p2', name: 'Night Cream' }],
    personas: [{ name: 'Abendroutine', oberbegriff: 'Skincare Enthusiastin' }],
    verhandlungshinweis: 'Nutzungsdauer auf 6 Monate herunterhandeln',
    hauttyp: 'Mischhaut',
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
    expect(classifyField({ name: 'beschreibung', type: 'textarea' })).toBe('callout');
    expect(classifyField({ name: 'kampagne_thema', type: 'textarea' })).toBe('callout');
    expect(classifyField({ name: 'aufgabe', type: 'textarea' })).toBe('prose');
    expect(classifyField({ name: 'nischen', type: 'checkboxes' }, 'Welche Creator suchen wir?')).toBe('creator');
    expect(classifyField({ name: 'creator_groessen', type: 'checkboxes' }, 'Welche Creator suchen wir?')).toBe('creator');
    expect(classifyField({ name: 'voraussetzungen_sonstiges', type: 'textarea' }, 'Welche Creator suchen wir?')).toBe('creator');
    expect(classifyField({ name: 'learnings_text', type: 'textarea' })).toBe('secondary');
    expect(classifyField({ name: 'verhandlungshinweis', type: 'textarea' })).toBe('secondary');
    expect(classifyField({ name: 'hauttyp', type: 'text' }, 'Welche Creator suchen wir?')).toBe('secondary');
    expect(classifyField({ name: 'aktivierung_name', type: 'text' })).toBe('hero');
  });

  it('Kompakt filtert Sekundaerfelder, Alle Felder zeigt sie', async () => {
    const { collectPresentation, renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    const presentation = collectPresentation(detail);

    expect(presentation.callout.map(i => i.field.name)).toContain('beschreibung');
    expect(presentation.prose.some(g => g.items.some(i => i.field.name === 'aufgabe'))).toBe(true);
    expect(presentation.creator.some(g => g.items.some(i => i.field.name === 'creator_groessen'))).toBe(true);
    expect(presentation.secondary.some(g => g.items.some(i => i.field.name === 'learnings_text'))).toBe(true);

    const compact = renderBriefingDoc({ detail, compact: true });
    expect(compact).toContain('Barrier Repair Serum Launch');
    expect(compact).toContain('Sommer-Launch TEWH');
    expect(compact).toContain('Serum in der Abendroutine zeigen');
    expect(compact).toContain('Welche Creator suchen wir?');
    expect(compact).toContain('Komprimierte Ansicht');
    expect(compact).toContain('LikeGroup');
    expect(compact).toContain('https://cdn.test/skincare.svg');
    expect(compact).toContain('Skincare Enthusiastin (Abendroutine)');
    expect(compact).not.toContain('Hook in den ersten zwei Sekunden');
    expect(compact).not.toContain('Nutzungsdauer auf 6 Monate herunterhandeln');
    expect(compact).not.toContain('Mischhaut');
    expect(compact).toContain('Alle Felder');
    expect(compact).not.toContain('Erstellt');

    const allFields = renderBriefingDoc({ detail, compact: false });
    expect(allFields).toContain('Hook in den ersten zwei Sekunden');
    expect(allFields).toContain('Nutzungsdauer auf 6 Monate herunterhandeln');
    expect(allFields).toContain('Mischhaut');
    expect(allFields).toContain('Erstellt');
    expect(allFields).toContain('Komprimiert');
    expect(allFields).not.toContain('Komprimierte Ansicht');
    expect(allFields.match(/Konkrete Ideen fuer die Umsetzung/g)?.length || 0).toBeLessThanOrEqual(1);
  });

  it('Alle Felder zeigt Learnings und Admin-Meta', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    const html = renderBriefingDoc({ detail, compact: false });
    expect(html).toContain('Hook in den ersten zwei Sekunden');
    expect(html).toContain('Erstellt');
    expect(html).toContain('Komprimiert');
    expect(html).not.toContain('Komprimierte Ansicht');
  });

  it('Hero zeigt Badges, Unterzeile und Meta-Chips', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    const html = renderBriefingDoc({ detail, compact: true, canDelete: true });
    expect(html).toContain('Final');
    expect(html).toContain('Influencer');
    expect(html).toContain('Skincare Brand');
    expect(html).toContain('Skincare');
    expect(html).toContain('briefing-doc__lockup');
    expect(html).toContain('LikeGroup');
    expect(html).toContain('briefing-doc__lockup-x');
    expect(html).toContain('https://cdn.test/skincare.svg');
    expect(html).toContain('briefing-doc__callout');
    expect(html).toContain('Thema');
    expect(html).toContain('briefing-doc__products');
    expect(html.indexOf('Barrier Repair Serum')).toBeLessThan(html.indexOf('Sommer-Launch TEWH'));
    expect(html.indexOf('Night Cream')).toBeLessThan(html.indexOf('Sommer-Launch TEWH'));
    expect(html).toContain('mdc-btn mdc-btn--delete');
    expect(html).toContain('mdc-btn__label');
    expect(html).toContain('#crm-icon-trash');
    expect(html).not.toContain('mdc-btn--sm');
  });

  it('ohne Produkte und Personas keine Zeile ueber der Headline', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    detail.briefing = { ...detail.briefing, produkte: [], personas: [] };
    const html = renderBriefingDoc({ detail, compact: true, canDelete: false });
    expect(html).not.toContain('briefing-doc__products');
  });

  it('Anschreiben sitzt zwischen Alle Felder und Loeschen, nicht im Print', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    const withBtn = renderBriefingDoc({ detail, canAnschreiben: true, canDelete: true });
    expect(withBtn).toContain('briefing-doc-head');
    expect(withBtn).toContain('btn-anschreiben-briefing');
    expect(withBtn).toContain('mdc-btn__icon');
    expect(withBtn).toContain('mdc-btn__label');
    expect(withBtn).toContain('#crm-icon-list-bullet');
    expect(withBtn).toContain('#crm-icon-mail-send');
    expect(withBtn).toContain('#crm-icon-trash');
    expect(withBtn).not.toContain('mdc-btn--sm');
    expect(withBtn.indexOf('briefing-doc-head')).toBeLessThan(withBtn.indexOf('btn-briefing-fields-toggle'));
    expect(withBtn.indexOf('btn-briefing-fields-toggle')).toBeLessThan(withBtn.indexOf('btn-anschreiben-briefing'));
    expect(withBtn.indexOf('btn-anschreiben-briefing')).toBeLessThan(withBtn.indexOf('btn-delete-briefing'));
    expect(withBtn.indexOf('btn-delete-briefing')).toBeLessThan(withBtn.indexOf('briefing-doc__badges'));
    expect(withBtn).not.toContain('briefing-doc__title-row');
    expect(withBtn).not.toContain('briefing-doc__toolbar');

    const expanded = renderBriefingDoc({ detail, compact: false, canAnschreiben: true });
    expect(expanded).toContain('#crm-icon-arrows-collapse');

    const without = renderBriefingDoc({ detail, canAnschreiben: false });
    expect(without).not.toContain('btn-anschreiben-briefing');

    const print = renderBriefingDoc({ detail, canAnschreiben: true, canDelete: true, print: true });
    expect(print).not.toContain('briefing-doc-head');
    expect(print).not.toContain('btn-anschreiben-briefing');
    expect(print).not.toContain('btn-briefing-fields-toggle');
    expect(print).not.toContain('btn-delete-briefing');
  });
});
