// auswertungModell.js
// Alles, was der Report für eine Sicht braucht, aus Einheiten und Posts: Ausschnitt nach Ebene
// und Linie, Kennzahlen, Fortschritt, Fakten der Zusammenfassung und offene Einheiten fürs Team.
// Rein, damit Produktions-Tab und Kampagnenseite dasselbe Modell rechnen.

import { AUFSCHLUESSELUNGEN } from './auswertungKonfig.js';
import { berechneKennzahlen, einheitStatus, fortschritt, postsJeEinheit, topPosts } from './auswertungKennzahlen.js';
import { zusammenfassungsFakten } from './auswertungFakten.js';
import { einheitInLinie, verbrauchFuer } from './auswertungEinheiten.js';

function ebeneLabel({ ebene, produktion, linie, linienAnzahl }) {
  if (ebene === 'kampagne') return 'Gesamte Kampagne';
  const name = produktion?.name || 'Produktion';
  if (linie) return `${name} · ${linie.name}`;
  return linienAnzahl > 1 ? `${name} · Alle Linien` : name;
}

/**
 * @param {{ einheiten: object[], posts: object[], verbrauch: object[], produktionen: object[],
 *   zielFuer?: (posts: object[]) => number|null }} basis
 * @param {{ ebene: 'produktion'|'kampagne', produktionId?: string|null, linieId?: string|null }} sicht
 */
export function baueModell(basis, { ebene, produktionId = null, linieId = null }) {
  const kampagne = ebene === 'kampagne';
  const produktion = (basis.produktionen || []).find(p => p.id === produktionId) || null;
  const linien = produktion?.linien || [];
  const linie = !kampagne && linieId ? linien.find(l => l.id === linieId) || null : null;
  const aktiveLinie = linie ? linie.id : null;

  const einheiten = (basis.einheiten || [])
    .filter(e => kampagne || e.produktion?.id === produktionId)
    .filter(e => einheitInLinie(e, aktiveLinie));
  const ids = new Set(einheiten.map(e => e.id));
  const posts = (basis.posts || []).filter(p => ids.has(p.einheitId));
  const einheitenById = new Map(einheiten.map(e => [e.id, e]));

  const verbrauch = verbrauchFuer(basis.verbrauch, {
    produktionIds: kampagne ? null : [produktionId],
    linieId: aktiveLinie
  });
  const kennzahlen = berechneKennzahlen(posts, { verbrauch, zielAufrufe: basis.zielFuer?.(posts) ?? null });

  const jeEinheit = postsJeEinheit(posts);
  const status = (e) => einheitStatus(e, jeEinheit.get(e.id) || []);
  const fehlend = einheiten.filter(e => status(e) === 'fehlt');
  const optional = einheiten.filter(e => status(e) === 'optional');
  const pruefen = posts.filter(p => p.status !== 'confirmed');

  const mitLinien = !kampagne && !aktiveLinie && linien.length > 1;
  const aufschluesselungen = AUFSCHLUESSELUNGEN.filter(a => (!a.nurMitLinien || mitLinien) && (!a.nurKampagne || kampagne));

  return {
    ebene,
    kampagne,
    produktion,
    linie,
    titel: ebeneLabel({ ebene, produktion, linie, linienAnzahl: linien.length }),
    einheiten,
    einheitenById,
    posts,
    kennzahlen,
    fortschritt: fortschritt(einheiten, posts),
    fakten: zusammenfassungsFakten(posts, einheitenById),
    top: topPosts(posts),
    fehlend,
    optional,
    pruefen,
    aufschluesselungen
  };
}
