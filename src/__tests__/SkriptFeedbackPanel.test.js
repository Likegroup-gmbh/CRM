// SkriptFeedbackPanel.test.js
// Feedback-Spalte im Skript-Editor: Thread-Gruppierung, Erledigt-Kollaps und
// die rollenabhaengigen Aktionen im Selektionsmenue. Kunden duerfen markieren
// und kommentieren, sehen aber weder die AI-Aktionen noch den Erledigt-Haken.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../core/icons/IconSystem.js', () => ({
  icon: (name) => `<svg data-icon="${name}"></svg>`
}));

import {
  gruppiereThreads, threadHtml, neuerKommentarHtml, feedbackLeerHtml
} from '../modules/skripte/editor/SkriptFeedbackRenderer.js';
import { SkriptEditorSelection } from '../modules/skripte/editor/SkriptEditorSelection.js';
import { SkriptFeedbackPanel } from '../modules/skripte/editor/SkriptFeedbackPanel.js';
import { skriptKommentarService } from '../modules/skripte/SkriptKommentarService.js';

function kommentar(overrides = {}) {
  return {
    id: 'k1',
    parent_id: null,
    sektion: 'hauptteil',
    ist_visuell: false,
    selektion_text: 'Digga, wenn du dieses Wochenende NICHT auf dem Lollapalooza warst',
    inhalt: 'Hier würde ich den Text gegen einen neuen tauschen.',
    erledigt_at: null,
    created_at: '2026-08-31T05:00:00.000Z',
    created_by: { id: 'u1', name: 'Jasmis', profile_image_url: null, rolle: 'mitarbeiter' },
    ...overrides
  };
}

describe('gruppiereThreads', () => {
  it('haengt Antworten chronologisch an ihre Wurzel', () => {
    const threads = gruppiereThreads([
      kommentar({ id: 'root' }),
      kommentar({ id: 'a2', parent_id: 'root', created_at: '2026-08-31T07:00:00.000Z', inhalt: 'zweite' }),
      kommentar({ id: 'a1', parent_id: 'root', created_at: '2026-08-31T06:00:00.000Z', inhalt: 'erste' })
    ]);

    expect(threads).toHaveLength(1);
    expect(threads[0].antworten.map((a) => a.inhalt)).toEqual(['erste', 'zweite']);
  });

  it('laesst verwaiste Antworten weg statt sie kontextlos zu zeigen', () => {
    const threads = gruppiereThreads([
      kommentar({ id: 'waise', parent_id: 'nicht-sichtbar' })
    ]);
    expect(threads).toHaveLength(0);
  });

  it('behaelt mehrere Wurzeln in Eingangsreihenfolge', () => {
    const threads = gruppiereThreads([
      kommentar({ id: 'r1' }),
      kommentar({ id: 'r2' })
    ]);
    expect(threads.map((t) => t.id)).toEqual(['r1', 'r2']);
  });
});

describe('threadHtml', () => {
  const thread = { ...kommentar(), antworten: [] };

  it('zeigt Autor, Zitat und Inhalt', () => {
    const html = threadHtml(thread, { kannErledigen: true });
    expect(html).toContain('Jasmis');
    expect(html).toContain('Lollapalooza');
    expect(html).toContain('Hier würde ich den Text gegen einen neuen tauschen.');
  });

  it('nutzt author_name, wenn der Autor-Join per RLS leer bleibt', () => {
    const kunde = { ...kommentar({ created_by: null, author_name: 'Jasmis' }), antworten: [] };
    const html = threadHtml(kunde, { kannErledigen: true });
    expect(html).toContain('Jasmis');
    expect(html).not.toContain('Unbekannt');
  });

  it('nutzt author_name, wenn Realtime created_by nur als UUID liefert', () => {
    const realtime = { ...kommentar({ created_by: 'u1', author_name: 'Jasmis' }), antworten: [] };
    const html = threadHtml(realtime, { kannErledigen: true });
    expect(html).toContain('Jasmis');
    expect(html).not.toContain('Unbekannt');
  });

  it('blendet den Erledigt-Haken ohne interne Rechte aus', () => {
    expect(threadHtml(thread, { kannErledigen: false })).not.toContain('data-fb-action="erledigt"');
    expect(threadHtml(thread, { kannErledigen: true })).toContain('data-fb-action="erledigt"');
  });

  it('kollabiert erledigte Threads auf eine aufklappbare Zeile', () => {
    const erledigt = { ...thread, erledigt_at: '2026-08-31T08:00:00.000Z' };
    const html = threadHtml(erledigt, { kannErledigen: true });

    expect(html).toContain('is-kollabiert');
    expect(html).toContain('data-fb-action="aufklappen"');
    // Zitat und Antwortfeld sind im kollabierten Zustand weg
    expect(html).not.toContain('skripte-editor-msg-quote');
    expect(html).not.toContain('data-fb-action="antworten"');
  });

  it('zeigt den erledigten Thread nach dem Aufklappen wieder voll', () => {
    const erledigt = { ...thread, erledigt_at: '2026-08-31T08:00:00.000Z' };
    const html = threadHtml(erledigt, { kannErledigen: true, aufgeklappt: true });

    expect(html).not.toContain('is-kollabiert');
    expect(html).toContain('skripte-editor-msg-quote');
    // Erledigte Threads bekommen kein Antwortfeld, auch aufgeklappt nicht
    expect(html).not.toContain('data-fb-action="antworten"');
  });

  it('zeigt das Antwortfeld nur bei Kommentierrecht', () => {
    expect(threadHtml(thread, { kannAntworten: true })).toContain('data-fb-action="antworten"');
    expect(threadHtml(thread, { kannAntworten: false })).not.toContain('data-fb-action="antworten"');
  });
});

