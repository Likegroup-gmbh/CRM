// skriptDokument.test.js
// Skript-Dokument (ADR 0062): Block-Modell, Intern-Filter, Renderer,
// Bild-Validierung und erweitertes Inline-Markdown (Highlight, Link).

import { describe, it, expect } from 'vitest';
import {
  SKRIPT_TABELLE, SKRIPT_TABELLE_ID, TABELLE_MAX,
  normalisiereBloecke, fuerSpeichern, sichtbareBloecke, pdfBloecke, neuerBlock,
  einfuegen, entfernen, verschieben, verschiebenZu, aendern, typWechseln,
  tabelleZeileEinfuegen, tabelleZeileEntfernen, tabelleSpalteEinfuegen, tabelleSpalteEntfernen,
  kopieMitNeuenIds
} from '../modules/skripte/editor/dokument/blockModell.js';
import { dokumentHtml, blockHtml } from '../modules/skripte/editor/dokument/blockRenderer.js';
import {
  pruefeSkriptBild, zielMasse, SKRIPT_BILD_MAX_BYTES
} from '../modules/skripte/editor/dokument/skriptBild.js';
import {
  renderInlineMd, htmlToInlineMd, toggleInlineFormat, detectInlineFormat, detectErweitert,
  setzeLink, setzeHighlightFarbe, inlineMdRuns, inlineMdText, teileInlineMd, runsZuMd, istSichereLinkUrl
} from '../core/utils/inlineFormat.js';
import { HIGHLIGHT_FARBEN } from '../core/utils/highlightFarben.js';
import { mitWert, wertAn } from '../modules/skripte/editor/SkriptEditorBlocks.js';
import { normalisiereLinkEingabe } from '../modules/skripte/editor/SkriptEditorToolbar.js';

const tabelle = { id: SKRIPT_TABELLE_ID, typ: SKRIPT_TABELLE };

describe('blockModell: normalisiereBloecke', () => {
  it('null wird zur Liste mit genau der Skript-Tabelle', () => {
    expect(normalisiereBloecke(null)).toEqual([tabelle]);
  });

  it('fehlende Skript-Tabelle kommt an den Anfang, doppelte fliegt raus', () => {
    const liste = normalisiereBloecke([
      { id: 'a', typ: 'absatz', md: 'x' },
      { id: 'zwei', typ: SKRIPT_TABELLE },
      { id: 'drei', typ: SKRIPT_TABELLE }
    ]);
    expect(liste.map((b) => b.id)).toEqual(['a', SKRIPT_TABELLE_ID]);

    const ohne = normalisiereBloecke([{ id: 'a', typ: 'absatz', md: 'x' }]);
    expect(ohne[0]).toEqual(tabelle);
  });

  it('unbekannte Typen und Bilder ohne Pfad fallen weg, doppelte IDs bekommen neue', () => {
    const liste = normalisiereBloecke([
      tabelle,
      { id: 'a', typ: 'absatz', md: '1' },
      { id: 'a', typ: 'absatz', md: '2' },
      { id: 'b', typ: 'video' },
      { id: 'c', typ: 'bild', pfad: '' }
    ]);
    expect(liste).toHaveLength(3);
    expect(liste[1].id).toBe('a');
    expect(liste[2].id).not.toBe('a');
    expect(liste[2].md).toBe('2');
  });

  it('Tabellen werden rechteckig und auf 12×12 begrenzt, intern nur bei true', () => {
    const [, t] = normalisiereBloecke([
      tabelle,
      { id: 't', typ: 'tabelle', zeilen: [['a'], ['b', 'c', 'd']], kopfzeile: true, intern: 'ja' }
    ]);
    expect(t.zeilen).toEqual([['a', '', ''], ['b', 'c', 'd']]);
    expect(t.intern).toBe(false);

    const gross = Array.from({ length: 20 }, () => Array(20).fill('x'));
    const [, g] = normalisiereBloecke([tabelle, { id: 'g', typ: 'tabelle', zeilen: gross }]);
    expect(g.zeilen).toHaveLength(TABELLE_MAX);
    expect(g.zeilen[0]).toHaveLength(TABELLE_MAX);
  });

  it('fuerSpeichern: nur die Tabelle ist null', () => {
    expect(fuerSpeichern([tabelle])).toBeNull();
    expect(fuerSpeichern([tabelle, { id: 'a', typ: 'absatz', md: '' }])).toHaveLength(2);
  });
});

