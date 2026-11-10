// _shared/ablage/stand.js
// Admin-Seite Medienablage: Stand lesen und Betriebsaktionen (Notschalter, Weiche, Eingang,
// Abgleich anstossen, Umzug starten). Die Function ablage-stand prueft vorher die Admin-Rolle.

const { istUuid, anstossen } = require('./konfig');
const { AblageFehler } = require('./http');
const { createUmzug } = require('./umzug');
const ziel = require('./ziel');

const LISTE = 200;
const ZIELE = new Set(['dropbox', 'sharepoint']);
const STAND_SPALTEN = 'drive_id, letzter_lauf, letzter_erfolg, letzte_meldung, fehler, fehler_seit, abo_ablauf, '
  + 'voll_abgleich_noetig, quota_used, quota_total, zert_ablauf, rechte_lauf, rechte_fehler, alarme';

function createStand({ supabase, ablage, event, benutzer, jetzt = () => Date.now(), anstossenImpl = anstossen, umzug = null }) {
  const driveId = ablage?.sp?.driveId || ablage?.konfig?.driveId || null;
  const iso = (ms = jetzt()) => new Date(ms).toISOString();
  const umzugVon = () => umzug || createUmzug({ supabase, ablage });

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
      supabase.from('ablage_einstellung').select('wert').eq('schluessel', 'notschalter').maybeSingle().then(ergebnis),
      supabase.from('ablage_stand').select(STAND_SPALTEN).then(ergebnis),
    ]);
    const basis = { konfig, einstellung: { notschalter: einst?.wert === true }, stand: staende || [] };
    if (!ablage) {
      return { ...basis, zaehler: { offen: 0, fehler: 0, unzugeordnet: 0, erledigt_24h: 0 }, unzugeordnet: [], fehler: [], unternehmen: [], umzug: [] };
    }

    const seit24h = iso(jetzt() - 24 * 60 * 60 * 1000);
    const [offen, fehler, unzugeordnet, erledigt24h, unzListe, fehlerListe, unternehmen] = await Promise.all([
      zaehlen((q) => q.eq('status', 'offen')),
      zaehlen((q) => q.eq('status', 'fehler')),
      zaehlen((q) => q.eq('status', 'unzugeordnet').eq('geloescht', false)),
      zaehlen((q) => q.eq('status', 'erledigt').gte('erledigt_at', seit24h)),
      supabase.from('ablage_unzugeordnet').select('item_id, name, pfad, grund, geaendert_at, geaendert_von, groesse')
        .eq('drive_id', driveId).order('geaendert_at', { ascending: false }).limit(LISTE).then(ergebnis),
      supabase.from('ablage_eingang').select('item_id, name, pfad, grund, versuche, naechster_versuch')
        .eq('drive_id', driveId).eq('status', 'fehler').order('naechster_versuch', { ascending: true }).limit(LISTE).then(ergebnis),
      supabase.rpc('ablage_unternehmen_stand', { p_drive_id: driveId }).then(ergebnis),
    ]);

    const n = (v) => Number(v) || 0;
    const liste = unternehmen || [];
    return {
      ...basis,
      zaehler: { offen, fehler, unzugeordnet, erledigt_24h: erledigt24h },
      unzugeordnet: unzListe || [],
      fehler: fehlerListe || [],
      unternehmen: liste.map((u) => ({
        id: u.id, firmenname: u.firmenname, ablage_ziel: u.ablage_ziel, ist_test: !!u.ist_test,
        dateien_sharepoint: n(u.dateien_sharepoint), dateien_dropbox: n(u.dateien_dropbox),
      })),
      umzug: liste
        .filter((u) => n(u.umzug_offen) + n(u.umzug_fertig) + n(u.umzug_fehler) + n(u.umzug_uebersprungen) > 0)
        .map((u) => ({
          unternehmen_id: u.id, offen: n(u.umzug_offen), fertig: n(u.umzug_fertig),
          fehler: n(u.umzug_fehler), uebersprungen: n(u.umzug_uebersprungen),
        })),
    };
  }

  async function notschalter({ an }) {
    if (typeof an !== 'boolean') throw new AblageFehler(400, 'an muss true oder false sein');
    const { error } = await supabase.from('ablage_einstellung')
      .upsert({ schluessel: 'notschalter', wert: an, updated_at: iso(), updated_by: benutzer?.id || null }, { onConflict: 'schluessel' });
    if (error) throw error;
    // Andere warme Instanzen sehen den Schalter nach hoechstens 15 Sekunden (Cache in ziel.js)
    ziel._reset();
    console.log(`[ablage-stand] Notschalter ${an ? 'AN' : 'aus'} durch ${benutzer?.email || benutzer?.id || '?'}`);
    return { ok: true };
  }

  async function weiche({ unternehmen_id: id, ziel: z }) {
    if (!istUuid(id) || !ZIELE.has(z)) throw new AblageFehler(400, 'Ungültige Weiche');
    if (z === 'sharepoint') sharePointNoetig();
    const data = ergebnis(await supabase.from('unternehmen').update({ ablage_ziel: z }).eq('id', id).select('id').maybeSingle());
    if (!data) throw new AblageFehler(404, 'Unternehmen nicht gefunden');
    console.log(`[ablage-stand] Weiche ${id} -> ${z} durch ${benutzer?.email || benutzer?.id || '?'}`);
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

  return { stand, notschalter, weiche, erneut, ignorieren, jetzt_abgleichen, voll_abgleich, umzug_starten };
}

const AKTIONEN = new Set(['stand', 'notschalter', 'weiche', 'erneut', 'ignorieren', 'jetzt_abgleichen', 'voll_abgleich', 'umzug_starten']);

module.exports = { createStand, AKTIONEN };
