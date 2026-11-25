// leererCastingEintrag.js
// Payload für einen neuen, leeren Casting-Eintrag. Gemeinsame Quelle für
// die Start-Zeile und den Quick-Add der Leiste.

const LEER = {
  typ: null,
  name: null,
  link_instagram: null,
  follower_instagram: null,
  link_tiktok: null,
  follower_tiktok: null,
  absage: false,
  kategorie: null,
  wohnort: null,
  notiz: null,
  pricing: null,
  preis_ek: null,
  preis_vk: null,
  reichweite_story: null,
  preis_story: null,
  preis_reels: null,
  reichweite_garantie: null,
  creator_id: null
};

/**
 * @param {string} listeId
 * @param {number} sortierung
 * @param {Object} [overrides] z. B. { link_instagram }
 */
export function leererCastingEintrag(listeId, sortierung = 0, overrides = {}) {
  return { creator_auswahl_id: listeId, ...LEER, sortierung, ...overrides };
}
