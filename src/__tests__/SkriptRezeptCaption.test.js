// @vitest-environment jsdom
// Rezept, Text-Hook und Caption: Anzeige, Aufbau-Toggles, Versionen.
import { describe, it, expect } from 'vitest';
import {
  fragenModusHtml, skriptDocHtml, vorgabenPanelHtml
} from '../modules/skripte/editor/SkriptEditorDocRenderer.js';
import { planeVersionsRows } from '../modules/skripte/versionsNummerierung.js';
import { skriptStand } from '../modules/skripte/editor/skriptEditorVisuellHelfer.js';

const BASIS = { titel: 'T', hook: 'A', hauptteil: 'M', cta: 'E' };
const doc = (skript) => skriptDocHtml({
  skript, messages: [], isReadonly: false, docHeadActionsHtml: '', vorgabenPanelHtml: ''
});

describe('Rezept, Text-Hook, Caption im Renderer', () => {
  it('zeigt keine Zusatzzeilen ohne Flag und ohne Inhalt', () => {
    const html = doc(BASIS);
    expect(html).not.toContain('data-sektion="rezept"');
    expect(html).not.toContain('data-sektion="caption"');
    expect(html).not.toContain('data-feld="text_hook"');
  });

  it('zeigt Rezept, Caption und Text-Hook bei gesetzten Flags (leer = editierbar)', () => {
    const html = doc({
      ...BASIS,
      prompt_kontext: { generator_payload: { mit_rezept: true, mit_text_hook: true, mit_caption: true } }
    });
    expect(html).toContain('data-feld="rezept"');
    expect(html).toContain('data-feld="caption"');
    expect(html).toContain('data-feld="text_hook"');
    expect(html).toContain('colspan="2"');
    expect(html).toContain('skripte-editor-tabelle-zusatz');
  });

  it('zeigt gespeicherten Inhalt auch ohne Flag (Meggle-Fall)', () => {
    const html = doc({ ...BASIS, rezept: '**Zutaten**\n- 250 g Makkaroni', caption: 'Heute: Mac and Cheese' });
    expect(html).toContain('data-feld="rezept"');
    expect(html).toContain('250 g Makkaroni');
    expect(html).toContain('Mac and Cheese');
  });

  it('zeigt das Rezept auch in der Kundenansicht (readonly)', () => {
    const html = skriptDocHtml({
      skript: { ...BASIS, rezept: '200 g Mehl' },
      messages: [], isReadonly: true, docHeadActionsHtml: '', vorgabenPanelHtml: ''
    });
    expect(html).toContain('data-sektion="rezept"');
    expect(html).toContain('200 g Mehl');
  });

  it('fragenModusHtml hat die drei Aufbau-Toggles und behaelt den Generieren-Button', () => {
    const html = fragenModusHtml({
      skript: { prompt_kontext: { generator_payload: { mit_rezept: true } } },
      genStatus: null, docHeadActionsHtml: '', vorgabenPanelHtml: ''
    });
    expect(html).toContain('data-aufbau-flag="mit_rezept"');
    expect(html).toContain('data-aufbau-flag="mit_text_hook"');
    expect(html).toContain('data-aufbau-flag="mit_caption"');
    expect(html).toContain('id="ed-fragen-gen"');
    const rezept = html.match(/<input[^>]*data-aufbau-flag="mit_rezept"[^>]*>/)?.[0] || '';
    const caption = html.match(/<input[^>]*data-aufbau-flag="mit_caption"[^>]*>/)?.[0] || '';
    expect(rezept).toContain('checked');
    expect(caption).not.toContain('checked');
  });

  it('fragenModusHtml deaktiviert die Toggles waehrend der Generierung', () => {
    const html = fragenModusHtml({
      skript: {}, genStatus: { laeuft: true }, docHeadActionsHtml: '', vorgabenPanelHtml: ''
    });
    const toggle = html.match(/<input[^>]*data-aufbau-flag="mit_rezept"[^>]*>/)?.[0] || '';
    expect(toggle).toContain('disabled');
  });

  it('Vorgaben-Panel nennt die gewaehlten Aufbau-Optionen', () => {
    const html = vorgabenPanelHtml({
      unternehmen: { firmenname: 'X' },
      prompt_kontext: { generator_payload: { mit_rezept: true, mit_caption: true } }
    });
    expect(html).toContain('Rezept unter dem CTA');
    expect(html).toContain('Caption');
    expect(html).not.toContain('Text-Hook');
  });
});

describe('Rezept, Text-Hook, Caption in Versionen', () => {
  it('skriptStand enthaelt die drei Felder', () => {
    const s = skriptStand({ rezept: 'R', text_hook: 'H', caption: 'C' });
    expect(s).toMatchObject({ rezept: 'R', text_hook: 'H', caption: 'C' });
  });

  it('Version-Snapshot uebernimmt Rezept, Text-Hook und Caption', () => {
    const { rows } = planeVersionsRows({
      versionen: [{ version_nr: 1, sub_nr: 0 }],
      skript: { id: 's1', ...BASIS, rezept: 'R', text_hook: 'H', caption: 'C' },
      beschreibung: 'x'
    });
    expect(rows[0]).toMatchObject({ rezept: 'R', text_hook: 'H', caption: 'C' });
  });
});
