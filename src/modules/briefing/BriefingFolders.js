// BriefingFolders.js
// Reine Aggregation für die Grid-Hierarchie Unternehmen → Marke → Briefings.

export const OHNE_MARKE_LABEL = 'Ohne Marke';
export const OHNE_QUERY = 'ohne';

export function buildCompanyFolders(briefings = []) {
  const map = new Map();

  briefings.forEach((item) => {
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

export function buildBrandFolders(briefings = [], unternehmenId) {
  const scoped = briefings.filter((item) =>
    (item.unternehmen_id || item.unternehmen?.id) === unternehmenId
  );

  const brandMap = new Map();
  let unbrandedCount = 0;

  scoped.forEach((item) => {
    const markeId = item.marke?.id || item.marke_id;
    if (!markeId) {
      unbrandedCount += 1;
      return;
    }
    if (!brandMap.has(markeId)) {
      brandMap.set(markeId, {
        id: markeId,
        markenname: item.marke?.markenname || '',
        logo_url: item.marke?.logo_url || null,
        count: 0,
        virtual: false
      });
    }
    brandMap.get(markeId).count += 1;
  });

  const folders = Array.from(brandMap.values()).sort((a, b) =>
    (a.markenname || '').localeCompare(b.markenname || '', 'de')
  );

  if (unbrandedCount > 0) {
    folders.push({
      id: null,
      markenname: OHNE_MARKE_LABEL,
      logo_url: null,
      count: unbrandedCount,
      virtual: true
    });
  }

  return folders;
}

export function buildCurrentItems(briefings = [], { unternehmenId, markeId, ohneMarke = false } = {}) {
  return briefings.filter((item) => {
    if ((item.unternehmen_id || item.unternehmen?.id) !== unternehmenId) return false;
    const itemMarkeId = item.marke?.id || item.marke_id || null;
    if (ohneMarke) return !itemMarkeId;
    return itemMarkeId === markeId;
  });
}
