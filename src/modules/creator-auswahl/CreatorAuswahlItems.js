// CreatorAuswahlItems.js
// Eintraege, Sortierung, Persona-Zuordnung, Scrape und Instagram-Stats
// (Prototype-Mixin von CreatorAuswahlService)

import { authorizedFetch } from '../../core/auth/getAccessToken.js';

/**
 * Items einer Liste abrufen
 */
export async function getItems(listeId) {
  const { data, error } = await window.supabase
    .from('creator_auswahl_items')
    .select(`
      *,
      creator:creator_id(id, vorname, nachname, instagram, tiktok),
      persona:persona_id(id, name, oberbegriff)
    `)
    .eq('creator_auswahl_id', listeId)
    .order('sortierung', { ascending: true });

  if (error) {
    console.error('Fehler beim Abrufen der Items:', error);
    throw error;
  }

  return data;
}

export async function getListeIdsForCreator(creatorId) {
  if (!creatorId) return [];
  const { data, error } = await window.supabase
    .from('creator_auswahl_items')
    .select('creator_auswahl_id')
    .eq('creator_id', creatorId);

  if (error) {
    console.error('Fehler beim Abrufen der Casting-Zuordnungen:', error);
    throw error;
  }

  return [...new Set((data || []).map((row) => row.creator_auswahl_id).filter(Boolean))];
}

/**
 * Briefing-Personas der Liste in Array-Reihenfolge.
 */

export async function loadBriefingPersonas(liste) {
  const briefingId = liste?.briefing_id;
  if (!briefingId) return [];

  const { data: briefing, error: briefingError } = await window.supabase
    .from('campaign_briefings')
    .select('persona_ids')
    .eq('id', briefingId)
    .maybeSingle();
  if (briefingError) throw briefingError;

  const ids = Array.isArray(briefing?.persona_ids)
    ? briefing.persona_ids.filter(Boolean)
    : [];
  if (!ids.length) return [];

  const { data, error } = await window.supabase
    .from('personas')
    .select('id, name, oberbegriff')
    .in('id', ids);
  if (error) throw error;

  const byId = new Map((data || []).map(p => [p.id, p]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}

/**
 * CRM-Creator als Casting-Eintrag anlegen. Wirft, wenn der Creator
 * auf dieser Liste schon mit creator_id haengt.
 */
export async function addCreatorFromStammdaten(listeId, creatorId, personaId) {
  if (!listeId || !creatorId) {
    throw new Error('Casting und Creator sind erforderlich');
  }
  if (!personaId) {
    throw new Error('Bitte eine Persona wählen');
  }

  const { data: existing, error: existingError } = await window.supabase
    .from('creator_auswahl_items')
    .select('id')
    .eq('creator_auswahl_id', listeId)
    .eq('creator_id', creatorId)
    .limit(1);

  if (existingError) throw existingError;
  if (existing?.length) {
    throw new Error('Creator ist bereits auf diesem Casting');
  }

  const { data: creator, error: creatorError } = await window.supabase
    .from('creator')
    .select('id, vorname, nachname, instagram, instagram_follower, tiktok, tiktok_follower, lieferadresse_stadt, mail, telefonnummer')
    .eq('id', creatorId)
    .single();

  if (creatorError) throw creatorError;
  if (!creator) throw new Error('Creator nicht gefunden');

  const { data: lastRows, error: sortError } = await window.supabase
    .from('creator_auswahl_items')
    .select('sortierung')
    .eq('creator_auswahl_id', listeId)
    .order('sortierung', { ascending: false, nullsFirst: false })
    .limit(1);

  if (sortError) throw sortError;
  const sortierung = (lastRows?.[0]?.sortierung ?? -1) + 1;

  return this.createItem({
    ...buildCastingEintragFromCreator(creator, listeId, sortierung),
    persona_id: personaId
  });
}

/**
 * Item erstellen
 */
export async function createItem(itemData) {
  const payload = {
    ...itemData,
    created_by: window.currentUser?.id
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'typ')) {
    payload.typ = this._assertValidCreatorTyp(payload.typ);
  }

  const { data, error } = await window.supabase
    .from('creator_auswahl_items')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Fehler beim Erstellen des Items:', error);
    throw error;
  }

  return data;
}

