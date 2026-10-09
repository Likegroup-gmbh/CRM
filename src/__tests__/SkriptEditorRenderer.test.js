// Tests fuer die puren Editor-Renderer (State rein, HTML-String raus).

import { describe, it, expect } from 'vitest';
import {
  messageHtml, genStatusBubbleHtml, aktionTagHtml, chatLeerHtml, versionsHinweisHtml
} from '../modules/skripte/editor/SkriptEditorChatRenderer.js';
import { fragenModusHtml, skriptDocHtml, masterDocHtml, verknuepfungenHtml, konzeptCreatorFromSkript, docHeadActionsHtml, listeVideoHtml, sortListeSkripte } from '../modules/skripte/editor/SkriptEditorDocRenderer.js';

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

  it('Assistant pending zeigt Thinking-Liste, Default wenn leer', () => {
    const html = messageHtml({ id: 'm2', rolle: 'assistant', status: 'running', aktion: 'chat' });
    expect(html).toContain('Ich arbeite gerade');
    expect(html).toContain('chat-thinking');

    const withSteps = messageHtml({
      id: 'm2', rolle: 'assistant', status: 'running', aktion: 'chat',
      progress_steps: [
        { step: 'kontext', label: 'Ich lese Skript und Kontext…' },
        { step: 'schreiben', label: 'Ich formuliere den Vorschlag…' }
      ]
    });
    expect(withSteps).toContain('Ich lese Skript und Kontext');
    expect(withSteps).toContain('Ich formuliere den Vorschlag');
    expect(withSteps).toContain('is-active');
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
    expect(tag).toContain('Neu formulieren');
    expect(tag).toContain('CTA');
  });

  it('genStatusBubbleHtml: laufend, Fehler, leer', () => {
    expect(genStatusBubbleHtml(null)).toBe('');
    const running = genStatusBubbleHtml({
      laeuft: true,
      progress_steps: [{ step: 'kontext', label: 'Ich sammle den Kontext aus den CRM-Daten…' }]
    });
    expect(running).toContain('ed-gen-thinking');
    expect(running).toContain('Ich sammle den Kontext');
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
  it('fragenModusHtml zeigt Titel, Rueckfragen-Badge und Aufbau-Toggles statt Generieren-Button', () => {
    const html = fragenModusHtml({
      skript: { titel: 'Mein <Skript>' },
      genStatus: null,
      docHeadActionsHtml: '',
      vorgabenPanelHtml: '<div>Vorgaben</div>'
    });
    expect(html).toContain('Mein &lt;Skript&gt;');
    expect(html).toContain('Rückfragen');
    expect(html).not.toContain('id="ed-fragen-gen"');
    expect(html).toContain('data-aufbau-flag="mit_rezept"');
    expect(html).toContain('data-aufbau-flag="mit_text_hook"');
    expect(html).toContain('<div>Vorgaben</div>');
    expect(html).not.toContain('skripte-actions-row--sticky');
  });

  it('fragenModusHtml spiegelt gesetzte Aufbau-Flags aus dem generator_payload', () => {
    const html = fragenModusHtml({
      skript: { prompt_kontext: { generator_payload: { mit_rezept: true, mit_text_hook: false } } },
      genStatus: null, docHeadActionsHtml: '', vorgabenPanelHtml: ''
    });
    const rezept = html.match(/<input[^>]*data-aufbau-flag="mit_rezept"[^>]*>/)?.[0] || '';
    const textHook = html.match(/<input[^>]*data-aufbau-flag="mit_text_hook"[^>]*>/)?.[0] || '';
    expect(rezept).toContain('checked');
    expect(textHook).not.toContain('checked');
  });

  it('fragenModusHtml deaktiviert die Toggles waehrend Generierung', () => {
    const html = fragenModusHtml({
      skript: {}, genStatus: { laeuft: true }, docHeadActionsHtml: '', vorgabenPanelHtml: ''
    });
    expect(html).toContain('disabled');
    expect(html).not.toContain('id="ed-fragen-gen"');
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

  it('skriptDocHtml mit Creator-facing fuellt Grid und Zusatz-Tab', () => {
    const html = skriptDocHtml({
      skript: {
        titel: 'Ninja',
        inhalt_md: '## Kopf\nMeta\n\n## Creator-facing Skript (links gesprochen, rechts zu sehen)\n\n'
          + '| LINKS: Was gesprochen wird | RECHTS: Was zu sehen ist |\n| --- | --- |\n'
          + '| „Klein, aber oho.“ | Sek. 0–6: Karton. |\n'
          + '| *ASMR Schublade* | Sek. 10–20: Pommes. |\n'
          + '| „Passt.“ | Sek. 27–30: Endframe. |\n',
        hook: '„Klein, aber oho.“',
        hauptteil: '*ASMR Schublade*',
        cta: '„Passt.“',
        hook_visuell: 'Sek. 0–6: Karton.',
        hauptteil_visuell: 'Sek. 10–20: Pommes.',
        cta_visuell: 'Sek. 27–30: Endframe.'
      },
      messages: [],
      isReadonly: false,
      docHeadActionsHtml: '',
      vorgabenPanelHtml: ''
    });
    expect(html).toContain('Was gesagt wird');
    expect(html).toContain('Klein, aber oho');
    expect(html).toContain('Sek. 0–6');
    expect(html).toContain('Zusätzliche Infos');
    expect(html).toContain('tab-navigation');
    expect(html).toContain('data-editor-tab="zusatz"');
    expect(html).toContain('Kopf');
    expect(html).not.toContain('Creator-facing');
  });

  it('skriptDocHtml zeigt Hook-Varianten intern nur wenn befuellt', () => {
    const leer = skriptDocHtml({
      skript: { titel: 'T', hook: 'A', hauptteil: 'M', cta: 'E' },
      messages: [], isReadonly: false, docHeadActionsHtml: '', vorgabenPanelHtml: '',
      zeigeHookVarianten: true
    });
    expect(leer).not.toContain('Hook-Varianten');
    expect(leer).not.toContain('data-feld="hook_variante_1"');

    const html = skriptDocHtml({
      skript: { titel: 'T', hook: 'A', hauptteil: 'M', cta: 'E', hook_variante_1: 'Zweiter Einstieg' },
      messages: [], isReadonly: false, docHeadActionsHtml: '', vorgabenPanelHtml: '',
      zeigeHookVarianten: true
    });
    expect(html).toContain('Hook-Varianten');
    expect(html).toContain('Zweiter Einstieg');
    expect(html).toContain('data-feld="hook_variante_1"');
    expect(html).toContain('Was gesagt wird');
  });

  it('skriptDocHtml blendet Hook-Varianten bei readonly aus', () => {
    const html = skriptDocHtml({
      skript: { titel: 'T', hook: 'A', hauptteil: 'M', cta: 'E', hook_variante_1: 'Zweiter' },
      messages: [], isReadonly: true, docHeadActionsHtml: '', vorgabenPanelHtml: '',
      zeigeHookVarianten: false
    });
    expect(html).not.toContain('Hook-Varianten');
    expect(html).not.toContain('Zweiter');
  });

  it('skriptDocHtml zeigt Rezept-Zeile und Text-Hook nur bei Flag oder Inhalt', () => {
    const basis = { titel: 'T', hook: 'A', hauptteil: 'M', cta: 'E' };
    const ohne = skriptDocHtml({
      skript: { ...basis },
      messages: [], isReadonly: false, docHeadActionsHtml: '', vorgabenPanelHtml: ''
    });
    expect(ohne).not.toContain('data-sektion="rezept"');
    expect(ohne).not.toContain('data-feld="text_hook"');

    const mitFlags = skriptDocHtml({
      skript: { ...basis, prompt_kontext: { generator_payload: { mit_rezept: true, mit_text_hook: true } } },
      messages: [], isReadonly: false, docHeadActionsHtml: '', vorgabenPanelHtml: ''
    });
    expect(mitFlags).toContain('data-sektion="rezept"');
    expect(mitFlags).toContain('colspan="2"');
    expect(mitFlags).toContain('data-feld="rezept"');
    expect(mitFlags).toContain('data-feld="text_hook"');
    expect(mitFlags).toContain('Text-Hook');

    const mitInhalt = skriptDocHtml({
      skript: { ...basis, rezept: '200g Mehl', text_hook: 'Nur 3 Zutaten' },
      messages: [], isReadonly: false, docHeadActionsHtml: '', vorgabenPanelHtml: ''
    });
    expect(mitInhalt).toContain('200g Mehl');
    expect(mitInhalt).toContain('Nur 3 Zutaten');
  });

  it('skriptDocHtml zeigt die Caption-Zeile nur bei Flag oder Inhalt', () => {
    const basis = { titel: 'T', hook: 'A', hauptteil: 'M', cta: 'E' };
    const render = (skript) => skriptDocHtml({
      skript, messages: [], isReadonly: false, docHeadActionsHtml: '', vorgabenPanelHtml: ''
    });
    expect(render({ ...basis })).not.toContain('data-feld="caption"');

    const mitFlag = render({ ...basis, prompt_kontext: { generator_payload: { mit_caption: true } } });
    expect(mitFlag).toContain('data-sektion="caption"');
    expect(mitFlag).toContain('data-feld="caption"');
    expect(mitFlag).toContain('skripte-editor-tabelle-zusatz');

    expect(render({ ...basis, caption: 'Heute gibt es Brot' })).toContain('Heute gibt es Brot');
  });

  it('fragenModusHtml bietet den Caption-Toggle an', () => {
    const html = fragenModusHtml({
      skript: { prompt_kontext: { generator_payload: { mit_caption: true } } },
      genStatus: null, docHeadActionsHtml: '', vorgabenPanelHtml: ''
    });
    const caption = html.match(/<input[^>]*data-aufbau-flag="mit_caption"[^>]*>/)?.[0] || '';
    expect(caption).toContain('checked');
  });

  it('skriptDocHtml wechselt bei inhalt_md auf Markdown-Sektionen', () => {
    const html = skriptDocHtml({
      skript: { titel: 'T', inhalt_md: '## Produktionskopf\nArbeitstitel: X' },
      messages: [],
      isReadonly: false,
      docHeadActionsHtml: '',
      vorgabenPanelHtml: ''
    });
    expect(html).toContain('Produktionskopf');
    expect(html).toContain('data-sektion="produktionskopf"');
    expect(html).not.toContain('Was gesagt wird');
  });

  it('masterDocHtml rendert Tabellen', () => {
    const html = masterDocHtml({
      skript: { titel: 'Paid', inhalt_md: '## Body\n| L | R |\n| --- | --- |\n| gesagt | gesehen |' },
      docHeadActionsHtml: '',
      vorgabenPanelHtml: ''
    });
    expect(html).toContain('<table');
    expect(html).toContain('gesagt');
  });
});

describe('verknuepfungenHtml', () => {
  it('ohne Creator: CTA Creator zuweisen', () => {
    const html = verknuepfungenHtml({ kannZuweisen: true });
    expect(html).toContain('Creator zuweisen');
    expect(html).toContain('id="ed-skript-zuweisen"');
    expect(html).toContain('skripte-editor-zuweisen-btn');
    expect(html).not.toContain('skripte-editor-zuweisen-chip');
  });

  it('Video-Creator: Chip mit Name, kein CTA', () => {
    const html = verknuepfungenHtml({
      kannZuweisen: true,
      verknuepfungen: [{
        kooperation: { creator: { id: 'c1', vorname: 'Anna', nachname: 'Meyer' } }
      }]
    });
    expect(html).toContain('Anna Meyer');
    expect(html).toContain('skripte-editor-zuweisen-chip');
    expect(html).not.toContain('Creator zuweisen');
  });

  it('nur Konzept-Creator: Chip mit Name, kein CTA', () => {
    const html = verknuepfungenHtml({
      kannZuweisen: true,
      konzeptCreator: { vorname: 'Tim', nachname: 'Berg', name: 'Tim Berg' }
    });
    expect(html).toContain('Tim Berg');
    expect(html).toContain('skripte-editor-zuweisen-chip');
    expect(html).not.toContain('Creator zuweisen');
  });

  it('Video-Creator schlaegt Konzept-Creator', () => {
    const html = verknuepfungenHtml({
      kannZuweisen: true,
      verknuepfungen: [{
        kooperation: { creator: { id: 'c1', vorname: 'Anna', nachname: 'Meyer' } }
      }],
      konzeptCreator: { vorname: 'Tim', nachname: 'Berg', name: 'Tim Berg' }
    });
    expect(html).toContain('Anna Meyer');
    expect(html).not.toContain('Tim Berg');
  });

  it('Video-Chip zeigt Position/Anzahl neben dem Creator-Chip', () => {
    const html = verknuepfungenHtml({
      kannZuweisen: true,
      verknuepfungen: [{
        position: 2,
        kooperation: { videoanzahl: 4, creator: { id: 'c1', vorname: 'Anna', nachname: 'Meyer' } }
      }]
    });
    expect(html).toContain('skripte-editor-video-chip');
    expect(html).toContain('Video 2/4');
    expect(html.indexOf('skripte-editor-zuweisen-chip')).toBeLessThan(html.indexOf('skripte-editor-video-chip'));
  });

  it('Video-Chip ohne videoanzahl nur mit Position', () => {
    const html = verknuepfungenHtml({
      kannZuweisen: true,
      verknuepfungen: [{
        position: 3,
        kooperation: { creator: { id: 'c1', vorname: 'Anna', nachname: 'Meyer' } }
      }]
    });
    expect(html).toContain('Video 3<');
  });

  it('kein Video-Chip beim reinen Konzept-Creator', () => {
    const html = verknuepfungenHtml({
      kannZuweisen: true,
      konzeptCreator: { vorname: 'Tim', nachname: 'Berg', name: 'Tim Berg' }
    });
    expect(html).not.toContain('skripte-editor-video-chip');
  });

  it('ohne kannZuweisen leer', () => {
    expect(verknuepfungenHtml({
      kannZuweisen: false,
      konzeptCreator: { name: 'Tim Berg' }
    })).toBe('');
  });
});

describe('listeVideoHtml', () => {
  it('baut "Video 2/4", mehrere Videos kommagetrennt', () => {
    const html = listeVideoHtml([
      { position: 2, kooperation: { videoanzahl: 4 } },
      { position: 3, kooperation: { videoanzahl: 4 } }
    ]);
    expect(html).toContain('skripte-editor-liste-video');
    expect(html).toContain('Video 2/4, Video 3/4');
  });

  it('ohne Position oder Verknuepfung leer, ohne Anzahl nur "Video 2"', () => {
    expect(listeVideoHtml([])).toBe('');
    expect(listeVideoHtml(undefined)).toBe('');
    expect(listeVideoHtml([{ position: null, kooperation: { videoanzahl: 3 } }])).toBe('');
    expect(listeVideoHtml([{ position: 2, kooperation: {} }])).toContain('>Video 2<');
  });
});

describe('sortListeSkripte', () => {
  const video = (name, position) => ([{
    position,
    kooperation: { videoanzahl: 3, creator: { id: name, vorname: name, nachname: '' } }
  }]);
  const skript = (id, name, position) => ({
    id,
    kooperation_videos: name ? video(name, position) : []
  });
  const ids = (list) => list.map((s) => s.id);
  const sortiere = (list) => sortListeSkripte(list, (s) => s.kooperation_videos);

  it('gruppiert nach Creator A-Z, darin Video 1, 2, 3', () => {
    const sorted = sortiere([
      skript('b3', 'Bea', 3), skript('a2', 'Anna', 2),
      skript('b1', 'Bea', 1), skript('a1', 'Anna', 1),
      skript('b2', 'Bea', 2), skript('a3', 'Anna', 3)
    ]);
    expect(ids(sorted)).toEqual(['a1', 'a2', 'a3', 'b1', 'b2', 'b3']);
  });

  it('ohne Creator ans Ende, ohne Nummer hinter die nummerierten, sonst stabil', () => {
    const sorted = sortiere([
      skript('frei1', null), skript('a-ohne', 'Anna', null),
      skript('a2', 'Anna', 2), skript('frei2', null), skript('a1', 'Anna', 1)
    ]);
    expect(ids(sorted)).toEqual(['a1', 'a2', 'a-ohne', 'frei1', 'frei2']);
  });

  it('Position als String wird numerisch sortiert (10 nach 2)', () => {
    const sorted = sortiere([skript('x10', 'Anna', '10'), skript('x2', 'Anna', '2')]);
    expect(ids(sorted)).toEqual(['x2', 'x10']);
  });
});

describe('konzeptCreatorFromSkript', () => {
  it('nimmt CRM-Namen vor Casting-Namen', () => {
    const creator = konzeptCreatorFromSkript({
      strategie_item: {
        creator_name: 'Fallback',
        casting_eintrag: {
          name: 'Casting Name',
          creator: {
            id: 'c1', vorname: 'Lea', nachname: 'Hoff',
            profilbild_url: 'https://img/full.jpg',
            profilbild_thumb_url: 'https://img/thumb.jpg'
          }
        }
      }
    });
    expect(creator).toMatchObject({
      id: 'c1',
      vorname: 'Lea',
      nachname: 'Hoff',
      name: 'Lea Hoff',
      profilbild_thumb_url: 'https://img/thumb.jpg'
    });
  });

  it('faellt auf Casting-Name zurueck', () => {
    const creator = konzeptCreatorFromSkript({
      strategie_item: {
        creator_name: 'Alt',
        casting_eintrag: { name: 'Casting Name', creator: null }
      }
    });
    expect(creator.name).toBe('Casting Name');
    expect(creator.id).toBeNull();
  });

  it('faellt auf creator_name zurueck', () => {
    expect(konzeptCreatorFromSkript({
      strategie_item: { creator_name: 'Nur Name' }
    })?.name).toBe('Nur Name');
  });

  it('ohne strategie_item null', () => {
    expect(konzeptCreatorFromSkript({ titel: 'X' })).toBeNull();
  });
});

describe('docHeadActionsHtml', () => {
  it('zeigt Senden neben Teilen unter demselben Gate', () => {
    const html = docHeadActionsHtml({ kannTeilen: true });
    expect(html).toContain('id="ed-share"');
    expect(html.indexOf('id="ed-share"')).toBeLessThan(html.indexOf('id="ed-anschreiben"'));
    expect(html).toContain('>Senden<');

    const ohne = docHeadActionsHtml({ kannTeilen: false });
    expect(ohne).not.toContain('id="ed-share"');
    expect(ohne).not.toContain('id="ed-anschreiben"');
  });

  it('zeigt Freigeben nur mit kannFreigeben', () => {
    const html = docHeadActionsHtml({ kannFreigeben: true });
    expect(html).toContain('id="ed-freigeben"');
    expect(html).toContain('>Freigeben<');

    const ohne = docHeadActionsHtml({ kannFreigeben: false });
    expect(ohne).not.toContain('id="ed-freigeben"');
  });

  it('zeigt bei Status freigegeben ein Badge und keinen Button', () => {
    const html = docHeadActionsHtml({ status: 'freigegeben', kannFreigeben: false });
    expect(html).toContain('Freigegeben');
    expect(html).not.toContain('id="ed-freigeben"');
  });
});
