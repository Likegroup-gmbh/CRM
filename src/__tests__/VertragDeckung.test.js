import { describe, it, expect, beforeEach } from 'vitest';
import {
  videoDeckung,
  vertragVideoLimit,
  verguetungsBasis,
  geldDeckung,
  verknuepfSperre,
  deckungGrundText,
  deckungFehlerText,
  ladeGedeckteKooperationen,
  ladeVerknuepfbareVertraege,
  verknuepfeKooperation,
  loeseKooperation,
  syncVertragFlags,
  vertraegeProKooperation
} from '../modules/vertrag/deckung/vertragDeckung.js';
import { ladeTauschKontext } from '../modules/creator-tausch/CreatorTauschService.js';

const vertrag = (extra = {}) => ({
  id: 'v1', typ: 'UGC', status: 'erstellt', creator_id: 'c1', kampagne_id: 'kamp1',
  anzahl_videos: 6, verguetung_netto: 3000, kooperation_id: 'k1', ...extra
});
const koop = (id, videoanzahl, extra = {}) => ({
  id, creator_id: 'c1', kampagne_id: 'kamp1', videoanzahl, einkaufspreis_netto: 1000, created_at: `2026-0${id.length}-01`, ...extra
});

/** Supabase-Fake: jede Query loest mit der naechsten Antwort aus `antworten`, Aufrufe werden protokolliert. */
function fakeDb(antworten) {
  const calls = [];
  return {
    calls,
    from(tabelle) {
      const q = { tabelle, ops: [] };
      calls.push(q);
      const proxy = new Proxy({}, {
        get(_, op) {
          if (op === 'then') return (res) => res(antworten.shift() ?? { data: null, error: null });
          return (...args) => { q.ops.push([op, ...args]); return proxy; };
        }
      });
      return proxy;
    }
  };
}

describe('Videodeckel', () => {
  it('nimmt anzahl_videos als Limit; 0 oder leer heisst kein Deckel', () => {
    expect(vertragVideoLimit({ anzahl_videos: 6 })).toBe(6);
    expect(vertragVideoLimit({ anzahl_videos: 0 })).toBe(0);
    expect(vertragVideoLimit({})).toBe(0);
  });

  it('Vertrag sagt 6, erste Kooperation hat 3: Rest 3, zweite Kooperation mit 3 passt', () => {
    const d = videoDeckung(vertrag(), [koop('k1', 3)], koop('k2', 3));
    expect(d).toMatchObject({ aktiv: true, limit: 6, summe: 6, rest: 0, passt: true });
  });

  it('zweite Kooperation mit 4 Videos reisst den Deckel', () => {
    const d = videoDeckung(vertrag(), [koop('k1', 3)], koop('k2', 4));
    expect(d.passt).toBe(false);
    expect(d.summe).toBe(7);
  });

  it('ohne Videozahl am Vertrag gibt es keinen Deckel', () => {
    const d = videoDeckung(vertrag({ anzahl_videos: 0 }), [koop('k1', 3)], koop('k2', 40));
    expect(d.aktiv).toBe(false);
    expect(d.passt).toBe(true);
  });
});

describe('Geld: nur Anzeige', () => {
  it('Verguetungsbasis ist EK netto plus KSK bei Selbstzahler', () => {
    expect(verguetungsBasis({ einkaufspreis_netto: 1000, ksk_selbstzahler: true, ksk_betrag: 50 })).toBe(1050);
    expect(verguetungsBasis({ einkaufspreis_netto: 1000, ksk_selbstzahler: false, ksk_betrag: 50 })).toBe(1000);
  });

  it('meldet Ueberschreitung der Vertragsverguetung, sperrt aber nicht', () => {
    const koops = [koop('k1', 3, { einkaufspreis_netto: 3000 }), koop('k2', 3, { einkaufspreis_netto: 1800 })];
    expect(geldDeckung(vertrag(), koops)).toMatchObject({ summe: 4800, verguetung: 3000, ueber: true });
    expect(verknuepfSperre(vertrag(), koop('k2', 3, { einkaufspreis_netto: 1800 }), [koop('k1', 3, { einkaufspreis_netto: 3000 })])).toBeNull();
  });

  it('meldet nichts, wenn die Summe unter der Verguetung liegt', () => {
    expect(geldDeckung(vertrag(), [koop('k1', 3)]).ueber).toBe(false);
  });
});

