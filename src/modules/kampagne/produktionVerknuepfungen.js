// Produkt- und Briefing-Verknüpfungen einer Produktion für die Produktionen-Tabelle
// der Kampagne. Als Pill-Links (Entity-Icon), wie in der globalen Produktionsliste.

import { renderVerknuepfungen } from '../../core/ui/tableVerknuepfungen.js';

/** Produkte aller Linien, dedupliziert; Fallback ist das Produkt der Produktion selbst. */
export function produktLinksVonProduktion(produktion) {
  const seen = new Set();
  const links = [];
  const add = (produkt) => {
    if (!produkt?.id || !produkt.name || seen.has(produkt.id)) return;
    seen.add(produkt.id);
    links.push({ id: produkt.id, label: produkt.name, kind: 'produkt' });
  };
  for (const linie of produktion?.linien || []) {
    for (const row of linie?.briefing?.produkte || []) add(row?.produkt);
  }
  if (!links.length) add(produktion?.produkt);
  return links;
}

export function briefingLinksVonProduktion(produktion) {
  return (produktion?.linien || [])
    .filter((linie) => linie?.id && linie.name)
    .map((linie) => ({
      id: linie.id,
      label: `${linie.name}${linie.is_draft ? ' (Entwurf)' : ''}`,
      kind: 'briefing'
    }));
}

export function renderProduktZelle(produktion) {
  return renderVerknuepfungen(produktLinksVonProduktion(produktion));
}

export function renderBriefingZelle(produktion) {
  return renderVerknuepfungen(briefingLinksVonProduktion(produktion));
}
