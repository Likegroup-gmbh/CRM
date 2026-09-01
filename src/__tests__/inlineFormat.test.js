// inlineFormat.test.js
// Mini-Markdown Inline-Formatierung: Render+Maps, Serializer-Roundtrip,
// detect/toggle inkl. ***-Kombination und DOM-Bruecke.

import { describe, it, expect, afterEach } from 'vitest';
import {
  renderInlineMd, htmlToInlineMd, detectInlineFormat, toggleInlineFormat,
  domSelectionToRaw, selectRawRange
} from '../core/utils/inlineFormat.js';

describe('renderInlineMd', () => {
  it('rendert **fett**, *kursiv*, ***beides*** und `code` escaped', () => {
    const { html } = renderInlineMd('a **b** *c* ***d*** `e` <f>');
    expect(html).toBe('a <strong>b</strong> <em>c</em> <strong><em>d</em></strong> <code>e</code> &lt;f&gt;');
  });

  it('Marker ohne schliessenden Marker oder leer bleiben Literal', () => {
    expect(renderInlineMd('a **b').html).toBe('a **b');
    expect(renderInlineMd('a **** b').html).toBe('a **** b');
    expect(renderInlineMd('100 * 2 * 3').html).toBe('100 <em> 2 </em> 3');
  });

  it('verschachteltes *kursiv* in **fett** wird rekursiv geparst', () => {
    const { html } = renderInlineMd('**a *b* c**');
    expect(html).toBe('<strong>a <em>b</em> c</strong>');
  });

  it('Offset-Maps: Marker zeigen auf Inhaltsposition, Sentinel am Ende', () => {
    const raw = 'x **ab** y';
    const { toRaw, toRendered } = renderInlineMd(raw);
    // sichtbar: "x ab y" (6 Zeichen)
    expect(toRaw).toEqual([0, 1, 4, 5, 8, 9, raw.length]);
    // Roh-Offsets der Marker mappen auf die Inhaltsgrenzen
    expect(toRendered[0]).toBe(0);  // x
    expect(toRendered[2]).toBe(2);  // erster * -> Position von 'a'
    expect(toRendered[4]).toBe(2);  // a
    expect(toRendered[7]).toBe(4);  // letzter * -> Position hinter 'b'
    expect(toRendered[raw.length]).toBe(6);
  });
});

describe('htmlToInlineMd', () => {
  let el;
  afterEach(() => el?.remove());

  const fromHtml = (html) => {
    el = document.createElement('div');
    el.innerHTML = html;
    return htmlToInlineMd(el);
  };

  it('Roundtrip: gerendertes HTML wird wieder zum Raw-String', () => {
    const raw = 'Hallo **fett** und *kursiv* und ***beides*** plus `code`';
    const { html } = renderInlineMd(raw);
    expect(fromHtml(html)).toBe(raw);
  });

  it('BR wird zu Newline, leere Format-Tags fallen weg, nbsp normalisiert', () => {
    expect(fromHtml('a<br>b<strong></strong> c')).toBe('a\nb c');
  });

  it('Browser-Blockcontainer (div) werden zu Newlines', () => {
    expect(fromHtml('<div>a</div><div>b</div>')).toBe('a\nb');
  });
});

describe('detectInlineFormat', () => {
  it('erkennt Marker ausserhalb der Auswahl', () => {
    expect(detectInlineFormat('**abc**', 2, 5)).toEqual({ bold: true, italic: false });
    expect(detectInlineFormat('*abc*', 1, 4)).toEqual({ bold: false, italic: true });
    expect(detectInlineFormat('***abc***', 3, 6)).toEqual({ bold: true, italic: true });
  });

  it('erkennt Marker innerhalb der Auswahl (mitmarkiert)', () => {
    expect(detectInlineFormat('**abc**', 0, 7)).toEqual({ bold: true, italic: false });
    expect(detectInlineFormat('*abc*', 0, 5)).toEqual({ bold: false, italic: true });
  });

  it('unformatierte Auswahl ist weder bold noch italic', () => {
    expect(detectInlineFormat('abc **de**', 0, 3)).toEqual({ bold: false, italic: false });
  });
});

describe('toggleInlineFormat', () => {
  it('wrappt unformatierte Auswahl und behaelt Inhalt als neue Auswahl', () => {
    const r = toggleInlineFormat('Hallo Welt', 6, 10, 'bold');
    expect(r.text).toBe('Hallo **Welt**');
    expect(r.text.slice(r.start, r.end)).toBe('Welt');
  });

  it('unwrappt formatierte Auswahl (Marker ausserhalb)', () => {
    const r = toggleInlineFormat('Hallo **Welt**', 8, 12, 'bold');
    expect(r.text).toBe('Hallo Welt');
    expect(r.text.slice(r.start, r.end)).toBe('Welt');
  });

  it('unwrappt mitmarkierte Auswahl (Marker innerhalb)', () => {
    const r = toggleInlineFormat('Hallo **Welt**', 6, 14, 'bold');
    expect(r.text).toBe('Hallo Welt');
    expect(r.text.slice(r.start, r.end)).toBe('Welt');
  });

  it('kombiniert: italic auf bold-Inhalt ergibt ***, und wieder zurueck', () => {
    const bold = 'Hallo **Welt**';
    const both = toggleInlineFormat(bold, 8, 12, 'italic');
    expect(both.text).toBe('Hallo ***Welt***');
    const wiederBold = toggleInlineFormat(both.text, both.start, both.end, 'italic');
    expect(wiederBold.text).toBe(bold);
  });

  it('entfernt nur bold aus ***, italic bleibt', () => {
    const r = toggleInlineFormat('a ***x*** b', 5, 6, 'bold');
    expect(r.text).toBe('a *x* b');
  });

  it('leere Auswahl ist No-Op', () => {
    const r = toggleInlineFormat('abc', 1, 1, 'bold');
    expect(r.text).toBe('abc');
  });
});

describe('DOM-Bruecke', () => {
  let el;
  afterEach(() => el?.remove());

  const zelle = (raw) => {
    el = document.createElement('div');
    el.innerHTML = renderInlineMd(raw).html;
    document.body.appendChild(el);
    return el;
  };

  const selectRendered = (cell, startVis, endVis) => {
    const { toRendered } = renderInlineMd('');
    void toRendered;
    // Positionen ueber sichtbaren Text aufloesen
    const range = document.createRange();
    const locate = (pos) => {
      let total = 0;
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (pos <= total + node.nodeValue.length) return { node, offset: pos - total };
        total += node.nodeValue.length;
      }
      return null;
    };
    const s = locate(startVis);
    const e = locate(endVis);
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  it('domSelectionToRaw mappt sichtbare Selektion auf Raw-Offsets', () => {
    const raw = 'Hallo **fette** Welt';
    const cell = zelle(raw);
    const { toRaw } = renderInlineMd(raw);
    // sichtbar: "Hallo fette Welt" -> "fette" ist [6, 11)
    selectRendered(cell, 6, 11);
    expect(domSelectionToRaw(cell, toRaw)).toEqual({ start: 8, end: 13 });
  });

  it('selectRawRange markiert den formatierten Inhalt erneut', () => {
    const raw = 'Hallo **fette** Welt';
    const cell = zelle(raw);
    const { toRendered } = renderInlineMd(raw);
    selectRawRange(cell, toRendered, 8, 13);
    expect(window.getSelection().toString()).toBe('fette');
  });
});
