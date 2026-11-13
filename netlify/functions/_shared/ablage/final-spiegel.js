// _shared/ablage/final-spiegel.js
// Finale Version im Finder (ADR 0073). Eine Finale, die nur auf eine Datei der Feedbackschleife
// verweist (source_asset_id, gleiche item_id), bekommt eine Kopie in Finale_Version/<Format>,
// Finale_Version/Story_K bzw. Finale_Version (Bilder). Die Kopie ist Spiegel, nicht Quelle: das CRM
// spielt weiter das Original, Asset-Zeilen kennen die Kopie nicht, nur ablage_final_spiegel.
// Kopiert wird server-seitig (Graph copy, Monitor-URL), der Spiegel folgt dem Original: neuer
// Inhalt (cTag) oder neue Datei (Umzug) -> alte Kopie weg, neue Kopie. Final aufgehoben, Rueckgaengig
// oder Original geloescht -> Kopie weg. Im Finder geloeschte Kopien bleiben weg (Status entfernt).

const { TABELLE } = require('./asset');
const { konfliktNamePasst } = require('./pfad');
const { notschalterAn } = require('./ziel');
const { istNichtGefunden } = require('./graph');

const SPIEGEL = 'ablage_final_spiegel';
const CLAIM_SEK = 600;
const BUDGET_MS = 12 * 60 * 1000;
// Je Zeile nur kurz warten: weitere Kopien laufen bei Graph parallel an, gepollt wird spaeter
const KOPIE_WARTEN_MS = 30 * 1000;
const KOPIE_TAKT_MS = 3000;
const KOPIE_NEU_SEK = 30;
const LAEUFT = new Set(['notStarted', 'inProgress', 'waiting', 'updating']);
const MAX_VERSUCHE = 6;
const PARALLEL = 1;
// Der Alarm meldet ab 80 %; Kopien laufen bis 90 %, danach stuendlich erneut versucht
const SPEICHER_ANTEIL = 0.9;
const SPEICHER_WARTEN_SEK = 3600;
const FINALE_PFAD = /\/Finale[_ ]Version\//i;
const IGNORIEREN = { aktion: 'ignorieren', grund: 'final_spiegel' };

class SpiegelFehler extends Error {
  constructor(grund, { permanent = false } = {}) {
    super(grund);
    this.grund = grund;
    this.permanent = permanent;
  }
}

/** Braucht diese Final-Zeile eine Kopie? Gleiche Regel wie private.ablage_final_soll. */
function finalSpiegelSoll(asset, driveId) {
  return !!asset && !!asset.is_final && asset.ablage === 'sharepoint' && asset.drive_id === driveId
    && !!asset.item_id && !FINALE_PFAD.test(asset.file_path || '');
}

/**
 * Abgleich: Ist das Item eine Spiegel-Kopie, wird es ignoriert. Sonst legte die Klassifizierung
 * aus der Kopie in Finale_Version eine zweite, direkt hochgeladene Finale an. Eine Kopie, deren
 * Monitor noch nicht fertig gemeldet hat, erkennt sie am Zielordner, Namen und an der Groesse.
 * -> Entscheidung fuer den Eingang | null (kein Spiegel)
 */
async function spiegelImAbgleich({ supabase, sp, driveId }, e) {
  const finde = async (spalte) => {
    const { data, error } = await supabase.from(SPIEGEL).select('id, kopie_item_id, alt_kopie_item_id')
      .eq('drive_id', driveId).eq(spalte, e.item_id).limit(1);
    if (error) throw error;
    return data?.[0] || null;
  };

  const bekannt = (await finde('kopie_item_id')) || (await finde('alt_kopie_item_id'));
  if (bekannt) {
    if (!e.geloescht) return IGNORIEREN;
    await spiegelGeloescht(supabase, driveId, e.item_id);
    return { aktion: 'ignorieren', grund: 'final_spiegel_geloescht' };
  }

  if (e.geloescht || !e.parent_item_id) return null;
  const { data: laufend, error } = await supabase.from(SPIEGEL).select('id, kopie_name, groesse')
    .eq('drive_id', driveId).eq('status', 'offen').eq('kopie_parent_item_id', e.parent_item_id).is('kopie_item_id', null);
  if (error) throw error;
  if (!laufend?.length) return null;
  const item = await sp.item(e.item_id, 'id,name,size');
  const treffer = item && laufend.find((s) => konfliktNamePasst(s.kopie_name, s.groesse, item));
  if (!treffer) return null;
  const { data: gesetzt, error: uErr } = await supabase.from(SPIEGEL).update({ kopie_item_id: item.id })
    .eq('id', treffer.id).is('kopie_item_id', null).select('id');
  if (uErr) throw uErr;
  return gesetzt?.length ? IGNORIEREN : null;
}

