// SkriptNachrichtSchreiben.test.js
// Server-Sicherheitsnetz fuer Chat-Auftraege (Edit/Fragen):
// - schreibeNachricht prueft { error } (supabase-js wirft nicht) und retried
// - Abbruch durch den Nutzer wird nie ueberschrieben (nurWennStatus)
// - eine geclaimte Message bleibt nach dem Lauf nie auf 'running' haengen

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  schreibeNachricht, markiereNachrichtFehler, sichereNachrichtAbgeschlossen
} = require('../../netlify/functions/_shared/skript-auftrag.js');

/**
 * In-Memory-Fake fuer skript_chat_messages. updateFehler(patch, versuch)
 * liefert ein Fehlerobjekt oder null (Update scheitert dann ohne Wurf,
 * wie in supabase-js).
 */
function makeSupabase(message, { updateFehler = null } = {}) {
  const db = { msg: { ...message }, updates: [] };

  const builder = (table) => {
    const state = { op: 'select', patch: null, filters: [] };
    const passt = () => table === 'skript_chat_messages' && state.filters.every((f) => f(db.msg));
    const run = (einzeln) => {
      if (table === 'ki_requests') {
        return state.op === 'insert'
          ? { data: { id: 'k1' }, error: null }
          : { data: null, count: 0, error: null };
      }
      if (table !== 'skript_chat_messages') return { data: null, error: null };
      if (state.op === 'update') {
        db.updates.push(state.patch);
        const fehler = updateFehler?.(state.patch, db.updates.length);
        if (fehler) return { data: null, error: fehler };
        if (!passt()) return einzeln ? { data: null, error: null } : { data: [], error: null };
        Object.assign(db.msg, state.patch);
        return einzeln ? { data: { ...db.msg }, error: null } : { data: [{ id: db.msg.id }], error: null };
      }
      return { data: passt() ? { ...db.msg } : null, error: null };
    };
    const b = {
      select: () => b,
      update: (patch) => { state.op = 'update'; state.patch = patch; return b; },
      insert: () => { state.op = 'insert'; return b; },
      eq: (spalte, wert) => { state.filters.push((r) => r[spalte] === wert); return b; },
      in: (spalte, werte) => { state.filters.push((r) => werte.includes(r[spalte])); return b; },
      gte: () => b,
      maybeSingle: async () => run(true),
      single: async () => run(true),
      then: (resolve, reject) => Promise.resolve(run(false)).then(resolve, reject)
    };
    return b;
  };

  return { from: vi.fn((table) => builder(table)), rpc: vi.fn(async () => ({ data: true, error: null })), db };
}

const nachricht = (status) => ({
  id: 'm1', skript_id: 's1', rolle: 'assistant', aktion: 'rueckfrage', status, inhalt: 'Anweisung'
});

describe('schreibeNachricht', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('schreibt und meldet true', async () => {
    const sb = makeSupabase(nachricht('running'));
    await expect(schreibeNachricht(sb, 'm1', { status: 'fertig', inhalt: 'ok' })).resolves.toBe(true);
    expect(sb.db.msg.status).toBe('fertig');
  });

  it('Fehler beim ersten Versuch: Retry schreibt trotzdem', async () => {
    const sb = makeSupabase(nachricht('running'), {
      updateFehler: (_patch, versuch) => (versuch === 1 ? { message: 'connection reset' } : null)
    });
    await expect(schreibeNachricht(sb, 'm1', { status: 'fertig' }, { pauseMs: 0 })).resolves.toBe(true);
    expect(sb.db.updates).toHaveLength(2);
    expect(sb.db.msg.status).toBe('fertig');
  });

  it('Fehler bei allen Versuchen: wirft (statt still zu verpuffen)', async () => {
    const sb = makeSupabase(nachricht('running'), { updateFehler: () => ({ message: 'db down' }) });
    await expect(schreibeNachricht(sb, 'm1', { status: 'fertig' }, { pauseMs: 0 }))
      .rejects.toThrow('db down');
  });

  it('nurWennStatus: cancelled wird nicht ueberschrieben (false)', async () => {
    const sb = makeSupabase(nachricht('cancelled'));
    await expect(schreibeNachricht(sb, 'm1', { status: 'fertig', inhalt: 'zu spaet' }, { nurWennStatus: 'running' }))
      .resolves.toBe(false);
    expect(sb.db.msg.status).toBe('cancelled');
    expect(sb.db.msg.inhalt).toBe('Anweisung');
  });
});

