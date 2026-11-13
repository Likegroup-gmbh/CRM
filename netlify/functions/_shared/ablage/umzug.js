// _shared/ablage/umzug.js
// Umzug des Bestands nach SharePoint, je Original-Asset eine Zeile in ablage_umzug.
// Dropbox: temporaerer Link, Range-GET in 10-MiB-Stuecken in eine Upload-Session mit
// deferCommit (unsichtbar bis zum Commit), fortsetzbar ueber Laeufe hinweg.
// OneDrive-Freigabelinks: Kopie innerhalb des Tenants, Monitor-URL pollen.
// Vor Commit bzw. Kopie steht eine ablage_upload-Zeile mit umzug_asset_id: stirbt der Laeufer
// danach, haengt der Abgleich die Datei an die Bestandszeile statt ein zweites Asset anzulegen.
// Einsortiert wird nach den Fachspalten der Zeile (zielOrdner), nicht nach dem alten Dropbox-Pfad.
// Dokumente (ADR 0068, eigener Notschalter + Weiche): Quelle Dropbox oder Supabase-Storage, ganz
// in den Speicher (max. 200 MB), Session mit deferCommit, Ordner wie beim Upload (dokumentKette).
// rechnung_alt (rechnung.pdf_url ohne rechnung_pdfs-Zeile) wird zu einer rechnung_pdfs-Zeile.

const { createDropboxAblage } = require('./dropbox');
const { TABELLE, dateiSpalten, umstellen } = require('./asset');
const { dateiname } = require('./pfad');
const { notschalterAn, dokumenteNotschalterAn } = require('./ziel');
const { istNichtGefunden } = require('./graph');
const dokument = require('./dokument');

const CHUNK = 32 * 320 * 1024;
const CLAIM_SEK = 900;
const BUDGET_MS = 12 * 60 * 1000;
const KOPIE_WARTEN_MS = 90 * 1000;
const KOPIE_TAKT_MS = 3000;
const KOPIE_NEU_SEK = 30;
// So lange bekommt der Abgleich Zeit, eine womoeglich schon committete Datei anzuhaengen
const ABGLEICH_FRIST_MS = 30 * 60 * 1000;
const MAX_VERSUCHE = 6;
const PARALLEL = 2;
const SEITE = 1000;

class UmzugFehler extends Error {
  constructor(grund, { permanent = false, ueberspringen = false } = {}) {
    super(grund);
    this.grund = grund;
    this.permanent = permanent;
    this.ueberspringen = ueberspringen;
  }
}

