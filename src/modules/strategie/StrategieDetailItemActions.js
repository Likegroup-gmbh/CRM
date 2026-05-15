// StrategieDetailItemActions.js
// Item-Aktionen: Löschen, Video-Verknüpfung

import { strategieService } from './StrategieService.js';
import { AddToVideoDrawer } from './AddToVideoDrawer.js';

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

export async function handleAddToVideo(detail, itemId) {
  const item = detail.items.find(i => i.id === itemId);
  if (!item) {
    window.toastSystem?.show('Item nicht gefunden', 'error');
    return;
  }

  const drawer = new AddToVideoDrawer();
  await drawer.open(item, detail.strategie);
}

export async function handleUnlinkFromVideo(detail, itemId, videoId) {
  const result = await window.confirmationModal?.open({
    title: 'Verknüpfung entfernen?',
    message: 'Möchten Sie die Verknüpfung zwischen dieser Idee und dem Video wirklich entfernen?',
    confirmText: 'Entfernen',
    cancelText: 'Abbrechen',
    danger: true
  });

  if (!result?.confirmed) return;

  try {
    const { error } = await window.supabase
      .from('kooperation_videos')
      .update({ strategie_item_id: null })
      .eq('id', videoId);

    if (error) throw error;

    const item = detail.items.find(i => i.id === itemId);
    if (item) {
      item.linked_video = null;
    }

    window.toastSystem?.show('Verknüpfung erfolgreich entfernt', 'success');
    
    detail.rerenderItemsTable();

  } catch (error) {
    console.error('Fehler beim Entfernen der Verknüpfung:', error);
    window.toastSystem?.show('Fehler beim Entfernen der Verknüpfung', 'error');
  }
}
