// ProduktionFolders.js
// Reine Aggregation für die Ordner-Hierarchie Unternehmen → Marke → Kampagne → Produktionen.
// Unternehmen und Marke kommen über die Kampagne der Produktion.

import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { markenEbeneEntfaellt, NUR_UNTERNEHMEN_LABEL, OHNE_QUERY } from '../../core/folderListNav.js';

export { NUR_UNTERNEHMEN_LABEL, OHNE_QUERY };

function sortDe(list, key) {
  return list.sort((a, b) => (a[key] || '').localeCompare(b[key] || '', 'de'));
}

export function unternehmenIdOf(produktion) {
  const kampagne = produktion?.kampagne;
  return kampagne?.unternehmen_id || kampagne?.unternehmen?.id || null;
}

export function markeIdOf(produktion) {
  const kampagne = produktion?.kampagne;
  return kampagne?.marke_id || kampagne?.marke?.id || null;
}

export function kampagneIdOf(produktion) {
  return produktion?.kampagne?.id || produktion?.kampagne_id || null;
}

export function scopedByUnternehmen(rows = [], unternehmenId) {
  return rows.filter((row) => unternehmenIdOf(row) === unternehmenId);
}

export function buildCompanyFolders(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const id = unternehmenIdOf(row);
    if (!id) continue;
    if (!map.has(id)) {
      const unternehmen = row.kampagne?.unternehmen;
      map.set(id, {
        id,
        firmenname: unternehmen?.firmenname || '',
        logo_url: unternehmen?.logo_url || null,
        count: 0
      });
    }
    map.get(id).count += 1;
  }
  return sortDe([...map.values()], 'firmenname');
}

export function countMarken(rows = [], unternehmenId) {
  const scoped = scopedByUnternehmen(rows, unternehmenId);
  const echte = new Set(scoped.map(markeIdOf).filter(Boolean)).size;
  const ohne = scoped.filter((row) => !markeIdOf(row)).length;
  return { echte, ohne };
}

// Marken-Ebene entfällt, wenn das Unternehmen keine einzige echte Marke hat.
export function markenEbeneWeg(rows = [], unternehmenId) {
  if (!unternehmenId) return false;
  const { echte, ohne } = countMarken(rows, unternehmenId);
  return markenEbeneEntfaellt(echte, ohne);
}

export function buildBrandFolders(rows = [], unternehmenId) {
  const map = new Map();
  let ohne = 0;
  for (const row of scopedByUnternehmen(rows, unternehmenId)) {
    const id = markeIdOf(row);
    if (!id) {
      ohne += 1;
      continue;
    }
    if (!map.has(id)) {
      const marke = row.kampagne?.marke;
      map.set(id, {
        id,
        markenname: marke?.markenname || '',
        logo_url: marke?.logo_url || null,
        count: 0,
        virtual: false
      });
    }
    map.get(id).count += 1;
  }

  const folders = sortDe([...map.values()], 'markenname');
  if (ohne > 0) {
    folders.push({
      id: null,
      markenname: NUR_UNTERNEHMEN_LABEL,
      logo_url: null,
      count: ohne,
      virtual: true
    });
  }
  return folders;
}

function matchesMarke(row, { markeId, ohneMarke }) {
  const id = markeIdOf(row);
  return ohneMarke ? !id : id === markeId;
}

export function buildCampaignFolders(rows = [], { unternehmenId, markeId = null, ohneMarke = false } = {}) {
  const map = new Map();
  for (const row of scopedByUnternehmen(rows, unternehmenId)) {
    if (!matchesMarke(row, { markeId, ohneMarke })) continue;
    const id = kampagneIdOf(row);
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, { id, name: KampagneUtils.getDisplayName(row.kampagne), count: 0 });
    }
    map.get(id).count += 1;
  }
  return sortDe([...map.values()], 'name');
}

export function buildCurrentItems(rows = [], { unternehmenId, markeId = null, ohneMarke = false, kampagneId = null } = {}) {
  return scopedByUnternehmen(rows, unternehmenId)
    .filter((row) => matchesMarke(row, { markeId, ohneMarke }))
    .filter((row) => kampagneIdOf(row) === kampagneId);
}