describe('blockModell: intern-Filter', () => {
  const bloecke = [
    { id: 'a', typ: 'absatz', md: 'öffentlich' },
    { id: 'b', typ: 'absatz', md: 'geheim', intern: true },
    tabelle,
    { id: 'c', typ: 'bild', pfad: 's1/x.webp', intern: false }
  ];

  it('sichtbareBloecke ohne mitIntern blendet interne aus, die Tabelle bleibt', () => {
    expect(sichtbareBloecke(bloecke).map((b) => b.id)).toEqual(['a', SKRIPT_TABELLE_ID, 'c']);
    expect(sichtbareBloecke(bloecke, { mitIntern: true }).map((b) => b.id)).toEqual(['a', 'b', SKRIPT_TABELLE_ID, 'c']);
  });

  it('pdfBloecke: ohne interne, Bild-URL aufgeloest, null wenn nur die Tabelle bleibt', () => {
    const pdf = pdfBloecke(bloecke, (pfad) => `https://cdn/${pfad}`);
    expect(pdf.map((b) => b.id)).toEqual(['a', SKRIPT_TABELLE_ID, 'c']);
    expect(pdf[2].url).toBe('https://cdn/s1/x.webp');
    expect(pdfBloecke([tabelle, { id: 'x', typ: 'absatz', md: 'nur intern', intern: true }])).toBeNull();
    expect(pdfBloecke(null)).toBeNull();
  });
});

describe('blockModell: Operationen', () => {
  const a = { id: 'a', typ: 'absatz', md: 'A', intern: false };
  const b = { id: 'b', typ: 'h1', md: 'B', intern: false };
  const basis = [a, tabelle, b];

  it('einfuegen hinter/vor/ans Ende, nie eine zweite Skript-Tabelle', () => {
    const n = neuerBlock('trennlinie');
    expect(einfuegen(basis, n, { nachId: 'a' }).map((x) => x.id)).toEqual(['a', n.id, SKRIPT_TABELLE_ID, 'b']);
    expect(einfuegen(basis, n, { vorId: 'a' }).map((x) => x.id)).toEqual([n.id, 'a', SKRIPT_TABELLE_ID, 'b']);
    expect(einfuegen(basis, n).at(-1).id).toBe(n.id);
    expect(einfuegen(basis, { ...tabelle })).toHaveLength(3);
  });

  it('entfernen laesst die Skript-Tabelle stehen', () => {
    expect(entfernen(basis, SKRIPT_TABELLE_ID)).toHaveLength(3);
    expect(entfernen(basis, 'a').map((x) => x.id)).toEqual([SKRIPT_TABELLE_ID, 'b']);
  });

  it('verschieben und verschiebenZu (auch die Skript-Tabelle)', () => {
    expect(verschieben(basis, SKRIPT_TABELLE_ID, -1).map((x) => x.id)).toEqual([SKRIPT_TABELLE_ID, 'a', 'b']);
    expect(verschieben(basis, 'a', -1)).toEqual(basis);
    expect(verschiebenZu(basis, 'b', 'a', 'vor').map((x) => x.id)).toEqual(['b', 'a', SKRIPT_TABELLE_ID]);
    expect(verschiebenZu(basis, 'a', 'b', 'nach').map((x) => x.id)).toEqual([SKRIPT_TABELLE_ID, 'b', 'a']);
  });

  it('aendern ignoriert die Skript-Tabelle', () => {
    expect(aendern(basis, SKRIPT_TABELLE_ID, { md: 'x' })[1]).toEqual(tabelle);
    expect(aendern(basis, 'a', { intern: true })[0].intern).toBe(true);
  });

  it('typWechseln: Zeilen werden Listenpunkte und zurueck', () => {
    const liste = typWechseln({ ...a, md: 'eins\nzwei' }, 'liste');
    expect(liste).toMatchObject({ typ: 'liste', punkte: ['eins', 'zwei'] });
    expect(liste.md).toBeUndefined();
    expect(typWechseln(liste, 'h2')).toMatchObject({ typ: 'h2', md: 'eins\nzwei' });
  });

  it('Tabellen-Zeilen und -Spalten, Grenzen 1 und 12', () => {
    const t = neuerBlock('tabelle', { zeilen: 2, spalten: 2 });
    expect(tabelleZeileEinfuegen(t, 0).zeilen).toHaveLength(3);
    expect(tabelleSpalteEinfuegen(t, 1).zeilen[0]).toHaveLength(3);
    const eins = neuerBlock('tabelle', { zeilen: 1, spalten: 1 });
    expect(tabelleZeileEntfernen(eins, 0)).toBe(eins);
    expect(tabelleSpalteEntfernen(eins, 0)).toBe(eins);
    const voll = neuerBlock('tabelle', { zeilen: TABELLE_MAX, spalten: TABELLE_MAX });
    expect(tabelleZeileEinfuegen(voll, 0)).toBe(voll);
  });

  it('kopieMitNeuenIds (ohne Skript-Tabelle, neue IDs)', () => {
    const kopie = kopieMitNeuenIds(basis);
    expect(kopie.map((x) => x.typ)).toEqual(['absatz', 'h1']);
    expect(kopie.every((x) => x.id !== 'a' && x.id !== 'b')).toBe(true);
  });

  it('mitWert / wertAn fuer alle Zelltypen', () => {
    const l = { id: 'l', typ: 'liste', punkte: ['x', 'y'] };
    expect(wertAn(mitWert(l, { feld: 'punkte', index: 1 }, 'neu'), { feld: 'punkte', index: 1 })).toBe('neu');
    const t = neuerBlock('tabelle');
    expect(mitWert(t, { feld: 'zelle', zeile: 1, spalte: 0 }, 'z').zeilen[1][0]).toBe('z');
    expect(t.zeilen[1][0]).toBe('');
    expect(mitWert({ id: 'b', typ: 'bild', pfad: 'p' }, { feld: 'unterschrift' }, 'u').unterschrift).toBe('u');
  });
});

