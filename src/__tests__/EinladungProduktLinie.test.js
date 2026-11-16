// EinladungProduktLinie.test.js
// Produkt-Einladung an einer Linie (ADR 0057) und der gemeinsame Einstieg „Kunde einladen“.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { reviewUrl } from '../modules/einladung/einreichungService.js';
import { EinladungDrawer } from '../modules/einladung/EinladungDrawer.js';
import { mountEinreichungInbox, setzeEinreichungsZaehler } from '../modules/einladung/EinreichungInbox.js';
import {
  mountProduktEinladung,
  produktEinreichungFilter
} from '../modules/einladung/produktEinreichungen.js';
import {
  briefingEinladungKontext,
  produktEinladungKontext,
  renderKundeEinladenButton
} from '../modules/einladung/kundeEinladen.js';
import { fragNachDublette } from '../modules/produkt/produktEinreichung.js';

const ID = '11111111-1111-1111-1111-111111111111';

describe('Produkt-Einladung an Linie (ADR 0057)', () => {
  const fertig = () => new Promise((resolve) => setTimeout(resolve, 0));

  /** Fake-DB: merkt sich alle eq-Filter je Tabelle und liefert `zeilen`. */
  function fakeDb(zeilen = {}) {
    const filter = {};
    window.supabase = {
      from: (tabelle) => {
        filter[tabelle] = [];
        const kette = {
          select: () => kette,
          eq: (spalte, wert) => { filter[tabelle].push([spalte, wert]); return kette; },
          is: () => kette,
          order: () => kette,
          then: (resolve) => resolve({ data: zeilen[tabelle] ?? [], error: null })
        };
        return kette;
      }
    };
    return filter;
  }

  const einreichung = (extra = {}) => ({
    id: ID,
    absender_name: 'Anna',
    created_at: '2026-10-01T10:00:00Z',
    payload: { formData: { name: 'Face Cream' } },
    einladung: {
      art: 'produkt',
      unternehmen_id: 'u1',
      marke_id: 'm1',
      briefing_id: 'b1',
      briefing: { aktivierung_name: 'Linie A', produktion_id: 'p1' },
      ...extra
    }
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    window.isInternal = () => true;
    window.canCreate = () => true;
  });

  it('Review-Link trägt die Linie und ihre Produktion', () => {
    const url = reviewUrl(einreichung());
    expect(url).toContain(`einreichung=${ID}`);
    expect(url).toContain('briefing=b1');
    expect(url).toContain('produktion=p1');
  });

  it('Review-Link ohne Linie bleibt wie bisher', () => {
    const url = reviewUrl(einreichung({ briefing_id: null, briefing: null }));
    expect(url).toBe(`/produkt/new?einreichung=${ID}&unternehmen=u1&marke=m1`);
  });

  it('Eingang filtert auf dem Produkte-Tab nach Linie, global nach Marke', () => {
    const embed = { embedScope: { briefingId: 'b1', unternehmenId: 'u1', markeId: 'm1' } };
    expect(produktEinreichungFilter(embed)).toEqual({ briefingId: 'b1' });
    expect(produktEinreichungFilter({ embedScope: { unternehmenId: 'u1' } })).toBeNull();
    const global = { currentUnternehmenId: 'u1', currentMarkeId: 'm1', _ohneMarke: false };
    expect(produktEinreichungFilter(global)).toEqual({ markeId: 'm1', unternehmenId: 'u1' });
  });

  it('Eingang lädt nach einladung.briefing_id, zeigt die Zeile und setzt den Tab-Badge', async () => {
    const filter = fakeDb({ einreichung: [einreichung()] });
    document.body.innerHTML = '<button data-workflow-tab="produkte">Produkte</button><div id="host"></div>';
    const host = document.getElementById('host');

    await mountEinreichungInbox({ art: 'produkt', host, filter: { briefingId: 'b1' }, tabBadge: true });

    expect(filter.einreichung).toContainEqual(['einladung.briefing_id', 'b1']);
    expect(host.hidden).toBe(false);
    expect(host.textContent).toContain('Face Cream');
    // Auf dem Linien-Tab ist die Linie selbst bekannt, kein Zusatz.
    expect(host.textContent).not.toContain('für Linie');
    expect(document.querySelector('[data-workflow-tab="produkte"] [data-einreichung-count]').textContent).toBe('1');
  });

  it('globaler Eingang nennt die Linie der Einreichung', async () => {
    fakeDb({ einreichung: [einreichung()] });
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.getElementById('host');
    await mountEinreichungInbox({ art: 'produkt', host, filter: { markeId: 'm1', unternehmenId: 'u1' } });
    expect(host.querySelector('table.data-table')).not.toBeNull();
    expect([...host.querySelectorAll('th')].map((th) => th.textContent)).toContain('Linie');
    expect(host.textContent).toContain('Linie A');
  });

  it('ohne Filter (keine Linie) bleibt der Eingang leer und der Badge weg', async () => {
    fakeDb({ einreichung: [einreichung()] });
    document.body.innerHTML = '<button data-workflow-tab="produkte">Produkte</button><div id="host"></div>';
    setzeEinreichungsZaehler('produkt', 3);
    await mountEinreichungInbox({ art: 'produkt', host: document.getElementById('host'), filter: null, tabBadge: true });
    expect(document.getElementById('host').hidden).toBe(true);
    expect(document.querySelector('[data-einreichung-count]')).toBeNull();
  });

  it('Badge am Tab Produkte wird ohne Tab im DOM still ignoriert', () => {
    expect(() => setzeEinreichungsZaehler('produkt', 2)).not.toThrow();
  });

  it('Produkte-Tab: Kunde einladen ist ohne Linie deaktiviert, mit Linie aktiv', async () => {
    fakeDb();
    const mitRoot = (scope) => {
      document.body.innerHTML = '<div id="root"><div class="table-filter-wrapper"></div><div class="table-actions"></div></div>';
      return { canEdit: true, embedScope: scope, mountRoot: document.getElementById('root') };
    };

    await mountProduktEinladung(mitRoot({ unternehmenId: 'u1', markeId: 'm1' }));
    let knopf = document.querySelector('[data-create-action="kundeEinladen"]');
    expect(knopf.disabled).toBe(true);

    await mountProduktEinladung(mitRoot({ unternehmenId: 'u1', markeId: 'm1', briefingId: 'b1', briefingName: 'Linie A' }));
    knopf = document.querySelector('[data-create-action="kundeEinladen"]');
    expect(knopf.disabled).toBe(false);
    // Zweiter Aufruf legt keinen zweiten Button an.
    await mountProduktEinladung({ canEdit: true, embedScope: { unternehmenId: 'u1', briefingId: 'b1' }, mountRoot: document.getElementById('root') });
    expect(document.querySelectorAll('[data-create-action="kundeEinladen"]')).toHaveLength(1);
  });

  it('Drawer schickt die Linie an create und zeigt nur deren Einladungen', async () => {
    const invoke = vi.fn(async () => ({
      data: { einladungId: 'e1', link: 'https://crm.test/einladung/abc', code: '123456', gesendet: [], fehlgeschlagen: [] },
      error: null
    }));
    const filter = fakeDb({ ansprechpartner_unternehmen: [] });
    window.supabase.functions = { invoke };
    window.toastSystem = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };

    const drawer = new EinladungDrawer();
    drawer.open({ art: 'produkt', unternehmenId: 'u1', markeId: 'm1', briefingId: 'b1', kontextName: 'Linie A' });
    await fertig();
    await fertig();

    expect(filter.einladung).toContainEqual(['briefing_id', 'b1']);
    expect(filter.einladung).not.toContainEqual(['unternehmen_id', 'u1']);
    expect(document.getElementById('einladung-drawer').textContent).toContain('Beim Anlegen wird das Produkt an die Linie übernommen');

    document.querySelector('#einladung-submit').click();
    await fertig();
    await fertig();
    expect(invoke.mock.calls[0][1].body).toMatchObject({
      action: 'create', art: 'produkt', unternehmenId: 'u1', markeId: 'm1', briefingId: 'b1'
    });
  });

  it('Drawer ohne Linie schickt keine briefingId', async () => {
    const invoke = vi.fn(async () => ({ data: { einladungId: 'e1', link: '', code: '123456' }, error: null }));
    fakeDb();
    window.supabase.functions = { invoke };
    window.toastSystem = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
    const drawer = new EinladungDrawer();
    drawer.open({ art: 'produkt', unternehmenId: 'u1', markeId: null });
    await fertig();
    document.querySelector('#einladung-submit').click();
    await fertig();
    await fertig();
    expect(invoke.mock.calls[0][1].body.briefingId).toBeUndefined();
  });

  it('Dublette-Dialog nennt bei einer Linie das Übernehmen', () => {
    fragNachDublette([{ id: 'x', name: 'Face Cream' }], { mitLinie: true });
    expect(document.querySelector('.einreichung-dublette').textContent).toContain('an die Linie');
    document.querySelector('.einreichung-dublette').remove();
    fragNachDublette([{ id: 'x', name: 'Face Cream' }]);
    expect(document.querySelector('.einreichung-dublette').textContent).not.toContain('an die Linie');
  });
});

