// Einladung.test.js
// Guard für ADR 0055: Allowlist der Edge Function, Statuswechsel, Entwurf-Anlegen, Produktion-Chrome.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BRIEFING_FELDER,
  PRODUKT_FELDER,
  bereinigeBriefing,
  bereinigeProdukt,
  parseEmpfaenger,
  pruefeEinreichung
} from '../../supabase/functions/einladung/felder.ts';
import { BRIEFING_INTERN, kundenFeldNamen, kundenSteps, PRODUKT_FELDNAMEN } from '../modules/einladung/einladungFelder.js';
import { getAllFields } from '../modules/briefing/create/fieldConfig.js';
import {
  markiereBriefingAngelegt,
  markiereProduktAngelegt,
  reviewUrl,
  verwirfEinreichung
} from '../modules/einladung/einreichungService.js';
import { ensureBriefingLine } from '../modules/produktion/ProduktionService.js';
import { renderWorkflowCreateChrome } from '../modules/kampagne/KampagneWorkflowCreate.js';
import { EinladungDrawer } from '../modules/einladung/EinladungDrawer.js';
import { mountEinreichungInbox, setzeEinreichungsZaehler } from '../modules/einladung/EinreichungInbox.js';
import { mountProduktEinladung, produktEinreichungFilter } from '../modules/einladung/produktEinreichungen.js';
import {
  briefingEinladungKontext,
  produktEinladungKontext,
  renderKundeEinladenButton
} from '../modules/einladung/kundeEinladen.js';
import { fragNachDublette } from '../modules/produkt/produktEinreichung.js';
import {
  ladeAnsprechpartnerGruppen,
  mergeEmpfaenger
} from '../modules/einladung/einladungEmpfaenger.js';

const ID = '11111111-1111-1111-1111-111111111111';

describe('Allowlist der Edge Function', () => {
  it('lässt keine internen Briefing-Felder zu', () => {
    for (const intern of [...BRIEFING_INTERN, 'tkp', 'verhandlungshinweis']) {
      expect(BRIEFING_FELDER).not.toContain(intern);
    }
  });

  it('kennt jedes erlaubte Briefing-Feld aus der Feld-Config', () => {
    const bekannt = new Set(getAllFields().map((f) => f.name));
    const unbekannt = BRIEFING_FELDER.filter((name) => !bekannt.has(name));
    expect(unbekannt).toEqual([]);
  });

  it('deckt jedes Feld des Kundenformulars ab', () => {
    const erlaubt = new Set(BRIEFING_FELDER);
    const fehlen = [...kundenFeldNamen()].filter((name) => !erlaubt.has(name));
    expect(fehlen).toEqual([]);
  });

  it('zeigt dem Kunden keine internen Felder', () => {
    const namen = kundenSteps().flatMap((s) => s.sections.flatMap((sec) => sec.fields.map((f) => f.name)));
    for (const intern of BRIEFING_INTERN) expect(namen).not.toContain(intern);
  });

  it('verwirft interne und fremde Felder beim Bereinigen', () => {
    const { formData } = bereinigeBriefing(
      { beschreibung: 'Test', tkp: 12, verhandlungshinweis: 'x', unternehmen_id: 'a', marke_id: 'b', bereich: 'evil', foo: 1 },
      { einladungId: ID, bereich: 'paid_creator_ads' }
    );
    expect(formData).toEqual({ beschreibung: 'Test', bereich: 'paid_creator_ads' });
  });

  it('akzeptiert Referenz-Uploads nur aus der eigenen Einladung', () => {
    const { formData, dateien } = bereinigeBriefing(
      {
        referenzen: [
          { typ: 'upload', value: `${ID}/ref/a.pdf`, label: 'a.pdf' },
          { typ: 'upload', value: 'andere-einladung/ref/b.pdf', label: 'b.pdf' },
          { typ: 'upload', value: `${ID}/../x.pdf`, label: 'x.pdf' }
        ]
      },
      { einladungId: ID, bereich: 'owned_social' }
    );
    expect(formData.referenzen).toEqual([{ typ: 'upload', value: `${ID}/ref/a.pdf`, label: 'a.pdf' }]);
    expect(dateien).toHaveLength(1);
  });

  it('akzeptiert als Referenz-Link nur http und https', () => {
    const { formData } = bereinigeBriefing(
      { referenzen: [{ typ: 'url', value: 'javascript:alert(1)' }, { typ: 'url', value: 'https://example.com/ref' }] },
      { einladungId: ID, bereich: 'owned_social' }
    );
    expect(formData.referenzen).toEqual([{ typ: 'url', value: 'https://example.com/ref' }]);
  });

  it('Produkt: nur erlaubte Felder, Bilder nur aus der eigenen Einladung', () => {
    const { formData } = bereinigeProdukt(
      {
        name: 'Serum', url: 'https://shop.example/serum', unternehmen_id: 'x', marke_ids: ['y'], tkp: 5,
        bilder: [{ pfad: `${ID}/bild/1.png`, name: '1.png' }, { pfad: 'fremd/2.png', name: '2.png' }]
      },
      { einladungId: ID }
    );
    expect(Object.keys(formData).sort()).toEqual(['bilder', 'name', 'url']);
    expect(formData.bilder).toHaveLength(1);
    expect(PRODUKT_FELDNAMEN.every((n) => PRODUKT_FELDER.includes(n) || n === 'einsatzsituationen')).toBe(true);
  });

  it('prüft Pflichtangaben', () => {
    expect(pruefeEinreichung('produkt', { name: 'S', url: 'https://x.de' })).toBeTruthy();
    expect(pruefeEinreichung('produkt', { name: 'Serum', url: 'kein-link' })).toBeTruthy();
    expect(pruefeEinreichung('produkt', { name: 'Serum', url: 'https://x.de' })).toBeNull();
    expect(pruefeEinreichung('briefing', { bereich: 'paid_creator_ads' })).toBeTruthy();
    expect(pruefeEinreichung('briefing', { bereich: 'paid_creator_ads', cta: 'Jetzt kaufen' })).toBeNull();
  });
});

