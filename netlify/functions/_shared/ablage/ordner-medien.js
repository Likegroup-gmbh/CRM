// _shared/ablage/ordner-medien.js
// Fach-Geruest unter einer Kooperation (ADR 0065, 0070): Videos/Video_N mit Feedbackschleifen,
// Finaler Version, Format- und Story-Ordnern, dazu Rohmaterial mit freien Unterordnern.
// `o` ist das Register aus ordner.js (sicherstellen, nachItem, kette).

const { NAMEN, formatOrdner, bereinigen } = require('./pfad');
const { besitzVon } = require('./klassifizierung');

const SCHLEIFEN = [1, 2, 3];

const istUniqueVerletzung = (err) => err?.code === '23505';

const koopBesitz = (k) => ({
  unternehmen_id: k.unternehmen_id, marke_id: k.marke_id, kampagne_id: k.kampagne_id, kooperation_id: k.kooperation_id,
});

function createMedienOrdner(o, { supabase, sp, driveId }) {
  const db = () => supabase.from('ablage_ordner');

  async function typOrdner(kooperationOrdner, typ) {
    return o.sicherstellen(kooperationOrdner, { art: 'typ', typ, kooperation_id: kooperationOrdner.kooperation_id }, NAMEN.typ(typ), koopBesitz(kooperationOrdner));
  }

  const istRohOrdner = (row) => !!row && !row.geloescht_at && row.typ === 'rohmaterial' && (row.art === 'typ' || row.art === 'frei');

  /**
   * Freier Unterordner im Rohmaterial (ADR 0070): Creator-Ordner beim Upload, "Neuer Ordner" im CRM.
   * Den Namen fuehrt SharePoint (art 'frei'), ein vorhandener Ordner gleichen Namens wird
   * uebernommen. Das Register steht vor dem ersten Upload, sonst wartet der Abgleich auf den
   * Eltern-Ordner und zieht die Datei in die Rohmaterial-Wurzel.
   * @param {object} eltern Register-Zeile: Rohmaterial-Typ-Ordner oder einer seiner Unterordner
   */
  async function rohUnterordner(eltern, gewuenscht) {
    if (!istRohOrdner(eltern) || !eltern.item_id) throw new Error('Kein Rohmaterial-Ordner');
    const name = bereinigen(gewuenscht);
    if (!name) throw new Error('Ordnername fehlt');
    const { item } = await sp.ordnerAnlegen(eltern.item_id, name);
    if (!item) throw new Error(`Ordner "${name}" weder angelegt noch gefunden`);
    if (!item.folder) throw Object.assign(new Error(`"${item.name}" ist eine Datei`), { status: 409 });
    const pfad = `${eltern.pfad || ''}/${item.name}`;
    const zeile = { ...besitzVon(eltern), parent_item_id: eltern.item_id, name: item.name, pfad, art: 'frei', geloescht_at: null };

    const vorhanden = await o.nachItem(item.id);
    if (vorhanden && !vorhanden.geloescht_at) {
      if (!istRohOrdner(vorhanden) || vorhanden.art !== 'frei') throw Object.assign(new Error(`"${item.name}" ist ein Fachordner`), { status: 409 });
      return vorhanden;
    }
    if (vorhanden) {
      const { data, error } = await db().update({ ...zeile, updated_at: new Date().toISOString() }).eq('id', vorhanden.id).select('*').single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await db().insert({ ...zeile, drive_id: driveId, item_id: item.id }).select('*').single();
    if (!error) return data;
    // Abgleich hat den Ordner inzwischen selbst registriert (gleicher Besitz)
    if (istUniqueVerletzung(error)) return o.nachItem(item.id);
    throw error;
  }

  /** Register-Zeile eines Rohmaterial-Ordners der Kooperation (Typ-Ordner oder Unterordner), sonst null. */
  async function rohOrdnerVon(kooperationId, itemId) {
    const row = await o.nachItem(itemId);
    return istRohOrdner(row) && row.kooperation_id === kooperationId ? row : null;
  }

  async function videoOrdner(typRow, video) {
    return o.sicherstellen(typRow, { art: 'video', kooperation_video_id: video.id }, NAMEN.video(video), { ...koopBesitz(typRow), typ: typRow.typ });
  }

  /**
   * Story_K in einer Runde (Feedbackschleife oder Finale Version). version_number traegt die
   * Schleife; leer heisst: Story_K liegt in der Finalen Version.
   */
  async function storyOrdner(rundeRow, slotIndex) {
    return o.sicherstellen(rundeRow, { art: 'story', story_nummer: Number(slotIndex) || 1 }, NAMEN.story(slotIndex), {
      ...koopBesitz(rundeRow), typ: rundeRow.typ, kooperation_video_id: rundeRow.kooperation_video_id,
      version_number: rundeRow.art === 'schleife' ? rundeRow.version_number : null,
    });
  }

  async function schleifeOrdner(row, n) {
    return o.sicherstellen(row, { art: 'schleife', version_number: Number(n) || 1 }, NAMEN.schleife(n), {
      ...koopBesitz(row), typ: row.typ, kooperation_video_id: row.kooperation_video_id, story_nummer: row.story_nummer ?? null,
    });
  }

  async function finaleOrdner(row) {
    return o.sicherstellen(row, { art: 'finale' }, NAMEN.finale(), {
      ...koopBesitz(row), typ: row.typ, kooperation_video_id: row.kooperation_video_id, story_nummer: row.story_nummer ?? null,
    });
  }

  async function formatOrdnerSicherstellen(finaleRow, variant) {
    const f = formatOrdner(variant);
    if (!f) return finaleRow;
    return o.sicherstellen(finaleRow, { art: 'format', format: f }, f, {
      ...koopBesitz(finaleRow), typ: finaleRow.typ, kooperation_video_id: finaleRow.kooperation_video_id,
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

  async function erstesVideo(kooperationId) {
    const { data, error } = await supabase.from('kooperation_videos').select('id, kooperation_id, position, thema')
      .eq('kooperation_id', kooperationId).order('position', { ascending: true }).limit(1);
    if (error) throw error;
    if (!data?.[0]) throw new Error('Kooperation hat noch kein Video: Bild kann nicht abgelegt werden');
    return data[0];
  }

  /** Video der Datei. Bilder ohne Video (Altbestand, Creator-Upload) haengen am ersten Video. */
  async function videoZu(ctx, story) {
    if (ctx.typ === 'story') return ladeVideo(ctx.kooperation_video_id || story.video_id);
    if (ctx.typ === 'still' && !ctx.kooperation_video_id) return erstesVideo(ctx.kooperation_id);
    return ladeVideo(ctx.kooperation_video_id);
  }

  /**
   * Zielordner fuer eine Datei. Video, Bild und Story liegen in derselben Runde unter
   * Videos/Video_N: Feedbackschleife_K bzw. Finale_Version, flach ohne Varianten-Ordner.
   * Videos in der Finale bekommen ihren Format-Ordner, Stories ihren Story_K-Ordner.
   * Dateien einer Upload-Spalte liegen im Spalten-Ordner (ordner-spalte.js).
   * link = Ordner, dessen Link das CRM zeigt (Videos/Video_N, Rohmaterial, Spalte).
   * kooperation_video_id = Video, an dem die Datei haengt (bei Bildern ohne Video das erste).
   * @param {{typ:'video'|'story'|'still'|'roh'|'spalte', kooperation_id:string, kooperation_video_id?:string,
   *          story_id?:string, version_number?:number, is_final?:boolean, variant_name?:string,
   *          custom_column_id?:string}} ctx
   */
  async function zielOrdner(ctx, { koop } = {}) {
    if (ctx.typ === 'spalte') return o.spalteZiel(ctx, { koop });
    const k = await o.kette(koop || ctx.kooperation_id);
    const ko = k.kooperation;
    if (ctx.typ === 'roh') {
      const roh = await typOrdner(ko, 'rohmaterial');
      return { ordner: roh, link: roh, kette: k };
    }
    if (!['video', 'story', 'still'].includes(ctx.typ)) throw new Error(`Unbekannter Typ ${ctx.typ}`);

    const story = ctx.typ === 'story' ? await ladeStory(ctx.story_id) : null;
    const video = await videoZu({ ...ctx, kooperation_id: ctx.kooperation_id || ko.kooperation_id }, story);
    const v = await videoOrdner(await typOrdner(ko, 'videos'), video);
    const runde = ctx.is_final ? await finaleOrdner(v) : await schleifeOrdner(v, ctx.version_number);

    let ordner = runde;
    if (ctx.typ === 'video' && ctx.is_final) ordner = await formatOrdnerSicherstellen(runde, ctx.variant_name);
    if (ctx.typ === 'story') ordner = await storyOrdner(runde, story.slot_index);
    return { ordner, link: v, kette: k, kooperation_video_id: video.id };
  }

  /**
   * Fach-Geruest einer Kooperation: Videos + Rohmaterial, je Video Schleifen 1-3 + Finale, darin Story_K je Slot.
   * Dazu der Bereich Verträge des Unternehmens.
   */
  async function geruest(kooperationId) {
    const k = await o.kette(kooperationId);
    const ko = k.kooperation;
    await o.bereichOrdner(k.unternehmen, 'vertraege');
    const [videosRes, typen] = await Promise.all([
      supabase.from('kooperation_videos').select('id, kooperation_id, position, thema').eq('kooperation_id', kooperationId).order('position', { ascending: true }),
      Promise.all(['videos', 'rohmaterial'].map((t) => typOrdner(ko, t))),
    ]);
    if (videosRes.error) throw videosRes.error;
    const [vids] = typen;
    const videos = videosRes.data || [];
    const ids = videos.map((v) => v.id);
    const { data: slots, error } = ids.length
      ? await supabase.from('kooperation_story').select('id, video_id, slot_index').in('video_id', ids)
      : { data: [], error: null };
    if (error) throw error;

    let angelegt = 0;
    for (const video of videos) {
      const v = await videoOrdner(vids, video);
      const eigene = (slots || []).filter((s) => s.video_id === video.id);
      const runden = [];
      for (const n of SCHLEIFEN) runden.push(await schleifeOrdner(v, n));
      runden.push(await finaleOrdner(v));
      for (const runde of runden) {
        for (const slot of eigene) await storyOrdner(runde, slot.slot_index);
      }
      angelegt++;
    }
    return { kooperation: ko, videos: angelegt };
  }

  return {
    typOrdner,
    rohUnterordner,
    rohOrdnerVon,
    videoOrdner,
    storyOrdner,
    schleifeOrdner,
    finaleOrdner,
    formatOrdner: formatOrdnerSicherstellen,
    ladeVideo,
    zielOrdner,
    geruest,
  };
}

module.exports = { createMedienOrdner, koopBesitz, SCHLEIFEN };
