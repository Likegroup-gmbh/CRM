// v1-Prefix-Spalten fuellen die fertige Briefing-Ansicht, wenn FLOW leer ist.

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveBriefingFieldValue } from '../modules/briefing/briefingLegacy.js';
import { BriefingDetail } from '../modules/briefing/BriefingDetail.js';
import { collectPresentation, renderBriefingDoc } from '../modules/briefing/BriefingDocView.js';

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

  it('zeigt im_umsetzung als Aufgabe und pa_channels als Ad-Plattformen', () => {
    detail.briefing = {
      bereich: 'paid_creator_ads',
      aktivierung_name: 'Legacy Paid',
      im_umsetzung: 'should ignore',
      pa_umsetzung: 'Serum in der Abendroutine zeigen',
      pa_channels: { meta: ['instagram'], tiktok: true }
    };

    const presentation = collectPresentation(detail);
    expect(presentation.prose.some(g => g.items.some(i =>
      i.field.name === 'aufgabe' && String(i.formatted).includes('Abendroutine')
    ))).toBe(true);
    expect(presentation.specs.some(i =>
      i.label === 'Ad-Plattformen' && String(i.html).includes('Instagram')
    )).toBe(true);

    const html = renderBriefingDoc({ detail, compact: true });
    expect(html).toContain('Serum in der Abendroutine zeigen');
    expect(html).toContain('/assets/background/LikeGroup_Logo.svg');
    expect(html).not.toContain('LikeGroup_Logo%201');
  });
});
