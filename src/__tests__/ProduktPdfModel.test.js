import { describe, it, expect } from 'vitest';
import {
  buildProduktPdfModel,
  splitLines,
  sanitizeProduktFilename,
} from '../modules/produkt/ProduktPdfModel.js';

const NOW = new Date('2026-10-09T10:00:00');

function titles(model) {
  return model.sections.map(s => s.title);
}

describe('splitLines', () => {
  it('trennt pro Zeile und entfernt Aufzaehlungszeichen und Leerzeilen', () => {
    expect(splitLines('- eins\n• zwei\r\n\n * drei  ')).toEqual(['eins', 'zwei', 'drei']);
  });

  it('liefert [] bei leer oder keinem String', () => {
    expect(splitLines('  ')).toEqual([]);
    expect(splitLines(null)).toEqual([]);
  });
});

describe('sanitizeProduktFilename', () => {
  it('entfernt verbotene Zeichen und haengt .pdf an', () => {
    expect(sanitizeProduktFilename('Clear/Case: "Pro"')).toBe('ClearCase Pro.pdf');
    expect(sanitizeProduktFilename('')).toBe('Produkt.pdf');
  });
});

describe('buildProduktPdfModel', () => {
  it('laesst leere Felder und leere Abschnitte weg', () => {
    const model = buildProduktPdfModel({ name: 'Clear Case', kurzbeschreibung: '   ' }, { now: NOW });
    expect(model.title).toBe('Clear Case');
    expect(model.sections).toEqual([]);
    expect(model.dateiname).toBe('Clear Case.pdf');
  });

  it('baut Untertitel und Meta aus Unternehmen, Marken, URL und Datum', () => {
    const model = buildProduktPdfModel({
      name: 'Clear Case',
      url: 'https://shop.de/clear',
      unternehmen: { firmenname: 'Glow GmbH' },
      marken: [{ markenname: 'Glow' }, { markenname: 'Glow Pro' }],
    }, { now: NOW });
    expect(model.subtitle).toBe('Glow GmbH · Glow, Glow Pro');
    expect(model.meta).toBe('Produktseite: https://shop.de/clear\nStand 09.10.2026');
  });

  it('nimmt im Lockup die Marke bei genau einer, sonst das Unternehmen', () => {
    const base = { name: 'X', unternehmen: { firmenname: 'Glow GmbH', logo_url: 'u.png' } };
    const eine = buildProduktPdfModel({ ...base, marken: [{ markenname: 'Glow', logo_url: 'm.png' }] }, { now: NOW });
    expect(eine.customerName).toBe('Glow');
    expect(eine.customerLogoUrl).toBe('m.png');

    const mehrere = buildProduktPdfModel({
      ...base,
      marken: [{ markenname: 'A', logo_url: 'a.png' }, { markenname: 'B', logo_url: 'b.png' }],
    }, { now: NOW });
    expect(mehrere.customerName).toBe('Glow GmbH');
    expect(mehrere.customerLogoUrl).toBe('u.png');
  });

  it('macht aus USP und Claims Listen, aus Loesung einen Spec-Block', () => {
    const model = buildProduktPdfModel({
      name: 'X',
      usp: '- robust\n- leicht',
      loesung: 'Schuetzt das Handy',
      erlaubte_claims: 'stossfest',
      verbotene_claims: 'unzerstoerbar',
    }, { now: NOW });
    const nutzen = model.sections.find(s => s.title === 'Warum kauft man es?');
    expect(nutzen.blocks).toEqual([
      { type: 'list', label: 'USP', items: ['robust', 'leicht'] },
      { type: 'spec', label: 'Lösung', text: 'Schuetzt das Handy' },
    ]);
    const recht = model.sections.find(s => s.title === 'Rechtliches und Compliance');
    expect(recht.blocks.map(b => b.label)).toEqual(['Erlaubte Claims', 'Verbotene Claims']);
  });

  it('laesst geloeschte und namenlose Use Cases weg', () => {
    const model = buildProduktPdfModel({
      name: 'X',
      useCases: [
        { name: 'Morgens', beschreibung: 'Vor der Arbeit' },
        { name: 'Weg', beschreibung: 'x', deleted: true },
        { name: '  ', beschreibung: 'ohne Namen' },
        { name: 'Nur Name', beschreibung: '' },
      ],
    }, { now: NOW });
    const section = model.sections.find(s => s.title === 'Einsatzsituationen');
    expect(section.blocks.map(b => b.label)).toEqual(['Morgens', 'Nur Name']);
  });

  it('formatiert Preis als Spanne, Einzelpreis oder bis-Preis', () => {
    const preis = (extra) => buildProduktPdfModel({ name: 'X', ...extra }, { now: NOW })
      .sections.find(s => s.title === 'Preis')?.blocks;

    expect(preis({ preis_von: 10, preis_bis: 20 })[0].text).toMatch(/^10,00\s€ – 20,00\s€$/);
    expect(preis({ preis_von: '29.9', preis_bis: 29.9 })[0].text).toMatch(/^29,90\s€$/);
    expect(preis({ preis_bis: 15 })[0].text).toMatch(/^bis 15,00\s€$/);
    expect(preis({ preis_uvp: 49 }).map(b => b.label)).toEqual(['UVP / regulärer Preis']);
    expect(preis({})).toBeUndefined();
  });

  it('baut Varianten als Tabelle mit Bild, Name, Preis und Merkmal', () => {
    const model = buildProduktPdfModel({
      name: 'X',
      varianten: [
        { name: 'Sand', farbe: 'Beige', modell_kompatibilitaet: 'iPhone 15', preis: 19.9, uvp: 24.9, merkmal: 'MagSafe', bildUrl: 'sand.jpg' },
        { name: 'Nacht', bildUrl: null },
        { name: '', farbe: 'ohne Namen' },
      ],
    }, { now: NOW });
    const table = model.sections.find(s => s.title === 'Varianten').blocks[0];

    expect(table.type).toBe('table');
    expect(table.columns.map(c => c.label)).toEqual(['Bild', 'Variante', 'Preis', 'Merkmal']);
    expect(table.columns.reduce((sum, c) => sum + c.w, 0)).toBe(182);
    expect(table.rows).toHaveLength(2);

    const [bild, name, preis, merkmal] = table.rows[0];
    expect(bild.image.url).toBe('sand.jpg');
    expect(name.lines.map(l => l.text)).toEqual(['Sand', 'Farbe: Beige', 'Modell: iPhone 15']);
    expect(name.lines[0].bold).toBe(true);
    expect(preis.lines[0].text).toMatch(/^Preis 19,90\s€$/);
    expect(preis.lines[1].text).toMatch(/^UVP 24,90\s€$/);
    expect(merkmal.lines[0].text).toBe('MagSafe');

    // Variante ohne Bild bleibt in der Bildspalte leer, bleibt aber zuordenbar
    expect(table.rows[1][0]).toEqual({ lines: [] });
    expect(table.rows[1][1].lines[0].text).toBe('Nacht');
  });

  it('blendet die Bildspalte der Varianten aus, wenn keine ein Bild hat', () => {
    const model = buildProduktPdfModel({ name: 'X', varianten: [{ name: 'Sand' }] }, { now: NOW });
    const table = model.sections.find(s => s.title === 'Varianten').blocks[0];
    expect(table.columns.map(c => c.label)).toEqual(['Variante', 'Preis', 'Merkmal']);
    expect(table.columns.reduce((sum, c) => sum + c.w, 0)).toBe(182);
    expect(table.rows[0]).toHaveLength(3);
  });

  it('baut die Produktbilder als Tabelle mit Namen und Hauptbild-Hinweis', () => {
    const model = buildProduktPdfModel({
      name: 'X',
      bilder: [
        { url: 'a.jpg', name: 'Produktbild 1', primary: false },
        { url: 'b.jpg', name: '', primary: true },
        { url: '' },
      ],
    }, { now: NOW });
    const table = model.sections.find(s => s.title === 'Produktbilder').blocks[0];

    expect(table.columns.map(c => c.label)).toEqual(['Bild', 'Bezeichnung']);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0][0].image.url).toBe('a.jpg');
    expect(table.rows[0][1].lines.map(l => l.text)).toEqual(['Produktbild 1']);
    expect(table.rows[1][1].lines.map(l => l.text)).toEqual(['Produktbild 2', 'Hauptbild']);
  });

  it('haelt die Reihenfolge der Abschnitte wie im Worksheet', () => {
    const model = buildProduktPdfModel({
      name: 'X',
      kurzbeschreibung: 'k',
      usp: 'u',
      useCases: [{ name: 'a', beschreibung: 'b' }],
      preis_von: 1,
      bilder: [{ url: 'a.jpg' }],
      varianten: [{ name: 'v' }],
      inhaltsstoffe: 'i',
    }, { now: NOW });
    expect(titles(model)).toEqual([
      'Beschreibung',
      'Warum kauft man es?',
      'Einsatzsituationen',
      'Preis',
      'Produktbilder',
      'Varianten',
      'Rechtliches und Compliance',
    ]);
  });
});
