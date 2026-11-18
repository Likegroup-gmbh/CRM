// briefingListNavigation.js
// Ordner-Navigation der Briefing-Liste: Unternehmen -> Marken -> Briefings, URL und Breadcrumb.
// Ohne echte Marken entfällt die Markenebene (folderListNav).

import {
  buildCompanyFolders,
  buildBrandFolders,
  buildCurrentItems,
  OHNE_MARKE_LABEL,
  OHNE_QUERY
} from './BriefingFolders.js';
import { markenEbeneEntfaellt } from '../../core/folderListNav.js';
import { replaceRoute } from '../../core/breadcrumbTrail.js';
import {
  renderCompaniesView, updateCompaniesGrid,
  renderBrandsView, updateBrandsGrid,
  renderItemsView, updateItemsTable as _updateItemsTable
} from './BriefingFolderRenderer.js';

export function installBriefingListNavigation(proto) {
  Object.assign(proto, {
    applyQueryParams(params) {
      const qUnternehmenId = params.get('unternehmen');
      const qUnternehmenName = params.get('unternehmen_name');
      const qMarke = params.get('marke');
      const qMarkeName = params.get('marke_name');

      this.currentUnternehmenId = null;
      this.currentUnternehmenName = null;
      this.currentMarkeId = null;
      this.currentMarkeName = null;
      this._ohneMarke = false;
      this.viewMode = 'companies';

      if (!qUnternehmenId) return;

      this.currentUnternehmenId = qUnternehmenId;
      this.currentUnternehmenName = decodeURIComponent(qUnternehmenName || 'Unternehmen');

      if (qMarke === OHNE_QUERY) {
        this.viewMode = 'items';
        this._ohneMarke = true;
        this.currentMarkeName = decodeURIComponent(qMarkeName || OHNE_MARKE_LABEL);
        return;
      }

      if (qMarke) {
        this.viewMode = 'items';
        this.currentMarkeId = qMarke;
        this.currentMarkeName = decodeURIComponent(qMarkeName || 'Marke');
        return;
      }

      this.viewMode = 'brands';
    },

    listUrl(viewMode = this.viewMode) {
      if (viewMode === 'companies' || !this.currentUnternehmenId) return '/briefing';

      const params = new URLSearchParams();
      params.set('unternehmen', this.currentUnternehmenId);
      params.set('unternehmen_name', this.currentUnternehmenName || '');

      if (viewMode === 'brands') return `/briefing?${params}`;

      if (this._ohneMarke) {
        params.set('marke', OHNE_QUERY);
        params.set('marke_name', this.currentMarkeName || OHNE_MARKE_LABEL);
      } else if (this.currentMarkeId) {
        params.set('marke', this.currentMarkeId);
        params.set('marke_name', this.currentMarkeName || '');
      }
      return `/briefing?${params}`;
    },

    createUrl() {
      if (!this.currentUnternehmenId) return '/briefing/new';
      const params = new URLSearchParams();
      params.set('unternehmen', this.currentUnternehmenId);
      if (this.currentMarkeId && !this._ohneMarke) {
        params.set('marke', this.currentMarkeId);
      }
      return `/briefing/new?${params}`;
    },

    syncListUrl() {
      const url = this.listViewMode === 'list' ? '/briefing' : this.listUrl();
      replaceRoute(url);
    },

    updateBreadcrumbDisplay() {
      if (!window.breadcrumbSystem) return;

      if (this.listViewMode === 'list' || this.viewMode === 'companies') {
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Briefings', url: '/briefing', clickable: false }
        ]);
        return;
      }

      const crumbs = [
        { label: 'Briefings', url: '/briefing', clickable: true }
      ];

      if (this.viewMode === 'brands' || this.markenEbeneWeg()) {
        crumbs.push({ label: this.currentUnternehmenName || 'Unternehmen', url: '#', clickable: false });
        window.breadcrumbSystem.updateBreadcrumb(crumbs);
        return;
      }

      crumbs.push({
        label: this.currentUnternehmenName || 'Unternehmen',
        url: this.listUrl('brands'),
        clickable: true
      });
      crumbs.push({
        label: this.currentMarkeName || OHNE_MARKE_LABEL,
        url: '#',
        clickable: false
      });
      window.breadcrumbSystem.updateBreadcrumb(crumbs);
    },

    buildCurrentFolders() {
      if (this.viewMode === 'companies') {
        this.companyFolders = buildCompanyFolders(this.briefings);
        return;
      }
      if (this.viewMode === 'brands') {
        this.brandFolders = buildBrandFolders(this.briefings, this.currentUnternehmenId);
        return;
      }
      this.currentItems = buildCurrentItems(this.briefings, {
        unternehmenId: this.currentUnternehmenId,
        markeId: this.currentMarkeId,
        ohneMarke: this._ohneMarke
      });
    },

    markenEbeneWeg() {
      if (!this._ohneMarke || !this.currentUnternehmenId) return false;
      const folders = buildBrandFolders(this.briefings, this.currentUnternehmenId);
      const echte = folders.filter((folder) => folder.id && !folder.virtual).length;
      const ohne = folders.filter((folder) => folder.virtual).reduce((sum, folder) => sum + (folder.count || 0), 0);
      return markenEbeneEntfaellt(echte, ohne);
    },

    applyMarkenEbeneSprung() {
      if (this.viewMode !== 'brands' || !this.currentUnternehmenId) return;
      const folders = buildBrandFolders(this.briefings, this.currentUnternehmenId);
      const echte = folders.filter((folder) => folder.id && !folder.virtual).length;
      const ohne = folders.filter((folder) => folder.virtual).reduce((sum, folder) => sum + (folder.count || 0), 0);
      if (!markenEbeneEntfaellt(echte, ohne)) return;
      this.viewMode = 'items';
      this._ohneMarke = true;
      this.currentMarkeId = null;
      this.currentMarkeName = OHNE_MARKE_LABEL;
      this.buildCurrentFolders();
    },

    backFromItems() {
      if (this.markenEbeneWeg()) this.switchToCompaniesView();
      else this.switchToBrandsView(this.currentUnternehmenId, this.currentUnternehmenName);
    },

    renderFolderView() {
      this.updateBreadcrumbDisplay();
      this.syncListUrl();

      let html = '';
      if (this.viewMode === 'companies') html = renderCompaniesView(this);
      else if (this.viewMode === 'brands') html = renderBrandsView(this);
      else html = renderItemsView(this);

      window.setContentSafely(window.content, html);

      if (this.viewMode === 'companies') updateCompaniesGrid(this);
      else if (this.viewMode === 'brands') updateBrandsGrid(this);
    },

    updateItemsTable() { _updateItemsTable(this); },

    switchToCompaniesView() {
      this.viewMode = 'companies';
      this.currentUnternehmenId = null;
      this.currentUnternehmenName = null;
      this.currentMarkeId = null;
      this.currentMarkeName = null;
      this._ohneMarke = false;
      this.loadAndRender();
    },

    switchToBrandsView(unternehmenId, unternehmenName) {
      this.viewMode = 'brands';
      this.currentUnternehmenId = unternehmenId;
      this.currentUnternehmenName = unternehmenName;
      this.currentMarkeId = null;
      this.currentMarkeName = null;
      this._ohneMarke = false;
      this.loadAndRender();
    },

    switchToItemsView(markeId, markeName, { ohneMarke = false } = {}) {
      this.viewMode = 'items';
      this.currentMarkeId = ohneMarke ? null : markeId;
      this.currentMarkeName = markeName;
      this._ohneMarke = ohneMarke;
      this.loadAndRender();
    },

    setListViewMode(mode) {
      if (this.listViewMode === mode && (mode === 'list' || this.viewMode === 'companies')) return;
      this.listViewMode = mode;
      this.viewMode = 'companies';
      this.currentUnternehmenId = null;
      this.currentUnternehmenName = null;
      this.currentMarkeId = null;
      this.currentMarkeName = null;
      this._ohneMarke = false;
      this.loadAndRender();
    }
  });
}
