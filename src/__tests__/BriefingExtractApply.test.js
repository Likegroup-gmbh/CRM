// BriefingExtractApply.test.js
// Guard gegen die IRONCLAD-Regression: Chat-Patches kamen als
// { value, kind }-Wrapper und landeten als "[object Object]" in Textfeldern;
// Extract lieferte KPIs als { kpi, ziel } und Channels als
// [{ format, anzahl, vorgaben }] und band deshalb nicht an die Widgets.
// Fixture = gekuerzte Original-Payloads der Jobs f65c9466 (extract) und
// ac83eaf3 (chat) vom 17.09.2026, auf die aktuelle fieldConfig gemappt.

import { describe, it, expect, beforeEach } from 'vitest';
import { BriefingExtractApply, normalizeValue } from '../modules/briefing/create/BriefingExtractApply.js';
import { formatExtractResult } from '../modules/briefing/create/BriefingLikyPanel.js';
import { getAllFields, MAERKTE_OPTIONS } from '../modules/briefing/create/fieldConfig.js';

const SPEC = getAllFields();
const byName = (name) => SPEC.find((f) => f.name === name);

function createApply(formData = {}) {
  const briefing = { formData, render() {} };
  return new BriefingExtractApply(briefing);
}

const DATE_FIELD = { name: 'go_live', type: 'date' };
const BOOLEAN_RADIO = {
  name: 'zusaetzliche_sprachen',
  type: 'radio',
  options: [{ value: 'true', label: 'Ja' }, { value: 'false', label: 'Nein' }]
};
const CUSTOM_MULTI = { name: 'maerkte', type: 'customMulti', options: MAERKTE_OPTIONS };
const KPI_FIELD = {
  name: 'im_kpis',
  type: 'repeatableKpi',
  kpiOptions: [
    { value: 'views', label: 'Views' },
    { value: 'engagement_rate', label: 'Engagement Rate' },
    { value: 'reichweite', label: 'Reichweite' }
  ]
};

const PRODUKT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// Gekuerzter Extract aus Job f65c9466, Feldnamen der aktuellen Spec
const IRONCLAD_EXTRACT = {
  aktivierung_name: { value: 'IRONCLAD FORCE-FIT Leggings — Creator-Kampagne', kind: 'fact', from: 'Seite 1' },
  veroeffentlichungszeitraum: { value: 'KW 46–48 / Go-Live 17.11.2026', kind: 'fact' },
  funnel_stufen: { value: ['upper', 'mid'], kind: 'fact' },
  publish_channels: {
    value: {
      instagram: [
        { format: 'reel', anzahl: '1', vorgaben: '20–35 Sek.' },
        { format: 'story', anzahl: '3–5 Frames', vorgaben: 'Swipe-Up' }
      ],
      tiktok: [{ format: 'video', anzahl: '1', vorgaben: '15–30 Sek.' }]
    },
    kind: 'fact'
  },
  creator_merkmale: {
    value: { alter: '22–38 Jahre', geschlecht: 'Vorrangig weiblich', standort: 'DACH' },
    kind: 'fact'
  },
  aufgabe: { value: 'Creator testen die Leggings im Training.', kind: 'fact' },
  unternehmen_id: { value: 'FORGEWORKS AG', kind: 'fact' },
  assignee_id: { value: 'Mara Vogler', kind: 'fact' }
};

// Gekuerzte Chat-Patches aus Job ac83eaf3 ({ value, kind }-Wrapper)
const IRONCLAD_CHAT = {
  aktivierung_name: { kind: 'fact', value: 'IRONCLAD FORCE-FIT Leggings Launch Kampagne' },
  aufgabe: { kind: 'fact', value: 'Creator testen die Leggings im Training.' },
  publish_channels: {
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
    expect(normalizeValue(DATE_FIELD, '2026-11-17')).toBe('2026-11-17');
    expect(normalizeValue(DATE_FIELD, '17.11.2026')).toBe('2026-11-17');
  });

  it('Radio: Label und value mappen, Boolean-Radio wird Boolean', () => {
    expect(normalizeValue(byName('rohmaterial'), 'ja')).toBe('ja');
    expect(normalizeValue(byName('rohmaterial'), 'Ja')).toBe('ja');
    expect(normalizeValue(byName('rohmaterial'), 'quatsch')).toBeNull();
    expect(normalizeValue(BOOLEAN_RADIO, 'false')).toBe(false);
    expect(normalizeValue(BOOLEAN_RADIO, true)).toBe(true);
  });

  it('checkboxes: nur bekannte Option-values', () => {
    const field = byName('funnel_stufen');
    expect(normalizeValue(field, ['upper', 'Mid Funnel – Consideration', 'quatsch']))
      .toEqual(['upper', 'mid']);
  });

  it('customMulti: unbekannte Werte bleiben als Freitext', () => {
    expect(normalizeValue(CUSTOM_MULTI, ['deutschland', 'USA'])).toEqual(['deutschland', 'USA']);
  });

  it('repeatableKpi: ziel/wert werden zu zielwert', () => {
    expect(normalizeValue(KPI_FIELD, [
      { kpi: 'views', ziel: '3–5 Mio.' },
      { kpi: 'Engagement Rate', wert: '4 %' }
    ])).toEqual([
      { kpi: 'views', zielwert: '3–5 Mio.' },
      { kpi: 'engagement_rate', zielwert: '4 %' }
    ]);
  });

  it('channelGroup: format-Objekte werden flach, anzahl/vorgaben fallen weg', () => {
    const field = byName('publish_channels');
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
    const field = byName('publish_channels');
    expect(normalizeValue(field, {
      instagram: { active: true, formats: ['reel', 'story'], deliverables: '2x Reels' }
    })).toEqual({ instagram: ['reel', 'story'] });
  });

  it('group: nur bekannte Subkeys, als Strings', () => {
    const field = byName('creator_merkmale');
    expect(normalizeValue(field, { alter: '22–38', quatsch: 'x' }))
      .toEqual({ alter: '22–38', geschlecht: '', standort: '' });
  });

  it('entitySelect: Namen werden verworfen, UUIDs bleiben', () => {
    const field = byName('unternehmen_id');
    expect(normalizeValue(field, 'FORGEWORKS AG')).toBeNull();
    expect(normalizeValue(field, PRODUKT_ID)).toBe(PRODUKT_ID);
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
    expect(data.veroeffentlichungszeitraum).toBe('KW 46–48 / Go-Live 17.11.2026');
    expect(data.funnel_stufen).toEqual(['upper', 'mid']);
    expect(data.publish_channels).toEqual({ instagram: ['reel', 'story'], tiktok: ['video'] });
    expect(data.creator_merkmale.alter).toBe('22–38 Jahre');
    expect(data.aufgabe).toBe('Creator testen die Leggings im Training.');
    expect(applied.length).toBeGreaterThan(4);
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
    expect(skipped).toContain('Titel');
    expect(applied).not.toContain('Titel');
  });
});

