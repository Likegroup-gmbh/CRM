import { describe, it, expect } from 'vitest';
import {
  renderParagraphZusatz,
  collectParagraphZusaetze,
  expandParagraphZusaetze
} from '../modules/vertrag/create/paragraphZusatz.js';

describe('collectParagraphZusaetze', () => {
  it('sammelt paragraph_zusatz_*-Felder in ein JSON-Objekt', () => {
    const formData = {
      name: 'Vertrag X',
      paragraph_zusatz_p2: 'Zusatz zu §2',
      paragraph_zusatz_p5: 'Zusatz zu §5',
      weitere_bestimmungen: 'Sonstiges'
    };
    expect(collectParagraphZusaetze(formData)).toEqual({
      p2: 'Zusatz zu §2',
      p5: 'Zusatz zu §5'
    });
  });

  it('filtert leere und Whitespace-Werte heraus', () => {
    const formData = {
      paragraph_zusatz_p2: '   ',
      paragraph_zusatz_p3: '',
      paragraph_zusatz_p4: 'Echt'
    };
    expect(collectParagraphZusaetze(formData)).toEqual({ p4: 'Echt' });
  });

  it('liefert null, wenn keine Zusätze vorhanden sind', () => {
    expect(collectParagraphZusaetze({ name: 'X' })).toBeNull();
    expect(collectParagraphZusaetze({ paragraph_zusatz_p2: '  ' })).toBeNull();
    expect(collectParagraphZusaetze({})).toBeNull();
    expect(collectParagraphZusaetze(null)).toBeNull();
  });

  it('trimmt die Texte', () => {
    expect(collectParagraphZusaetze({ paragraph_zusatz_p2: '  Text  ' })).toEqual({ p2: 'Text' });
  });
});

describe('expandParagraphZusaetze', () => {
  it('expandiert das JSONB-Objekt zurück in flache Felder', () => {
    expect(expandParagraphZusaetze({ p2: 'A', p10: 'B' })).toEqual({
      paragraph_zusatz_p2: 'A',
      paragraph_zusatz_p10: 'B'
    });
  });

  it('kommt mit null/undefined/leerem Objekt klar', () => {
    expect(expandParagraphZusaetze(null)).toEqual({});
    expect(expandParagraphZusaetze(undefined)).toEqual({});
    expect(expandParagraphZusaetze({})).toEqual({});
  });

  it('Roundtrip: collect(expand(x)) === x', () => {
    const original = { p2: 'Zusatz 2', p2a: 'Zusatz 2a', p6: 'Zusatz 6' };
    expect(collectParagraphZusaetze(expandParagraphZusaetze(original))).toEqual(original);
  });
});

describe('renderParagraphZusatz', () => {
  it('zeigt ohne Text den Button und versteckt die Textarea', () => {
    const html = renderParagraphZusatz({}, 'p2', '§2 Leistungsumfang');
    expect(html).toContain('data-paragraph="p2"');
    expect(html).toContain('Extra Bestimmung hinzufügen');
    expect(html).toContain('name="paragraph_zusatz_p2"');
    // Button sichtbar, Feld versteckt
    expect(html).toMatch(/btn-inline-action btn-paragraph-zusatz\s*"/);
    expect(html).toContain('paragraph-zusatz-field hidden');
  });

  it('zeigt mit vorhandenem Text die Textarea direkt offen', () => {
    const html = renderParagraphZusatz({ paragraph_zusatz_p2: 'Vorhanden' }, 'p2', '§2 Leistungsumfang');
    expect(html).toContain('btn-paragraph-zusatz hidden');
    expect(html).not.toContain('paragraph-zusatz-field hidden');
    expect(html).toContain('>Vorhanden</textarea>');
  });

  it('escapet HTML im gespeicherten Text', () => {
    const html = renderParagraphZusatz({ paragraph_zusatz_p2: '<script>alert(1)</script> & mehr' }, 'p2', '§2');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; mehr');
    expect(html).not.toContain('<script>alert(1)');
  });
});