describe('Kunde einladen: ein Einstieg für beide Arten', () => {
  beforeEach(() => {
    window.isInternal = () => true;
    window.canCreate = () => true;
  });

  it('baut den Briefing-Kontext aus der Produktion, ohne Produktion keinen', () => {
    expect(briefingEinladungKontext({})).toBeNull();
    expect(briefingEinladungKontext({
      produktionId: 'p1', kampagneId: 'k1', kampagneData: { unternehmen_id: 'u1', marke_id: 'm1' }, produktion: { name: 'Prod 1' }
    })).toMatchObject({ art: 'briefing', produktionId: 'p1', unternehmenId: 'u1', markeId: 'm1', kontextName: 'Prod 1' });
  });

  it('baut den Produkt-Kontext mit optionaler Linie', () => {
    expect(produktEinladungKontext({})).toBeNull();
    expect(produktEinladungKontext({ unternehmenId: 'u1', briefingId: 'b1' }))
      .toMatchObject({ art: 'produkt', unternehmenId: 'u1', markeId: null, briefingId: 'b1' });
  });

  it('rendert den Button nur für Interne und mit Recht', () => {
    expect(renderKundeEinladenButton({ permission: 'briefing' })).toContain('data-create-action="kundeEinladen"');
    window.canCreate = () => false;
    expect(renderKundeEinladenButton({ permission: 'briefing' })).toBe('');
    window.canCreate = () => true;
    window.isInternal = () => false;
    expect(renderKundeEinladenButton({})).toBe('');
  });
});
