// KampagneGridView.js
// Kampagnen-Ordnerblatt: Unternehmen → Marke → Kampagnen.

import { fillFoldersGrid } from '../../core/components/GridFiller.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { replaceRoute } from '../../core/breadcrumbTrail.js';
import {
  NUR_UNTERNEHMEN_LABEL,
  parseFolderQuery,
  folderListUrl,
  folderCrumbs,
  withFolderQuery,
  markenEbeneEntfaellt
} from '../../core/folderListNav.js';
import { shouldHideCompleted } from './kampagneListPrefs.js';
import { loadKampagnenWithRelations } from './KampagneListDataLoader.js';
import { renderTableWrapper, updateTable } from './KampagneListRenderers.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';

const BASE_PATH = '/kampagne';
const GRID_SELECT = `
  id, kampagnenname, eigener_name, start, deadline_post_produktion,
  volumen, creatoranzahl, videoanzahl, is_completed, created_at,
  unternehmen_id, marke_id,
  unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url),
  marke:marke_id(id, markenname, logo_url),
  auftrag:auftrag_id(id, auftragsname)
`;

let gridRpcAvailable = null;

export function initialKampagneView(search = window.location.search) {
  const params = new URLSearchParams(search);
  const ansicht = params.get('ansicht');
  if (ansicht === 'liste') return 'list';
  if (ansicht === 'grid') return 'grid';
  return parseFolderQuery(search).unternehmenId ? 'grid' : 'list';
}

export function setKampagneAnsicht(ansicht, { search = window.location.search, pathname = window.location.pathname } = {}) {
  const params = new URLSearchParams(search);
  if (ansicht === 'grid') params.set('ansicht', 'grid');
  else if (ansicht === 'list') params.delete('ansicht');
  const query = params.toString();
  const url = query ? `${pathname}?${query}` : pathname;
  replaceRoute(url);
}

export function buildGridRpcParams(folder = {}, hideCompleted = true) {
  return {
    p_unternehmen_id: folder.unternehmenId || null,
    p_marke_id: folder.ohneMarke ? null : (folder.markeId || null),
    p_ohne_marke: !!folder.ohneMarke,
    p_hide_completed: !!hideCompleted
  };
}

export function isMissingGridRpc(error) {
  const msg = `${error?.message || ''} ${error?.details || ''}`;
  return error?.code === 'PGRST202'
    || error?.code === '42883'
    || /get_kampagnen_grid|Could not find the function|does not exist/i.test(msg);
}

export function resetGridRpcAvailability() {
  gridRpcAvailable = null;
}

export function groupKampagnenGrid(rows = [], folder = {}, hideCompleted = true) {
  const visible = hideCompleted ? rows.filter((k) => !k.is_completed) : rows;

  if (!folder.unternehmenId) {
    const map = new Map();
    for (const k of visible) {
      const u = k.unternehmen;
      if (!u?.id) continue;
      if (!map.has(u.id)) {
        map.set(u.id, {
          id: u.id,
          firmenname: u.firmenname,
          internes_kuerzel: u.internes_kuerzel,
          logo_url: u.logo_url,
          count: 0
        });
      }
      map.get(u.id).count += 1;
    }
    return {
      ebene: 'companies',
      unternehmen: [...map.values()].sort((a, b) =>
        (a.firmenname || '').localeCompare(b.firmenname || '', 'de')
      )
    };
  }

  const scoped = visible.filter((k) => k.unternehmen_id === folder.unternehmenId);

  if (folder.ohneMarke || folder.markeId) {
    const kampagnen = scoped
      .filter((k) => (folder.ohneMarke ? !k.marke_id : k.marke_id === folder.markeId))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return { ebene: 'items', kampagnen };
  }

  const markenMap = new Map();
  let ohne = 0;
  for (const k of scoped) {
    if (!k.marke_id) {
      ohne += 1;
      continue;
    }
    const m = k.marke;
    if (!m?.id) continue;
    if (!markenMap.has(m.id)) {
      markenMap.set(m.id, {
        id: m.id,
        markenname: m.markenname,
        logo_url: m.logo_url,
        count: 0
      });
    }
    markenMap.get(m.id).count += 1;
  }
  return {
    ebene: 'brands',
    marken: [...markenMap.values()].sort((a, b) =>
      (a.markenname || '').localeCompare(b.markenname || '', 'de')
    ),
    ohne_marke_count: ohne
  };
}

async function loadKampagnenGridLocal(folder, hideCompleted) {
  const { data, error } = await window.supabase
    .from('kampagne')
    .select(GRID_SELECT)
    .not('unternehmen_id', 'is', null);
  if (error) throw error;
  return groupKampagnenGrid(data || [], folder, hideCompleted);
}

