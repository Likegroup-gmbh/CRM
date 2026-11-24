// docEinbettung.test.js
// Produkt- und Personaformular als Seite oder eingebettet im Tab der Produktion
// (ADR 0079): wohin gerendert wird, wer Kopf und Zurück übernimmt, Abbau während init.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installDocEinbettung } from '../core/doc/docEinbettung.js';
import { installProduktFormEinbettung } from '../modules/produkt/produktFormEinbettung.js';
import { installPersonaFormEinbettung } from '../modules/persona/personaFormEinbettung.js';

function formKlasse(seitenKopf = vi.fn()) {
  class Form {
    constructor() {
      this.destroyed = false;
    }

    get returnRoute() {
      return '/herkunft';
    }

    destroy() {
      this.destroyed = true;
    }
  }
  installDocEinbettung(Form.prototype, { seitenKopf });
  return { Form, seitenKopf };
}

function host() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  window.content = document.createElement('main');
  window.navigateTo = vi.fn();
  window.navigateReplace = vi.fn();
  window.setHeadline = vi.fn();
  window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
});

afterEach(() => {
  document.body.innerHTML = '';
  window.history.replaceState(null, '', '/');
});

describe('Formular als Seite', () => {
  it('rendert in window.content, setzt den Kopf und kehrt zur Herkunft zurück', () => {
    const { Form, seitenKopf } = formKlasse();
    const form = new Form();

    expect(form.embedded).toBe(false);
    expect(form._inhalt()).toBe(window.content);
    form._kopf('Titel', 'Blatt');
    expect(seitenKopf).toHaveBeenCalledWith('Titel', 'Blatt');
    expect(seitenKopf.mock.contexts[0]).toBe(form);

    form._zurueck();
    expect(window.navigateReplace).toHaveBeenCalledWith('/herkunft');
    form._zurueck('/produkt');
    expect(window.navigateTo).toHaveBeenCalledWith('/produkt');
  });
});

describe('Formular eingebettet', () => {
  it('rendert in den Host, meldet den Namen und schließt über onSchliessen', () => {
    const { Form, seitenKopf } = formKlasse();
    const form = new Form();
    const onTitel = vi.fn();
    const onSchliessen = vi.fn();
    const ziel = host();
    form._einbetten({ host: ziel, onTitel, onSchliessen });

    expect(form.embedded).toBe(true);
    expect(form._inhalt()).toBe(ziel);
    form._kopf('Titel', 'Blatt');
    expect(onTitel).toHaveBeenCalledWith('Blatt');
    expect(seitenKopf).not.toHaveBeenCalled();

    form._zurueck('/produkt');
    expect(onSchliessen).toHaveBeenCalledTimes(1);
    expect(window.navigateTo).not.toHaveBeenCalled();
  });

  it('schreibt nach dem Abbau nicht mehr in den Pane', () => {
    const { Form } = formKlasse();
    const form = new Form();
    const onTitel = vi.fn();
    const onSchliessen = vi.fn();
    form._einbetten({ host: host(), onTitel, onSchliessen });

    form.destroy();

    expect(form.destroyed).toBe(true);
    expect(() => form._inhalt()).toThrow(expect.objectContaining({ name: 'AbortError' }));
    expect(() => form._kopf('Titel', 'Blatt')).toThrow(expect.objectContaining({ name: 'AbortError' }));
    form._zurueck();
    expect(onTitel).not.toHaveBeenCalled();
    expect(onSchliessen).not.toHaveBeenCalled();
  });

  it('bricht ab, wenn der Host nicht mehr im Dokument hängt', () => {
    const { Form } = formKlasse();
    const form = new Form();
    form._einbetten({ host: document.createElement('div') });
    expect(() => form._inhalt()).toThrow(expect.objectContaining({ name: 'AbortError' }));
  });
});

describe('Produktformular: Ausgangslage', () => {
  function produktForm() {
    class ProduktForm {
      destroy() {}
      async init() {}
    }
    installProduktFormEinbettung(ProduktForm.prototype);
    return new ProduktForm();
  }

  it('liest auf der Seite Produkt, Scope und Kontext-Briefing aus der URL', () => {
    window.history.replaceState(null, '', '/produkt/x1?briefing=b1');
    expect(produktForm()._ausgangslage()).toEqual({
      standalone: true, produktId: 'x1', createScope: null, kontextBriefingId: 'b1'
    });

    window.history.replaceState(null, '', '/marke/m1/produkt?produkt=x2');
    expect(produktForm()._ausgangslage()).toMatchObject({ standalone: false, produktId: 'x2', createScope: null });

    window.history.replaceState(null, '', '/produkt/new?unternehmen=u1&briefing=b1');
    expect(produktForm()._ausgangslage()).toMatchObject({
      produktId: null,
      createScope: { unternehmenId: 'u1', briefingId: 'b1', markeId: null, produktionId: null },
      kontextBriefingId: 'b1'
    });
  });

  it('nimmt eingebettet Produkt und Linie aus der Einbettung, nicht aus der URL', async () => {
    window.history.replaceState(null, '', '/produktion/p1?tab=produkte&linie=b1&produkt=x9');
    const form = produktForm();
    form.init = vi.fn(async () => {});

    await form.mountEmbedded(host(), 'x1', { briefingId: 'b2' });

    expect(form.init).toHaveBeenCalledWith(null);
    expect(form._ausgangslage()).toEqual({
      standalone: true, produktId: 'x1', createScope: null, kontextBriefingId: 'b2'
    });
  });
});

describe('Personaformular: Ausgangslage', () => {
  function personaForm() {
    class PersonaForm {
      destroy() {}
      async init() {}
    }
    installPersonaFormEinbettung(PersonaForm.prototype);
    return new PersonaForm();
  }

  it('gilt eingebettet als /persona/:id und startet mit der übergebenen Persona', async () => {
    window.history.replaceState(null, '', '/produktion/p1?tab=personas&linie=b1&persona=y1');
    const form = personaForm();
    form.init = vi.fn(async () => {});
    expect(form.isStandalone).toBe(false);

    await form.mountEmbedded(host(), 'y1');

    expect(form.isStandalone).toBe(true);
    expect(form.init).toHaveBeenCalledWith('y1');
  });

  it('erkennt die Seite /persona/:id weiter am Pfad', () => {
    window.history.replaceState(null, '', '/persona/y1');
    expect(personaForm().isStandalone).toBe(true);
    window.history.replaceState(null, '', '/marke/m1/persona?persona=y1');
    expect(personaForm().isStandalone).toBe(false);
  });
});
