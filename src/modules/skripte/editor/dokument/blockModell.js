// blockModell.js
// Skript-Dokument (ADR 0062): Block-Liste um die Skript-Tabelle. Reine
// Funktionen ohne DOM; jede Operation liefert eine neue Liste. Die
// Skript-Tabelle steht genau einmal darin und laesst sich nicht loeschen.

export const SKRIPT_TABELLE = 'skript_tabelle';
export const SKRIPT_TABELLE_ID = 'skript-tabelle';
export const TEXT_TYPEN = ['absatz', 'h1', 'h2'];
export const LISTEN_TYPEN = ['liste', 'nummerierung'];
export const BLOCK_TYPEN = [SKRIPT_TABELLE, ...TEXT_TYPEN, ...LISTEN_TYPEN, 'bild', 'tabelle', 'trennlinie'];
export const BILD_BREITEN = ['klein', 'mittel', 'voll'];
export const TABELLE_MAX = 12;

export function neueBlockId() {
  const uuid = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `b_${uuid}`;
}

function str(value) {
  return typeof value === 'string' ? value : '';
}

function ganzzahl(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function istTextBlock(block) {
  return TEXT_TYPEN.includes(block?.typ);
}

export function istListenBlock(block) {
  return LISTEN_TYPEN.includes(block?.typ);
}

function leereTabelle(zeilen, spalten) {
  const z = Math.min(TABELLE_MAX, Math.max(1, Math.round(zeilen) || 1));
  const s = Math.min(TABELLE_MAX, Math.max(1, Math.round(spalten) || 1));
  return Array.from({ length: z }, () => Array.from({ length: s }, () => ''));
}

/** Neuer Block mit sinnvollen Defaults; `felder` ueberschreibt sie. */
export function neuerBlock(typ, felder = {}) {
  const id = neueBlockId();
  if (TEXT_TYPEN.includes(typ)) return { id, typ, md: '', intern: false, ...felder };
  if (LISTEN_TYPEN.includes(typ)) return { id, typ, punkte: [''], intern: false, ...felder };
  if (typ === 'bild') return { id, typ, pfad: '', breite: 'mittel', unterschrift: '', intern: false, ...felder };
  if (typ === 'tabelle') {
    const { zeilen = 2, spalten = 2, ...rest } = felder;
    return { id, typ, zeilen: leereTabelle(zeilen, spalten), kopfzeile: true, intern: false, ...rest };
  }
  if (typ === 'trennlinie') return { id, typ, intern: false, ...felder };
  throw new Error(`Unbekannter Blocktyp: ${typ}`);
}

function normalisiereBlock(raw) {
  if (!raw || typeof raw !== 'object' || !BLOCK_TYPEN.includes(raw.typ)) return null;
  const id = str(raw.id) || neueBlockId();
  const { typ } = raw;
  if (typ === SKRIPT_TABELLE) return { id: SKRIPT_TABELLE_ID, typ };
  const intern = raw.intern === true;
  if (TEXT_TYPEN.includes(typ)) return { id, typ, md: str(raw.md), intern };
  if (LISTEN_TYPEN.includes(typ)) {
    const punkte = Array.isArray(raw.punkte) ? raw.punkte.map(str) : [];
    return { id, typ, punkte: punkte.length ? punkte : [''], intern };
  }
  if (typ === 'bild') {
    const pfad = str(raw.pfad);
    if (!pfad) return null;
    const block = {
      id, typ, pfad,
      breite: BILD_BREITEN.includes(raw.breite) ? raw.breite : 'mittel',
      unterschrift: str(raw.unterschrift),
      intern
    };
    const breitePx = ganzzahl(raw.breite_px);
    const hoehePx = ganzzahl(raw.hoehe_px);
    if (breitePx && hoehePx) Object.assign(block, { breite_px: breitePx, hoehe_px: hoehePx });
    return block;
  }
  if (typ === 'tabelle') {
    const zeilen = (Array.isArray(raw.zeilen) ? raw.zeilen : [])
      .filter(Array.isArray)
      .slice(0, TABELLE_MAX)
      .map((zeile) => zeile.slice(0, TABELLE_MAX).map(str));
    const spalten = Math.max(1, ...zeilen.map((z) => z.length));
    const rechteckig = zeilen.length
      ? zeilen.map((z) => [...z, ...Array(spalten - z.length).fill('')])
      : leereTabelle(1, 1);
    return { id, typ, zeilen: rechteckig, kopfzeile: raw.kopfzeile === true, intern };
  }
  return { id, typ, intern };
}

/**
 * Gespeicherten Stand in eine gueltige Liste bringen: unbekannte Bloecke
 * fallen weg, doppelte IDs bekommen neue, die Skript-Tabelle steht genau
 * einmal darin (fehlt sie, kommt sie an den Anfang). null = nur die Tabelle.
 */
export function normalisiereBloecke(raw) {
  const out = [];
  const ids = new Set();
  let tabelle = false;
  for (const eintrag of Array.isArray(raw) ? raw : []) {
    const block = normalisiereBlock(eintrag);
    if (!block) continue;
    if (block.typ === SKRIPT_TABELLE) {
      if (tabelle) continue;
      tabelle = true;
    } else if (ids.has(block.id)) {
      block.id = neueBlockId();
    }
    ids.add(block.id);
    out.push(block);
  }
  if (!tabelle) out.unshift({ id: SKRIPT_TABELLE_ID, typ: SKRIPT_TABELLE });
  return out;
}

export function hatFreieBloecke(bloecke) {
  return (bloecke || []).some((b) => b.typ !== SKRIPT_TABELLE);
}

/** Speicherform: nur die Tabelle allein ist null (Anzeige wie vor dem Dokument). */
export function fuerSpeichern(bloecke) {
  const liste = normalisiereBloecke(bloecke);
  return hatFreieBloecke(liste) ? liste : null;
}

/** Fuer Kunde, Gast, Creator und PDF: ohne interne Bloecke. */
export function sichtbareBloecke(bloecke, { mitIntern = false } = {}) {
  const liste = normalisiereBloecke(bloecke);
  return mitIntern ? liste : liste.filter((b) => !b.intern);
}

/**
 * Fuer PDF und Skript-Paket: sichtbare Bloecke, Bilder mit aufgeloester URL.
 * null = keine Freien Bloecke (PDF wie vor dem Dokument).
 */
export function pdfBloecke(bloecke, bildUrl = (pfad) => pfad) {
  const liste = sichtbareBloecke(bloecke);
  if (!hatFreieBloecke(liste)) return null;
  return liste.map((b) => (b.typ === 'bild' ? { ...b, url: bildUrl(b.pfad) || '' } : b));
}

export function indexVon(bloecke, id) {
  return (bloecke || []).findIndex((b) => b.id === id);
}

export function findeBlock(bloecke, id) {
  return (bloecke || []).find((b) => b.id === id) || null;
}

/** Einfuegen hinter `nachId`, vor `vorId` oder (ohne beides) ans Ende. */
export function einfuegen(bloecke, neue, { nachId = null, vorId = null } = {}) {
  const liste = [...(bloecke || [])];
  const dazu = (Array.isArray(neue) ? neue : [neue]).filter((b) => b && b.typ !== SKRIPT_TABELLE);
  let ziel = liste.length;
  if (nachId) {
    const i = indexVon(liste, nachId);
    if (i >= 0) ziel = i + 1;
  } else if (vorId) {
    const i = indexVon(liste, vorId);
    if (i >= 0) ziel = i;
  }
  liste.splice(ziel, 0, ...dazu);
  return liste;
}

export function entfernen(bloecke, id) {
  return (bloecke || []).filter((b) => b.id !== id || b.typ === SKRIPT_TABELLE);
}

export function verschieben(bloecke, id, richtung) {
  const liste = [...(bloecke || [])];
  const i = indexVon(liste, id);
  const ziel = i + (richtung < 0 ? -1 : 1);
  if (i < 0 || ziel < 0 || ziel >= liste.length) return liste;
  [liste[i], liste[ziel]] = [liste[ziel], liste[i]];
  return liste;
}

/** Block `id` vor oder hinter `zielId` setzen (Drag and drop). */
export function verschiebenZu(bloecke, id, zielId, position = 'vor') {
  if (id === zielId) return [...(bloecke || [])];
  const block = findeBlock(bloecke, id);
  if (!block || !findeBlock(bloecke, zielId)) return [...(bloecke || [])];
  const ohne = (bloecke || []).filter((b) => b.id !== id);
  const i = indexVon(ohne, zielId);
  ohne.splice(position === 'nach' ? i + 1 : i, 0, block);
  return ohne;
}

export function aendern(bloecke, id, patch) {
  return (bloecke || []).map((b) => (b.id === id && b.typ !== SKRIPT_TABELLE ? { ...b, ...patch } : b));
}

function blockText(block) {
  if (istTextBlock(block)) return block.md || '';
  if (istListenBlock(block)) return (block.punkte || []).join('\n');
  return '';
}

/** Text- und Listenbloecke ineinander umwandeln; Zeilen werden Listenpunkte. */
export function typWechseln(block, typ) {
  if (!block || block.typ === typ) return block;
  const text = blockText(block);
  if (TEXT_TYPEN.includes(typ) && (istTextBlock(block) || istListenBlock(block))) {
    const { punkte, ...rest } = block;
    return { ...rest, typ, md: text };
  }
  if (LISTEN_TYPEN.includes(typ) && (istTextBlock(block) || istListenBlock(block))) {
    const { md, ...rest } = block;
    const punkte = text.split('\n');
    return { ...rest, typ, punkte: punkte.length ? punkte : [''] };
  }
  return block;
}

export function tabelleZeileEinfuegen(block, nachIndex) {
  if (block?.typ !== 'tabelle' || block.zeilen.length >= TABELLE_MAX) return block;
  const zeilen = block.zeilen.map((z) => [...z]);
  zeilen.splice(nachIndex + 1, 0, Array(zeilen[0]?.length || 1).fill(''));
  return { ...block, zeilen };
}

export function tabelleZeileEntfernen(block, index) {
  if (block?.typ !== 'tabelle' || block.zeilen.length <= 1) return block;
  return { ...block, zeilen: block.zeilen.filter((_, i) => i !== index) };
}

export function tabelleSpalteEinfuegen(block, nachIndex) {
  if (block?.typ !== 'tabelle' || (block.zeilen[0]?.length || 0) >= TABELLE_MAX) return block;
  const zeilen = block.zeilen.map((z) => {
    const neu = [...z];
    neu.splice(nachIndex + 1, 0, '');
    return neu;
  });
  return { ...block, zeilen };
}

export function tabelleSpalteEntfernen(block, index) {
  if (block?.typ !== 'tabelle' || (block.zeilen[0]?.length || 0) <= 1) return block;
  return { ...block, zeilen: block.zeilen.map((z) => z.filter((_, i) => i !== index)) };
}

/** Kopie (Duplizieren): ohne Skript-Tabelle, mit neuen IDs. */
export function kopieMitNeuenIds(bloecke) {
  return normalisiereBloecke(bloecke)
    .filter((b) => b.typ !== SKRIPT_TABELLE)
    .map((b) => ({ ...JSON.parse(JSON.stringify(b)), id: neueBlockId() }));
}
