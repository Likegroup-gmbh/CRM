// ActionsDropdownHandlers.js
// Action-Router. Navigation, Delete und setField leben in src/core/actions/.

import { getSignedDocumentUrl, resolveDocumentUrl } from './DocumentUrlHelper.js';
import { authorizedFetch } from './auth/getAccessToken.js';
import { openAddCreatorToCastingDrawer } from '../modules/creator-auswahl/AddCreatorToCastingDrawer.js';
import { handleView, handleEdit, handleContinue, dispatchVertragListAction } from './actions/actionNavigate.js';
import { handleDelete, confirmDelete } from './actions/actionDelete.js';
import { setField } from './actions/actionSetField.js';
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
  'anschreiben',
  'add_ansprechpartner', 'add_ansprechpartner_kampagne', 'add_ansprechpartner_unternehmen',
  'add_produkt', 'add_persona',
  'remove_ansprechpartner_unternehmen', 'remove_ansprechpartner_link',
  'edit_creator_adresse', 'set_standard_adresse', 'set_hauptadresse_standard',
  'delete_creator_adresse', 'unassign-kampagne',
  'freischalten', 'details', 'auftrag-details'
]);

export async function handleAction(dropdown, action, entityId, entityType, actionItem) {
  switch (action) {
    case 'view':
      await handleView(entityId, entityType);
      break;

    case 'edit':
      await handleEdit(entityId, entityType, actionItem);
      break;

    case 'continue':
      handleContinue(entityId);
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
      await openRechnungAnpassenDrawer(entityId);
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

// Stiller Instagram-Connect für Bulk-Läufe: keine Toasts, Fehler nur in Konsole.
// Feuert bei Erfolg entityUpdated (→ Grid-Karte refresht sich einzeln).
// skip_brands spart bis zu 8 Graph-Calls pro Creator (Rate-Limit-Budget).
// @returns {Promise<{ok: boolean, retryable: boolean}>} retryable = Meta-Rate-Limit
export async function connectInstagramSilent(creatorId) {
  try {
    const response = await authorizedFetch('/.netlify/functions/instagram-connect', {
      method: 'POST',
      body: JSON.stringify({ creator_id: creatorId, skip_brands: true })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      const retryable = response.status === 429 || result.retryable === true;
      console.warn(`Bulk-Connect fehlgeschlagen für ${creatorId}:`, result.hint || result.error || 'Unbekannter Fehler');
      return { ok: false, retryable };
    }

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'creator', action: 'updated', id: creatorId }
    }));
    return { ok: true, retryable: false };
  } catch (err) {
    console.warn(`Bulk-Connect fehlgeschlagen für ${creatorId}:`, err);
    return { ok: false, retryable: false };
  }
}

async function handleInstagramConnect(creatorId) {
  window.toastSystem?.show('Instagram-Daten werden geladen...', 'info');

  try {
    const response = await authorizedFetch('/.netlify/functions/instagram-connect', {
      method: 'POST',
      body: JSON.stringify({ creator_id: creatorId })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      const message = result.hint || result.error || 'Unbekannter Fehler';
      window.toastSystem?.show(`Instagram-Connect fehlgeschlagen: ${message}`, 'error');
      return;
    }

    const follower = result.followers_count != null
      ? ` (${Number(result.followers_count).toLocaleString('de-DE')} Follower)`
      : '';
    window.toastSystem?.show(`@${result.username} verbunden${follower}`, 'success');

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'creator', action: 'updated', id: creatorId }
    }));
  } catch (err) {
    console.error('Instagram-Connect fehlgeschlagen:', err);
    if (err.sessionDead) return;
    window.toastSystem?.show(`Instagram-Connect fehlgeschlagen: ${err.message}`, 'error');
  }
}

async function toggleFreischaltung(userId) {
  try {
    const { data: user, error: loadError } = await window.supabase
      .from('benutzer')
      .select('freigeschaltet, rolle')
      .eq('id', userId)
      .single();
    if (loadError) throw loadError;

    const freischalten = !user.freigeschaltet;
    const updateData = { freigeschaltet: freischalten };
    if (freischalten) {
      if (user.rolle === 'pending') updateData.rolle = 'mitarbeiter';
    } else if (user.rolle !== 'admin' && user.rolle !== 'investor') {
      updateData.rolle = 'pending';
      updateData.zugriffsrechte = null;
    }

    const { error } = await window.supabase
      .from('benutzer')
      .update(updateData)
      .eq('id', userId);
    if (error) throw error;

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'benutzer', action: 'updated', id: userId, field: 'freigeschaltet', value: freischalten }
    }));
  } catch (err) {
    console.error('Freischaltung ändern fehlgeschlagen', err);
    alert('Freischaltung konnte nicht geändert werden.');
  }
}

