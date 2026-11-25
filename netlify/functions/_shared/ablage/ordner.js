// _shared/ablage/ordner.js
// Ordner-Register (ablage_ordner) + Anlage in SharePoint.
// Ablauf je Fachordner: Register nach Besitzer fragen -> Namen reservieren (Unique-Index,
// bei Kollision "Name (2)") -> Ordner anlegen bzw. gleichnamigen unregistrierten Ordner
// uebernehmen -> item_id eintragen. Fachordner-Namen fuehrt das CRM.
// Das Geruest unter der Kooperation liegt in ordner-medien.js, die Upload-Spalten in ordner-spalte.js.

const { NAMEN, TEST_ORDNER, mitZaehler } = require('./pfad');
const { ladeKooperation } = require('./kooperation');
const { createMedienOrdner, SCHLEIFEN } = require('./ordner-medien');
const { createSpalteOrdner } = require('./ordner-spalte');

const RESERVIERUNG_ALT_MS = 2 * 60 * 1000;
const MAX_ZAEHLER = 20;
// Dokument-Ordner (ADR 0068) haengen ueber dok_schluessel am Fach-Objekt und ziehen mit um
const BEWEGLICH = new Set(['unternehmen', 'marke', 'kampagne', 'produktion', 'kooperation', 'dokument']);

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

  /** webUrls sind pfadbasiert: nach Verschieben/Umbenennen in Assets und Ordner-Links nachziehen. */
  async function urlsNachziehen(alt, neu) {
    if (!alt || !neu || alt === neu) return;
    const { error } = await supabase.rpc('ablage_url_umschreiben', { p_drive_id: driveId, p_alt: alt, p_neu: neu });
    if (error) console.warn('[ablage-ordner] webUrls nicht nachgezogen:', alt, error.message);
  }

  async function umhaengen(row, eltern) {
    const vorher = await sp.item(row.item_id, 'id,webUrl');
    // Register zuerst: sonst haelt der Abgleich den Move fuer eine Finder-Verschiebung und nimmt ihn zurueck
    const { error: vorErr } = await db()
      .update({ parent_item_id: eltern.item_id, pfad: `${eltern.pfad || ''}/${row.name}`, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (vorErr && !istNamensKonflikt(vorErr)) throw vorErr;
    let item;
    try {
      item = await sp.verschieben(row.item_id, eltern.item_id, { conflict: 'rename' });
    } catch (err) {
      if (!vorErr) await db().update({ parent_item_id: row.parent_item_id, pfad: row.pfad }).eq('id', row.id);
      throw err;
    }
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
    await urlsNachziehen(vorher?.webUrl, item.webUrl);
    return data;
  }

  async function testOrdner() {
    const root = await wurzel();
    return sicherstellen(root, { art: 'test' }, TEST_ORDNER);
  }

  /** Bereich (Medien, Verträge) unter dem Ordner des Unternehmens. */
  async function bereichOrdner(unternehmenRow, bereich) {
    return sicherstellen(unternehmenRow, { art: 'bereich', bereich, unternehmen_id: unternehmenRow.unternehmen_id }, NAMEN.bereich(bereich));
  }

  /**
   * Unternehmen/Medien/[Marke/]Kampagne/[Produktion/]Kooperation; koop wie ziel.ladeKooperation.
   * Ohne Produktion liegt die Kooperation direkt in der Kampagne (ADR 0069).
   */
  async function kette(koopOderId) {
    const koop = typeof koopOderId === 'string' ? await ladeKooperation(supabase, koopOderId) : koopOderId;
    if (!koop) throw new Error('Kooperation nicht gefunden');
    const kamp = koop.kampagne || {};
    const u = kamp.unternehmen || {};
    const besitz = { unternehmen_id: u.id || kamp.unternehmen_id || null };
    if (!besitz.unternehmen_id) throw new Error('Kampagne ohne Unternehmen');

    const oben = u.ist_test ? await testOrdner() : await wurzel();
    const unternehmen = await sicherstellen(oben, { art: 'unternehmen', unternehmen_id: besitz.unternehmen_id }, NAMEN.unternehmen(u));
    const medien = await bereichOrdner(unternehmen, 'medien');
    let eltern = medien;
    let marke = null;
    if (kamp.marke_id) {
      marke = await sicherstellen(eltern, { art: 'marke', marke_id: kamp.marke_id }, NAMEN.marke(kamp.marke), besitz);
      eltern = marke;
    }
    const kampagne = await sicherstellen(eltern, { art: 'kampagne', kampagne_id: kamp.id }, NAMEN.kampagne(kamp), { ...besitz, marke_id: kamp.marke_id || null });
    let koopEltern = kampagne;
    let produktion = null;
    if (koop.produktion_id) {
      produktion = await sicherstellen(kampagne, { art: 'produktion', produktion_id: koop.produktion_id }, NAMEN.produktion(koop.produktion), {
        ...besitz, marke_id: kamp.marke_id || null, kampagne_id: kamp.id,
      });
      koopEltern = produktion;
    }
    const kooperation = await sicherstellen(koopEltern, { art: 'kooperation', kooperation_id: koop.id }, NAMEN.kooperation(koop), {
      ...besitz, marke_id: kamp.marke_id || null, kampagne_id: kamp.id,
    });
    return { unternehmen, medien, marke, kampagne, produktion, kooperation, koop };
  }

  /**
   * Ordner eines Dokuments: Unternehmen/<Bereich>/<Ebenen...> (dokument.dokumentEbenen).
   * @param {{ id, firmenname, ist_test }} unternehmen
   * @param {'vertraege'|'rechnungen'|'auftraege'} bereich
   * @param {{ ebene, ref, name, extra }[]} ebenen
   */
  async function dokumentKette(unternehmen, bereich, ebenen) {
    if (!unternehmen?.id) throw new Error('Dokument ohne Unternehmen');
    const oben = unternehmen.ist_test ? await testOrdner() : await wurzel();
    const u = await sicherstellen(oben, { art: 'unternehmen', unternehmen_id: unternehmen.id }, NAMEN.unternehmen(unternehmen));
    let eltern = await bereichOrdner(u, bereich);
    for (const e of ebenen) {
      eltern = await sicherstellen(eltern, { art: 'dokument', dok_schluessel: `${bereich}:${unternehmen.id}:${e.ebene}:${e.ref}` }, e.name, {
        bereich, unternehmen_id: unternehmen.id, ebene: e.ebene, ...e.extra,
      });
    }
    return eltern;
  }

  /** Fachordner umbenennen (CRM fuehrt den Namen). Zieht Pfade im Register und in den Assets nach. */
  async function umbenennen(row, gewuenscht) {
    if (!row?.item_id) return row;
    const basis = gewuenscht;
    let vorher;
    for (let n = 1; n <= MAX_ZAEHLER; n++) {
      const name = mitZaehler(basis, n);
      if (name.toLowerCase() === String(row.name).toLowerCase() && name === row.name) return row;
      const { error: resErr } = await db().update({ name, updated_at: new Date().toISOString() }).eq('id', row.id);
      if (resErr) {
        if (istNamensKonflikt(resErr)) continue;
        throw resErr;
      }
      try {
        vorher ??= await sp.item(row.item_id, 'id,webUrl');
        const item = await sp.umbenennen(row.item_id, name);
        const altPfad = row.pfad;
        const neuPfad = altPfad ? `${altPfad.slice(0, altPfad.lastIndexOf('/'))}/${item.name}` : null;
        await db().update({ name: item.name, pfad: neuPfad, updated_at: new Date().toISOString() }).eq('id', row.id);
        if (altPfad && neuPfad && altPfad !== neuPfad) {
          await supabase.rpc('ablage_pfad_umschreiben', { p_drive_id: driveId, p_alt: altPfad, p_neu: neuPfad });
        }
        await urlsNachziehen(vorher?.webUrl, item.webUrl);
        return { ...row, name: item.name, pfad: neuPfad };
      } catch (err) {
        await db().update({ name: row.name }).eq('id', row.id);
        if (err.status === 409) continue;
        throw err;
      }
    }
    throw new Error(`Kein freier Name fuer "${gewuenscht}"`);
  }

  const o = {
    driveId,
    wurzel,
    finden,
    nachItem,
    sicherstellen,
    umhaengen,
    testOrdner,
    bereichOrdner,
    kette,
    dokumentKette,
    umbenennen,
    urlsNachziehen,
  };
  Object.assign(o, createMedienOrdner(o, { supabase, sp, driveId }));
  Object.assign(o, createSpalteOrdner(o, { supabase }));
  return o;
}

module.exports = { createOrdner, SCHLEIFEN };
