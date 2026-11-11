// _shared/ablage/umsortieren.js
// Struktur-Umzug innerhalb von SharePoint (ADR 0065): Bestand aus Storys/, Bilder/ und den
// Varianten-Ordnern (A/B/C) in die Runden unter Videos/Video_N. Graph-Move: die item_id bleibt,
// Kommentare, Tags und Promote-Finale haengen weiter an der Datei. Das Ziel kommt aus den
// Fachspalten der Zeile (zielOrdner), wie bei Upload und Dropbox-Umzug.
// Danach die leeren alten Ordner weg, tiefste zuerst: erst Register (geloescht_at), dann
// SharePoint. Andersherum haelt der Abgleich die Loeschung fuer eine Kaskade auf die Assets.
// Wiederholbar: jeder Lauf plant neu aus Register und Eingang.

const { TABELLE, aktuellSetzen, umstellen } = require('./asset');
const { linksWiderrufen } = require('./freigabe');
const { systemdatei } = require('./pfad');
const { notschalterAn } = require('./ziel');
const { istNichtGefunden } = require('./graph');
const { SEITE, stuecke } = require('./liste');

const BUDGET_MS = 12 * 60 * 1000;
const TYPEN = ['video', 'story', 'still'];
const ALTE_TYPEN = ['storys', 'bilder'];
const LISTE_MAX = 50;
const SHAREPOINT_URL = /sharepoint\.com/i;

/**
 * @param {object} deps
 * @param {object} deps.supabase Service-Client
 * @param {object} deps.ablage ablageAusEnv() ({ sp, ordner })
 */
