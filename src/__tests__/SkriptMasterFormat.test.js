import { describe, it, expect } from 'vitest';
import {
  istMasterSkript, slugifyHeading, parseMasterSektionen,
  replaceMasterSektion, renderMdBody, renderMasterMarkdownHtml
} from '../modules/skripte/master/skriptMasterFormat.js';

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

describe('skriptMasterFormat', () => {
  it('istMasterSkript nur bei inhalt_md', () => {
    expect(istMasterSkript({ inhalt_md: '## A\nX' })).toBe(true);
    expect(istMasterSkript({ hook: 'H' })).toBe(false);
    expect(istMasterSkript(null)).toBe(false);
  });

  it('slugifyHeading normalisiert Umlaute und Sonderzeichen', () => {
    expect(slugifyHeading('A. Produktionskopf')).toBe('a-produktionskopf');
    expect(slugifyHeading('Hook-Paket')).toBe('hook-paket');
  });

  it('parst ##-Sektionen und Einleitung', () => {
    const md = 'Preamble\n\n## Hook-Paket\nAudio: hi\n\n## Szenenplan\n| A | B |\n';
    const secs = parseMasterSektionen(md);
    expect(secs.map((s) => s.slug)).toEqual(['einleitung', 'hook-paket', 'szenenplan']);
    expect(secs[1].body).toContain('Audio: hi');
  });

  it('ersetzt eine Sektion inkl. markierter Stelle', () => {
    const md = '## Hook-Paket\nAudio: alt\n\n## CTA\nEnde\n';
    const neu = replaceMasterSektion(md, 'hook-paket', 'Audio: neu', { selektion: 'Audio: alt' });
    expect(neu).toContain('Audio: neu');
    expect(neu).toContain('## CTA');
    expect(neu).not.toContain('Audio: alt');
  });

  it('rendert Tabellen und Listen', () => {
    const html = renderMdBody('| A | B |\n| --- | --- |\n| 1 | 2 |\n\n- eins\n- zwei', escapeHtml);
    expect(html).toContain('<table');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td>1</td>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>eins</li>');
  });

  it('renderMasterMarkdownHtml setzt data-sektion', () => {
    const html = renderMasterMarkdownHtml('## Produktionskopf\nTitel: X', escapeHtml);
    expect(html).toContain('data-sektion="produktionskopf"');
    expect(html).toContain('Produktionskopf');
    expect(html).toContain('Titel: X');
  });
});
