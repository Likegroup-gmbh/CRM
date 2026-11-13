// _shared/ablage/abgleich.js
// Ablage-Abgleich SharePoint -> CRM.
// 1. Delta-Feed ab dem gespeicherten Cursor in ablage_eingang (Lease + Fencing auf dem Cursor:
//    ein Laeufer je Bibliothek, idempotent je (drive_id, item_id)).
// 2. Eingang einzeln einordnen (Claim + Fencing je Item); die Entscheidung trifft
//    klassifizierung.js, ausgefuehrt wird in abgleich-datei.js / abgleich-ordner.js.
// 3. Fach-Geruest fuer neue Videos/Story-Slots, Produktions-Ebene nachziehen, CRM-Namen auf
//    die Ordner, Aufraeumen (abgleich-pflege.js).
// Abo (Webhook) erneuert der Zeitplan.

const { itemZuEingang } = require('./sharepoint');
const { SEITE, stuecke } = require('./liste');
const { createDateiAbgleich } = require('./abgleich-datei');
const { createOrdnerAbgleich } = require('./abgleich-ordner');
const { createPflege, ABO_RESTTAGE } = require('./abgleich-pflege');

const LEASE_SEK = 840;
const BUDGET_MS = 13 * 60 * 1000;
const RUNDE_MS = 3 * 60 * 1000;
const RUHE_SEK = Number(process.env.ABLAGE_RUHE_SEK) || 20;
const NACHLAUF_POLL_MS = 5000;
const HOLEN = 25;
const ITEM_LEASE_SEK = 300;
const MAX_VERSUCHE = 8;
const PFLEGE_MS = 10 * 60 * 1000;

/**
 * @param {object} deps
 * @param {object} deps.supabase Service-Client
 * @param {object} deps.ablage ablageAusEnv()
 * @param {number} [deps.ruheSek] Datei gilt als fertig, wenn sie so lange unveraendert ist
 * @param {number} [deps.nachlaufSek] Lauf bleibt nach neuen/wartenden Eintraegen so lange wach
 */
