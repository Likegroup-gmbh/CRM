// CurrentUser.js
// Robuste Aufloesung der internen benutzer.id fuer Audit-Felder.

export async function getCurrentBenutzerId() {
  if (window.currentUser?.id) {
    return window.currentUser.id;
  }

  const supabase = window.supabase;
  if (!supabase?.auth) {
    return null;
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const authUserId = authData?.user?.id;

    if (authError || !authUserId) {
      if (authError) console.warn('⚠️ Aktueller Auth-User konnte nicht geladen werden:', authError.message);
      return null;
    }

    const { data: benutzer, error: benutzerError } = await supabase
      .from('benutzer')
      .select('id, name, rolle, freigeschaltet, auth_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (benutzerError) {
      console.warn('⚠️ Aktueller Benutzer konnte nicht geladen werden:', benutzerError.message);
      return null;
    }

    if (benutzer?.id) {
      window.currentUser = {
        ...(window.currentUser || {}),
        ...benutzer
      };
      return benutzer.id;
    }
  } catch (error) {
    console.warn('⚠️ Fehler beim Aufloesen des aktuellen Benutzers:', error);
  }

  return null;
}
