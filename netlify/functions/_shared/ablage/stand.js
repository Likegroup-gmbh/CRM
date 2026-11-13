// _shared/ablage/stand.js
// Admin-Seite Medienablage: Stand lesen und Betriebsaktionen (Notschalter, Weiche, Eingang,
// Abgleich anstossen, Umzug starten, Finale spiegeln). Die Function ablage-stand prueft vorher die Admin-Rolle.

const { istUuid, anstossen } = require('./konfig');
const { AblageFehler } = require('./http');
const { createUmzug } = require('./umzug');
const { createUmsortieren } = require('./umsortieren');
const { createFinalSpiegel } = require('./final-spiegel');
const ziel = require('./ziel');

const LISTE = 200;
const ZIELE = new Set(['dropbox', 'sharepoint']);
// Medien und Dokumente (ADR 0068) haben je Weiche und Notschalter
const BEREICHE = {
  medien: { spalte: 'ablage_ziel', notschalter: ziel.NOTSCHALTER.medien },
  dokumente: { spalte: 'dokument_ablage_ziel', notschalter: ziel.NOTSCHALTER.dokumente },
};
const STAND_SPALTEN = 'drive_id, letzter_lauf, letzter_erfolg, letzte_meldung, fehler, fehler_seit, abo_ablauf, '
  + 'voll_abgleich_noetig, quota_used, quota_total, zert_ablauf, rechte_lauf, rechte_fehler, alarme';