function createAbgleich({
  supabase,
  ablage,
  jetzt = () => Date.now(),
  ruheSek = RUHE_SEK,
  nachlaufSek = ruheSek + 5,
  schlafen = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  const { sp, ordner } = ablage;
  const driveId = sp.driveId;
  const iso = (ms = jetzt()) => new Date(ms).toISOString();

  async function rpc(name, args) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw new Error(`${name}: ${error.message}`);
    return data;
  }

  async function stand() {
    const { data, error } = await supabase.from('ablage_stand').select('*').eq('drive_id', driveId).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function standSetzen(patch) {
    const { error } = await supabase.from('ablage_stand').update({ ...patch, updated_at: iso() }).eq('drive_id', driveId);
    if (error) throw error;
  }

  async function eingangOffen(itemId) {
    const { data } = await supabase.from('ablage_eingang').select('status')
      .eq('drive_id', driveId).eq('item_id', itemId).maybeSingle();
    return data?.status === 'offen';
  }

  /** pfad ab Bibliothekswurzel; null, wenn der Eltern-Ordner unbekannt ist. */
  function pfadUnter(eltern, parentId, wurzel, name) {
    if (eltern && !eltern.geloescht_at && eltern.pfad != null) return `${eltern.pfad}/${name}`;
    return parentId === wurzel.item_id ? `/${name}` : null;
  }

  // Gemeinsamer Kontext der Teilmodule. Querverweise (c.dateiBearbeiten, c.storySlot, ...)
  // werden erst beim Aufruf aufgeloest, deshalb ist die Reihenfolge der Factories egal.
  const c = { supabase, sp, ordner, driveId, jetzt, iso, rpc, stand, standSetzen, eingangOffen, pfadUnter };
  Object.assign(c, createDateiAbgleich(c), createOrdnerAbgleich(c), createPflege(c));
  const { geruestNachziehen, strukturNachziehen, namenAbgleichen, aufraeumen, aboSicherstellen } = c;

  // ─── 1. Delta-Feed ──────────────────────────────────────────

  async function deltaLesen(token, { bis }) {
    const s = await stand();
    let link = s?.voll_abgleich_noetig ? null : (s?.delta_link || null);
    let voll = !link;
    let gesehen = voll ? new Set() : null;
    let neustart = false;
    const r = { seiten: 0, neu: 0, fertig: false, voll };

    while (jetzt() < bis) {
      let res;
      try {
        res = await sp.deltaSeite(link);
      } catch (err) {
        if (err.status !== 410 || neustart) throw err;
        // Cursor ungueltig (resyncRequired): Vollabgleich ab der Wurzel
        neustart = true;
        await standSetzen({ voll_abgleich_noetig: true });
        link = null;
        voll = true;
        r.voll = true;
        gesehen = new Set();
        continue;
      }
      r.seiten++;
      const items = (res.value || []).map(itemZuEingang).filter((i) => i.item_id);
      if (gesehen) for (const i of items) if (!i.geloescht) gesehen.add(i.item_id);
      if (items.length) r.neu += (await rpc('ablage_eingang_aufnehmen', { p_drive_id: driveId, p_items: items })) || 0;

      const weiter = res['@odata.nextLink'] || null;
      const naechster = weiter || res['@odata.deltaLink'] || null;
      if (!(await rpc('ablage_delta_speichern', { p_drive_id: driveId, p_token: token, p_delta_link: naechster }))) {
        return { ...r, lease_verloren: true };
      }
      if (!weiter) {
        // Vollabgleich zeigt keine Loeschungen: was im Eingang steht und nicht kam, ist weg
        if (gesehen) r.verschwunden = await verschwundeneMelden(gesehen);
        return { ...r, fertig: true };
      }
      link = weiter;
    }
    return r;
  }

  async function verschwundeneMelden(gesehen) {
    const weg = [];
    for (let von = 0; ; von += SEITE) {
      const { data, error } = await supabase.from('ablage_eingang').select('item_id')
        .eq('drive_id', driveId).eq('geloescht', false).order('item_id', { ascending: true }).range(von, von + SEITE - 1);
      if (error) throw error;
      for (const row of data || []) if (!gesehen.has(row.item_id)) weg.push({ item_id: row.item_id, geloescht: true });
      if (!data || data.length < SEITE) break;
    }
    for (const teil of stuecke(weg, 500)) await rpc('ablage_eingang_aufnehmen', { p_drive_id: driveId, p_items: teil });
    return weg.length;
  }

  // ─── 2. Eingang einordnen ───────────────────────────────────

  async function verarbeiten({ bis }) {
    const z = { erledigt: 0, warten: 0, unzugeordnet: 0, ignoriert: 0, fehler: 0, ueberholt: 0, leer: false };
    while (jetzt() < bis) {
      const rows = (await rpc('ablage_eingang_holen', {
        p_drive_id: driveId, p_limit: HOLEN, p_ruhe_sek: ruheSek, p_lease_sec: ITEM_LEASE_SEK,
      })) || [];
      if (!rows.length) {
        z.leer = true;
        break;
      }
      // Nicht mehr bearbeitete Claims laufen ueber gesperrt_bis ab
      for (const e of elternZuerst(rows)) {
        if (jetzt() >= bis) break;
        z[await eintragBearbeiten(e)]++;
      }
    }
    return z;
  }

  /** Im Delta fehlt der Pfad: Ordner einer Charge vor ihren Kindern (sonst warten die Kinder eine Runde). */
  function elternZuerst(rows) {
    const nachId = new Map(rows.map((r) => [r.item_id, r]));
    const tiefe = (r, n = 0) => {
      const p = nachId.get(r.parent_item_id);
      return p && n < rows.length ? tiefe(p, n + 1) : n;
    };
    return rows.map((r) => [tiefe(r), r]).sort((a, b) => a[0] - b[0] || (b[1].ist_ordner - a[1].ist_ordner)).map(([, r]) => r);
  }

  async function abschliessen(e, status, grund, ergebnis, wiederholenSek = 0) {
    return rpc('ablage_eingang_abschliessen', {
      p_drive_id: driveId, p_item_id: e.item_id, p_fence: e.fence, p_status: status,
      p_grund: grund || null, p_ergebnis: ergebnis || null, p_wiederholen_sek: wiederholenSek,
    });
  }

  async function eintragBearbeiten(e) {
    let d;
    try {
      // Geloeschte Items kommen ohne folder-Facet: das Register weiss, ob es ein Ordner war
      const istOrdner = e.ist_ordner || (e.geloescht && !!(await ordner.nachItem(e.item_id)));
      d = istOrdner ? await c.ordnerBearbeiten(e) : await c.dateiBearbeiten(e);
    } catch (err) {
      const versuche = e.versuche || 1;
      const endgueltig = versuche >= MAX_VERSUCHE;
      const sek = Math.min(3600, 30 * 2 ** Math.min(versuche, 7));
      await abschliessen(e, 'fehler', String(err?.message || err).slice(0, 500), null, endgueltig ? 0 : sek);
      return endgueltig ? 'fehler' : 'warten';
    }
    if (d.aktion === 'warten') {
      await abschliessen(e, 'offen', d.grund, null, d.sek || 60);
      return 'warten';
    }
    const status = d.aktion === 'unzugeordnet' ? 'unzugeordnet' : d.aktion === 'ignorieren' ? 'ignoriert' : 'erledigt';
    const ok = await abschliessen(e, status, d.grund, d);
    return ok ? status : 'ueberholt';
  }

  // ─── Lauf ───────────────────────────────────────────────────

  /**
   * Ein Hintergrundlauf: abwechselnd Delta lesen und Eingang einordnen, bis beides leer ist.
   * Nach neuen oder wartenden Eintraegen bleibt er nachlaufSek wach, bis die Dateien reif sind:
   * Webhooks waehrend des Laufs scheitern an der Lease, der Zeitplan kaeme erst zur naechsten Minute.
   * @param {{ budgetMs?:number, pflege?:boolean|'auto' }} [opts]
   */
  async function lauf({ budgetMs = BUDGET_MS, pflege = 'auto' } = {}) {
    const start = jetzt();
    const bis = start + budgetMs;
    await ordner.wurzel();
    const token = await rpc('ablage_lease_holen', { p_drive_id: driveId, p_sekunden: LEASE_SEK });
    if (token == null) return { lease: false };

    const r = { lease: true, seiten: 0, neu: 0, eingang: { erledigt: 0, warten: 0, unzugeordnet: 0, ignoriert: 0, fehler: 0, ueberholt: 0 } };
    let ruhig = false;
    let wachBis = 0;
    try {
      while (jetzt() < bis) {
        const delta = await deltaLesen(token, { bis: Math.min(bis, jetzt() + RUNDE_MS) });
        r.seiten += delta.seiten;
        r.neu += delta.neu;
        if (delta.verschwunden) r.verschwunden = delta.verschwunden;
        if (delta.lease_verloren) {
          r.lease_verloren = true;
          break;
        }
        const v = await verarbeiten({ bis: Math.min(bis, jetzt() + RUNDE_MS) });
        for (const k of Object.keys(r.eingang)) r.eingang[k] += v[k] || 0;
        if (delta.neu || v.warten) wachBis = Math.min(bis, jetzt() + nachlaufSek * 1000);
        if (delta.fertig && v.leer) {
          if (jetzt() + NACHLAUF_POLL_MS < wachBis) {
            await schlafen(NACHLAUF_POLL_MS);
            continue;
          }
          ruhig = true;
          break;
        }
      }
      if (!ruhig && !r.lease_verloren) r.mehr = true;
      if (!r.lease_verloren) {
        r.geruest = await geruestNachziehen({ bis });
        r.struktur = await strukturNachziehen({ bis });
        const s = await stand();
        const faellig = pflege === true || (pflege === 'auto' && (!s?.pflege_at || jetzt() - Date.parse(s.pflege_at) >= PFLEGE_MS));
        if (faellig) {
          r.namen = await namenAbgleichen({ bis });
          r.aufgeraeumt = await aufraeumen();
          await standSetzen({ pflege_at: iso() });
        }
        await standSetzen({ letzter_erfolg: iso(), fehler: null, fehler_seit: null });
      }
    } catch (err) {
      r.fehler = String(err?.message || err).slice(0, 500);
      const s = await stand().catch(() => null);
      await standSetzen({ fehler: r.fehler, fehler_seit: s?.fehler_seit || iso() }).catch(() => {});
    } finally {
      await rpc('ablage_lease_freigeben', { p_drive_id: driveId, p_token: token }).catch(() => {});
    }
    return r;
  }

  return {
    lauf,
    deltaLesen,
    verarbeiten,
    eintragBearbeiten,
    geruestNachziehen,
    strukturNachziehen,
    namenAbgleichen,
    aufraeumen,
    aboSicherstellen,
    stand,
  };
}

module.exports = { createAbgleich, LEASE_SEK, PFLEGE_MS, ABO_RESTTAGE };
