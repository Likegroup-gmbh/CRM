import { describe, it, expect } from 'vitest';
import { START, iso, setup, videoZiel } from './ablageAbgleichTestKit.js';

describe('ablage-abgleich: Nachlauf bis die Datei reif ist', () => {
  const schnell = { abgleich: { ruheSek: 20, nachlaufSek: 25 } };

  it('frische Datei (vor 5 s geaendert) wird im selben Lauf eingeordnet', async () => {
    const t = setup(schnell);
    const { ordner: variante } = await t.ordner.zielOrdner(videoZiel());
    const f = t.sp.datei(variante.item_id, 'frisch.mov', 500);
    t.seite([await t.meldung(f.id, { lastModifiedDateTime: iso(t.uhr.t - 5000) })]);

    const r = await t.a.lauf();

    expect(r).toMatchObject({ lease: true, neu: 1, eingang: { erledigt: 1 } });
    expect(r.mehr).toBeUndefined();
    expect(t.supabase.db.kooperation_video_asset).toEqual([expect.objectContaining({ item_id: f.id })]);
    expect(t.uhr.t - START).toBeGreaterThanOrEqual(15000);
    expect(t.uhr.t - START).toBeLessThanOrEqual(25000);
    expect(t.supabase.db.ablage_stand[0].lease_bis).toBeNull();
  });

  it('ohne neue Eintraege endet der Lauf sofort', async () => {
    const t = setup(schnell);
    const r = await t.a.lauf();
    expect(r).toMatchObject({ lease: true, neu: 0 });
    expect(t.uhr.schlaefe).toBe(0);
  });

  it('der Nachlauf bleibt im Budget', async () => {
    const t = setup(schnell);
    const { ordner: variante } = await t.ordner.zielOrdner(videoZiel());
    const f = t.sp.datei(variante.item_id, 'frisch.mov', 500);
    t.seite([await t.meldung(f.id, { lastModifiedDateTime: iso(t.uhr.t - 5000) })]);

    await t.a.lauf({ budgetMs: 8000 });

    expect(t.uhr.t - START).toBeLessThanOrEqual(8000);
    expect(t.supabase.db.kooperation_video_asset).toHaveLength(0);
    expect(t.eingang(f.id)).toMatchObject({ status: 'offen' });
  });

  it('greift waehrend des Nachlaufs neu gemeldete Dateien auf (Webhook scheitert an der Lease)', async () => {
    const t = setup(schnell);
    const { ordner: variante } = await t.ordner.zielOrdner(videoZiel());
    const a = t.sp.datei(variante.item_id, 'a.mov', 500);
    const b = t.sp.datei(variante.item_id, 'b.mov', 600);
    t.seite([await t.meldung(a.id)]);
    t.uhr.beimSchlafen = async () => {
      t.uhr.beimSchlafen = null;
      t.seite([await t.meldung(b.id)], 'dl-2');
    };

    const r = await t.a.lauf();

    expect(r).toMatchObject({ neu: 2, eingang: { erledigt: 2 } });
    expect(t.supabase.db.kooperation_video_asset.map((x) => x.item_id).sort()).toEqual([a.id, b.id].sort());
  });
});

describe('ablage-abgleich: Webhook-Meldung waehrend des Laufs', () => {
  /** Simuliert den Webhook: er schreibt letzte_meldung, waehrend der Lauf das Geruest nachzieht. */
  function meldungImGeruest(t) {
    const rpc = t.supabase.rpc.bind(t.supabase);
    t.supabase.rpc = async (name, args) => {
      if (name === 'ablage_geruest_offen') {
        t.uhr.t += 1000;
        t.supabase.db.ablage_stand[0].letzte_meldung = iso(t.uhr.t);
      }
      return rpc(name, args);
    };
  }

  it('Meldung nach dem letzten Delta-Lesen -> mehr, der Background-Lauf stoesst sich neu an', async () => {
    const t = setup();
    meldungImGeruest(t);

    const r = await t.a.lauf();

    expect(r).toMatchObject({ lease: true, mehr: true });
    expect(t.supabase.db.ablage_stand[0].lease_bis).toBeNull();
  });

  it('Meldung vor dem Lauf ist vom Delta abgedeckt -> kein weiterer Lauf', async () => {
    const t = setup();
    t.supabase.db.ablage_stand[0].letzte_meldung = iso(START - 1000);

    const r = await t.a.lauf();

    expect(r.mehr).toBeUndefined();
  });

  it('Meldung waehrend des Nachlaufs liest das naechste Delta mit -> kein weiterer Lauf', async () => {
    const t = setup({ abgleich: { ruheSek: 20, nachlaufSek: 25 } });
    const { ordner: variante } = await t.ordner.zielOrdner(videoZiel());
    const f = t.sp.datei(variante.item_id, 'frisch.mov', 500);
    t.seite([await t.meldung(f.id, { lastModifiedDateTime: iso(t.uhr.t - 5000) })]);
    t.uhr.beimSchlafen = async () => {
      t.uhr.beimSchlafen = null;
      t.supabase.db.ablage_stand[0].letzte_meldung = iso(t.uhr.t);
    };

    const r = await t.a.lauf();

    expect(r).toMatchObject({ neu: 1, eingang: { erledigt: 1 } });
    expect(r.mehr).toBeUndefined();
  });
});