describe('blockRenderer', () => {
  const bloecke = [
    { id: 'a', typ: 'h1', md: 'Übersicht' },
    { id: 'geheim', typ: 'absatz', md: 'Nur Team', intern: true },
    tabelle,
    { id: 'bild', typ: 'bild', pfad: 's/b.webp', breite: 'klein', unterschrift: 'Setup' },
    { id: 't', typ: 'tabelle', zeilen: [['Produkt', 'Preis'], ['A', '**9 €**']], kopfzeile: true },
    { id: 'l', typ: 'nummerierung', punkte: ['eins', ''] },
    { id: 'leer', typ: 'absatz', md: '' }
  ];
  const opts = { bildUrl: (p) => `https://cdn/${p}`, skriptTabelleHtml: '<table class="grid">GRID</table>' };

  it('Lesend: ohne interne Bloecke, ohne Griff, nicht editierbar, leere Absaetze weg', () => {
    const html = dokumentHtml(bloecke, opts);
    expect(html).not.toContain('Nur Team');
    expect(html).not.toContain('data-block-griff');
    expect(html).not.toContain('contenteditable');
    expect(html).not.toContain('data-block-id="leer"');
    expect(html).toContain('<h2 class="skripte-editor-block-text skripte-editor-block-text--h1"');
    expect(html).toContain('GRID');
    expect(html).toContain('src="https://cdn/s/b.webp"');
    expect(html).toContain('skripte-editor-block-bild--klein');
    expect(html).toContain('<th><div class="skripte-editor-block-text"');
    expect(html).toContain('<strong>9 €</strong>');
    expect(html).toContain('<ol class="skripte-editor-block-liste">');
    expect((html.match(/<li>/g) || []).length).toBe(1);
  });

  it('Team: interne mit Badge, Griff, contenteditable, aber nie data-feld', () => {
    const html = dokumentHtml(bloecke, { ...opts, editierbar: true, mitIntern: true });
    expect(html).toContain('Nur Team');
    expect(html).toContain('is-intern');
    expect(html).toContain('skripte-editor-block-intern');
    expect(html).toContain('data-block-griff');
    expect(html).toContain('contenteditable="plaintext-only"');
    expect(html).toContain('data-dokument-ende');
    expect(html).not.toMatch(/data-feld=/);
  });

  it('Team lesend (view-only intern) sieht interne Bloecke, ohne Griff', () => {
    const html = dokumentHtml(bloecke, { ...opts, mitIntern: true });
    expect(html).toContain('Nur Team');
    expect(html).not.toContain('data-block-griff');
  });

  it('Link-Ziel und Text werden escaped', () => {
    const html = blockHtml({ id: 'x', typ: 'absatz', md: '[<b>](https://a.de/?q="x") ==gelb==' });
    expect(html).not.toContain('<b>');
    expect(html).toContain('<mark>gelb</mark>');
  });
});

