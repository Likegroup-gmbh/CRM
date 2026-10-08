import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { baueLeerFeldPatch, istLeer } from '../modules/management/ManagementConnect.js';

const require = createRequire(import.meta.url);
const {
  namenTreffer,
  pruefeHomepage,
  normalizeHomepage,
  nameTokens
} = require('../../netlify/functions/_shared/agentur-resolver.js');
const { calculateCost, addCosts } = require('../../netlify/functions/_shared/claude-cost.js');
const { readWebSearch } = require('../../netlify/functions/_shared/anthropic.js');
const { getSpec } = require('../../netlify/functions/_shared/extract-specs.js');
const { normalizeFields } = require('../../netlify/functions/site-extract-utils/extract-core.js');
const { extractContactLinks } = require('../../netlify/functions/site-extract-utils/html-distill.js');

describe('namenTreffer', () => {
  it('ignoriert Rechtsform und Groß-/Kleinschreibung', () => {
    const r = namenTreffer('MUSTER Talents GmbH', 'Muster Talents Management UG (haftungsbeschränkt)', 'https://www.muster-talents.de');
    expect(r.passt).toBe(true);
    expect(r.treffer).toContain('muster');
  });

  it('erkennt den Namen auch nur über die Domain', () => {
    expect(namenTreffer('Pulse Creators', null, 'https://www.pulsecreators.de').passt).toBe(true);
  });

  it('lehnt eine fremde Firma ab', () => {
    const r = namenTreffer('Muster Talents GmbH', 'Beispiel Medien AG', 'https://beispiel-medien.de');
    expect(r.passt).toBe(false);
  });

  it('zählt Füllwörter wie "Talents" oder "Management" allein nicht als Treffer', () => {
    const r = namenTreffer('Muster Talents', 'Top Talents Management', 'https://toptalents.de');
    expect(r.passt).toBe(false);
  });

  it('löst Umlaute auf', () => {
    expect(nameTokens('Müller Künstleragentur GmbH')).toContain('muller');
  });

  it('gleicht auch reine Füllwort-Namen ab, statt nie zu treffen', () => {
    expect(namenTreffer('Talents GmbH', 'Talents GmbH', 'https://talents.de').passt).toBe(true);
  });
});

describe('pruefeHomepage (URL-Gate)', () => {
  const quellen = [
    { url: 'https://www.muster-talents.de/kontakt', title: 'Kontakt' },
    { url: 'https://www.instagram.com/muster_talents/', title: 'Instagram' }
  ];

  it('akzeptiert einen Host aus den Suchergebnissen und kürzt auf die Startseite', () => {
    expect(pruefeHomepage('https://muster-talents.de/team', quellen)).toEqual({
      ok: true,
      url: 'https://muster-talents.de',
      grund: null
    });
  });

  it('lehnt eine erfundene URL ab', () => {
    const r = pruefeHomepage('https://erfunden-agentur.de', quellen);
    expect(r.ok).toBe(false);
    expect(r.grund).toBe('nicht in Suchergebnissen');
  });

  it('lehnt Social-Hosts ab, auch wenn sie in den Ergebnissen standen', () => {
    const r = pruefeHomepage('https://www.instagram.com/muster_talents/', quellen);
    expect(r.ok).toBe(false);
    expect(r.grund).toBe('Social-/Portal-Host');
  });

  it('lehnt fehlende und kaputte Angaben ab', () => {
    expect(pruefeHomepage(null, quellen).grund).toBe('keine Homepage genannt');
    expect(pruefeHomepage('kein url', quellen).ok).toBe(false);
  });

  it('normalizeHomepage ergänzt https und entfernt Pfade', () => {
    expect(normalizeHomepage('muster-talents.de/impressum')).toBe('https://muster-talents.de');
    expect(normalizeHomepage('localhost')).toBeNull();
  });
});

describe('baueLeerFeldPatch', () => {
  const fields = {
    firmenname: { value: 'Muster Talents GmbH', kind: 'fact' },
    email: { value: 'info@muster.de', kind: 'fact' },
    telefonnummer: { value: '+49 30 123456', kind: 'fact' },
    stadt: { value: 'Berlin', kind: 'fact' },
    plz: { value: '10115', kind: 'fact' }
  };

  it('schreibt nur in leere Spalten, Whitespace zählt als leer', () => {
    const { patch, uebersprungen } = baueLeerFeldPatch(
      { email: 'alt@muster.de', telefonnummer: '   ', stadt: null, plz: '' },
      fields
    );
    expect(patch).toEqual({ telefonnummer: '+49 30 123456', stadt: 'Berlin', plz: '10115' });
    expect(uebersprungen).toEqual(['email']);
  });

  it('ignoriert Felder außerhalb der Weißliste (firmenname)', () => {
    const { patch } = baueLeerFeldPatch({}, fields);
    expect(patch).not.toHaveProperty('firmenname');
  });

  it('meldet nicht gefundene Felder', () => {
    const { nichtGefunden } = baueLeerFeldPatch({}, fields);
    expect(nichtGefunden).toEqual(expect.arrayContaining(['instagram', 'webseite', 'strasse', 'hausnummer', 'land']));
  });

  it('istLeer', () => {
    expect(istLeer(undefined)).toBe(true);
    expect(istLeer('  ')).toBe(true);
    expect(istLeer('x')).toBe(false);
  });
});

