// EinladungEinreichung.test.js
// Einreichungen (ADR 0055): Statuswechsel, Entwurf, Produktion-Chrome, Empfänger.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseEmpfaenger } from '../../supabase/functions/einladung/felder.ts';
import {
  markiereBriefingAngelegt,
  markiereProduktAngelegt,
  reviewUrl,
  verwirfEinreichung
} from '../modules/einladung/einreichungService.js';
import { ensureBriefingLine } from '../modules/produktion/ProduktionService.js';
import { renderWorkflowCreateChrome } from '../modules/kampagne/KampagneWorkflowCreate.js';
import { ladeAnsprechpartnerGruppen, mergeEmpfaenger } from '../modules/einladung/einladungEmpfaenger.js';

const ID = '11111111-1111-1111-1111-111111111111';

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
