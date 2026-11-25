// Word-Datei in Dokumentteile. Mammoth liefert HTML; die Zuordnung
// auf die Skript-Tabelle macht ordneSkriptInhalt.

import mammoth from 'mammoth';

function mdAus(node) {
  let text = '';
  for (const child of node.childNodes || []) {
    if (child.nodeType === 3) {
      text += child.textContent || '';
      continue;
    }
    const name = child.nodeName;
    if (name === 'BR') {
      text += '\n';
      continue;
    }
    if (name === 'STRONG' || name === 'B') {
      const innen = mdAus(child);
      text += innen ? `**${innen}**` : '';
      continue;
    }
    if (name === 'EM' || name === 'I') {
      const innen = mdAus(child);
      text += innen ? `*${innen}*` : '';
      continue;
    }
    if (name === 'IMG') continue;
    if (name === 'P' || name === 'DIV') {
      const innen = mdAus(child).trim();
      if (!innen) continue;
      text += text && !text.endsWith('\n') ? `\n${innen}` : innen;
      continue;
    }
    text += mdAus(child);
  }
  return text;
}

function bilderIn(node, bildNachSrc) {
  const bilder = [];
  node.querySelectorAll?.('img')?.forEach((img) => {
    const treffer = bildNachSrc.get(img.getAttribute('src'));
    if (treffer) bilder.push(treffer);
  });
  return bilder;
}

function tabelleAus(table, bildNachSrc) {
  const zeilen = [...table.querySelectorAll('tr')].map((tr) => (
    [...tr.children]
      .filter((el) => el.nodeName === 'TD' || el.nodeName === 'TH')
      .map((zelle) => mdAus(zelle).trim())
  ));
  return { typ: 'tabelle', zeilen, bilder: bilderIn(table, bildNachSrc) };
}

export function htmlZuTeilen(html, bilder = []) {
  const bildNachSrc = new Map(bilder.map((bild) => [bild.id, bild]));
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const teile = [];
  const knoten = [...doc.body.children];
  for (const el of knoten) {
    const name = el.nodeName;
    if (name === 'TABLE') {
      teile.push(tabelleAus(el, bildNachSrc));
      continue;
    }
    if (name === 'UL' || name === 'OL') {
      const punkte = [...el.querySelectorAll(':scope > li')].map((li) => mdAus(li).trim()).filter(Boolean);
      if (punkte.length) teile.push({ typ: name === 'OL' ? 'nummerierung' : 'liste', punkte });
      teile.push(...bilderIn(el, bildNachSrc).map((bild) => ({ typ: 'bild', blob: bild.blob })));
      continue;
    }
    if (name === 'IMG') {
      const treffer = bildNachSrc.get(el.getAttribute('src'));
      if (treffer) teile.push({ typ: 'bild', blob: treffer.blob });
      continue;
    }
    const md = mdAus(el).trim();
    if (md) {
      const typ = name === 'H1' ? 'h1' : name === 'H2' ? 'h2' : 'absatz';
      teile.push({ typ, md });
    }
    teile.push(...bilderIn(el, bildNachSrc).map((bild) => ({ typ: 'bild', blob: bild.blob })));
  }
  return teile;
}

export async function liesDocx(arrayBuffer) {
  const bilder = [];
  const result = await mammoth.convertToHtml({ buffer: arrayBuffer }, {
    convertImage: mammoth.images.imgElement(async (image) => {
      const buf = await image.read();
      const id = `img-${bilder.length}`;
      bilder.push({
        id,
        blob: new Blob([buf], { type: image.contentType || 'image/png' })
      });
      return { src: id };
    })
  });
  return htmlZuTeilen(result.value || '', bilder);
}
