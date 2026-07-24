// ActionsDropdownHandlers.js
// Action-Switch, Delete, Field-Updates, Rechnungs-/Adress-Hilfen

import { deleteVideoFull, deleteDropboxCascade } from './VideoDeleteHelper.js';
import { deleteUnternehmenCascade, collectDependentIds } from '../modules/unternehmen/services/UnternehmenDeleteService.js';
import { rechnungNotizModal } from '../modules/rechnung/RechnungNotizModal.js';
import { getSignedDocumentUrl, resolveDocumentUrl } from './DocumentUrlHelper.js';

// Entity-Types, die keine eigene DB-Tabelle haben und auf eine andere Entity gemappt werden
const ENTITY_ALIASES = { mitarbeiter: 'benutzer' };

function getEntityDisplayName(entityType) {
  const names = {
    creator: 'den Creator',
    unternehmen: 'das Unternehmen',
    marke: 'die Marke',
    auftrag: 'den Auftrag',
    auftragsdetails: 'die Auftragsdetails',
    auftrag_details: 'die Auftragsdetails',
    kooperation: 'die Kooperation',
    briefing: 'das Briefing',
    kampagne: 'die Kampagne'
  };
  return names[entityType] || 'das Element';
}

export async function handleAction(dropdown, action, entityId, entityType, actionItem) {
  switch (action) {
    case 'view':
      if (entityType === 'contract') {
        window.navigateTo(`/contracts/${entityId}`);
      } else {
        window.navigateTo(`/${entityType}/${entityId}`);
      }
      break;

    case 'edit':
      if (entityType === 'auftrag' || entityType === 'contract') {
        window.navigateTo(`/projekt-erstellen/edit/${entityId}`);
        break;
      }
      if (entityType === 'auftragsdetails') {
        const auftragId = await resolveAuftragIdForDetails(entityId);
        if (auftragId) {
          window.navigateTo(`/projekt-erstellen/edit/${auftragId}`);
          break;
        }
      }
      if (entityType === 'kampagne') {
        const auftragId = await resolveAuftragIdForKampagne(entityId);
        if (auftragId) {
          window.navigateTo(`/projekt-erstellen/edit/${auftragId}?step=kampagnen`);
          break;
        }
      }
      {
        const returnTo = actionItem?.dataset?.returnTo;
        const editRoute = returnTo
          ? `/${entityType}/${entityId}/edit?returnTo=${encodeURIComponent(returnTo)}`
          : `/${entityType}/${entityId}/edit`;
        window.navigateTo(editRoute);
      }
      break;

    case 'continue':
      window.navigateTo(`/vertraege/${entityId}/edit`);
      break;

    case 'delete':
      if (entityType === 'vertraege') {
        const vertraegeModule = window.moduleRegistry?.modules?.get('vertraege');
        if (vertraegeModule?.deleteVertrag) {
          vertraegeModule.deleteVertrag(entityId);
        }
      } else if (entityType === 'contract') {
        await confirmDelete(entityId, 'auftrag');
      } else {
        await confirmDelete(entityId, entityType);
      }
      break;

    case 'delete-liste':
      if (entityType === 'creator-auswahl' && window.creatorAuswahlList) {
        window.creatorAuswahlList.confirmDeleteListe(entityId);
      } else {
        await confirmDelete(entityId, entityType);
      }
      break;

    case 'rename-liste':
      if (entityType === 'creator-auswahl' && window.creatorAuswahlList) {
        const currentName = actionItem?.dataset?.name || '';
        window.creatorAuswahlList.openRenameDrawer(entityId, currentName);
      }
      break;

    case 'delete-strategie':
      if (window.strategieList) {
        window.strategieList.confirmDeleteStrategie(entityId);
      } else {
        await confirmDelete(entityId, 'strategie');
      }
      break;

    case 'view-strategie':
      window.navigateTo(`/strategie/${entityId}`);
      break;

    case 'edit-strategie':
      window.navigateTo(`/strategie/${entityId}/edit`);
      break;

    case 'remove':
      await handleRemoveZuordnung(entityId, entityType);
      break;

    case 'rechnung_anpassen':
      await openRechnungAnpassenDrawer(entityId);
      break;

    case 'download':
      if (entityType === 'rechnung') {
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

    case 'rechnung':
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

    case 'add_ansprechpartner':
      dropdown.openAddAnsprechpartnerModal(entityId);
      break;

    case 'add_ansprechpartner_kampagne':
      dropdown.openAddAnsprechpartnerToKampagneModal(entityId);
      break;

    case 'add_ansprechpartner_unternehmen':
      dropdown.openAddAnsprechpartnerToUnternehmenModal(entityId);
      break;

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

    case 'video-view':
      window.navigateTo(`/video/${entityId}`);
      break;
    case 'video-edit':
      window.navigateTo(`/video/${entityId}`);
      break;
    case 'video-delete': {
      const message = 'Möchten Sie wirklich dieses Video löschen? Diese Aktion kann nicht rückgängig gemacht werden.';
      let proceed = false;
      if (window.confirmationModal) {
        const res = await window.confirmationModal.open({ title: 'Löschvorgang bestätigen', message, confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true });
        proceed = !!res?.confirmed;
      } else {
        proceed = confirm(message);
      }
      if (!proceed) break;
      const result = await deleteVideoFull(entityId);
      if (result?.success) {
        window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kooperation_videos', action: 'deleted', id: entityId } }));
      } else {
        console.error('Video-Löschung fehlgeschlagen:', result?.error);
        alert('Video konnte nicht gelöscht werden: ' + (result?.error || 'Unbekannter Fehler'));
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
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Keine aktive Sitzung');

    const response = await fetch('/.netlify/functions/instagram-connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
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

// Instagram Connect/Refresh: holt Profil-Daten via Netlify Function in die creator-Tabelle
async function handleInstagramConnect(creatorId) {
  window.toastSystem?.show('Instagram-Daten werden geladen...', 'info');

  try {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Keine aktive Sitzung');

    const response = await fetch('/.netlify/functions/instagram-connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
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
    window.toastSystem?.show(`Instagram-Connect fehlgeschlagen: ${err.message}`, 'error');
  }
}

// Freischalten/Sperren eines Benutzers (Mitarbeiter-Liste)
// Gleiche Rollenlogik wie MitarbeiterDetailEvents: pending <-> mitarbeiter
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
    } else {
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

async function resolveAuftragIdForDetails(detailsId) {
  if (!detailsId || !window.supabase) return null;
  try {
    const { data, error } = await window.supabase
      .from('auftrag_details')
      .select('auftrag_id')
      .eq('id', detailsId)
      .single();
    if (error) throw error;
    return data?.auftrag_id || null;
  } catch {
    return null;
  }
}

async function resolveAuftragIdForKampagne(kampagneId) {
  if (!kampagneId || !window.supabase) return null;
  try {
    const { data, error } = await window.supabase
      .from('kampagne')
      .select('auftrag_id')
      .eq('id', kampagneId)
      .single();
    if (error) throw error;
    return data?.auftrag_id || null;
  } catch {
    return null;
  }
}

export async function setField(dropdown, entityType, entityId, fieldName, fieldValue) {
  try {
    entityType = ENTITY_ALIASES[entityType] || entityType;

    // Rückfrage-Notiz Intercept für Rechnungen
    if (entityType === 'rechnung' && fieldName === 'status') {
      const interceptResult = await _handleRechnungNotizIntercept(entityId, fieldValue);
      if (interceptResult === 'cancelled') return;
    }

    if (window.supabase) {
      const table = window.dataService?.entities?.[entityType]?.table || entityType;
      const payload = { [fieldName]: fieldValue };
      if (window.dataService?.entities?.[entityType]?.fields?.updated_at) {
        payload.updated_at = new Date().toISOString();
      }
      const { error } = await window.supabase.from(table).update(payload).eq('id', entityId);
      if (error) throw error;
    } else if (window.dataService?.updateEntity) {
      const res = await window.dataService.updateEntity(entityType, entityId, { [fieldName]: fieldValue });
      if (!res?.success) throw new Error(res?.error || 'Update fehlgeschlagen');
    } else {
      throw new Error('Kein Update-Mechanismus verfügbar');
    }
    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: entityType, action: 'updated', id: entityId, field: fieldName, value: fieldValue }
    }));
  } catch (err) {
    console.error('setField fehlgeschlagen', err);
    alert('Aktualisierung fehlgeschlagen.');
  }
}

async function _handleRechnungNotizIntercept(rechnungId, newStatus) {
  if (newStatus === 'Rückfrage') {
    const result = await rechnungNotizModal.open({ rechnungId, mode: 'create' });
    if (result.action === 'save' && result.text) {
      await rechnungNotizModal.saveNotiz(rechnungId, result.text);
    }
    // Status-Wechsel passiert IMMER (Notiz ist optional)
    return 'proceed';
  }

  // Nur prüfen wenn Rechnung aktuell auf Rückfrage steht
  const { data: current } = await window.supabase
    .from('rechnung')
    .select('status')
    .eq('id', rechnungId)
    .single();
  if (current?.status !== 'Rückfrage') return 'proceed';

  const hasNotiz = await rechnungNotizModal.hasNotiz(rechnungId);
  if (hasNotiz) {
    const deleteConfirm = await window.confirmationModal.open({
      title: 'Rückfrage-Notiz löschen?',
      message: 'Diese Rechnung hat eine Rückfrage-Notiz. Soll die Notiz beim Status-Wechsel gelöscht werden?',
      confirmText: 'Ja, löschen',
      cancelText: 'Nein, behalten',
      danger: false
    });
    if (deleteConfirm?.confirmed) {
      await rechnungNotizModal.deleteNotiz(rechnungId);
    }
  }
  return 'proceed';
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

async function confirmDelete(entityId, entityType) {
  if (entityType === 'unternehmen') {
    return _confirmDeleteUnternehmen(entityId);
  }

  const entityName = getEntityDisplayName(entityType);
  const message = `Möchten Sie wirklich ${entityName} löschen? Diese Aktion kann nicht rückgängig gemacht werden.`;
  let proceed = false;
  if (window.confirmationModal) {
    const res = await window.confirmationModal.open({ title: 'Löschvorgang bestätigen', message, confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true });
    proceed = !!res?.confirmed;
  } else {
    proceed = confirm(message);
  }
  if (!proceed) return;

  if (entityType === 'kampagne' || entityType === 'kooperation') {
    await deleteDropboxCascade(entityType, entityId).catch(err =>
      console.warn('Dropbox-Cascade Warnung:', err)
    );
  }

  const result = await window.dataService.deleteEntity(entityType, entityId);
  if (result?.success) {
    window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: entityType, action: 'deleted', id: entityId } }));
  }
}