export async function loadKampagnenGrid(folder, hideCompleted = true) {
  if (gridRpcAvailable !== false && window.supabase?.rpc) {
    const { data, error } = await window.supabase.rpc(
      'get_kampagnen_grid',
      buildGridRpcParams(folder, hideCompleted)
    );
    if (!error) {
      gridRpcAvailable = true;
      return data || {};
    }
    if (!isMissingGridRpc(error)) throw error;
    gridRpcAvailable = false;
  }
  return loadKampagnenGridLocal(folder, hideCompleted);
}

function sanitize(value) {
  const str = value == null ? '' : String(value);
  return window.validatorSystem?.sanitizeHtml?.(str) ?? str;
}

function countLabel(count) {
  return `${count} ${count === 1 ? 'Kampagne' : 'Kampagnen'}`;
}

function folderIconHtml(folder, name) {
  return folder.logo_url
    ? `<img src="${sanitize(folder.logo_url)}" alt="${sanitize(name)}" class="folder-logo">`
    : `${icon('folder-open')}`;
}

function folderCard(folder, { name, extraAttrs = '' }) {
  return `
    <div class="folder-card" data-folder-name="${sanitize(name)}" ${extraAttrs}>
      <div class="folder-icon">${folderIconHtml(folder, name)}</div>
      <div class="folder-info">
        <span class="folder-name">${sanitize(name)}</span>
        <span class="folder-count">${countLabel(folder.count)}</span>
      </div>
    </div>
  `;
}

function backButtonHtml(id) {
  return `
    <button type="button" id="${id}" class="mdc-btn mdc-btn--secondary">
      ${icon('arrow-left')}
      Zurück
    </button>
  `;
}

function emptyFoldersHtml({ title, text }) {
  return `<div class="grid-span-all">${renderEmptyState({
    icon: 'megaphone',
    title,
    text
  })}</div>`;
}

export class KampagneGridView {
  constructor(container) {
    this.container = container;
    this.folder = parseFolderQuery(window.location.search);
    this._abort = new AbortController();
    this._isMounted = true;
    this.pagination = new PaginationSystem();
  }

  destroy() {
    this._isMounted = false;
    this._paginationBound = false;
    this._abort.abort();
  }

  currentFolder() {
    return this.folder;
  }

  hideCompleted() {
    return shouldHideCompleted();
  }

  _rememberMarkenEbene(unternehmenId, weg) {
    this._markenEbeneWegFor = unternehmenId;
    this._markenEbeneWegResolved = true;
    this.markenEbeneWeg = !!weg;
  }

  async _resolveMarkenEbeneWeg() {
    if (!this.folder.ohneMarke || !this.folder.unternehmenId) {
      this.markenEbeneWeg = false;
      return false;
    }
    if (this._markenEbeneWegResolved && this._markenEbeneWegFor === this.folder.unternehmenId) {
      return this.markenEbeneWeg;
    }
    const data = await loadKampagnenGrid({
      unternehmenId: this.folder.unternehmenId,
      unternehmenName: this.folder.unternehmenName,
      viewMode: 'brands'
    }, this.hideCompleted());
    const weg = markenEbeneEntfaellt((data?.marken || []).length, data?.ohne_marke_count || 0);
    this._rememberMarkenEbene(this.folder.unternehmenId, weg);
    return weg;
  }

  async mount() {
    this.container.addEventListener('click', (e) => this._onClick(e), {
      signal: this._abort.signal
    });
    await this.loadAndRender();
  }

  async reload() {
    await this.loadAndRender();
  }

  applyFolder(folder) {
    const next = {
      unternehmenId: folder.unternehmenId || null,
      unternehmenName: folder.unternehmenName || null,
      markeId: folder.ohneMarke ? null : (folder.markeId || null),
      markeName: folder.markeName || null,
      ohneMarke: !!folder.ohneMarke,
      viewMode: 'companies'
    };
    if (!next.unternehmenId) {
      this.folder = next;
      return;
    }
    next.viewMode = (next.markeId || next.ohneMarke) ? 'items' : 'brands';
    this.folder = next;
  }

  switchToCompanies() {
    this.applyFolder({ viewMode: 'companies' });
    this.pagination.currentPage = 1;
    return this.loadAndRender();
  }

  switchToBrands(unternehmenId, unternehmenName) {
    this.applyFolder({
      viewMode: 'brands',
      unternehmenId,
      unternehmenName
    });
    this.pagination.currentPage = 1;
    return this.loadAndRender();
  }

