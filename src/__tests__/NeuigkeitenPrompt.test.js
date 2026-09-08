import { describe, it, expect } from 'vitest';
import { sanitizeTitel, sanitizeKurztext, NEUIGKEIT_TOOL, TITEL_MAX, KURZTEXT_MAX } from '../../scripts/neuigkeiten/prompt.cjs';

describe('neuigkeiten/prompt – sanitizeTitel', () => {
  it('trimmt und gibt den Text zurueck', () => {
    expect(sanitizeTitel('  Ordner für Personas  ')).toBe('Ordner für Personas');
  });

  it('kappt auf die Maximallaenge', () => {
    expect(sanitizeTitel('x'.repeat(200))).toHaveLength(TITEL_MAX);
  });

  it('gibt null bei Leere oder Nicht-Strings zurueck', () => {
    expect(sanitizeTitel('')).toBeNull();
    expect(sanitizeTitel('   ')).toBeNull();
    expect(sanitizeTitel(null)).toBeNull();
    expect(sanitizeTitel(undefined)).toBeNull();
    expect(sanitizeTitel(42)).toBeNull();
  });
});

describe('neuigkeiten/prompt – sanitizeKurztext', () => {
  it('trimmt und gibt den Text zurueck', () => {
    expect(sanitizeKurztext('  Du findest Personas jetzt im Ordner.  ')).toBe('Du findest Personas jetzt im Ordner.');
  });

  it('kappt auf die Maximallaenge', () => {
    expect(sanitizeKurztext('x'.repeat(800))).toHaveLength(KURZTEXT_MAX);
  });

  it('gibt null bei Leere oder Nicht-Strings zurueck', () => {
    expect(sanitizeKurztext('')).toBeNull();
    expect(sanitizeKurztext(null)).toBeNull();
    expect(sanitizeKurztext(['liste'])).toBeNull();
  });
});

describe('neuigkeiten/prompt – Tool-Schema', () => {
  it('kennt nur noch titel und kurztext neben user_relevant', () => {
    const props = Object.keys(NEUIGKEIT_TOOL.input_schema.properties);
    expect(props).toEqual(['user_relevant', 'titel', 'kurztext']);
    expect(NEUIGKEIT_TOOL.input_schema.required).toEqual(['user_relevant']);
  });
});
