// MitarbeiterDetailActions.js
// Supabase-Persistenz: Rolle, Unternehmen, Firmenhandy

export async function updateUnternehmenRole(detail, unternehmenId, newRole) {
  try {
    const { error } = await window.supabase
      .from('mitarbeiter_unternehmen')
      .update({ role: newRole })
      .eq('mitarbeiter_id', detail.userId)
      .eq('unternehmen_id', unternehmenId);

    if (error) throw error;

    const u = detail.zugeordnet.unternehmen.find(u => u.id === unternehmenId);
    if (u) u.role = newRole;

  } catch (err) {
    console.error('Rolle ändern fehlgeschlagen', err);
  }
}

export async function removeUnternehmen(detail, unternehmenId) {
  try {
    const { error } = await window.supabase
      .from('mitarbeiter_unternehmen')
      .delete()
      .eq('mitarbeiter_id', detail.userId)
      .eq('unternehmen_id', unternehmenId);

    if (error) throw error;

    await detail.load();
    await detail.render();
    detail.bind();
  } catch (err) {
    console.error('Entfernen fehlgeschlagen', err);
  }
}

export async function saveFirmenhandyFromForm(detail) {
  try {
    const landId = document.getElementById('firmenhandy-land')?.value || null;
    const nummer = document.getElementById('firmenhandy-nummer')?.value?.trim() || null;

    if (nummer && !landId) return;

    const { error } = await window.supabase
      .from('benutzer')
      .update({
        telefonnummer_firmenhandy: nummer,
        telefonnummer_firmenhandy_land_id: landId
      })
      .eq('id', detail.userId);

    if (error) throw error;

    detail.user.telefonnummer_firmenhandy = nummer;
    detail.user.telefonnummer_firmenhandy_land_id = landId;
    detail.user.telefonnummer_firmenhandy_land = (detail.euLaender || []).find(land => land.id === landId) || null;

    await detail.render();
    detail.bind();
  } catch (error) {
    console.error('Firmenhandy speichern fehlgeschlagen', error);
  }
}
