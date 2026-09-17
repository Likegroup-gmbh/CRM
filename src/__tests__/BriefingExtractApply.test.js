// BriefingExtractApply.test.js
// Guard gegen die IRONCLAD-Regression: Chat-Patches kamen als
// { value, kind }-Wrapper und landeten als "[object Object]" in Textfeldern;
// Extract lieferte KPIs als { kpi, ziel } und Channels als
// [{ format, anzahl, vorgaben }] und band deshalb nicht an die Widgets.
// Fixture = gekuerzte Original-Payloads der Jobs f65c9466 (extract) und
// ac83eaf3 (chat) vom 17.09.2026.

import { describe, it, expect, beforeEach } from 'vitest';
import { BriefingExtractApply, normalizeValue } from '../modules/briefing/create/BriefingExtractApply.js';
import { getAllFields } from '../modules/briefing/create/fieldConfig.js';

const SPEC = getAllFields();
const byName = (name) => SPEC.find((f) => f.name === name);

function createApply(formData = {}) {
  const briefing = { formData, render() {} };
  return new BriefingExtractApply(briefing);
}

// Gekuerzter Extract aus Job f65c9466 (Shapes wie von Claude geliefert)
const IRONCLAD_EXTRACT = {
  aktivierung_name: { value: 'IRONCLAD FORCE-FIT Leggings — Creator-Kampagne', kind: 'fact', from: 'Seite 1' },
  ansatz: { value: 'kampagne', kind: 'fact' },
  zusaetzliche_sprachen: { value: 'false', kind: 'fact' },
  go_live: { value: '2026-11-17', kind: 'fact' },
  maerkte: { value: ['deutschland', 'oesterreich', 'schweiz'], kind: 'fact' },
  im_funnel_stufen: { value: ['upper', 'mid'], kind: 'fact' },
  im_kpis: {
    value: [
      { kpi: 'views', ziel: 'kumuliert 3–5 Mio. Views' },
      { kpi: 'engagement_rate', ziel: 'Ø ≥ 4 %' }
    ],
    kind: 'fact'
  },
  im_channels: {
    value: {
      instagram: [
        { format: 'reel', anzahl: '1', vorgaben: '20–35 Sek.' },
        { format: 'story', anzahl: '3–5 Frames', vorgaben: 'Swipe-Up' }
      ],
      tiktok: [{ format: 'video', anzahl: '1', vorgaben: '15–30 Sek.' }]
    },
    kind: 'fact'
  },
  im_creator_merkmale: {
    value: { alter: '22–38 Jahre', geschlecht: 'Vorrangig weiblich', standort: 'DACH', expertise: '', sonstiges: '' },
    kind: 'fact'
  },
  unternehmen_id: { value: 'FORGEWORKS AG', kind: 'fact' },
  assignee_id: { value: 'Mara Vogler', kind: 'fact' }
};

// Gekuerzte Chat-Patches aus Job ac83eaf3 ({ value, kind }-Wrapper)
const IRONCLAD_CHAT = {
  aktivierung_name: { kind: 'fact', value: 'IRONCLAD FORCE-FIT Leggings Launch Kampagne' },
  creator_rolle: { kind: 'fact', value: 'Creator testen die Leggings im Training.' },
  im_kpis: { kind: 'fact', value: [{ kpi: 'reichweite', wert: '2.500.000' }] },
  im_channels: {
    kind: 'fact',
    value: { instagram: { active: true, formats: ['reel', 'story'], deliverables: '2x Reels' } }
  }
};

