// ActionsDropdownHandlers.js
// Action-Router. Navigation, Delete und setField leben in src/core/actions/.

import {
  handleInstagramConnect, toggleFreischaltung, handleRemoveZuordnung, addToFavorites,
  setStandardAdresse, setHauptadresseStandard, openRechnungAnpassenDrawer, handleRechnungDownload
} from './ActionsDropdownEffects.js';
import { openAddCreatorToCastingDrawer } from '../modules/creator-auswahl/AddCreatorToCastingDrawer.js';
import { handleView, handleEdit, handleContinue, dispatchVertragListAction } from './actions/actionNavigate.js';
import { handleDelete, confirmDelete } from './actions/actionDelete.js';
import { setField } from './actions/actionSetField.js';
import { setKampagneAbschluss } from './actions/kampagneAbschluss.js';
import { openPersonaCreateDrawer } from '../modules/persona/PersonaCreateDrawer.js';

export { setField };

// Menge der Cases in handleAction — Quelle für isKnownGlobalAction.
export const GLOBAL_ACTIONS = new Set([
  'view', 'edit', 'continue', 'delete', 'delete-liste', 'rename-liste',
  'creator-upload-send', 'creator-upload-resend', 'creator-upload-copy', 'creator-upload-revoke',
  'delete-strategie', 'view-strategie', 'edit-strategie', 'remove',
  'rechnung_anpassen', 'download', 'marken', 'auftraege', 'kampagnen',
  'task-create', 'quickview', 'assign-staff', 'assign_staff',
  'add_to_campaign', 'favorite', 'add_to_list', 'add_to_casting', 'connect',
  'add-signed', 'edit-signed', 'replace-signed', 'remove-signed',
  'generate-pdf',
  'vertrag-kooperationen',
  'vertrag-verknuepfen',
  'anschreiben',
  'add_ansprechpartner', 'add_ansprechpartner_kampagne', 'add_ansprechpartner_unternehmen',
  'add_produkt', 'add_persona',
  'remove_ansprechpartner_unternehmen', 'remove_ansprechpartner_link',
  'edit_creator_adresse', 'set_standard_adresse', 'set_hauptadresse_standard',
  'delete_creator_adresse', 'unassign-kampagne',
  'freischalten', 'details', 'auftrag-details',
  'abschliessen'
]);

