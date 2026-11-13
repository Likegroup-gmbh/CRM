// _shared/teams/verteilen.js
// Arbeitet die Outbox teams_meldung ab (ADR 0066): faellige Zeilen per Lease holen, Kontext
// laden, Karte bauen, an den Workflow des Kanals schicken, Ergebnis an Zeile und Kanal.
// Aufgerufen vom Anstoss aus dem Browser (teams-meldung-senden) und vom Minuten-Zeitplan.
//
// Reihenfolge: erst die Meldungen zu neuen Kommentaren, dann die Nachtraege 'entfernt'. Ein
// Nachtrag geht nur raus, wenn die Meldung selbst gesendet ist; laeuft sie noch, wartet er,
// ging sie nie raus, faellt er weg.

const { serviceClient } = require('../ablage/konfig');
const { kommentarKarte, entferntKarte } = require('./karte');
const { senden } = require('./webhook');

const LEASE_SEK = 120;
const MAX_VERSUCHE = 5;
const BACKOFF_MS = 30 * 1000;
const NACHTRAG_WARTEN_MS = 60 * 1000;

const KOMMENTAR_SELECT = `id, video_id, runde, text, author_name, author_benutzer_id, deleted_at,
  timecode_sec, asset_id, story_asset_id, still_asset_id,
  video:video_id(id, position,
    kooperation:kooperation_id(id, name, briefing_id, produktion_id, kampagne_id,
      creator:creator_id(vorname, nachname),
      produktion:produktion_id(id, name),
      kampagne:kampagne_id(id, kampagnenname, eigener_name,
        unternehmen:unternehmen_id(firmenname),
        marke:marke_id(markenname))))`;

const uniq = (list) => [...new Set(list.filter(Boolean))];
const schluessel = (kanalId, kommentarId) => `${kanalId}|${kommentarId}`;

