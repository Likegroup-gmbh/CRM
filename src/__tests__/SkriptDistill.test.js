import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildDistillMaterial,
  DISTILL_SYSTEM_TEXT
} = require('../../netlify/functions/skript-distill-background.js');

describe('DISTILL_SYSTEM_TEXT', () => {
  it('fordert Abschnitt Visuell in der DNA-Struktur', () => {
    expect(DISTILL_SYSTEM_TEXT).toContain('Visuell');
    expect(DISTILL_SYSTEM_TEXT).toContain('Was zu sehen ist');
    expect(DISTILL_SYSTEM_TEXT).toContain('Hook, Hauptteil, CTA, Visuell, Tonalitaet, Anti-Patterns');
  });
});

describe('buildDistillMaterial', () => {
  it('nimmt Visual-Text mit, skippt unbewertete ohne Feedback', () => {
    const material = buildDistillMaterial([
      {
        id: 's1',
        titel: 'Glow',
        hook: 'Kennst du das?',
        hook_visuell: 'Visual 1: Dose in den Müll.',
        hauptteil: 'Serum.',
        cta: 'Link.',
        performance_label: 'erfolgreich'
      },
      {
        id: 's2',
        titel: 'Ignorieren',
        hook: 'Leer',
        performance_label: 'unbewertet'
      }
    ], {});

    expect(material).toContain('Skript "Glow"');
    expect(material).toContain('HOOK (was zu sehen ist): Visual 1: Dose in den Müll.');
    expect(material).not.toContain('Ignorieren');
  });

  it('haengt Feedback und Performance-Notiz an', () => {
    const material = buildDistillMaterial([{
      id: 's1',
      titel: 'X',
      hook: 'A',
      performance_label: 'viral',
      performance_notiz: 'CTR 4%'
    }], {
      s1: [{ sektion: 'hook', score: 4, begruendung: 'stark', korrigierte_version: 'Besserer Hook' }]
    });

    expect(material).toContain('PERFORMANCE-NOTIZ: CTR 4%');
    expect(material).toContain('FEEDBACK [hook] Score 4/5: stark');
    expect(material).toContain('KORRIGIERT [hook]: Besserer Hook');
  });
});
