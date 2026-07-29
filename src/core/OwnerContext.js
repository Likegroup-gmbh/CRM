// OwnerContext.js
// Personas und Produkte gehoeren dem Unternehmen, koennen aber aus einer Marke
// heraus angelegt werden. Beide Formulare haengen deshalb an zwei Routen:
//   /marke/:markeId/<entity>
//   /unternehmen/:unternehmenId/<entity>
//
// Diese Datei loest die Route-ID in einen einheitlichen Kontext auf. markeId ist
// nur im Marke-Kontext gesetzt und steuert dort Filter und Marken-Zuordnung.

/**
 * @typedef {Object} OwnerContext
 * @property {'marke'|'unternehmen'} typ
 * @property {string|null} markeId       - nur im Marke-Kontext
 * @property {string|null} unternehmenId - immer gesetzt, ausser die Marke hat keins
 * @property {Object} owner              - der geladene Datensatz
 * @property {string} basePath           - Detailseite des Besitzers
 * @property {string} listPath           - Listenseite fuer den Breadcrumb
 * @property {string} listLabel
 * @property {string} ownerLabel
 * @property {number} markenAnzahl - Marken des Unternehmens, 0 = kein Marken-Feld noetig
 */

/** Ableitung aus dem ersten Pfadsegment: /marke/... oder /unternehmen/... */
export function ownerTypeFromLocation() {
  return window.location.pathname.split('/').filter(Boolean)[0] === 'unternehmen'
    ? 'unternehmen'
    : 'marke';
}

/**
 * @param {string} ownerId - Route-ID, je nach Segment Marke oder Unternehmen
 * @param {'marke'|'unternehmen'} [typ] - sonst aus der URL abgeleitet
 * @returns {Promise<OwnerContext>}
 */
export async function resolveOwnerContext(ownerId, typ = ownerTypeFromLocation()) {
  if (typ === 'unternehmen') {
    const { data, error } = await window.supabase
      .from('unternehmen')
      .select('id, firmenname')
      .eq('id', ownerId)
      .single();
    if (error) throw error;

    return {
      typ,
      markeId: null,
      unternehmenId: data.id,
      owner: data,
      basePath: `/unternehmen/${data.id}`,
      listPath: '/unternehmen',
      listLabel: 'Unternehmen',
      ownerLabel: data.firmenname || 'Unternehmen',
      markenAnzahl: await countMarken(data.id)
    };
  }

  const { data, error } = await window.supabase
    .from('marke')
    .select('id, markenname, unternehmen_id')
    .eq('id', ownerId)
    .single();
  if (error) throw error;

  return {
    typ: 'marke',
    markeId: data.id,
    unternehmenId: data.unternehmen_id || null,
    owner: data,
    basePath: `/marke/${data.id}`,
    listPath: '/marke',
    listLabel: 'Marken',
    ownerLabel: data.markenname || 'Marke',
    markenAnzahl: 1
  };
}

/** Ohne Marken ist das Marken-Multiselect im Formular nur ein leeres Feld. */
async function countMarken(unternehmenId) {
  const { count, error } = await window.supabase
    .from('marke')
    .select('id', { count: 'exact', head: true })
    .eq('unternehmen_id', unternehmenId);

  if (error) {
    console.warn('⚠️ Marken-Anzahl konnte nicht ermittelt werden:', error.message);
    return 0;
  }
  return count || 0;
}
