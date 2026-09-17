// produktHint.js
// Claude sieht Produktnamen, kopiert IDs aber unzuverlaessig oder gar nicht
// (der Prompt hat die UUIDs zeitweise weggelassen). resolveProduktHints
// mappt PDF-Namen auf den Katalog des Unternehmens.

export function normalizeProduktName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueHit(hits) {
  return hits.length === 1 ? hits[0] : null;
}

/**
 * @param {Array<{ name?: string, produkt_id?: string|null }>} hints
 * @param {Array<{ id: string, name?: string }>} katalog
 * @returns {Array<{ name: string, produkt_id: string|null }>}
 */
export function resolveProduktHints(hints, katalog = []) {
  const list = Array.isArray(katalog) ? katalog.filter((p) => p?.id) : [];
  const byId = new Map(list.map((p) => [String(p.id), p]));

  return (hints || []).map((hint) => {
    const name = String(hint?.name || '').trim();
    const given = hint?.produkt_id ? String(hint.produkt_id).trim() : '';
    if (given && (!list.length || byId.has(given))) {
      return { name, produkt_id: given };
    }

    const key = normalizeProduktName(name);
    if (!key) return { name, produkt_id: null };

    const exact = uniqueHit(list.filter((p) => normalizeProduktName(p.name) === key));
    if (exact) return { name, produkt_id: exact.id };

    const contained = uniqueHit(list.filter((p) => {
      const k = normalizeProduktName(p.name);
      return k && (key.includes(k) || k.includes(key));
    }));
    if (contained) return { name, produkt_id: contained.id };

    return { name, produkt_id: null };
  });
}
