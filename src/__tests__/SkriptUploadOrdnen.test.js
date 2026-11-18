import { describe, it, expect } from 'vitest';
import { ordneSkriptInhalt } from '../modules/skripte/upload/ordneSkriptInhalt.js';
import { htmlZuTeilen, liesDocx } from '../modules/skripte/upload/liesDocx.js';
import { zipStore } from './zipStore.js';

const KOPF = ['', 'Was gesagt wird', 'Was zu sehen ist'];

describe('ordneSkriptInhalt', () => {
  it('füllt die Skript-Tabelle aus der ersten passenden Tabelle', () => {
    const { zellen, bloecke } = ordneSkriptInhalt([
      { typ: 'absatz', md: 'Einleitung' },
      {
        typ: 'tabelle',
        zeilen: [
          KOPF,
          ['Hook', '**Hallo**', 'Nah'],
          ['Hauptteil', 'Mitte', ''],
          ['CTA', 'Kauf', 'Logo'],
          ['Rezept', '200g Mehl', '']
        ]
      },
      { typ: 'absatz', md: 'Notiz' }
    ]);

    expect(zellen.hook).toBe('**Hallo**');
    expect(zellen.hook_visuell).toBe('Nah');
    expect(zellen.hauptteil).toBe('Mitte');
    expect(zellen.cta).toBe('Kauf');
    expect(zellen.cta_visuell).toBe('Logo');
    expect(zellen.rezept).toBe('200g Mehl');
    expect(bloecke.map((b) => b.md)).toEqual(['Einleitung', 'Notiz']);
  });

  it('überschreibt eine spätere Hook-Zeile nicht', () => {
    const { zellen, bloecke } = ordneSkriptInhalt([
      { typ: 'tabelle', zeilen: [KOPF, ['HOOK', 'Erster', 'Bild']] },
      { typ: 'tabelle', zeilen: [KOPF, ['Hook', 'Zweiter', 'Anderes']] }
    ]);
    expect(zellen.hook).toBe('Erster');
    expect(zellen.hook_visuell).toBe('Bild');
    expect(bloecke[0].typ).toBe('tabelle');
    expect(bloecke[0].zeilen[1][1]).toBe('Zweiter');
  });

  it('füllt Hook 1 bis 3 und lässt eine Tabelle ohne Beschriftung darunter', () => {
    const { zellen, bloecke } = ordneSkriptInhalt([
      { typ: 'tabelle', zeilen: [['Shot'], ['A'], ['B']] },
      { typ: 'tabelle', zeilen: [['', 'Was gesagt wird'], ['Hook 1', 'Variante']] }
    ]);
    expect(zellen.hook).toBeNull();
    expect(zellen.hook_variante_1).toBe('Variante');
    expect(bloecke[0].zeilen.map((z) => z[0])).toEqual(['Shot', 'A', 'B']);
  });

  it('verteilt eine Tabelle über 12 Zeilen auf mehrere Blöcke', () => {
    const zeilen = [['Liste'], ...Array.from({ length: 13 }, (_, i) => [`Zeile ${i + 1}`])];
    const { bloecke } = ordneSkriptInhalt([{ typ: 'tabelle', zeilen }]);
    expect(bloecke).toHaveLength(2);
    expect(bloecke[0].zeilen).toHaveLength(12);
    expect(bloecke[1].zeilen[0][0]).toBe('Zeile 12');
  });
});

describe('liesDocx', () => {
  it('liest Beschriftung, Fett und Text unter der Tabelle', async () => {
    const doc = zipStore([
      ['[Content_Types].xml', contentTypes()],
      ['_rels/.rels', rels()],
      ['word/_rels/document.xml.rels', wordRels()],
      ['word/document.xml', dokumentXml()]
    ]);
    const teile = await liesDocx(doc.buffer);
    const { zellen, bloecke } = ordneSkriptInhalt(teile);
    expect(zellen.hook).toBe('**Hallo**');
    expect(zellen.hauptteil).toBe('Mitte');
    expect(bloecke.some((b) => b.md === 'Notiz darunter')).toBe(true);
  });

  it('macht aus HTML eine Tabelle und einen Absatz', () => {
    const teile = htmlZuTeilen('<table><tr><td>Hook</td><td><strong>Hallo</strong></td></tr></table><p>Unten</p>');
    expect(teile[0].zeilen).toEqual([['Hook', '**Hallo**']]);
    expect(teile[1]).toEqual({ typ: 'absatz', md: 'Unten' });
  });
});

function dokumentXml() {
  const zelle = (text, fett = false) => `
    <w:tc><w:p><w:r>${fett ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t>${text}</w:t></w:r></w:p></w:tc>`;
  const zeile = (zellen) => `<w:tr>${zellen}</w:tr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:tbl>
          ${zeile(zelle('') + zelle('Was gesagt wird') + zelle('Was zu sehen ist'))}
          ${zeile(zelle('Hook') + zelle('Hallo', true) + zelle('Nah'))}
          ${zeile(zelle('Hauptteil') + zelle('Mitte') + zelle(''))}
        </w:tbl>
        <w:p><w:r><w:t>Notiz darunter</w:t></w:r></w:p>
      </w:body>
    </w:document>`;
}

function contentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`;
}

function rels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`;
}

function wordRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
}
