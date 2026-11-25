// _shared/ablage/struktur.js
// Produktions-Ebene (ADR 0069) nachziehen: Kooperations-Ordner und Vertrags-PDFs, deren
// Produktion sich geaendert hat (Linie verschoben, Bestand vor der Ebene), in den richtigen
// Ordner. Was offen ist, sagt ablage_struktur_offen. Genutzt von der Abgleich-Pflege (laufend)
// und vom Umsortieren (je Unternehmen, mit Trockenlauf).
// Graph-Move: die item_id bleibt, Kommentare, Tags, Freigabelinks und Versionen haengen weiter dran.

const dokument = require('./dokument');
const { istNichtGefunden } = require('./graph');

const VERTRAG_TYPEN = ['vertrag', 'vertrag_unterschrieben'];
// Dateien direkt in diesen Dokument-Ordnern fuehrt das CRM; in freien Unterordnern SharePoint (ADR 0068)
const VERTRAG_EBENEN = new Set(['kampagne', 'produktion']);
const ALLE = 10000;

/**
 * @param {object} deps
 * @param {object} deps.supabase Service-Client
 * @param {object} deps.sp createSharePoint()
 * @param {object} deps.ordner createOrdner()
 */
function createStruktur({ supabase, sp, ordner }) {
  const driveId = sp.driveId;

  /** -> [{ art: 'kooperation'|'vertrag', id, unternehmen_id, produktion_id, ordner_da }] */
  async function offen({ unternehmenId = null, limit = ALLE } = {}) {
    const { data, error } = await supabase.rpc('ablage_struktur_offen', {
      p_drive_id: driveId, p_unternehmen_id: unternehmenId, p_limit: limit,
    });
    if (error) throw new Error(`ablage_struktur_offen: ${error.message}`);
    return data || [];
  }

  /** kette() legt den Produktions-Ordner an und haengt die Kooperation per umhaengen() darunter. */
  async function kooperationNachziehen(kooperationId) {
    const k = await ordner.kette(kooperationId);
    return { verschoben: 1, pfad: k.kooperation?.pfad || null };
  }

  /** Erzeugtes und unterschriebenes PDF eines Vertrags in den Ordner seiner Produktion (bzw. Kampagne). */
  async function vertragNachziehen(vertragId) {
    const bezug = await dokument.ladeBezug(supabase, 'vertrag', vertragId);
    if (!bezug?.unternehmen) return { verschoben: 0 };
    const select = [...new Set(VERTRAG_TYPEN.flatMap((t) => dokument.spaltenSelect(t).split(', ')))].join(', ');
    const { data: row, error } = await supabase.from('vertraege').select(select).eq('id', vertragId).maybeSingle();
    if (error) throw error;
    if (!row) return { verschoben: 0 };

    let ziel = null;
    let verschoben = 0;
    for (const typ of VERTRAG_TYPEN) {
      const s = dokument.DOKUMENT[typ].spalten;
      const itemId = row[s.item];
      if (row[s.ablage] !== 'sharepoint' || row[s.drive] !== driveId || !itemId) continue;
      const { data: e, error: eErr } = await supabase.from('ablage_eingang').select('parent_item_id')
        .eq('drive_id', driveId).eq('item_id', itemId).maybeSingle();
      if (eErr) throw eErr;
      const eltern = e?.parent_item_id ? await ordner.nachItem(e.parent_item_id) : null;
      if (!eltern || eltern.geloescht_at || eltern.art !== 'dokument' || eltern.bereich !== 'vertraege' || !VERTRAG_EBENEN.has(eltern.ebene)) continue;

      ziel ??= await ordner.dokumentKette(bezug.unternehmen, 'vertraege', dokument.dokumentEbenen(typ, bezug));
      if (eltern.item_id === ziel.item_id) continue;
      let item;
      try {
        item = await sp.verschieben(itemId, ziel.item_id, { conflict: 'rename' });
      } catch (err) {
        if (istNichtGefunden(err)) continue;
        throw err;
      }
      const pfad = `${ziel.pfad}/${item.name}`;
      const { error: uErr } = await supabase.from('vertraege').update(dokument.spaltenAusItem(typ, item, { driveId, pfad })).eq('id', vertragId);
      if (uErr) throw uErr;
      // Eingang sofort nachziehen: sonst meldet ablage_struktur_offen den Vertrag bis zum naechsten Delta erneut
      const { error: gErr } = await supabase.from('ablage_eingang').update({ parent_item_id: ziel.item_id, name: item.name, pfad })
        .eq('drive_id', driveId).eq('item_id', itemId);
      if (gErr) throw gErr;
      verschoben++;
    }
    return { verschoben, pfad: ziel?.pfad || null };
  }

  /** Einen Treffer aus offen() abarbeiten. */
  async function nachziehen(eintrag) {
    if (eintrag.art === 'kooperation') return kooperationNachziehen(eintrag.id);
    if (eintrag.art === 'vertrag') return vertragNachziehen(eintrag.id);
    throw new Error(`Unbekannte Art ${eintrag.art}`);
  }

  return { offen, kooperationNachziehen, vertragNachziehen, nachziehen };
}

module.exports = { createStruktur, VERTRAG_TYPEN };
