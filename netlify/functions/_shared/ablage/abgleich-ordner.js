// _shared/ablage/abgleich-ordner.js
// Abgleich: einen Ordner aus dem Eingang einordnen und ausfuehren (Register pflegen,
// Fachordner erkennen, Umbenennen/Verschieben zuruecknehmen, Loeschen kaskadieren).
// `c` ist der Kontext aus createAbgleich.

const { istKonflikt } = require('./graph');
const { ordnerEinordnen, besitzVon, BESITZ, ELTERN_VERSUCHE } = require('./klassifizierung');
const { NAMEN, mitZaehler, basisName } = require('./pfad');
const { stuecke } = require('./liste');

const ORDNER_FELDER = 'id,name,parentReference,folder,root,deleted';

const leererBesitz = () => Object.fromEntries(BESITZ.map((k) => [k, null]));
const istUnique = (err) => err?.code === '23505';

function createOrdnerAbgleich(c) {
  const { supabase, sp, ordner, driveId, iso, rpc } = c;

  async function ordnerBearbeiten(e) {
    const wurzel = await ordner.wurzel();
    if (e.item_id === wurzel.item_id) return { aktion: 'ignorieren', grund: 'wurzel' };
    const eigen = await ordner.nachItem(e.item_id);
    const item = e.geloescht ? null : await sp.item(e.item_id, ORDNER_FELDER);
    const geloescht = !item || !!item.deleted;
    const parentId = item?.parentReference?.id || e.parent_item_id;
    const eltern = geloescht ? null : await ordner.nachItem(parentId);
    const elternOffen = !geloescht && !eltern && parentId ? await c.eingangOffen(parentId) : false;

    const d = ordnerEinordnen({
      item: { item_id: e.item_id, name: item?.name || e.name, parent_item_id: parentId, geloescht },
      eigen,
      eltern,
      elternIstWurzel: parentId === wurzel.item_id,
      elternOffen,
      istWurzel: !!item?.root,
      versuche: e.versuche || 1,
    });
    const pfad = item ? c.pfadUnter(eltern, parentId, wurzel, item.name) : null;
    return ordnerAusfuehren(d, { e, item, eigen, eltern, parentId, pfad });
  }

  async function ordnerAusfuehren(d, { e, item, eigen, eltern, parentId, pfad }) {
    switch (d.aktion) {
      case 'ordner_geloescht':
        return { ...d, ...(await kaskadeLoeschen(eigen)) };

      case 'wiederherstellen': {
        const patch = { geloescht_at: null, parent_item_id: parentId, name: item.name, pfad, updated_at: iso() };
        const { error } = await supabase.from('ablage_ordner').update(patch).eq('id', eigen.id);
        if (!error) return d;
        if (!istUnique(error)) throw error;
        // Fachordner inzwischen neu angelegt: der alte bleibt als freier Ordner
        await registerSetzen(eigen.id, { ...patch, ...leererBesitz(), ...besitzVon(eltern), art: 'frei' });
        return { ...d, grund: 'als_frei' };
      }

      case 'frei':
        return { ...d, ...(await freiRegistrieren(e.item_id, { parent_item_id: parentId, name: item.name, pfad }, d.besitz)) };

      case 'frei_aktualisieren': {
        await registerSetzen(eigen.id, { ...leererBesitz(), ...d.besitz, parent_item_id: parentId, name: item.name, pfad, updated_at: iso() });
        if (eigen.pfad && pfad && eigen.pfad !== pfad) {
          await rpc('ablage_pfad_umschreiben', { p_drive_id: driveId, p_alt: eigen.pfad, p_neu: pfad });
        }
        return d;
      }

      case 'zurueck_verschieben':
        await sp.verschieben(e.item_id, eigen.parent_item_id, { conflict: 'rename' });
        return d;

      case 'zurueck_benennen':
        return { ...d, name: await zurueckBenennen(eigen) };

      case 'variante_umbenennen':
        return { ...d, ...(await varianteUmbenennen(eigen, item, d.variante, pfad)) };

      case 'fach':
        return fachRegistrieren(d, { e, item, eltern, parentId, pfad });

      default:
        return d;
    }
  }

  async function registerSetzen(id, patch) {
    const { error } = await supabase.from('ablage_ordner').update(patch).eq('id', id);
    if (error) throw error;
  }

  async function freiRegistrieren(itemId, felder, besitz) {
    const zeile = { ...leererBesitz(), ...besitz, ...felder, drive_id: driveId, item_id: itemId, art: 'frei' };
    const { error } = await supabase.from('ablage_ordner').insert(zeile);
    if (!error) return { registriert: true };
    if (!istUnique(error)) throw error;
    // gleichzeitig registriert: nachziehen
    const { error: e2 } = await supabase.from('ablage_ordner').update({ ...felder, updated_at: iso() })
      .eq('drive_id', driveId).eq('item_id', itemId);
    if (e2) throw e2;
    return { registriert: false };
  }

  async function zurueckBenennen(eigen) {
    const basis = basisName(eigen.name);
    const namen = [eigen.name, ...[2, 3, 4, 5, 6].map((n) => mitZaehler(basis, n))];
    for (const name of [...new Set(namen)]) {
      try {
        await sp.umbenennen(eigen.item_id, name);
      } catch (err) {
        if (istKonflikt(err)) continue;
        throw err;
      }
      if (name !== eigen.name) {
        const neuPfad = eigen.pfad ? `${eigen.pfad.slice(0, eigen.pfad.lastIndexOf('/'))}/${name}` : null;
        await registerSetzen(eigen.id, { name, pfad: neuPfad, updated_at: iso() });
        if (eigen.pfad && neuPfad) await rpc('ablage_pfad_umschreiben', { p_drive_id: driveId, p_alt: eigen.pfad, p_neu: neuPfad });
      }
      return name;
    }
    throw new Error(`Kein freier Name fuer "${eigen.name}"`);
  }

  async function varianteUmbenennen(eigen, item, wunsch, pfad) {
    const alt = eigen.variante || eigen.name;
    let name = item.name;
    if (wunsch && wunsch !== item.name) {
      try {
        name = (await sp.umbenennen(eigen.item_id, wunsch))?.name || wunsch;
      } catch (err) {
        if (!istKonflikt(err)) throw err;
      }
    }
    const neuPfad = pfad && name !== item.name ? `${pfad.slice(0, pfad.lastIndexOf('/'))}/${name}` : pfad;
    await registerSetzen(eigen.id, { name, variante: name, pfad: neuPfad, updated_at: iso() });
    if (eigen.pfad && neuPfad && eigen.pfad !== neuPfad) {
      await rpc('ablage_pfad_umschreiben', { p_drive_id: driveId, p_alt: eigen.pfad, p_neu: neuPfad });
    }
    let q;
    if (eigen.typ === 'storys') {
      const slot = await c.storySlot(eigen.kooperation_video_id, eigen.story_nummer);
      q = supabase.from('kooperation_story_asset').update({ variant_name: name }).eq('story_id', slot.id);
    } else {
      q = supabase.from('kooperation_video_asset').update({ variant_name: name }).eq('video_id', eigen.kooperation_video_id);
    }
    const { error } = await q.eq('version_number', eigen.version_number || 1).eq('is_final', false).eq('variant_name', alt);
    if (error) throw error;
    return { alt, variante: name };
  }

  async function fachRegistrieren(d, { e, item, eltern, parentId, pfad }) {
    const alsFrei = async (grund) => ({
      aktion: 'frei', grund, ...(await freiRegistrieren(e.item_id, { parent_item_id: parentId, name: item.name, pfad }, besitzVon(eltern))),
    });
    let schluessel;
    let soll = d.soll || null;
    if (d.art === 'video') {
      const { data: videos } = await supabase.from('kooperation_videos').select('id, kooperation_id, position, thema')
        .eq('kooperation_id', eltern.kooperation_id).eq('position', d.position).limit(1);
      const video = videos?.[0];
      if (!video) return alsFrei('kein_video');
      schluessel = { art: 'video', kooperation_video_id: video.id };
      soll = NAMEN.video(video);
    } else if (d.art === 'story') {
      await c.storySlot(eltern.kooperation_video_id, d.story_nummer);
      schluessel = { art: 'story', story_nummer: d.story_nummer };
    } else if (d.art === 'schleife') {
      schluessel = { art: 'schleife', version_number: d.version_number };
    } else if (d.art === 'finale') {
      schluessel = { art: 'finale' };
    } else if (d.art === 'format') {
      schluessel = { art: 'format', format: d.format };
    } else {
      schluessel = { art: 'variante', variante: d.variante };
    }

    const vorhanden = await ordner.finden({ ...schluessel, parent_item_id: parentId });
    // CRM legt denselben Ordner gerade an und uebernimmt den gleichnamigen (auch einen freien)
    if (vorhanden && !vorhanden.item_id && (e.versuche || 1) < ELTERN_VERSUCHE) return { aktion: 'warten', sek: 30, grund: 'crm_legt_an' };
    if (vorhanden && vorhanden.item_id !== e.item_id) return alsFrei('doppelt');

    const zeile = {
      ...leererBesitz(),
      ...besitzVon(eltern),
      ...schluessel,
      drive_id: driveId,
      item_id: e.item_id,
      parent_item_id: parentId,
      name: item.name,
      pfad,
    };
    const { data: row, error } = await supabase.from('ablage_ordner').insert(zeile).select('*').single();
    if (error) {
      if (!istUnique(error)) throw error;
      return alsFrei('doppelt');
    }
    const umbenannt = soll && soll !== item.name ? (await ordner.umbenennen(row, soll)).name : null;
    return { aktion: 'fach', art: d.art, ordner_id: row.id, ...(umbenannt ? { name: umbenannt } : {}) };
  }

  async function kaskadeLoeschen(eigen) {
    const nachfahren = (await rpc('ablage_nachfahren', { p_drive_id: driveId, p_item_id: eigen.item_id })) || [];
    let dateien = 0;
    for (const n of nachfahren) if (!n.ist_ordner) dateien += await c.allesEntfernen(n.item_id);
    const ordnerIds = [eigen.item_id, ...nachfahren.filter((n) => n.ist_ordner).map((n) => n.item_id)];
    const alle = [eigen.item_id, ...nachfahren.map((n) => n.item_id)];
    const zeit = iso();
    for (const teil of stuecke(ordnerIds)) {
      await supabase.from('ablage_ordner').update({ geloescht_at: zeit, updated_at: zeit })
        .eq('drive_id', driveId).in('item_id', teil).is('geloescht_at', null);
    }
    for (const teil of stuecke(alle)) {
      await supabase.from('ablage_eingang').update({ geloescht: true, status: 'erledigt', grund: 'ordner_geloescht', erledigt_at: zeit })
        .eq('drive_id', driveId).in('item_id', teil).neq('item_id', eigen.item_id);
      await supabase.from('ablage_freigabelink').update({ widerrufen_at: zeit, widerruf_grund: 'ordner_geloescht' })
        .eq('drive_id', driveId).in('item_id', teil).is('widerrufen_at', null);
    }
    return { ordner: ordnerIds.length, dateien };
  }

  return { ordnerBearbeiten };
}

module.exports = { createOrdnerAbgleich };