/**
 * Item aktualisieren
 */
export async function updateItem(id, updates) {
  const payload = { ...updates };
  if (Object.prototype.hasOwnProperty.call(payload, 'typ')) {
    payload.typ = this._assertValidCreatorTyp(payload.typ);
  }

  const { data, error } = await window.supabase
    .from('creator_auswahl_items')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Fehler beim Aktualisieren des Items:', error);
    throw error;
  }

  return data;
}

/**
 * Item löschen (Defense-in-Depth: Client-seitiger Scope-Check, RLS sichert zusätzlich ab)
 *
 * Haengt der Eintrag an Videoideen, werden deren Zuordnungen vorher geloest
 * (creator_auswahl_item_id -> NULL). Ideen mit Skript sind eingefroren:
 * dort blockt das Loeschen, weil sonst die Skript-Vorlage ihren Creator
 * verliert.
 */
export async function deleteItem(id) {
  if (window.isKunde()) {
    throw new Error('Keine Berechtigung zum Löschen von Creator-Einträgen');
  }
  if (!window.checkUserPermission('sourcing', 'delete')) {
    throw new Error('Keine Berechtigung zum Löschen von Creator-Einträgen');
  }

  await this._loeseVideoideeZuordnungen(id, 'gelöscht');

  const { error } = await window.supabase
    .from('creator_auswahl_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Fehler beim Löschen des Items:', error);
    throw error;
  }
}

/**
 * Loesung der Zuordnung an allen Videoideen, die diesen Casting-Eintrag
 * tragen. Wirft, wenn eine davon eingefroren ist (Skript existiert).
 * @param {string} auswahlItemId
 * @param {string} aktion - 'gelöscht' | 'abgesagt' (nur fuer Fehlertext)
 */
export async function _loeseVideoideeZuordnungen(auswahlItemId, aktion) {
  const { data: ideen, error } = await window.supabase
    .from('strategie_items')
    .select('id')
    .eq('creator_auswahl_item_id', auswahlItemId);
  if (error) throw error;
  if (!ideen || ideen.length === 0) return;

  const ids = ideen.map(i => i.id);
  const { data: skripte, error: sErr } = await window.supabase
    .from('skripte')
    .select('strategie_item_id')
    .in('strategie_item_id', ids);
  if (sErr) throw sErr;

  if (skripte && skripte.length > 0) {
    throw new Error(
      `Der Eintrag kann nicht ${aktion} werden: mindestens eine verknüpfte Videoidee hat bereits ein Skript. ` +
      'Bitte zuerst die Vorlage am Skript lösen.'
    );
  }

  const { error: upErr } = await window.supabase
    .from('strategie_items')
    .update({
      creator_auswahl_item_id: null,
      skript_freigabe: false,
      skript_freigabe_am: null,
      skript_freigabe_von: null
    })
    .in('id', ids);
  if (upErr) throw upErr;
}

/**
 * Sortierung mehrerer Items aktualisieren
 */
export async function updateItemsSortierung(items) {
  const promises = items.map((item, index) =>
    window.supabase
      .from('creator_auswahl_items')
      .update({ sortierung: index })
      .eq('id', item.id)
  );

  const results = await Promise.all(promises);
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    throw new Error('Sortierung konnte nicht aktualisiert werden');
  }
}

/**
 * Sortierung und Persona-Gruppe mehrerer Items aktualisieren
 */
export async function updateItemsSortierungWithKategorie(items) {
  const promises = items.map((item, index) =>
    window.supabase
      .from('creator_auswahl_items')
      .update({
        sortierung: index,
        persona_id: item.persona_id ?? null,
        kategorie: item.kategorie ?? null
      })
      .eq('id', item.id)
  );

  const results = await Promise.all(promises);

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.error('Fehler beim Aktualisieren der Sortierung/Persona:', errors);
    throw new Error('Sortierung konnte nicht aktualisiert werden');
  }
}