describe('Composer und Leerzustand', () => {
  it('uebernimmt Sektion und Markierung in den neuen Kommentar', () => {
    const html = neuerKommentarHtml({ sektion: 'hook', text: 'Markierter Satz', istVisuell: false });
    expect(html).toContain('HOOK');
    expect(html).toContain('Markierter Satz');
    expect(html).toContain('id="ed-fb-neu-input"');
  });

  it('erklaert den Weg zum Feedback nur, wenn man kommentieren darf', () => {
    expect(feedbackLeerHtml(true)).toContain('Markiere eine Stelle');
    expect(feedbackLeerHtml(false)).not.toContain('Markiere eine Stelle');
  });
});

describe('Selektionsmenue je Rolle', () => {
  let container;
  let view;

  function setupDom() {
    container = document.createElement('div');
    container.innerHTML = `
      <div class="skripte-editor">
        <div id="ed-doc">
          <div class="skripte-editor-sektion-text" data-sektion="hauptteil" data-feld="hauptteil">Ein markierter Satz</div>
        </div>
        <div id="ed-selmenu" hidden></div>
        <div id="ed-chip" hidden></div>
      </div>
    `;
    document.body.appendChild(container);
  }

  function mockSelection() {
    const zelle = container.querySelector('.skripte-editor-sektion-text');
    const textNode = zelle.firstChild;
    window.getSelection = vi.fn(() => ({
      isCollapsed: false,
      toString: () => 'markierter Satz',
      anchorNode: textNode,
      focusNode: textNode,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 10, right: 10 }) }),
      removeAllRanges: vi.fn()
    }));
  }

  beforeEach(() => {
    setupDom();
    mockSelection();
    view = {
      container,
      selektion: null,
      pendingAktion: null,
      kannAiAktionen: true,
      closeVersionMenu: vi.fn(),
      setLikyOffen: vi.fn(),
      startNeuerKommentar: vi.fn()
    };
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('zeigt intern Kommentieren plus die AI-Aktionen', () => {
    new SkriptEditorSelection(view).checkSelection();
    const labels = [...document.querySelectorAll('#ed-selmenu button')].map((b) => b.dataset.id);
    expect(labels).toEqual(['kommentieren', 'neu_schreiben', 'kuerzen', 'laenger', 'anderer_ton']);
  });

  it('zeigt dem Kunden nur Kommentieren', () => {
    view.kannAiAktionen = false;
    new SkriptEditorSelection(view).checkSelection();
    const labels = [...document.querySelectorAll('#ed-selmenu button')].map((b) => b.dataset.id);
    expect(labels).toEqual(['kommentieren']);
  });

  it('leitet Kommentieren ins Feedback-Panel statt in den Chat', () => {
    const selection = new SkriptEditorSelection(view);
    selection.checkSelection();
    document.querySelector('#ed-selmenu button[data-id="kommentieren"]').click();

    expect(view.startNeuerKommentar).toHaveBeenCalledWith(
      expect.objectContaining({ sektion: 'hauptteil', text: 'markierter Satz' })
    );
    expect(view.pendingAktion).toBeNull();
  });

  it('merkt AI-Aktionen als pending und macht die Liky-Bubble auf', () => {
    const selection = new SkriptEditorSelection(view);
    selection.checkSelection();
    document.querySelector('#ed-selmenu button[data-id="kuerzen"]').click();

    expect(view.pendingAktion).toBe('kuerzen');
    expect(view.setLikyOffen).toHaveBeenCalledWith(true);
    expect(view.startNeuerKommentar).not.toHaveBeenCalled();
  });
});

