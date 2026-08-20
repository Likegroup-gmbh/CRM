// BriefingFieldConfig.test.js
// Guard fuer den Briefing-Generator-Fragenkatalog:
// 1) Feldnamen sind eindeutig und DB-kompatibel (Snakecase, Modul-Prefixe)
// 2) Condition-Referenzen zeigen auf existierende Felder
// 3) evaluateCondition deckt equals/in/includes/includesAny korrekt ab
// 4) Step-Struktur: Master + je Bereich Modul-Steps

import { describe, it, expect } from 'vitest';
import {
  BEREICH_OPTIONS,
  MASTER_STEPS,
  MODULE_STEPS,
  getStepsForBereich,
  getAllFields,
  evaluateCondition
} from '../modules/briefing/create/fieldConfig.js';

describe('Briefing fieldConfig Schema', () => {
  it('hat genau die drei Bereiche aus der Typ-Auswahl', () => {
    expect(BEREICH_OPTIONS.map(b => b.value)).toEqual([
      'influencer_marketing',
      'paid_creator_ads',
      'owned_social'
    ]);
    for (const b of BEREICH_OPTIONS) {
      expect(MODULE_STEPS[b.value], `MODULE_STEPS fehlt fuer ${b.value}`).toBeTruthy();
      expect(MODULE_STEPS[b.value].length).toBeGreaterThan(0);
    }
  });

  it('alle Feldnamen sind eindeutig', () => {
    const names = getAllFields().map(f => f.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });

  it('Modul-Felder tragen den Prefix ihres Bereichs', () => {
    const prefixByBereich = { influencer_marketing: 'im_', paid_creator_ads: 'pa_', owned_social: 'os_' };
    for (const [bereich, steps] of Object.entries(MODULE_STEPS)) {
      for (const step of steps) {
        for (const section of step.sections) {
          for (const field of section.fields) {
            expect(
              field.name.startsWith(prefixByBereich[bereich]),
              `${field.name} in ${bereich} ohne Prefix ${prefixByBereich[bereich]}`
            ).toBe(true);
          }
        }
      }
    }
  });

  it('jede Condition referenziert ein existierendes Feld', () => {
    const names = new Set(getAllFields().map(f => f.name));
    for (const step of [...MASTER_STEPS, ...Object.values(MODULE_STEPS).flat()]) {
      for (const section of step.sections) {
        if (section.condition) {
          expect(names.has(section.condition.field), `Section-Condition "${section.condition.field}" unbekannt`).toBe(true);
        }
        for (const field of section.fields) {
          if (field.condition) {
            expect(names.has(field.condition.field), `Condition "${field.condition.field}" bei ${field.name} unbekannt`).toBe(true);
          }
        }
      }
    }
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

  it('getStepsForBereich haengt Modul-Steps hinter die Master-Steps', () => {
    for (const b of BEREICH_OPTIONS.map(x => x.value)) {
      const steps = getStepsForBereich(b);
      expect(steps.slice(0, MASTER_STEPS.length).map(s => s.id)).toEqual(MASTER_STEPS.map(s => s.id));
      expect(steps.length).toBe(MASTER_STEPS.length + MODULE_STEPS[b].length);
    }
  });

  it('Pflichtfelder unternehmen_id + aktivierung_name sind im Master-Step', () => {
    const masterFields = MASTER_STEPS.flatMap(s => s.sections.flatMap(sec => sec.fields));
    const required = masterFields.filter(f => f.required).map(f => f.name);
    expect(required).toContain('unternehmen_id');
    expect(required).toContain('aktivierung_name');
  });
});

describe('Briefing evaluateCondition', () => {
  it('ohne Condition immer true', () => {
    expect(evaluateCondition(null, {})).toBe(true);
    expect(evaluateCondition(undefined, { a: 1 })).toBe(true);
  });

  it('equals mit Boolean und String', () => {
    expect(evaluateCondition({ field: 'ansatz', equals: 'kampagne' }, { ansatz: 'kampagne' })).toBe(true);
    expect(evaluateCondition({ field: 'ansatz', equals: 'kampagne' }, { ansatz: 'always_on' })).toBe(false);
    expect(evaluateCondition({ field: 'zusaetzliche_sprachen', equals: true }, { zusaetzliche_sprachen: true })).toBe(true);
    expect(evaluateCondition({ field: 'zusaetzliche_sprachen', equals: true }, { zusaetzliche_sprachen: 'true' })).toBe(false);
  });

  it('in-Liste', () => {
    const cond = { field: 'im_ideen_status', in: ['ja', 'teilweise'] };
    expect(evaluateCondition(cond, { im_ideen_status: 'ja' })).toBe(true);
    expect(evaluateCondition(cond, { im_ideen_status: 'teilweise' })).toBe(true);
    expect(evaluateCondition(cond, { im_ideen_status: 'nein' })).toBe(false);
    expect(evaluateCondition(cond, {})).toBe(false);
  });

  it('includes auf Array-Feld', () => {
    const cond = { field: 'im_funnel_stufen', includes: 'lower' };
    expect(evaluateCondition(cond, { im_funnel_stufen: ['upper', 'lower'] })).toBe(true);
    expect(evaluateCondition(cond, { im_funnel_stufen: ['upper'] })).toBe(false);
    expect(evaluateCondition(cond, { im_funnel_stufen: 'lower' })).toBe(false);
    expect(evaluateCondition(cond, {})).toBe(false);
  });

  it('includesAny auf Array-Feld', () => {
    const cond = { field: 'im_production_setup', includesAny: ['vor_ort', 'event'] };
    expect(evaluateCondition(cond, { im_production_setup: ['alleine', 'event'] })).toBe(true);
    expect(evaluateCondition(cond, { im_production_setup: ['vor_ort'] })).toBe(true);
    expect(evaluateCondition(cond, { im_production_setup: ['alleine'] })).toBe(false);
  });
});
