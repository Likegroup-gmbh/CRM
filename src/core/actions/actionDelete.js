// actionDelete.js
// Bestätigungsdialog + entity-spezifische Löschung

import { deleteDropboxCascade } from '../VideoDeleteHelper.js';
import { deleteUnternehmenCascade, collectDependentIds } from '../../modules/unternehmen/services/UnternehmenDeleteService.js';
import { ProduktService } from '../../modules/produkt/ProduktService.js';
import { PersonaService } from '../../modules/persona/PersonaService.js';
import { dispatchVertragListAction } from './actionNavigate.js';

const ENTITY_DISPLAY_NAMES = {
  creator: 'den Creator',
  unternehmen: 'das Unternehmen',
  marke: 'die Marke',
  produkt: 'das Produkt',
  persona: 'die Persona',
  strategie: 'das Konzept',
  creator_auswahl: 'die Casting-Liste',
  auftrag: 'den Auftrag',
  auftragsdetails: 'die Auftragsdetails',
  auftrag_details: 'die Auftragsdetails',
  kooperation: 'die Kooperation',
  briefing: 'das Briefing',
  kampagne: 'die Kampagne',
  skripte: 'das Skript'
};

function getEntityDisplayName(entityType) {
  return ENTITY_DISPLAY_NAMES[entityType] || 'das Element';
}

export async function confirmDanger({
  title,
  message,
  confirmText = 'Endgültig löschen',
  cancelText = 'Abbrechen',
  danger = true
}) {
  if (window.confirmationModal) {
    const res = await window.confirmationModal.open({
      title, message, confirmText, cancelText, danger
    });
    return !!res?.confirmed;
  }
  return confirm(message);
}

export async function handleDelete(entityId, entityType) {
  if (entityType === 'produkt') {
    await confirmDeleteProdukt(entityId);
    return;
  }
  if (entityType === 'persona') {
    await confirmDeletePersona(entityId);
    return;
  }
  if (entityType === 'strategie') {
    await confirmDeleteStrategieStandalone(entityId);
    return;
  }
  if (entityType === 'creator_auswahl') {
    await confirmDeleteCreatorAuswahl(entityId);
    return;
  }
  if (entityType === 'vertraege') {
    dispatchVertragListAction('delete', entityId);
    return;
  }
  if (entityType === 'contract') {
    await confirmDelete(entityId, 'auftrag');
    return;
  }
  await confirmDelete(entityId, entityType);
}

export async function confirmDeleteProdukt(entityId) {
  const proceed = await confirmDanger({
    title: 'Löschvorgang bestätigen',
    message: 'Möchten Sie wirklich das Produkt löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
  });
  if (!proceed) return;

  try {
    await ProduktService.remove(entityId);
    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'produkt', action: 'deleted', id: entityId }
    }));
  } catch (err) {
    console.error('Produkt-Löschung fehlgeschlagen:', err);
    window.toastSystem?.error?.('Produkt konnte nicht gelöscht werden.');
  }
}

export async function confirmDeletePersona(entityId) {
  const proceed = await confirmDanger({
    title: 'Löschvorgang bestätigen',
    message: 'Möchten Sie wirklich die Persona löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
  });
  if (!proceed) return;

  try {
    await PersonaService.remove(entityId);
    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'persona', action: 'deleted', id: entityId }
    }));
  } catch (err) {
    console.error('Persona-Löschung fehlgeschlagen:', err);
    window.toastSystem?.error?.('Persona konnte nicht gelöscht werden.');
  }
}

export async function confirmDeleteStrategieStandalone(entityId) {
  const proceed = await confirmDanger({
    title: 'Konzept löschen',
    message: 'Möchten Sie dieses Konzept wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    confirmText: 'Löschen',
  });
  if (!proceed) return;

  try {
    const { error } = await window.supabase.from('strategie').delete().eq('id', entityId);
    if (error) throw error;
    window.toastSystem?.show('Konzept erfolgreich gelöscht', 'success');
    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'strategie', action: 'deleted', id: entityId }
    }));
    if (window.strategieList) {
      window.strategieList._forceReload = true;
      window.strategieList.strategien = [];
    }
  } catch (err) {
    console.error('Strategie-Löschung fehlgeschlagen:', err);
    window.toastSystem?.show('Fehler beim Löschen des Konzepts', 'error');
  }
}

export async function confirmDeleteCreatorAuswahl(entityId) {
  const proceed = await confirmDanger({
    title: 'Casting-Liste löschen',
    message: 'Möchten Sie diese Casting-Liste wirklich löschen? Alle zugeordneten Creator werden entfernt.',
    confirmText: 'Löschen',
  });
  if (!proceed) return;

  try {
    const { creatorAuswahlService } = await import('../../modules/creator-auswahl/CreatorAuswahlService.js');
    await creatorAuswahlService.deleteListe(entityId);
    window.toastSystem?.show('Casting-Liste erfolgreich gelöscht', 'success');
    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'creator_auswahl', action: 'deleted', id: entityId }
    }));
  } catch (err) {
    console.error('Sourcing-Löschung fehlgeschlagen:', err);
    window.toastSystem?.show('Fehler beim Löschen der Casting-Liste', 'error');
  }
}

export async function confirmDelete(entityId, entityType) {
  if (entityType === 'unternehmen') {
    return confirmDeleteUnternehmen(entityId);
  }

  const entityName = getEntityDisplayName(entityType);
  const proceed = await confirmDanger({
    title: 'Löschvorgang bestätigen',
    message: `Möchten Sie wirklich ${entityName} löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
  });
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

async function confirmDeleteUnternehmen(entityId) {
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

  const proceed = await confirmDanger({
    title: 'Unternehmen vollständig löschen',
    message: `Möchten Sie wirklich das Unternehmen löschen?\n\n${summary}\n\nDiese Aktion kann nicht rückgängig gemacht werden.`,
  });
  if (!proceed) return;

  const progressModal = createProgressModal();

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

function createProgressModal() {
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