  switchToItems(markeId, markeName, { ohneMarke = false } = {}) {
    this.applyFolder({
      viewMode: 'items',
      unternehmenId: this.folder.unternehmenId,
      unternehmenName: this.folder.unternehmenName,
      markeId: ohneMarke ? null : markeId,
      markeName,
      ohneMarke
    });
    this.pagination.currentPage = 1;
    return this.loadAndRender();
  }

  syncUrl() {
    const url = folderListUrl(BASE_PATH, this.folder, this.folder.viewMode);
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set('ansicht', 'grid');
    const withAnsicht = `${parsed.pathname}${parsed.search}`;
    replaceRoute(withAnsicht);
  }

  updateBreadcrumb() {
    if (!window.breadcrumbSystem) return;
    if (!this.folder.unternehmenId || this.folder.viewMode === 'companies') {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Kampagnen', url: `${BASE_PATH}?ansicht=grid`, clickable: false }
      ]);
      return;
    }
    const crumbs = folderCrumbs({
      listLabel: 'Kampagnen',
      basePath: BASE_PATH,
      folder: this.folder,
      markenEbeneWeg: !!(this.folder.ohneMarke && this.markenEbeneWeg)
    }).map((crumb) => {
      if (!crumb.url || crumb.url === '#') return crumb;
      const url = new URL(crumb.url, window.location.origin);
      url.searchParams.set('ansicht', 'grid');
      return { ...crumb, url: `${url.pathname}${url.search}` };
    });
    window.breadcrumbSystem.updateBreadcrumb(crumbs);
  }

  async loadAndRender() {
    if (!this._isMounted || !this.container) return;

    if (this.folder.viewMode === 'brands') {
      try {
        const data = await loadKampagnenGrid(this.folder, this.hideCompleted());
        if (!this._isMounted) return;
        const weg = markenEbeneEntfaellt((data?.marken || []).length, data?.ohne_marke_count || 0);
        this._rememberMarkenEbene(this.folder.unternehmenId, weg);
        if (weg) {
          await this.switchToItems(null, NUR_UNTERNEHMEN_LABEL, { ohneMarke: true });
          return;
        }
        this.syncUrl();
        this.updateBreadcrumb();
        this._renderData(data);
      } catch (error) {
        if (!this._isMounted) return;
        window.ErrorHandler?.handle(error, 'KampagneGridView.loadAndRender');
        this.container.innerHTML = `<div class="error-message"><p>Grid konnte nicht geladen werden.</p></div>`;
      }
      return;
    }

    if (this.folder.viewMode === 'items' && this.folder.ohneMarke) {
      try {
        await this._resolveMarkenEbeneWeg();
      } catch (error) {
        if (!this._isMounted) return;
        window.ErrorHandler?.handle(error, 'KampagneGridView.loadAndRender');
      }
    } else {
      this.markenEbeneWeg = false;
    }

    if (!this._isMounted) return;
    this.syncUrl();
    this.updateBreadcrumb();

    if (this.folder.viewMode === 'items') {
      await this._loadItems();
      return;
    }

    this._renderLoading();

    try {
      const data = await loadKampagnenGrid(this.folder, this.hideCompleted());
      if (!this._isMounted) return;
      this._renderData(data);
    } catch (error) {
      if (!this._isMounted) return;
      window.ErrorHandler?.handle(error, 'KampagneGridView.loadAndRender');
      this.container.innerHTML = `<div class="error-message"><p>Grid konnte nicht geladen werden.</p></div>`;
    }
  }

  async _loadItems() {
    this.container.innerHTML = this._itemsShell();
    if (!this._paginationBound) {
      this.pagination.init('pagination-kampagne', {
        itemsPerPage: 25,
        onPageChange: () => this.loadAndRender(),
        onItemsPerPageChange: () => this.loadAndRender(),
        dynamicResize: true,
        tbodySelector: '.data-table tbody'
      });
      this._paginationBound = true;
    }
    try {
      const result = await loadKampagnenWithRelations(
        this.pagination.currentPage,
        this.pagination.itemsPerPage,
        { folder: this.folder }
      );
      if (!this._isMounted) return;
      const kampagnen = result?.data ?? result ?? [];
      const totalCount = result?.count ?? kampagnen.length;
      this.pagination.updateTotal(totalCount);
      await updateTable(kampagnen, {
        bindDragToScroll: () => {},
        hasActiveFilters: false,
        hideCompletedActive: this.hideCompleted()
      });
      this.pagination.render();
      window.ActionsDropdown?.init();
    } catch (error) {
      if (!this._isMounted) return;
      window.ErrorHandler?.handle(error, 'KampagneGridView._loadItems');
      const tbody = document.getElementById('kampagnen-table-body');
      if (tbody) tbody.innerHTML = '<tr><td colspan="12" class="error-message">Kampagnen konnten nicht geladen werden.</td></tr>';
    }
  }

  _renderLoading() {
    const mode = this.folder.viewMode || 'companies';
    this.container.innerHTML = this._foldersShell(mode, '');
  }

  _renderData(data) {
    const ebene = data?.ebene || this.folder.viewMode || 'companies';
    if (ebene === 'brands') {
      this.container.innerHTML = this._foldersShell('brands', this._brandCards(data));
      fillFoldersGrid(document.getElementById('brands-grid'));
      return;
    }
    this.container.innerHTML = this._foldersShell('companies', this._companyCards(data?.unternehmen || []));
    fillFoldersGrid(document.getElementById('companies-grid'));
  }

  _foldersShell(mode, cardsHtml) {
    const gridId = mode === 'brands' ? 'brands-grid' : 'companies-grid';
    const back = mode === 'brands' ? backButtonHtml('btn-back-to-companies') : '';
    return `
      <div class="list-container">
        ${back ? `<div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">${back}</div>
          </div>
        </div>` : ''}
        <div class="table-container">
          <div class="folders-grid" id="${gridId}">${cardsHtml}</div>
        </div>
      </div>
    `;
  }

  _itemsShell() {
    return `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">${backButtonHtml('btn-back-to-brands')}</div>
          </div>
        </div>
        ${renderTableWrapper()}
      </div>
    `;
  }

  _companyCards(unternehmen) {
    if (!unternehmen.length) {
      return emptyFoldersHtml({
        title: 'Keine Kampagnen vorhanden',
        text: 'Es wurden noch keine Kampagnen angelegt.'
      });
    }
    return unternehmen.map((folder) => folderCard(folder, {
      name: folder.firmenname,
      extraAttrs: `data-unternehmen-id="${folder.id}" data-unternehmen-name="${sanitize(folder.firmenname)}"`
    })).join('');
  }

  _brandCards(data) {
    const marken = data?.marken || [];
    const ohneCount = data?.ohne_marke_count || 0;
    const folders = marken.map((folder) => folderCard(folder, {
      name: folder.markenname,
      extraAttrs: `data-marke-id="${folder.id}" data-marke-name="${sanitize(folder.markenname)}"`
    }));
    if (ohneCount > 0) {
      folders.push(folderCard({ count: ohneCount }, {
        name: NUR_UNTERNEHMEN_LABEL,
        extraAttrs: `data-ohne-marke="1" data-marke-name="${sanitize(NUR_UNTERNEHMEN_LABEL)}"`
      }));
    }
    if (!folders.length) {
      return emptyFoldersHtml({
        title: 'Keine Marken mit Kampagnen',
        text: 'Für dieses Unternehmen gibt es noch keine Kampagnen.'
      });
    }
    return folders.join('');
  }

  async _onClick(e) {
    const backCompanies = e.target.closest('#btn-back-to-companies');
    if (backCompanies) {
      e.preventDefault();
      this.switchToCompanies();
      return;
    }

    const backBrands = e.target.closest('#btn-back-to-brands');
    if (backBrands) {
      e.preventDefault();
      try {
        if (this.folder.ohneMarke && await this._resolveMarkenEbeneWeg()) {
          this.switchToCompanies();
          return;
        }
      } catch (error) {
        window.ErrorHandler?.handle(error, 'KampagneGridView.back');
      }
      this.switchToBrands(this.folder.unternehmenId, this.folder.unternehmenName);
      return;
    }

    const companyCard = e.target.closest('#companies-grid .folder-card');
    if (companyCard) {
      this.switchToBrands(companyCard.dataset.unternehmenId, companyCard.dataset.unternehmenName);
      return;
    }

    const brandCard = e.target.closest('#brands-grid .folder-card');
    if (brandCard) {
      if (brandCard.dataset.ohneMarke === '1') {
        this.switchToItems(null, brandCard.dataset.markeName, { ohneMarke: true });
      } else {
        this.switchToItems(brandCard.dataset.markeId, brandCard.dataset.markeName);
      }
      return;
    }

    const openLink = e.target.closest('.table-link[data-table="kampagne"]');
    if (openLink) {
      const id = openLink.dataset.id;
      if (!id) return;
      e.preventDefault();
      window.navigateTo(withFolderQuery(`${BASE_PATH}/${id}`));
    }
  }
}
