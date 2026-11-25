// _shared/tiktok/profil-ziel.js
// Wohin ein TikTok-Profilabruf schreibt. Mit item_id ist es eine Casting-Zeile
// (creator_auswahl_items), ohne nur ein Link: dann bleibt es beim Pool und die Antwort traegt die
// Felder als Vorschau (Masterliste, Creator-Formular und andere Seiten).

const { profilName } = require('./eingabe');
const { itemUpdateAusPool, POOL_TABELLE } = require('./pool');

const ITEM_TABELLE = 'creator_auswahl_items';
const ITEM_SELECT = 'id, name, link_tiktok, email, telefon, wohnort, notiz, profile_image_url';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const nichtOk = (status, fehler) => ({ ok: false, status, fehler });

/**
 * @param {{ supabase: object, darfSehen: (tabelle: string, id: string) => Promise<boolean> }} ctx
 * @param {{ item_id?: string, link?: string }} body
 * @returns {Promise<{ ok: true, ziel: { itemId: string|null, item: object, username: string } }
 *   | { ok: false, status: number, fehler: string }>}
 */
async function ladeZiel({ supabase, darfSehen }, body) {
  if (body.item_id == null) {
    const username = profilName(body.link);
    if (!username) return nichtOk(400, 'Kein gültiger TikTok-Profil-Link');
    return { ok: true, ziel: { itemId: null, item: {}, username } };
  }

  if (typeof body.item_id !== 'string' || !UUID_RE.test(body.item_id)) return nichtOk(400, 'item_id ist ungültig');
  if (!(await darfSehen(ITEM_TABELLE, body.item_id))) return nichtOk(404, 'Casting-Eintrag nicht gefunden');
  const { data, error } = await supabase.from(ITEM_TABELLE).select(ITEM_SELECT).eq('id', body.item_id).maybeSingle();
  if (error) throw new Error(`Casting-Eintrag nicht lesbar: ${error.message}`);
  if (!data) return nichtOk(404, 'Casting-Eintrag nicht gefunden');

  const username = profilName(data.link_tiktok);
  if (!username) return nichtOk(400, 'Kein gültiger TikTok-Profil-Link in der Zeile hinterlegt');
  return { ok: true, ziel: { itemId: data.id, item: data, username } };
}

/** Pool auf das Ziel schreiben. Rueckgabe ist der Teil der Antwort, den der Client liest. */
async function schreibeZiel(supabase, ziel, pool) {
  const basis = { username: ziel.username, pool_fetched_at: pool.tt_fetched_at || null };
  const update = itemUpdateAusPool(pool, ziel.item);
  if (!ziel.itemId) return { ...basis, fields: update };

  const { data, error } = await supabase.from(ITEM_TABELLE).update(update).eq('id', ziel.itemId).select().single();
  if (error) throw new Error(`Speichern fehlgeschlagen: ${error.message}`);
  return { ...basis, item: data };
}

/** Profil taugt nicht (privat, nicht gefunden): an Zeile und Pool vermerken, damit es sichtbar bleibt. */
async function markiereFehler(supabase, ziel, fehler) {
  const jetzt = new Date().toISOString();
  if (ziel.itemId) {
    await supabase.from(ITEM_TABELLE).update({ tt_fetch_error: fehler, tt_fetched_at: jetzt }).eq('id', ziel.itemId);
  }
  await supabase.from(POOL_TABELLE).update({ tt_fetch_error: fehler, updated_at: jetzt }).eq('tt_username', ziel.username);
}

module.exports = { ITEM_TABELLE, ladeZiel, schreibeZiel, markiereFehler };
