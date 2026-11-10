// _shared/ablage/ordner.js
// Ordner-Register (ablage_ordner) + Anlage in SharePoint.
// Ablauf je Fachordner: Register nach Besitzer fragen -> Namen reservieren (Unique-Index,
// bei Kollision "Name (2)") -> Ordner anlegen bzw. gleichnamigen unregistrierten Ordner
// uebernehmen -> item_id eintragen. Fachordner-Namen fuehrt das CRM.

const { NAMEN, TEST_ORDNER, mitZaehler, formatOrdner } = require('./pfad');
const { ladeKooperation } = require('./ziel');

const RESERVIERUNG_ALT_MS = 2 * 60 * 1000;
const MAX_ZAEHLER = 20;
const SCHLEIFEN = [1, 2, 3];
const BEWEGLICH = new Set(['unternehmen', 'marke', 'kampagne', 'kooperation']);

const istUniqueVerletzung = (err) => err?.code === '23505';
const istNamensKonflikt = (err) => istUniqueVerletzung(err) && /ux_ablage_ordner_name/.test(`${err.message} ${err.details || ''}`);

/**
 * @param {object} deps
 * @param {object} deps.supabase Service-Client
 * @param {object} deps.sp createSharePoint()
 */
function createOrdner({ supabase, sp, driveId = sp.driveId, schlafen = (ms) => new Promise((r) => setTimeout(r, ms)), jetzt = () => Date.now() }) {
  let _wurzel = null;
  const db = () => supabase.from('ablage_ordner');

  async function wurzel() {
    if (_wurzel) return _wurzel;
    const { data: stand } = await supabase.from('ablage_stand').select('root_item_id').eq('drive_id', driveId).maybeSingle();
    if (stand?.root_item_id) {
      _wurzel = { item_id: stand.root_item_id, pfad: '' };
      return _wurzel;
    }
    const root = await sp.wurzel();
    await supabase.from('ablage_stand').upsert({ drive_id: driveId, site_id: sp.siteId || null, root_item_id: root.id, updated_at: new Date().toISOString() }, { onConflict: 'drive_id' });
    _wurzel = { item_id: root.id, pfad: '' };
    return _wurzel;
  }

  /** Register-Zeile nach fachlichem Schluessel (ohne geloeschte). */
  async function finden(schluessel) {
    let q = db().select('*').eq('drive_id', driveId).is('geloescht_at', null);
    for (const [k, v] of Object.entries(schluessel)) q = v === null ? q.is(k, null) : q.eq(k, v);
    const { data, error } = await q.order('created_at', { ascending: true }).limit(1);
    if (error) throw error;
    return data?.[0] || null;
  }

  async function nachItem(itemId) {
    if (!itemId) return null;
    const { data, error } = await db().select('*').eq('drive_id', driveId).eq('item_id', itemId).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function reservieren(zeile) {
    for (let n = 1; n <= MAX_ZAEHLER; n++) {
      const name = mitZaehler(zeile.name, n);
      const { data, error } = await db().insert({ ...zeile, name, drive_id: driveId, item_id: null }).select('*').single();
      if (!error) return data;
      if (istNamensKonflikt(error)) continue;
      if (istUniqueVerletzung(error)) return null; // gleicher Besitzer parallel reserviert
      throw error;
    }
    throw new Error(`Kein freier Ordnername fuer "${zeile.name}"`);
  }

  async function freigeben(reservierung) {
    await db().delete().eq('id', reservierung.id).is('item_id', null);
  }

  async function itemEintragen(reservierung, item, pfad) {
    const { data, error } = await db()
      .update({ item_id: item.id, name: item.name, pfad, updated_at: new Date().toISOString() })
      .eq('id', reservierung.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  /** Reservierung -> SharePoint-Ordner. Uebernimmt einen gleichnamigen, nicht als Fachordner registrierten Ordner. */
  async function anlegen(reservierung, eltern) {
    let res = reservierung;
    for (let versuch = 0; versuch < MAX_ZAEHLER; versuch++) {
      const { item, konflikt } = await sp.ordnerAnlegen(eltern.item_id, res.name);
      if (!item) throw new Error(`Ordner "${res.name}" weder angelegt noch gefunden`);
      const pfad = `${eltern.pfad || ''}/${item.name}`;
      if (!konflikt) return itemEintragen(res, item, pfad);

      const vorhanden = await nachItem(item.id);
      if (!vorhanden) return itemEintragen(res, item, pfad);
      if (vorhanden.art === 'frei' || vorhanden.geloescht_at) {
        // Im Finder vorab angelegt: Fachordner uebernimmt die item_id
        const felder = { ...res };
        delete felder.id; delete felder.created_at;
        await freigeben(res);
        const { data, error } = await db()
          .update({ ...felder, item_id: item.id, name: item.name, pfad, geloescht_at: null, updated_at: new Date().toISOString() })
          .eq('id', vorhanden.id)
          .select('*')
          .single();
        if (error) throw error;
        return data;
      }
      // Name gehoert schon einem anderen Fachordner (Register war nicht aktuell): naechster Zaehler
      await freigeben(res);
      const basis = res.name.replace(/ \(\d+\)$/, '');
      const neu = await reservieren({ ...stripZeile(res), name: mitZaehler(basis, versuch + 2) });
      if (!neu) throw new Error(`Ordner fuer ${res.art} wird parallel angelegt`);
      res = neu;
    }
    throw new Error(`Ordner "${reservierung.name}" konnte nicht angelegt werden`);
  }

  function stripZeile(z) {
    const { id, item_id, created_at, updated_at, pfad, ...rest } = z;
    return rest;
  }

  /**
   * Stellt einen Fachordner sicher.
   * @param {object} eltern Register-Zeile oder Wurzel ({ item_id, pfad })
   * @param {object} schluessel fachlicher Schluessel (art + Besitzer), wird mit gespeichert
   * @param {string} name gewuenschter Name (ohne Zaehler)
   * @param {object} [extra] weitere Spalten (z. B. unternehmen_id auf Kindordnern)
   */
  async function sicherstellen(eltern, schluessel, name, extra = {}) {
    const voll = { parent_item_id: eltern.item_id, ...schluessel };
    // Fach-Objekte haben genau einen Ordner: bei neuem Elternteil (z. B. Kampagne an andere Marke) verschieben
    const beweglich = BEWEGLICH.has(schluessel.art);
    for (let warte = 0; warte < 6; warte++) {
      const row = await finden(beweglich ? schluessel : voll);
      if (row?.item_id && beweglich && row.parent_item_id !== eltern.item_id) return umhaengen(row, eltern);
      if (row?.item_id) return row;
      if (row && jetzt() - new Date(row.created_at).getTime() < RESERVIERUNG_ALT_MS) {
        await schlafen(500 * (warte + 1));
        continue;
      }
      if (row) {
        // verwaiste Reservierung (Lauf abgebrochen): uebernehmen
        try {
          return await anlegen(row, eltern);
        } catch (err) {
          await freigeben(row).catch(() => {});
          throw err;
        }
      }
      const res = await reservieren({ ...voll, ...extra, name });
      if (!res) continue;
      try {
        return await anlegen(res, eltern);
      } catch (err) {
        await freigeben(res).catch(() => {});
        throw err;
      }
    }
    throw new Error(`Ordner ${schluessel.art} wird gerade angelegt, bitte erneut versuchen`);
  }

  async function umhaengen(row, eltern) {
    const item = await sp.verschieben(row.item_id, eltern.item_id, { conflict: 'rename' });
    const neuPfad = `${eltern.pfad || ''}/${item.name}`;
    const { data, error } = await db()
      .update({ parent_item_id: eltern.item_id, name: item.name, pfad: neuPfad, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('*')
      .single();
    if (error) throw error;
    if (row.pfad && row.pfad !== neuPfad) {
      await supabase.rpc('ablage_pfad_umschreiben', { p_drive_id: driveId, p_alt: row.pfad, p_neu: neuPfad });
    }
    return data;
  }

  async function testOrdner() {
    const root = await wurzel();
    return sicherstellen(root, { art: 'test' }, TEST_ORDNER);
  }

  /** Unternehmen/Marke/Kampagne/Kooperation; koop wie ziel.ladeKooperation. */
  async function kette(koopOderId) {
    const koop = typeof koopOderId === 'string' ? await ladeKooperation(supabase, koopOderId) : koopOderId;
    if (!koop) throw new Error('Kooperation nicht gefunden');
    const kamp = koop.kampagne || {};
    const u = kamp.unternehmen || {};
    const besitz = { unternehmen_id: u.id || kamp.unternehmen_id || null };
    if (!besitz.unternehmen_id) throw new Error('Kampagne ohne Unternehmen');

    const oben = u.ist_test ? await testOrdner() : await wurzel();
    const unternehmen = await sicherstellen(oben, { art: 'unternehmen', unternehmen_id: besitz.unternehmen_id }, NAMEN.unternehmen(u));
    let eltern = unternehmen;
    let marke = null;
    if (kamp.marke_id) {
      marke = await sicherstellen(eltern, { art: 'marke', marke_id: kamp.marke_id }, NAMEN.marke(kamp.marke), besitz);
      eltern = marke;
    }
    const kampagne = await sicherstellen(eltern, { art: 'kampagne', kampagne_id: kamp.id }, NAMEN.kampagne(kamp), { ...besitz, marke_id: kamp.marke_id || null });
    const kooperation = await sicherstellen(kampagne, { art: 'kooperation', kooperation_id: koop.id }, NAMEN.kooperation(koop), {
      ...besitz, marke_id: kamp.marke_id || null, kampagne_id: kamp.id,
    });
    return { unternehmen, marke, kampagne, kooperation, koop };
  }

  const koopBesitz = (k) => ({
    unternehmen_id: k.unternehmen_id, marke_id: k.marke_id, kampagne_id: k.kampagne_id, kooperation_id: k.kooperation_id,
  });

  async function typOrdner(kooperationOrdner, typ) {
    return sicherstellen(kooperationOrdner, { art: 'typ', typ, kooperation_id: kooperationOrdner.kooperation_id }, NAMEN.typ(typ), koopBesitz(kooperationOrdner));
  }

  async function videoOrdner(typRow, video) {
    return sicherstellen(typRow, { art: 'video', kooperation_video_id: video.id }, NAMEN.video(video), { ...koopBesitz(typRow), typ: typRow.typ });
  }

  async function storyOrdner(videoRow, slotIndex) {
    return sicherstellen(videoRow, { art: 'story', story_nummer: Number(slotIndex) || 1 }, NAMEN.story(slotIndex), {
      ...koopBesitz(videoRow), typ: videoRow.typ, kooperation_video_id: videoRow.kooperation_video_id,
    });
  }

  async function schleifeOrdner(row, n) {
    return sicherstellen(row, { art: 'schleife', version_number: Number(n) || 1 }, NAMEN.schleife(n), {
      ...koopBesitz(row), typ: row.typ, kooperation_video_id: row.kooperation_video_id, story_nummer: row.story_nummer ?? null,
    });
  }

  async function finaleOrdner(row) {
    return sicherstellen(row, { art: 'finale' }, NAMEN.finale(), {
      ...koopBesitz(row), typ: row.typ, kooperation_video_id: row.kooperation_video_id, story_nummer: row.story_nummer ?? null,
    });
  }

  async function formatOrdnerSicherstellen(finaleRow, variant) {
    const f = formatOrdner(variant);
    if (!f) return finaleRow;
    return sicherstellen(finaleRow, { art: 'format', format: f }, f, {
      ...koopBesitz(finaleRow), typ: finaleRow.typ, kooperation_video_id: finaleRow.kooperation_video_id,
    });
  }

  async function varianteOrdner(row, variante) {
    const name = NAMEN.variante(variante);
    return sicherstellen(row, { art: 'variante', variante: name }, name, {
      ...koopBesitz(row), typ: row.typ, kooperation_video_id: row.kooperation_video_id,
      story_nummer: row.story_nummer ?? null, version_number: row.version_number ?? null,
    });
  }

  async function ladeVideo(videoId) {
    const { data, error } = await supabase.from('kooperation_videos').select('id, kooperation_id, position, thema').eq('id', videoId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Video nicht gefunden');
    return data;
  }

  async function ladeStory(storyId) {
    const { data, error } = await supabase.from('kooperation_story').select('id, video_id, slot_index').eq('id', storyId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Story-Slot nicht gefunden');
    return data;
  }

  /**
   * Zielordner fuer eine Datei. link = Ordner, dessen Link das CRM zeigt (wie bei Dropbox:
   * Videos/Video_N, Storys/Video_N, Bilder, Rohmaterial).
   * @param {{typ:'video'|'story'|'still'|'roh', kooperation_id:string, kooperation_video_id?:string,
   *          story_id?:string, version_number?:number, is_final?:boolean, variant_name?:string}} ctx
   */
  async function zielOrdner(ctx, { koop } = {}) {
    const k = await kette(koop || ctx.kooperation_id);
    const ko = k.kooperation;
    if (ctx.typ === 'roh') {
      const roh = await typOrdner(ko, 'rohmaterial');
      return { ordner: roh, link: roh, kette: k };
    }

    if (ctx.typ === 'still') {
      const bilder = await typOrdner(ko, 'bilder');
      if (!ctx.kooperation_video_id) return { ordner: bilder, link: bilder, kette: k };
      const v = await videoOrdner(bilder, await ladeVideo(ctx.kooperation_video_id));
      return { ordner: ctx.is_final ? await finaleOrdner(v) : await schleifeOrdner(v, ctx.version_number), link: bilder, kette: k };
    }

    if (ctx.typ === 'video') {
      const vids = await typOrdner(ko, 'videos');
      const v = await videoOrdner(vids, await ladeVideo(ctx.kooperation_video_id));
      if (ctx.is_final) return { ordner: await formatOrdnerSicherstellen(await finaleOrdner(v), ctx.variant_name), link: v, kette: k };
      const s = await schleifeOrdner(v, ctx.version_number);
      return { ordner: ctx.variant_name ? await varianteOrdner(s, ctx.variant_name) : s, link: v, kette: k };
    }

    if (ctx.typ === 'story') {
      const story = await ladeStory(ctx.story_id);
      const storys = await typOrdner(ko, 'storys');
      const v = await videoOrdner(storys, await ladeVideo(ctx.kooperation_video_id || story.video_id));
      const st = await storyOrdner(v, story.slot_index);
      const basis = ctx.is_final ? await finaleOrdner(st) : await schleifeOrdner(st, ctx.version_number);
      return { ordner: ctx.variant_name ? await varianteOrdner(basis, ctx.variant_name) : basis, link: v, kette: k };
    }
    throw new Error(`Unbekannter Typ ${ctx.typ}`);
  }

  /** Fach-Geruest einer Kooperation: Typ-Ordner, je Video Schleifen 1-3 + Finale, je Story-Slot dasselbe. */
  async function geruest(kooperationId) {
    const k = await kette(kooperationId);
    const ko = k.kooperation;
    const [videosRes, typen] = await Promise.all([
      supabase.from('kooperation_videos').select('id, kooperation_id, position, thema').eq('kooperation_id', kooperationId).order('position', { ascending: true }),
      Promise.all(['videos', 'storys', 'bilder', 'rohmaterial'].map((t) => typOrdner(ko, t))),
    ]);
    if (videosRes.error) throw videosRes.error;
    const [vids, storys] = typen;
    const videos = videosRes.data || [];
    const ids = videos.map((v) => v.id);
    const { data: slots, error } = ids.length
      ? await supabase.from('kooperation_story').select('id, video_id, slot_index').in('video_id', ids)
      : { data: [], error: null };
    if (error) throw error;

    let angelegt = 0;
    for (const video of videos) {
      const v = await videoOrdner(vids, video);
      for (const n of SCHLEIFEN) await schleifeOrdner(v, n);
      await finaleOrdner(v);
      const eigene = (slots || []).filter((s) => s.video_id === video.id);
      if (eigene.length) {
        const sv = await videoOrdner(storys, video);
        for (const slot of eigene) {
          const st = await storyOrdner(sv, slot.slot_index);
          for (const n of SCHLEIFEN) await schleifeOrdner(st, n);
          await finaleOrdner(st);
        }
      }
      angelegt++;
    }
    return { kooperation: ko, videos: angelegt };
  }

  /** Fachordner umbenennen (CRM fuehrt den Namen). Zieht Pfade im Register und in den Assets nach. */
  async function umbenennen(row, gewuenscht) {
    if (!row?.item_id) return row;
    const basis = gewuenscht;
    for (let n = 1; n <= MAX_ZAEHLER; n++) {
      const name = mitZaehler(basis, n);
      if (name.toLowerCase() === String(row.name).toLowerCase() && name === row.name) return row;
      const { error: resErr } = await db().update({ name, updated_at: new Date().toISOString() }).eq('id', row.id);
      if (resErr) {
        if (istNamensKonflikt(resErr)) continue;
        throw resErr;
      }
      try {
        const item = await sp.umbenennen(row.item_id, name);
        const altPfad = row.pfad;
        const neuPfad = altPfad ? `${altPfad.slice(0, altPfad.lastIndexOf('/'))}/${item.name}` : null;
        await db().update({ name: item.name, pfad: neuPfad, updated_at: new Date().toISOString() }).eq('id', row.id);
        if (altPfad && neuPfad && altPfad !== neuPfad) {
          await supabase.rpc('ablage_pfad_umschreiben', { p_drive_id: driveId, p_alt: altPfad, p_neu: neuPfad });
        }
        return { ...row, name: item.name, pfad: neuPfad };
      } catch (err) {
        await db().update({ name: row.name }).eq('id', row.id);
        if (err.status === 409) continue;
        throw err;
      }
    }
    throw new Error(`Kein freier Name fuer "${gewuenscht}"`);
  }

  return {
    driveId,
    wurzel,
    finden,
    nachItem,
    sicherstellen,
    testOrdner,
    kette,
    typOrdner,
    videoOrdner,
    storyOrdner,
    schleifeOrdner,
    finaleOrdner,
    formatOrdner: formatOrdnerSicherstellen,
    varianteOrdner,
    zielOrdner,
    geruest,
    umbenennen,
  };
}

module.exports = { createOrdner, SCHLEIFEN };
