// _shared/ablage/freigabe.js
// Kunden-Leselink: "Jeder mit dem Link", nur Ansicht, 365 Tage gueltig. Ganze Ordner statt ZIP.
// Ziel ist der Videos-Ordner einer Kooperation (dort liegen seit ADR 0065 auch Stories und Bilder)
// oder der Produktions-Ordner mit allen Kooperationen darunter, Rohmaterial eingeschlossen
// (ADR 0071, nur Team). Widerruf manuell oder durch den Rechte-Abgleich.

const { istUuid } = require('./konfig');
const { istStaff, sichtbar, erlaubteKooperationen } = require('./zugriff');
const { AblageFehler } = require('./http');

const TAGE = 365;
// Ein aktiver Link mit mehr Restlaufzeit wird wiederverwendet (weniger Links im Umlauf);
// darunter gibt es einen frischen, damit Kunden nicht mit einem bald toten Link dastehen
const WIEDERVERWENDEN_AB_TAGE = 90;
const TAG_MS = 86400000;

const LISTE_SPALTEN = 'id, url, ordner_art, laeuft_ab_at, erstellt_at, widerrufen_at';
// 'storys' von alten Clients: Stories liegen unter Videos/
const LINK_TYPEN = new Map([['videos', 'videos'], ['storys', 'videos']]);

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

  // Nur Team, und nur wer die Kampagne der Produktion sieht (RLS produktion_select)
  async function pruefenProduktion({ benutzer, caller }, produktionId) {
    if (!istUuid(produktionId)) throw new AblageFehler(400, 'produktion_id fehlt');
    if (!istStaff(benutzer)) throw new AblageFehler(403, 'Nur interne Mitarbeiter');
    if (!await sichtbar(caller, 'produktion', produktionId)) throw new AblageFehler(404, 'Produktion nicht gefunden');
  }

  async function ordnerItem(filter) {
    if (!sp) return null;
    let q = supabase.from('ablage_ordner').select('item_id').eq('drive_id', sp.driveId);
    for (const [spalte, wert] of Object.entries(filter)) q = q.eq(spalte, wert);
    const { data, error } = await q.is('geloescht_at', null).not('item_id', 'is', null).maybeSingle();
    if (error) throw error;
    return data?.item_id || null;
  }

  // 400 kommt u. a., wenn die Laufzeit ueber der Hoechstdauer des Tenants liegen: dann ohne Ablauf
  // erneut, der Tenant setzt seinen. Ohne erzwungenen Ablauf waere der Link unbefristet.
  async function leselinkHolen(itemId) {
    try {
      return await sp.leselink(itemId, jetzt() + TAGE * TAG_MS);
    } catch (err) {
      if (err?.status !== 400) throw err;
      console.warn('[ablage-freigabe] createLink mit Ablauf abgelehnt:', err.code || '', err.message);
      const link = await sp.leselink(itemId);
      if (link.ablauf) return link;
      await sp.freigabeEntfernen(itemId, link.permissionId).catch(() => {});
      throw err;
    }
  }

  /** Aktiven Link auf den Ordner wiederverwenden, sonst bei SharePoint anlegen und speichern. */
  async function linkFuerOrdner(itemId, { benutzer, ordnerArt, bezug }) {
    const { data: aktiv, error: aErr } = await supabase.from('ablage_freigabelink').select('id, url, laeuft_ab_at')
      .eq('drive_id', sp.driveId).eq('item_id', itemId).is('widerrufen_at', null)
      .gt('laeuft_ab_at', iso(jetzt() + WIEDERVERWENDEN_AB_TAGE * TAG_MS))
      .order('laeuft_ab_at', { ascending: false }).limit(1);
    if (aErr) throw aErr;
    if (aktiv?.length) return aktiv[0];

    let link;
    try {
      link = await leselinkHolen(itemId);
    } catch (err) {
      // Tenant- oder Site-Richtlinie verbietet anonyme Links
      if (err?.status === 400 || err?.status === 403) {
        console.warn('[ablage-freigabe] createLink abgelehnt:', err.status, err.code || '', err.message);
        throw new AblageFehler(409, 'SharePoint erlaubt gerade keine Links ohne Anmeldung', 'links_gesperrt');
      }
      throw err;
    }
    const { data, error } = await supabase.from('ablage_freigabelink').insert({
      drive_id: sp.driveId,
      item_id: itemId,
      ...bezug,
      ordner_art: ordnerArt,
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

  async function erstellen({ benutzer, caller, body }) {
    if (body.produktion_id) {
      await pruefenProduktion({ benutzer, caller }, body.produktion_id);
      const itemId = await ordnerItem({ art: 'produktion', produktion_id: body.produktion_id });
      if (!itemId) throw new AblageFehler(409, 'Diese Produktion liegt noch nicht in SharePoint', 'nicht_sharepoint');
      return linkFuerOrdner(itemId, { benutzer, ordnerArt: 'produktion', bezug: { produktion_id: body.produktion_id } });
    }
    const kooperationId = body.kooperation_id;
    const typ = LINK_TYPEN.get(body.typ || 'videos');
    if (!typ) throw new AblageFehler(400, 'typ ist videos');
    await pruefen({ benutzer, caller }, kooperationId);
    const itemId = await ordnerItem({ art: 'typ', typ, kooperation_id: kooperationId });
    if (!itemId) throw new AblageFehler(409, 'Diese Kooperation liegt noch nicht in SharePoint', 'nicht_sharepoint');
    return linkFuerOrdner(itemId, { benutzer, ordnerArt: typ, bezug: { kooperation_id: kooperationId } });
  }

  async function liste({ benutzer, caller, body }) {
    let spalte = 'kooperation_id';
    if (body.produktion_id) {
      await pruefenProduktion({ benutzer, caller }, body.produktion_id);
      spalte = 'produktion_id';
    } else {
      await pruefen({ benutzer, caller }, body.kooperation_id);
    }
    const { data, error } = await supabase.from('ablage_freigabelink').select(LISTE_SPALTEN)
      .eq(spalte, body[spalte]).order('erstellt_at', { ascending: false }).limit(50);
    if (error) throw error;
    return { links: data || [] };
  }

  async function widerrufen({ benutzer, caller, body }) {
    if (!istUuid(body.id)) throw new AblageFehler(400, 'id fehlt');
    if (!istStaff(benutzer)) throw new AblageFehler(403, 'Nur interne Mitarbeiter');
    const { data: z, error } = await supabase.from('ablage_freigabelink')
      .select('id, drive_id, item_id, permission_id, kooperation_id, produktion_id, widerrufen_at').eq('id', body.id).maybeSingle();
    if (error) throw error;
    if (!z) throw new AblageFehler(404, 'Link nicht gefunden');
    // Ohne Bezug (Produktion geloescht) reicht Staff
    if (z.kooperation_id) await pruefen({ benutzer, caller }, z.kooperation_id);
    else if (z.produktion_id) await pruefenProduktion({ benutzer, caller }, z.produktion_id);
    if (z.widerrufen_at) return { ok: true };
    const n = await linksWiderrufen({ supabase, sp, jetzt }, [z], 'manuell');
    if (!n) throw new AblageFehler(503, 'Widerruf gerade nicht moeglich, bitte erneut versuchen', 'sharepoint_busy');
    return { ok: true };
  }

  return { erstellen, liste, widerrufen };
}

module.exports = { createFreigabe, linksWiderrufen, TAGE };
