// _shared/ablage/freigabe.js
// Kunden-Leselink: "Jeder mit dem Link", nur Ansicht, auf den Videos- (oder Storys-)Ordner einer
// Kooperation, 30 Tage gueltig. Ganze Ordner statt ZIP. Widerruf manuell oder durch den Rechte-Abgleich.

const { istUuid } = require('./konfig');
const { istStaff, erlaubteKooperationen } = require('./zugriff');
const { AblageFehler } = require('./http');

const TAGE = 30;
// Ein aktiver Link mit mehr Restlaufzeit wird wiederverwendet (weniger Links im Umlauf)
const WIEDERVERWENDEN_AB_TAGE = 20;
const TAG_MS = 86400000;

const LISTE_SPALTEN = 'id, url, ordner_art, laeuft_ab_at, erstellt_at, widerrufen_at';
const LINK_TYPEN = new Set(['videos', 'storys']);

/** Links bei SharePoint entfernen und als widerrufen markieren. Fehler je Link, nicht fuer alle. */
async function linksWiderrufen({ supabase, sp, jetzt = () => Date.now() }, zeilen, grund) {
  let n = 0;
  for (const z of zeilen) {
    try {
      if (sp && z.drive_id === sp.driveId) await sp.freigabeEntfernen(z.item_id, z.permission_id);
      const { error } = await supabase.from('ablage_freigabelink')
        .update({ widerrufen_at: new Date(jetzt()).toISOString(), widerruf_grund: grund })
        .eq('id', z.id).is('widerrufen_at', null);
      if (error) throw error;
      n++;
    } catch (err) {
      console.warn('[ablage-freigabe] Widerruf fehlgeschlagen:', z.id, err.message);
    }
  }
  return n;
}

/**
 * @param {{ supabase: object, ablage: object|null, jetzt?: () => number }} deps
 */
function createFreigabe({ supabase, ablage, jetzt = () => Date.now() }) {
  const sp = ablage?.sp || null;
  const iso = (ms) => new Date(ms).toISOString();

  // Staff (mit Zuordnung) und Kunden mit Zugriff auf die Kooperation; Gaeste nie
  async function pruefen({ benutzer, caller }, kooperationId) {
    if (!istUuid(kooperationId)) throw new AblageFehler(400, 'kooperation_id fehlt');
    if (!benutzer || benutzer.freigeschaltet === false) throw new AblageFehler(403, 'Keine Berechtigung');
    const erlaubt = await erlaubteKooperationen({ benutzer, caller }, [kooperationId]);
    if (!erlaubt.has(kooperationId)) throw new AblageFehler(404, 'Kooperation nicht gefunden');
  }

  async function typOrdner(kooperationId, typ) {
    if (!sp) return null;
    const { data, error } = await supabase.from('ablage_ordner').select('item_id')
      .eq('drive_id', sp.driveId).eq('art', 'typ').eq('typ', typ).eq('kooperation_id', kooperationId)
      .is('geloescht_at', null).not('item_id', 'is', null).maybeSingle();
    if (error) throw error;
    return data?.item_id || null;
  }

  async function erstellen({ benutzer, caller, body }) {
    const kooperationId = body.kooperation_id;
    const typ = body.typ || 'videos';
    if (!LINK_TYPEN.has(typ)) throw new AblageFehler(400, 'typ ist videos oder storys');
    await pruefen({ benutzer, caller }, kooperationId);
    const itemId = await typOrdner(kooperationId, typ);
    if (!itemId) throw new AblageFehler(409, 'Diese Kooperation liegt noch nicht in SharePoint', 'nicht_sharepoint');

    const { data: aktiv, error: aErr } = await supabase.from('ablage_freigabelink').select('id, url, laeuft_ab_at')
      .eq('drive_id', sp.driveId).eq('item_id', itemId).is('widerrufen_at', null)
      .gt('laeuft_ab_at', iso(jetzt() + WIEDERVERWENDEN_AB_TAGE * TAG_MS))
      .order('laeuft_ab_at', { ascending: false }).limit(1);
    if (aErr) throw aErr;
    if (aktiv?.length) return aktiv[0];

    let link;
    try {
      link = await sp.leselink(itemId, jetzt() + TAGE * TAG_MS);
    } catch (err) {
      // Tenant-Richtlinie verbietet anonyme Links (oder kuerzere Hoechstdauer)
      if (err?.status === 400 || err?.status === 403) {
        throw new AblageFehler(409, 'SharePoint erlaubt gerade keine Links ohne Anmeldung', 'links_gesperrt');
      }
      throw err;
    }
    const { data, error } = await supabase.from('ablage_freigabelink').insert({
      drive_id: sp.driveId,
      item_id: itemId,
      kooperation_id: kooperationId,
      ordner_art: typ,
      permission_id: link.permissionId,
      url: link.url,
      erstellt_von: benutzer.id,
      laeuft_ab_at: link.ablauf,
    }).select('id, url, laeuft_ab_at').single();
    if (error) {
      // ohne Zeile koennte niemand den Link widerrufen
      await sp.freigabeEntfernen(itemId, link.permissionId).catch(() => {});
      throw error;
    }
    return data;
  }

  async function liste({ benutzer, caller, body }) {
    await pruefen({ benutzer, caller }, body.kooperation_id);
    const { data, error } = await supabase.from('ablage_freigabelink').select(LISTE_SPALTEN)
      .eq('kooperation_id', body.kooperation_id).order('erstellt_at', { ascending: false }).limit(50);
    if (error) throw error;
    return { links: data || [] };
  }

  async function widerrufen({ benutzer, caller, body }) {
    if (!istUuid(body.id)) throw new AblageFehler(400, 'id fehlt');
    if (!istStaff(benutzer)) throw new AblageFehler(403, 'Nur interne Mitarbeiter');
    const { data: z, error } = await supabase.from('ablage_freigabelink')
      .select('id, drive_id, item_id, permission_id, kooperation_id, widerrufen_at').eq('id', body.id).maybeSingle();
    if (error) throw error;
    if (!z) throw new AblageFehler(404, 'Link nicht gefunden');
    await pruefen({ benutzer, caller }, z.kooperation_id);
    if (z.widerrufen_at) return { ok: true };
    const n = await linksWiderrufen({ supabase, sp, jetzt }, [z], 'manuell');
    if (!n) throw new AblageFehler(503, 'Widerruf gerade nicht moeglich, bitte erneut versuchen', 'sharepoint_busy');
    return { ok: true };
  }

  return { erstellen, liste, widerrufen };
}

module.exports = { createFreigabe, linksWiderrufen, TAGE };
