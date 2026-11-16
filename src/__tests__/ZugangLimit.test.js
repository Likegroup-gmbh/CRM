import { describe, it, expect } from 'vitest';
import {
  CODE_MAX_PRO_IP,
  CODE_MAX_PRO_TOKEN,
  SHARE_VERIFY,
  codeVersucheGesperrt,
  einladungBereich,
  merkeVersuch,
  vergesseVersuch,
  zaehleVersuche,
} from '../../supabase/functions/_shared/zugang/limit.ts';

/** In-Memory-Fake für from(tabelle) mit eq/gte/lt, insert, delete und count. */
function fakeAdmin() {
  const tabellen = {};
  let naechsteId = 1;
  const rows = (t) => (tabellen[t] ||= []);

  function query(t) {
    const filter = [];
    let modus = 'select';
    const q = {
      select() { return q; },
      delete() { modus = 'delete'; return q; },
      eq(spalte, wert) { filter.push((r) => r[spalte] === wert); return q; },
      gte(spalte, wert) { filter.push((r) => r[spalte] >= wert); return q; },
      lt(spalte, wert) { filter.push((r) => r[spalte] < wert); return q; },
      insert(zeile) {
        const neu = { id: `v${naechsteId++}`, attempted_at: new Date().toISOString(), ...zeile };
        rows(t).push(neu);
        return { select: () => ({ maybeSingle: async () => ({ data: { id: neu.id } }) }) };
      },
      then(resolve) {
        const treffer = rows(t).filter((r) => filter.every((f) => f(r)));
        if (modus === 'delete') {
          tabellen[t] = rows(t).filter((r) => !treffer.includes(r));
          return resolve({ error: null });
        }
        return resolve({ count: treffer.length });
      },
    };
    return q;
  }

  return { from: (t) => query(t), rows };
}

describe('zugang/limit', () => {
  it('sperrt nach 5 Versuchen von derselben IP', async () => {
    const admin = fakeAdmin();
    for (let i = 0; i < CODE_MAX_PRO_IP; i += 1) await merkeVersuch(admin, SHARE_VERIFY, 's1', '1.1.1.1');
    expect(await codeVersucheGesperrt(admin, SHARE_VERIFY, 's1', '1.1.1.1')).toBe(true);
    expect(await codeVersucheGesperrt(admin, SHARE_VERIFY, 's1', '2.2.2.2')).toBe(false);
  });

  it('sperrt pro Token auch bei wechselnden IPs', async () => {
    const admin = fakeAdmin();
    for (let i = 0; i < CODE_MAX_PRO_TOKEN; i += 1) await merkeVersuch(admin, SHARE_VERIFY, 's1', `9.9.9.${i}`);
    expect(await codeVersucheGesperrt(admin, SHARE_VERIFY, 's1', '8.8.8.8')).toBe(true);
    expect(await codeVersucheGesperrt(admin, SHARE_VERIFY, 's2', '8.8.8.8')).toBe(false);
  });

  it('ein richtiger Code zählt nicht mit', async () => {
    const admin = fakeAdmin();
    const id = await merkeVersuch(admin, SHARE_VERIFY, 's1', '1.1.1.1');
    await vergesseVersuch(admin, SHARE_VERIFY, id);
    expect(await zaehleVersuche(admin, SHARE_VERIFY, 's1', 15)).toBe(0);
  });

  it('trennt bei Einladungen nach Aktion', async () => {
    const admin = fakeAdmin();
    await merkeVersuch(admin, einladungBereich('upload'), 'e1', '1.1.1.1');
    expect(await zaehleVersuche(admin, einladungBereich('upload'), 'e1', 60)).toBe(1);
    expect(await zaehleVersuche(admin, einladungBereich('verify'), 'e1', 60)).toBe(0);
    expect(admin.rows('einladung_verify_attempts')[0]).toMatchObject({ einladung_id: 'e1', aktion: 'upload' });
  });
});
