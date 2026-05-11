// AgenturEditModal.js
// Legacy: Modal-Bearbeitung ersetzt durch Weiterleitung auf Management-Seite.

import { VertraegeCreate } from './VertraegeCreateCore.js';

VertraegeCreate.prototype.openAgenturEditModal = function(_creatorId) {
    const managementId = this.formData._management_id;
    if (managementId) {
      window.navigateTo(`/management/${managementId}`);
    } else {
      window.navigateTo('/management/new');
    }
};