describe('verknuepfSperre (Scope)', () => {
  const gedeckt = [koop('k1', 3)];

  it('erlaubt gleiche Kampagne und gleichen Creator, auch in anderer Linie und Produktion', () => {
    const zweite = koop('k2', 3, { produktion_id: 'andere-produktion', briefing_id: 'anderes-briefing' });
    expect(verknuepfSperre(vertrag(), zweite, gedeckt)).toBeNull();
  });

  it('sperrt eine andere Kampagne', () => {
    expect(verknuepfSperre(vertrag(), koop('k2', 1, { kampagne_id: 'kamp2' }), gedeckt)).toBe('andere_kampagne');
  });

  it('sperrt einen anderen Creator', () => {
    expect(verknuepfSperre(vertrag(), koop('k2', 1, { creator_id: 'c2' }), gedeckt)).toBe('anderer_creator');
  });

  it('sperrt Contracting und abgelehnte Vertraege', () => {
    expect(verknuepfSperre(vertrag({ typ: 'Contracting' }), koop('k2', 1), gedeckt)).toBe('contracting');
    expect(verknuepfSperre(vertrag({ status: 'abgelehnt' }), koop('k2', 1), gedeckt)).toBe('abgelehnt');
  });

  it('sperrt eine schon gedeckte Kooperation', () => {
    expect(verknuepfSperre(vertrag(), koop('k1', 3), gedeckt)).toBe('bereits_gedeckt');
  });

  it('sperrt bei gerissenem Deckel mit lesbarem Text', () => {
    const k = koop('k2', 4);
    expect(verknuepfSperre(vertrag(), k, gedeckt)).toBe('deckel');
    expect(deckungGrundText('deckel', vertrag(), gedeckt, k)).toBe('Der Vertrag nennt 6 Videos, mit dieser Kooperation wären es 7.');
  });

  it('kennt kein Vertragstyp-Gate: jeder Typ derselben Kampagne und desselben Creators geht', () => {
    ['UGC', 'Influencer Kooperation', 'Videograph', 'Model'].forEach((typ) => {
      expect(verknuepfSperre(vertrag({ typ }), koop('k2', 1), gedeckt)).toBeNull();
    });
  });
});

describe('deckungFehlerText', () => {
  it('uebersetzt die DB-Exceptions', () => {
    expect(deckungFehlerText({ message: 'vertrag_kooperation:andere_kampagne' })).toMatch(/anderen Kampagne/);
    expect(deckungFehlerText({ message: 'vertrag_kooperation:deckel:7:6' })).toBe('Der Vertrag nennt 6 Videos, mit dieser Kooperation wären es 7.');
    expect(deckungFehlerText({ message: 'vertrag_kooperation:loesen_rechnung' })).toMatch(/Rechnung/);
    expect(deckungFehlerText({ message: 'irgendwas' })).toBeNull();
  });
});

