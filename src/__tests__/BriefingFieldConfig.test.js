// BriefingFieldConfig.test.js
// Guard fuer den FLOW-Briefing-Fragenkatalog.

import { describe, it, expect } from 'vitest';
import {
  BEREICH_OPTIONS,
  CREATOR_GROESSEN_UGC,
  FLOW_STEPS,
  IM_CHANNELS,
  getStepsForBereich,
  getAllFields,
  flattenFields,
  evaluateCondition,
  isFieldActive
} from '../modules/briefing/create/fieldConfig.js';

describe('Briefing fieldConfig Schema', () => {
  it('hat genau die drei Typen Paid, Organic, Influencer', () => {
    expect(BEREICH_OPTIONS.map(b => b.value)).toEqual([
      'paid_creator_ads',
      'owned_social',
      'influencer_marketing'
    ]);
    expect(BEREICH_OPTIONS.map(b => b.label)).toEqual(['Paid', 'Organic', 'Influencer']);
  });

  it('alle persistierten Feldnamen sind eindeutig', () => {
    const names = getAllFields().map(f => f.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });

  it('Schritte sind Grundlage, Casting, Aufgabe, Konzepte, Vertrag', () => {
    expect(FLOW_STEPS.map(s => s.id)).toEqual([
      'grundlage', 'casting', 'aufgabe', 'konzepte', 'vertrag'
    ]);
    for (const b of BEREICH_OPTIONS.map(x => x.value)) {
      expect(getStepsForBereich(b).map(s => s.id)).toEqual(FLOW_STEPS.map(s => s.id));
    }
  });

  it('Pflichtfelder sitzen in Grundlage', () => {
    const fields = flattenFields(FLOW_STEPS[0].sections.flatMap(s => s.fields));
    const required = fields.filter(f => f.required).map(f => f.name);
    expect(required).toContain('unternehmen_id');
    expect(required).toContain('aktivierung_name');
    expect(required).toContain('produkt_ids');
    expect(required).toContain('persona_ids');
  });

  it('produkt_ids liegt nicht in getAllFields (kein DB-Feld)', () => {
    expect(getAllFields().map(f => f.name)).not.toContain('produkt_ids');
    expect(getAllFields().map(f => f.name)).toContain('persona_ids');
  });

  it('Optionslisten haben value + label', () => {
    for (const field of getAllFields()) {
      if (field.options) {
        for (const opt of field.options) {
          expect(opt.value, `Option ohne value bei ${field.name}`).toBeTruthy();
          expect(opt.label, `Option ohne label bei ${field.name}`).toBeTruthy();
        }
      }
    }
  });
});

describe('Briefing evaluateCondition', () => {
  it('ohne Condition immer true', () => {
    expect(evaluateCondition(null, {})).toBe(true);
  });

  it('equals, in, all, any', () => {
    expect(evaluateCondition({ field: 'bereich', equals: 'paid_creator_ads' }, { bereich: 'paid_creator_ads' })).toBe(true);
    expect(evaluateCondition({ field: 'bereich', in: ['owned_social', 'influencer_marketing'] }, { bereich: 'owned_social' })).toBe(true);
    expect(evaluateCondition({
      all: [
        { field: 'bereich', equals: 'paid_creator_ads' },
        { any: [
          { field: 'nutzung_markenkanal', equals: true },
          { field: 'nutzung_creator_kanal', equals: true }
        ] }
      ]
    }, { bereich: 'paid_creator_ads', nutzung_markenkanal: true })).toBe(true);
    expect(evaluateCondition({
      all: [
        { field: 'bereich', equals: 'paid_creator_ads' },
        { any: [
          { field: 'nutzung_markenkanal', equals: true },
          { field: 'nutzung_creator_kanal', equals: true }
        ] }
      ]
    }, { bereich: 'paid_creator_ads' })).toBe(false);
  });

  it('Typ-Felder sitzen in A, C, D und Vertrag, nicht als Extra-Schritt', () => {
    const namesIn = (stepId) => FLOW_STEPS
      .find(s => s.id === stepId)
      .sections
      .flatMap(s => flattenFields(s.fields).map(f => f.name));

    expect(namesIn('grundlage')).toEqual(expect.arrayContaining([
      'funnel_stufen', 'paid_objectives', 'content_ziele', 'veroeffentlichungszeitraum',
      'plattformmechanik', 'freigabeprozess'
    ]));
    expect(namesIn('aufgabe')).toContain('art_der_integration');
    expect(namesIn('konzepte')).toEqual(expect.arrayContaining([
      'ad_channels', 'publish_channels', 'cta', 'ziel_url', 'hook_vorgaben',
      'trendkontext', 'posting_anforderungen'
    ]));
    expect(namesIn('konzepte')).not.toContain('plattformmechanik');
    expect(namesIn('konzepte')).not.toContain('freigabeprozess');
    expect(namesIn('casting')).toEqual(expect.arrayContaining([
      'voraussetzungen', 'voraussetzungen_sonstiges', 'produkt_erfahrung'
    ]));
    expect(namesIn('casting')).not.toContain('voraussetzungen_weiter');
    const castingFields = FLOW_STEPS.find(s => s.id === 'casting').sections[0].fields.map(f => f.name);
    expect(castingFields.indexOf('produkt_erfahrung')).toBeLessThan(castingFields.indexOf('aussehen'));
    expect(namesIn('vertrag')).toEqual(expect.arrayContaining([
      'nutzung_markenkanal', 'nutzung_paid_media', 'verhandlungshinweis'
    ]));
    expect(FLOW_STEPS.map(s => s.id)).not.toContain('extras');
  });

  it('isFieldActive erkennt die zweite Plattform nur bei Misch-Nutzung', () => {
    expect(isFieldActive('ad_channels', { bereich: 'paid_creator_ads' })).toBe(true);
    expect(isFieldActive('publish_channels', { bereich: 'paid_creator_ads' })).toBe(false);
    expect(isFieldActive('publish_channels', {
      bereich: 'paid_creator_ads',
      nutzung_markenkanal: true
    })).toBe(true);
  });

  it('Influencer-Plattformen enthalten Facebook, LinkedIn, Pinterest und Live-Formate', () => {
    expect(IM_CHANNELS.map(c => c.key)).toEqual([
      'instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'pinterest'
    ]);
    expect(IM_CHANNELS.find(c => c.key === 'instagram').formats.map(f => f.value)).toContain('live');
    expect(IM_CHANNELS.find(c => c.key === 'facebook').formats).toBeNull();
  });

  it('Creator-Größe zeigt Follower-Bänder, Werte bleiben intern', () => {
    const byValue = Object.fromEntries(CREATOR_GROESSEN_UGC.map(o => [o.value, o.label]));
    expect(byValue.ugc_creator).toBe('UGC Creator (keine Zahl)');
    expect(byValue.nano).toBe('Nano (0–10K)');
    expect(byValue.micro).toBe('Micro (10K–100K)');
    expect(byValue.mid_tier).toBe('Mid-Tier (100K–500K)');
    expect(byValue.macro).toBe('Macro (500K–1Mio)');
    expect(byValue.hero).toBe('Hero (1Mio+)');
  });

  it('channelGroup nutzt Sonstige Plattformen statt Sonstiges', () => {
    const groups = FLOW_STEPS.flatMap(s => s.sections)
      .flatMap(sec => flattenFields(sec.fields))
      .filter(f => f.type === 'channelGroup');
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every(f => f.customLabel === 'Sonstige Plattformen')).toBe(true);
  });
});