function createUmsortieren({ supabase, ablage, jetzt = () => Date.now() }) {
  const { sp, ordner } = ablage;
  const driveId = sp.driveId;
  const iso = (ms = jetzt()) => new Date(ms).toISOString();

  async function seiten(abfrage, schluessel = 'id') {
    const out = [];
    for (let von = 0; ; von += SEITE) {
      const { data, error } = await abfrage().order(schluessel, { ascending: true }).range(von, von + SEITE - 1);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < SEITE) break;
    }
    return out;
  }

  async function registerSetzen(id, patch) {
    const { error } = await supabase.from('ablage_ordner').update({ ...patch, updated_at: iso() }).eq('id', id);
    if (error) throw error;
  }

  /** Alte Ordner eines Unternehmens: alles unter Storys/ und Bilder/, Varianten-Ordner unter Videos/. */
  async function alteOrdner(unternehmenId) {
    const basis = () => supabase.from('ablage_ordner').select('*')
      .eq('drive_id', driveId).eq('unternehmen_id', unternehmenId).is('geloescht_at', null).not('item_id', 'is', null);
    const [typen, varianten] = await Promise.all([
      seiten(() => basis().in('typ', ALTE_TYPEN)),
      seiten(() => basis().eq('art', 'variante')),
    ]);
    return [...new Map([...typen, ...varianten].map((o) => [o.id, o])).values()];
  }

  /** Trockenlauf: was liegt in alten Ordnern und wird verschoben, was bleibt liegen. */
  async function planen(unternehmenId) {
    const alt = await alteOrdner(unternehmenId);
    const nachItem = new Map(alt.map((o) => [o.item_id, o]));

    const dateien = [];
    for (const teil of stuecke([...nachItem.keys()])) {
      dateien.push(...await seiten(() => supabase.from('ablage_eingang').select('item_id, parent_item_id, name, pfad')
        .eq('drive_id', driveId).in('parent_item_id', teil).eq('ist_ordner', false).eq('geloescht', false), 'item_id'));
    }
    const echte = new Map(dateien.filter((d) => !systemdatei(d.name)).map((d) => [d.item_id, d]));

    const assets = [];
    for (const typ of TYPEN) {
      for (const teil of stuecke([...echte.keys()])) {
        const { data, error } = await supabase.from(TABELLE[typ]).select('*')
          .eq('drive_id', driveId).in('item_id', teil).is('source_asset_id', null);
        if (error) throw error;
        for (const row of data || []) {
          const d = echte.get(row.item_id);
          if (!d || d.erfasst) continue;
          d.erfasst = true;
          assets.push({ typ, row, eltern: nachItem.get(d.parent_item_id) || null });
        }
      }
    }
    const rest = [...echte.values()].filter((d) => !d.erfasst);
    const anzahl = (typ) => assets.filter((a) => a.typ === typ).length;

    return {
      assets,
      ordner: alt,
      zaehler: {
        dateien: assets.length, videos: anzahl('video'), storys: anzahl('story'), bilder: anzahl('still'),
        ordner: alt.length, rest: rest.length,
      },
      rest: rest.slice(0, LISTE_MAX).map(({ name, pfad }) => ({ name, pfad })),
    };
  }

  function kontext(typ, row, eltern) {
    const ctx = {
      typ,
      kooperation_id: row.kooperation_id || eltern?.kooperation_id || null,
      // Bild ohne Video im Ordner eines Videos: gehoert zu diesem Video
      kooperation_video_id: row.video_id || (typ === 'still' ? eltern?.kooperation_video_id : null) || null,
      story_id: row.story_id || null,
      version_number: row.version_number || 1,
      is_final: !!row.is_final,
      variant_name: row.variant_name || null,
    };
    if (!ctx.kooperation_id) throw new Error('Zeile ohne Kooperation');
    return ctx;
  }

  async function dateiUmziehen({ typ, row, eltern }, storyLinks) {
    const ctx = kontext(typ, row, eltern);
    const { ordner: ziel, link, kooperation_video_id: videoId } = await ordner.zielOrdner(ctx);
    let neu;
    try {
      neu = await sp.verschieben(row.item_id, ziel.item_id, { conflict: 'rename' });
    } catch (err) {
      if (istNichtGefunden(err)) return 'fehlt';
      throw err;
    }
    const name = neu?.name || row.file_name;
    const pfad = `${ziel.pfad}/${name}`;
    const neuesVideo = typ === 'still' && !row.video_id ? ctx.kooperation_video_id || videoId || null : null;
    const patch = {
      file_path: pfad,
      file_name: name,
      etag: neu?.eTag || row.etag || null,
      ctag: neu?.cTag || row.ctag || null,
      file_url: neu?.webUrl || row.file_url || null,
      ...(neuesVideo ? { video_id: neuesVideo } : {}),
    };
    const data = await umstellen(supabase, typ, row, patch);
    if (neuesVideo) await aktuellSetzen(supabase, typ, data);
    // Eingang sofort nachziehen: ablage_nachfahren liest ihn, bevor der Delta-Feed die Bewegung meldet
    const { error } = await supabase.from('ablage_eingang').update({ parent_item_id: ziel.item_id, name, pfad })
      .eq('drive_id', driveId).eq('item_id', row.item_id);
    if (error) throw error;
    if (typ === 'story' && videoId && link) storyLinks.set(videoId, link);
    return 'verschoben';
  }

  /** story_folder_url (Merker "hat Storys") auf Videos/Video_N; Dropbox-Links bleiben. */
  async function storyLinksSetzen(storyLinks) {
    for (const [videoId, link] of storyLinks) {
      const { data: v, error } = await supabase.from('kooperation_videos').select('id, story_folder_url').eq('id', videoId).maybeSingle();
      if (error) throw error;
      if (!v || (v.story_folder_url && !SHAREPOINT_URL.test(v.story_folder_url))) continue;
      const url = (await sp.item(link.item_id, 'id,webUrl'))?.webUrl;
      if (url && url !== v.story_folder_url) await supabase.from('kooperation_videos').update({ story_folder_url: url }).eq('id', videoId);
    }
  }

  /** Den Bilder-Ordner gibt es nicht mehr: SharePoint-Link der Kooperation leeren, Dropbox bleibt. */
  async function bilderLinksLeeren(koopIds) {
    for (const teil of stuecke(koopIds)) {
      const { data, error } = await supabase.from('kooperationen').select('id, bilder_folder_url').in('id', teil);
      if (error) throw error;
      const ids = (data || []).filter((k) => SHAREPOINT_URL.test(k.bilder_folder_url || '')).map((k) => k.id);
      if (ids.length) await supabase.from('kooperationen').update({ bilder_folder_url: null }).in('id', ids);
    }
  }

  /** Leere alte Ordner loeschen, tiefste zuerst. Ordner mit Restdateien bleiben stehen. */
  async function aufraeumen(unternehmenId, { bis } = {}) {
    const tiefe = (o) => String(o.pfad || '').split('/').length;
    const reihe = (await alteOrdner(unternehmenId)).sort((a, b) => tiefe(b) - tiefe(a));
    const r = { geloescht: 0, bleibt: 0, links: 0 };
    const bilderKoops = new Set();
    for (const o of reihe) {
      if (bis && jetzt() >= bis) {
        r.unvollstaendig = true;
        break;
      }
      const kinder = await sp.kinder(o.item_id);
      if (kinder.some((k) => !systemdatei(k.name))) {
        r.bleibt++;
        continue;
      }
      const { data: links, error } = await supabase.from('ablage_freigabelink').select('id, drive_id, item_id, permission_id')
        .eq('drive_id', driveId).eq('item_id', o.item_id).is('widerrufen_at', null);
      if (error) throw error;
      if (links?.length) r.links += await linksWiderrufen({ supabase, sp, jetzt }, links, 'umsortiert');
      await registerSetzen(o.id, { geloescht_at: iso() });
      try {
        await sp.loeschen(o.item_id);
      } catch (err) {
        await registerSetzen(o.id, { geloescht_at: null });
        throw err;
      }
      r.geloescht++;
      if (o.art === 'typ' && o.typ === 'bilder' && o.kooperation_id) bilderKoops.add(o.kooperation_id);
    }
    await bilderLinksLeeren([...bilderKoops]);
    return r;
  }

  async function lauf({ unternehmenId, budgetMs = BUDGET_MS } = {}) {
    if (process.env.ABLAGE_ZIEL === 'dropbox' || await notschalterAn(supabase)) return { pausiert: true };
    await ordner.wurzel();
    const bis = jetzt() + budgetMs;
    const plan = await planen(unternehmenId);
    const r = { geplant: plan.zaehler.dateien, verschoben: 0, fehlt: 0, fehler: [] };
    const storyLinks = new Map();
    for (const a of plan.assets) {
      if (jetzt() >= bis) {
        r.unvollstaendig = true;
        break;
      }
      try {
        r[await dateiUmziehen(a, storyLinks)]++;
      } catch (err) {
        if (r.fehler.length < LISTE_MAX) r.fehler.push(`${a.row.file_path || a.row.item_id}: ${err.message}`);
      }
    }
    await storyLinksSetzen(storyLinks);
    if (!r.unvollstaendig) {
      r.aufgeraeumt = await aufraeumen(unternehmenId, { bis });
      if (r.aufgeraeumt.unvollstaendig) r.unvollstaendig = true;
    }
    return r;
  }

  return { planen, lauf, aufraeumen };
}

module.exports = { createUmsortieren };