describe('skriptDocHtml mit Skript-Dokument', () => {
  const skript = {
    titel: 'T', hook: 'Hook-Text', hauptteil: 'Mitte', cta: 'Ende',
    dokument_bloecke: [
      { id: 'a', typ: 'absatz', md: 'Davor' },
      { id: 'i', typ: 'absatz', md: 'Intern-Notiz', intern: true },
      tabelle,
      { id: 'b', typ: 'absatz', md: 'Danach' }
    ]
  };
  const basis = { messages: [], isReadonly: false, docHeadActionsHtml: '', vorgabenPanelHtml: '' };

  it('Seite mit Bloecken in Reihenfolge, Grid im Platz der Skript-Tabelle', async () => {
    const { skriptDocHtml } = await import('../modules/skripte/editor/SkriptEditorDocRenderer.js');
    const html = skriptDocHtml({ ...basis, skript, bildUrl: (p) => p });
    expect(html).toContain('skripte-editor-seite');
    const davor = html.indexOf('Davor');
    const grid = html.indexOf('Was gesagt wird');
    const danach = html.indexOf('Danach');
    expect(davor).toBeGreaterThan(-1);
    expect(davor).toBeLessThan(grid);
    expect(grid).toBeLessThan(danach);
    expect(html).toContain('data-feld="hook"');
    expect(html).not.toContain('Intern-Notiz');
    expect(html).not.toContain('id="ed-toolbar"');
  });

  it('Team: Toolbar-HTML und interne Bloecke', async () => {
    const { skriptDocHtml } = await import('../modules/skripte/editor/SkriptEditorDocRenderer.js');
    const { toolbarHtml } = await import('../modules/skripte/editor/SkriptEditorToolbar.js');
    const html = skriptDocHtml({
      ...basis, skript, bildUrl: (p) => p, bloeckeEditierbar: true, mitIntern: true, toolbarHtml: toolbarHtml()
    });
    expect(html).toContain('id="ed-toolbar"');
    expect(html).toContain('Intern-Notiz');
    expect(html).toContain('data-tb="bild"');
    expect(html).not.toContain('bausteine');
    expect(html).toContain('data-tb="highlight"');
  });

  it('ohne dokument_bloecke: nur die Skript-Tabelle wie bisher', async () => {
    const { skriptDocHtml } = await import('../modules/skripte/editor/SkriptEditorDocRenderer.js');
    const html = skriptDocHtml({ ...basis, skript: { titel: 'T', hook: 'H', hauptteil: 'M', cta: 'E' } });
    expect(html).toContain('data-block-id="skript-tabelle"');
    expect(html).toContain('data-feld="hook"');
    expect((html.match(/data-block-id=/g) || []).length).toBe(1);
  });
});

describe('skriptBild', () => {
  it('pruefeSkriptBild: nur PNG/JPG/WebP bis 5 MB', () => {
    expect(pruefeSkriptBild({ name: 'a.png', type: 'image/png', size: 1000 })).toBeNull();
    expect(pruefeSkriptBild({ name: 'a.webp', type: 'image/webp', size: SKRIPT_BILD_MAX_BYTES })).toBeNull();
    expect(pruefeSkriptBild({ name: 'a.gif', type: 'image/gif', size: 10 })).toMatch(/PNG, JPG oder WebP/);
    expect(pruefeSkriptBild({ name: 'a.jpg', type: 'image/jpeg', size: SKRIPT_BILD_MAX_BYTES + 1 })).toMatch(/5 MB/);
    expect(pruefeSkriptBild(null)).toBeTruthy();
  });

  it('zielMasse: lange Kante auf 1600, nie hochskalieren', () => {
    expect(zielMasse(4000, 2000)).toEqual({ breite: 1600, hoehe: 800 });
    expect(zielMasse(1000, 3000)).toEqual({ breite: 533, hoehe: 1600 });
    expect(zielMasse(800, 600)).toEqual({ breite: 800, hoehe: 600 });
  });
});

