// StrategieDetailItemActions.js
// Item-Aktionen: Löschen

import { strategieService } from './StrategieService.js';

export async function handleDeleteItem(detail, itemId) {
  const result = await window.confirmationModal?.open({
    title: 'Item löschen?',
    message: 'Möchten Sie dieses Video wirklich aus der Strategie entfernen?',
    confirmText: 'Löschen',
    cancelText: 'Abbrechen',
    danger: true
  });

  if (!result?.confirmed) return;

  try {
    await strategieService.deleteStrategieItem(itemId);
    window.toastSystem?.show('Item erfolgreich gelöscht', 'success');
    await detail.init(detail.strategieId);
  } catch (error) {
    console.error('Fehler beim Löschen des Items:', error);
    window.toastSystem?.show('Fehler beim Löschen', 'error');
  }
}
