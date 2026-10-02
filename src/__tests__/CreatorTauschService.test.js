import { describe, it, expect, beforeEach } from 'vitest';
import {
  tauscheCreator,
  findeAlterEintragFuerSkript,
  creatorName
} from '../modules/creator-tausch/CreatorTauschService.js';

/** Minimaler Supabase-Fake: jede Query loest mit dem naechsten Eintrag aus `antworten`. */
function fakeDb(antworten, rpcAntwort) {
  const calls = [];
  const builder = (tabelle) => {
    const q = { tabelle, ops: [] };
    const proxy = new Proxy({}, {
      get(_, op) {
        if (op === 'then') {
          return (res) => res(antworten.shift() ?? { data: null, error: null });
        }
        return (...args) => { q.ops.push([op, ...args]); return proxy; };
      }
    });
    calls.push(q);
    return proxy;
  };
  return {
    calls,
    from: builder,
    rpc: async (name, args) => { calls.push({ rpc: name, args }); return rpcAntwort; }
  };
}

describe('tauscheCreator', () => {
  beforeEach(() => { delete window.supabase; });

  it('ruft die RPC mit getrimmtem Grund', async () => {
    window.supabase = fakeDb([], { data: { videoideen: 2 }, error: null });
    const res = await tauscheCreator({ alterItemId: 'a', ersatzItemId: 'b', grund: '  krank ' });
    expect(res).toEqual({ videoideen: 2 });
    expect(window.supabase.calls[0]).toEqual({
      rpc: 'creator_tausch',
      args: { p_alter_item: 'a', p_ersatz_item: 'b', p_grund: 'krank' }
    });
  });

  it('uebersetzt einen Sperrgrund in einen lesbaren Fehler', async () => {
    window.supabase = fakeDb([], { data: null, error: { message: 'tausch_gesperrt:rechnung' } });
    await expect(tauscheCreator({ alterItemId: 'a', ersatzItemId: 'b' }))
      .rejects.toThrow(/Rechnung/);
  });

  it('reicht andere Fehler unveraendert durch', async () => {
    window.supabase = fakeDb([], { data: null, error: { message: 'boom' } });
    await expect(tauscheCreator({ alterItemId: 'a', ersatzItemId: 'b' })).rejects.toThrow('boom');
  });
});

describe('findeAlterEintragFuerSkript', () => {
  it('nimmt zuerst den Eintrag der Videoidee', async () => {
    window.supabase = fakeDb([{ data: { creator_auswahl_item_id: 'item-1' }, error: null }]);
    const id = await findeAlterEintragFuerSkript({ strategie_item_id: 's1', produktion_id: 'p' }, []);
    expect(id).toBe('item-1');
  });

  it('faellt auf Kooperation-Creator und Produktion zurueck', async () => {
    window.supabase = fakeDb([
      { data: { creator_auswahl_item_id: null }, error: null },
      { data: [{ id: 'item-2' }], error: null }
    ]);
    const id = await findeAlterEintragFuerSkript(
      { strategie_item_id: 's1', produktion_id: 'p' },
      [{ kooperation: { creator: { id: 'c1' } } }]
    );
    expect(id).toBe('item-2');
  });

  it('liefert null bei Altbestand ohne Eintrag', async () => {
    window.supabase = fakeDb([]);
    expect(await findeAlterEintragFuerSkript({ produktion_id: 'p' }, [])).toBeNull();
  });
});

describe('creatorName', () => {
  it('baut den Namen oder nimmt den Fallback', () => {
    expect(creatorName({ vorname: 'Mia', nachname: 'K' })).toBe('Mia K');
    expect(creatorName(null, 'X')).toBe('X');
  });
});
