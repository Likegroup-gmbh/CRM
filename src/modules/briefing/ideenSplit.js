// ideenSplit.js
// Zerlegt einen Freitext mit mehreren Punkten (Umsetzungsideen) in einzelne
// Eintraege. Rein deterministisch, Fallback fuer alte String-Werte und fuer
// Extract-Antworten, die trotz Array-Vorgabe einen Klumpen liefern.
// Was nur ein Modell trennen kann (Komma-Aufzaehlung im Fliesstext), bleibt
// absichtlich ein Eintrag: lieber ein Klumpen als eine zerschnittene Idee.

// Aufzaehlungszeichen oder Nummerierung am Zeilenanfang: "- ", "• ", "* ",
// "1. ", "1) ", "(1) ". Das Leerzeichen danach ist Pflicht ("1.5 Mio" ist keine Liste).
const LIST_MARKER = /^\s*(?:[-•*–—]|\d{1,2}[.)]|\(\d{1,2}\))\s+/;
const INLINE_MARKER = /\((\d{1,2})\)\s*/g;

function istUeberschrift(line) {
  return /:\s*$/.test(line.trim());
}

function bereinigen(text) {
  return String(text || '').replace(LIST_MARKER, '').replace(/\s+/g, ' ').trim();
}

// "Stories: (1) A. (2) B. (3) C." -> ["A.", "B.", "C."]. Nur wenn die Nummern
// bei 1 beginnen und lueckenlos hochzaehlen, sonst ist es normaler Text.
function inlineNummeriert(line) {
  const treffer = [...line.matchAll(INLINE_MARKER)];
  if (treffer.length < 2) return null;
  const nummern = treffer.map((m) => Number(m[1]));
  if (!nummern.every((n, i) => n === i + 1)) return null;

  const eintraege = [];
  const kopf = line.slice(0, treffer[0].index).trim();
  if (kopf && !istUeberschrift(kopf)) eintraege.push(kopf);
  treffer.forEach((m, i) => {
    const start = m.index + m[0].length;
    const ende = i + 1 < treffer.length ? treffer[i + 1].index : line.length;
    eintraege.push(line.slice(start, ende));
  });
  return eintraege.map(bereinigen).filter(Boolean);
}

function mitMarkern(zeilen) {
  const eintraege = [];
  let aktuell = null;
  for (const zeile of zeilen) {
    if (!zeile.trim()) {
      aktuell = null;
      continue;
    }
    if (LIST_MARKER.test(zeile)) {
      aktuell = [bereinigen(zeile)];
      eintraege.push(aktuell);
    } else if (aktuell) {
      aktuell.push(zeile.trim());
    } else if (!istUeberschrift(zeile) || eintraege.length) {
      // Ueberschrift vor der ersten Aufzaehlung ("UGC-Ideen:") ist kein Eintrag
      aktuell = [zeile.trim()];
      eintraege.push(aktuell);
    }
  }
  return eintraege.map((teile) => teile.join(' ').trim()).filter(Boolean);
}

function ohneMarker(text) {
  const absaetze = text.split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean);
  if (absaetze.length > 1) {
    return absaetze.map((a) => a.split('\n').map((z) => z.trim()).filter(Boolean).join(' '));
  }
  return text.split('\n').map((z) => z.trim()).filter(Boolean);
}

/**
 * @param {string} text
 * @returns {string[]} einzelne Eintraege, leere fallen raus
 */
export function splitIdeen(text) {
  const s = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!s) return [];

  const zeilen = s.split('\n');
  if (zeilen.some((z) => LIST_MARKER.test(z))) return mitMarkern(zeilen);

  if (zeilen.length === 1) {
    const inline = inlineNummeriert(s);
    return inline || [bereinigen(s)];
  }
  return ohneMarker(s).flatMap((eintrag) => inlineNummeriert(eintrag) || [bereinigen(eintrag)]).filter(Boolean);
}

/**
 * Wert eines Listenfelds auf ein String-Array bringen: String wird gesplittet,
 * jedes Array-Element nochmal (ein Element darf selbst ein Klumpen sein).
 * @param {unknown} value
 * @returns {string[]}
 */
export function ideenListe(value) {
  const items = Array.isArray(value) ? value : [value];
  return items
    .filter((v) => typeof v === 'string')
    .flatMap(splitIdeen);
}
