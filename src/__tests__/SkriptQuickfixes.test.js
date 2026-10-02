// Regressionen aus dem Skript-Audit: Master/Grid-Definition, Umfang vs.
// Festgezogen, Bundle im Verlauf, Produktvarianten-Sektion.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { istMasterSkript } from '../modules/skripte/master/skriptMasterFormat.js';

const require = createRequire(import.meta.url);
const {
  buildEditPrompt, filtereFestgezogen
} = require('../../netlify/functions/_shared/skript-edit-prompt.js');
const {
  zusatzInfosMarkdown, istMasterDokument
} = require('../../netlify/functions/_shared/skript-creator-facing.js');

const GRID_UND_MD = {
  id: 's1',
  titel: 'Morgen',
  hook: 'Kennst du das?',
  hauptteil: 'Sie greift zum Serum.',
  cta: 'Link in der Bio.',
  inhalt_md: '## Produktvarianten im Bild\nSerum 30 ml und 50 ml sichtbar.',
  bereich: 'influencer_marketing',
  prompt_kontext: {}
};

function ctx(history = []) {
  return {
    skript: { ...GRID_UND_MD },
    history,
    rueckfragen: '',
    kontext: { master: [], briefing: null },
    modus: null
  };
}

describe('Master-Dokument vs. Grid', () => {
  it('Grid plus inhalt_md ist kein Master-Dokument', () => {
    expect(istMasterDokument(GRID_UND_MD)).toBe(false);
    expect(istMasterSkript(GRID_UND_MD)).toBe(false);
  });

  it('reines inhalt_md ist ein Master-Dokument', () => {
    expect(istMasterDokument({ inhalt_md: '## A\nX' })).toBe(true);
    expect(istMasterSkript({ inhalt_md: '## A\nX' })).toBe(true);
  });

  it('freier Chat, sektion gesamt, Grid plus inhalt_md: UMFANG statt FORMAT', () => {
    const { task } = buildEditPrompt(ctx(), { aktion: 'chat', sektion: 'gesamt', inhalt: 'Mach alles lockerer' });
    expect(task).toContain('# UMFANG');
    expect(task).not.toContain('# FORMAT');
    expect(task).toContain('umfang_sektion');
  });
});

describe('filtereFestgezogen', () => {
  const bundle = [
    { sektion: 'hook', spalte: 'gesprochen', vorschlag_text: 'H' },
    { sektion: 'hauptteil', spalte: 'gesprochen', vorschlag_text: 'T' },
    { sektion: 'cta', spalte: 'visuell', vorschlag_text: 'V' }
  ];
  const gezogen = ['hook', 'cta_visuell'];

  it('alles: nichts wird verworfen', () => {
    const r = filtereFestgezogen(bundle, gezogen, { umfang: 'alles' });
    expect(r.behalten).toHaveLength(3);
    expect(r.verworfen).toHaveLength(0);
  });

  it('teil: festgezogene Zellen der genannten Sektion bleiben', () => {
    const r = filtereFestgezogen(bundle, gezogen, { umfang: 'teil', umfang_sektion: 'hook' });
    expect(r.behalten.map((a) => a.sektion)).toEqual(['hook', 'hauptteil']);
    expect(r.verworfen.map((a) => a.sektion)).toEqual(['cta']);
  });

  it.each([['markierung'], ['keiner'], [null]])('%s: alle festgezogenen Zellen raus', (umfang) => {
    const r = filtereFestgezogen(bundle, gezogen, { umfang });
    expect(r.behalten.map((a) => a.sektion)).toEqual(['hauptteil']);
    expect(r.verworfen).toHaveLength(2);
  });

  it('ohne festgezogene Zellen bleibt alles', () => {
    const r = filtereFestgezogen(bundle, [], { umfang: 'keiner' });
    expect(r.behalten).toHaveLength(3);
  });
});

describe('Bundle im Verlauf', () => {
  it('Assistant-Turn mit aenderungen steht im History-Text', () => {
    const history = [
      { rolle: 'user', inhalt: 'Lockerer bitte', status: 'done' },
      {
        rolle: 'assistant',
        inhalt: 'Habe zwei Zellen angepasst.',
        status: 'done',
        aenderungen: [
          { sektion: 'hook', spalte: 'gesprochen', vorschlag_text: 'Neuer Hook' },
          { sektion: 'cta', spalte: 'visuell', vorschlag_text: 'Neues Visual' }
        ]
      },
      { rolle: 'user', inhalt: 'Und jetzt?', status: 'done' }
    ];
    const { messages } = buildEditPrompt(ctx(history), { aktion: 'chat', sektion: 'gesamt', inhalt: 'Weiter' });
    const text = messages.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
    expect(text).toContain('Neuer Hook');
    expect(text).toContain('Neues Visual');
  });
});

describe('Varianten-Sektion', () => {
  it('"Produktvarianten im Bild" bleibt in den Zusatzinfos', () => {
    expect(zusatzInfosMarkdown(GRID_UND_MD.inhalt_md)).toContain('Produktvarianten im Bild');
  });

  it('echte Varianten-Sektionen fliegen raus', () => {
    const md = '## B. Variantenübersicht\nA/B\n\n## Alternative Opener\nX\n\n## Setting\nKüche\n';
    const out = zusatzInfosMarkdown(md);
    expect(out).not.toContain('Variantenübersicht');
    expect(out).not.toContain('Alternative Opener');
    expect(out).toContain('Setting');
  });
});
