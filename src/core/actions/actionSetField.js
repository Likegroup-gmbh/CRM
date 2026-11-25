// actionSetField.js
// Generisches Feld-Update plus Rechnungs-Notiz und Benutzer-Klasse

import { rechnungNotizModal } from '../../modules/rechnung/RechnungNotizModal.js';

const ENTITY_ALIASES = { mitarbeiter: 'benutzer' };

export async function setField(dropdown, entityType, entityId, fieldName, fieldValue) {
  try {
    entityType = ENTITY_ALIASES[entityType] || entityType;

    if (entityType === 'rechnung' && fieldName === 'status') {
      const interceptResult = await handleRechnungNotizIntercept(entityId, fieldValue);
      if (interceptResult === 'cancelled') return;
    }

    if (window.supabase) {
      const table = window.dataService?.entities?.[entityType]?.table || entityType;
      let payload = { [fieldName]: fieldValue };
      if (entityType === 'benutzer' && fieldName === 'mitarbeiter_klasse_id') {
        if (fieldValue === '__investor__') {
          payload = { rolle: 'investor', freigeschaltet: true, mitarbeiter_klasse_id: null };
        } else {
          const { data: current } = await window.supabase
            .from('benutzer')
            .select('rolle')
            .eq('id', entityId)
            .single();
          payload = { mitarbeiter_klasse_id: fieldValue };
          if (current?.rolle === 'investor') payload.rolle = 'mitarbeiter';
        }
      }
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

async function handleRechnungNotizIntercept(rechnungId, newStatus) {
  if (newStatus === 'Rückfrage') {
    const result = await rechnungNotizModal.open({ rechnungId, mode: 'create' });
    if (result.action === 'save' && result.text) {
      await rechnungNotizModal.saveNotiz(rechnungId, result.text);
    }
    return 'proceed';
  }

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
