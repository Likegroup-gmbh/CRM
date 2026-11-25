// ProfileDetailEvents.js
// Event-Bindings der Profilseite (Tabs, Breadcrumb-Edit, Edit-Button)

import { activateSecondaryNavTab } from '../../core/TabUtils.js';

export function bindProfileDetail(detail) {
  detail._abortController?.abort();
  detail._abortController = new AbortController();
  const { signal } = detail._abortController;

  detail.bindSidebarTabs();

  document.querySelectorAll('.secondary-nav [data-main-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = e.currentTarget.dataset.mainTab;
      if (!tab) return;
      detail.activeMainTab = tab;
      activateSecondaryNavTab(tab, { dataAttr: 'data-main-tab' });
    }, { signal });
  });

  window.addEventListener('breadcrumbEditClick', (e) => {
    if (e.detail?.buttonId === 'btn-edit-profile') {
      detail.openEditDrawer();
    }
  }, { signal });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="edit-profile"]')) {
      e.preventDefault();
      detail.openEditDrawer();
    }
  }, { signal });
}

export function unbindProfileDetail(detail) {
  detail._abortController?.abort();
  detail._abortController = null;
}
