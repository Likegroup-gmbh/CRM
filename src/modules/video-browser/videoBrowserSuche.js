// videoBrowserSuche.js
// Textsuche im Videos-Tab (CONTEXT.md "Suche (Videos-Tab)"): eine Eingabe für Showcase, Ordner und Kalender.
// Jedes Wort muss vorkommen (UND), Groß- und Kleinschreibung und Akzente zählen nicht, eine reine Zahl
// nur als ganze Zahl ("Video 2" trifft nicht "Video 12"). Kein DOM.

import { tagsOf } from './videoBrowserRenderTags.js';

export function sucheNormal(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sucheBegriffe(query) {
  const text = sucheNormal(query);
  return text ? text.split(' ') : [];
}

export const sucheAktiv = (query) => sucheBegriffe(query).length > 0;

const ZAHL = /^\d+$/;

/** Kommt jeder Begriff im (normalisierten) Text vor? Ohne Begriffe trifft alles. */
export function trifft(text, begriffe) {
  if (!begriffe?.length) return true;
  return begriffe.every(b => (ZAHL.test(b) ? new RegExp(`(^|\\D)${b}(\\D|$)`).test(text) : text.includes(b)));
}

const text = (...teile) => sucheNormal(teile.flat().filter(Boolean).join(' '));
const tagLabels = (item, catalog) => tagsOf(item, catalog).map(t => t.label);

/** Kooperation: Creator, Handle, Kooperationsname, Linie, Produkte, Tags aus dem Kooperationsformular. */
export const koopText = (koop) => text(koop?.name, koop?.handle, koop?.kooperationName, koop?.linieName, koop?.produkte || [], (koop?.tags || []).map(t => t.label));

/** Kooperationsvideo: Nr. und Titel, dazu Namen und Tags seiner Dateien (ohne Rohmaterial). */
export function rowText(row, catalog) {
  const items = (row?.folders || []).filter(f => f.kind !== 'raw').flatMap(f => f.items);
  return text(row?.label, row?.title, items.map(i => i.name), items.flatMap(i => tagLabels(i, catalog)));
}

/** Kachel im Showcase: Kooperation, Video und die Datei selbst. */
export const kachelText = ({ koop, row, item }, catalog) => text(koopText(koop), row?.label, row?.title, item?.name, tagLabels(item, catalog));

/** Treffer je Eintrag der Anzeigeliste des Showcase (gleiche Reihenfolge). */
export function showcaseTreffer(list, query, catalog) {
  const begriffe = sucheBegriffe(query);
  return (list || []).map(entry => trifft(kachelText(entry, catalog), begriffe));
}

/**
 * Treffer im Spaltenbrowser: Kooperations-Id -> Videos, die Spalte 1 zeigt (`null` = alle, weil die
 * Kooperation selbst trifft). Ohne Begriffe `null`: nichts ist gefiltert.
 * @returns {Map<string, Set<string>|null>|null}
 */
export function ordnerTreffer(tree, query, catalog) {
  const begriffe = sucheBegriffe(query);
  if (!begriffe.length) return null;
  const out = new Map();
  for (const koop of tree?.kooperationen || []) {
    const k = koopText(koop);
    if (trifft(k, begriffe)) {
      out.set(koop.id, null);
      continue;
    }
    const rows = (koop.rows || []).filter(r => trifft(`${k} ${rowText(r, catalog)}`, begriffe));
    if (rows.length) out.set(koop.id, new Set(rows.map(r => r.id)));
  }
  return out;
}
