// KampagneGridView.js
// Kampagnen-Ordnerblatt: Unternehmen → Marke → Kampagnen.

import { fillFoldersGrid } from '../../core/components/GridFiller.js';
import { renderEmptyState, resolveEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import {
  NUR_UNTERNEHMEN_LABEL,
  parseFolderQuery,
  folderListUrl,
  folderCrumbs,
  withFolderQuery
} from '../../core/folderListNav.js';
import { KampagneUtils } from './KampagneUtils.js';
import { shouldHideCompleted } from './kampagneListPrefs.js';

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
  return parseFolderQuery(search).unternehmenId ? 'grid' : 'list';
}

export function clearKampagneFolderQuery() {
  if (!window.location.search) return;
  window.history.replaceState({ route: BASE_PATH }, '', BASE_PATH);
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
  }

  destroy() {
    this._isMounted = false;
    this._abort.abort();
  }

  currentFolder() {
    return this.folder;
  }

  hideCompleted() {
    return shouldHideCompleted();
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
    return this.loadAndRender();
  }

  switchToBrands(unternehmenId, unternehmenName) {
    this.applyFolder({
      viewMode: 'brands',
      unternehmenId,
      unternehmenName
    });
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
    return this.loadAndRender();
  }

  syncUrl() {
    const url = folderListUrl(BASE_PATH, this.folder, this.folder.viewMode);
    window.history.replaceState({ route: url }, '', url);
  }

  updateBreadcrumb() {
    if (!window.breadcrumbSystem) return;
    if (!this.folder.unternehmenId || this.folder.viewMode === 'companies') {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Kampagnen', url: BASE_PATH, clickable: false }
      ]);
      return;
    }
    window.breadcrumbSystem.updateBreadcrumb(folderCrumbs({
      listLabel: 'Kampagnen',
      basePath: BASE_PATH,
      folder: this.folder
    }));
  }

  async loadAndRender() {
    if (!this._isMounted || !this.container) return;

    this.syncUrl();
    this.updateBreadcrumb();
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

  _renderLoading() {
    const mode = this.folder.viewMode || 'companies';
    if (mode === 'items') {
      this.container.innerHTML = this._itemsShell('<tr><td colspan="6" class="loading">Lade Kampagnen...</td></tr>');
      return;
    }
    this.container.innerHTML = this._foldersShell(mode, '');
  }

  _renderData(data) {
    const ebene = data?.ebene || this.folder.viewMode || 'companies';
    if (ebene === 'items') {
      this.container.innerHTML = this._itemsShell(this._itemsRows(data?.kampagnen || []));
      return;
    }
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

  _itemsShell(rowsHtml) {
    return `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">${backButtonHtml('btn-back-to-brands')}</div>
          </div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th class="col-name">Kampagne</th>
                <th>Auftrag</th>
                <th>Start</th>
                <th>Deadline</th>
                <th>Volumen</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="kampagnen-grid-items">${rowsHtml}</tbody>
          </table>
        </div>
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

  _itemsRows(kampagnen) {
    if (!kampagnen.length) {
      const html = resolveEmptyState({
        hasActiveFilters: false,
        states: {
          default: {
            icon: 'megaphone',
            title: 'Keine Kampagnen für diese Marke vorhanden',
            text: 'Für diesen Ordner gibt es noch keine Kampagnen.'
          }
        }
      }, 'default');
      return `<tr><td colspan="6" class="empty-state-cell">${html}</td></tr>`;
    }
    return kampagnen.map((kampagne) => this._itemRow(kampagne)).join('');
  }

  _itemRow(kampagne) {
    const displayName = KampagneUtils.getDisplayName(kampagne);
    const secondary = kampagne.eigener_name && kampagne.kampagnenname && kampagne.eigener_name !== kampagne.kampagnenname
      ? `<div class="text-muted">${sanitize(kampagne.kampagnenname)}</div>`
      : '';
    const auftrag = kampagne.auftrag?.auftragsname
      ? `<span class="status-badge">${sanitize(kampagne.auftrag.auftragsname)}</span>`
      : '<span class="text-muted">—</span>';
    const status = kampagne.is_completed
      ? '<span class="status-badge">Abgeschlossen</span>'
      : '';
    return `
      <tr class="kampagne-grid-row" data-id="${kampagne.id}">
        <td class="col-name">
          <a href="${withFolderQuery(`${BASE_PATH}/${kampagne.id}`)}" class="table-link kampagne-grid-open" data-id="${kampagne.id}">
            ${sanitize(displayName)}
          </a>
          ${secondary}
        </td>
        <td>${auftrag}</td>
        <td>${KampagneUtils.formatDate(kampagne.start)}</td>
        <td>${KampagneUtils.formatDate(kampagne.deadline_post_produktion)}</td>
        <td>${KampagneUtils.formatCurrency(kampagne.volumen)}</td>
        <td>${status}</td>
      </tr>
    `;
  }

  _onClick(e) {
    const backCompanies = e.target.closest('#btn-back-to-companies');
    if (backCompanies) {
      e.preventDefault();
      this.switchToCompanies();
      return;
    }

    const backBrands = e.target.closest('#btn-back-to-brands');
    if (backBrands) {
      e.preventDefault();
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

    const openLink = e.target.closest('.kampagne-grid-open, .kampagne-grid-row');
    if (openLink) {
      const id = openLink.dataset.id;
      if (!id) return;
      e.preventDefault();
      window.navigateTo(withFolderQuery(`${BASE_PATH}/${id}`));
    }
  }
}
