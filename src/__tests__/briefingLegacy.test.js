// v1-Briefings (nur Präfix-Spalten): Erkennung, Fallback-Werte und Anzeige unter „Frühere Angaben“.

import { describe, it, expect } from 'vitest';
import { isLegacyBriefing, resolveBriefingFieldValue } from '../modules/briefing/briefingLegacy.js';
import { renderBriefingDoc } from '../modules/briefing/BriefingDocView.js';
import { makeDetail } from './briefingDocTestKit.js';

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

describe('resolveBriefingFieldValue für das Creator-Briefing', () => {
  it('Plattformen kommen bei älteren Briefings aus den Kanal-Spalten', () => {
    expect(resolveBriefingFieldValue({
      bereich: 'influencer_marketing',
      im_channels: { instagram: ['reel'], tiktok: true }
    }, 'plattformen')).toEqual(['instagram', 'tiktok']);
    expect(resolveBriefingFieldValue({ bereich: 'owned_social', plattformen: ['youtube'] }, 'plattformen')).toEqual(['youtube']);
  });

  it('Umsetzungsideen kommen aus dem alten Text als Inspiration', () => {
    expect(resolveBriefingFieldValue({ bereich: 'paid_creator_ads', pa_ideen_text: 'Unboxing' }, 'umsetzungsideen_eintraege'))
      .toEqual([{ text: 'Unboxing', verbindlich: false }]);
    expect(resolveBriefingFieldValue({ bereich: 'paid_creator_ads' }, 'umsetzungsideen_eintraege')).toBeNull();
  });
});

describe('v1-Briefing im Dokument', () => {
  const V1_IM = {
    bereich: 'influencer_marketing',
    aktivierung_name: 'Legacy IM',
    im_umsetzung: 'Routine filmen',
    im_kpis: [{ kpi: 'reichweite', zielwert: '100k' }],
    im_channels: { instagram: ['reel'], tiktok: true }
  };

  it('zeigt die Aufgabe über den Fallback und den v1-Katalog unter Frühere Angaben', () => {
    const html = renderBriefingDoc({ detail: makeDetail(V1_IM), compact: true, canEdit: true, fruehereAngaben: true });
    expect(html).toContain('Routine filmen');
    expect(html).toContain('Frühere Angaben');
    expect(html).toContain('Ziele / Benchmarks');
    expect(html).toContain('Reichweite');
    expect(html).toContain('Kanäle &amp; Formate');
    expect(html).toMatch(/<details class="briefing-doc__section briefing-doc__alt" open>/);
    expect(html).toContain('/assets/background/LikeGroup_Logo.svg');
  });

  it('ist nicht inline editierbar und erzeugt keine leeren Platzhalter', () => {
    const html = renderBriefingDoc({
      detail: makeDetail({ bereich: 'paid_creator_ads', aktivierung_name: 'Legacy Paid', pa_umsetzung: 'Serum abends', pa_channels: { meta: ['instagram'] } }),
      compact: false,
      canEdit: true,
      fruehereAngaben: true
    });
    expect(html).toContain('Serum abends');
    expect(html).toContain('Paid-Kanäle');
    expect(html.match(/data-placeholder=/g)).toHaveLength(1);
    expect(html).toContain('data-feld="aktivierung_name" data-placeholder="Kampagnentitel"');
    expect(html).not.toContain('briefing-doc--editable');
  });

  it('ein Creator-Briefing zeigt keinen v1-Katalog', () => {
    const html = renderBriefingDoc({
      detail: makeDetail({ bereich: 'paid_creator_ads', aktivierung_name: 'Neu', aufgabe: 'Neue Aufgabe', pa_umsetzung: 'Alt' }),
      fruehereAngaben: true
    });
    expect(html).toContain('Neue Aufgabe');
    expect(html).not.toContain('Konkrete Umsetzung');
  });
});
