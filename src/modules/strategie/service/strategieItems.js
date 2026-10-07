import { authorizedFetch } from '../../../core/auth/getAccessToken.js';
import { VORSCHLAG_EDIT_FIELDS } from '../videoideeVorschlag.js';
import { assertKeinVorschlag } from './strategieItemGuards.js';
import { deleteScreenshot } from './strategieScreenshots.js';

const ITEM_RELATIONS = `
  creator:creator_id(id, vorname, nachname, instagram, tiktok),
  produkt:produkt_id(id, name),
  casting_eintrag:creator_auswahl_item_id(id, name, creator_id, link_instagram, link_tiktok, zusage, gebucht, creator:creator_id(id, vorname, nachname))
`;

// Kunde: keine Umsetzungsvorgabe. select * wuerde sie mitliefern.
const KUNDE_ITEM_COLUMNS = [
  'id', 'strategie_id', 'video_link', 'plattform', 'sortierung', 'teilbereich',
  'beschreibung', 'beschreibung_quelle', 'beschreibung_struktur', 'screenshot_url', 'creator_id', 'creator_name',
  'creator_auswahl_item_id', 'produkt_id', 'transkript', 'transkript_quelle', 'caption',
  'transcription_job_id', 'verarbeitung_status', 'verarbeitung_step', 'verarbeitung_fehler',
  'ist_vorschlag', 'kunde_anmerkung', 'kunde_anmerkung_author_name', 'kunde_anmerkung_updated_at',
  'prio_1', 'prio_2', 'nicht_umsetzen', 'video_umgesetzt',
  'skript_freigabe', 'skript_freigabe_am', 'skript_freigabe_von',
  'kundenadaption', 'kundenadaption_quelle', 'created_at', 'updated_at', 'created_by'
].join(', ');

export function strategieItemsSelect(isKunde) {
  return isKunde ? `${KUNDE_ITEM_COLUMNS}, ${ITEM_RELATIONS}` : `*, ${ITEM_RELATIONS}`;
}

/**
 * Jeder Lauf startet ein eigenes Chromium. Mehr als zwei parallel treiben die
 * Netlify-Function-Last unnoetig hoch, ohne dass es spuerbar schneller wird.
 */
export const MAX_PARALLELE_VERARBEITUNGEN = 2;

/**
 * Items einer Strategie abrufen
 */
export async function getStrategieItems(strategieId) {
  const isKunde = !!window.isKunde?.();
  let q = window.supabase
    .from('strategie_items')
    .select(strategieItemsSelect(isKunde))
    .eq('strategie_id', strategieId)
    .order('sortierung', { ascending: true });

  // Kunde inkl. Gast: keine Videoidee-Vorschlaege (ADR 0015)
  if (isKunde) q = q.eq('ist_vorschlag', false);

  const { data, error } = await q;

  if (error) {
    console.error('Fehler beim Abrufen der Strategie-Items:', error);
    throw error;
  }

  return data;
}

/**
 * Strategie-Item erstellen
 */
export async function createStrategieItem(itemData) {
  const { data, error } = await window.supabase
    .from('strategie_items')
    .insert({
      ...itemData,
      created_by: window.currentUser?.id
    })
    .select()
    .single();

  if (error) {
    console.error('Fehler beim Erstellen des Strategie-Items:', error);
    throw error;
  }

  return data;
}

/**
 * Strategie-Item aktualisieren
 */
export async function updateStrategieItem(id, updates) {
  const gated = Object.keys(updates || {}).some((k) => !VORSCHLAG_EDIT_FIELDS.includes(k));
  if (gated) await assertKeinVorschlag(id);

  const { data, error } = await window.supabase
    .from('strategie_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Fehler beim Aktualisieren des Strategie-Items:', error);
    throw error;
  }

  return data;
}

/**
 * Strategie-Item löschen (inkl. Screenshot)
 */
export async function deleteStrategieItem(id) {
  console.log('🗑️ Lösche Strategie-Item:', id);

  // Zuerst das Item abrufen um Screenshot-URL zu bekommen
  const { data: item, error: fetchError } = await window.supabase
    .from('strategie_items')
    .select('screenshot_url')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.warn('Fehler beim Abrufen des Items:', fetchError);
  }

  console.log('📸 Item-Daten:', item);

  if (item?.screenshot_url) {
    await deleteScreenshot(item.screenshot_url);
  } else {
    console.log('ℹ️ Kein Screenshot vorhanden');
  }

  // Item löschen
  const { error } = await window.supabase
    .from('strategie_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Fehler beim Löschen des Strategie-Items:', error);
    throw error;
  }

  console.log('✅ Item erfolgreich gelöscht');
}

