// _shared/ablage/abgleich-pflege.js
// Abgleich Schritt 3: Fach-Geruest fuer neue Videos/Story-Slots, Produktions-Ebene nachziehen,
// CRM-Namen auf die Ordner, alte Uploads aufraeumen, Webhook-Abo erneuern. `c` ist der Kontext
// aus createAbgleich.

const { istNichtGefunden } = require('./graph');
const { NAMEN, basisName } = require('./pfad');
const { SEITE, stuecke } = require('./liste');
const { createStruktur } = require('./struktur');

const UPLOAD_ALT_MS = 2 * 86400000;
const GERUEST_JE_LAUF = 5;
const STRUKTUR_JE_LAUF = 5;
const ABO_RESTTAGE = 3;

const NAMENS_QUELLEN = [
  { art: 'unternehmen', spalte: 'unternehmen_id', tabelle: 'unternehmen', select: 'id, firmenname', soll: NAMEN.unternehmen },
  { art: 'marke', spalte: 'marke_id', tabelle: 'marke', select: 'id, markenname', soll: NAMEN.marke },
  { art: 'kampagne', spalte: 'kampagne_id', tabelle: 'kampagne', select: 'id, kampagnenname, eigener_name', soll: NAMEN.kampagne },
  { art: 'produktion', spalte: 'produktion_id', tabelle: 'produktion', select: 'id, name', soll: NAMEN.produktion },
  { art: 'kooperation', spalte: 'kooperation_id', tabelle: 'kooperationen', select: 'id, name', soll: NAMEN.kooperation },
  { art: 'video', spalte: 'kooperation_video_id', tabelle: 'kooperation_videos', select: 'id, position, thema', soll: NAMEN.video },
  // Dokument-Ordner (ADR 0068): je Ebene ein Fach-Objekt
  { art: 'dokument', ebene: 'marke', spalte: 'marke_id', tabelle: 'marke', select: 'id, markenname', soll: NAMEN.marke },
  { art: 'dokument', ebene: 'kampagne', spalte: 'kampagne_id', tabelle: 'kampagne', select: 'id, kampagnenname, eigener_name', soll: NAMEN.kampagne },
  { art: 'dokument', ebene: 'produktion', spalte: 'produktion_id', tabelle: 'produktion', select: 'id, name', soll: NAMEN.produktion },
  { art: 'dokument', ebene: 'auftrag', spalte: 'auftrag_id', tabelle: 'auftrag', select: 'id, auftragsname, titel', soll: NAMEN.auftrag },
  { art: 'dokument', ebene: 'rechnung', spalte: 'rechnung_id', tabelle: 'rechnung', select: 'id, rechnung_nr', soll: NAMEN.rechnung },
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

  /** Kooperationen/Verträge, deren Produktion sich geaendert hat, in den richtigen Ordner (ADR 0069). */
  async function strukturNachziehen({ bis, limit = STRUKTUR_JE_LAUF } = {}) {
    const struktur = createStruktur({ supabase, sp, ordner });
    const r = { verschoben: 0, fehler: [] };
    let liste;
    try {
      liste = await struktur.offen({ limit });
    } catch (err) {
      // Nachrangig: ohne Migration 20261211 laeuft der Abgleich trotzdem weiter
      r.fehler.push(err.message);
      return r;
    }
    for (const eintrag of liste) {
      if (bis && jetzt() >= bis) break;
      try {
        r.verschoben += (await struktur.nachziehen(eintrag)).verschoben;
      } catch (err) {
        r.fehler.push(`${eintrag.art} ${eintrag.id}: ${err.message}`);
      }
    }
    return r;
  }

  /** CRM fuehrt die Namen: Umbenennungen im CRM per PATCH auf die Ordner uebertragen. */
  async function namenAbgleichen({ bis } = {}) {
    const r = { umbenannt: 0, fehler: [] };
    for (const q of NAMENS_QUELLEN) {
      for (let von = 0; ; von += SEITE) {
        let abfrage = supabase.from('ablage_ordner').select('*')
          .eq('drive_id', driveId).eq('art', q.art).is('geloescht_at', null).not('item_id', 'is', null);
        if (q.ebene) abfrage = abfrage.eq('ebene', q.ebene);
        const { data: rows, error } = await abfrage.order('id', { ascending: true }).range(von, von + SEITE - 1);
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

  return { geruestNachziehen, strukturNachziehen, namenAbgleichen, aufraeumen, aboSicherstellen };
}

module.exports = { createPflege, ABO_RESTTAGE };
