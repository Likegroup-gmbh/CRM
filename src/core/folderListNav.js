// folderListNav.js
// Gemeinsame Ordner-Navigation für Persona- und Produkt-Liste:
// Query <-> Folder, Listen-URL, Breadcrumb-Pfad bis ins Detail-Formular.
//
// Query-Keys: unternehmen, unternehmen_name, marke, marke_name.
// URLSearchParams decodiert bereits selbst - kein decodeURIComponent,
// sonst wirft ein Name mit "%" (z.B. "50% Rabatt") einen URIError.

export const NUR_UNTERNEHMEN_LABEL = 'Nur Unternehmen';
export const OHNE_QUERY = 'ohne';

const LEERER_FOLDER = {
  unternehmenId: null,
  unternehmenName: null,
  markeId: null,
  markeName: null,
  ohneMarke: false,
  viewMode: 'companies'
};

export function parseFolderQuery(search = '') {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const folder = { ...LEERER_FOLDER };

  const qUnternehmenId = params.get('unternehmen');
  if (!qUnternehmenId) return folder;

  folder.unternehmenId = qUnternehmenId;
  folder.unternehmenName = params.get('unternehmen_name') || 'Unternehmen';

  const qMarke = params.get('marke');
  if (qMarke === OHNE_QUERY) {
    folder.viewMode = 'items';
    folder.ohneMarke = true;
    folder.markeName = params.get('marke_name') || NUR_UNTERNEHMEN_LABEL;
    return folder;
  }

  if (qMarke) {
    folder.viewMode = 'items';
    folder.markeId = qMarke;
    folder.markeName = params.get('marke_name') || 'Marke';
    return folder;
  }

  folder.viewMode = 'brands';
  return folder;
}

// ebene: 'companies' | 'brands' | 'items'. Ohne Angabe aus dem Folder abgeleitet.
export function folderListUrl(basePath, folder = {}, ebene = null) {
  if (!folder.unternehmenId || ebene === 'companies') return basePath;

  const params = new URLSearchParams();
  params.set('unternehmen', folder.unternehmenId);
  params.set('unternehmen_name', folder.unternehmenName || '');

  const mitMarke = ebene ? ebene === 'items' : Boolean(folder.markeId || folder.ohneMarke);
  if (mitMarke) {
    if (folder.ohneMarke) {
      params.set('marke', OHNE_QUERY);
      params.set('marke_name', folder.markeName || NUR_UNTERNEHMEN_LABEL);
    } else if (folder.markeId) {
      params.set('marke', folder.markeId);
      params.set('marke_name', folder.markeName || '');
    }
  }
  return `${basePath}?${params}`;
}

// Deeplink-Fallback: Folder aus den Embeds der geladenen Entity.
// Genau eine Marke -> voller Pfad, keine Marke -> "Nur Unternehmen",
// mehrere Marken -> nur bis zur Firma, weil die Herkunft unklar ist.
export function folderFromEntity(entity) {
  const unternehmenId = entity?.unternehmen?.id || entity?.unternehmen_id;
  if (!unternehmenId) return null;

  const folder = {
    unternehmenId,
    unternehmenName: entity?.unternehmen?.firmenname || 'Unternehmen',
    markeId: null,
    markeName: null,
    ohneMarke: false
  };

  // Ohne Embed (nested loadOne) keine Marken-Aussage treffen
  if (!Array.isArray(entity?.marken)) return folder;

  const marken = entity.marken
    .map((eintrag) => ({
      id: eintrag?.marke?.id || eintrag?.marke_id || null,
      name: eintrag?.marke?.markenname || ''
    }))
    .filter((marke) => marke.id);

  if (marken.length === 1) {
    folder.markeId = marken[0].id;
    folder.markeName = marken[0].name || 'Marke';
  } else if (marken.length === 0) {
    folder.ohneMarke = true;
    folder.markeName = NUR_UNTERNEHMEN_LABEL;
  }
  return folder;
}

// Mit detailLabel für das Formular (Ordner klickbar, Detail aktuell),
// ohne für die Liste (letzte erreichte Ebene aktuell, nicht klickbar).
export function folderCrumbs({ listLabel, basePath, folder = null, detailLabel = null }) {
  const root = { label: listLabel, url: basePath, clickable: true };

  if (!folder?.unternehmenId) {
    return detailLabel
      ? [root, { label: detailLabel, clickable: false }]
      : [{ ...root, clickable: false }];
  }

  const firmaCrumb = {
    label: folder.unternehmenName || 'Unternehmen',
    url: folderListUrl(basePath, folder, 'brands'),
    clickable: true
  };
  const hatMarke = Boolean(folder.markeId || folder.ohneMarke);
  const markeCrumb = hatMarke
    ? {
        label: folder.markeName || (folder.ohneMarke ? NUR_UNTERNEHMEN_LABEL : 'Marke'),
        url: folderListUrl(basePath, folder, 'items'),
        clickable: true
      }
    : null;

  if (detailLabel) {
    const crumbs = [root, firmaCrumb];
    if (markeCrumb) crumbs.push(markeCrumb);
    crumbs.push({ label: detailLabel, clickable: false });
    return crumbs;
  }

  if (markeCrumb) {
    return [root, firmaCrumb, { ...markeCrumb, url: '#', clickable: false }];
  }
  return [root, { ...firmaCrumb, url: '#', clickable: false }];
}

// Hängt die aktuelle Folder-Query an ein Detail-/New-Ziel, wenn das Ziel
// dasselbe Basis-Segment hat wie die aktuelle Seite. Auf fremden Seiten
// (Unternehmen-Detail etc.) bleibt der Pfad unverändert.
export function withFolderQuery(path, { search, pathname } = {}) {
  const currentSearch = search ?? window.location.search;
  const currentPath = pathname ?? window.location.pathname;
  if (!currentSearch) return path;

  const currentBase = currentPath.split('/').filter(Boolean)[0];
  const targetBase = path.split(/[?#]/)[0].split('/').filter(Boolean)[0];
  if (!currentBase || currentBase !== targetBase) return path;
  return `${path}${currentSearch}`;
}
