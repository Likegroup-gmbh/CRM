// _shared/ablage/abgleich-datei.js
// Abgleich: eine Datei aus dem Eingang einordnen und ausfuehren (Asset schreiben, in
// Format-Ordner verschieben, Umzug anhaengen, Fachdatei zurueck). `c` ist der
// Kontext aus createAbgleich.

const { TABELLE, TYPEN, dateiSpalten, fachSpalten, findeUeberall, upsert, entfernenNachItem, umstellen } = require('./asset');
const { dateiEinordnen, ortVon, ELTERN_VERSUCHE } = require('./klassifizierung');
const { konfliktNamePasst } = require('./pfad');
const { spiegelImAbgleich, spiegelGeloescht } = require('./final-spiegel');
const dokument = require('./dokument');

const DATEI_FELDER = 'id,name,size,eTag,cTag,webUrl,parentReference,file,folder,video,image,deleted,createdDateTime';

/** Anzeigetitel aus dem Dateinamen (ohne Endung, gekürzt). */
const titelAusDateiname = (name) => String(name || '').replace(/\.[a-z0-9]{2,5}$/i, '').trim().slice(0, 120) || null;

const escLike = (s) => s.replace(/[%_\\]/g, '\\$&');

function createDateiAbgleich(c) {
  const { supabase, sp, ordner, driveId, jetzt, iso } = c;
  const benutzerCache = new Map();

  async function dateiBearbeiten(e) {
    // Spiegel-Kopien der Finalen Version (ADR 0073) sind keine Fachdateien
    const spiegel = await spiegelImAbgleich({ supabase, sp, driveId }, e);
    if (spiegel) return spiegel;
    const asset = await findeUeberall(supabase, driveId, e.item_id);
    const dok = asset ? null : await dokument.findeNachItem(supabase, driveId, e.item_id);
    const item = e.geloescht ? null : await sp.item(e.item_id, DATEI_FELDER);
    if (!item || item.deleted) {
      if (!asset && !dok) return { aktion: 'ignorieren', grund: 'geloescht' };
      // Nur Admins koennen Fachdateien loeschen (Web): Asset ausblenden, Dokument austragen
      return { aktion: 'entfernt', grund: 'geloescht', zeilen: await allesEntfernen(e.item_id) };
    }
    if (!item.file) return { aktion: 'ignorieren', grund: 'keine_datei' };

    const parentId = item.parentReference?.id || e.parent_item_id;
    const [eltern, wurzel, upload] = await Promise.all([
      ordner.nachItem(parentId),
      ordner.wurzel(),
      asset || dok ? null : uploadZu(item, parentId),
    ]);
    const elternOffen = !eltern && parentId ? await c.eingangOffen(parentId) : false;
    const pfad = c.pfadUnter(eltern, parentId, wurzel, item.name);
    if (pfad && pfad !== e.pfad) {
      await supabase.from('ablage_eingang').update({ pfad }).eq('drive_id', driveId).eq('item_id', e.item_id);
    }

    if (dok) return dokumentAbgleichen(dok, { e, item, eltern, elternOffen, elternIstWurzel: parentId === wurzel.item_id, pfad });

    const d = dateiEinordnen({
      item: { name: item.name, breite: item.video?.width ?? item.image?.width ?? null, hoehe: item.video?.height ?? item.image?.height ?? null },
      eltern,
      elternIstWurzel: parentId === wurzel.item_id,
      elternOffen,
      asset,
      upload,
      versuche: e.versuche || 1,
      jetztMs: jetzt(),
    });
    return dateiAusfuehren(d, { e, item, eltern, asset, pfad });
  }

  /** Upload aus dem CRM zu dieser Datei (per item_id oder Name/Konflikt-Name + Groesse im Zielordner). */
  async function uploadZu(item, parentId) {
    const { data: perItem } = await supabase.from('ablage_upload').select('*')
      .eq('drive_id', driveId).eq('item_id', item.id).order('erstellt_at', { ascending: false }).limit(1);
    if (perItem?.[0]) return perItem[0];
    const { data } = await supabase.from('ablage_upload').select('*')
      .eq('drive_id', driveId).eq('parent_item_id', parentId).is('item_id', null);
    return (data || []).filter((up) => konfliktNamePasst(up.name, up.groesse, item))
      .sort((a, b) => String(b.erstellt_at).localeCompare(String(a.erstellt_at)))[0] || null;
  }

  async function dateiAusfuehren(d, { e, item, eltern, asset, pfad }) {
    switch (d.aktion) {
      case 'asset':
        return assetSchreiben(d, { e, item, pfad, asset });

      case 'format': {
        const f = await ordner.formatOrdner(eltern, d.format);
        const neu = await sp.verschieben(item.id, f.item_id, { conflict: 'rename' });
        const it = { ...item, ...neu };
        return assetSchreiben(d, { e, item: it, pfad: `${f.pfad}/${it.name}`, asset });
      }

      case 'umzug':
        return umzugAnhaengen(d, { item, pfad });

      case 'dokument_upload':
        return dokumentAusUpload(d, { item, pfad });

      case 'zurueck': {
        const ctx = await kontext(d.typ, d.ziel);
        const { ordner: ziel } = await ordner.zielOrdner(ctx);
        const neu = await sp.verschieben(item.id, ziel.item_id, { conflict: 'rename' });
        const it = { ...item, ...neu };
        const r = await assetSchreiben({ ...d, aktion: 'asset' }, { e, item: it, pfad: `${ziel.pfad}/${it.name}`, asset });
        return { ...r, aktion: 'zurueck', grund: 'fachdatei_verschoben' };
      }

      default:
        return d;
    }
  }

  async function assetSchreiben(d, { e, item, pfad, asset }) {
    const ctx = await kontext(d.typ, d.ziel);
    if (d.umziehen && asset && asset.typ !== d.typ) await entfernenNachItem(supabase, asset.typ, driveId, item.id);
    // Neue Video-/Bild-Zeile aus dem Finder: der Dateiname (ohne Endung) wird der Titel, damit
    // niemand "Video C" lesen muss. Bestehende Zeilen behalten ihren (evtl. umbenannten) Titel.
    const neueZeile = !asset || asset.typ !== d.typ;
    const titel = neueZeile && (d.typ === 'video' || d.typ === 'still') ? titelAusDateiname(item.name) : null;
    const werte = {
      ...dateiSpalten(item, { driveId, pfad: pfad ?? asset?.row?.file_path ?? null }),
      ...fachSpalten(d.typ, ctx),
      ...(titel ? { titel } : {}),
    };
    const { row, neu } = await upsert(supabase, d.typ, werte, { uploadedBy: await benutzerZu(e.geaendert_von), jetzt: iso() });
    return { aktion: d.aktion, typ: d.typ, asset_id: row.id, neu, pfad, ...(d.quelle ? { quelle: d.quelle } : {}) };
  }

  /** Datei aus dem Umzug, dessen Laeufer vor dem Umstellen der Zeile abbrach. */
  async function umzugAnhaengen(d, { item, pfad }) {
    const { data: row, error } = await supabase.from(TABELLE[d.typ]).select('*').eq('id', d.asset_id).maybeSingle();
    if (error) throw error;
    if (!row) return { aktion: 'unzugeordnet', grund: 'umzug_ohne_asset' };
    if (row.ablage === 'sharepoint' && row.item_id && row.item_id !== item.id) return { aktion: 'unzugeordnet', grund: 'umzug_doppelt' };
    await umstellen(supabase, d.typ, row, dateiSpalten(item, { driveId, pfad }));
    const t = iso();
    if (d.upload_id) await supabase.from('ablage_upload').update({ item_id: item.id, abgeschlossen_at: t }).eq('id', d.upload_id);
    await supabase.from('ablage_umzug')
      .update({ status: 'fertig', grund: 'abgleich', item_id: item.id, fertig_at: t, upload_url: null, kopie_url: null, gesperrt_bis: null })
      .eq('typ', d.typ).eq('asset_id', row.id).neq('status', 'fertig');
    return { aktion: 'asset', typ: d.typ, asset_id: row.id, neu: false, pfad, quelle: 'umzug' };
  }

  /** Ziel aus Register/Upload -> Kontext fuer fachSpalten/zielOrdner (Story-Slot, Kooperation). */
  async function kontext(typ, ziel) {
    const ctx = {
      typ,
      kooperation_id: ziel.kooperation_id || null,
      kooperation_video_id: ziel.kooperation_video_id || null,
      story_id: ziel.story_id || null,
      version_number: Number(ziel.version_number) || 1,
      is_final: !!ziel.is_final,
      variant_name: ziel.variant_name ?? null,
    };
    if (typ === 'story' && !ctx.story_id) ctx.story_id = (await storySlot(ctx.kooperation_video_id, ziel.story_nummer)).id;
    if (!ctx.kooperation_id && ctx.kooperation_video_id) {
      const { data } = await supabase.from('kooperation_videos').select('kooperation_id').eq('id', ctx.kooperation_video_id).maybeSingle();
      ctx.kooperation_id = data?.kooperation_id || null;
    }
    return ctx;
  }

  /** Story-Slot zu Video + Nummer; fehlt er (Story_4 im Finder angelegt), legt das CRM ihn an. */
  async function storySlot(videoId, nummer) {
    const n = Number(nummer) || 1;
    const finden = async () => {
      const { data, error } = await supabase.from('kooperation_story').select('id, video_id, slot_index')
        .eq('video_id', videoId).eq('slot_index', n).order('created_at', { ascending: true }).limit(1);
      if (error) throw error;
      return data?.[0] || null;
    };
    const da = await finden();
    if (da) return da;
    const { data, error } = await supabase.from('kooperation_story')
      .insert({ video_id: videoId, slot_index: n, slot_name: `Story ${n}` }).select('id, video_id, slot_index').single();
    if (!error) return data;
    const parallel = await finden();
    if (parallel) return parallel;
    throw error;
  }

  async function allesEntfernen(itemId) {
    let n = 0;
    for (const typ of TYPEN) n += await entfernenNachItem(supabase, typ, driveId, itemId);
    n += await dokument.entfernenNachItem(supabase, driveId, itemId);
    // Ordner geloescht (Kaskade): Spiegel-Kopien darin sind mit weg
    await spiegelGeloescht(supabase, driveId, itemId);
    return n;
  }

  // ─── Dokumente (ADR 0068) ───

  async function dokumentSpaltenSetzen(typ, id, item, pfad) {
    const { error } = await supabase.from(dokument.DOKUMENT[typ].tabelle)
      .update(dokument.spaltenAusItem(typ, item, { driveId, pfad })).eq('id', id);
    if (error) throw error;
  }

  async function dokumentOrdner(typ, bezugId, dokumentTyp) {
    const bezug = await dokument.ladeBezug(supabase, typ, bezugId);
    if (!bezug?.unternehmen) return null;
    return ordner.dokumentKette(bezug.unternehmen, dokument.DOKUMENT[typ].bereich, dokument.dokumentEbenen(typ, bezug, { dokumentTyp }));
  }

  /**
   * Bekanntes Dokument: innerhalb der Dokument-Bereiche fuehrt SharePoint Ort und Namen (Pfad,
   * webUrl, Name nachziehen); ausserhalb (Medien, Wurzel) zurueck in seinen Ordner.
   */
  async function dokumentAbgleichen(dok, { e, item, eltern, elternOffen, elternIstWurzel, pfad }) {
    const { typ, row } = dok;
    const imBereich = eltern && !eltern.geloescht_at && ortVon(eltern).art === 'dokument';
    if (imBereich) {
      await dokumentSpaltenSetzen(typ, row.id, item, pfad);
      return { aktion: 'dokument', typ, id: row.id, pfad };
    }
    if (!eltern && !elternIstWurzel && (elternOffen || (e.versuche || 1) < ELTERN_VERSUCHE)) {
      return { aktion: 'warten', sek: 30, grund: 'eltern_unbekannt' };
    }
    const ziel = await dokumentOrdner(typ, dokument.bezugIdVon(typ, row), row.dokument_typ);
    if (!ziel) {
      await dokumentSpaltenSetzen(typ, row.id, item, pfad);
      return { aktion: 'dokument', typ, id: row.id, pfad, grund: 'ohne_unternehmen' };
    }
    const neu = { ...item, ...(await sp.verschieben(item.id, ziel.item_id, { conflict: 'rename' })) };
    const zielPfad = `${ziel.pfad}/${neu.name}`;
    await dokumentSpaltenSetzen(typ, row.id, neu, zielPfad);
    return { aktion: 'zurueck', typ, id: row.id, pfad: zielPfad, grund: 'dokument_verschoben' };
  }

  /** Dokument-Upload, dessen Zeile der Client nie geschrieben hat (Tab zu nach dem Commit). */
  async function dokumentAusUpload(d, { item, pfad }) {
    const { data: up, error } = await supabase.from('ablage_upload').select('*').eq('id', d.upload_id).maybeSingle();
    if (error) throw error;
    const k = up?.kontext || {};
    const def = dokument.DOKUMENT[d.typ];
    if (!up || !def || !k.bezug_id) return { aktion: 'unzugeordnet', grund: 'dokument_ohne_bezug' };
    const werte = dokument.spaltenAusItem(d.typ, item, { driveId, pfad });
    if (!up.item_id) await supabase.from('ablage_upload').update({ item_id: item.id, abgeschlossen_at: iso() }).eq('id', up.id);

    // Umzug: die Bestandszeile bekommt die Datei, nie eine zweite Zeile
    if (k.umzug_dokument_id) {
      const { data: alt, error: aErr } = await supabase.from(def.tabelle).update(werte).eq('id', k.umzug_dokument_id).select('id');
      if (aErr) throw aErr;
      if (!alt?.length) return { aktion: 'unzugeordnet', grund: 'umzug_ohne_dokument' };
      await supabase.from('ablage_umzug')
        .update({ status: 'fertig', grund: 'abgleich', item_id: item.id, fertig_at: iso(), gesperrt_bis: null })
        .eq('typ', k.umzug_typ || d.typ).eq('asset_id', k.umzug_dokument_id).neq('status', 'fertig');
      return { aktion: 'dokument', typ: d.typ, id: k.umzug_dokument_id, pfad, quelle: 'umzug' };
    }

    if (def.art === 'feld') {
      const { data: v, error: vErr } = await supabase.from(def.tabelle).select(dokument.spaltenSelect(d.typ)).eq('id', k.bezug_id).maybeSingle();
      if (vErr) throw vErr;
      if (!v) return { aktion: 'unzugeordnet', grund: 'dokument_ohne_bezug' };
      // Ein neuerer Upload hat den Platz schon belegt
      if (v[def.spalten.ablage] === 'sharepoint' && v[def.spalten.item] && v[def.spalten.item] !== item.id) {
        return { aktion: 'unzugeordnet', grund: 'dokument_ersetzt' };
      }
      const { error: uErr } = await supabase.from(def.tabelle).update(werte).eq('id', k.bezug_id);
      if (uErr) throw uErr;
      return { aktion: 'dokument', typ: d.typ, id: k.bezug_id, pfad, quelle: 'upload' };
    }

    const zeile = { ...werte, [def.bezugSpalte]: k.bezug_id };
    if (d.typ === 'auftragsdokument') zeile.dokument_typ = k.dokument_typ || 'auftragsbestaetigung';
    // rechnung_pdfs.uploaded_by zeigt auf auth.users, die anderen auf benutzer
    if (up.erstellt_von && d.typ !== 'rechnung') zeile.uploaded_by = up.erstellt_von;
    if (d.typ === 'beleg') zeile.uploaded_at = iso();
    const { data: neu, error: iErr } = await supabase.from(def.tabelle).insert(zeile).select('id').single();
    if (iErr) {
      if (iErr.code === '23505') return { aktion: 'dokument', typ: d.typ, grund: 'parallel_angelegt' };
      throw iErr;
    }
    // rechnung.pdf_url ohne rechnung_pdfs-Zeile: der Umzug legt sie an
    if (k.umzug_typ && k.umzug_asset_id) {
      await supabase.from('ablage_umzug')
        .update({ status: 'fertig', grund: 'abgleich', item_id: item.id, fertig_at: iso(), gesperrt_bis: null })
        .eq('typ', k.umzug_typ).eq('asset_id', k.umzug_asset_id).neq('status', 'fertig');
    }
    return { aktion: 'dokument', typ: d.typ, id: neu.id, pfad, quelle: k.umzug_typ ? 'umzug' : 'upload' };
  }

  /** lastModifiedBy (E-Mail/UPN) -> benutzer.id, zuerst ueber das Override-Feld. */
  async function benutzerZu(konto) {
    const m = String(konto || '').trim().toLowerCase();
    if (!m.includes('@')) return null;
    if (benutzerCache.has(m)) return benutzerCache.get(m);
    let id = null;
    for (const spalte of ['microsoft_konto', 'email']) {
      const { data } = await supabase.from('benutzer').select('id').ilike(spalte, escLike(m)).limit(1);
      if (data?.[0]) {
        id = data[0].id;
        break;
      }
    }
    benutzerCache.set(m, id);
    return id;
  }

  return { dateiBearbeiten, storySlot, allesEntfernen };
}

module.exports = { createDateiAbgleich };
