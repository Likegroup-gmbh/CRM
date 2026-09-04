import { describe, it, expect } from 'vitest';
import { sanitizeSchritte, slugify, ROUTE_ALLOWLIST } from '../../scripts/neuigkeiten/prompt.cjs';

describe('neuigkeiten/prompt – sanitizeSchritte', () => {
  it('laesst valide Schritte mit erlaubter Route durch', () => {
    const schritte = sanitizeSchritte([
      { titel: 'Oeffnen Sie die Produktliste', text: 'Dort sehen Sie die Ordner.', route: '/produkt' }
    ]);
    expect(schritte).toHaveLength(1);
    expect(schritte[0]).toEqual({
      titel: 'Oeffnen Sie die Produktliste',
      text: 'Dort sehen Sie die Ordner.',
      route: '/produkt',
      screenshot_path: null
    });
  });

  it('verwirft halluzinierte Routen, behaelt aber den Schritt', () => {
    const schritte = sanitizeSchritte([
      { titel: 'Schritt', text: 'Text', route: '/admin/geheim' },
      { titel: 'Schritt 2', text: 'Text 2', route: 'https://example.com/produkt' }
    ]);
    expect(schritte).toHaveLength(2);
    expect(schritte[0].route).toBeNull();
    expect(schritte[1].route).toBeNull();
  });

  it('filtert Schritte ohne Titel oder Text', () => {
    const schritte = sanitizeSchritte([
      { titel: '', text: 'Text' },
      { titel: 'Titel', text: '' },
      { titel: 'Titel' },
      null,
      'muell',
      { titel: 'Gut', text: 'Gut' }
    ]);
    expect(schritte).toHaveLength(1);
    expect(schritte[0].titel).toBe('Gut');
  });

  it('begrenzt auf die Maximalzahl', () => {
    const viele = Array.from({ length: 10 }, (_, i) => ({ titel: `S${i}`, text: `T${i}` }));
    expect(sanitizeSchritte(viele)).toHaveLength(6);
  });

  it('gibt bei Nicht-Arrays ein leeres Array zurueck', () => {
    expect(sanitizeSchritte(undefined)).toEqual([]);
    expect(sanitizeSchritte('text')).toEqual([]);
    expect(sanitizeSchritte(null)).toEqual([]);
  });

  it('Allowlist enthaelt die Kern-Routen der App', () => {
    for (const route of ['/dashboard', '/produkt', '/persona', '/kampagne', '/skripte']) {
      expect(ROUTE_ALLOWLIST).toContain(route);
    }
  });
});

describe('neuigkeiten/prompt – slugify', () => {
  it('ersetzt Umlaute und Sonderzeichen', () => {
    expect(slugify('Personas für Kampagnen: Übersicht')).toBe('personas-fuer-kampagnen-uebersicht');
  });

  it('kappt lange Titel und faellt auf update zurueck', () => {
    expect(slugify('x'.repeat(100))).toHaveLength(60);
    expect(slugify('')).toBe('update');
    expect(slugify(null)).toBe('update');
  });
});