export async function updateItemsGroup(itemIds, updates) {
  const { data, error } = await window.supabase
    .from('creator_auswahl_items')
    .update(updates)
    .in('id', itemIds)
    .select();

  if (error) {
    console.error('Fehler beim Batch-Update der Persona-Gruppe:', error);
    throw error;
  }

  return data;
}

// =====================================================
// SCRAPING
// =====================================================

/**
 * Creator-Daten über Netlify Function scrapen
 */
export async function scrapeCreator(url) {
  try {
    const response = await authorizedFetch('/.netlify/functions/creator-scrape', {
      method: 'POST',
      body: JSON.stringify({ url })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Scraping fehlgeschlagen');
    }

    return result.data;
  } catch (error) {
    console.error('Fehler beim Scraping:', error);
    throw error;
  }
}

/**
 * Instagram-Profil, Follower und CPM-Werte fuer eine Zeile abrufen.
 * Die Netlify Function schreibt direkt in creator_auswahl_items und
 * liefert das aktualisierte Item zurueck.
 *
 * Ohne force wird der Creator-Pool (sourcing_creator) bevorzugt: kennt er
 * den Handle schon, kommen die Werte von dort und Meta bleibt verschont.
 * @returns {Promise<{ item: object, source: 'pool'|'meta', poolFetchedAt: string|null, debug: object|null }>}
 */
export async function fetchInstagramStats(itemId, { force = false } = {}) {
  const response = await authorizedFetch('/.netlify/functions/sourcing-instagram-stats', {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId, force })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.ok) {
    const error = new Error(result.error || 'Instagram-Abruf fehlgeschlagen');
    error.retryable = response.status === 429;
    error.hint = result.hint || null;
    throw error;
  }

  return {
    item: result.item,
    source: result.source || 'meta',
    poolFetchedAt: result.pool_fetched_at || null,
    debug: result.debug || null
  };
}

export const creatorAuswahlItemsMethods = {
  getItems,
  getListeIdsForCreator,
  loadBriefingPersonas,
  addCreatorFromStammdaten,
  createItem,
  updateItem,
  deleteItem,
  _loeseVideoideeZuordnungen,
  updateItemsSortierung,
  updateItemsSortierungWithKategorie,
  updateItemsGroup,
  scrapeCreator,
  fetchInstagramStats
};

function parseFollowerCount(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const str = String(value).trim();
  if (!str) return null;
  if (str.includes('+')) return parseInt(str.replace('+', ''), 10) || null;
  const parts = str.split('-');
  if (parts.length === 2) {
    const min = parseInt(parts[0], 10);
    const max = parseInt(parts[1], 10);
    if (!Number.isNaN(min) && !Number.isNaN(max)) return Math.round((min + max) / 2);
  }
  const parsed = parseInt(str, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function socialProfileUrl(handleOrUrl, kind) {
  if (!handleOrUrl) return null;
  const raw = String(handleOrUrl).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, '');
  return kind === 'tiktok'
    ? `https://tiktok.com/@${handle}`
    : `https://instagram.com/${handle}`;
}

export function buildCastingEintragFromCreator(creator, listeId, sortierung) {
  const name = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim() || null;
  return {
    creator_auswahl_id: listeId,
    creator_id: creator?.id || null,
    typ: 'Influencer',
    name,
    link_instagram: socialProfileUrl(creator?.instagram, 'instagram'),
    follower_instagram: parseFollowerCount(creator?.instagram_follower),
    link_tiktok: socialProfileUrl(creator?.tiktok, 'tiktok'),
    follower_tiktok: parseFollowerCount(creator?.tiktok_follower),
    wohnort: creator?.lieferadresse_stadt || null,
    email: creator?.mail || null,
    telefon: creator?.telefonnummer || null,
    sortierung
  };
}
