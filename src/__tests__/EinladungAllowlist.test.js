// EinladungAllowlist.test.js
// Allowlist der Edge Function (ADR 0055): Formular, Bereinigung, Pflichtfelder.

import { describe, it, expect } from 'vitest';
import {
  BRIEFING_FELDER,
  PRODUKT_FELDER,
  bereinigeBriefing,
  bereinigeProdukt,
  pruefeEinreichung
} from '../../supabase/functions/einladung/felder.ts';
import {
  BRIEFING_INTERN,
  kundenFeldNamen,
  kundenSteps,
  PRODUKT_FELDNAMEN
} from '../modules/einladung/einladungFelder.js';
import { getAllFields } from '../modules/briefing/create/fieldConfig.js';

const ID = '11111111-1111-1111-1111-111111111111';

describe('Allowlist der Edge Function', () => {
  it('lässt keine internen Briefing-Felder zu', () => {
    for (const intern of [...BRIEFING_INTERN, 'tkp', 'verhandlungshinweis']) {
      expect(BRIEFING_FELDER).not.toContain(intern);
    }
  });

  it('kennt jedes erlaubte Briefing-Feld aus der Feld-Config', () => {
    const bekannt = new Set(getAllFields().map((f) => f.name));
    const unbekannt = BRIEFING_FELDER.filter((name) => !bekannt.has(name));
    expect(unbekannt).toEqual([]);
  });

  it('deckt jedes Feld des Kundenformulars ab', () => {
    const erlaubt = new Set(BRIEFING_FELDER);
    const fehlen = [...kundenFeldNamen()].filter((name) => !erlaubt.has(name));
    expect(fehlen).toEqual([]);
  });

  it('zeigt dem Kunden keine internen Felder', () => {
    const namen = kundenSteps().flatMap((s) => s.sections.flatMap((sec) => sec.fields.map((f) => f.name)));
    for (const intern of BRIEFING_INTERN) expect(namen).not.toContain(intern);
  });

  it('verwirft interne und fremde Felder beim Bereinigen', () => {
    const { formData } = bereinigeBriefing(
      { beschreibung: 'Test', tkp: 12, verhandlungshinweis: 'x', unternehmen_id: 'a', marke_id: 'b', bereich: 'evil', foo: 1 },
      { einladungId: ID, bereich: 'paid_creator_ads' }
    );
    expect(formData).toEqual({ beschreibung: 'Test', bereich: 'paid_creator_ads' });
  });

  it('akzeptiert Referenz-Uploads nur aus der eigenen Einladung', () => {
    const { formData, dateien } = bereinigeBriefing(
      {
        referenzen: [
          { typ: 'upload', value: `${ID}/ref/a.pdf`, label: 'a.pdf' },
          { typ: 'upload', value: 'andere-einladung/ref/b.pdf', label: 'b.pdf' },
          { typ: 'upload', value: `${ID}/../x.pdf`, label: 'x.pdf' }
        ]
      },
      { einladungId: ID, bereich: 'owned_social' }
    );
    expect(formData.referenzen).toEqual([{ typ: 'upload', value: `${ID}/ref/a.pdf`, label: 'a.pdf' }]);
    expect(dateien).toHaveLength(1);
  });

  it('akzeptiert als Referenz-Link nur http und https', () => {
    const { formData } = bereinigeBriefing(
      { referenzen: [{ typ: 'url', value: 'javascript:alert(1)' }, { typ: 'url', value: 'https://example.com/ref' }] },
      { einladungId: ID, bereich: 'owned_social' }
    );
    expect(formData.referenzen).toEqual([{ typ: 'url', value: 'https://example.com/ref' }]);
  });

  it('Produkt: nur erlaubte Felder, Bilder nur aus der eigenen Einladung', () => {
    const { formData } = bereinigeProdukt(
      {
        name: 'Serum', url: 'https://shop.example/serum', unternehmen_id: 'x', marke_ids: ['y'], tkp: 5,
        bilder: [{ pfad: `${ID}/bild/1.png`, name: '1.png' }, { pfad: 'fremd/2.png', name: '2.png' }]
      },
      { einladungId: ID }
    );
    expect(Object.keys(formData).sort()).toEqual(['bilder', 'name', 'url']);
    expect(formData.bilder).toHaveLength(1);
    expect(PRODUKT_FELDNAMEN.every((n) => PRODUKT_FELDER.includes(n) || n === 'einsatzsituationen')).toBe(true);
  });

  it('prüft Pflichtangaben', () => {
    expect(pruefeEinreichung('produkt', { name: 'S', url: 'https://x.de' })).toBeTruthy();
    expect(pruefeEinreichung('produkt', { name: 'Serum', url: 'kein-link' })).toBeTruthy();
    expect(pruefeEinreichung('produkt', { name: 'Serum', url: 'https://x.de' })).toBeNull();
    expect(pruefeEinreichung('briefing', { bereich: 'paid_creator_ads' })).toBeTruthy();
    expect(pruefeEinreichung('briefing', { bereich: 'paid_creator_ads', cta: 'Jetzt kaufen' })).toBeNull();
  });
});
