// Ordnet gelesene Dokumentteile den Zellen der Skript-Tabelle zu.
// Die erste Tabelle mit Hook, Hauptteil oder CTA gewinnt. Alles andere
// wird darunter zu Freien Bloecken, in der Reihenfolge der Datei.

const ZEILE = new Map([
  ['hook', 'hook'],
  ['hauptteil', 'hauptteil'],
  ['cta', 'cta'],
  ['text-hook', 'text_hook'],
  ['text hook', 'text_hook'],
  ['texthook', 'text_hook'],
  ['rezept', 'rezept'],
  ['caption', 'caption'],
  ['hook 1', 'hook_variante_1'],
  ['hook 2', 'hook_variante_2'],
  ['hook 3', 'hook_variante_3']
]);

const SPALTE = new Map([
  ['was gesagt wird', 'gesagt'],
  ['was zu sehen ist', 'gesehen']
]);

const SKRIPT_ZEILE = new Set(['hook', 'hauptteil', 'cta']);
const TABELLE_MAX = 12;

export const LEERE_ZELLEN = {
  hook: null,
  hauptteil: null,
  cta: null,
  hook_visuell: null,
  hauptteil_visuell: null,
  cta_visuell: null,
  text_hook: null,
  rezept: null,
  caption: null,
  hook_variante_1: null,
  hook_variante_2: null,
  hook_variante_3: null
};

const VISUELL = { hook: 'hook_visuell', hauptteil: 'hauptteil_visuell', cta: 'cta_visuell' };

export function beschriftung(text) {
  return String(text || '')
    .replace(/\*+/g, '')
    .replace(/[:.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function istSkriptTabelle(zeilen) {
  return zeilen.some((zeile) => SKRIPT_ZEILE.has(beschriftung(zeile[0])));
}

function hatKopf(zeilen) {
  if (!zeilen.length) return false;
  const kopf = zeilen[0].slice(1).map(beschriftung);
  return kopf.some((zelle) => SPALTE.has(zelle));
}

function spaltenArt(kopf) {
  const arten = kopf.map((zelle) => SPALTE.get(beschriftung(zelle)) || null);
  if (!arten.some(Boolean)) {
    return kopf.map((_, i) => (i === 0 ? 'gesagt' : i === 1 ? 'gesehen' : null));
  }
  return arten;
}

function setze(zellen, belegt, feld, text) {
  const wert = String(text || '').trim();
  if (!wert || belegt.has(feld)) return false;
  zellen[feld] = wert;
  belegt.add(feld);
  return true;
}

function zeileZuordnen(zellen, belegt, label, werte, arten) {
  const feld = ZEILE.get(label);
  if (!feld) return false;
  let getroffen = false;
  arten.forEach((art, i) => {
    if (!art) return;
    const ziel = feld === 'hook' || feld === 'hauptteil' || feld === 'cta'
      ? (art === 'gesehen' ? VISUELL[feld] : feld)
      : feld;
    if (art === 'gesehen' && !VISUELL[feld] && feld.startsWith('hook_variante')) return;
    if (setze(zellen, belegt, ziel, werte[i])) getroffen = true;
  });
  return getroffen;
}

function rechteck(rows) {
  const spalten = Math.min(TABELLE_MAX, Math.max(...rows.map((r) => r.length), 1));
  return rows.map((r) => [...r.slice(0, spalten), ...Array(Math.max(0, spalten - r.length)).fill('')]);
}

function tabelleBloecke(zeilen) {
  const kopf = hatKopf(zeilen);
  const kopfzeile = kopf ? zeilen[0].slice(0, TABELLE_MAX) : null;
  const daten = (kopf ? zeilen.slice(1) : zeilen).map((zeile) => zeile.slice(0, TABELLE_MAX));
  const schritt = kopfzeile ? TABELLE_MAX - 1 : TABELLE_MAX;
  if (!daten.length) return kopfzeile ? [{ typ: 'tabelle', kopfzeile: true, zeilen: rechteck([kopfzeile]) }] : [];
  const scheiben = [];
  for (let i = 0; i < daten.length; i += schritt) {
    const rows = kopfzeile ? [kopfzeile, ...daten.slice(i, i + schritt)] : daten.slice(i, i + schritt);
    scheiben.push({ typ: 'tabelle', kopfzeile: Boolean(kopfzeile), zeilen: rechteck(rows) });
  }
  return scheiben;
}

function restAusTabelle(zeilen, zellen, belegt, ersteSkript) {
  const kopf = hatKopf(zeilen);
  const daten = kopf ? zeilen.slice(1) : zeilen;
  const arten = spaltenArt(kopf ? zeilen[0].slice(1) : []);
  const spalten = arten.some(Boolean) ? arten : ['gesagt', 'gesehen'];
  const uebrig = [];
  for (const zeile of daten) {
    const label = beschriftung(zeile[0]);
    if (!ersteSkript && SKRIPT_ZEILE.has(label)) {
      uebrig.push(zeile);
      continue;
    }
    const zugeordnet = zeileZuordnen(zellen, belegt, label, zeile.slice(1), spalten);
    if (!zugeordnet) uebrig.push(zeile);
  }
  if (!uebrig.length) return [];
  return tabelleBloecke(kopf ? [zeilen[0], ...uebrig] : uebrig);
}

/**
 * @param {Array} teile Absaetze, Ueberschriften, Listen, Bilder, Tabellen
 * @returns {{ zellen: object, bloecke: Array }}
 */
export function ordneSkriptInhalt(teile) {
  const zellen = { ...LEERE_ZELLEN };
  const belegt = new Set();
  const bloecke = [];
  let skriptVergeben = false;

  for (const teil of teile || []) {
    if (teil?.typ === 'tabelle') {
      const zeilen = (teil.zeilen || []).map((z) => (Array.isArray(z) ? z.map((c) => String(c ?? '')) : []));
      const erste = !skriptVergeben && istSkriptTabelle(zeilen);
      if (erste) skriptVergeben = true;
      bloecke.push(...restAusTabelle(zeilen, zellen, belegt, erste));
      for (const bild of teil.bilder || []) bloecke.push({ typ: 'bild', blob: bild.blob || bild });
      continue;
    }
    if (teil?.typ === 'bild') {
      bloecke.push({ typ: 'bild', blob: teil.blob });
      continue;
    }
    if (teil?.typ === 'liste' || teil?.typ === 'nummerierung') {
      const punkte = (teil.punkte || []).map((p) => String(p || '').trim()).filter(Boolean);
      if (punkte.length) bloecke.push({ typ: teil.typ, punkte });
      continue;
    }
    if (teil?.typ === 'h1' || teil?.typ === 'h2' || teil?.typ === 'absatz') {
      const md = String(teil.md || '').trim();
      if (md) bloecke.push({ typ: teil.typ, md });
    }
  }

  return { zellen, bloecke };
}
