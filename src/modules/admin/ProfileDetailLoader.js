// ProfileDetailLoader.js
// Lädt Benutzerdaten, Länderliste und rollenabhängig die zugeordneten Entitäten

import { loadKundeEntities, loadMitarbeiterEntities } from './ProfileDetailEntityLoader.js';

const USER_SELECT_WITH_PHONE = `
  *,
  mitarbeiter_klasse:mitarbeiter_klasse_id(name, description),
  telefonnummer_firmenhandy_land:telefonnummer_firmenhandy_land_id(id, name_de, vorwahl, iso_code)
`;

const USER_SELECT_FALLBACK = `
  *,
  mitarbeiter_klasse:mitarbeiter_klasse_id(name, description)
`;

export async function loadAllData(detail) {
  await loadUserData(detail);
  await loadEuLaender(detail);
  await loadAssignedEntities(detail);
}

export async function loadUserData(detail) {
  try {
    let { data: user, error } = await window.supabase
      .from('benutzer')
      .select(USER_SELECT_WITH_PHONE)
      .eq('id', detail.userId)
      .single();

    if (error) {
      console.warn('⚠️ Profil-Ladung mit Firmenhandy-Feldern fehlgeschlagen, nutze Fallback:', error.message);
      const fallbackResult = await window.supabase
        .from('benutzer')
        .select(USER_SELECT_FALLBACK)
        .eq('id', detail.userId)
        .single();
      user = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) throw error;
    detail.user = user || {};

    if (detail.user.sprachen_ids && detail.user.sprachen_ids.length > 0) {
      const { data: sprachen } = await window.supabase
        .from('sprachen')
        .select('name')
        .in('id', detail.user.sprachen_ids);
      detail.sprachen = sprachen || [];
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden des Profils:', error);
    window.ErrorHandler.handle(error, 'ProfileDetailV2.loadUserData');
  }
}

export async function loadEuLaender(detail) {
  try {
    const { data, error } = await window.supabase
      .from('eu_laender')
      .select('id, name_de, vorwahl, iso_code')
      .order('name_de', { ascending: true });

    if (error) throw error;
    detail.euLaender = data || [];
  } catch (error) {
    console.error('❌ Fehler beim Laden von EU-Ländern:', error);
    detail.euLaender = [];
  }
}

export async function loadAssignedEntities(detail) {
  const isKunde = detail.user?.rolle === 'kunde';

  try {
    if (isKunde) {
      await loadKundeEntities(detail);
    } else {
      await loadMitarbeiterEntities(detail);
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden der Entitäten:', error);
  }
}
