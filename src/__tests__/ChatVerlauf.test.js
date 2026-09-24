// verlaufZuMessages: ein Verlauf fuer alle Chatboards.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { verlaufZuMessages } = require('../../netlify/functions/_shared/chat-verlauf.js');

describe('verlaufZuMessages', () => {
  it('verwirft fuehrende Assistant-Turns und zieht gleiche Rollen zusammen', () => {
    const messages = verlaufZuMessages([
      { rolle: 'assistant', inhalt: 'zu frueh' },
      { rolle: 'user', inhalt: 'eins' },
      { rolle: 'user', inhalt: 'zwei' },
      { rolle: 'assistant', inhalt: 'ok' }
    ], { task: 'jetzt' });
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(messages[0].content).toBe('eins\n\nzwei');
    expect(messages[2].content).toBe('jetzt');
  });

  it('mappt liky auf assistant', () => {
    const messages = verlaufZuMessages([
      { rolle: 'user', inhalt: 'hi' },
      { rolle: 'liky', inhalt: 'hallo' }
    ], { task: 'weiter' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'hallo' });
  });

  it('haengt task an einen letzten User-Turn', () => {
    const messages = verlaufZuMessages([
      { rolle: 'user', inhalt: 'eins' }
    ], { task: 'auftrag' });
    expect(messages).toEqual([{ role: 'user', content: 'eins\n\nauftrag' }]);
  });

  it('leerer Verlauf ist eine User-Message mit dem Auftrag', () => {
    expect(verlaufZuMessages([], { task: 'nur' })).toEqual([{ role: 'user', content: 'nur' }]);
  });

  it('format haengt den Vorschlag an und laesst pending weg', () => {
    const messages = verlaufZuMessages([
      { rolle: 'user', inhalt: 'neu' },
      { rolle: 'assistant', status: 'pending', inhalt: 'warte', vorschlag_text: 'weg' },
      { rolle: 'assistant', status: 'vorschlag', inhalt: 'ja', vorschlag_text: 'Hook B' }
    ], {
      task: 'nochmal',
      format: (row) => {
        if (!row || row.status === 'pending') return null;
        if (row.rolle === 'user') return { role: 'user', content: row.inhalt };
        return { role: 'assistant', content: `Vorschlag:\n${row.vorschlag_text}` };
      }
    });
    expect(messages[1].content).toBe('Vorschlag:\nHook B');
    expect(messages.some((m) => String(m.content).includes('weg'))).toBe(false);
  });

  it('dropTrailingUser entfernt die aktuelle User-Zeile', () => {
    const messages = verlaufZuMessages([
      { rolle: 'user', inhalt: 'alt' },
      { rolle: 'assistant', inhalt: 'ok' },
      { rolle: 'user', inhalt: 'neu' }
    ], { task: 'User: neu', dropTrailingUser: 'neu' });
    expect(messages[0].content).toBe('alt');
    expect(messages[2].content).toBe('User: neu');
  });

  it('limit schneidet von hinten', () => {
    const messages = verlaufZuMessages([
      { rolle: 'user', inhalt: 'a' },
      { rolle: 'assistant', inhalt: 'b' },
      { rolle: 'user', inhalt: 'c' },
      { rolle: 'assistant', inhalt: 'd' }
    ], { task: 'e', limit: 2 });
    expect(messages[0].content).toBe('c');
    expect(messages[1].content).toBe('d');
    expect(messages[2].content).toBe('e');
  });
});
