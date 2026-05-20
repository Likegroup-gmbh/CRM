// MitarbeiterDetailPermissions.js
// Auto-Save für Berechtigungs-Toggles

export async function autoSavePermissions(detail) {
  if (!detail.user?.freigeschaltet) return;

  try {
    const viewToggles = document.querySelectorAll('.perm-toggle');
    const editToggles = document.querySelectorAll('.perm-edit-toggle');

    let updated = {};
    viewToggles.forEach(t => {
      const key = t.dataset.key;
      if (!updated[key]) updated[key] = {};
      updated[key].can_view = !!t.checked;
    });
    editToggles.forEach(t => {
      const key = t.dataset.key;
      if (!updated[key]) updated[key] = {};
      updated[key].can_edit = !!t.checked;
    });

    const { error } = await window.supabase
      .from('benutzer')
      .update({ zugriffsrechte: updated })
      .eq('id', detail.userId);

    if (error) {
      console.error('Auto-Save Rechte fehlgeschlagen', error);
      alert('Fehler beim Speichern der Rechte');
      return;
    }

    detail.user.zugriffsrechte = updated;

  } catch (err) {
    console.error('Auto-Save Rechte Fehler', err);
    alert('Fehler beim Speichern der Rechte');
  }
}
