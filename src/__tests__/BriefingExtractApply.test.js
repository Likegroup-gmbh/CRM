// BriefingExtractApply.test.js
// Likys Extrakt und Chat-Patches binden an die Widgets des Creator-Briefings.
// Guard gegen die IRONCLAD-Regression: { value, kind }-Wrapper landeten als
// "[object Object]" in Textfeldern, Listen kamen als Text.

import { describe, it, expect } from 'vitest';
import { BriefingExtractApply, normalizeValue } from '../modules/briefing/create/BriefingExtractApply.js';
import { formatExtractResult } from '../modules/briefing/create/BriefingLikyPanel.js';
import { inhaltsFelder, feldNachName } from '../modules/briefing/create/fieldConfig.js';

const SPEC = inhaltsFelder();
const feld = (name) => feldNachName(name);

function createApply(formData = {}) {
  return new BriefingExtractApply({ formData, render() {} });
}

const IRONCLAD_EXTRACT = {
  aktivierung_name: { value: 'IRONCLAD FORCE-FIT Leggings — Creator-Kampagne', kind: 'fact', from: 'Seite 1' },
  plattformen: { value: ['Instagram', 'tiktok', 'LinkedIn'], kind: 'fact' },
  videolaenge: { value: '15–30 Sek.', kind: 'guess' },
  go_live: { value: '17.11.2026', kind: 'fact' },
  nutzung_paid_media: { value: 'true', kind: 'fact' },
  aufgabe: { value: ['Creator testen die Leggings', 'im Training.'], kind: 'fact' },
  produkte: { value: [{ name: 'FORCE-FIT Leggings', url: 'https://ironclad.example/leggings', usp: 'Blickdicht' }, { usp: 'ohne Name' }], kind: 'fact' },
  umsetzungsideen_eintraege: { value: [{ text: 'Squat-Test', verbindlich: true }, 'https://www.tiktok.com/@x/video/1'], kind: 'fact' },
  unternehmen_id: { value: 'FORGEWORKS AG', kind: 'fact' },
  persona_ids: { value: ['x'], kind: 'fact' }
};

const IRONCLAD_CHAT = {
  aktivierung_name: { kind: 'fact', value: 'IRONCLAD FORCE-FIT Leggings Launch Kampagne' },
  aufgabe: { kind: 'fact', value: 'Creator testen die Leggings im Training.' },
  vorgabe_donts: { kind: 'fact', value: { text: 'Keine Konkurrenzmarken' } }
};