async function handleRemoveZuordnung(entityId, entityType) {
  if (!window.kundenDetail?.kundeId) return;
  await window.kundenDetail.removeZuordnung(entityId, entityType);
}

export async function addToFavorites(dropdown, creatorId, kampagneId) {
  try {
    if (!kampagneId) {
      const match = window.location.pathname.match(/\/kampagne\/([0-9a-fA-F-]{36})/);
      kampagneId = match ? match[1] : null;
    }
    if (!kampagneId) {
      alert('Kampagne konnte nicht ermittelt werden.');
      return;
    }
    await window.supabase
      .from('kampagne_creator_favoriten')
      .insert({ kampagne_id: kampagneId, creator_id: creatorId });
    window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'favorite-added', id: kampagneId } }));
    alert('Zu Favoriten hinzugefügt.');
  } catch (err) {
    console.error('Fehler beim Hinzufügen zu Favoriten', err);
    alert('Hinzufügen zu Favoriten fehlgeschlagen.');
  }
}

async function setStandardAdresse(adresseId, creatorId) {
  try {
    const { error: resetError } = await window.supabase
      .from('creator_adressen')
      .update({ ist_standard: false })
      .eq('creator_id', creatorId);
    if (resetError) throw resetError;

    const { error: setError } = await window.supabase
      .from('creator_adressen')
      .update({ ist_standard: true })
      .eq('id', adresseId);
    if (setError) throw setError;

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'creator_adressen', creatorId }
    }));
  } catch (error) {
    console.error('Fehler beim Festlegen der Standard-Adresse:', error);
    throw error;
  }
}

async function setHauptadresseStandard(creatorId) {
  try {
    const { error: resetError } = await window.supabase
      .from('creator_adressen')
      .update({ ist_standard: false })
      .eq('creator_id', creatorId);
    if (resetError) throw resetError;

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'creator_adressen', creatorId }
    }));
  } catch (error) {
    console.error('Fehler beim Festlegen der Hauptadresse als Standard:', error);
    throw error;
  }
}

async function openRechnungAnpassenDrawer(auftragId) {
  try {
    const { RechnungAnpassenDrawer } = await import('/src/modules/auftrag/RechnungAnpassenDrawer.js');
    const drawer = new RechnungAnpassenDrawer();
    await drawer.open(auftragId);
  } catch (error) {
    console.error('Fehler beim Öffnen des Rechnung-Anpassen-Drawers:', error);
    alert('Fehler beim Öffnen: ' + (error.message || 'Unbekannter Fehler'));
  }
}

async function handleRechnungDownload(rechnungId) {
  try {
    const { data: pdfs, error: pdfErr } = await window.supabase
      .from('rechnung_pdfs')
      .select('id, file_name, file_path, file_url')
      .eq('rechnung_id', rechnungId);

    if (pdfErr) throw pdfErr;

    let downloadUrls = [];
    if (pdfs && pdfs.length > 0) {
      downloadUrls = await Promise.all(pdfs.map(async (p) => {
        let url = p.file_url || '';
        if (p.file_path && !p.file_path.startsWith('/')) {
          url = await getSignedDocumentUrl('rechnungen', p.file_path).catch(() => url);
        } else {
          url = await resolveDocumentUrl(url);
        }
        return { url, name: p.file_name };
      }));
    } else {
      const { data: rechnung, error } = await window.supabase
        .from('rechnung')
        .select('id, rechnung_nr, pdf_url')
        .eq('id', rechnungId)
        .single();
      if (error) throw error;
      if (!rechnung?.pdf_url) {
        window.toastSystem?.show('Keine PDF für diese Rechnung hinterlegt', 'warning');
        return;
      }
      downloadUrls = [{ url: await resolveDocumentUrl(rechnung.pdf_url), name: `Rechnung_${rechnung.rechnung_nr || rechnungId}.pdf` }];
    }

    window.toastSystem?.show('Download wird vorbereitet...', 'info');

    for (const pdf of downloadUrls) {
      const response = await fetch(pdf.url);
      if (!response.ok) throw new Error('PDF konnte nicht geladen werden');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = pdf.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(blobUrl);
    }

    window.toastSystem?.show(`${downloadUrls.length} PDF(s) heruntergeladen`, 'success');
  } catch (error) {
    console.error('Fehler beim Herunterladen der Rechnung:', error);
    window.toastSystem?.show('Fehler beim Herunterladen: ' + (error.message || 'Unbekannter Fehler'), 'error');
  }
}