describe('SkriptFeedbackPanel', () => {
  let view;
  let panel;

  beforeEach(() => {
    document.body.innerHTML = '<div id="ed-fb-log"></div>';
    view = {
      skript: { id: 's1' },
      kommentare: [kommentar()],
      kannKommentieren: true,
      kannErledigen: true
    };
    panel = new SkriptFeedbackPanel(view);
    window.toastSystem = { error: vi.fn() };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('rendert einen Thread ins Log', () => {
    panel.render();
    expect(document.querySelectorAll('.skripte-editor-fb-thread')).toHaveLength(1);
  });

  it('setzt den Haken sofort und meldet ihn an den Server', async () => {
    const spy = vi.spyOn(skriptKommentarService, 'setErledigt').mockResolvedValue({});
    panel.render();

    await panel.toggleErledigt('k1');

    expect(spy).toHaveBeenCalledWith('k1', true);
    expect(view.kommentare[0].erledigt_at).toBeTruthy();
    expect(document.querySelector('.skripte-editor-fb-thread').className)
      .toContain('is-kollabiert');
  });

  it('nimmt den Haken zurueck, wenn der Server ablehnt', async () => {
    vi.spyOn(skriptKommentarService, 'setErledigt')
      .mockRejectedValue(new Error('Nur intern'));
    panel.render();

    await panel.toggleErledigt('k1');

    expect(view.kommentare[0].erledigt_at).toBeNull();
    expect(window.toastSystem.error).toHaveBeenCalled();
  });

  it('ignoriert den Erledigt-Toggle ohne interne Rechte', async () => {
    const spy = vi.spyOn(skriptKommentarService, 'setErledigt').mockResolvedValue({});
    view.kannErledigen = false;

    await panel.toggleErledigt('k1');

    expect(spy).not.toHaveBeenCalled();
    expect(view.kommentare[0].erledigt_at).toBeNull();
  });

  it('legt aus einer Markierung einen vorbelegten Composer an', () => {
    panel.startNeuerKommentar({ sektion: 'hook', text: 'Markierter Satz', istVisuell: false });

    expect(document.getElementById('ed-fb-neu-input')).toBeTruthy();
    expect(document.getElementById('ed-fb-log').innerHTML).toContain('Markierter Satz');
  });

  it('speichert den neuen Kommentar mit Sektion und Markierung', async () => {
    const neu = kommentar({ id: 'k2', inhalt: 'Bitte kürzen' });
    const spy = vi.spyOn(skriptKommentarService, 'createKommentar').mockResolvedValue(neu);

    panel.startNeuerKommentar({ sektion: 'hook', text: 'Markierter Satz', istVisuell: false });
    document.getElementById('ed-fb-neu-input').value = 'Bitte kürzen';
    await panel.sendNeuerKommentar();

    expect(spy).toHaveBeenCalledWith({
      skriptId: 's1',
      sektion: 'hook',
      istVisuell: false,
      selektionText: 'Markierter Satz',
      inhalt: 'Bitte kürzen'
    });
    expect(view.kommentare.map((k) => k.id)).toContain('k2');
    expect(document.getElementById('ed-fb-neu-input')).toBeNull();
  });

  it('haengt Antworten an den Thread statt einen neuen aufzumachen', async () => {
    const antwort = kommentar({ id: 'k3', parent_id: 'k1', inhalt: 'Alles klar' });
    const spy = vi.spyOn(skriptKommentarService, 'createKommentar').mockResolvedValue(antwort);
    panel.render();

    document.querySelector('[data-fb-reply-input="k1"]').value = 'Alles klar';
    await panel.sendAntwort('k1');

    expect(spy).toHaveBeenCalledWith({ skriptId: 's1', parentId: 'k1', inhalt: 'Alles klar' });
    expect(document.querySelectorAll('.skripte-editor-fb-antwort')).toHaveLength(1);
  });

  it('schickt leere Eingaben gar nicht erst ab', async () => {
    const spy = vi.spyOn(skriptKommentarService, 'createKommentar').mockResolvedValue({});
    panel.render();

    document.querySelector('[data-fb-reply-input="k1"]').value = '   ';
    await panel.sendAntwort('k1');

    expect(spy).not.toHaveBeenCalled();
  });
});
