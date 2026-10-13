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