describe('normalizeValue', () => {
  it('Text: Wrapper und Arrays werden String, nie "[object Object]"', () => {
    expect(normalizeValue(feld('aufgabe'), { value: ['A', 'B'], kind: 'fact' })).toBe('A\nB');
    expect(normalizeValue(feld('kernbotschaft'), { value: { label: 'Spart Zeit' } })).toBe('Spart Zeit');
    expect(normalizeValue(feld('kernbotschaft'), '   ')).toBeNull();
  });

  it('Datum: deutsches Datum wird ISO, Unlesbares fällt weg', () => {
    expect(normalizeValue(feld('go_live'), '7.3.2026')).toBe('2026-03-07');
    expect(normalizeValue(feld('go_live'), '2026-03-07')).toBe('2026-03-07');
    expect(normalizeValue(feld('go_live'), 'KW 46')).toBeNull();
  });

  it('Plattformen und Seitenverhältnis: nur bekannte Optionen, Label oder Wert', () => {
    expect(normalizeValue(feld('plattformen'), ['Instagram', 'tiktok', 'LinkedIn', 'TikTok'])).toEqual(['instagram', 'tiktok']);
    expect(normalizeValue(feld('seitenverhaeltnisse'), '9:16')).toEqual(['9:16']);
    expect(normalizeValue(feld('plattformen'), ['Snapchat'])).toBeNull();
  });

  it('Häkchen: true und "true"', () => {
    expect(normalizeValue(feld('nutzung_paid_media'), 'true')).toBe(true);
    expect(normalizeValue(feld('nutzung_paid_media'), 'nein')).toBe(false);
  });

  it('Videolänge: Spanne, Mindestlänge als Text oder Objekt', () => {
    expect(normalizeValue(feld('videolaenge'), '15–30 Sek.')).toEqual({ von: 15, bis: 30 });
    expect(normalizeValue(feld('videolaenge'), 'mind. 30 Sekunden')).toEqual({ von: 30, bis: null });
    expect(normalizeValue(feld('videolaenge'), { minimum: 20 })).toEqual({ von: 20, bis: null });
    expect(normalizeValue(feld('videolaenge'), { von: 10, bis: 25 })).toEqual({ von: 10, bis: 25 });
  });

  it('Ideen: Objekte behalten verbindlich, Text wird gesplittet und ist Inspiration', () => {
    const ideen = feld('umsetzungsideen_eintraege');
    expect(normalizeValue(ideen, [{ text: 'A', verbindlich: 'true' }, { value: 'B' }])).toEqual([
      { text: 'A', verbindlich: true },
      { text: 'B', verbindlich: false }
    ]);
    expect(normalizeValue(ideen, 'UGC-Ideen:\n• Idee A\n• Idee B')).toEqual([
      { text: 'Idee A', verbindlich: false },
      { text: 'Idee B', verbindlich: false }
    ]);
  });

  it('Produkte: nur mit Name oder Link, nur die Briefing-Felder', () => {
    expect(normalizeValue(feld('produkte'), [
      { name: 'Serum', preis: 20, usp: ['Dünn', 'Leicht'] },
      { usp: 'ohne Name' },
      'nur Text'
    ])).toEqual([{ name: 'Serum', url: '', kurzbeschreibung: '', usp: 'Dünn\nLeicht', loesung: '' }]);
  });

  it('entitySelect: Namen werden verworfen, UUIDs bleiben', () => {
    const field = { name: 'unternehmen_id', type: 'entitySelect' };
    expect(normalizeValue(field, 'FORGEWORKS AG')).toBeNull();
    expect(normalizeValue(field, 'f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479');
  });
});

describe('BriefingExtractApply.apply (Extract)', () => {
  it('übernimmt den IRONCLAD-Extract in Widget-Shapes, Fremdfelder fallen weg', () => {
    const apply = createApply();
    const { applied } = apply.apply(IRONCLAD_EXTRACT, SPEC);
    const data = apply.briefing.formData;

    expect(data).toMatchObject({
      aktivierung_name: 'IRONCLAD FORCE-FIT Leggings — Creator-Kampagne',
      plattformen: ['instagram', 'tiktok'],
      videolaenge: { von: 15, bis: 30 },
      videolaenge_modus: null,
      go_live: '2026-11-17',
      nutzung_paid_media: true,
      aufgabe: 'Creator testen die Leggings\nim Training.'
    });
    expect(data.produkte).toEqual([
      { name: 'FORCE-FIT Leggings', url: 'https://ironclad.example/leggings', kurzbeschreibung: '', usp: 'Blickdicht', loesung: '' }
    ]);
    expect(data.umsetzungsideen_eintraege).toEqual([
      { text: 'Squat-Test', verbindlich: true },
      { text: 'https://www.tiktok.com/@x/video/1', verbindlich: false }
    ]);
    expect(data).not.toHaveProperty('unternehmen_id');
    expect(data).not.toHaveProperty('persona_ids');
    expect(applied).toHaveLength(8);
    expect(apply.aiFill.get('videolaenge')).toEqual({ kind: 'guess', from: null });
    expect(apply.aiFill.get('aktivierung_name')).toEqual({ kind: 'fact', from: 'Seite 1' });
  });

  it('vom Nutzer gefüllte Felder bleiben stehen', () => {
    const apply = createApply({ aufgabe: 'Eigene Aufgabe', plattformen: ['youtube'], videolaenge: { von: 30, bis: null } });
    const { skipped } = apply.apply(IRONCLAD_EXTRACT, SPEC);
    expect(apply.briefing.formData.aufgabe).toBe('Eigene Aufgabe');
    expect(apply.briefing.formData.plattformen).toEqual(['youtube']);
    expect(apply.briefing.formData.videolaenge).toEqual({ von: 30, bis: null });
    expect(skipped).toEqual(['Plattformen', 'Videolänge', 'Deine Aufgabe']);
  });

  it('Produkte werden angehängt, Dubletten und leere Zeilen nicht', () => {
    const apply = createApply({ produkte: [{ produkt_id: 'p1', name: 'Force-Fit Leggings' }, { name: '', url: '' }] });
    apply.apply({ produkte: { value: [{ name: 'FORCE-FIT Leggings' }, { name: 'Sport-BH' }] } }, SPEC);
    expect(apply.briefing.formData.produkte.map(p => p.name)).toEqual(['Force-Fit Leggings', 'Sport-BH']);

    const { applied } = apply.apply({ produkte: [{ name: 'sport-bh' }] }, SPEC);
    expect(applied).toEqual([]);
  });
});

describe('BriefingExtractApply.applyPatches (Chat)', () => {
  it('schreibt den Feldwert, nicht den { value, kind }-Wrapper', () => {
    const apply = createApply();
    const { applied } = apply.applyPatches(IRONCLAD_CHAT, SPEC);
    const data = apply.briefing.formData;

    expect(data.aktivierung_name).toBe('IRONCLAD FORCE-FIT Leggings Launch Kampagne');
    expect(data.vorgabe_donts).toBe('Keine Konkurrenzmarken');
    expect(applied).toHaveLength(3);
    expect(apply.aiFill.get('aufgabe').from).toBe('Chat');
    for (const value of Object.values(data)) {
      expect(String(typeof value === 'object' ? JSON.stringify(value) : value)).not.toContain('[object Object]');
    }
  });

  it('darf vorhandene Werte überschreiben', () => {
    const apply = createApply({ aufgabe: 'Alt', aktivierung_name: 'Projekt A' });
    apply.applyPatches(IRONCLAD_CHAT, SPEC);
    expect(apply.briefing.formData.aufgabe).toBe('Creator testen die Leggings im Training.');
    expect(apply.briefing.formData.aktivierung_name).toBe('IRONCLAD FORCE-FIT Leggings Launch Kampagne');
  });
});

describe('formatExtractResult', () => {
  it('nennt gefüllte, übersprungene und offene Felder', () => {
    const text = formatExtractResult({ missing: ['Kernbotschaft'] }, ['Titel', 'Plattformen'], ['Aufgabe']);
    expect(text).toContain('2 Felder gefüllt');
    expect(text).toContain('1 Felder waren schon voll');
    expect(text).toContain('Noch offen: Kernbotschaft');
  });

  it('alles schon voll', () => {
    expect(formatExtractResult({}, [], ['Aufgabe'])).toBe('Alles war schon ausgefüllt - ich habe nichts angerührt.');
  });

  it('warnt bei abweichendem Unternehmen', () => {
    const text = formatExtractResult({ unternehmen_hint: { name: 'FORGEWORKS AG', passt: false } }, [], []);
    expect(text).toContain('FORGEWORKS AG');
    expect(text).toContain('gewählte Unternehmen bleibt');
  });
});
