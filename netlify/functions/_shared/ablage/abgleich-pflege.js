// _shared/ablage/abgleich-pflege.js
// Abgleich Schritt 3: Fach-Geruest fuer neue Videos/Story-Slots, CRM-Namen auf die Ordner,
// alte Uploads aufraeumen, Webhook-Abo erneuern. `c` ist der Kontext aus createAbgleich.

const { istNichtGefunden } = require('./graph');
const { NAMEN, basisName } = require('./pfad');
const { SEITE, stuecke } = require('./liste');

const UPLOAD_ALT_MS = 2 * 86400000;
const GERUEST_JE_LAUF = 5;
const ABO_RESTTAGE = 3;

const NAMENS_QUELLEN = [
  { art: 'unternehmen', spalte: 'unternehmen_id', tabelle: 'unternehmen', select: 'id, firmenname', soll: NAMEN.unternehmen },
  { art: 'marke', spalte: 'marke_id', tabelle: 'marke', select: 'id, markenname', soll: NAMEN.marke },
  { art: 'kampagne', spalte: 'kampagne_id', tabelle: 'kampagne', select: 'id, kampagnenname, eigener_name', soll: NAMEN.kampagne },
  { art: 'kooperation', spalte: 'kooperation_id', tabelle: 'kooperationen', select: 'id, name', soll: NAMEN.kooperation },
  { art: 'video', spalte: 'kooperation_video_id', tabelle: 'kooperation_videos', select: 'id, position, thema', soll: NAMEN.video },
];

function createPflege(c) {
  const { supabase, sp, ordner, driveId, jetzt, iso, rpc, stand, standSetzen } = c;

  async function geruestNachziehen({ bis, limit = GERUEST_JE_LAUF } = {}) {
    const offen = (await rpc('ablage_geruest_offen', { p_drive_id: driveId, p_limit: limit })) || [];
    const r = { gebaut: 0, fehler: [] };
    for (const { kooperation_id: id } of offen) {
      if (bis && jetzt() >= bis) break;
      try {
        await ordner.geruest(id);
        r.gebaut++;
      } catch (err) {
        r.fehler.push(`${id}: ${err.message}`);
      }
    }
    return r;
  }

  /** CRM fuehrt die Namen: Umbenennungen im CRM per PATCH auf die Ordner uebertragen. */
  async function namenAbgleichen({ bis } = {}) {
    const r = { umbenannt: 0, fehler: [] };
    for (const q of NAMENS_QUELLEN) {
      for (let von = 0; ; von += SEITE) {
        const { data: rows, error } = await supabase.from('ablage_ordner').select('*')
          .eq('drive_id', driveId).eq('art', q.art).is('geloescht_at', null).not('item_id', 'is', null)
          .order('id', { ascending: true }).range(von, von + SEITE - 1);
        if (error) throw error;
        for (const teil of stuecke(rows || [])) {
          const ids = [...new Set(teil.map((o) => o[q.spalte]).filter(Boolean))];
          if (!ids.length) continue;
          const { data: quellen, error: qErr } = await supabase.from(q.tabelle).select(q.select).in('id', ids);
          if (qErr) throw qErr;
          const nachId = new Map((quellen || []).map((x) => [x.id, x]));
          for (const o of teil) {
            if (bis && jetzt() >= bis) return { ...r, unvollstaendig: true };
            const quelle = nachId.get(o[q.spalte]);
            if (!quelle) continue;
            const soll = q.soll(quelle);
            if (!soll || basisName(o.name) === soll) continue;
            try {
              await ordner.umbenennen(o, soll);
              r.umbenannt++;
            } catch (err) {
              r.fehler.push(`${o.pfad || o.name}: ${err.message}`);
            }
          }
        }
        if (!rows || rows.length < SEITE) break;
      }
    }
    return r;
  }

  async function aufraeumen() {
    // Abgebrochene/erledigte CRM-Uploads: nach 2 Tagen hat der Abgleich die Datei laengst eingeordnet
    const { data, error } = await supabase.from('ablage_upload').delete()
      .eq('drive_id', driveId).lt('erstellt_at', iso(jetzt() - UPLOAD_ALT_MS)).select('id');
    if (error) throw error;
    return { uploads: data?.length || 0 };
  }

  async function aboSicherstellen({ notificationUrl, clientState }) {
    if (!notificationUrl || !clientState) return { abo: 'nicht_konfiguriert' };
    await ordner.wurzel();
    const s = await stand();
    const rest = s?.abo_ablauf ? Date.parse(s.abo_ablauf) - jetzt() : -1;
    if (s?.abo_id && rest > ABO_RESTTAGE * 86400000) return { abo: 'ok', ablauf: s.abo_ablauf };
    if (s?.abo_id && rest > 0) {
      try {
        const neu = await sp.aboVerlaengern(s.abo_id);
        await standSetzen({ abo_ablauf: neu.expirationDateTime });
        return { abo: 'verlaengert', ablauf: neu.expirationDateTime };
      } catch (err) {
        if (!istNichtGefunden(err)) throw err;
      }
    }
    const neu = await sp.aboAnlegen({ notificationUrl, clientState });
    await standSetzen({ abo_id: neu.id, abo_ablauf: neu.expirationDateTime });
    return { abo: 'angelegt', ablauf: neu.expirationDateTime };
  }

  return { geruestNachziehen, namenAbgleichen, aufraeumen, aboSicherstellen };
}

module.exports = { createPflege, ABO_RESTTAGE };
