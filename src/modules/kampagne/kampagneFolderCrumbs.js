// kampagneFolderCrumbs.js
// Ordner-Crumbs des Kampagnen-Grids (Unternehmen → Marke → Kampagnen),
// geteilt von Grid und Kampagnen-Detail.

import { folderCrumbs } from '../../core/folderListNav.js';

const BASE_PATH = '/kampagne';

function withGrid(crumb) {
  if (!crumb.url || crumb.url === '#') return crumb;
  const url = new URL(crumb.url, window.location.origin);
  url.searchParams.set('ansicht', 'grid');
  return { ...crumb, url: `${url.pathname}${url.search}` };
}

export function kampagneFolderCrumbs(folder, { detailLabel = null, markenEbeneWeg = false } = {}) {
  return folderCrumbs({ listLabel: 'Kampagnen', basePath: BASE_PATH, folder, detailLabel, markenEbeneWeg })
    .map(withGrid);
}

// Offizieller Weg einer Kampagne: Kampagnen > Firma > [Marke] > Kampagne.
// Ohne Marke führt die Firma in die Marken-Ebene, die bei Firmen ohne Marke
// selbst in die Kampagnen springt.
export function kampagneDetailCrumbs(kampagne, kampagneId, label) {
  const folder = kampagne?.unternehmen_id
    ? {
        unternehmenId: kampagne.unternehmen_id,
        unternehmenName: kampagne.unternehmen?.firmenname || 'Unternehmen',
        markeId: kampagne.marke_id || null,
        markeName: kampagne.marke?.markenname || 'Marke',
        ohneMarke: false
      }
    : null;
  const crumbs = kampagneFolderCrumbs(folder, { detailLabel: label });
  crumbs[0] = { label: 'Kampagnen', url: BASE_PATH, clickable: true };
  crumbs[crumbs.length - 1] = { label, url: `${BASE_PATH}/${kampagneId}`, clickable: false };
  return crumbs;
}