async function _confirmDeleteUnternehmen(entityId) {
  const LABELS = {
    vertraege: 'Verträge', briefings: 'Briefings', kampagne: 'Kampagnen',
    auftrag: 'Aufträge', produkt: 'Produkte', marke: 'Marken',
  };

  const deps = await collectDependentIds(entityId);
  const lines = Object.entries(deps)
    .filter(([, ids]) => ids.length > 0)
    .map(([table, ids]) => `• ${ids.length} ${LABELS[table] || table}`);

  const summary = lines.length > 0
    ? `Folgende zugehörige Daten werden unwiderruflich entfernt:\n\n${lines.join('\n')}\n\nInklusive aller Dropbox-Dateien und Storage-Dateien.`
    : 'Dieses Unternehmen hat keine zugehörigen Daten.';

  const message = `Möchten Sie wirklich das Unternehmen löschen?\n\n${summary}\n\nDiese Aktion kann nicht rückgängig gemacht werden.`;

  let proceed = false;
  if (window.confirmationModal) {
    const res = await window.confirmationModal.open({
      title: 'Unternehmen vollständig löschen', message,
      confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true,
    });
    proceed = !!res?.confirmed;
  } else {
    proceed = confirm(message);
  }
  if (!proceed) return;

  const progressModal = _createProgressModal();

  const result = await deleteUnternehmenCascade(entityId, {
    userId: window.currentUser?.id,
    onProgress: ({ step, count }) => {
      const stepLabels = { ...LABELS, storage: 'Storage-Dateien', dropbox: 'Dropbox-Dateien', unternehmen: 'Unternehmen' };
      progressModal.update(`Lösche ${stepLabels[step] || step} (${count})...`);
    },
  });

  progressModal.close();

  const deletedLines = Object.entries(result.deleted)
    .map(([table, count]) => `✓ ${count} ${LABELS[table] || table}`);
  const errorLines = result.errors
    .map(e => `✗ ${e.step}: ${e.error}`);

  const resultMessage = [
    result.success ? 'Unternehmen wurde erfolgreich gelöscht.' : 'Unternehmen konnte nicht vollständig gelöscht werden.',
    '', ...deletedLines,
    ...(errorLines.length > 0 ? ['', 'Fehlgeschlagen:', ...errorLines] : []),
  ].join('\n');

  if (window.confirmationModal) {
    await window.confirmationModal.open({
      title: result.success ? 'Löschung abgeschlossen' : 'Löschung mit Fehlern',
      message: resultMessage, confirmText: 'OK', cancelText: 'Schließen', danger: !result.success,
    });
  } else {
    alert(resultMessage);
  }

  if (result.success) {
    window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'unternehmen', action: 'deleted', id: entityId } }));
  }
}

function _createProgressModal() {
  const modal = document.createElement('div');
  modal.className = 'modal overlay-modal';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header"><h3>Löschvorgang läuft...</h3></div>
      <div class="modal-body">
        <p class="delete-progress-text">Vorbereitung...</p>
        <div class="progress-bar-container" style="width:100%;height:4px;background:var(--border-color,#e0e0e0);border-radius:2px;margin-top:12px;overflow:hidden">
          <div class="progress-bar-fill" style="width:0%;height:100%;background:var(--primary-color,#3b82f6);transition:width 0.3s"></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  let stepCount = 0;
  return {
    update(text) {
      stepCount++;
      const textEl = modal.querySelector('.delete-progress-text');
      const barEl = modal.querySelector('.progress-bar-fill');
      if (textEl) textEl.textContent = text;
      if (barEl) barEl.style.width = `${Math.min(stepCount * 14, 95)}%`;
    },
    close() { modal.remove(); },
  };
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
          // Privater Bucket: kurzlebige Signed URL statt Public URL
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