export async function handleAction(dropdown, action, entityId, entityType, actionItem) {
  switch (action) {
    case 'view':
      await handleView(entityId, entityType);
      break;

    case 'edit':
      await handleEdit(entityId, entityType);
      break;

    case 'continue':
      handleContinue(entityId);
      break;

    case 'abschliessen':
      if (entityType === 'kampagne') {
        await setKampagneAbschluss(entityId, actionItem?.dataset?.abschluss === 'true');
      }
      break;

    case 'delete':
      await handleDelete(entityId, entityType);
      break;

    case 'delete-liste':
      if ((entityType === 'creator-auswahl' || entityType === 'creator_auswahl_liste') && window.creatorAuswahlList) {
        window.creatorAuswahlList.confirmDeleteListe(entityId);
      } else {
        await confirmDelete(entityId, entityType);
      }
      break;

    case 'rename-liste':
      if ((entityType === 'creator-auswahl' || entityType === 'creator_auswahl_liste') && window.creatorAuswahlList) {
        const currentName = actionItem?.dataset?.name || '';
        window.creatorAuswahlList.openRenameDrawer(entityId, currentName);
      }
      break;

    case 'creator-upload-send':
    case 'creator-upload-resend':
    case 'creator-upload-copy':
    case 'creator-upload-revoke': {
      const { handleCreatorUploadAction } = await import('../modules/kampagne/CreatorUploadActions.js');
      await handleCreatorUploadAction(action, actionItem);
      break;
    }

    case 'delete-strategie':
      if (window.strategieList) {
        window.strategieList.confirmDeleteStrategie(entityId);
      } else {
        await confirmDelete(entityId, 'strategie');
      }
      break;

    case 'view-strategie':
      window.navigateTo(`/konzepte/${entityId}`);
      break;

    case 'edit-strategie':
      window.navigateTo(`/konzepte/${entityId}/edit`);
      break;

    case 'remove':
      await handleRemoveZuordnung(entityId, entityType);
      break;

    case 'rechnung_anpassen':
      await openRechnungAnpassenDrawer(entityId, { teilrechnungId: actionItem?.dataset?.teilrechnungId || null });
      break;

    case 'download':
      if (entityType === 'vertraege') {
        dispatchVertragListAction('download', entityId);
      } else if (entityType === 'rechnung') {
        await handleRechnungDownload(entityId);
      }
      break;

    case 'marken':
      window.navigateTo(`/unternehmen/${entityId}/marken`);
      break;

    case 'auftraege':
      window.navigateTo(`/unternehmen/${entityId}/auftraege`);
      break;

    case 'kampagnen':
      window.navigateTo(`/auftrag/${entityId}/kampagnen`);
      break;

    case 'task-create':
      if (entityType === 'kooperation' && window.taskDetailDrawer) {
        window.taskDetailDrawer.open(null, { entity_type: 'kooperation', entity_id: entityId });
      }
      break;

    case 'quickview':
      dropdown.openKooperationQuickView(entityId);
      break;

    case 'assign-staff':
      if (!window.canManageStaff()) {
        alert('Nur Admins dürfen Mitarbeiter zuordnen.');
        break;
      }
      dropdown.openAssignStaffModal(entityId);
      break;

    case 'assign_staff':
      if (entityType === 'marke') {
        if (!window.canManageStaff()) {
          alert('Nur Admins dürfen Mitarbeiter zuordnen.');
          break;
        }
        dropdown.openAssignMarkeStaffModal(entityId);
      }
      break;

    case 'add_to_campaign':
      dropdown.openAddToCampaignModal(entityId);
      break;

    case 'favorite': {
      const kampagneId = document.querySelector('[data-kampagne-id]')?.dataset?.kampagneId;
      await addToFavorites(dropdown, entityId, kampagneId);
      break;
    }

    case 'add_to_list':
      dropdown.openAddToListModal(entityId);
      break;

    case 'add_to_casting':
      openAddCreatorToCastingDrawer(entityId);
      break;

    case 'connect':
      if (entityType === 'creator') {
        await handleInstagramConnect(entityId);
      }
      break;

    case 'add-signed':
    case 'edit-signed':
    case 'replace-signed':
    case 'remove-signed':
      window.dispatchEvent(new CustomEvent('vertrag-signed-action', {
        detail: { action, vertragId: entityId }
      }));
      break;

    case 'generate-pdf':
      if (entityType === 'vertraege') {
        dispatchVertragListAction('generate-pdf', entityId);
      }
      break;

    case 'vertrag-kooperationen':
      if (entityType === 'vertraege') {
        dispatchVertragListAction('vertrag-kooperationen', entityId);
      }
      break;

    case 'vertrag-verknuepfen': {
      const { openVertragVerknuepfen } = await import('../modules/vertrag/deckung/VertragDeckungDrawer.js');
      await openVertragVerknuepfen(entityId, () => {
        window.dispatchEvent(new Event('softRefresh'));
      });
      break;
    }

    case 'anschreiben':
      window.dispatchEvent(new CustomEvent('vertrag-anschreiben-action', {
        detail: { vertragId: entityId }
      }));
      break;

    case 'add_ansprechpartner':
      dropdown.openAddAnsprechpartnerModal(entityId);
      break;

    case 'add_ansprechpartner_kampagne':
      dropdown.openAddAnsprechpartnerToKampagneModal(entityId);
      break;

    case 'add_ansprechpartner_unternehmen':
      dropdown.openAddAnsprechpartnerToUnternehmenModal(entityId);
      break;

    case 'add_produkt':
      window.navigateTo(`/${entityType}/${entityId}/produkt`);
      break;

    case 'add_persona': {
      if (entityType === 'marke') {
        const detail = window.moduleRegistry?.modules?.get('marke-detail');
        openPersonaCreateDrawer({
          origin: 'marke',
          marke_id: entityId,
          unternehmen_id: detail?.marke?.unternehmen_id || null,
          unternehmenName: detail?.marke?.unternehmen?.firmenname || null,
          markeName: detail?.marke?.markenname || null
        });
      } else {
        const detail = window.moduleRegistry?.modules?.get('unternehmen-detail');
        openPersonaCreateDrawer({
          origin: 'unternehmen',
          unternehmen_id: entityId,
          unternehmenName: detail?.unternehmen?.firmenname || null
        });
      }
      break;
    }

    case 'remove_ansprechpartner_unternehmen':
      dropdown.openRemoveAnsprechpartnerFromUnternehmenModal(entityId);
      break;

    case 'remove_ansprechpartner_link': {
      if (entityType === 'ansprechpartner_unternehmen') {
        const unternehmenId = window.moduleRegistry?.modules?.get('unternehmen-detail')?.unternehmenId;
        if (unternehmenId && confirm('Möchten Sie diesen Ansprechpartner wirklich vom Unternehmen entfernen?')) {
          await dropdown.removeAnsprechpartnerFromUnternehmen(entityId, unternehmenId);
          window.dispatchEvent(new CustomEvent('entityUpdated', {
            detail: { entity: 'ansprechpartner', action: 'removed', unternehmenId }
          }));
        }
      }
      break;
    }

    case 'edit_creator_adresse':
      if (entityType === 'creator_adresse') {
        const creatorId = window.moduleRegistry?.modules?.get('creator-detail')?.creatorId;
        if (creatorId) {
          window.creatorAdressenManager?.openEdit(creatorId, entityId);
        }
      }
      break;

    case 'set_standard_adresse':
      if (entityType === 'creator_adresse') {
        const creatorId = window.moduleRegistry?.modules?.get('creator-detail')?.creatorId;
        if (creatorId && confirm('Möchten Sie diese Adresse als Standard-Adresse festlegen?')) {
          await setStandardAdresse(entityId, creatorId);
        }
      }
      break;

    case 'set_hauptadresse_standard':
      if (entityType === 'creator_hauptadresse') {
        const creatorId = entityId;
        if (confirm('Möchten Sie die Hauptadresse als Standard-Adresse festlegen?')) {
          await setHauptadresseStandard(creatorId);
        }
      }
      break;

    case 'delete_creator_adresse':
      if (entityType === 'creator_adresse') {
        const creatorId = window.moduleRegistry?.modules?.get('creator-detail')?.creatorId;
        if (creatorId) {
          window.creatorAdressenManager?.deleteAdresse(entityId, creatorId);
        }
      }
      break;

    case 'unassign-kampagne': {
      const mitarbeiterId = actionItem?.dataset?.mitarbeiterId || window.location.pathname.split('/').pop();
      if (!mitarbeiterId) { alert('Mitarbeiter-ID nicht gefunden'); break; }
      const kampagneId = entityId;
      if (!kampagneId) break;

      let confirmed = false;
      if (window.confirmationModal) {
        const res = await window.confirmationModal.open({
          title: 'Zuweisung entfernen',
          message: 'Zuweisung dieser Kampagne vom Mitarbeiter entfernen?',
          confirmText: 'Entfernen', cancelText: 'Abbrechen', danger: true
        });
        confirmed = res?.confirmed;
      } else {
        confirmed = confirm('Zuweisung dieser Kampagne vom Mitarbeiter entfernen?');
      }
      if (!confirmed) break;

      try {
        const { error } = await window.supabase
          .from('kampagne_mitarbeiter')
          .delete()
          .eq('mitarbeiter_id', mitarbeiterId)
          .eq('kampagne_id', kampagneId);
        if (error) throw error;

        const row = actionItem.closest('tr');
        if (row) row.remove();

        const countEl = document.querySelector('.tab-button[data-tab="kampagnen"] .tab-count');
        if (countEl) {
          const current = parseInt(countEl.textContent || '1', 10);
          countEl.textContent = String(Math.max(0, current - 1));
        }

        if (window.mitarbeiterDetail?.load) {
          await window.mitarbeiterDetail.load();
          await window.mitarbeiterDetail.render();
        }

        alert('Zuweisung entfernt');
      } catch (err) {
        console.error('Zuweisung entfernen fehlgeschlagen:', err);
        alert(`Entfernen fehlgeschlagen: ${err.message}`);
      }
      break;
    }

    case 'freischalten':
      await toggleFreischaltung(entityId);
      break;

    case 'details':
    case 'auftrag-details':
      window.navigateTo('/projekt-erstellen');
      break;

    default:
      console.warn(`Unbekannte Action: ${action}`);
  }
}