describe('inlineFormat erweitert (Highlight, Link)', () => {
  const E = { erweitert: true };

  it('ohne Option bleibt das Grid-Markdown unveraendert', () => {
    expect(renderInlineMd('==a== [b](https://x.de)').html).toBe('==a== [b](https://x.de)');
  });

  it('rendert Highlight und sichere Links, unsichere bleiben Text', () => {
    expect(renderInlineMd('==a== **==b==**', E).html).toBe('<mark>a</mark> <strong><mark>b</mark></strong>');
    expect(renderInlineMd('[Doku](https://x.de/a)', E).html)
      .toBe('<a href="https://x.de/a" target="_blank" rel="noopener noreferrer">Doku</a>');
    expect(renderInlineMd('[x](javascript:alert(1))', E).html).not.toContain('<a');
    expect(istSichereLinkUrl('mailto:a@b.de')).toBe(true);
    expect(istSichereLinkUrl('https://a.de/x y')).toBe(false);
  });

  it('Roundtrip HTML -> Markdown fuer mark und a', () => {
    const el = document.createElement('div');
    el.innerHTML = renderInlineMd('x ==gelb== [Link](https://a.de)', E).html;
    expect(htmlToInlineMd(el)).toBe('x ==gelb== [Link](https://a.de)');
    el.innerHTML = '<a href="javascript:void(0)">nur Text</a>';
    expect(htmlToInlineMd(el)).toBe('nur Text');
  });

  it('toggle highlight an und aus, detect liefert weiter nur bold/italic', () => {
    const an = toggleInlineFormat('ab cd', 3, 5, 'highlight');
    expect(an).toEqual({ text: 'ab ==cd==', start: 5, end: 7 });
    expect(detectErweitert(an.text, an.start, an.end).highlight).toBe(true);
    expect(detectInlineFormat(an.text, an.start, an.end)).toEqual({ bold: false, italic: false });
    const aus = toggleInlineFormat(an.text, an.start, an.end, 'highlight');
    expect(aus).toEqual({ text: 'ab cd', start: 3, end: 5 });
  });

  it('setzeLink: setzen, aendern, entfernen', () => {
    const gesetzt = setzeLink('siehe Doku', 6, 10, 'https://a.de');
    expect(gesetzt.text).toBe('siehe [Doku](https://a.de)');
    const geaendert = setzeLink(gesetzt.text, gesetzt.start, gesetzt.end, 'https://b.de');
    expect(geaendert.text).toBe('siehe [Doku](https://b.de)');
    expect(detectErweitert(geaendert.text, 8, 8).link).toBe('https://b.de');
    expect(setzeLink(geaendert.text, 8, 8, '').text).toBe('siehe Doku');
    expect(setzeLink('abc', 0, 3, 'javascript:x').text).toBe('abc');
  });

  it('inlineMdRuns / inlineMdText fuers PDF', () => {
    expect(inlineMdRuns('a **b ==c==** [d](https://x.de)')).toEqual([
      { text: 'a ' },
      { text: 'b ', bold: true },
      { text: 'c', bold: true, highlight: true },
      { text: ' ' },
      { text: 'd', href: 'https://x.de' }
    ]);
    expect(inlineMdText('**a** ==b==')).toBe('a b');
  });

  it('teileInlineMd schliesst und oeffnet Formatierung am Schnitt', () => {
    expect(teileInlineMd('**fett text**', 4)).toEqual(['**fett**', '** text**']);
    expect(teileInlineMd('ab', 0)).toEqual(['', 'ab']);
    expect(teileInlineMd('ab', 2)).toEqual(['ab', '']);
    expect(runsZuMd(inlineMdRuns('***x*** ==y== [z](https://a.de)'))).toBe('***x*** ==y== [z](https://a.de)');
  });
});

