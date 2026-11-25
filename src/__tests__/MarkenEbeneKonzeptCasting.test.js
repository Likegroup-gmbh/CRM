import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrategieList } from '../modules/strategie/StrategieList.js';
import { CreatorAuswahlList } from '../modules/creator-auswahl/CreatorAuswahlList.js';
import { renderBrandsView } from '../modules/strategie/StrategieListRenderer.js';

const FIRMA = { id: 'u1', firmenname: 'Acme', logo_url: null };
const MARKE = { id: 'm1', markenname: 'Clear', logo_url: null };

function eintrag(id, { marke = null } = {}) {
  return {
    id,
    name: `Eintrag ${id}`,
    unternehmen_id: FIRMA.id,
    unternehmen: FIRMA,
    marke_id: marke ? marke.id : null,
    marke
  };
}

const VARIANTEN = [
  {
    titel: 'Konzept',
    erzeuge: () => new StrategieList(),
    daten: 'strategien',
    renderBrands: (list) => renderBrandsView(list)
  },
  {
    titel: 'Casting',
    erzeuge: () => new CreatorAuswahlList(),
    daten: 'listen',
    renderBrands: (list) => list.renderBrandsView()
  }
];

describe.each(VARIANTEN)('Marken-Ebene $titel', ({ erzeuge, daten, renderBrands }) => {
  let list;

  function ladeBrands(eintraege) {
    list[daten] = eintraege;
    list.viewMode = 'brands';
    list.currentUnternehmenId = FIRMA.id;
    list.currentUnternehmenName = FIRMA.firmenname;
    list.buildBrandFolders();
    list.applyMarkenEbeneSprung();
  }

  beforeEach(() => {
    window.isAdmin = () => true;
    window.isKunde = () => false;
    window.currentUser = { rolle: 'admin', permissions: {} };
    window.breadcrumbSystem = undefined;
    list = erzeuge();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.isAdmin;
    delete window.isKunde;
    delete window.currentUser;
  });

  it('Firma ohne Marke springt direkt in die Einträge', () => {
    ladeBrands([eintrag('a'), eintrag('b')]);
    expect(list.viewMode).toBe('items');
    expect(list._ohneMarke).toBe(true);
    expect(list.currentItems.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('Firma mit Marke und Einträgen ohne Marke bleibt auf der Marken-Seite', () => {
    ladeBrands([eintrag('a'), eintrag('b', { marke: MARKE })]);
    expect(list.viewMode).toBe('brands');
    expect(list._ohneMarke).toBe(false);
    expect(list.companyOnlyItems.map((item) => item.id)).toEqual(['a']);
  });

  it('Firma ohne jeden Eintrag springt nicht', () => {
    ladeBrands([]);
    expect(list.viewMode).toBe('brands');
    expect(list._ohneMarke).toBe(false);
  });

  it('Items-Ansicht einer Marke filtert nicht auf Einträge ohne Marke', () => {
    list[daten] = [eintrag('a'), eintrag('b', { marke: MARKE })];
    list.viewMode = 'items';
    list.currentUnternehmenId = FIRMA.id;
    list.currentMarkeId = MARKE.id;
    list.buildCurrentItems();
    expect(list.currentItems.map((item) => item.id)).toEqual(['b']);
  });

  it('blendet den leeren Block ohne Marke aus, auch für Mitarbeiter', () => {
    list[daten] = [eintrag('b', { marke: MARKE })];
    list.currentUnternehmenId = FIRMA.id;
    list.buildBrandFolders();
    const html = renderBrands(list);
    expect(html).toContain('brands-table-body');
    expect(html).not.toContain('company-only-table-body');
    expect(html).not.toContain('ohne Marke');
  });

  it('zeigt den Block ohne Marke, solange Zeilen drin sind', () => {
    list[daten] = [eintrag('a'), eintrag('b', { marke: MARKE })];
    list.currentUnternehmenId = FIRMA.id;
    list.buildBrandFolders();
    const html = renderBrands(list);
    expect(html).toContain('brands-table-body');
    expect(html).toContain('company-only-table-body');
  });

  it('Zurück aus der übersprungenen Ansicht geht zu den Unternehmen', () => {
    ladeBrands([eintrag('a')]);
    const firmen = vi.spyOn(list, 'switchToCompaniesView').mockImplementation(() => {});
    const marken = vi.spyOn(list, 'switchToBrandsView').mockImplementation(() => {});
    list.backFromItems();
    expect(firmen).toHaveBeenCalled();
    expect(marken).not.toHaveBeenCalled();
  });

  it('Zurück aus einer echten Marke geht zur Marken-Seite', () => {
    list.viewMode = 'items';
    list.currentUnternehmenId = FIRMA.id;
    list.currentUnternehmenName = FIRMA.firmenname;
    list.currentMarkeId = MARKE.id;
    const firmen = vi.spyOn(list, 'switchToCompaniesView').mockImplementation(() => {});
    const marken = vi.spyOn(list, 'switchToBrandsView').mockImplementation(() => {});
    list.backFromItems();
    expect(marken).toHaveBeenCalledWith(FIRMA.id, FIRMA.firmenname);
    expect(firmen).not.toHaveBeenCalled();
  });

  it('switchTo* setzen das Flag zurück', () => {
    ladeBrands([eintrag('a')]);
    expect(list._ohneMarke).toBe(true);
    list.loadAndRender = vi.fn();
    list.switchToBrandsView(FIRMA.id, FIRMA.firmenname);
    expect(list._ohneMarke).toBe(false);
    list._ohneMarke = true;
    list.switchToItemsView(MARKE.id, MARKE.markenname);
    expect(list._ohneMarke).toBe(false);
    list._ohneMarke = true;
    list.switchToCompaniesView();
    expect(list._ohneMarke).toBe(false);
  });
});

describe('Konzept: neutrale Leerzeile', () => {
  beforeEach(() => {
    window.isAdmin = () => true;
    window.isKunde = () => false;
  });

  afterEach(() => {
    delete window.isAdmin;
    delete window.isKunde;
  });

  it('zeigt Keine Konzepte vorhanden statt dem Text ohne Marke', () => {
    const list = new StrategieList();
    list.currentUnternehmenId = FIRMA.id;
    list.strategien = [];
    list.buildBrandFolders();
    const html = renderBrandsView(list);
    expect(html).toContain('Keine Konzepte vorhanden');
    expect(html).not.toContain('ohne Marke');
    expect(html).not.toContain('company-only-table-body');
  });

  it('zeigt die Leerzeile nicht, wenn Konzepte da sind', () => {
    const list = new StrategieList();
    list.currentUnternehmenId = FIRMA.id;
    list.strategien = [eintrag('b', { marke: MARKE })];
    list.buildBrandFolders();
    expect(renderBrandsView(list)).not.toContain('Keine Konzepte vorhanden');
  });
});

describe('Konzept: Breadcrumb im Sprung', () => {
  afterEach(() => {
    delete window.breadcrumbSystem;
  });

  it('zeigt Konzepte > Firma ohne Marken-Crumb', () => {
    const updateBreadcrumb = vi.fn();
    window.breadcrumbSystem = { updateBreadcrumb };
    const list = new StrategieList();
    list.viewMode = 'items';
    list._ohneMarke = true;
    list.currentUnternehmenId = FIRMA.id;
    list.currentUnternehmenName = FIRMA.firmenname;
    list.updateBreadcrumbDisplay();
    expect(updateBreadcrumb).toHaveBeenCalledWith([
      { label: 'Konzepte', url: '/konzepte', clickable: true },
      { label: 'Acme', url: '#', clickable: false }
    ]);
  });
});

describe('Casting: Breadcrumb im Sprung', () => {
  afterEach(() => {
    delete window.breadcrumbSystem;
  });

  it('zeigt Castings > Firma ohne Marken-Crumb', () => {
    const updateBreadcrumb = vi.fn();
    window.breadcrumbSystem = { updateBreadcrumb };
    const list = new CreatorAuswahlList();
    list.viewMode = 'items';
    list._ohneMarke = true;
    list.currentUnternehmenId = FIRMA.id;
    list.currentUnternehmenName = FIRMA.firmenname;
    list.updateBreadcrumb();
    expect(updateBreadcrumb).toHaveBeenCalledWith([
      { label: 'Castings', url: '/castings', clickable: true },
      { label: 'Acme', url: '#', clickable: false }
    ]);
  });
});

describe.each([
  { titel: 'Konzept', erzeuge: () => new StrategieList(), basePath: '/konzepte', listLabel: 'Konzepte', render: 'updateBreadcrumbDisplay' },
  { titel: 'Casting', erzeuge: () => new CreatorAuswahlList(), basePath: '/castings', listLabel: 'Castings', render: 'updateBreadcrumb' }
])('Ordner-Ebene in URL und Breadcrumb: $titel', ({ erzeuge, basePath, listLabel, render }) => {
  beforeEach(() => {
    window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
    window.history.replaceState({}, '', basePath);
  });

  afterEach(() => {
    delete window.breadcrumbSystem;
    window.history.replaceState({}, '', '/');
  });

  it('Marke: Firma klickbar, Marke aktuell, URL hält beide Ebenen', () => {
    const list = erzeuge();
    list.viewMode = 'items';
    list.currentUnternehmenId = FIRMA.id;
    list.currentUnternehmenName = FIRMA.firmenname;
    list.currentMarkeId = MARKE.id;
    list.currentMarkeName = MARKE.markenname;
    list[render]();
    list.syncListUrl();

    const crumbs = window.breadcrumbSystem.updateBreadcrumb.mock.calls.at(-1)[0];
    expect(crumbs.map((c) => c.label)).toEqual([listLabel, 'Acme', 'Clear']);
    expect(crumbs[1]).toMatchObject({ clickable: true });
    expect(new URL(crumbs[1].url, 'http://x').searchParams.get('marke')).toBeNull();

    const params = new URLSearchParams(window.location.search);
    expect(window.location.pathname).toBe(basePath);
    expect(params.get('unternehmen')).toBe('u1');
    expect(params.get('marke')).toBe('m1');
  });

  it('Unternehmens-Ebene: nur der Listen-Crumb, URL ohne Query', () => {
    const list = erzeuge();
    list.viewMode = 'companies';
    list.currentUnternehmenId = FIRMA.id;
    list[render]();
    list.syncListUrl();
    expect(window.breadcrumbSystem.updateBreadcrumb.mock.calls.at(-1)[0])
      .toEqual([{ label: listLabel, url: basePath, clickable: false }]);
    expect(window.location.search).toBe('');
  });
});
