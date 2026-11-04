// AuftragsdetailsFolders.js
// Reine Aggregation für die Grid-Hierarchie Unternehmen → Marke → Auftragsdetails.
// Unternehmen und Marke hängen am Auftrag (detail.auftrag), nicht am Detail selbst.

import { NUR_UNTERNEHMEN_LABEL, OHNE_QUERY } from '../../core/folderListNav.js';

export { NUR_UNTERNEHMEN_LABEL, OHNE_QUERY };

function unternehmenIdOf(detail) {
  return detail?.auftrag?.unternehmen?.id || detail?.auftrag?.unternehmen_id || null;
}

function markeIdOf(detail) {
  return detail?.auftrag?.marke?.id || detail?.auftrag?.marke_id || null;
}

export function buildCompanyFolders(details = []) {
  const map = new Map();

  details.forEach((detail) => {
    const id = unternehmenIdOf(detail);
    if (!id) return;
    if (!map.has(id)) {
      map.set(id, {
        id,
        firmenname: detail.auftrag?.unternehmen?.firmenname || '',
        logo_url: detail.auftrag?.unternehmen?.logo_url || null,
        count: 0
      });
    }
    map.get(id).count += 1;
  });

  return Array.from(map.values()).sort((a, b) =>
    (a.firmenname || '').localeCompare(b.firmenname || '', 'de')
  );
}

export function buildBrandFolders(details = [], unternehmenId) {
  const brandMap = new Map();
  let unbrandedCount = 0;

  details.forEach((detail) => {
    if (unternehmenIdOf(detail) !== unternehmenId) return;

    const markeId = markeIdOf(detail);
    if (!markeId) {
      unbrandedCount += 1;
      return;
    }
    if (!brandMap.has(markeId)) {
      brandMap.set(markeId, {
        id: markeId,
        markenname: detail.auftrag?.marke?.markenname || '',
        logo_url: detail.auftrag?.marke?.logo_url || null,
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
      markenname: NUR_UNTERNEHMEN_LABEL,
      logo_url: null,
      count: unbrandedCount,
      virtual: true
    });
  }

  return folders;
}

export function buildCurrentItems(details = [], { unternehmenId, markeId, ohneMarke = false } = {}) {
  return details.filter((detail) => {
    if (unternehmenIdOf(detail) !== unternehmenId) return false;
    const itemMarkeId = markeIdOf(detail);
    if (ohneMarke) return !itemMarkeId;
    return itemMarkeId === markeId;
  });
}
