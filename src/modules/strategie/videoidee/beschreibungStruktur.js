// ESM-Reexport: Generator (CJS) und Drawer teilen dieselbe Struktur-Logik.
// Vite Dev liefert CJS nur als default, Named Re-Export aus der Datei knallt.
import struktur from '../../../../netlify/functions/_shared/beschreibung-struktur.js';
import { isVideoideeVorschlag } from '../videoideeVorschlag.js';

export const BESCHREIBUNG_FELDER = struktur.BESCHREIBUNG_FELDER;
export const normalisiereStruktur = struktur.normalisiereStruktur;
export const parseStruktur = struktur.parseStruktur;
export const parseFliesstext = struktur.parseFliesstext;
export const strukturZuText = struktur.strukturZuText;

/**
 * Struktur einer Videoidee (Videoreferenz und Idee), nie am Vorschlag.
 * Ohne gespeicherte Struktur wird der Fliesstext des Altbestands gelesen (nur Anzeige;
 * gespeichert wird erst, wenn jemand eine Zeile aendert oder neu analysiert).
 */
export function beschreibungStrukturVon(item) {
  if (!item || isVideoideeVorschlag(item)) return null;
  return struktur.normalisiereStruktur(item.beschreibung_struktur)
    || struktur.parseFliesstext(item.beschreibung);
}