describe('Datenaktionen', () => {
  beforeEach(() => { delete window.supabase; });

  it('verknuepfeKooperation wirft den lesbaren Text der DB-Exception', async () => {
    const db = fakeDb([{ data: null, error: { message: 'vertrag_kooperation:deckel:7:6' } }]);
    await expect(verknuepfeKooperation('v1', 'k2', db)).rejects.toThrow('Der Vertrag nennt 6 Videos, mit dieser Kooperation wären es 7.');
    expect(db.calls[0].tabelle).toBe('vertrag_kooperation');
    expect(db.calls[0].ops[0]).toEqual(['insert', { vertrag_id: 'v1', kooperation_id: 'k2' }]);
  });

  it('ladeGedeckteKooperationen vereint Junction und Erzeuger-Kooperation', async () => {
    const db = fakeDb([
      { data: [{ vertrag_id: 'v1', kooperation_id: 'k2' }], error: null },
      { data: [{ id: 'v1', kooperation_id: 'k1' }], error: null },
      { data: [koop('k1', 3), koop('k2', 3)], error: null }
    ]);
    const map = await ladeGedeckteKooperationen(['v1'], db);
    expect(map.get('v1').map((k) => k.id).sort()).toEqual(['k1', 'k2']);
  });

  it('loeseKooperation verweigert die letzte Kooperation', async () => {
    const db = fakeDb([
      { data: [], error: null },
      { data: [{ id: 'v1', kooperation_id: 'k1' }], error: null },
      { data: [koop('k1', 3)], error: null }
    ]);
    await expect(loeseKooperation('v1', 'k1', db)).rejects.toThrow(/mindestens eine Kooperation/);
  });

  it('loeseKooperation loest und zieht die Erzeuger-Kooperation nach', async () => {
    const db = fakeDb([
      { data: [{ vertrag_id: 'v1', kooperation_id: 'k2' }], error: null }, // Junction
      { data: [{ id: 'v1', kooperation_id: 'k1' }], error: null },          // Erzeuger
      { data: [koop('k1', 3), koop('k2', 3)], error: null },               // Kooperationen
      { data: null, error: null },                                          // delete
      { data: { kooperation_id: 'k1' }, error: null },                      // vertrag.kooperation_id
      { data: null, error: null }                                           // update
    ]);
    await loeseKooperation('v1', 'k1', db);
    const delOp = db.calls.find((c) => c.ops.some((o) => o[0] === 'delete'));
    expect(delOp.tabelle).toBe('vertrag_kooperation');
    const update = db.calls.find((c) => c.tabelle === 'vertraege' && c.ops.some((o) => o[0] === 'update'));
    expect(update.ops[0]).toEqual(['update', { kooperation_id: 'k2' }]);
  });

  it('loeseKooperation uebersetzt die Sperre bei vorhandener Rechnung', async () => {
    const db = fakeDb([
      { data: [{ vertrag_id: 'v1', kooperation_id: 'k2' }], error: null },
      { data: [{ id: 'v1', kooperation_id: 'k1' }], error: null },
      { data: [koop('k1', 3), koop('k2', 3)], error: null },
      { data: null, error: { message: 'vertrag_kooperation:loesen_rechnung' } }
    ]);
    await expect(loeseKooperation('v1', 'k2', db)).rejects.toThrow('Zur Kooperation existiert schon eine Rechnung.');
  });

  it('ladeVerknuepfbareVertraege liefert nur Vertraege mit passendem Deckel', async () => {
    const passt = vertrag({ id: 'v-passt', anzahl_videos: 6 });
    const zuKlein = vertrag({ id: 'v-klein', anzahl_videos: 3 });
    const db = fakeDb([
      { data: [passt, zuKlein], error: null },
      { data: [{ vertrag_id: 'v-passt', kooperation_id: 'k1' }, { vertrag_id: 'v-klein', kooperation_id: 'k5' }], error: null },
      { data: [{ id: 'v-passt', kooperation_id: 'k1' }, { id: 'v-klein', kooperation_id: 'k5' }], error: null },
      { data: [koop('k1', 3), koop('k5', 3)], error: null }
    ]);
    const treffer = await ladeVerknuepfbareVertraege(koop('k2', 3), db);
    expect(treffer.map((t) => t.vertrag.id)).toEqual(['v-passt']);
    expect(treffer[0].deckung).toMatchObject({ summe: 6, limit: 6, passt: true });
  });

  it('ladeVerknuepfbareVertraege fragt nur Creator und Kampagne der Kooperation ab und schliesst Abgelehnte aus', async () => {
    const db = fakeDb([{ data: [], error: null }]);
    await ladeVerknuepfbareVertraege(koop('k2', 1), db);
    const ops = db.calls[0].ops;
    expect(ops).toContainEqual(['eq', 'creator_id', 'c1']);
    expect(ops).toContainEqual(['eq', 'kampagne_id', 'kamp1']);
    expect(ops).toContainEqual(['neq', 'status', 'abgelehnt']);
  });

  it('syncVertragFlags setzt das Flag auf jeder gedeckten Kooperation', async () => {
    const db = fakeDb([
      { data: [{ vertrag_id: 'v1', kooperation_id: 'k2' }], error: null },
      { data: [{ id: 'v1', kooperation_id: 'k1' }], error: null },
      { data: [koop('k1', 3), koop('k2', 3)], error: null },
      { data: null, error: null }
    ]);
    const res = await syncVertragFlags('v1', true, { supabase: db });
    expect(res).toMatchObject({ success: true, count: 2 });
    const update = db.calls.find((c) => c.ops.some((o) => o[0] === 'update'));
    expect(update.ops[0]).toEqual(['update', { vertrag_unterschrieben: true }]);
    expect(update.ops[1][0]).toBe('in');
    expect(update.ops[1][2].sort()).toEqual(['k1', 'k2']);
  });

  it('vertraegeProKooperation zeigt den Vertrag auch an der gedeckten zweiten Kooperation', async () => {
    const stamm = { id: 'v1', kooperation_id: 'k1', name: 'Stamm' };
    const db = fakeDb([
      { data: [{ vertrag_id: 'v1', kooperation_id: 'k1' }, { vertrag_id: 'v1', kooperation_id: 'k2' }], error: null }
    ]);
    const map = await vertraegeProKooperation([stamm], ['k1', 'k2', 'k3'], { columns: 'id', sb: db });
    expect(map.get('k1').map((v) => v.id)).toEqual(['v1']);
    expect(map.get('k2').map((v) => v.id)).toEqual(['v1']);
    expect(map.get('k3')).toEqual([]);
  });

  it('vertraegeProKooperation laedt fehlende Vertraege nach', async () => {
    const db = fakeDb([
      { data: [{ vertrag_id: 'v-fremd', kooperation_id: 'k2' }], error: null },
      { data: [{ id: 'v-fremd', kooperation_id: 'k-ausserhalb' }], error: null }
    ]);
    const map = await vertraegeProKooperation([], ['k2'], { columns: 'id, kooperation_id', sb: db });
    expect(map.get('k2').map((v) => v.id)).toEqual(['v-fremd']);
  });
});

