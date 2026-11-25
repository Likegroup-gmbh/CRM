// ProfileDetailV2.js (Fassade)
// Eigene Profilseite des eingeloggten Users – delegiert an Loader, Renderer, Events, Drawer

import { PersonDetailBase } from './PersonDetailBase.js';
import { getTabQueryParam } from '../../core/TabUtils.js';
import { loadAllData, loadUserData } from './ProfileDetailLoader.js';
import { renderProfilePage } from './ProfileDetailRenderer.js';
import { bindProfileDetail, unbindProfileDetail } from './ProfileDetailEvents.js';
import { openProfileEditDrawer } from './ProfileEditDrawer.js';

export class ProfileDetailV2 extends PersonDetailBase {
  constructor() {
    super();
    this.userId = null;
    this.user = null;
    this.unternehmen = [];
    this.marken = [];
    this.auftraege = [];
    this.kampagnen = [];
    this.kooperationen = [];
    this.videos = [];
    this.sprachen = [];
    this.euLaender = [];
    this.activeMainTab = 'informationen';
    this._abortController = null;
  }

  async init() {
    this.userId = window.currentUser?.id;
    if (!this.userId) {
      console.error('❌ Kein Benutzer eingeloggt');
      return;
    }

    this.activeMainTab = getTabQueryParam() || 'informationen';

    await loadAllData(this);
    this.updateBreadcrumb();

    await this.render();
    this.bind();
  }

  updateBreadcrumb() {
    if (window.breadcrumbSystem && this.user) {
      window.breadcrumbSystem.updateDetailLabel(this.user.name || 'Unbekannt', {
        id: 'btn-edit-profile',
        canEdit: true
      });
    }
  }

  async render() {
    renderProfilePage(this);
  }

  bind() {
    bindProfileDetail(this);
  }

  openEditDrawer() {
    openProfileEditDrawer(this);
  }

  /** Nach dem Speichern: Userdaten neu laden und Seite neu aufbauen */
  async reloadAndRender() {
    await loadUserData(this);
    await this.render();
    this.bind();
  }

  destroy() {
    unbindProfileDetail(this);

    const container = document.getElementById('dashboard-content');
    const mainWrapper = container?.closest('.profile-page-container');
    if (mainWrapper) {
      mainWrapper.classList.remove('profile-page-container');
      mainWrapper.classList.add('main-wrapper');
    }
  }
}

export const profileDetailV2 = new ProfileDetailV2();
