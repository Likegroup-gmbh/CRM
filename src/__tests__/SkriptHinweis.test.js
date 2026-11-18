// Hinweise für Liky aus dem Create-Drawer (ADR 0073).

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { docxAlsText, docxBilder, DOCX_TEXT_MAX } from '../modules/skripte/upload/docxAlsText.js';

vi.mock('../modules/skripte/upload/liesDocx.js', () => ({
  liesDocx: vi.fn(async () => [
    { typ: 'h1', md: 'Skript 1' },
    { typ: 'tabelle', zeilen: [['Hook', '**Eins**']], bilder: [] },
    { typ: 'h1', md: 'Skript 2' },
    { typ: 'tabelle', zeilen: [['Hook', 'Zwei']], bilder: [{ blob: new Blob(['x'], { type: 'image/png' }) }] }
  ])
}));

const { skripteUploadDatenMethoden } = await import('../modules/skripte/service/skripteUploadDaten.js');
const require = createRequire(import.meta.url);
const { buildKontextText } = require('../../netlify/functions/_shared/skript-context.js');
const { liesAuftrag, wordBildBloecke } = require('../../netlify/functions/skript-upload-pdf-background.js');

describe('Hinweis in Rückfragen und Erstellung', () => {
  it('steht abgegrenzt im Kontext', () => {
    const text = buildKontextText({}, { video_idee: 'Morgenroutine', hinweis: 'Creator spricht Englisch' });
    expect(text).toContain('<hinweis_team>\nCreator spricht Englisch\n</hinweis_team>');
    expect(text).toContain('fragst du nicht noch einmal');
  });

  it('ohne Hinweis keine Sektion', () => {
    expect(buildKontextText({}, { video_idee: 'x' })).not.toContain('hinweis_team');
  });
});

describe('Hinweis beim Lesen der Datei', () => {
  it('Word-Text und Hinweis stehen im Auftrag an Liky', () => {
    const prompt = liesAuftrag({ text: '| Hook | Zwei |', hinweis: ' Nur Skript 2 ' });
    expect(prompt).toContain('<dokument>\n| Hook | Zwei |\n</dokument>');
    expect(prompt).toContain('<hinweis>\nNur Skript 2\n</hinweis>');
  });

  it('PDF ohne Hinweis bleibt der kurze Auftrag', () => {
    expect(liesAuftrag({ text: '', hinweis: '' })).not.toMatch(/dokument|HINWEIS/);
  });

  it('übernimmt nur Bilder dieses Skripts', () => {
    const bloecke = wordBildBloecke('sk-1', ['sk-1/a.png', 'sk-2/b.png', 'sk-1/../x.png', 7]);
    expect(bloecke.map((b) => b.pfad)).toEqual(['sk-1/a.png']);
  });
});

describe('Word als Text', () => {
  const teile = [
    { typ: 'h1', md: 'Skript 2' },
    { typ: 'tabelle', zeilen: [['Hook', '**Achtung** a|b\nzweite']], bilder: [{ blob: 'B1' }] },
    { typ: 'liste', punkte: ['eins', 'zwei'] },
    { typ: 'bild', blob: 'B2' }
  ];

  it('behält Fett, Tabellen und Listen', () => {
    expect(docxAlsText(teile)).toBe('# Skript 2\n\n| Hook | **Achtung** a\\|b / zweite |\n\n- eins\n- zwei');
  });

  it('sammelt Bilder aus Tabellen und Absätzen', () => {
    expect(docxBilder(teile)).toEqual(['B1', 'B2']);
  });

  it('zu lange Dateien gibt es nur ohne Hinweis', () => {
    expect(() => docxAlsText([{ typ: 'absatz', md: 'x'.repeat(DOCX_TEXT_MAX + 1) }])).toThrow('zu lang');
  });
});

function service() {
  const db = {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { prompt_kontext: { upload_status: 'fertig' } }, error: null }) })
      })
    }))
  };
  return Object.assign(Object.create(null), skripteUploadDatenMethoden, {
    db,
    _insertUploadSkript: vi.fn(async () => ({ id: 'sk-1' })),
    _schreibeUploadBloecke: vi.fn(async () => {}),
    _schreibeUploadVersion: vi.fn(async () => {}),
    uploadSkriptBild: vi.fn(async (id) => `${id}/bild.png`),
    triggerFunction: vi.fn(async () => {})
  });
}

const docx = () => new File(['PK'], 'Skripte.docx', {
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
});

describe('Word-Upload mit Hinweis', () => {
  it('geht über Liky und schreibt selbst keine Zellen', async () => {
    const s = service();
    const datei = docx();
    datei.arrayBuffer = async () => new ArrayBuffer(2);
    await s.createSkriptAusUpload({ file: datei, payload: {}, hinweis: 'Nur Skript 2' });
    expect(s._insertUploadSkript).toHaveBeenCalledWith(expect.objectContaining({ statusLesen: true, zellen: {} }));
    expect(s._schreibeUploadBloecke).not.toHaveBeenCalled();
    const [funktion, body] = s.triggerFunction.mock.calls[0];
    expect(funktion).toBe('skript-upload-pdf-background');
    expect(body).toMatchObject({ skriptId: 'sk-1', hinweis: 'Nur Skript 2', bildPfade: ['sk-1/bild.png'] });
    expect(body.text).toContain('| Hook | Zwei |');
  });

  it('ohne Hinweis bleibt die genaue Übernahme', async () => {
    const s = service();
    const datei = docx();
    datei.arrayBuffer = async () => new ArrayBuffer(2);
    await s.createSkriptAusUpload({ file: datei, payload: {}, hinweis: '  ' });
    expect(s.triggerFunction).not.toHaveBeenCalled();
    expect(s._schreibeUploadVersion).toHaveBeenCalled();
  });
});