function createStand({
  supabase, ablage, event, benutzer, jetzt = () => Date.now(), anstossenImpl = anstossen, umzug = null, umsortieren = null, finalSpiegel = null,
}) {
  const driveId = ablage?.sp?.driveId || ablage?.konfig?.driveId || null;
  const iso = (ms = jetzt()) => new Date(ms).toISOString();
  const umzugVon = () => umzug || createUmzug({ supabase, ablage });
  const umsortierenVon = () => umsortieren || createUmsortieren({ supabase, ablage, jetzt });
  const spiegelVon = () => finalSpiegel || createFinalSpiegel({ supabase, ablage, jetzt });

  const ergebnis = ({ data, error }) => {
    if (error) throw error;
    return data;
  };

  async function zaehlen(filter) {
    const { count, error } = await filter(
      supabase.from('ablage_eingang').select('item_id', { count: 'exact', head: true }).eq('drive_id', driveId),
    );
    if (error) throw error;
    return count || 0;
  }

  function sharePointNoetig() {
    if (!ablage) throw new AblageFehler(409, 'SharePoint ist nicht konfiguriert', 'nicht_konfiguriert');
  }

  async function stand() {
    const konfig = { konfiguriert: !!ablage, site_url: ablage?.konfig?.siteUrl || null, drive_id: driveId };
    const [einst, staende] = await Promise.all([
      supabase.from('ablage_einstellung').select('schluessel, wert').in('schluessel', Object.values(ziel.NOTSCHALTER)).then(ergebnis),
      supabase.from('ablage_stand').select(STAND_SPALTEN).then(ergebnis),
    ]);
    const an = (schluessel) => (einst || []).some((e) => e.schluessel === schluessel && e.wert === true);
    const einstellung = { notschalter: an(ziel.NOTSCHALTER.medien), notschalter_dokumente: an(ziel.NOTSCHALTER.dokumente) };
    const basis = { konfig, einstellung, stand: staende || [] };
    if (!ablage) {
      return {
        ...basis, zaehler: { offen: 0, fehler: 0, unzugeordnet: 0, erledigt_24h: 0 }, unzugeordnet: [], fehler: [], unternehmen: [], umzug: [],
        dokumente: [], dokument_umzug: [], final_spiegel: null,
      };
    }

    const seit24h = iso(jetzt() - 24 * 60 * 60 * 1000);
    const [offen, fehler, unzugeordnet, erledigt24h, unzListe, fehlerListe, unternehmen, dokumente, finalSpiegelStand] = await Promise.all([
      zaehlen((q) => q.eq('status', 'offen')),
      zaehlen((q) => q.eq('status', 'fehler')),
      zaehlen((q) => q.eq('status', 'unzugeordnet').eq('geloescht', false)),
      zaehlen((q) => q.eq('status', 'erledigt').gte('erledigt_at', seit24h)),
      supabase.from('ablage_unzugeordnet').select('item_id, name, pfad, grund, geaendert_at, geaendert_von, groesse')
        .eq('drive_id', driveId).order('geaendert_at', { ascending: false }).limit(LISTE).then(ergebnis),
      supabase.from('ablage_eingang').select('item_id, name, pfad, grund, versuche, naechster_versuch')
        .eq('drive_id', driveId).eq('status', 'fehler').order('naechster_versuch', { ascending: true }).limit(LISTE).then(ergebnis),
      supabase.rpc('ablage_unternehmen_stand', { p_drive_id: driveId }).then(ergebnis),
      supabase.rpc('ablage_dokumente_stand', { p_drive_id: driveId }).then(ergebnis),
      // Ohne Migration 20261216 bleibt die Seite benutzbar, nur ohne den Spiegel-Teil
      Promise.resolve().then(() => spiegelVon().stand()).catch((err) => {
        console.warn('[ablage-stand] Final-Spiegel:', err.message);
        return null;
      }),
    ]);

    const n = (v) => Number(v) || 0;
    const liste = unternehmen || [];
    const umzugZaehler = (u) => ({
      unternehmen_id: u.id, offen: n(u.umzug_offen), fertig: n(u.umzug_fertig), fehler: n(u.umzug_fehler), uebersprungen: n(u.umzug_uebersprungen),
    });
    const hatUmzug = (u) => n(u.umzug_offen) + n(u.umzug_fertig) + n(u.umzug_fehler) + n(u.umzug_uebersprungen) > 0;
    return {
      ...basis,
      zaehler: { offen, fehler, unzugeordnet, erledigt_24h: erledigt24h },
      unzugeordnet: unzListe || [],
      fehler: fehlerListe || [],
      unternehmen: liste.map((u) => ({
        id: u.id, firmenname: u.firmenname, ablage_ziel: u.ablage_ziel, ist_test: !!u.ist_test,
        dateien_sharepoint: n(u.dateien_sharepoint), dateien_dropbox: n(u.dateien_dropbox),
      })),
      umzug: liste.filter(hatUmzug).map(umzugZaehler),
      dokumente: (dokumente || []).map((d) => ({
        id: d.id, dokument_ablage_ziel: d.dokument_ablage_ziel,
        sharepoint: n(d.dokumente_sharepoint), dropbox: n(d.dokumente_dropbox), storage: n(d.dokumente_storage),
      })),
      dokument_umzug: (dokumente || []).filter(hatUmzug).map(umzugZaehler),
      final_spiegel: finalSpiegelStand,
    };
  }

  function bereichVon(bereich = 'medien') {
    if (!BEREICHE[bereich]) throw new AblageFehler(400, 'Unbekannter Bereich');
    return BEREICHE[bereich];
  }

  async function notschalter({ an, bereich }) {
    if (typeof an !== 'boolean') throw new AblageFehler(400, 'an muss true oder false sein');
    const b = bereichVon(bereich);
    const { error } = await supabase.from('ablage_einstellung')
      .upsert({ schluessel: b.notschalter, wert: an, updated_at: iso(), updated_by: benutzer?.id || null }, { onConflict: 'schluessel' });
    if (error) throw error;
    // Andere warme Instanzen sehen den Schalter nach hoechstens 15 Sekunden (Cache in ziel.js)
    ziel._reset();
    console.log(`[ablage-stand] Notschalter ${b.notschalter} ${an ? 'AN' : 'aus'} durch ${benutzer?.email || benutzer?.id || '?'}`);
    return { ok: true };
  }

  async function weiche({ unternehmen_id: id, ziel: z, bereich }) {
    if (!istUuid(id) || !ZIELE.has(z)) throw new AblageFehler(400, 'Ungültige Weiche');
    const b = bereichVon(bereich);
    if (z === 'sharepoint') sharePointNoetig();
    const data = ergebnis(await supabase.from('unternehmen').update({ [b.spalte]: z }).eq('id', id).select('id').maybeSingle());
    if (!data) throw new AblageFehler(404, 'Unternehmen nicht gefunden');
    console.log(`[ablage-stand] Weiche ${b.spalte} ${id} -> ${z} durch ${benutzer?.email || benutzer?.id || '?'}`);
    return { ok: true };
  }

  async function eingangSetzen(itemId, patch, aus) {
    sharePointNoetig();
    if (!itemId || typeof itemId !== 'string') throw new AblageFehler(400, 'item_id fehlt');
    const data = ergebnis(await supabase.from('ablage_eingang').update(patch)
      .eq('drive_id', driveId).eq('item_id', itemId).in('status', aus).select('item_id').maybeSingle());
    if (!data) throw new AblageFehler(404, 'Eintrag nicht gefunden');
  }

  async function erneut({ item_id: itemId }) {
    await eingangSetzen(itemId,
      { status: 'offen', grund: null, versuche: 0, naechster_versuch: iso(), gesperrt_bis: null },
      ['unzugeordnet', 'fehler', 'ignoriert']);
    await anstossenImpl(event, 'ablage-abgleich-background', { grund: 'erneut' });
    return { ok: true };
  }

  async function ignorieren({ item_id: itemId }) {
    await eingangSetzen(itemId, { status: 'ignoriert', grund: 'admin', erledigt_at: iso() }, ['unzugeordnet', 'fehler', 'offen']);
    return { ok: true };
  }

  async function jetzt_abgleichen() {
    sharePointNoetig();
    return { ok: true, angestossen: await anstossenImpl(event, 'ablage-abgleich-background', { grund: 'admin' }) };
  }

  async function voll_abgleich() {
    sharePointNoetig();
    ergebnis(await supabase.from('ablage_stand').update({ voll_abgleich_noetig: true, updated_at: iso() }).eq('drive_id', driveId));
    return { ok: true, angestossen: await anstossenImpl(event, 'ablage-abgleich-background', { grund: 'voll' }) };
  }

  async function umzug_starten({ unternehmen_id: id }) {
    sharePointNoetig();
    if (!istUuid(id)) throw new AblageFehler(400, 'unternehmen_id fehlt');
    const u = ergebnis(await supabase.from('unternehmen').select('id, ablage_ziel').eq('id', id).maybeSingle());
    if (!u) throw new AblageFehler(404, 'Unternehmen nicht gefunden');
    if (u.ablage_ziel !== 'sharepoint') throw new AblageFehler(409, 'Erst die Weiche auf SharePoint stellen', 'weiche_dropbox');
    await ablage.ordner.wurzel();
    const angelegt = await umzugVon().anlegen(id);
    if (angelegt) await anstossenImpl(event, 'ablage-umzug-background', { grund: 'admin' });
    console.log(`[ablage-stand] Umzug ${id}: ${angelegt} eingereiht durch ${benutzer?.email || benutzer?.id || '?'}`);
    return { ok: true, angelegt };
  }

  /** Verträge, Rechnungen, Belege, Auftragsdokumente eines Unternehmens (ADR 0068). */
  async function dokument_umzug_starten({ unternehmen_id: id }) {
    sharePointNoetig();
    if (!istUuid(id)) throw new AblageFehler(400, 'unternehmen_id fehlt');
    const u = ergebnis(await supabase.from('unternehmen').select('id, dokument_ablage_ziel').eq('id', id).maybeSingle());
    if (!u) throw new AblageFehler(404, 'Unternehmen nicht gefunden');
    if (u.dokument_ablage_ziel !== 'sharepoint') throw new AblageFehler(409, 'Erst die Weiche Dokumente auf SharePoint stellen', 'weiche_dropbox');
    await ablage.ordner.wurzel();
    const angelegt = await umzugVon().dokumenteAnlegen(id);
    // Auch bei 0 neu angelegten Zeilen: eine schon offene Warteschlange (Anstoss zuvor
    // danebengegangen) soll derselbe Klick starten. Der Läufer nimmt sich die Zeile per SKIP LOCKED.
    const angestossen = await anstossenImpl(event, 'ablage-umzug-background', { grund: 'dokumente' });
    console.log(`[ablage-stand] Dokument-Umzug ${id}: ${angelegt} eingereiht, angestossen=${angestossen} durch ${benutzer?.email || benutzer?.id || '?'}`);
    return { ok: true, angelegt, angestossen };
  }

  function unternehmenIdPruefen(id) {
    sharePointNoetig();
    if (!istUuid(id)) throw new AblageFehler(400, 'unternehmen_id fehlt');
  }

  /** Trockenlauf des Struktur-Umzugs (ADR 0065): nur Register und Eingang, nichts wird bewegt. */
  async function umsortieren_planen({ unternehmen_id: id }) {
    unternehmenIdPruefen(id);
    const { zaehler, rest } = await umsortierenVon().planen(id);
    return { ok: true, zaehler, rest };
  }

  async function umsortieren_starten({ unternehmen_id: id }) {
    unternehmenIdPruefen(id);
    const angestossen = await anstossenImpl(event, 'ablage-umsortieren-background', { unternehmen_id: id });
    console.log(`[ablage-stand] Umsortieren ${id} angestossen durch ${benutzer?.email || benutzer?.id || '?'}`);
    return { ok: true, angestossen };
  }

  /** Trockenlauf "Finale spiegeln" (ADR 0073): was kopiert wuerde und wie viel Speicher es braucht. */
  async function final_spiegel_planen() {
    sharePointNoetig();
    const [zaehler, quota] = await Promise.all([
      spiegelVon().stand(),
      supabase.from('ablage_stand').select('quota_used, quota_total').eq('drive_id', driveId).maybeSingle().then(ergebnis),
    ]);
    return { ok: true, ...zaehler, quota_used: Number(quota?.quota_used) || 0, quota_total: Number(quota?.quota_total) || 0 };
  }

  /** Bestand vor dem Stichtag, Fehler und im Finder geloeschte Kopien einreihen und den Laeufer starten. */
  async function final_spiegel_starten() {
    sharePointNoetig();
    await ablage.ordner.wurzel();
    const eingereiht = await spiegelVon().scan({ alle: true });
    const angestossen = await anstossenImpl(event, 'ablage-final-spiegel-background', { grund: 'admin' });
    console.log(`[ablage-stand] Finale spiegeln: ${eingereiht} offen, angestossen=${angestossen} durch ${benutzer?.email || benutzer?.id || '?'}`);
    return { ok: true, eingereiht, angestossen };
  }

  return {
    stand, notschalter, weiche, erneut, ignorieren, jetzt_abgleichen, voll_abgleich, umzug_starten, dokument_umzug_starten,
    umsortieren_planen, umsortieren_starten, final_spiegel_planen, final_spiegel_starten,
  };
}

const AKTIONEN = new Set([
  'stand', 'notschalter', 'weiche', 'erneut', 'ignorieren', 'jetzt_abgleichen', 'voll_abgleich', 'umzug_starten',
  'dokument_umzug_starten', 'umsortieren_planen', 'umsortieren_starten', 'final_spiegel_planen', 'final_spiegel_starten',
]);

module.exports = { createStand, AKTIONEN };
