// ProfileSave.js
// Validierung und Speichern des Profils (Edit-Drawer)

import { dateInputValue } from './ProfileDetailFormat.js';
import { uploadProfileImage, validateProfileImage } from './ProfileImageService.js';

function setSaving(saveBtn, isSaving) {
  if (!saveBtn) return;
  saveBtn.classList.toggle('mdc-btn--loading', isSaving);
  saveBtn.disabled = isSaving;
}

/**
 * Liest und validiert die Formularfelder.
 * @returns {{ values: object }|{ error: string }}
 */
export function readProfileForm(root = document) {
  const name = root.getElementById('profile-name')?.value?.trim();
  if (!name) return { error: 'Bitte gib einen Namen ein.' };

  const geburtsdatum = dateInputValue(root.getElementById('profile-geburtsdatum')?.value) || null;
  const firmenhandy = root.getElementById('profile-firmenhandy')?.value?.trim() || null;
  const firmenhandyLandId = root.getElementById('profile-firmenhandy-land')?.value || null;

  if (firmenhandy && !firmenhandyLandId) {
    return { error: 'Bitte ein Land für das Firmenhandy auswählen.' };
  }

  return { values: { name, geburtsdatum, firmenhandy, firmenhandyLandId } };
}

function applyToLocalState(detail, { name, geburtsdatum, firmenhandy, firmenhandyLandId }) {
  detail.user.name = name;
  detail.user.geburtsdatum = geburtsdatum;
  detail.user.telefonnummer_firmenhandy = firmenhandy;
  detail.user.telefonnummer_firmenhandy_land_id = firmenhandyLandId;
  detail.user.telefonnummer_firmenhandy_land = detail.euLaender.find(land => land.id === firmenhandyLandId) || null;

  if (window.currentUser) {
    window.currentUser.name = name;
    window.currentUser.geburtsdatum = geburtsdatum;
    window.currentUser.telefonnummer_firmenhandy = firmenhandy;
    window.currentUser.telefonnummer_firmenhandy_land_id = firmenhandyLandId;
  }
}

export async function handleProfileSave(detail, closeDrawer) {
  const saveBtn = document.getElementById('profile-save-btn');

  const form = readProfileForm();
  if (form.error) {
    window.showToast?.(form.error, 'error');
    return;
  }
  const { values } = form;

  setSaving(saveBtn, true);

  try {
    const uploaderRoot = document.querySelector('.uploader[data-name="profile_image"]');
    const files = uploaderRoot?.__uploaderInstance?.files;

    if (files?.length > 0) {
      const file = files[0];
      const imageError = validateProfileImage(file);
      if (imageError) {
        window.showToast?.(imageError, 'error');
        return;
      }
      await uploadProfileImage(detail, file);
    }

    const { error } = await window.supabase
      .from('benutzer')
      .update({
        name: values.name,
        geburtsdatum: values.geburtsdatum,
        telefonnummer_firmenhandy: values.firmenhandy,
        telefonnummer_firmenhandy_land_id: values.firmenhandyLandId
      })
      .eq('id', detail.userId);

    if (error) throw error;

    applyToLocalState(detail, values);

    window.showToast?.('Profil erfolgreich aktualisiert.', 'success');
    closeDrawer();

    await detail.reloadAndRender();

    window.breadcrumbSystem?.updateDetailLabel(detail.user.name, {
      id: 'btn-edit-profile',
      canEdit: true
    });

    // Header UI aktualisieren (Initialen etc.)
    window.setupHeaderUI?.();
  } catch (error) {
    console.error('❌ handleProfileSave: Fehler beim Speichern:', error);
    window.showToast?.('Fehler beim Speichern: ' + (error?.message || error), 'error');
  } finally {
    setSaving(saveBtn, false);
  }
}
