// BriefingAuswertungFunction.test.js
// Reine Function-Logik: Ziel-Entity (Marke vor Unternehmen), Merge der
// KI-Sektionen (notizen bleiben) und Prompt-Auftrag.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  resolveZielEntity,
  mergeKiSektionen,
  buildPrompt
} = require('../../netlify/functions/briefing-auswertung-background.js');

describe('resolveZielEntity', () => {
  it('nimmt die Marke, wenn gesetzt', () => {
    expect(resolveZielEntity({ marke_id: 'm1', unternehmen_id: 'u1' }))
      .toEqual({ entityType: 'marke', entityId: 'm1' });
  });

  it('faellt auf das Unternehmen zurueck', () => {
    expect(resolveZielEntity({ marke_id: null, unternehmen_id: 'u1' }))
      .toEqual({ entityType: 'unternehmen', entityId: 'u1' });
  });

  it('liefert null ohne Ziel', () => {
    expect(resolveZielEntity({})).toBe(null);
    expect(resolveZielEntity(null)).toBe(null);
  });
});

describe('mergeKiSektionen', () => {
  it('ersetzt nur die vier KI-Sektionen, notizen bleiben', () => {
    const merged = mergeKiSektionen(
      {
        kampagnenstrategie: 'alt',
        todos: 'alt',
        notizen: 'Bitte nicht anfassen',
        extra: 'bleibt'
      },
      {
        kampagnenstrategie: 'neu',
        todos: '  todo  ',
        offene_punkte: 'offen',
        empfehlungen: 'empfehl'
      }
    );

    expect(merged.kampagnenstrategie).toBe('neu');
    expect(merged.todos).toBe('todo');
    expect(merged.offene_punkte).toBe('offen');
    expect(merged.empfehlungen).toBe('empfehl');
    expect(merged.notizen).toBe('Bitte nicht anfassen');
    expect(merged.extra).toBe('bleibt');
  });
});

describe('buildPrompt', () => {
  it('verlangt die vier Tool-Sektionen und nimmt den Briefing-Text auf', () => {
    const { stable, task } = buildPrompt({
      briefingText: '\n# CAMPAIGN-BRIEFING\n- Name: Summer Glow\n',
      firma: 'Acme',
      marke: 'Glow',
      branche: 'Beauty',
      beschreibung: 'Serum'
    });

    expect(stable).toContain('Nichts erfinden');
    expect(task).toContain('briefing_auswertung_abgeben');
    expect(task).toContain('Unternehmen: Acme');
    expect(task).toContain('Marke: Glow');
    expect(task).toContain('Branche: Beauty');
    expect(task).toContain('Summer Glow');
    expect(task).toContain('kampagnenstrategie');
    expect(task).toContain('todos');
    expect(task).toContain('offene_punkte');
    expect(task).toContain('empfehlungen');
  });
});
