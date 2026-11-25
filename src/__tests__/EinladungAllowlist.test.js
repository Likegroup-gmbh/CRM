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
import { inhaltsFelder } from '../modules/briefing/create/fieldConfig.js';

const ID = '11111111-1111-1111-1111-111111111111';

describe('Allowlist der Edge Function', () => {
  it('lässt keine internen Briefing-Felder zu', () => {
    for (const intern of [...BRIEFING_INTERN, 'tkp', 'verhandlungshinweis', 'persona_ids']) {
      expect(BRIEFING_FELDER).not.toContain(intern);
    }
  });

  it('kennt jedes erlaubte Briefing-Feld aus der Feld-Config', () => {
    const bekannt = new Set(inhaltsFelder().map((f) => f.name));
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

  it('Produktliste: nur Texte und gültige Links, nie eine Produkt-ID', () => {
    const { formData, dateien } = bereinigeBriefing(
      {
        produkte: [
          { produkt_id: 'fremd', name: 'Serum', url: 'javascript:alert(1)', usp: 'Zieht schnell ein', unternehmen_id: 'x' },
          { url: 'https://shop.example/creme' },
          { produkt_id: 'nur-id' }
        ]
      },
      { einladungId: ID, bereich: 'owned_social' }
    );
    expect(formData.produkte).toEqual([
      { name: 'Serum', usp: 'Zieht schnell ein' },
      { url: 'https://shop.example/creme' }
    ]);
    expect(dateien).toEqual([]);
  });

  it('Umsetzungsideen: Text plus verbindlich als echtes Boolean', () => {
    const { formData } = bereinigeBriefing(
      { umsetzungsideen_eintraege: [{ text: ' Unboxing ', verbindlich: 'true' }, { text: 'Link', verbindlich: true }, 'Freitext', { text: '' }] },
      { einladungId: ID, bereich: 'owned_social' }
    );
    expect(formData.umsetzungsideen_eintraege).toEqual([
      { text: 'Unboxing', verbindlich: false },
      { text: 'Link', verbindlich: true },
      { text: 'Freitext', verbindlich: false }
    ]);
  });

  it('Videolänge: Spanne oder Mindestlänge, sonst nichts', () => {
    const laenge = (videolaenge) => bereinigeBriefing({ videolaenge }, { einladungId: ID, bereich: 'owned_social' }).formData.videolaenge;
    expect(laenge({ von: 15, bis: 30 })).toEqual({ von: 15, bis: 30 });
    expect(laenge({ von: 30, bis: null })).toEqual({ von: 30, bis: null });
    expect(laenge({ von: 30, bis: 10 })).toBeUndefined();
    expect(laenge({ von: 0, bis: 10 })).toBeUndefined();
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
    expect(pruefeEinreichung('briefing', { bereich: 'paid_creator_ads', kernbotschaft: 'Spart Zeit' })).toBeNull();
  });
});