function ersterOffset(ranges) {
  const r = (ranges || [])[0];
  if (r == null) return null;
  const n = Number(String(r).split('-')[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} deps
 * @param {object} deps.supabase Service-Client
 * @param {object} deps.ablage ablageAusEnv()
 * @param {object} [deps.dropbox] createDropboxAblage()
 */
function createUmzug({
  supabase,
  ablage,
  dropbox = createDropboxAblage(),
  fetchImpl = (...a) => fetch(...a),
  jetzt = () => Date.now(),
  schlafen = (ms) => new Promise((r) => setTimeout(r, ms)),
  chunkBytes = CHUNK,
}) {
  const { sp, ordner } = ablage;
  const driveId = sp.driveId;
  const iso = (ms = jetzt()) => new Date(ms).toISOString();

  async function setzen(id, patch) {
    const { error } = await supabase.from('ablage_umzug').update(patch).eq('id', id);
    if (error) throw error;
  }

  /** Bestand eines Unternehmens einreihen (erneut: Fehler wieder oeffnen). -> Anzahl */
  async function anlegen(unternehmenId) {
    const { data, error } = await supabase.rpc('ablage_umzug_anlegen', { p_drive_id: driveId, p_unternehmen_id: unternehmenId });
    if (error) throw new Error(`ablage_umzug_anlegen: ${error.message}`);
    return Number(data) || 0;
  }

  /** Fortschritt je Unternehmen: [{ unternehmen_id, offen, fertig, fehler, uebersprungen }] */
  async function uebersicht() {
    const je = new Map();
    for (let von = 0; ; von += SEITE) {
      const { data, error } = await supabase.from('ablage_umzug').select('id, unternehmen_id, status')
        .eq('drive_id', driveId).order('id', { ascending: true }).range(von, von + SEITE - 1);
      if (error) throw error;
      for (const z of data || []) {
        if (!je.has(z.unternehmen_id)) je.set(z.unternehmen_id, { unternehmen_id: z.unternehmen_id, offen: 0, fertig: 0, fehler: 0, uebersprungen: 0 });
        je.get(z.unternehmen_id)[z.status]++;
      }
      if (!data || data.length < SEITE) break;
    }
    return [...je.values()];
  }

  /** Wie viele Laeufer der Zeitplan zusaetzlich anstossen soll. */
  async function laeuferBedarf({ parallel = PARALLEL } = {}) {
    const t = iso();
    const basis = () => supabase.from('ablage_umzug').select('id', { count: 'exact', head: true }).eq('drive_id', driveId).eq('status', 'offen');
    const [laufend, faellig] = await Promise.all([basis().gt('gesperrt_bis', t), basis().lte('naechster_versuch', t)]);
    if (laufend.error) throw laufend.error;
    if (faellig.error) throw faellig.error;
    const frei = (faellig.count || 0) - (laufend.count || 0);
    return Math.max(0, Math.min(parallel - (laufend.count || 0), frei));
  }

  async function assetLaden(typ, id) {
    const { data, error } = await supabase.from(TABELLE[typ]).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function kontextVon(typ, a) {
    const ctx = {
      typ,
      kooperation_id: a.kooperation_id || null,
      kooperation_video_id: a.video_id || null,
      story_id: a.story_id || null,
      version_number: a.version_number || 1,
      is_final: !!a.is_final,
      variant_name: a.variant_name || null,
    };
    if (!ctx.kooperation_id && ctx.kooperation_video_id) {
      const { data, error } = await supabase.from('kooperation_videos').select('kooperation_id').eq('id', ctx.kooperation_video_id).maybeSingle();
      if (error) throw error;
      ctx.kooperation_id = data?.kooperation_id || null;
    }
    if (!ctx.kooperation_id) throw new UmzugFehler('ohne_kooperation', { permanent: true });
    return ctx;
  }

  async function uploadMerken(row, ctx, asset, { parentId, name, groesse }) {
    const { data, error } = await supabase.from('ablage_upload').insert({
      drive_id: driveId,
      parent_item_id: parentId,
      name,
      groesse: groesse || 0,
      typ: row.typ,
      kontext: { ...ctx, umzug_asset_id: asset.id },
      erstellt_at: iso(),
    }).select('id').single();
    if (error) throw error;
    return data.id;
  }

  /**
   * Session bzw. Monitor ist weg. Lief schon ein Commit/eine Kopie (upload_id), bekommt der
   * Abgleich Zeit, die Datei anzuhaengen; danach beginnt der Umzug dieser Zeile neu.
   */
  async function verloren(row) {
    if (row.upload_id) {
      const { data: up } = await supabase.from('ablage_upload').select('id, erstellt_at').eq('id', row.upload_id).maybeSingle();
      if (up && jetzt() - Date.parse(up.erstellt_at) < ABGLEICH_FRIST_MS) {
        await setzen(row.id, { gesperrt_bis: null, grund: 'wartet_auf_abgleich', naechster_versuch: iso(jetzt() + 15 * 60 * 1000) });
        return { status: 'offen', grund: 'wartet_auf_abgleich' };
      }
      if (up) await supabase.from('ablage_upload').delete().eq('id', up.id);
    }
    await setzen(row.id, { upload_url: null, kopie_url: null, versatz: 0, upload_id: null });
    return null;
  }

  async function abschliessen(row, asset, item, ziel, { uploadId, groesse }) {
    if (groesse != null && item.size != null && Number(item.size) !== Number(groesse)) {
      await sp.loeschen(item.id).catch(() => {});
      await setzen(row.id, { upload_url: null, kopie_url: null, versatz: 0 });
      throw new UmzugFehler('groesse_falsch');
    }
    // Bild ohne Video liegt jetzt in der Runde des ersten Videos (Register-Zeile kennt es) und haengt auch dort
    const video = row.typ === 'still' && !asset.video_id && ziel.kooperation_video_id ? { video_id: ziel.kooperation_video_id } : {};
    try {
      await umstellen(supabase, row.typ, asset, { ...dateiSpalten(item, { driveId, pfad: `${ziel.pfad}/${item.name}` }), ...video });
    } catch (err) {
      if (err?.code === '23505') throw new UmzugFehler('item_doppelt', { permanent: true });
      throw err;
    }
    if (uploadId) await supabase.from('ablage_upload').update({ item_id: item.id, abgeschlossen_at: iso() }).eq('id', uploadId);
    await setzen(row.id, {
      status: 'fertig', grund: null, item_id: item.id, fertig_at: iso(), gesperrt_bis: null, upload_url: null, kopie_url: null,
    });
    return { status: 'fertig', bytes: Number(item.size) || 0 };
  }

  // ─── Dropbox ───

  async function dropboxGroesse(url) {
    const resp = await fetchImpl(url, { headers: { Range: 'bytes=0-0' } });
    await resp.arrayBuffer().catch(() => null);
    if (resp.status === 416) return 0;
    if (resp.status === 404 || resp.status === 410) throw new UmzugFehler('dropbox_fehlt', { permanent: true });
    if (resp.status !== 206 && resp.status !== 200) throw new UmzugFehler(`dropbox_${resp.status}`);
    const m = /\/(\d+)\s*$/.exec(resp.headers?.get?.('content-range') || '');
    if (m) return Number(m[1]);
    const laenge = Number(resp.headers?.get?.('content-length'));
    if (resp.status === 200 && Number.isFinite(laenge)) return laenge;
    throw new UmzugFehler('dropbox_ohne_groesse');
  }

  async function rangeLesen(url, von, bis) {
    const resp = await fetchImpl(url, { headers: { Range: `bytes=${von}-${bis}` } });
    if (resp.status === 404 || resp.status === 410) throw new UmzugFehler('dropbox_link_weg');
    if (resp.status !== 206 && !(resp.status === 200 && von === 0)) throw new UmzugFehler(`dropbox_${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    return resp.status === 200 ? buf.subarray(0, bis - von + 1) : buf;
  }

  async function dropboxUmziehen(row, asset, ctx, ziel, { bis }) {
    const link = await dropbox.downloadUrl(row.quelle_ref);
    if (!link?.url) throw new UmzugFehler('dropbox_fehlt', { permanent: true });

    let url = row.upload_url;
    let versatz = Number(row.versatz) || 0;
    let groesse = row.groesse != null ? Number(row.groesse) : null;
    let name = row.ziel_name;
    let uploadId = row.upload_id || null;
    let alleDa = false;

    if (url) {
      const st = await sp.sessionStatus(url);
      if (st) {
        const n = ersterOffset(st.nextExpectedRanges);
        if (n == null) alleDa = true;
        else versatz = n;
      } else {
        const r = await verloren(row);
        if (r) return r;
        url = null;
      }
    }
    if (!url) {
      groesse = await dropboxGroesse(link.url);
      if (!groesse) throw new UmzugFehler('leer', { ueberspringen: true });
      name = dateiname(asset.file_name || row.quelle_ref);
      const s = await sp.uploadSession(ziel.item_id, name, { conflict: 'rename', deferCommit: true });
      url = s.uploadUrl;
      versatz = 0;
      uploadId = null;
      await setzen(row.id, { upload_url: url, versatz: 0, groesse, ziel_parent_item_id: ziel.item_id, ziel_name: name, upload_id: null });
    }

    let item = null;
    while (!alleDa && versatz < groesse) {
      if (jetzt() >= bis) {
        await setzen(row.id, { versatz, gesperrt_bis: null });
        return { status: 'offen', grund: 'fortsetzen' };
      }
      const ende = Math.min(groesse, versatz + chunkBytes) - 1;
      const buf = await rangeLesen(link.url, versatz, ende);
      let res;
      try {
        res = await sp.chunkHochladen(url, buf, versatz, groesse);
      } catch (err) {
        if (istNichtGefunden(err)) {
          await setzen(row.id, { upload_url: null, versatz: 0 });
          throw new UmzugFehler('session_abgelaufen');
        }
        throw err;
      }
      if (res.fertig && res.body?.id) item = res.body;
      versatz = ersterOffset(res.body?.nextExpectedRanges) ?? ende + 1;
      await setzen(row.id, { versatz });
    }

    if (!uploadId) {
      uploadId = await uploadMerken(row, ctx, asset, { parentId: ziel.item_id, name, groesse });
      await setzen(row.id, { upload_id: uploadId });
    }
    if (!item) item = await sp.sessionAbschliessen(url);
    if (!item?.id) throw new UmzugFehler('commit_ohne_item');
    return abschliessen(row, asset, item, ziel, { uploadId, groesse });
  }

  // ─── OneDrive-Freigabelinks ───

  async function onedriveUmziehen(row, asset, ctx, ziel, { bis }) {
    let monitor = row.kopie_url;
    let uploadId = row.upload_id;
    let groesse = row.groesse != null ? Number(row.groesse) : null;

    if (!monitor) {
      let q;
      try {
        q = await sp.freigabeAufloesen(row.quelle_ref);
      } catch (err) {
        if (err?.status === 401 || err?.status === 403) throw new UmzugFehler('onedrive_kein_zugriff', { permanent: true });
        if (err?.status === 400 || istNichtGefunden(err) || err?.status === 410) throw new UmzugFehler('onedrive_weg', { permanent: true });
        throw err;
      }
      if (q.ordner) throw new UmzugFehler('onedrive_ordner', { ueberspringen: true });
      const name = dateiname(q.name || asset.file_name || 'video.mp4');
      groesse = q.groesse ?? null;
      uploadId = await uploadMerken(row, ctx, asset, { parentId: ziel.item_id, name, groesse });
      monitor = await sp.kopieren(q.driveId, q.itemId, ziel.item_id, name);
      if (!monitor) throw new UmzugFehler('kopie_ohne_monitor');
      await setzen(row.id, { kopie_url: monitor, upload_id: uploadId, ziel_parent_item_id: ziel.item_id, ziel_name: name, groesse });
    }

    const ende = Math.min(bis, jetzt() + KOPIE_WARTEN_MS);
    for (;;) {
      let st;
      try {
        st = await sp.kopierStatus(monitor);
      } catch (err) {
        if (!istNichtGefunden(err)) throw err;
        const r = await verloren({ ...row, upload_id: uploadId });
        if (r) return r;
        await setzen(row.id, { gesperrt_bis: null });
        return { status: 'offen', grund: 'kopie_neu' };
      }
      if (st.status === 'completed' && st.itemId) {
        const item = await sp.item(st.itemId);
        if (!item) throw new UmzugFehler('kopie_ohne_item');
        return abschliessen(row, asset, item, ziel, { uploadId, groesse });
      }
      if (st.status === 'failed') {
        if (uploadId) await supabase.from('ablage_upload').delete().eq('id', uploadId);
        await setzen(row.id, { kopie_url: null, upload_id: null });
        throw new UmzugFehler('kopie_fehlgeschlagen');
      }
      if (jetzt() >= ende) {
        await setzen(row.id, { gesperrt_bis: null, naechster_versuch: iso(jetzt() + KOPIE_NEU_SEK * 1000) });
        return { status: 'offen', grund: 'kopie_laeuft' };
      }
      await schlafen(KOPIE_TAKT_MS);
    }
  }

  // ─── Dokumente ───

  /** Dokumente eines Unternehmens einreihen (erneut: Fehler wieder oeffnen). -> Anzahl */
  async function dokumenteAnlegen(unternehmenId) {
    const { data, error } = await supabase.rpc('ablage_dokument_umzug_anlegen', { p_drive_id: driveId, p_unternehmen_id: unternehmenId });
    if (error) throw new Error(`ablage_dokument_umzug_anlegen: ${error.message}`);
    return Number(data) || 0;
  }

  const dokTyp = (typ) => (typ === 'rechnung_alt' ? 'rechnung' : typ);

  async function dokumentLaden(row) {
    if (row.typ === 'rechnung_alt') {
      const { data, error } = await supabase.from('rechnung').select('id, rechnung_nr, pdf_url, pdf_path').eq('id', row.asset_id).maybeSingle();
      if (error) throw error;
      return data || null;
    }
    const def = dokument.DOKUMENT[row.typ];
    const extra = row.typ === 'auftragsdokument' ? ['dokument_typ'] : [];
    const { data, error } = await supabase.from(def.tabelle).select(dokument.spaltenSelect(row.typ, extra)).eq('id', row.asset_id).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function dokumentBytes(row) {
    if (row.quelle === 'storage') {
      const m = dokument.STORAGE_URL.exec(row.quelle_ref || '');
      const bucket = row.quelle_bucket || (m && decodeURIComponent(m[1]));
      const pfad = m ? decodeURIComponent(m[2]) : row.quelle_ref;
      if (!bucket || !pfad) throw new UmzugFehler('ohne_quelle', { ueberspringen: true });
      const { data, error } = await supabase.storage.from(bucket).download(pfad);
      if (error) {
        if (/not.?found|404/i.test(`${error.message} ${error.statusCode || ''}`)) throw new UmzugFehler('storage_fehlt', { permanent: true });
        throw new UmzugFehler(`storage: ${String(error.message).slice(0, 200)}`);
      }
      return Buffer.from(await data.arrayBuffer());
    }
    if (row.quelle !== 'dropbox') throw new UmzugFehler(`quelle_${row.quelle}`, { permanent: true });
    const link = await dropbox.downloadUrl(row.quelle_ref);
    if (!link?.url) throw new UmzugFehler('dropbox_fehlt', { permanent: true });
    const resp = await fetchImpl(link.url, { headers: {} });
    if (resp.status === 404 || resp.status === 410) throw new UmzugFehler('dropbox_fehlt', { permanent: true });
    if (!resp.ok) throw new UmzugFehler(`dropbox_${resp.status}`);
    return Buffer.from(await resp.arrayBuffer());
  }

  function dokumentName(row, doc, def) {
    if (row.typ === 'rechnung_alt') {
      return String(doc.pdf_path || '').split('/').pop() || `Rechnung ${doc.rechnung_nr || doc.id}.pdf`;
    }
    return (def.spalten.name && doc[def.spalten.name]) || String(row.quelle_ref || '').split(/[?#]/)[0].split('/').pop() || 'dokument.pdf';
  }

  /** Neue Datei in die Zeile: Bestandszeile umstellen bzw. (rechnung_alt) rechnung_pdfs-Zeile anlegen. */
  async function dokumentSchreiben(row, doc, typ, werte) {
    const def = dokument.DOKUMENT[typ];
    if (row.typ === 'rechnung_alt') {
      const { error } = await supabase.from(def.tabelle).insert({
        ...werte, rechnung_id: doc.id, content_type: /\.pdf$/i.test(werte[def.spalten.name] || '') ? 'application/pdf' : null,
      });
      // Abgleich war schneller und hat die Zeile aus dem Upload-Kontext angelegt
      if (error && error.code !== '23505') throw error;
      return;
    }
    const { error } = await supabase.from(def.tabelle).update(werte).eq('id', doc.id);
    if (error) {
      if (error.code === '23505') throw new UmzugFehler('item_doppelt', { permanent: true });
      throw error;
    }
  }

  async function dokumentBearbeiten(row) {
    try {
      const doc = await dokumentLaden(row);
      if (!doc) return beenden(row, 'uebersprungen', 'dokument_geloescht');
      const typ = dokTyp(row.typ);
      const def = dokument.DOKUMENT[typ];
      if (row.typ !== 'rechnung_alt') {
        // inzwischen ersetzt oder vom Abgleich angehaengt
        const q = dokument.quelleVon(typ, doc);
        if (q?.quelle === 'sharepoint') return beenden(row, 'fertig', null, { item_id: q.item_id });
        if (!q) return beenden(row, 'uebersprungen', 'ohne_quelle');
      }
      if (row.upload_id) {
        const r = await verloren(row);
        if (r) return r;
      }

      const bezugId = row.typ === 'rechnung_alt' ? doc.id : dokument.bezugIdVon(typ, doc);
      const bezug = await dokument.ladeBezug(supabase, typ, bezugId);
      if (!bezug?.unternehmen) throw new UmzugFehler('ohne_unternehmen', { permanent: true });
      const dokumentTyp = doc.dokument_typ || null;
      const ziel = await ordner.dokumentKette(bezug.unternehmen, def.bereich, dokument.dokumentEbenen(typ, bezug, { dokumentTyp }));

      const inhalt = await dokumentBytes(row);
      if (!inhalt.length) throw new UmzugFehler('leer', { ueberspringen: true });
      if (inhalt.length > dokument.MAX_BYTES) throw new UmzugFehler('zu_gross', { permanent: true });
      const name = dateiname(dokumentName(row, doc, def));
      const { uploadUrl } = await sp.uploadSession(ziel.item_id, name, { conflict: 'rename', deferCommit: true });
      for (let von = 0; von < inhalt.length; von += chunkBytes) {
        await sp.chunkHochladen(uploadUrl, inhalt.subarray(von, Math.min(inhalt.length, von + chunkBytes)), von, inhalt.length);
      }

      // Vor dem Commit: stirbt der Laeufer danach, haengt der Abgleich die Datei an die Bestandszeile
      const kontext = {
        typ, bezug_id: bezugId, dokument_typ: dokumentTyp, ordner_pfad: ziel.pfad, umzug_typ: row.typ,
        ...(row.typ === 'rechnung_alt' ? { umzug_asset_id: row.asset_id } : { umzug_dokument_id: row.asset_id }),
      };
      const { data: up, error } = await supabase.from('ablage_upload').insert({
        drive_id: driveId, parent_item_id: ziel.item_id, name, groesse: inhalt.length, typ, kontext, erstellt_at: iso(),
      }).select('id').single();
      if (error) {
        await sp.sessionVerwerfen(uploadUrl).catch(() => {});
        throw error;
      }
      await setzen(row.id, { upload_id: up.id, ziel_parent_item_id: ziel.item_id, ziel_name: name, groesse: inhalt.length });

      const item = await sp.sessionAbschliessen(uploadUrl);
      if (!item?.id) throw new UmzugFehler('commit_ohne_item');
      if (item.size != null && Number(item.size) !== inhalt.length) {
        await sp.loeschen(item.id).catch(() => {});
        await supabase.from('ablage_upload').delete().eq('id', up.id);
        await setzen(row.id, { upload_id: null });
        throw new UmzugFehler('groesse_falsch');
      }
      await dokumentSchreiben(row, doc, typ, dokument.spaltenAusItem(typ, item, { driveId, pfad: `${ziel.pfad}/${item.name}` }));
      await supabase.from('ablage_upload').update({ item_id: item.id, abgeschlossen_at: iso() }).eq('id', up.id);
      await setzen(row.id, { status: 'fertig', grund: null, item_id: item.id, fertig_at: iso(), gesperrt_bis: null });
      return { status: 'fertig', bytes: inhalt.length };
    } catch (err) {
      return fehlerBuchen(row, err);
    }
  }

  // ─── Lauf ───

  async function beenden(row, status, grund, extra = {}) {
    await setzen(row.id, { status, grund, gesperrt_bis: null, ...(status === 'fertig' ? { fertig_at: iso() } : {}), ...extra });
    return { status, grund };
  }

  async function fehlerBuchen(row, err) {
    const grund = err instanceof UmzugFehler ? err.grund : String(err?.message || err).slice(0, 300);
    if (err?.ueberspringen) return beenden(row, 'uebersprungen', grund);
    const versuche = (row.versuche || 0) + 1;
    const endgueltig = !!err?.permanent || versuche >= MAX_VERSUCHE;
    await setzen(row.id, {
      versuche,
      grund,
      gesperrt_bis: null,
      ...(endgueltig ? { status: 'fehler' } : { naechster_versuch: iso(jetzt() + Math.min(3600, 60 * 2 ** versuche) * 1000) }),
    });
    if (!(err instanceof UmzugFehler)) console.warn('[ablage-umzug]', row.typ, row.asset_id, grund);
    return { status: endgueltig ? 'fehler' : 'offen', grund };
  }

  async function eintragBearbeiten(row, { bis = jetzt() + BUDGET_MS } = {}) {
    try {
      const asset = await assetLaden(row.typ, row.asset_id);
      if (!asset) return beenden(row, 'uebersprungen', 'asset_geloescht');
      // inzwischen ersetzt (Upload nach dem Stichtag) oder vom Abgleich angehaengt
      if (asset.ablage === 'sharepoint' && asset.item_id) return beenden(row, 'fertig', null, { item_id: asset.item_id });

      const ctx = await kontextVon(row.typ, asset);
      const { ordner: ziel } = await ordner.zielOrdner(ctx);
      let r = row;
      if (r.upload_url && r.ziel_parent_item_id && r.ziel_parent_item_id !== ziel.item_id) {
        // Video inzwischen umgehaengt: Session verwerfen, neu ins richtige Ziel
        await sp.sessionVerwerfen(r.upload_url).catch(() => {});
        await setzen(r.id, { upload_url: null, versatz: 0, ziel_parent_item_id: null, ziel_name: null });
        r = { ...r, upload_url: null, versatz: 0, ziel_parent_item_id: null, ziel_name: null };
      }
      return r.quelle === 'onedrive'
        ? await onedriveUmziehen(r, asset, ctx, ziel, { bis })
        : await dropboxUmziehen(r, asset, ctx, ziel, { bis });
    } catch (err) {
      return fehlerBuchen(row, err);
    }
  }

  async function holen(rpc) {
    const { data, error } = await supabase.rpc(rpc, { p_drive_id: driveId, p_sekunden: CLAIM_SEK });
    if (error) throw new Error(`${rpc}: ${error.message}`);
    return (Array.isArray(data) ? data[0] : data) || null;
  }

  // Medien-Notschalter und ABLAGE_ZIEL=dropbox halten alles an, der Dokument-Notschalter nur Dokumente
  async function lauf({ budgetMs = BUDGET_MS } = {}) {
    if (process.env.ABLAGE_ZIEL === 'dropbox' || await notschalterAn(supabase)) return { pausiert: true };
    const dokumentePausiert = await dokumenteNotschalterAn(supabase);
    await ordner.wurzel();
    const bis = jetzt() + budgetMs;
    const r = { fertig: 0, offen: 0, fehler: 0, uebersprungen: 0, bytes: 0 };
    while (jetzt() < bis) {
      let row = await holen('ablage_umzug_holen');
      let istDok = false;
      if (!row && !dokumentePausiert) {
        row = await holen('ablage_dokument_umzug_holen');
        istDok = !!row;
      }
      if (!row) {
        r.leer = true;
        break;
      }
      const e = istDok ? await dokumentBearbeiten(row) : await eintragBearbeiten(row, { bis });
      r[e.status] = (r[e.status] || 0) + 1;
      r.bytes += e.bytes || 0;
    }
    if (dokumentePausiert) r.dokumente_pausiert = true;
    return r;
  }

  return { lauf, anlegen, dokumenteAnlegen, uebersicht, laeuferBedarf, eintragBearbeiten, dokumentBearbeiten };
}

module.exports = { createUmzug, UmzugFehler, CHUNK, PARALLEL };