describe('inlineFormat: farbige Hervorhebung', () => {
  const E = { erweitert: true };

  it('Skript-Tabelle (hervorheben): Farbe ja, Links bleiben Literal', () => {
    const G = { hervorheben: true };
    expect(renderInlineMd('=={rose}a== [b](https://x.de)', G).html)
      .toBe('<mark data-farbe="rose" style="background-color:#f7c9d1">a</mark> [b](https://x.de)');
  });

  it('Palette: 20 eindeutige Farben', () => {
    expect(HIGHLIGHT_FARBEN).toHaveLength(20);
    expect(new Set(HIGHLIGHT_FARBEN.map((f) => f.id)).size).toBe(20);
    expect(new Set(HIGHLIGHT_FARBEN.map((f) => f.hex)).size).toBe(20);
  });

  it('rendert =={id}Text== mit Farbe, unbekannte id bleibt Literal', () => {
    expect(renderInlineMd('=={rose}a==', E).html)
      .toBe('<mark data-farbe="rose" style="background-color:#f7c9d1">a</mark>');
    expect(renderInlineMd('=={gibtsnicht}a==', E).html).toBe('<mark>{gibtsnicht}a</mark>');
  });

  it('Roundtrip HTML -> Markdown behaelt die Farbe', () => {
    const el = document.createElement('div');
    el.innerHTML = renderInlineMd('x =={minze}gruen== ==plain==', E).html;
    expect(htmlToInlineMd(el)).toBe('x =={minze}gruen== ==plain==');
  });

  it('setzeHighlightFarbe: setzen, umfaerben, gleiche Farbe und leer entfernen', () => {
    const an = setzeHighlightFarbe('ab cd', 3, 5, 'rose');
    expect(an).toEqual({ text: 'ab =={rose}cd==', start: 11, end: 13 });
    expect(detectErweitert(an.text, an.start, an.end)).toMatchObject({ highlight: true, farbe: 'rose' });

    const um = setzeHighlightFarbe(an.text, an.start, an.end, 'minze');
    expect(um.text).toBe('ab =={minze}cd==');
    expect(um.text.slice(um.start, um.end)).toBe('cd');

    const aus = setzeHighlightFarbe(um.text, um.start, um.end, 'minze');
    expect(aus).toEqual({ text: 'ab cd', start: 3, end: 5 });
    expect(setzeHighlightFarbe(um.text, um.start, um.end, '').text).toBe('ab cd');
    expect(setzeHighlightFarbe('ab cd', 3, 5, '').text).toBe('ab cd');
  });

  it('plain ==Text== laesst sich auf Farbe umstellen und per Toggle entfernen', () => {
    const farbig = setzeHighlightFarbe('ab ==cd==', 5, 7, 'flieder');
    expect(farbig.text).toBe('ab =={flieder}cd==');
    expect(toggleInlineFormat(farbig.text, farbig.start, farbig.end, 'highlight').text).toBe('ab cd');
  });

  it('inlineMdRuns / runsZuMd / teileInlineMd tragen die Farbe', () => {
    expect(inlineMdRuns('=={rose}a== ==b==')).toEqual([
      { text: 'a', highlight: 'rose' },
      { text: ' ' },
      { text: 'b', highlight: true }
    ]);
    expect(runsZuMd(inlineMdRuns('=={rose}a== ==b=='))).toBe('=={rose}a== ==b==');
    expect(teileInlineMd('=={rose}ab==', 1)).toEqual(['=={rose}a==', '=={rose}b==']);
  });
});

describe('Toolbar: Link-Eingabe', () => {
  it('ergaenzt https:// und mailto:', () => {
    expect(normalisiereLinkEingabe('likegroup.de')).toBe('https://likegroup.de');
    expect(normalisiereLinkEingabe('a@b.de')).toBe('mailto:a@b.de');
    expect(normalisiereLinkEingabe('http://x.de')).toBe('http://x.de');
    expect(normalisiereLinkEingabe('  ')).toBe('');
  });
});