/**
 * Sortierung mehrerer Items aktualisieren
 */
export async function updateItemsSortierung(items) {
  const updates = items.map((item, index) => ({
    id: item.id,
    sortierung: index
  }));

  const promises = updates.map(update =>
    window.supabase
      .from('strategie_items')
      .update({ sortierung: update.sortierung })
      .eq('id', update.id)
  );

  const results = await Promise.all(promises);

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.error('Fehler beim Aktualisieren der Sortierung:', errors);
    throw new Error('Sortierung konnte nicht aktualisiert werden');
  }
}

/**
 * Sortierung und Teilbereich mehrerer Items aktualisieren
 */
export async function updateItemsSortierungWithTeilbereich(items) {
  const promises = items.map((item, index) =>
    window.supabase
      .from('strategie_items')
      .update({
        sortierung: index,
        teilbereich: item.teilbereich
      })
      .eq('id', item.id)
  );

  const results = await Promise.all(promises);

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.error('Fehler beim Aktualisieren der Sortierung/Teilbereich:', errors);
    throw new Error('Sortierung konnte nicht aktualisiert werden');
  }
}

/**
 * Verarbeitung eines Items anstossen: Screenshot + Transkription laufen in
 * einer Netlify Background Function, die sofort 202 antwortet. Fortschritt und
 * Ergebnis kommen ueber Realtime auf strategie_items zurueck.
 */
export async function triggerItemProcessing(itemId) {
  const session = await window.supabase.auth.getSession();
  const token = session?.data?.session?.access_token || '';

  const response = await fetch('/.netlify/functions/strategie-item-background', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ itemId })
  });

  // 202 = Background Function angenommen, 409 = laeuft bereits (kein Fehler)
  if (response.status !== 202 && response.status !== 409 && !response.ok) {
    throw new Error(`Verarbeitung konnte nicht gestartet werden: HTTP ${response.status}`);
  }
}

/**
 * Item zur Verarbeitung einreihen. Es laufen hoechstens
 * MAX_PARALLELE_VERARBEITUNGEN Chromium-Instanzen gleichzeitig; alles weitere
 * bleibt auf 'pending' und wird vom jeweils fertigen Lauf nachgezogen.
 */
export async function enqueueItemProcessing(strategieId, itemId) {
  const { count } = await window.supabase
    .from('strategie_items')
    .select('id', { count: 'exact', head: true })
    .eq('strategie_id', strategieId)
    .eq('verarbeitung_status', 'processing');

  if ((count || 0) >= MAX_PARALLELE_VERARBEITUNGEN) return false;

  await triggerItemProcessing(itemId);
  return true;
}

/**
 * Kundenadaption neu schreiben. Ersetzt vorhandenen Text. Kein erneutes Scrapen.
 */
export async function generiereKundenadaption(itemId) {
  const response = await authorizedFetch('/.netlify/functions/kundenadaption', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId })
  });
  let body = {};
  try {
    body = await response.json();
  } catch (_) { /* leerer Body */ }
  if (!response.ok) {
    throw new Error(body.error || 'Kundenadaption fehlgeschlagen');
  }
  return body.kundenadaption;
}

/**
 * Beschreibung neu analysieren (Titel, Angle, Hook, Visual Hook, Hauptteil, CTA).
 * Ersetzt die vorhandene Beschreibung. Kein erneutes Scrapen.
 */
export async function analysiereBeschreibung(itemId) {
  const response = await authorizedFetch('/.netlify/functions/beschreibung-analyse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId })
  });
  let body = {};
  try {
    body = await response.json();
  } catch (_) { /* leerer Body */ }
  if (!response.ok) {
    throw new Error(body.error || 'Analyse fehlgeschlagen');
  }
  return body.beschreibung;
}

export async function reprocessItem(itemId) {
  await updateStrategieItem(itemId, {
    verarbeitung_status: 'pending',
    verarbeitung_step: null,
    verarbeitung_fehler: null
  });
  await triggerItemProcessing(itemId);
}