describe('normalizeValue', () => {
  it('Text: Wrapper und Arrays werden String, nie "[object Object]"', () => {
    const field = byName('aktivierung_name');
    expect(normalizeValue(field, 'Launch')).toBe('Launch');
    expect(normalizeValue(field, { value: 'Launch', kind: 'fact' })).toBe('Launch');
    expect(normalizeValue(field, ['Zeile 1', 'Zeile 2'])).toBe('Zeile 1\nZeile 2');
    expect(normalizeValue(field, { foo: 'bar' })).toBeNull();
  });

  it('Date: deutsches Datum wird ISO', () => {
    const field = byName('go_live');
    expect(normalizeValue(field, '2026-11-17')).toBe('2026-11-17');
    expect(normalizeValue(field, '17.11.2026')).toBe('2026-11-17');
  });

  it('Radio: Label und value mappen, Boolean-Radio wird Boolean', () => {
    expect(normalizeValue(byName('ansatz'), 'kampagne')).toBe('kampagne');
    expect(normalizeValue(byName('ansatz'), 'Kampagne')).toBe('kampagne');
    expect(normalizeValue(byName('ansatz'), 'quatsch')).toBeNull();
    expect(normalizeValue(byName('zusaetzliche_sprachen'), 'false')).toBe(false);
    expect(normalizeValue(byName('zusaetzliche_sprachen'), true)).toBe(true);
  });

  it('checkboxes: nur bekannte Option-values', () => {
    const field = byName('im_funnel_stufen');
    expect(normalizeValue(field, ['upper', 'Mid Funnel – Consideration', 'quatsch']))
      .toEqual(['upper', 'mid']);
  });

  it('customMulti: unbekannte Werte bleiben als Freitext', () => {
    const field = byName('maerkte');
    expect(normalizeValue(field, ['deutschland', 'USA'])).toEqual(['deutschland', 'USA']);
  });

  it('repeatableKpi: ziel/wert werden zu zielwert', () => {
    const field = byName('im_kpis');
    expect(normalizeValue(field, [
      { kpi: 'views', ziel: '3–5 Mio.' },
      { kpi: 'Engagement Rate', wert: '4 %' }
    ])).toEqual([
      { kpi: 'views', zielwert: '3–5 Mio.' },
      { kpi: 'engagement_rate', zielwert: '4 %' }
    ]);
  });

  it('channelGroup: format-Objekte werden flach, anzahl/vorgaben fallen weg', () => {
    const field = byName('im_channels');
    expect(normalizeValue(field, {
      instagram: [
        { format: 'reel', anzahl: '1', vorgaben: '20–35 Sek.' },
        { format: 'story', anzahl: '3–5', vorgaben: 'Swipe-Up' }
      ],
      tiktok: [{ format: 'video', anzahl: '1', vorgaben: 'nativ' }],
      youtube: []
    })).toEqual({ instagram: ['reel', 'story'], tiktok: ['video'] });
  });

  it('channelGroup: Chat-Shape { active, formats } wird flach', () => {
    const field = byName('im_channels');
    expect(normalizeValue(field, {
      instagram: { active: true, formats: ['reel', 'story'], deliverables: '2x Reels' }
    })).toEqual({ instagram: ['reel', 'story'] });
  });

  it('group: nur bekannte Subkeys, als Strings', () => {
    const field = byName('im_creator_merkmale');
    expect(normalizeValue(field, { alter: '22–38', quatsch: 'x' }))
      .toEqual({ alter: '22–38', geschlecht: '', standort: '', expertise: '', sonstiges: '' });
  });

  it('entitySelect: Namen werden verworfen, UUIDs bleiben', () => {
    const field = byName('unternehmen_id');
    expect(normalizeValue(field, 'FORGEWORKS AG')).toBeNull();
    expect(normalizeValue(field, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'))
      .toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479');
  });
});

describe('BriefingExtractApply.apply (Extract)', () => {
  let apply;

  beforeEach(() => {
    apply = createApply();
  });

  it('uebernimmt den IRONCLAD-Extract in Widget-Shapes', () => {
    const { applied } = apply.apply(IRONCLAD_EXTRACT, SPEC);
    const data = apply.briefing.formData;

    expect(data.aktivierung_name).toBe('IRONCLAD FORCE-FIT Leggings — Creator-Kampagne');
    expect(data.ansatz).toBe('kampagne');
    expect(data.zusaetzliche_sprachen).toBe(false);
    expect(data.go_live).toBe('2026-11-17');
    expect(data.maerkte).toEqual(['deutschland', 'oesterreich', 'schweiz']);
    expect(data.im_funnel_stufen).toEqual(['upper', 'mid']);
    expect(data.im_kpis).toEqual([
      { kpi: 'views', zielwert: 'kumuliert 3–5 Mio. Views' },
      { kpi: 'engagement_rate', zielwert: 'Ø ≥ 4 %' }
    ]);
    expect(data.im_channels).toEqual({ instagram: ['reel', 'story'], tiktok: ['video'] });
    expect(data.im_creator_merkmale.alter).toBe('22–38 Jahre');
    expect(applied.length).toBeGreaterThan(5);
  });

  it('Entity-Felder mit Namen statt UUIDs werden nicht geschrieben', () => {
    apply.apply(IRONCLAD_EXTRACT, SPEC);
    expect(apply.briefing.formData).not.toHaveProperty('unternehmen_id');
    expect(apply.briefing.formData).not.toHaveProperty('assignee_id');
  });

  it('vom Nutzer gefuellte Felder bleiben stehen', () => {
    apply.briefing.formData.aktivierung_name = 'Eigener Name';
    const { applied, skipped } = apply.apply(IRONCLAD_EXTRACT, SPEC);
    expect(apply.briefing.formData.aktivierung_name).toBe('Eigener Name');
    expect(skipped).toContain('Wie heisst die Aktivierung?');
    expect(applied).not.toContain('Wie heisst die Aktivierung?');
  });
});

describe('BriefingExtractApply.applyPatches (Chat)', () => {
  it('schreibt den Feldwert, nicht den { value, kind }-Wrapper', () => {
    const apply = createApply();
    const { applied } = apply.applyPatches(IRONCLAD_CHAT, SPEC);
    const data = apply.briefing.formData;

    expect(data.aktivierung_name).toBe('IRONCLAD FORCE-FIT Leggings Launch Kampagne');
    expect(data.creator_rolle).toBe('Creator testen die Leggings im Training.');
    expect(data.im_kpis).toEqual([{ kpi: 'reichweite', zielwert: '2.500.000' }]);
    expect(data.im_channels).toEqual({ instagram: ['reel', 'story'] });
    expect(applied.length).toBe(4);

    // Kein "[object Object]" mehr moeglich
    for (const value of Object.values(data)) {
      expect(String(typeof value === 'object' ? JSON.stringify(value) : value))
        .not.toContain('[object Object]');
    }
  });

  it('darf vorhandene Werte ueberschreiben', () => {
    const apply = createApply({ aktivierung_name: 'Alt' });
    apply.applyPatches(IRONCLAD_CHAT, SPEC);
    expect(apply.briefing.formData.aktivierung_name)
      .toBe('IRONCLAD FORCE-FIT Leggings Launch Kampagne');
  });
});
