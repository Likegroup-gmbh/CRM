import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { linkLabel, shortenUrls, createLinkDrawer, linkifyForPdf } from '../core/pdf/pdfLinks.js';
import { renderPaginatedText } from '../core/pdf/PdfTextFlow.js';

const NBSP = '\u00A0';

describe('linkLabel', () => {
  it('nennt nur den Host, ohne www, Pfad und Query', () => {
    expect(linkLabel('https://www.shop.de/products/clear-case?utm=1')).toBe(`Link${NBSP}zu${NBSP}shop.de`);
  });

  it('faellt bei kaputter URL auf "Link" zurueck', () => {
    expect(linkLabel('https://')).toBe('Link');
  });
});

describe('shortenUrls', () => {
  it('ersetzt jede URL und gibt sie getrennt zurueck', () => {
    const { text, links } = shortenUrls('Siehe https://shop.de/a/b?x=1 und http://www.andere.com/x.');
    expect(text).toBe(`Siehe Link${NBSP}zu${NBSP}shop.de und Link${NBSP}zu${NBSP}andere.com.`);
    expect(links.map(l => l.url)).toEqual(['https://shop.de/a/b?x=1', 'http://www.andere.com/x']);
    expect(text).not.toContain('https://');
  });

  it('laesst Text ohne URL unveraendert', () => {
    expect(shortenUrls('Nur Text')).toEqual({ text: 'Nur Text', links: [] });
    expect(shortenUrls(null).text).toBe('');
  });

  it('haengt Satzzeichen nach der URL nicht an den Link', () => {
    const { links } = shortenUrls('(https://shop.de/x), danach');
    expect(links[0].url).toBe('https://shop.de/x');
  });
});

function fakeDoc() {
  const calls = [];
  return {
    calls,
    getFontSize: () => 10,
    getTextWidth: (t) => t.length,
    setTextColor: (...a) => calls.push(['color', ...a]),
    setDrawColor: () => {},
    setLineWidth: () => {},
    text: (t, x, y) => calls.push(['text', t, x, y]),
    line: () => calls.push(['line']),
    link: (x, y, w, h, opts) => calls.push(['link', x, w, opts.url]),
  };
}

describe('createLinkDrawer', () => {
  it('schreibt die Zeile in einem Stueck und legt Unterstreichung und Link-Flaeche darueber', () => {
    const { links } = shortenUrls('x https://shop.de/a y');
    const draw = createLinkDrawer(links);
    const doc = fakeDoc();
    const label = `Link${NBSP}zu${NBSP}shop.de`;

    draw(doc, `x ${label} y`, 10, 50);

    const texts = doc.calls.filter(c => c[0] === 'text');
    expect(texts).toEqual([['text', `x ${label} y`, 10, 50]]);
    const link = doc.calls.find(c => c[0] === 'link');
    expect(link[1]).toBe(12); // 10 + Breite von "x "
    expect(link[2]).toBe(label.length);
    expect(link[3]).toBe('https://shop.de/a');
    expect(doc.calls.filter(c => c[0] === 'line')).toHaveLength(1);
  });

  it('vergibt gleiche Bezeichnungen der Reihe nach an ihre URLs', () => {
    const { links } = shortenUrls('https://shop.de/eins und https://shop.de/zwei');
    const draw = createLinkDrawer(links);
    const doc = fakeDoc();
    const label = links[0].label;

    draw(doc, `${label} und`, 0, 0);
    draw(doc, label, 0, 5);

    expect(doc.calls.filter(c => c[0] === 'link').map(c => c[3]))
      .toEqual(['https://shop.de/eins', 'https://shop.de/zwei']);
  });

  it('verlinkt mehrere Bezeichnungen in einer Zeile', () => {
    const { links } = shortenUrls('https://a.de/x und https://b.de/y');
    const doc = fakeDoc();
    createLinkDrawer(links)(doc, `${links[0].label} und ${links[1].label}`, 0, 0);
    expect(doc.calls.filter(c => c[0] === 'link').map(c => c[3])).toEqual(['https://a.de/x', 'https://b.de/y']);
  });
});

describe('linkifyForPdf', () => {
  it('liefert ohne URL keine Zeichenfunktion', () => {
    expect(linkifyForPdf('Nur Text').drawLine).toBeUndefined();
    expect(linkifyForPdf('https://shop.de').drawLine).toBeTypeOf('function');
  });
});

describe('Link im echten jsPDF', () => {
  it('bricht die Bezeichnung nicht um und schreibt die URL nur als Link-Ziel', () => {
    const doc = new jsPDF();
    doc.setFontSize(10);
    const { text, drawLine } = linkifyForPdf(`${'wort '.repeat(30)}https://shop.de/sehr/lang/und/geheim`);

    renderPaginatedText(doc, text, { x: 14, y: 20, maxWidth: 60, maxContentY: 270, onPageBreak: () => 20, drawLine });

    const raw = doc.output();
    expect(raw).toContain('/URI');
    expect(raw).toContain('shop.de/sehr/lang/und/geheim'); // nur im Link-Ziel
    const sichtbar = raw.split('BT').slice(1).join('BT');
    expect(sichtbar).not.toContain('sehr/lang');
  });
});

describe('renderPaginatedText drawLine', () => {
  it('ruft drawLine statt doc.text', () => {
    const doc = { splitTextToSize: () => ['a', 'b'], text: vi.fn() };
    const drawLine = vi.fn();
    renderPaginatedText(doc, 'a b', { y: 10, maxContentY: 100, onPageBreak: () => 10, drawLine });
    expect(drawLine).toHaveBeenCalledTimes(2);
    expect(doc.text).not.toHaveBeenCalled();
  });
});
