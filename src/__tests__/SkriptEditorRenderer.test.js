// Tests fuer die puren Editor-Renderer (State rein, HTML-String raus).

import { describe, it, expect } from 'vitest';
import {
  messageHtml, genStatusBubbleHtml, aktionTagHtml, chatLeerHtml, versionsHinweisHtml
} from '../modules/skripte/editor/SkriptEditorChatRenderer.js';
import { neuModusHtml, fragenModusHtml, skriptDocHtml } from '../modules/skripte/editor/SkriptEditorDocRenderer.js';

describe('SkriptEditorChatRenderer', () => {
  it('User-Message rendert Inhalt und Selektion, escaped HTML', () => {
    const html = messageHtml({
      id: 'm1', rolle: 'user', aktion: 'chat',
      inhalt: 'Bitte <b>kuerzen</b>', selektion_text: 'Zitat "hier"'
    });
    expect(html).toContain('skripte-editor-msg--user');
    expect(html).toContain('data-msg-row="m1"');
    expect(html).toContain('Bitte &lt;b&gt;kuerzen&lt;/b&gt;');
    expect(html).toContain('Zitat &quot;hier&quot;');
    expect(html).not.toContain('<b>kuerzen</b>');
  });

  it('Assistant pending zeigt Arbeits-Indikator', () => {
    const html = messageHtml({ id: 'm2', rolle: 'assistant', status: 'running', aktion: 'chat' });
    expect(html).toContain('Ich arbeite gerade');
    expect(html).toContain('skripte-editor-dots');
  });

  it('Assistant error zeigt Fehlermeldung und Retry-Button', () => {
    const html = messageHtml({
      id: 'm3', rolle: 'assistant', status: 'error', aktion: 'chat', error_message: 'Kaputt'
    });
    expect(html).toContain('Fehler: Kaputt');
    expect(html).toContain('data-msg-action="retry"');
    expect(html).toContain('data-msg-id="m3"');
  });

  it('visuell-Vorschlag bekommt keine Annehmen/Ablehnen-Buttons', () => {
    const html = messageHtml({
      id: 'm-vis', rolle: 'assistant', status: 'vorschlag', aktion: 'visuell',
      sektion: 'hauptteil', inhalt: 'Visual fertig.', vorschlag_text: 'Close-up Pfanne'
    });
    expect(html).not.toContain('data-msg-action="accept"');
    expect(html).not.toContain('data-msg-action="reject"');
    expect(html).toContain('Visual wird automatisch übernommen');
    expect(html).toContain('Close-up Pfanne');
  });

  it('Vorschlag bekommt Annehmen/Ablehnen-Buttons', () => {
    const html = messageHtml({
      id: 'm4', rolle: 'assistant', status: 'vorschlag', aktion: 'kuerzen',
      sektion: 'hook', inhalt: 'Kuerzer.', vorschlag_text: 'Neuer Hook'
    });
    expect(html).toContain('data-msg-action="accept"');
    expect(html).toContain('data-msg-action="reject"');
    expect(html).toContain('Neuer Hook');
    expect(html).toContain('Kürzen');
  });

  it('Rueckfrage im Fragen-Modus zeigt Generieren-Button', () => {
    const html = messageHtml(
      { id: 'm5', rolle: 'assistant', status: 'vorschlag', aktion: 'rueckfrage', inhalt: 'Alles klar.' },
      { istFragenModus: true, genLaeuft: false }
    );
    expect(html).toContain('data-msg-action="generieren"');
    expect(html).toContain('Skript jetzt generieren');
  });

  it('Rueckfrage-Generieren-Button verschwindet waehrend Generierung', () => {
    const html = messageHtml(
      { id: 'm5', rolle: 'assistant', status: 'vorschlag', aktion: 'rueckfrage', inhalt: 'Alles klar.' },
      { istFragenModus: true, genLaeuft: true }
    );
    expect(html).not.toContain('data-msg-action="generieren"');
  });

  it('aktionTagHtml ignoriert chat-Aktion, labelt andere mit Sektion', () => {
    expect(aktionTagHtml({ aktion: 'chat' })).toBe('');
    expect(aktionTagHtml({})).toBe('');
    const tag = aktionTagHtml({ aktion: 'neu_schreiben', sektion: 'cta' });
    expect(tag).toContain('Neu schreiben');
    expect(tag).toContain('CTA');
  });

  it('genStatusBubbleHtml: laufend, Fehler, leer', () => {
    expect(genStatusBubbleHtml(null)).toBe('');
    expect(genStatusBubbleHtml({ laeuft: true, step: 'kontext' })).toContain('ed-gen-step');
    const err = genStatusBubbleHtml({ error: 'Boom' });
    expect(err).toContain('Fehler: Boom');
    expect(err).toContain('ed-gen-retry');
  });

  it('chatLeerHtml und versionsHinweisHtml', () => {
    expect(chatLeerHtml()).toContain('Noch kein Verlauf');
    expect(versionsHinweisHtml({ neuModus: true, versionen: [], aktiveVersion: null })).toBe('');
    const hinweis = versionsHinweisHtml({
      neuModus: false,
      versionen: [{ version_nr: 3, sub_nr: 0 }],
      aktiveVersion: { version_nr: 2, sub_nr: 1 }
    });
    expect(hinweis).toContain('v2.1');
    expect(hinweis).toContain('neueste: v3');
  });
});

describe('SkriptEditorDocRenderer', () => {
  it('neuModusHtml enthaelt Generator-Platzhalter und beide Start-Buttons', () => {
    const html = neuModusHtml();
    expect(html).toContain('id="ed-genform"');
    expect(html).toContain('id="ed-gen-start"');
    expect(html).toContain('id="ed-gen-direkt"');
  });

  it('fragenModusHtml zeigt Titel, Rueckfragen-Badge und Generieren-Button', () => {
    const html = fragenModusHtml({
      skript: { titel: 'Mein <Skript>' },
      genStatus: null,
      docHeadActionsHtml: '',
      vorgabenPanelHtml: '<div>Vorgaben</div>'
    });
    expect(html).toContain('Mein &lt;Skript&gt;');
    expect(html).toContain('Rückfragen');
    expect(html).toContain('id="ed-fragen-gen"');
    expect(html).toContain('<div>Vorgaben</div>');
  });

  it('fragenModusHtml deaktiviert den Button waehrend Generierung', () => {
    const html = fragenModusHtml({
      skript: {}, genStatus: { laeuft: true }, docHeadActionsHtml: '', vorgabenPanelHtml: ''
    });
    expect(html).toContain('disabled');
    expect(html).toContain('Läuft…');
  });

  it('skriptDocHtml rendert Sektionen mit gesprochenem Text', () => {
    const html = skriptDocHtml({
      skript: { titel: 'T', hook: 'Hook-Text', hauptteil: 'Mitte', cta: 'Ende' },
      messages: [],
      isReadonly: false,
      docHeadActionsHtml: '',
      vorgabenPanelHtml: ''
    });
    expect(html).toContain('Hook-Text');
    expect(html).toContain('Mitte');
    expect(html).toContain('Ende');
    expect(html).toContain('Was gesagt wird');
    expect(html).toContain('Was zu sehen ist');
  });
});
