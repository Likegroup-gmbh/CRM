// SkriptNachrichtClaim.test.js
// beansprucheNachricht: atomarer Claim pending -> running auf Chat-Messages.
// Macht Netlify-Auto-Retry (nach 502/503 am Gateway) und doppelte
// Client-Invokes idempotent: der zweite Lauf bekommt null und no-opt mit 409.

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { beansprucheNachricht } = require('../../netlify/functions/_shared/skript-auftrag.js');

function makeSupabase(terminal) {
  const chain = {};
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => terminal);
  return { from: vi.fn(() => chain), chain };
}

describe('beansprucheNachricht', () => {
  it('claimed eine pending Assistant-Message atomar und liefert die Row', async () => {
    const row = { id: 'm1', skript_id: 's1', rolle: 'assistant', status: 'running' };
    const sb = makeSupabase({ data: row, error: null });

    const result = await beansprucheNachricht(sb, 'm1');

    expect(result).toEqual(row);
    expect(sb.from).toHaveBeenCalledWith('skript_chat_messages');
    expect(sb.chain.update).toHaveBeenCalledWith({ status: 'running' });
    expect(sb.chain.eq).toHaveBeenCalledWith('id', 'm1');
    expect(sb.chain.eq).toHaveBeenCalledWith('rolle', 'assistant');
    expect(sb.chain.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('liefert null, wenn die Message schon claimed oder beendet ist', async () => {
    const sb = makeSupabase({ data: null, error: null });

    expect(await beansprucheNachricht(sb, 'm1')).toBeNull();
  });

  it('wirft bei DB-Fehler (landet als error_status im Catch der Function)', async () => {
    const sb = makeSupabase({ data: null, error: { message: 'db down' } });

    await expect(beansprucheNachricht(sb, 'm1')).rejects.toThrow('db down');
  });
});

describe('skript-fragen-background: Claim-Race', () => {
  it('bereits geclaimte Message -> 409, bevor KI-Log, Kontext oder Claude laufen', async () => {
    const { _verarbeiteRueckfrage } = require('../../netlify/functions/skript-fragen-background.js');

    // Message existiert und gehoert dem User (rpc true), ist aber schon
    // running: der Claim (update ... where status='pending') greift nicht
    const chain = {};
    chain.select = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn(async () => ({
      data: { id: 'm1', skript_id: 's1', rolle: 'assistant', status: 'running' },
      error: null
    }));
    chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const supabase = {
      from: vi.fn(() => chain),
      rpc: vi.fn(async () => ({ data: true, error: null }))
    };

    const res = await _verarbeiteRueckfrage({ supabase, user: { id: 'u1' }, payload: { messageId: 'm1' } });

    expect(res.statusCode).toBe(409);
    // Nur die Message-Tabelle angefasst (Select + Claim): kein Skript-/
    // Kontext-Load, kein KI-Request-Log. Claude waere ohne API-Key als
    // 500 statt 409 sichtbar geworden.
    const tabellen = supabase.from.mock.calls.map((c) => c[0]);
    expect(new Set(tabellen)).toEqual(new Set(['skript_chat_messages']));
  });
});