/**
 * Kopie geloescht (im Finder, auch ueber einen Ordner darueber): der Spiegel bleibt weg, bis die
 * Admin-Seite neu spiegelt. Eine alte Kopie (Re-Sync) ist damit nur erledigt. -> Anzahl Spiegel
 */
async function spiegelGeloescht(supabase, driveId, itemId) {
  const { data, error } = await supabase.from(SPIEGEL)
    .update({ status: 'entfernt', grund: 'im_finder_geloescht', kopie_item_id: null, gesperrt_bis: null })
    .eq('drive_id', driveId).eq('kopie_item_id', itemId).select('id');
  if (error) throw error;
  const { error: aErr } = await supabase.from(SPIEGEL).update({ alt_kopie_item_id: null })
    .eq('drive_id', driveId).eq('alt_kopie_item_id', itemId);
  if (aErr) throw aErr;
  return data?.length || 0;
}

/**
 * @param {object} deps
 * @param {object} deps.supabase Service-Client
 * @param {object} deps.ablage ablageAusEnv()
 */
function createFinalSpiegel({
  supabase,
  ablage,
  jetzt = () => Date.now(),
  schlafen = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  const { sp, ordner } = ablage;
  const driveId = sp.driveId;
  const iso = (ms = jetzt()) => new Date(ms).toISOString();
  // Belegung je Lauf: einmal aus ablage_stand, danach um jede Kopie erhoeht
  let belegt = null;

  async function rpc(name, args) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw new Error(`${name}: ${error.message}`);
    return data;
  }

  async function setzen(id, patch) {
    const { error } = await supabase.from(SPIEGEL).update(patch).eq('id', id);
    if (error) throw error;
  }

  async function zeileLaden(id) {
    const { data, error } = await supabase.from(SPIEGEL).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function assetLaden(typ, id) {
    const { data, error } = await supabase.from(TABELLE[typ]).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  /** Neue Finale einreihen, veraltete und verwaiste wieder oeffnen. alle: auch Bestand, Fehler, Entferntes. */
  async function scan({ alle = false } = {}) {
    return Number(await rpc('ablage_final_spiegel_scan', { p_drive_id: driveId, p_alle: alle })) || 0;
  }

  async function stand() {
    const data = await rpc('ablage_final_spiegel_stand', { p_drive_id: driveId });
    const z = (Array.isArray(data) ? data[0] : data) || {};
    const n = (v) => Number(v) || 0;
    return {
      offen: n(z.offen), fertig: n(z.fertig), fehler: n(z.fehler), entfernt: n(z.entfernt),
      ohne_kopie: n(z.ohne_kopie), ohne_kopie_bytes: n(z.ohne_kopie_bytes), kopie_bytes: n(z.kopie_bytes),
    };
  }

  /** Wie viele Laeufer der Zeitplan zusaetzlich anstossen soll. */
  async function laeuferBedarf({ parallel = PARALLEL } = {}) {
    const t = iso();
    const basis = () => supabase.from(SPIEGEL).select('id', { count: 'exact', head: true }).eq('drive_id', driveId).eq('status', 'offen');
    const [laufend, faellig] = await Promise.all([basis().gt('gesperrt_bis', t), basis().lte('naechster_versuch', t)]);
    if (laufend.error) throw laufend.error;
    if (faellig.error) throw faellig.error;
    const frei = (faellig.count || 0) - (laufend.count || 0);
    return Math.max(0, Math.min(parallel - (laufend.count || 0), frei));
  }

  async function speicherKnapp(groesse) {
    if (!belegt) {
      const { data } = await supabase.from('ablage_stand').select('quota_used, quota_total').eq('drive_id', driveId).maybeSingle();
      belegt = { used: Number(data?.quota_used) || 0, total: Number(data?.quota_total) || 0 };
    }
    if (!belegt.total) return false;
    return belegt.used + (Number(groesse) || 0) > belegt.total * SPEICHER_ANTEIL;
  }

  async function kontextVon(typ, a) {
    const ctx = {
      typ,
      kooperation_id: a.kooperation_id || null,
      kooperation_video_id: a.video_id || null,
      story_id: a.story_id || null,
      version_number: 1,
      is_final: true,
      variant_name: a.variant_name || null,
    };
    if (!ctx.kooperation_id && ctx.kooperation_video_id) {
      const { data, error } = await supabase.from('kooperation_videos').select('kooperation_id').eq('id', ctx.kooperation_video_id).maybeSingle();
      if (error) throw error;
      ctx.kooperation_id = data?.kooperation_id || null;
    }
    if (!ctx.kooperation_id) throw new SpiegelFehler('ohne_kooperation', { permanent: true });
    return ctx;
  }

  // ─── Zustaende ───

  async function beenden(row, status, extra = {}) {
    await setzen(row.id, {
      status, grund: null, gesperrt_bis: null, versuche: 0, ...(status === 'fertig' ? { fertig_at: iso() } : {}), ...extra,
    });
    return { status };
  }

  async function spaeter(row, grund, sek) {
    await setzen(row.id, { grund, gesperrt_bis: null, naechster_versuch: iso(jetzt() + sek * 1000) });
    return { status: 'offen', grund };
  }

  async function fehlerBuchen(row, err) {
    const grund = err instanceof SpiegelFehler ? err.grund : String(err?.message || err).slice(0, 300);
    const versuche = (row.versuche || 0) + 1;
    const endgueltig = !!err?.permanent || versuche >= MAX_VERSUCHE;
    await setzen(row.id, {
      versuche,
      grund,
      gesperrt_bis: null,
      ...(endgueltig ? { status: 'fehler' } : { naechster_versuch: iso(jetzt() + Math.min(3600, 60 * 2 ** versuche) * 1000) }),
    });
    if (!(err instanceof SpiegelFehler)) console.warn('[ablage-final-spiegel]', row.typ, row.asset_id, grund);
    return { status: endgueltig ? 'fehler' : 'offen', grund };
  }

  // ─── Kopie ───

  /** Alte Kopie (Re-Sync) loeschen. Bis dahin steht sie in alt_kopie_item_id, der Abgleich ignoriert sie. */
  async function altLoeschen(row) {
    await sp.loeschen(row.alt_kopie_item_id);
    await setzen(row.id, { alt_kopie_item_id: null });
    return { ...row, alt_kopie_item_id: null };
  }

  async function kopieVerwerfen(row) {
    const r = { ...row, alt_kopie_item_id: row.kopie_item_id, kopie_item_id: null };
    await setzen(row.id, { alt_kopie_item_id: r.alt_kopie_item_id, kopie_item_id: null });
    return altLoeschen(r);
  }

  async function kopieStarten(row, asset, { bis }) {
    const quelle = await sp.item(asset.item_id, 'id,name,size,cTag');
    if (!quelle) throw new SpiegelFehler('quelle_fehlt');
    if (await speicherKnapp(quelle.size)) return spaeter(row, 'speicher_knapp', SPEICHER_WARTEN_SEK);
    const { ordner: ziel } = await ordner.zielOrdner(await kontextVon(row.typ, asset));
    // Ziel vor der Kopie: meldet der Delta-Feed die Kopie vor der Monitor-URL, erkennt der Abgleich sie trotzdem
    const patch = {
      kopie_parent_item_id: ziel.item_id,
      kopie_name: quelle.name,
      groesse: quelle.size ?? row.groesse ?? null,
      quell_item_id: quelle.id,
      kopie_von_ctag: quelle.cTag || null,
      quell_ctag: asset.ctag || quelle.cTag || null,
    };
    await setzen(row.id, patch);
    const monitor = await sp.kopieren(driveId, quelle.id, ziel.item_id, quelle.name);
    if (!monitor) throw new SpiegelFehler('kopie_ohne_monitor');
    await setzen(row.id, { monitor_url: monitor });
    return kopieAbwarten({ ...row, ...patch, monitor_url: monitor }, { bis });
  }

  async function kopieAbwarten(row, { bis }) {
    const ende = Math.min(bis, jetzt() + KOPIE_WARTEN_MS);
    for (;;) {
      let st = null;
      try {
        st = await sp.kopierStatus(row.monitor_url);
      } catch (err) {
        if (!istNichtGefunden(err)) throw err;
      }
      if (st?.status === 'completed' && st.itemId) return abschliessen(row, st.itemId);
      if (!st || !LAEUFT.has(st.status)) {
        // Monitor weg oder fehlgeschlagen: vielleicht hat der Abgleich die Kopie schon erkannt
        const frisch = await zeileLaden(row.id);
        if (frisch?.kopie_item_id) return abschliessen(frisch, frisch.kopie_item_id);
        await setzen(row.id, { monitor_url: null });
        throw new SpiegelFehler(st ? `kopie_${st.status || 'unbekannt'}` : 'monitor_weg');
      }
      if (jetzt() >= ende) {
        await setzen(row.id, { gesperrt_bis: null, naechster_versuch: iso(jetzt() + KOPIE_NEU_SEK * 1000) });
        return { status: 'offen', grund: 'kopie_laeuft' };
      }
      await schlafen(KOPIE_TAKT_MS);
    }
  }

  async function abschliessen(row, itemId) {
    const frisch = (await zeileLaden(row.id)) || row;
    let kopie = itemId;
    // Der Abgleich hat schon eine fruehere Kopie erkannt (Monitor ging verloren): die neue wieder weg
    if (frisch.kopie_item_id && frisch.kopie_item_id !== itemId) {
      await sp.loeschen(itemId).catch(() => {});
      kopie = frisch.kopie_item_id;
    }
    // Waehrend der Kopie aufgehoben (Rueckgaengig, Final aufheben): gleich wieder weg
    if (!finalSpiegelSoll(await assetLaden(row.typ, row.asset_id), driveId)) {
      await setzen(row.id, { kopie_item_id: kopie, monitor_url: null });
      return entfernen({ ...frisch, kopie_item_id: kopie, monitor_url: null });
    }
    await beenden(row, 'fertig', { kopie_item_id: kopie, monitor_url: null });
    const bytes = Number(frisch.groesse ?? row.groesse) || 0;
    if (belegt) belegt.used += bytes;
    return { status: 'fertig', bytes };
  }

  /** Verwaist: laufende Kopie abwarten, dann Kopien loeschen und die Zeile austragen. */
  async function entfernen(row) {
    if (row.monitor_url) {
      let st = null;
      try {
        st = await sp.kopierStatus(row.monitor_url);
      } catch (err) {
        if (!istNichtGefunden(err)) throw err;
      }
      if (st && LAEUFT.has(st.status)) return spaeter(row, 'kopie_laeuft_verwaist', KOPIE_NEU_SEK);
      if (st?.status === 'completed' && st.itemId) await sp.loeschen(st.itemId);
    }
    const frisch = (await zeileLaden(row.id)) || row;
    for (const itemId of new Set([frisch.kopie_item_id, frisch.alt_kopie_item_id].filter(Boolean))) await sp.loeschen(itemId);
    const { error } = await supabase.from(SPIEGEL).delete().eq('id', row.id);
    if (error) throw error;
    return { status: 'entfernt', grund: 'verwaist' };
  }

  async function eintragBearbeiten(row, { bis = jetzt() + BUDGET_MS } = {}) {
    try {
      const asset = await assetLaden(row.typ, row.asset_id);
      if (!finalSpiegelSoll(asset, driveId)) return await entfernen(row);
      let r = row;
      if (r.alt_kopie_item_id) r = await altLoeschen(r);
      if (r.monitor_url) return await kopieAbwarten(r, { bis });
      if (r.kopie_item_id) {
        if (r.quell_item_id === asset.item_id && (!asset.ctag || asset.ctag === r.quell_ctag)) return await beenden(r, 'fertig');
        // Neuer cTag an der Zeile heisst nicht immer neuer Inhalt (nachgezogen, Metadaten): am Item pruefen
        const quelle = await sp.item(asset.item_id, 'id,cTag');
        if (quelle && quelle.id === r.quell_item_id && quelle.cTag && quelle.cTag === r.kopie_von_ctag) {
          return await beenden(r, 'fertig', { quell_ctag: asset.ctag || r.quell_ctag });
        }
        r = await kopieVerwerfen(r);
      }
      return await kopieStarten(r, asset, { bis });
    } catch (err) {
      return fehlerBuchen(row, err);
    }
  }

  async function holen() {
    const data = await rpc('ablage_final_spiegel_holen', { p_drive_id: driveId, p_sekunden: CLAIM_SEK });
    return (Array.isArray(data) ? data[0] : data) || null;
  }

  // Medien-Notschalter und ABLAGE_ZIEL=dropbox halten auch die Kopien an
  async function lauf({ budgetMs = BUDGET_MS } = {}) {
    if (process.env.ABLAGE_ZIEL === 'dropbox' || await notschalterAn(supabase)) return { pausiert: true };
    await ordner.wurzel();
    const r = { eingereiht: await scan(), fertig: 0, offen: 0, fehler: 0, entfernt: 0, bytes: 0 };
    const bis = jetzt() + budgetMs;
    belegt = null;
    while (jetzt() < bis) {
      const row = await holen();
      if (!row) {
        r.leer = true;
        break;
      }
      const e = await eintragBearbeiten(row, { bis });
      r[e.status] = (r[e.status] || 0) + 1;
      r.bytes += e.bytes || 0;
    }
    return r;
  }

  return { lauf, scan, stand, laeuferBedarf, eintragBearbeiten };
}

module.exports = { createFinalSpiegel, spiegelImAbgleich, spiegelGeloescht, finalSpiegelSoll, SpiegelFehler, PARALLEL };
