// v1-Katalog in der fertigen Ansicht; FLOW-Briefings bleiben beim neuen Formular.

import { describe, it, expect, beforeEach } from 'vitest';
import { isLegacyBriefing, resolveBriefingFieldValue } from '../modules/briefing/briefingLegacy.js';
import { BriefingDetail } from '../modules/briefing/BriefingDetail.js';
import { collectPresentation, renderBriefingDoc } from '../modules/briefing/BriefingDocView.js';

describe('isLegacyBriefing', () => {
  it('erkennt Prefix-Inhalt ohne FLOW-Felder als Legacy', () => {
    expect(isLegacyBriefing({
      bereich: 'influencer_marketing',
      im_umsetzung: 'Routine filmen'
    })).toBe(true);
  });

  it('behandelt Default-false nicht als Inhalt', () => {
    expect(isLegacyBriefing({
      bereich: 'influencer_marketing',
      im_keine_benchmarks: false,
      im_umsetzung_offen: false
    })).toBe(false);
  });

  it('FLOW-Inhalt schlaegt Prefix', () => {
    expect(isLegacyBriefing({
      bereich: 'influencer_marketing',
      aufgabe: 'FLOW Aufgabe',
      im_umsetzung: 'Legacy'
    })).toBe(false);
  });
});

describe('resolveBriefingFieldValue', () => {
  it('nimmt FLOW-Wert wenn gesetzt', () => {
    expect(resolveBriefingFieldValue({
      bereich: 'influencer_marketing',
      aufgabe: 'FLOW Aufgabe',
      im_umsetzung: 'Legacy'
    }, 'aufgabe')).toBe('FLOW Aufgabe');
  });

  it('faellt auf Prefix-Umsetzung und Channels zurueck', () => {
    expect(resolveBriefingFieldValue({
      bereich: 'influencer_marketing',
      im_umsetzung: 'Routine filmen'
    }, 'aufgabe')).toBe('Routine filmen');

    expect(resolveBriefingFieldValue({
      bereich: 'paid_creator_ads',
      pa_channels: { meta: ['instagram'] }
    }, 'ad_channels')).toEqual({ meta: ['instagram'] });
  });
});

describe('collectPresentation Legacy', () => {
  let detail;

  beforeEach(() => {
    detail = new BriefingDetail();
    window.validatorSystem = { sanitizeHtml: (s) => String(s ?? '') };
  });

  it('zeigt v1-Labels fuer belegte Prefix-Felder', () => {
    detail.briefing = {
      bereich: 'influencer_marketing',
      aktivierung_name: 'Legacy IM',
      im_umsetzung: 'Routine filmen',
      im_kpis: [{ kpi: 'reichweite', zielwert: '100k' }],
      im_channels: { instagram: ['reel'], tiktok: true }
    };

    const presentation = collectPresentation(detail);
    expect(presentation.prose.some(g =>
      g.title === 'Konkrete Umsetzung'
      && g.items.some(i => String(i.formatted).includes('Routine filmen'))
    )).toBe(true);
    expect(presentation.specs.some(i =>
      i.label === 'Ziele / Benchmarks' && String(i.html).includes('Reichweite')
    )).toBe(true);
    expect(presentation.specs.some(i =>
      i.label === 'Kanäle & Formate' && String(i.html).includes('Instagram')
    )).toBe(true);

    const html = renderBriefingDoc({ detail, compact: true, canEdit: true });
    expect(html).toContain('Konkrete Umsetzung');
    expect(html).toContain('Routine filmen');
    expect(html).toContain('Ziele / Benchmarks');
    expect(html).not.toContain('Hier schreiben');
    expect(html).toContain('/assets/background/LikeGroup_Logo.svg');
    expect(html).not.toContain('LikeGroup_Logo%201');
  });

  it('behaelt FLOW-Aufgabe wenn FLOW-Inhalt gesetzt ist', () => {
    detail.briefing = {
      bereich: 'paid_creator_ads',
      aktivierung_name: 'FLOW Paid',
      aufgabe: 'FLOW Aufgabe',
      im_umsetzung: 'Legacy ignorieren',
      pa_umsetzung: 'Legacy Paid'
    };

    const presentation = collectPresentation(detail);
    expect(presentation.prose.some(g => g.items.some(i =>
      i.field.name === 'aufgabe' && String(i.formatted).includes('FLOW Aufgabe')
    ))).toBe(true);
    expect(presentation.prose.some(g => g.title === 'Konkrete Umsetzung')).toBe(false);
  });

  it('erzeugt bei Legacy keine leeren FLOW-Platzhalter', () => {
    detail.briefing = {
      bereich: 'paid_creator_ads',
      aktivierung_name: 'Legacy Paid',
      pa_umsetzung: 'Serum in der Abendroutine zeigen',
      pa_channels: { meta: ['instagram'] }
    };

    const html = renderBriefingDoc({ detail, compact: false, canEdit: true });
    expect(html).toContain('Konkrete Umsetzung');
    expect(html).toContain('Serum in der Abendroutine zeigen');
    expect(html).toContain('Paid-Kanäle');
    expect(html).not.toContain('Hier schreiben');
    expect(html).not.toContain('data-placeholder');
    expect(html).not.toContain('briefing-doc--editable');
  });
});
