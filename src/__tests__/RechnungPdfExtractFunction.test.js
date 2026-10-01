// RechnungPdfExtractFunction.test.js
// Reine Function-Logik der Rechnungs-PDF-Auslesung (ADR 0016): Prompt-Auftrag,
// Feld-Normalisierung (Whitelist, deutsche Zahlen/Daten, keine negativen
// Betraege) und Creator-Scoring (Mail > voller Name > Teile > Handle).

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildExtractPrompt,
  normalizeExtractFields,
  scoreCreatorKandidaten,
  parseDeutscheZahl,
  parseDatum
} = require('../../netlify/functions/rechnung-pdf-background.js');

describe('parseDeutscheZahl', () => {
  it('versteht deutsche und internationale Formate', () => {
    expect(parseDeutscheZahl('1.234,56')).toBe(1234.56);
    expect(parseDeutscheZahl('1234.56')).toBe(1234.56);
    expect(parseDeutscheZahl('1 234,56 €')).toBe(1234.56);
    expect(parseDeutscheZahl('800')).toBe(800);
    expect(parseDeutscheZahl(800.5)).toBe(800.5);
    expect(parseDeutscheZahl('49,00')).toBe(49);
  });

  it('lehnt Unlesbares ab', () => {
    expect(parseDeutscheZahl('abc')).toBe(null);
    expect(parseDeutscheZahl('')).toBe(null);
    expect(parseDeutscheZahl(null)).toBe(null);
    expect(parseDeutscheZahl(NaN)).toBe(null);
  });
});

describe('parseDatum', () => {
  it('normalisiert ISO und deutsches Format', () => {
    expect(parseDatum('2026-09-30')).toBe('2026-09-30');
    expect(parseDatum('30.9.2026')).toBe('2026-09-30');
    expect(parseDatum('01.02.2026')).toBe('2026-02-01');
  });

  it('lehnt Unlesbares ab', () => {
    expect(parseDatum('naechste Woche')).toBe(null);
    expect(parseDatum('')).toBe(null);
    expect(parseDatum(123)).toBe(null);
  });
});

describe('normalizeExtractFields', () => {
  it('laesst nur erlaubte Felder durch', () => {
    const out = normalizeExtractFields({
      nettobetrag: { value: '1.000,00', kind: 'fact', from: 'Positionstabelle' },
      kooperation_id: { value: 'irgendeine-id' },
      bruttobetrag: { value: 1190 }
    });
    expect(Object.keys(out)).toEqual(['nettobetrag']);
    expect(out.nettobetrag.value).toBe(1000);
    expect(out.nettobetrag.kind).toBe('fact');
  });

  it('verwirft negative Betraege (Storno ist kein Scope)', () => {
    const out = normalizeExtractFields({
      nettobetrag: { value: -500 },
      ksk_betrag: { value: '-24,50' }
    });
    expect(out.nettobetrag).toBeUndefined();
    expect(out.ksk_betrag).toBeUndefined();
  });

  it('normalisiert Daten und verwirft ungueltige', () => {
    const out = normalizeExtractFields({
      gestellt_am: { value: '30.09.2026' },
      zahlungsziel: { value: 'bald' }
    });
    expect(out.gestellt_am.value).toBe('2026-09-30');
    expect(out.zahlungsziel).toBeUndefined();
  });

  it('zwingt ust_ausgewiesen auf Boolean und Prozente in 0..100', () => {
    const out = normalizeExtractFields({
      ust_ausgewiesen: { value: 'ja' },
      ust_prozent: { value: 19 },
      skonto_prozent: { value: 140 }
    });
    expect(out.ust_ausgewiesen).toBeUndefined();
    expect(out.ust_prozent.value).toBe(19);
    expect(out.skonto_prozent).toBeUndefined();
  });

  it('kind ohne guess wird fact, from wird gekuerzt', () => {
    const out = normalizeExtractFields({
      rechnungsnummer: { value: 'RE-2026-042', kind: 'sonstiges', from: 'x'.repeat(500) }
    });
    expect(out.rechnungsnummer.kind).toBe('fact');
    expect(out.rechnungsnummer.from.length).toBe(200);
  });

  it('leere Eingabe ergibt leeres Ergebnis', () => {
    expect(normalizeExtractFields(null)).toEqual({});
    expect(normalizeExtractFields({ nettobetrag: null })).toEqual({});
  });
});

describe('scoreCreatorKandidaten', () => {
  const kandidaten = [
    { id: 'a', vorname: 'Max', nachname: 'Mustermann', mail: 'max@example.com', instagram: '@maxm' },
    { id: 'b', vorname: 'Max', nachname: 'Müller', mail: 'mueller@example.com', instagram: '@maxmueller' },
    { id: 'c', vorname: 'Anna', nachname: 'Schmidt', mail: 'anna@example.com', instagram: '@anna' }
  ];

  it('Mail-Treffer schlaegt alles', () => {
    const out = scoreCreatorKandidaten(
      { name: 'Max Mustermann', email: 'mueller@example.com' },
      kandidaten
    );
    expect(out[0].id).toBe('b');
  });

  it('voller Name schlaegt Namensteile', () => {
    const out = scoreCreatorKandidaten({ name: 'Max Mustermann' }, kandidaten);
    expect(out[0].id).toBe('a');
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  it('Instagram-Handle findet den Creator', () => {
    const out = scoreCreatorKandidaten({ instagram: '@anna' }, kandidaten);
    expect(out[0].id).toBe('c');
  });

  it('filtert Kandidaten ohne Treffer und sortiert absteigend', () => {
    const out = scoreCreatorKandidaten({ name: 'Max' }, kandidaten);
    expect(out.every((k) => k.score > 0)).toBe(true);
    expect(out.map((k) => k.id)).not.toContain('c');
  });

  it('leerer Hint ergibt leere Liste', () => {
    expect(scoreCreatorKandidaten({}, kandidaten)).toEqual([]);
    expect(scoreCreatorKandidaten(null, kandidaten)).toEqual([]);
  });
});

describe('buildExtractPrompt', () => {
  it('beschreibt die Kernregeln der Auslesung', () => {
    const { stable, task } = buildExtractPrompt();
    expect(stable).toContain('rechnung_extract_abgeben');
    // KSK gehoert in ein eigenes Feld, nicht in den Nettobetrag
    expect(task).toContain('ksk_betrag');
    expect(task).toMatch(/OHNE eine separat ausgewiesene KSK-Zeile/);
    // Creator ist der Absender, nicht Lightbase
    expect(task).toContain('ABSENDER');
    // Kleinunternehmer-Regel
    expect(task).toContain('ust_ausgewiesen');
    expect(task).toContain('§19');
    // Nichts erfinden
    expect(task).toContain('Nichts erfinden');
  });
});
