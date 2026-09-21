import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildPrompt, SKRIPT_TOOL, buildErstgenerierungVersionRow } = require('../../netlify/functions/skript-generate-background.js');
const { resolveSkriptBereich, fmtMasterBlock } = require('../../netlify/functions/_shared/skript-master.js');
const { buildEditPrompt } = require('../../netlify/functions/skript-edit-background.js');

const MASTER = [
  { bereich: 'basis', name: 'Basis', version: 1, inhalt: '# Schutzregeln\nNichts erfinden.' },
  { bereich: 'owned_social', name: 'Owned', version: 2, inhalt: '## 1.14 Drehfertiger Aufbau\n## Produktionskopf\n## Hook-Paket' }
];

describe('resolveSkriptBereich', () => {
  it('params vor Briefing, nur erlaubte Werte', () => {
    expect(resolveSkriptBereich({ bereich: 'owned_social' }, { bereich: 'paid_creator_ads' }))
      .toBe('owned_social');
    expect(resolveSkriptBereich({}, { bereich: 'influencer_marketing' }))
      .toBe('influencer_marketing');
    expect(resolveSkriptBereich({ bereich: 'basis' }, { bereich: 'owned_social' }))
      .toBe('owned_social');
    expect(resolveSkriptBereich({}, {})).toBe(null);
  });
});

describe('buildPrompt Master + inhalt_md', () => {
  it('legt Master vor DNA und verlangt inhalt_md', () => {
    const { stable, task } = buildPrompt({
      dna: [{ name: 'Global', layer_typ: 'global', version: 1, inhalt: 'DNA-Regel' }],
      master: MASTER,
      bereich: 'owned_social'
    }, { video_idee: 'Airfryer' });

    expect(stable).toContain('MASTER-REGELWERK');
    expect(stable).toContain('Nichts erfinden.');
    expect(stable).toContain('Drehfertiger Aufbau');
    expect(stable.indexOf('MASTER-REGELWERK')).toBeLessThan(stable.indexOf('SKRIPT-DNA'));
    expect(stable).toContain('DNA-Regel');
    expect(task).toContain('inhalt_md');
    expect(task).toContain('hook, hauptteil, cta');
    expect(task).toContain('NICHT in inhalt_md');
    expect(task).toContain('hook_varianten');
    expect(task).not.toContain('Array "varianten"');
    expect(task).toContain('Owned Social');
    expect(task).toContain('ZEITMARKER');
    expect(task).toContain('Sek. 0–3');
    expect(stable).not.toContain('ERFOLGREICHE BEISPIEL');
    expect(stable).not.toContain('ANTI-PATTERNS');
  });

  it('nimmt keine fremden Beispiel-Skripte in den Prompt auf', () => {
    const { stable } = buildPrompt({
      dna: [],
      master: [],
      bereich: 'owned_social',
      beispiele: [{ titel: 'Viral-Hook', hook: 'DARF-NICHT', performance_label: 'viral' }],
      antiPatterns: [{ titel: 'Flop', hook: 'AUCH-NICHT', performance_label: 'nicht_erfolgreich' }]
    }, { video_idee: 'x' });
    expect(stable).not.toContain('DARF-NICHT');
    expect(stable).not.toContain('AUCH-NICHT');
    expect(stable).not.toContain('ERFOLGREICHE BEISPIEL');
    expect(stable).not.toContain('ANTI-PATTERNS');
  });

  it('injiziert Regie-Modus in den Task-Block', () => {
    const { stable, task } = buildPrompt({
      dna: [], master: [],
      bereich: 'paid_creator_ads',
      modus: { name: 'Dynamisch', inhalt: 'Schnelle Wechsel.' }
    }, { video_idee: 'x' });
    expect(task).toContain('REGIE-MODUS: Dynamisch');
    expect(task).toContain('Schnelle Wechsel.');
    expect(stable).not.toContain('Schnelle Wechsel.');
  });
});

describe('fmtMasterBlock', () => {
  it('ist leer ohne Docs, sonst versioniert', () => {
    expect(fmtMasterBlock([])).toBe('');
    expect(fmtMasterBlock(MASTER)).toContain('v1');
    expect(fmtMasterBlock(MASTER)).toContain('v2');
  });
});

describe('Generator Spoken-Hooks ohne Extra-Versionen', () => {
  it('Tool hat hook_varianten als String-Array, keine vollen Skript-Kopien', () => {
    expect(SKRIPT_TOOL.input_schema.properties.hook_varianten).toMatchObject({
      type: 'array',
      items: { type: 'string' }
    });
    expect(SKRIPT_TOOL.input_schema.properties.varianten).toBeUndefined();
  });

  it('Erstgenerierung schreibt Spoken-Hooks in v1, keine B/C-Rows', () => {
    const row = buildErstgenerierungVersionRow({
      skriptId: 's1',
      parsed: { titel: 'T' },
      felder: { hook: 'A', hauptteil: 'M', cta: 'C', hook_visuell: 'V' },
      hook_varianten: {
        hook_variante_1: 'Zweiter',
        hook_variante_2: 'Dritter',
        hook_variante_3: null
      },
      inhaltMd: '## Kopf',
      userId: 'u1'
    });
    expect(row.version_nr).toBe(1);
    expect(row.sub_nr).toBe(0);
    expect(row.hook_variante_1).toBe('Zweiter');
    expect(row.hook_variante_2).toBe('Dritter');
    expect(row.hook_variante_3).toBeNull();
    expect(row.hook).toBe('A');
    expect(row.hook_visuell).toBe('V');
    expect([row].map((r) => r.version_nr)).toEqual([1]);
  });
});

describe('buildEditPrompt Master-Dokument', () => {
  it('zeigt inhalt_md statt Hook/Hauptteil/CTA', () => {
    const { task } = buildEditPrompt({
      skript: { titel: 'Test', inhalt_md: '## Hook-Paket\nAudio: hi', prompt_kontext: {} },
      history: [],
      dna: [],
      briefing: null,
      master: MASTER
    }, { aktion: 'chat', sektion: 'hook-paket', inhalt: 'Kuerzer' });

    expect(task).toContain('## Hook-Paket');
    expect(task).not.toContain('HOOK:\n');
    expect(task).toContain('##-Sektionen');
  });

  it('hook_variante ist Grid-Sektion mit Spoken-Prompt, nicht Master', () => {
    const { task } = buildEditPrompt({
      skript: {
        titel: 'Test',
        hook: 'Haupt-Hook',
        hook_variante_1: 'Zweiter Einstieg',
        prompt_kontext: {}
      },
      history: [],
      dna: [],
      briefing: null,
      master: []
    }, { aktion: 'kuerzen', sektion: 'hook_variante_1', inhalt: '' });

    expect(task).toContain('HOOK-VARIANTEN');
    expect(task).toContain('Zweiter Einstieg');
    expect(task).toContain('Was gesagt wird');
    expect(task).not.toContain('##-Sektionen');
  });
});