describe('BriefingExtractApply.applyProduktHints', () => {
  it('schreibt bekannte Produkt-IDs, wenn produkt_ids leer ist', () => {
    const apply = createApply();
    const labels = apply.applyProduktHints([
      { name: 'IRONCLAD FORCE-FIT Leggings', produkt_id: PRODUKT_ID },
      { name: 'Unbekannt', produkt_id: null }
    ]);
    expect(apply.briefing.formData.produkt_ids).toEqual([PRODUKT_ID]);
    expect(labels).toEqual(['Produkte']);
  });

  it('laesst vorhandene produkt_ids stehen', () => {
    const apply = createApply({ produkt_ids: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] });
    const labels = apply.applyProduktHints([
      { name: 'IRONCLAD FORCE-FIT Leggings', produkt_id: PRODUKT_ID }
    ]);
    expect(apply.briefing.formData.produkt_ids).toEqual(['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']);
    expect(labels).toEqual([]);
  });

  it('schreibt nichts, wenn nur unbekannte Produkte kommen', () => {
    const apply = createApply();
    const labels = apply.applyProduktHints([
      { name: 'IRONCLAD FORCE-FIT Leggings', produkt_id: null }
    ]);
    expect(apply.briefing.formData).not.toHaveProperty('produkt_ids');
    expect(labels).toEqual([]);
  });
});

describe('BriefingExtractApply.applyPatches (Chat)', () => {
  it('schreibt den Feldwert, nicht den { value, kind }-Wrapper', () => {
    const apply = createApply();
    const { applied } = apply.applyPatches(IRONCLAD_CHAT, SPEC);
    const data = apply.briefing.formData;

    expect(data.aktivierung_name).toBe('IRONCLAD FORCE-FIT Leggings Launch Kampagne');
    expect(data.aufgabe).toBe('Creator testen die Leggings im Training.');
    expect(data.publish_channels).toEqual({ instagram: ['reel', 'story'] });
    expect(applied.length).toBe(3);

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

describe('formatExtractResult', () => {
  it('zeigt keine Orphans, auch wenn der Job sie noch liefert', () => {
    const text = formatExtractResult({
      orphans: [
        { text: 'Agentur-Scope', frage: 'Soll der Agentur-Scope in einem separaten Feld erfasst werden?' },
        { text: 'Mara Vogler', frage: 'Soll die Kontaktperson Mara Vogler in einem separaten Feld gespeichert werden?' }
      ]
    }, ['Titel'], []);
    expect(text).not.toContain('nicht zuordnen');
    expect(text).not.toContain('Kontaktperson');
    expect(text).not.toContain('Agentur-Scope');
    expect(text).toContain('1 Felder gefüllt');
  });

  it('nennt unbekannte Produkte, nicht die Rueckfrage dazu', () => {
    const text = formatExtractResult({
      orphans: [{ text: 'x', frage: 'Soll ich das Produkt anlegen?' }],
      produkte_hint: [{ name: 'IRONCLAD FORCE-FIT Leggings', produkt_id: null }]
    }, [], []);
    expect(text).toContain('Produkte nicht im CRM: IRONCLAD FORCE-FIT Leggings');
    expect(text).not.toContain('nicht zuordnen');
    expect(text).not.toContain('anlegen');
  });

  it('warnt bei abweichendem Unternehmen', () => {
    const text = formatExtractResult({
      unternehmen_hint: { name: 'FORGEWORKS AG', passt: false }
    }, [], []);
    expect(text).toContain('FORGEWORKS AG');
    expect(text).toContain('gewählte Unternehmen bleibt');
  });
});