async function laden(supabase, zeilen) {
  const kanalIds = uniq(zeilen.map((z) => z.kanal_id));
  const kommentarIds = uniq(zeilen.map((z) => z.zeitkommentar_id));
  const nachtragIds = uniq(zeilen.filter((z) => z.art === 'entfernt').map((z) => z.zeitkommentar_id));

  const [kanaele, kommentare, meldungen] = await Promise.all([
    supabase.from('teams_kanal').select('id, name, webhook_url, aktiv').in('id', kanalIds),
    supabase.from('kooperation_video_zeitkommentar').select(KOMMENTAR_SELECT).in('id', kommentarIds),
    nachtragIds.length
      ? supabase.from('teams_meldung').select('id, kanal_id, zeitkommentar_id, status').eq('art', 'kommentar').in('zeitkommentar_id', nachtragIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [kanaele, kommentare, meldungen]) if (r.error) throw r.error;

  return {
    kanaele: new Map((kanaele.data || []).map((k) => [k.id, k])),
    kommentare: new Map((kommentare.data || []).map((k) => [k.id, k])),
    status: new Map((meldungen.data || []).map((m) => [schluessel(m.kanal_id, m.zeitkommentar_id), m.status])),
  };
}

function createVerteiler({ supabase, fetchImpl, basisUrl = '', jetzt = () => Date.now() }) {
  const iso = (t = jetzt()) => new Date(t).toISOString();

  async function aendern(ids, patch) {
    if (!ids.length) return;
    const { error } = await supabase.from('teams_meldung').update(patch).in('id', ids);
    if (error) throw error;
  }

  async function verwerfen(ids) {
    if (!ids.length) return;
    const { error } = await supabase.from('teams_meldung').delete().in('id', ids);
    if (error) throw error;
  }

  async function kanalStand(kanalId, patch) {
    const { error } = await supabase.from('teams_kanal').update(patch).eq('id', kanalId);
    if (error) console.warn('[teams] Kanalstand nicht gespeichert', kanalId, error.message || error);
  }

  /** Eine Gruppe (eine Karte, eine oder mehrere Zeilen) an den Kanal schicken. */
  async function zustellen(kanal, zeilen, karte, ergebnis) {
    const ids = zeilen.map((z) => z.id);
    const r = await senden(kanal.webhook_url, karte, { fetchImpl });
    if (r.ok) {
      await aendern(ids, { status: 'gesendet', gesendet_at: iso(), gesperrt_bis: null, fehler: null });
      await kanalStand(kanal.id, { letzte_meldung_at: iso(), letzter_fehler: null, letzter_fehler_at: null });
      ergebnis.gesendet += zeilen.length;
      return true;
    }
    for (const z of zeilen) {
      const versuche = (z.versuche || 0) + 1;
      const endgueltig = r.permanent || versuche >= MAX_VERSUCHE;
      await aendern([z.id], endgueltig
        ? { status: 'fehler', versuche, fehler: r.fehler, gesperrt_bis: null }
        : { status: 'offen', versuche, fehler: r.fehler, gesperrt_bis: null, naechster_versuch: iso(jetzt() + BACKOFF_MS * 2 ** (versuche - 1)) });
      if (endgueltig) ergebnis.fehler += 1;
      else ergebnis.verschoben += 1;
    }
    await kanalStand(kanal.id, { letzter_fehler: r.fehler, letzter_fehler_at: iso() });
    return false;
  }

  /**
   * @param {{ budgetMs?: number, limit?: number }} [opts] budgetMs: danach nichts Neues mehr
   *   senden, Rest sofort freigeben (Scheduled Functions haben 30 s)
   */
  async function verteilen({ budgetMs = 8000, limit = 50 } = {}) {
    const start = jetzt();
    const ergebnis = { gesendet: 0, fehler: 0, verschoben: 0, verworfen: 0 };
    const { data: zeilen, error } = await supabase.rpc('teams_meldungen_holen', { p_limit: limit, p_lease_sek: LEASE_SEK });
    if (error) throw error;
    if (!zeilen?.length) return ergebnis;

    const { kanaele, kommentare, status } = await laden(supabase, zeilen);
    const offen = new Set(zeilen.map((z) => z.id));
    const erledigt = (list) => list.forEach((z) => offen.delete(z.id));
    const imBudget = () => jetzt() - start < budgetMs;

    const kanalOk = async (z) => {
      const kanal = kanaele.get(z.kanal_id);
      if (kanal?.aktiv) return kanal;
      await aendern([z.id], { status: 'fehler', fehler: 'Kanal deaktiviert', gesperrt_bis: null });
      ergebnis.fehler += 1;
      return null;
    };

    for (const z of zeilen.filter((x) => x.art === 'kommentar')) {
      if (!imBudget()) break;
      erledigt([z]);
      const kommentar = kommentare.get(z.zeitkommentar_id);
      // Schon entfernt, bevor die Meldung raus war: keine Meldung, also auch kein Nachtrag
      if (!kommentar || kommentar.deleted_at) {
        await verwerfen([z.id]);
        status.delete(schluessel(z.kanal_id, z.zeitkommentar_id));
        ergebnis.verworfen += 1;
        continue;
      }
      const kanal = await kanalOk(z);
      if (!kanal) {
        status.set(schluessel(z.kanal_id, z.zeitkommentar_id), 'fehler');
        continue;
      }
      const ok = await zustellen(kanal, [z], kommentarKarte(kommentar, basisUrl), ergebnis);
      status.set(schluessel(z.kanal_id, z.zeitkommentar_id), ok ? 'gesendet' : 'offen');
    }

    const gruppen = new Map();
    for (const z of zeilen.filter((x) => x.art === 'entfernt')) {
      if (!imBudget()) break;
      const st = status.get(schluessel(z.kanal_id, z.zeitkommentar_id));
      const kommentar = kommentare.get(z.zeitkommentar_id);
      if (st === 'in_arbeit' || st === 'offen') {
        erledigt([z]);
        await aendern([z.id], { status: 'offen', gesperrt_bis: null, naechster_versuch: iso(jetzt() + NACHTRAG_WARTEN_MS) });
        ergebnis.verschoben += 1;
        continue;
      }
      if (st !== 'gesendet' || !kommentar) {
        erledigt([z]);
        await verwerfen([z.id]);
        ergebnis.verworfen += 1;
        continue;
      }
      const key = `${z.kanal_id}|${z.txid}|${kommentar.video_id}`;
      if (!gruppen.has(key)) gruppen.set(key, []);
      gruppen.get(key).push(z);
    }

    for (const gruppe of gruppen.values()) {
      if (!imBudget()) break;
      erledigt(gruppe);
      const kanal = kanaele.get(gruppe[0].kanal_id);
      if (!kanal?.aktiv) {
        await aendern(gruppe.map((z) => z.id), { status: 'fehler', fehler: 'Kanal deaktiviert', gesperrt_bis: null });
        ergebnis.fehler += gruppe.length;
        continue;
      }
      const liste = gruppe.map((z) => kommentare.get(z.zeitkommentar_id));
      await zustellen(kanal, gruppe, entferntKarte(liste, basisUrl), ergebnis);
    }

    // Budget aufgebraucht: sofort wieder freigeben statt auf das Lease-Ende zu warten
    await aendern([...offen], { status: 'offen', gesperrt_bis: null });
    return ergebnis;
  }

  return { verteilen };
}

/** Wie verteilen(), mit Service-Client und Basis-URL aus der Umgebung. */
async function verteilenAusEnv(opts = {}) {
  const supabase = serviceClient();
  if (!supabase) throw new Error('Supabase-Konfiguration fehlt');
  const basisUrl = process.env.URL || '';
  return createVerteiler({ supabase, basisUrl }).verteilen(opts);
}

module.exports = { LEASE_SEK, MAX_VERSUCHE, BACKOFF_MS, NACHTRAG_WARTEN_MS, KOMMENTAR_SELECT, createVerteiler, verteilenAusEnv };
