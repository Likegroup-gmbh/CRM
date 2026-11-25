// Sicht eines Mitarbeiterkontos auf die geteilte Liste (_shared/share-recipients-staff.ts).
import { describe, it, expect, vi } from 'vitest';
import { staffVisibility } from '../../supabase/functions/_shared/share-recipients-staff.ts';

/** Admin-Client mit Einzelzeilen (rows[table][id]), Zuordnungen (links[table]) und RPC-Antwort. */
function fakeAdmin({ rows = {}, links = {}, rpc = () => false } = {}) {
  const from = vi.fn((table) => {
    const filters = {};
    const builder = {
      select: () => builder,
      eq: (column, value) => { filters[column] = value; return builder; },
      in: (column, values) => Promise.resolve({
        data: (links[table] || []).filter((row) => (
          values.includes(row[column]) && Object.entries(filters).every(([c, v]) => row[c] === v)
        )),
        error: null,
      }),
      maybeSingle: () => Promise.resolve({ data: rows[table]?.[filters.id] ?? null, error: null }),
    };
    return builder;
  });
  return { from, rpc: vi.fn(async (_name, args) => ({ data: rpc(args), error: null })) };
}

const admin = { id: 'a1', rolle: 'admin', auth_user_id: 'au-a1' };
const ma1 = { id: 'm1', rolle: 'mitarbeiter', auth_user_id: 'au-m1' };
const ma2 = { id: 'm2', rolle: 'mitarbeiter', auth_user_id: 'au-m2' };

describe('staffVisibility', () => {
  it('Admins sehen jede Liste ohne Abfrage, nur kein Skript-Paket', async () => {
    const db = fakeAdmin();
    expect(await staffVisibility(db, [admin], 'kampagne', 'k1')).toEqual({ a1: true });
    expect(await staffVisibility(db, [admin], 'skript_paket', 'p1')).toEqual({ a1: false });
    expect(db.from).not.toHaveBeenCalled();
  });

  it('Sourcing und Strategie sehen alle Mitarbeiter', async () => {
    const db = fakeAdmin();
    expect(await staffVisibility(db, [ma1, ma2], 'sourcing', 'c1')).toEqual({ m1: true, m2: true });
    expect(await staffVisibility(db, [ma1], 'strategie', 's1')).toEqual({ m1: true });
  });

  it('Kampagne nur mit Zuordnung über Kampagne, Marke oder Unternehmen', async () => {
    const db = fakeAdmin({
      rows: { kampagne: { k1: { unternehmen_id: 'u1', marke_id: 'mk1' } } },
      links: {
        marke_mitarbeiter: [{ marke_id: 'mk1', mitarbeiter_id: 'm1' }, { marke_id: 'andere', mitarbeiter_id: 'm2' }],
        mitarbeiter_unternehmen: [{ unternehmen_id: 'u2', mitarbeiter_id: 'm2' }],
      },
    });
    expect(await staffVisibility(db, [ma1, ma2], 'kampagne', 'k1')).toEqual({ m1: true, m2: false });

    const direkt = fakeAdmin({
      rows: { kampagne: { k1: { unternehmen_id: 'u1', marke_id: null } } },
      links: { kampagne_mitarbeiter: [{ kampagne_id: 'k1', mitarbeiter_id: 'm2' }] },
    });
    expect(await staffVisibility(direkt, [ma1, ma2], 'kampagne', 'k1')).toEqual({ m1: false, m2: true });
  });

  it('Skript über can_mitarbeiter_access_skript_for mit der auth_user_id des Empfängers', async () => {
    const skript = { unternehmen_id: 'u1', marke_id: 'mk1', kampagne_id: 'k1', created_by: 'au-x' };
    const db = fakeAdmin({
      rows: { skripte: { sk1: skript } },
      rpc: (args) => args.p_auth_user_id === 'au-m2',
    });
    const ohneLogin = { id: 'm3', rolle: 'mitarbeiter', auth_user_id: null };
    expect(await staffVisibility(db, [ma1, ma2, ohneLogin], 'skript', 'sk1')).toEqual({ m1: false, m2: true, m3: false });
    expect(db.rpc).toHaveBeenCalledTimes(2);
    expect(db.rpc).toHaveBeenCalledWith('can_mitarbeiter_access_skript_for', {
      p_auth_user_id: 'au-m1',
      p_unternehmen_id: 'u1',
      p_marke_id: 'mk1',
      p_kampagne_id: 'k1',
      p_created_by: 'au-x',
    });
  });

  it('unbekannte Liste: niemand sieht sie', async () => {
    const db = fakeAdmin();
    expect(await staffVisibility(db, [ma1], 'kampagne', 'fehlt')).toEqual({ m1: false });
  });
});
