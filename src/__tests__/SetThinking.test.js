// SetThinking.test.js
// Backend-Helper: appendStep + setThinking schreibt nur bei offenem Status.

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { appendStep, setThinking } = require('../../netlify/functions/_shared/thinking.js');

describe('appendStep', () => {
  it('haengt an und ersetzt gleichen letzten step', () => {
    expect(appendStep([], { step: 'a', label: 'Eins' })).toEqual([{ step: 'a', label: 'Eins' }]);
    expect(appendStep([{ step: 'a', label: 'Eins' }], { step: 'a', label: 'Neu' }))
      .toEqual([{ step: 'a', label: 'Neu' }]);
    expect(appendStep([{ step: 'a', label: 'Eins' }], { step: 'b', label: 'Zwei' }))
      .toEqual([{ step: 'a', label: 'Eins' }, { step: 'b', label: 'Zwei' }]);
  });

  it('ignoriert unvollstaendige Items', () => {
    expect(appendStep([{ step: 'a', label: 'Eins' }], { step: '', label: 'x' }))
      .toEqual([{ step: 'a', label: 'Eins' }]);
  });
});

function makeSupabase(row) {
  const chain = {};
  chain.select = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  return { from: vi.fn(() => chain), chain };
}

describe('setThinking', () => {
  it('appended an offene Row', async () => {
    const sb = makeSupabase({ status: 'running', progress_steps: [{ step: 'pending', label: 'Warte' }] });
    const result = await setThinking(sb, 'skript_chat_messages', 'm1', {
      step: 'kontext',
      label: 'Ich lese Skript und Kontext…'
    });
    expect(result).toEqual({ status: 'running', progress_steps: [{ step: 'pending', label: 'Warte' }] });
    expect(sb.from).toHaveBeenCalledWith('skript_chat_messages');
    expect(sb.chain.update).toHaveBeenCalledWith({
      progress_steps: [
        { step: 'pending', label: 'Warte' },
        { step: 'kontext', label: 'Ich lese Skript und Kontext…' }
      ]
    });
    expect(sb.chain.in).toHaveBeenCalledWith('status', ['pending', 'running']);
  });

  it('schreibt nicht, wenn Status geschlossen', async () => {
    const sb = makeSupabase({ status: 'fertig', progress_steps: [] });
    expect(await setThinking(sb, 'skript_chat_messages', 'm1', { step: 'x', label: 'y' })).toBeNull();
    expect(sb.chain.update).not.toHaveBeenCalled();
  });
});

describe('createJobUpdater.step schreibt progress_steps', () => {
  it('packt label aus msg in denselben Patch', async () => {
    const { createJobUpdater } = require('../../netlify/functions/_shared/job-updater.js');
    const chain = {};
    chain.update = vi.fn(() => chain);
    chain.eq = vi.fn(async () => ({ error: null }));
    const sb = { from: vi.fn(() => chain) };
    const job = createJobUpdater(sb, 'j1');
    job.step('kontext', 'Ich sammle den Kontext aus den CRM-Daten…');
    await job.flushAndUpdate({ status: 'done' });
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      progress_step: 'kontext',
      progress_steps: [{ step: 'kontext', label: 'Ich sammle den Kontext aus den CRM-Daten…' }],
      status: 'running'
    }));
  });
});
