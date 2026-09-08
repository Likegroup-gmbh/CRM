// PersonaFolders.js
// Reine Aggregation für die Grid-Hierarchie Unternehmen → Marke → Personas.

import { NUR_UNTERNEHMEN_LABEL, OHNE_QUERY } from '../../core/folderListNav.js';

// Konstanten liegen im Core-Helper, Re-Export fuer bestehende Imports.
export { NUR_UNTERNEHMEN_LABEL, OHNE_QUERY };

export function personaMarken(persona) {
  return (persona?.marken || [])
    .map((row) => ({
      id: row?.marke?.id || row?.marke_id || null,
      markenname: row?.marke?.markenname || '',
      logo_url: row?.marke?.logo_url || null
    }))
    .filter((marke) => marke.id);
}

export function buildCompanyFolders(personas = []) {
  const map = new Map();

  personas.forEach((item) => {
    const id = item.unternehmen?.id || item.unternehmen_id;
    if (!id) return;
    if (!map.has(id)) {
      map.set(id, {
        id,
        firmenname: item.unternehmen?.firmenname || '',
        logo_url: item.unternehmen?.logo_url || null,
        count: 0
      });
    }
    map.get(id).count += 1;
  });

  return Array.from(map.values()).sort((a, b) =>
    (a.firmenname || '').localeCompare(b.firmenname || '', 'de')
  );
}

export function buildBrandFolders(personas = [], unternehmenId) {
  const scoped = personas.filter((item) =>
    (item.unternehmen_id || item.unternehmen?.id) === unternehmenId
  );

  const brandMap = new Map();
  let unbrandedCount = 0;

  scoped.forEach((item) => {
    const marken = personaMarken(item);
    if (!marken.length) {
      unbrandedCount += 1;
      return;
    }
    marken.forEach((marke) => {
      if (!brandMap.has(marke.id)) {
        brandMap.set(marke.id, {
          id: marke.id,
          markenname: marke.markenname,
          logo_url: marke.logo_url,
          count: 0,
          virtual: false
        });
      }
      brandMap.get(marke.id).count += 1;
    });
  });

  const folders = Array.from(brandMap.values()).sort((a, b) =>
    (a.markenname || '').localeCompare(b.markenname || '', 'de')
  );

  if (unbrandedCount > 0) {
    folders.push({
      id: null,
      markenname: NUR_UNTERNEHMEN_LABEL,
      logo_url: null,
      count: unbrandedCount,
      virtual: true
    });
  }

  return folders;
}

export function buildCurrentItems(personas = [], { unternehmenId, markeId, ohneMarke = false } = {}) {
  return personas.filter((item) => {
    if ((item.unternehmen_id || item.unternehmen?.id) !== unternehmenId) return false;
    const marken = personaMarken(item);
    if (ohneMarke) return marken.length === 0;
    return marken.some((marke) => marke.id === markeId);
  });
}
