import { describe, it, expect } from 'vitest';
import { visuellGuardGrund, visuellDisabled } from '../modules/skripte/editor/skriptEditorVisuellHelfer.js';

const skript = {
  hook: 'Kennst du das?',
  hauptteil: 'Ich zeig dir was.',
  cta: 'Link in Bio.',
  hook_visuell: 'Close-up'
};

describe('visuellGuardGrund', () => {
  it('gibt null, wenn alles frei ist', () => {
    expect(visuellGuardGrund(skript, 'hauptteil', { messages: [] })).toBeNull();
  });

  it('readonly blockiert ohne weiteren Grund', () => {
    expect(visuellGuardGrund(skript, 'hook', { readonly: true })).toBe('readonly');
    expect(visuellGuardGrund(null, 'hook', {})).toBe('readonly');
  });

  it('unbekannte Sektion blockiert', () => {
    expect(visuellGuardGrund(skript, 'intro', {})).toBe('sektion');
  });

  it('leerer gesprochener Text blockiert', () => {
    expect(visuellGuardGrund({ ...skript, cta: '  ' }, 'cta', {})).toBe('leer');
  });

  it('fehlendes Vorgaenger-Visual blockiert die Kette', () => {
    // hauptteil braucht hook_visuell, cta braucht hauptteil_visuell
    expect(visuellGuardGrund({ ...skript, hook_visuell: '' }, 'hauptteil', {})).toBe('vorgaenger');
    expect(visuellGuardGrund(skript, 'cta', {})).toBe('vorgaenger');
  });

  it('laufende Visual-Message der Sektion blockiert', () => {
    const messages = [{ aktion: 'visuell', sektion: 'hook', status: 'running' }];
    expect(visuellGuardGrund(skript, 'hook', { messages })).toBe('laeuft');
    // andere Sektion / anderer Status blockiert nicht
    expect(visuellGuardGrund(skript, 'hauptteil', { messages })).toBeNull();
    expect(visuellGuardGrund(skript, 'hook', {
      messages: [{ aktion: 'visuell', sektion: 'hook', status: 'fertig' }]
    })).toBeNull();
  });

  it('visuellDisabled ist die boolesche Sicht desselben Guards', () => {
    expect(visuellDisabled(skript, 'hook', {})).toBe(false);
    expect(visuellDisabled(skript, 'hook', { readonly: true })).toBe(true);
  });
});
