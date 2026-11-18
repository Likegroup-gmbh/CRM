// BewerbungBriefing.test.js
// Öffentliche Bewerbungsseite: nur der Inhalt des Creator-Briefing-PDFs plus Produkte,
// keine Altfelder, expliziter Select ohne interne Spalten.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { BEWERBUNG_BRIEFING_SPALTEN, briefingAbschnitte } = require('../../netlify/functions/_shared/bewerbung-briefing.js');

const ROW = {
  aktivierung_name: 'Sommer-Launch',
  nutzung_paid_media: true,
  nutzung_creator_kanal: true,
  plattformen: ['instagram', 'tiktok'],
  plattformen_weitere: 'Snapchat',
  seitenverhaeltnisse: ['9:16'],
  videolaenge_von: 30,
  videolaenge_bis: null,
  content_deadline: '2026-12-01',
  content_deadline_bis: '2026-12-05',
  go_live: '2026-12-10',
  kernbotschaft: 'Spart Zeit',
  aufgabe: 'Zeig das Produkt',
  vorgabe_donts: 'Keine Konkurrenz',
  umsetzungsideen_eintraege: [{ text: 'Unboxing', verbindlich: true }, { text: 'Morgenroutine', verbindlich: false }],
  cta: 'Link in Bio',
  tkp: 25,
  verhandlungshinweis: 'Budget max 500',
  voraussetzungen: ['kueche']
};

describe('Bewerbung: Briefing-Abschnitte', () => {
  it('in Reihenfolge und Wortlaut des PDFs, mit Produkten', () => {
    const abschnitte = briefingAbschnitte(ROW, [{ name: 'Clear Case', url: 'https://shop.de/clear' }, { url: 'https://shop.de/b' }]);
    expect(abschnitte).toEqual([
      { label: 'Wie wird der Content verwendet?', text: 'Paid Ads, Influencer-Marketing' },
      { label: 'Plattformen', text: 'Instagram, TikTok, Snapchat' },
      { label: 'Seitenverhältnis', text: '9:16 (Hochformat)' },
      { label: 'Videolänge', text: 'mindestens 30 Sek.' },
      { label: 'Content-Abgabe', text: '01.12.2026 bis 05.12.2026' },
      { label: 'Veröffentlichung', text: '10.12.2026' },
      { label: 'Produkte', text: 'Clear Case (https://shop.de/clear)\nhttps://shop.de/b' },
      { label: 'Kernbotschaft', text: 'Spart Zeit' },
      { label: 'Deine Aufgabe', text: 'Zeig das Produkt' },
      { label: "Don'ts", text: 'Keine Konkurrenz' },
      { label: 'Umsetzungsideen & Referenzen (optional)', text: 'Verbindlich: Unboxing\nInspiration: Morgenroutine' }
    ]);
  });

  it('zeigt keine Altfelder und keine internen Werte', () => {
    const text = JSON.stringify(briefingAbschnitte(ROW));
    for (const intern of ['Link in Bio', 'Budget max 500', 'kueche', '25']) expect(text).not.toContain(intern);
  });

  it('leeres Briefing: keine Abschnitte', () => {
    expect(briefingAbschnitte(null)).toEqual([]);
    expect(briefingAbschnitte({ aktivierung_name: 'Nur Titel' })).toEqual([]);
  });

  it('selektiert genau die PDF-Spalten, nie interne', () => {
    const spalten = BEWERBUNG_BRIEFING_SPALTEN.split(', ');
    expect(spalten).toEqual(expect.arrayContaining(['aktivierung_name', 'videolaenge_von', 'videolaenge_bis', 'umsetzungsideen_eintraege', 'go_live_bis']));
    for (const intern of ['produkte', 'videolaenge', 'tkp', 'verhandlungshinweis', 'cta', 'persona_ids', '*']) {
      expect(spalten).not.toContain(intern);
    }
  });
});
