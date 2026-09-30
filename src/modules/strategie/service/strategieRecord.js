import { assertBriefingForCreate, assertBriefingLinkLock } from '../../briefing/BriefingLinkGuard.js';
import { getAllowedKampagneIds } from './strategieAccess.js';
import { extractStoragePath } from './strategieScreenshots.js';

/**
 * Strategie nach ID abrufen
 * Prüft Zugriffsberechtigungen basierend auf Kampagnen-Zuordnung
 */
export async function getStrategieById(id, { skipAccessCheck = false } = {}) {
  const { data, error } = await window.supabase
    .from('strategie')
    .select(`
      *,
      unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url),
      marke:marke_id(id, markenname, logo_url, unternehmen:unternehmen_id(internes_kuerzel)),
      kampagne:kampagne_id(id, kampagnenname, eigener_name),
      auftrag:auftrag_id(id, auftragsname),
      created_by_user:created_by(id, name, profile_image_url)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Fehler beim Abrufen der Strategie:', error);
    throw error;
  }

  // Berechtigungsprüfung für Nicht-Admins
  // Gäste (Share-Link): Zugriff wird serverseitig via RLS auf die geteilte Liste beschränkt.
  // Eingebettet in der Produktion: die Seite ist schon geladen, RLS filtert den Select.
  const user = window.currentUser;

  if (!skipAccessCheck && !window.isAdmin() && !window.isInvestor?.() && !window.isGast?.() && data?.kampagne_id) {
    const allowedKampagneIds = await getAllowedKampagneIds(user);

    if (!allowedKampagneIds.includes(data.kampagne_id)) {
      console.warn('🔐 Zugriff verweigert: Benutzer hat keinen Zugriff auf diese Strategie');
      throw new Error('Keine Berechtigung für dieses Konzept');
    }
  }

  return data;
}

/**
 * Strategie anlegen, ohne Casting-Verknüpfung.
 * Gibt den Datensatz und die optionale Casting-ID zurück. Die Fassade setzt
 * das Paar danach über linkCasting, sonst entstünde ein halbes Paar.
 */
export async function insertStrategie(strategieData) {
  // Berechtigungsprüfung: Kunden dürfen keine Strategien erstellen
  if (window.isKunde()) {
    console.warn('🔐 Kunden dürfen keine Strategien erstellen');
    throw new Error('Keine Berechtigung zum Erstellen von Konzepten');
  }

  // Leere Strings in UUID-Feldern zu null konvertieren
  const uuidFields = ['unternehmen_id', 'marke_id', 'kampagne_id', 'produktion_id', 'auftrag_id', 'briefing_id'];
  for (const field of uuidFields) {
    if (strategieData[field] === '') {
      strategieData[field] = null;
    }
  }

  await assertBriefingForCreate(strategieData, 'Konzept');

  // Optionale Casting-Verknuepfung (ADR 0010): laeuft nie direkt in den
  // Insert, sondern wird danach ueber linkCasting beidseitig gesetzt -
  // sonst entstuende ein halbes Paar (nur eine Seite geschrieben).
  const { creator_auswahl_id: castingId, ...insertData } = strategieData;

  const { data, error } = await window.supabase
    .from('strategie')
    .insert({
      ...insertData,
      created_by: window.currentUser?.id
    })
    .select()
    .single();

  if (error) {
    console.error('Fehler beim Erstellen der Strategie:', error);
    throw error;
  }

  return { data, castingId };
}

/**
 * Strategie aktualisieren
 * Nur für Admins und Mitarbeiter - Kunden dürfen Strategien nicht bearbeiten
 */
export async function updateStrategie(id, updates) {
  // Berechtigungsprüfung: Kunden dürfen Strategien nicht bearbeiten
  if (window.isKunde()) {
    console.warn('🔐 Kunden dürfen Strategien nicht bearbeiten');
    throw new Error('Keine Berechtigung zum Bearbeiten von Konzepten');
  }

  // Leere Strings in UUID-Feldern zu null konvertieren
  const uuidFields = ['unternehmen_id', 'marke_id', 'kampagne_id', 'produktion_id', 'auftrag_id', 'briefing_id'];
  for (const field of uuidFields) {
    if (updates[field] === '') {
      updates[field] = null;
    }
  }

  await assertBriefingLinkLock('strategie', id, updates);

  const { data, error } = await window.supabase
    .from('strategie')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Fehler beim Aktualisieren der Strategie:', error);
    throw error;
  }

  return data;
}

/**
 * Strategie löschen (inkl. aller Items und Screenshots)
 * Berechtigungsprüfung über Permission-System
 */
export async function deleteStrategie(id) {
  // Berechtigungsprüfung über Permission-System
  const canDelete = window.currentUser?.permissions?.strategie?.can_delete || false;
  if (!canDelete) {
    console.warn('🔐 Keine Berechtigung zum Löschen von Konzepten');
    throw new Error('Keine Berechtigung zum Löschen von Konzepten');
  }

  console.log('🗑️ Lösche Strategie:', id);

  // Zuerst alle Items dieser Strategie abrufen um Screenshots zu löschen
  const { data: items, error: fetchError } = await window.supabase
    .from('strategie_items')
    .select('id, screenshot_url')
    .eq('strategie_id', id);

  if (fetchError) {
    console.warn('Fehler beim Abrufen der Items:', fetchError);
  }

  console.log('📸 Gefundene Items:', items?.length || 0);

  // Screenshots aus dem Storage löschen
  if (items && items.length > 0) {
    const screenshotPaths = items
      .filter(item => item.screenshot_url)
      .map(item => extractStoragePath(item.screenshot_url))
      .filter(path => path);

    console.log('📸 Screenshot-Pfade zum Löschen:', screenshotPaths);

    if (screenshotPaths.length > 0) {
      const { error: storageError, data: storageData } = await window.supabase.storage
        .from('strategie-screenshots')
        .remove(screenshotPaths);

      if (storageError) {
        console.warn('❌ Fehler beim Löschen der Screenshots:', storageError);
      } else {
        console.log('✅ Screenshots gelöscht:', storageData);
      }
    }
  }

  // Items werden durch CASCADE automatisch gelöscht, aber zur Sicherheit:
  const { error: itemsError } = await window.supabase
    .from('strategie_items')
    .delete()
    .eq('strategie_id', id);

  if (itemsError) {
    console.warn('Fehler beim Löschen der Items:', itemsError);
  }

  // Strategie löschen
  const { error } = await window.supabase
    .from('strategie')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Fehler beim Löschen der Strategie:', error);
    throw error;
  }

  console.log('✅ Strategie erfolgreich gelöscht');
}