describe('calculateCost mit Websuche', () => {
  const usage = { input_tokens: 1000, output_tokens: 100, server_tool_use: { web_search_requests: 2 } };

  it('addiert 10 USD pro 1000 Suchen zu den Tokens', () => {
    const mitSuche = calculateCost('claude-haiku-4-5', usage);
    const ohneSuche = calculateCost('claude-haiku-4-5', { input_tokens: 1000, output_tokens: 100 });
    expect(mitSuche.usd - ohneSuche.usd).toBeCloseTo(0.02, 6);
    expect(mitSuche.searches).toBe(2);
    expect(ohneSuche.searches).toBeUndefined();
  });

  it('addCosts fasst zwei Kosten-Objekte zusammen und toleriert null', () => {
    const a = calculateCost('claude-haiku-4-5', { input_tokens: 1000, output_tokens: 0 });
    const b = calculateCost('claude-haiku-4-5', usage);
    const summe = addCosts(a, b);
    expect(summe.usd).toBeCloseTo(a.usd + b.usd, 6);
    expect(summe.tokens.input).toBe(2000);
    expect(addCosts(null, b)).toBe(b);
    expect(addCosts(a, null)).toBe(a);
  });
});

describe('readWebSearch', () => {
  it('liest Suchanfragen und Treffer aus den Content-Blöcken', () => {
    const { sources, searchQueries } = readWebSearch([
      { type: 'text', text: 'Ich suche' },
      { type: 'server_tool_use', name: 'web_search', input: { query: 'Muster Talents Agentur' } },
      {
        type: 'web_search_tool_result',
        content: [{ type: 'web_search_result', url: 'https://muster.de', title: 'Muster' }]
      },
      { type: 'web_search_tool_result', content: { type: 'web_search_tool_result_error', error_code: 'unavailable' } }
    ]);
    expect(searchQueries).toEqual(['Muster Talents Agentur']);
    expect(sources).toEqual([{ url: 'https://muster.de', title: 'Muster' }]);
  });

  it('liefert ohne Websuche leere Listen', () => {
    expect(readWebSearch(undefined)).toEqual({ sources: [], searchQueries: [] });
  });
});

describe('Spec management', () => {
  it('nutzt dieselben Feldnamen wie das Management-Formular', () => {
    const namen = getSpec('management').fields.map((f) => f.name);
    expect(namen).toEqual(expect.arrayContaining([
      'email', 'telefonnummer', 'webseite', 'instagram', 'strasse', 'hausnummer', 'plz', 'stadt', 'land'
    ]));
    expect(getSpec('management').resolveUrl).toBe(true);
  });

  it('unternehmen behält seine Adressfelder unverändert', () => {
    const namen = getSpec('unternehmen').fields.map((f) => f.name);
    expect(namen).toEqual([
      'firmenname',
      'rechnungsadresse_strasse',
      'rechnungsadresse_hausnummer',
      'rechnungsadresse_plz',
      'rechnungsadresse_stadt',
      'rechnungsadresse_land',
      'webseite',
      'invoice_email',
      'beschreibung'
    ]);
  });
});

describe('normalizeFields für Management', () => {
  const spec = getSpec('management');
  const eintrag = (wert) => ({ wert, quelle: 'Impressum' });

  it('bereinigt E-Mail, Telefon und Instagram', () => {
    const fields = normalizeFields({
      email: eintrag('mailto:info@muster.de'),
      telefonnummer: eintrag('+49 30 1234567'),
      instagram: eintrag('https://www.instagram.com/muster_talents/')
    }, spec);
    expect(fields.email.value).toBe('info@muster.de');
    expect(fields.telefonnummer.value).toBe('+49 30 1234567');
    expect(fields.instagram.value).toBe('@muster_talents');
    expect(fields.email.kind).toBe('fact');
  });

  it('verwirft ungültige Angaben', () => {
    const fields = normalizeFields({
      email: eintrag('keine mail'),
      telefonnummer: eintrag('123'),
      instagram: eintrag('das ist kein handle!')
    }, spec);
    expect(fields).toEqual({});
  });
});

describe('extractContactLinks', () => {
  it('liest mailto, tel und Instagram-Profile, aber keine Instagram-Posts', () => {
    const html = `
      <a href="mailto:info@muster.de?subject=Hallo">Schreib uns</a>
      <a href="tel:+49301234567">Anrufen</a>
      <a href="https://www.instagram.com/muster_talents/">IG</a>
      <a href="https://www.instagram.com/p/ABC123/">Post</a>
      <a href="/kontakt">Kontakt</a>`;
    expect(extractContactLinks(html)).toEqual({
      mails: ['info@muster.de'],
      tels: ['+49301234567'],
      instagram: ['@muster_talents']
    });
  });
});