describe('markiereNachrichtFehler', () => {
  it('setzt offene Messages auf error', async () => {
    const sb = makeSupabase(nachricht('running'));
    await markiereNachrichtFehler(sb, 'm1', 'kaputt');
    expect(sb.db.msg).toMatchObject({ status: 'error', error_message: 'kaputt' });
  });

  it('ueberschreibt weder Abbruch noch fertiges Ergebnis', async () => {
    for (const status of ['cancelled', 'fertig', 'vorschlag']) {
      const sb = makeSupabase(nachricht(status));
      await expect(markiereNachrichtFehler(sb, 'm1', 'kaputt')).resolves.toBe(false);
      expect(sb.db.msg.status).toBe(status);
    }
  });
});

describe('sichereNachrichtAbgeschlossen (finally-Netz)', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('Message noch running -> error mit Retry-Hinweis', async () => {
    const sb = makeSupabase(nachricht('running'));
    await expect(sichereNachrichtAbgeschlossen(sb, 'm1')).resolves.toBe(true);
    expect(sb.db.msg.status).toBe('error');
    expect(sb.db.msg.error_message).toMatch(/nochmal versuchen/i);
  });

  it('fertige oder abgebrochene Message bleibt unberuehrt', async () => {
    for (const status of ['fertig', 'vorschlag', 'cancelled', 'error']) {
      const sb = makeSupabase(nachricht(status));
      await expect(sichereNachrichtAbgeschlossen(sb, 'm1')).resolves.toBe(false);
      expect(sb.db.msg.status).toBe(status);
      expect(sb.db.updates).toHaveLength(0);
    }
  });

  it('wirft nie, auch wenn das Netz selbst scheitert', async () => {
    const sb = makeSupabase(nachricht('running'), { updateFehler: () => ({ message: 'db down' }) });
    vi.useFakeTimers();
    const lauf = sichereNachrichtAbgeschlossen(sb, 'm1');
    await vi.runAllTimersAsync();
    await expect(lauf).resolves.toBe(false);
    vi.useRealTimers();
  });
});

describe('skript-fragen-background: Fehlerpfad endet nie auf running', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('Fehler nach dem Claim (Skript fehlt) -> Message steht auf error', async () => {
    const { _verarbeiteRueckfrage } = require('../../netlify/functions/skript-fragen-background.js');
    const sb = makeSupabase(nachricht('pending'));

    const res = await _verarbeiteRueckfrage({ supabase: sb, user: { id: 'u1' }, payload: { messageId: 'm1' } });

    expect(res.statusCode).toBe(500);
    expect(sb.db.msg.status).toBe('error');
    expect(sb.db.msg.error_message).toContain('Skript nicht gefunden');
  });

  it('Fehlerstatus scheitert beim ersten Versuch: Retry setzt trotzdem error', async () => {
    const { _verarbeiteRueckfrage } = require('../../netlify/functions/skript-fragen-background.js');
    let fehlerVersuche = 0;
    const sb = makeSupabase(nachricht('pending'), {
      updateFehler: (patch) => (patch.status === 'error' && ++fehlerVersuche === 1 ? { message: 'reset' } : null)
    });

    await _verarbeiteRueckfrage({ supabase: sb, user: { id: 'u1' }, payload: { messageId: 'm1' } });

    expect(sb.db.msg.status).toBe('error');
  });
});
