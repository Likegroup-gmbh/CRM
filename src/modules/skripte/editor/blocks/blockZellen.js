// blockZellen.js
// Textzellen der Freien Bloecke: Ort (Block, Feld, Index, Zeile, Spalte) und Wert im Modell.

import { indexVon, istTextBlock, istListenBlock } from '../dokument/blockModell.js';

export function zahl(wert) {
  if (wert == null || wert === '') return null;
  const n = Number(wert);
  return Number.isInteger(n) ? n : null;
}

export function ersetze(bloecke, id, ersatz) {
  const i = indexVon(bloecke, id);
  if (i < 0) return bloecke;
  const liste = [...bloecke];
  liste.splice(i, 1, ...ersatz);
  return liste;
}

/** Wert einer Textzelle im Modell. */
export function wertAn(block, ort) {
  if (!block) return '';
  if (ort.feld === 'md') return block.md || '';
  if (ort.feld === 'punkte') return block.punkte?.[ort.index] ?? '';
  if (ort.feld === 'unterschrift') return block.unterschrift || '';
  if (ort.feld === 'zelle') return block.zeilen?.[ort.zeile]?.[ort.spalte] ?? '';
  return '';
}

/** Block mit neuem Wert in einer Textzelle. */
export function mitWert(block, ort, wert) {
  if (ort.feld === 'md') return { ...block, md: wert };
  if (ort.feld === 'unterschrift') return { ...block, unterschrift: wert };
  if (ort.feld === 'punkte' && ort.index != null) {
    const punkte = [...block.punkte];
    punkte[ort.index] = wert;
    return { ...block, punkte };
  }
  if (ort.feld === 'zelle' && ort.zeile != null && ort.spalte != null) {
    const zeilen = block.zeilen.map((z) => [...z]);
    if (zeilen[ort.zeile]) zeilen[ort.zeile][ort.spalte] = wert;
    return { ...block, zeilen };
  }
  return block;
}

export function ersteZelleOrt(block) {
  if (!block) return null;
  if (istTextBlock(block)) return { blockId: block.id, feld: 'md', offset: 0 };
  if (istListenBlock(block)) return { blockId: block.id, feld: 'punkte', index: 0, offset: 0 };
  if (block.typ === 'tabelle') return { blockId: block.id, feld: 'zelle', zeile: 0, spalte: 0, offset: 0 };
  return { blockId: block.id };
}

export function letzteZelleOrt(block) {
  if (!block) return null;
  if (istTextBlock(block)) return { blockId: block.id, feld: 'md', offset: 'ende' };
  if (istListenBlock(block)) return { blockId: block.id, feld: 'punkte', index: block.punkte.length - 1, offset: 'ende' };
  if (block.typ === 'tabelle') {
    const zeile = block.zeilen.length - 1;
    return { blockId: block.id, feld: 'zelle', zeile, spalte: block.zeilen[zeile].length - 1, offset: 'ende' };
  }
  return { blockId: block.id };
}