describe('Statuswechsel der Einreichung', () => {
  let update;
  let remove;

  function mockDb({ treffer }) {
    update = vi.fn();
    remove = vi.fn(async () => ({ error: null }));
    const kette = {
      update: (felder) => { update(felder); return kette; },
      eq: (spalte, wert) => { update.mock.calls.at(-1).push([spalte, wert]); return kette; },
      select: async () => ({ data: treffer ? [{ id: ID }] : [], error: null })
    };
    window.supabase = {
      from: () => kette,
      storage: { from: () => ({ remove }) }
    };
    window.currentUser = { id: 'user-1' };
  }

  beforeEach(() => {
    delete window.supabase;
  });

  it('setzt verworfen nur von offen aus und räumt Dateien auf', async () => {
    mockDb({ treffer: true });
    const ok = await verwirfEinreichung({ id: ID, dateien: [{ pfad: `${ID}/bild/1.png` }] });
    expect(ok).toBe(true);
    expect(update.mock.calls[0][0]).toMatchObject({ status: 'verworfen' });
    expect(update.mock.calls[0]).toContainEqual(['status', 'offen']);
    expect(remove).toHaveBeenCalledWith([`${ID}/bild/1.png`]);
  });

  it('lässt Dateien stehen, wenn die Einreichung schon erledigt ist', async () => {
    mockDb({ treffer: false });
    const ok = await verwirfEinreichung({ id: ID, dateien: [{ pfad: `${ID}/bild/1.png` }] });
    expect(ok).toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it('markiert angelegt mit Verweis auf das Ziel, ebenfalls nur von offen', async () => {
    mockDb({ treffer: true });
    await markiereProduktAngelegt(ID, 'produkt-1');
    expect(update.mock.calls[0][0]).toMatchObject({ status: 'angelegt', produkt_id: 'produkt-1' });
    expect(update.mock.calls[0]).toContainEqual(['status', 'offen']);

    await markiereBriefingAngelegt(ID, 'briefing-1');
    expect(update.mock.calls[1][0]).toMatchObject({ status: 'angelegt', briefing_id: 'briefing-1' });
  });

  it('Review-Links öffnen das jeweilige Formular mit Einreichung und Kontext', () => {
    const produkt = reviewUrl({ id: ID, einladung: { art: 'produkt', unternehmen_id: 'u1', marke_id: 'm1' } });
    expect(produkt).toBe(`/produkt/new?einreichung=${ID}&unternehmen=u1&marke=m1`);
    const briefing = reviewUrl({ id: ID, einladung: { art: 'briefing', unternehmen_id: 'u1', marke_id: 'm1', produktion_id: 'p1' } });
    expect(briefing).toContain('/briefing/new?');
    expect(briefing).toContain(`einreichung=${ID}`);
    expect(briefing).toContain('produktion=p1');
  });
});

describe('Anlegen als Entwurf', () => {
  it('legt für einen Entwurf keine Linie an', async () => {
    const result = await ensureBriefingLine({
      briefing: { id: 'b1', is_draft: true, produktion_id: 'p1' },
      kampagneId: 'k1',
      produktId: 'pr1',
      produktionId: 'p1'
    });
    expect(result).toBeNull();
  });
});

describe('Produktion: Kunde einladen', () => {
  beforeEach(() => {
    window.canCreate = () => true;
    window.isInternal = () => true;
  });

  it('setzt neben Briefing anlegen den Button Kunde einladen', () => {
    const html = renderWorkflowCreateChrome('briefing', {});
    expect(html).toContain('data-create-action="briefing"');
    expect(html).toContain('data-create-action="kundeEinladen"');
  });

  it('blendet Kunde einladen für externe Nutzer aus', () => {
    window.isInternal = () => false;
    const html = renderWorkflowCreateChrome('briefing', {});
    expect(html).toContain('data-create-action="briefing"');
    expect(html).not.toContain('kundeEinladen');
  });
});

describe('Empfänger der Einladungs-Mail', () => {
  it('Edge Function: normalisiert, dedupliziert und begrenzt', () => {
    expect(parseEmpfaenger([' Anna@Firma.de ', 'anna@firma.de', 'bob@firma.de'])).toEqual({
      emails: ['anna@firma.de', 'bob@firma.de']
    });
    expect(parseEmpfaenger(undefined)).toEqual({ emails: [] });
    expect(parseEmpfaenger(['kein-mail']).fehler).toBeTruthy();
    expect(parseEmpfaenger(['a@b.de<x>']).fehler).toBeTruthy();
    expect(parseEmpfaenger('a@b.de').fehler).toBeTruthy();
    const elf = Array.from({ length: 11 }, (_, i) => `u${i}@firma.de`);
    expect(parseEmpfaenger(elf).fehler).toBeTruthy();
  });

  it('mergeEmpfaenger führt Listen ohne Duplikate zusammen', () => {
    expect(mergeEmpfaenger(['A@x.de', 'b@x.de'], ['a@x.de', ' c@x.de '])).toEqual(['a@x.de', 'b@x.de', 'c@x.de']);
  });

  function mockDb(tabellen) {
    return {
      from: (tabelle) => {
        const kette = {
          select: () => kette,
          eq: () => kette,
          is: () => kette,
          order: () => kette,
          then: (resolve) => resolve({ data: tabellen[tabelle] ?? [], error: null })
        };
        return kette;
      }
    };
  }

  it('lädt Ansprechpartner von Kampagne, Unternehmen und Marke ohne Doppelte und ohne Mail-lose', async () => {
    const anna = { id: 'a1', vorname: 'Anna', nachname: 'Meyer', email: 'anna@firma.de' };
    const ohne = { id: 'a2', vorname: 'Ohne', nachname: 'Mail', email: '' };
    const bob = { id: 'a3', vorname: 'Bob', nachname: 'Klein', email: 'bob@firma.de' };
    const db = mockDb({
      ansprechpartner_kampagne: [{ ansprechpartner: anna }, { ansprechpartner: ohne }],
      ansprechpartner_unternehmen: [{ ansprechpartner: anna }, { ansprechpartner: bob }],
      ansprechpartner_marke: []
    });
    const { gruppen, ohneMail } = await ladeAnsprechpartnerGruppen(db, {
      kampagneId: 'k1',
      unternehmenId: 'u1',
      markeId: 'm1'
    });
    expect(gruppen.map((g) => [g.id, g.rows.map((r) => r.email)])).toEqual([
      ['kampagne', ['anna@firma.de']],
      ['stamm', ['bob@firma.de']]
    ]);
    expect(ohneMail).toBe(1);
  });

  it('bleibt benutzbar, wenn das Laden fehlschlägt', async () => {
    const db = { from: () => { throw new Error('boom'); } };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { gruppen } = await ladeAnsprechpartnerGruppen(db, { kampagneId: 'k1', unternehmenId: 'u1' });
    expect(gruppen).toEqual([]);
    warn.mockRestore();
  });
});

describe('Einladungs-Drawer', () => {
  let invoke;
  const fertig = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    document.body.innerHTML = '';
    window.isInternal = () => true;
    invoke = vi.fn(async () => ({
      data: { einladungId: 'e1', link: 'https://crm.test/einladung/abc', code: '123456', gesendet: ['anna@firma.de'], fehlgeschlagen: [] },
      error: null
    }));
    const tabellen = {
      ansprechpartner_kampagne: [{ ansprechpartner: { id: 'a1', vorname: 'Anna', nachname: 'Meyer', email: 'anna@firma.de' } }],
      einladung: []
    };
    window.supabase = {
      functions: { invoke },
      from: (tabelle) => {
        const kette = {
          select: () => kette,
          eq: () => kette,
          is: () => kette,
          order: () => kette,
          then: (resolve) => resolve({ data: tabellen[tabelle] ?? [], error: null })
        };
        return kette;
      }
    };
    window.toastSystem = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  });

  async function oeffne() {
    const drawer = new EinladungDrawer();
    drawer.open({
      art: 'briefing',
      produktionId: 'p1',
      kampagneId: 'k1',
      unternehmenId: 'u1',
      markeId: null,
      kontextName: 'Sommer'
    });
    await fertig();
    await fertig();
    return drawer;
  }

  it('öffnet als Side-Drawer mit Ansprechpartnern und Knopf je nach Auswahl', async () => {
    await oeffne();
    const panel = document.getElementById('einladung-drawer');
    expect(panel.classList.contains('drawer-panel')).toBe(true);
    expect(document.querySelector('.modal.overlay-modal')).toBeNull();

    const knopf = panel.querySelector('#einladung-submit');
    expect(knopf.textContent).toBe('Einladung erstellen');
    const haken = panel.querySelector('[data-ap-email="anna@firma.de"]');
    expect(haken).not.toBeNull();
    expect(haken.checked).toBe(false);

    haken.checked = true;
    haken.dispatchEvent(new Event('change', { bubbles: true }));
    expect(knopf.textContent).toBe('Einladung erstellen und senden');
  });

  it('schickt gewählte und freie Adressen samt Notiz an create', async () => {
    await oeffne();
    const panel = document.getElementById('einladung-drawer');
    panel.querySelector('#einladung-typ').value = 'paid_creator_ads';

    const haken = panel.querySelector('[data-ap-email="anna@firma.de"]');
    haken.checked = true;
    haken.dispatchEvent(new Event('change', { bubbles: true }));

    const frei = panel.querySelector('#einladung-frei-input');
    frei.value = 'Chef@Firma.de';
    frei.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    panel.querySelector('#einladung-nachricht').value = 'Bitte bis Freitag.';

    panel.querySelector('#einladung-submit').click();
    await fertig();
    await fertig();

    expect(invoke).toHaveBeenCalledTimes(1);
    const [name, { body }] = invoke.mock.calls[0];
    expect(name).toBe('einladung');
    expect(body).toMatchObject({
      action: 'create',
      art: 'briefing',
      briefingTyp: 'paid_creator_ads',
      produktionId: 'p1',
      emails: ['anna@firma.de', 'chef@firma.de'],
      nachricht: 'Bitte bis Freitag.'
    });
    expect(window.toastSystem.success).toHaveBeenCalled();
    expect(panel.querySelector('#einladung-banner').hidden).toBe(false);
  });

  it('legt ohne Empfänger an, ohne emails mitzuschicken', async () => {
    await oeffne();
    const panel = document.getElementById('einladung-drawer');
    panel.querySelector('#einladung-typ').value = 'owned_social';
    panel.querySelector('#einladung-submit').click();
    await fertig();
    await fertig();
    const { body } = invoke.mock.calls[0][1];
    expect(body.emails).toBeUndefined();
    expect(body.nachricht).toBeUndefined();
  });

  it('verlangt den Briefing-Typ vor dem Anlegen', async () => {
    await oeffne();
    document.querySelector('#einladung-submit').click();
    await fertig();
    expect(invoke).not.toHaveBeenCalled();
    expect(window.toastSystem.warning).toHaveBeenCalled();
  });

  it('warnt, wenn die Mail nicht zugestellt wurde, und zeigt Code und Link zum Kopieren', async () => {
    invoke.mockResolvedValueOnce({
      data: { einladungId: 'e1', link: 'https://crm.test/einladung/abc', code: '654321', gesendet: [], fehlgeschlagen: ['anna@firma.de'] },
      error: null
    });
    await oeffne();
    const panel = document.getElementById('einladung-drawer');
    panel.querySelector('#einladung-typ').value = 'paid_creator_ads';
    const haken = panel.querySelector('[data-ap-email="anna@firma.de"]');
    haken.checked = true;
    haken.dispatchEvent(new Event('change', { bubbles: true }));
    panel.querySelector('#einladung-submit').click();
    await fertig();
    await fertig();
    expect(window.toastSystem.warning).toHaveBeenCalled();
    expect(panel.querySelector('#einladung-banner').textContent).toContain('654321');
    expect(panel.querySelector('#einladung-banner').textContent).toContain('anna@firma.de');
  });
});

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