describe('Creator-Tausch mit geteiltem Vertrag', () => {
  beforeEach(() => { delete window.supabase; });

  it('Rechnungen anderer gedeckter Kooperationen sperren nicht, Rechnungen exklusiver Vertraege schon', async () => {
    window.supabase = fakeDb([
      { data: { id: 'a', creator_auswahl_id: 'liste', creator_id: 'c1' }, error: null }, // alt
      { data: { produktion_id: 'p', briefing_id: 'b' }, error: null },                    // liste
      { data: [], error: null },                                                           // items
      { data: [{ id: 'kA' }], error: null },                                               // koops des Abspringers
      { count: 1, error: null },                                                           // Linien
      { data: [{ vertrag_id: 'v-geteilt' }, { vertrag_id: 'v-exklusiv' }], error: null },  // gedeckt
      { data: [                                                                            // Mitglieder
        { vertrag_id: 'v-geteilt', kooperation_id: 'kA' },
        { vertrag_id: 'v-geteilt', kooperation_id: 'kB' },
        { vertrag_id: 'v-exklusiv', kooperation_id: 'kA' }
      ], error: null },
      { data: [{ id: 'v-geteilt', status: 'erstellt' }, { id: 'v-exklusiv', status: 'erstellt' }], error: null },
      { data: [], error: null },                                                           // rechnungen
      { data: [], error: null }                                                            // videos
    ]);

    await ladeTauschKontext('a');

    const rechnungQuery = window.supabase.calls.find((c) => c.tabelle === 'rechnung');
    const filter = rechnungQuery.ops.find((o) => o[0] === 'or')[1];
    expect(filter).toContain('kooperation_id.in.(kA)');
    expect(filter).toContain('vertrag_id.in.(v-exklusiv)');
    expect(filter).not.toContain('v-geteilt');
  });

  it('ein unterschriebener geteilter Vertrag sperrt den Tausch', async () => {
    window.supabase = fakeDb([
      { data: { id: 'a', creator_auswahl_id: 'liste', creator_id: 'c1' }, error: null },
      { data: { produktion_id: 'p', briefing_id: 'b' }, error: null },
      { data: [], error: null },
      { data: [{ id: 'kA' }], error: null },
      { count: 1, error: null },
      { data: [{ vertrag_id: 'v-geteilt' }], error: null },
      { data: [{ vertrag_id: 'v-geteilt', kooperation_id: 'kA' }, { vertrag_id: 'v-geteilt', kooperation_id: 'kB' }], error: null },
      { data: [{ id: 'v-geteilt', status: 'unterschrieben' }], error: null },
      { data: [], error: null },
      { data: [], error: null }
    ]);

    const kontext = await ladeTauschKontext('a');
    expect(kontext.datenSperre).toBe('vertrag_unterschrieben');
  });
});
