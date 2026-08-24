// ChatThinking.test.js
// thinkingHtml ist dumm: Liste rein, Markup raus. Keine Flow-Kataloge.

import { describe, it, expect } from 'vitest';
import {
  thinkingHtml, normalizeSteps, pushStep, pendingThinking, DEFAULT_STEP
} from '../core/chat/thinking.js';

describe('normalizeSteps / pushStep', () => {
  it('leere Liste faellt auf Default-Schritt zurueck', () => {
    expect(normalizeSteps(null)).toEqual([DEFAULT_STEP]);
    expect(normalizeSteps([])).toEqual([DEFAULT_STEP]);
    expect(normalizeSteps([{ step: '', label: '' }])).toEqual([DEFAULT_STEP]);
  });

  it('haengt an, ersetzt Label bei gleichem letztem step', () => {
    const once = pushStep([], { step: 'a', label: 'Eins' });
    expect(once).toEqual([{ step: 'a', label: 'Eins' }]);
    const same = pushStep(once, { step: 'a', label: 'Eins neu' });
    expect(same).toEqual([{ step: 'a', label: 'Eins neu' }]);
    const next = pushStep(same, { step: 'b', label: 'Zwei' });
    expect(next).toEqual([
      { step: 'a', label: 'Eins neu' },
      { step: 'b', label: 'Zwei' }
    ]);
  });
});

describe('thinkingHtml', () => {
  it('letztes Item ist aktiv, Rest done', () => {
    const html = thinkingHtml([
      { step: 'kontext', label: 'Ich lese Skript und Kontext…' },
      { step: 'schreiben', label: 'Ich formuliere den Vorschlag…' }
    ]);
    expect(html).toContain('chat-thinking');
    expect(html).toContain('Ich lese Skript und Kontext');
    expect(html).toContain('Ich formuliere den Vorschlag');
    expect(html.match(/chat-thinking__step/g)).toHaveLength(2);
    expect(html.match(/is-active/g)).toHaveLength(1);
    expect(html.indexOf('is-active')).toBeGreaterThan(html.indexOf('Ich lese'));
    expect(html).toContain('<i></i><i></i><i></i>');
  });

  it('leere Liste zeigt Default, escaped Labels', () => {
    const empty = thinkingHtml([]);
    expect(empty).toContain('Ich arbeite gerade');
    expect(empty).toContain('is-active');

    const xss = thinkingHtml([{ step: 'x', label: '<img src=x onerror=1>' }]);
    expect(xss).toContain('&lt;img src=x onerror=1&gt;');
    expect(xss).not.toContain('<img src=x');
  });

  it('done: alle Schritte erledigt, keiner aktiv', () => {
    const html = thinkingHtml(
      [{ step: 'start', label: 'Ich schaue mir die Seite an' }],
      { done: true }
    );
    expect(html).toContain('Ich schaue mir die Seite an');
    expect(html).not.toContain('is-active');
  });

  it('pendingThinking liefert den Client-Startschritt', () => {
    expect(pendingThinking()).toEqual([
      { step: 'pending', label: 'Auftrag ist unterwegs…' }
    ]);
  });
});
