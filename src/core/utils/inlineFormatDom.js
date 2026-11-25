// inlineFormatDom.js
// DOM-Bruecke fuer contenteditable-Zellen: Selektion <-> sichtbare und Raw-Offsets.

function nodeTextLen(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.length;
  if (node.nodeType !== Node.ELEMENT_NODE) return 0;
  if (node.tagName === 'BR') return 1;
  let n = 0;
  for (const c of node.childNodes) n += nodeTextLen(c);
  return n;
}

function prefixLen(el, childCount) {
  let n = 0;
  const max = Math.min(childCount, el.childNodes.length);
  for (let i = 0; i < max; i++) n += nodeTextLen(el.childNodes[i]);
  return n;
}

/** Sichtbarer Text-Offset einer DOM-Position (BR zaehlt als 1 Zeichen). */
function renderedOffset(cell, node, offset) {
  if (node === cell) return prefixLen(cell, offset);
  let found = -1;
  const walk = (el, acc) => {
    let total = acc;
    for (const child of el.childNodes) {
      if (found >= 0) break;
      if (child === node) {
        found = node.nodeType === Node.TEXT_NODE ? total + offset : total + prefixLen(node, offset);
        break;
      }
      if (child.nodeType === Node.ELEMENT_NODE && child.contains(node)) {
        total = walk(child, total);
      } else {
        total += nodeTextLen(child);
      }
    }
    return total;
  };
  walk(cell, 0);
  return found >= 0 ? found : null;
}

/**
 * Aktuelle DOM-Selektion in der Zelle -> Raw-Offsets.
 * Nutzt die toRaw-Map aus renderInlineMd(raw) der Zelle.
 */
export function domSelectionToRaw(cell, toRaw) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!cell.contains(range.startContainer) || !cell.contains(range.endContainer)) return null;
  const startVis = renderedOffset(cell, range.startContainer, range.startOffset);
  const endVis = renderedOffset(cell, range.endContainer, range.endOffset);
  if (startVis == null || endVis == null) return null;
  const clamp = (idx) => Math.max(0, Math.min(idx, toRaw.length - 1));
  // Start = Raw-Idx des ersten sichtbaren Zeichens; Ende = Raw-Idx HINTER dem
  // letzten sichtbaren Zeichen (sonst wuerde die Grenze auf evtl. folgende
  // Marker bzw. das naechste Zeichen zeigen).
  const start = toRaw[clamp(startVis)];
  const end = endVis === 0 ? toRaw[0] : toRaw[clamp(endVis - 1)] + 1;
  return { start, end };
}

function locateRenderedPos(cell, pos) {
  let total = 0;
  let result = null;
  const walk = (el) => {
    for (const child of el.childNodes) {
      if (result) return;
      if (child.nodeType === Node.TEXT_NODE) {
        const len = child.nodeValue.length;
        if (pos <= total + len) {
          result = { node: child, offset: pos - total };
          return;
        }
        total += len;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName === 'BR') {
          if (pos === total) {
            const idx = [...el.childNodes].indexOf(child);
            result = { node: el, offset: idx };
            return;
          }
          total += 1;
        } else {
          walk(child);
        }
      }
    }
  };
  walk(cell);
  if (result) return result;
  // Fallback: ans Ende des letzten Textknotens
  const last = cell.lastChild;
  if (last?.nodeType === Node.TEXT_NODE) return { node: last, offset: last.nodeValue.length };
  return { node: cell, offset: cell.childNodes.length };
}

/** Aktuelle DOM-Selektion in der Zelle als sichtbare Offsets. */
export function domSelectionToRendered(cell) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!cell.contains(range.startContainer) || !cell.contains(range.endContainer)) return null;
  const start = renderedOffset(cell, range.startContainer, range.startOffset);
  const end = renderedOffset(cell, range.endContainer, range.endOffset);
  if (start == null || end == null) return null;
  return { start, end };
}

/** Sichtbare Zeichen der Zelle (BR zaehlt als 1). */
export function renderedLength(cell) {
  return cell ? nodeTextLen(cell) : 0;
}

/** Setzt die DOM-Selektion auf sichtbare Offsets (Caret bei start === end). */
export function selectRenderedRange(cell, start, end = start) {
  const a = locateRenderedPos(cell, Math.max(0, start));
  const b = locateRenderedPos(cell, Math.max(0, end));
  const sel = window.getSelection();
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Setzt die DOM-Selektion auf einen Raw-Bereich (via toRendered-Map). */
export function selectRawRange(cell, toRendered, startRaw, endRaw) {
  const startVis = toRendered[Math.max(0, Math.min(startRaw, toRendered.length - 1))];
  const endVis = toRendered[Math.max(0, Math.min(endRaw, toRendered.length - 1))];
  const start = locateRenderedPos(cell, startVis);
  const end = locateRenderedPos(cell, endVis);
  const sel = window.getSelection();
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}
