import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dropAnschreibenWarm, warmAnschreiben } from '../core/anschreiben/openAnschreiben.js';
import {
  skriptAdapter,
  loadSkriptPdfItems,
  loadSkriptEmpfaengerScope,
  renderSkriptSchalter,
  creatorProfileFuerSkript,
  skripteFuerEmpfaenger,
} from '../core/anschreiben/typen/skript.js';

vi.mock('../modules/skripte/SkriptPdf.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createSkriptAnhang: vi.fn(async (_subset, opts) => ({
      blob: new Blob(['%PDF']),
      dateiname: opts?.dateiname || 'skript.pdf',
    })),
  };
});

function chain(result) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return query;
}

beforeEach(() => {
  window.isInternal = () => true;
});

describe('skriptAdapter', () => {
  it('haengt Ansprechpartner an und ersetzt {{skript}} nur bei allen', async () => {
    const prepared = await skriptAdapter.prepare({
      dokumentId: 's1',
      skript: {
        id: 's1',
        titel: 'Hook',
        unternehmen_id: 'u1',
        marke_id: 'm1',
        kampagne_id: 'k1',
        kampagne: { kampagnenname: 'Sommer' },
      },
    });
    expect(prepared.extraTabs).toEqual(['ansprechpartner']);
    expect(typeof prepared.loadEmpfaengerScope).toBe('function');
    expect(prepared.rewriteMail('Skript: {{skript}}')).toBe('Skript: {{skript}}');
    prepared.anhang.alle = true;
    expect(prepared.rewriteMail('Skript: {{skript}}')).toBe('Skript: Sommer');
  });

  it('ohne Kampagne kein Umfang-Schalter', async () => {
    const prepared = await skriptAdapter.prepare({
      dokumentId: 's1',
      skript: { id: 's1', titel: 'Hook', unternehmen_id: 'u1' },
    });
    const host = document.createElement('div');
    prepared.mountExtras(host, { onChange() {} });
    expect(host.innerHTML).toBe('');
  });

  it('Anhang-Schalter erscheint erst bei allen Skripten', async () => {
    const anhang = { alle: false, proSkript: false, kampagneId: 'k1', kampagneName: 'Sommer' };
    const host = document.createElement('div');
    const onChange = vi.fn();
    renderSkriptSchalter(host, anhang, onChange);
    const umfang = host.querySelector('[data-skript-umfang]');
    const wrap = host.querySelector('[data-skript-anhang-wrap]');
    expect(wrap.hidden).toBe(true);
    umfang.checked = true;
    umfang.dispatchEvent(new Event('change'));
    expect(anhang.alle).toBe(true);
    expect(wrap.hidden).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    const pro = host.querySelector('[data-skript-anhang]');
    pro.checked = true;
    pro.dispatchEvent(new Event('change'));
    expect(anhang.proSkript).toBe(true);
  });
});

describe('loadSkriptPdfItems', () => {
  it('ordnet jedem Skript seinen Creator zu, leere Felder bleiben leer', async () => {
    const db = {
      from: vi.fn((table) => {
        if (table === 'skripte') {
          return chain({
            data: [
              {
                id: 's1',
                titel: 'Eins',
                hook: 'H1',
                hauptteil: '',
                cta: '',
                hook_visuell: 'V1',
                hauptteil_visuell: '',
                cta_visuell: '',
                produkt: { name: 'FORCE-FIT' },
                kampagne: { kampagnenname: 'Sommer' },
                unternehmen: { firmenname: 'VHV', logo_url: 'http://logo' },
                marke: null,
                strategie_item: null,
              },
              {
                id: 's2',
                titel: 'Zwei',
                hook: '',
                hauptteil: '',
                cta: '',
                hook_visuell: '',
                hauptteil_visuell: '',
                cta_visuell: '',
                strategie_item: {
                  video_link: 'https://instagram.com/reel/bea',
                  casting_eintrag: {
                    name: 'Bea',
                    link_instagram: 'https://www.instagram.com/aus-casting/',
                    link_tiktok: 'https://www.tiktok.com/@aus-casting',
                    creator: { vorname: 'Bea', nachname: 'B', profilbild_url: 'http://bea', instagram: 'bea' },
                  },
                },
              },
            ],
            error: null,
          });
        }
        return chain({
          data: [
            { skript_id: 's1', position: 1, kooperation: { creator: { vorname: 'Anna', nachname: 'A', profilbild_url: 'http://anna', instagram: '@anna' } } },
          ],
          error: null,
        });
      }),
    };
    const items = await loadSkriptPdfItems(db, {
      dokumentId: 's1',
      anhang: { alle: true, kampagneId: 'k1' },
    });
    expect(items).toHaveLength(2);
    expect(items[0].creator).toEqual({ name: 'Anna A', bildUrl: 'http://anna', instagram: '@anna' });
    expect(items[0].instagram).toBe('@anna');
    expect(items[0].hook).toBe('H1');
    expect(items[0].hauptteil).toBe('');
    expect(items[0].customerName).toBe('VHV');
    expect(items[0].produktName).toBe('FORCE-FIT');
    expect(items[0].videoUrl).toBe('');
    expect(items[1].videoUrl).toBe('https://instagram.com/reel/bea');
    expect(items[1].creator).toEqual({
      name: 'Bea B',
      bildUrl: 'http://bea',
      instagram: 'https://www.instagram.com/aus-casting/',
    });
    expect(items[1].instagram).toBe('https://www.instagram.com/aus-casting/');
    expect(items[1].tiktok).toBe('https://www.tiktok.com/@aus-casting');
    expect(items[0].tiktok).toBe('');
    expect(items[1].produktName).toBe('');
    expect(items[1].hook).toBe('');
    expect(items[0].creatorIds).toEqual([]);
    expect(items[1].creatorIds).toEqual([]);
  });
});

describe('Skript-Creator-Zuordnung', () => {
  const anna = { id: 'c-anna', vorname: 'Anna', nachname: 'A', mail: 'anna@x.de', profilbild_url: 'http://anna' };
  const bea = { id: 'c-bea', vorname: 'Bea', nachname: 'B', mail: 'bea@x.de', profilbild_url: 'http://bea' };

  it('nimmt Creator vom Kooperation-Video und ignoriert die Videoidee', () => {
    const profile = creatorProfileFuerSkript(
      { strategie_item: { casting_eintrag: { creator: bea } } },
      [{ kooperation: { creator: anna } }],
    );
    expect(profile.map((c) => c.id)).toEqual(['c-anna']);
  });

  it('faellt auf den Casting-Creator zurueck, wenn kein Video haengt', () => {
    const profile = creatorProfileFuerSkript(
      { strategie_item: { casting_eintrag: { creator: bea } } },
      [],
    );
    expect(profile.map((c) => c.id)).toEqual(['c-bea']);
  });

  it('ein Video ohne CRM-Creator blockiert den Casting-Fallback', () => {
    const profile = creatorProfileFuerSkript(
      { strategie_item: { casting_eintrag: { creator: bea } } },
      [{ kooperation: { creator: { vorname: 'Nur', nachname: 'Name' } } }],
    );
    expect(profile).toEqual([]);
  });

  it('filtert den Anhang nach Empfaenger', () => {
    const items = [
      { id: 's1', titel: 'Eins', creatorIds: ['c-anna'], creators: [anna], creator: { name: 'Anna A', bildUrl: 'http://anna' } },
      { id: 's2', titel: 'Zwei', creatorIds: ['c-bea'], creators: [bea], creator: { name: 'Bea B', bildUrl: 'http://bea' } },
      { id: 's3', titel: 'Beide', creatorIds: ['c-anna', 'c-bea'], creators: [anna, bea], creator: { name: 'Anna A', bildUrl: 'http://anna' } },
    ];
    const fuerAnna = skripteFuerEmpfaenger(items, { typ: 'creator', id: 'c-anna' });
    expect(fuerAnna.map((item) => item.id)).toEqual(['s1', 's3']);
    expect(fuerAnna[1].creator).toEqual({ name: 'Anna A', bildUrl: 'http://anna', instagram: '' });
    const fuerManagement = skripteFuerEmpfaenger(
      items,
      { typ: 'management', id: 'm1' },
      { m1: ['c-bea'] },
    );
    expect(fuerManagement.map((item) => item.id)).toEqual(['s2', 's3']);
    expect(skripteFuerEmpfaenger(items, { typ: 'ansprechpartner', id: 'ap1' })).toHaveLength(3);
  });

  it('Scope enthaelt nur Creator mit Mail und deren Management', async () => {
    const db = {
      from: vi.fn((table) => {
        if (table === 'skripte') {
          return chain({
            data: [{
              id: 's1',
              titel: 'Eins',
              strategie_item: { casting_eintrag: { creator: { ...bea, mail: '' } } },
            }],
            error: null,
          });
        }
        if (table === 'kooperation_videos') {
          return chain({
            data: [{ skript_id: 's1', kooperation: { creator: anna } }],
            error: null,
          });
        }
        return chain({
          data: [{ creator_id: 'c-anna', management: { id: 'm1', firmenname: 'Agentur', email: 'info@m.de' } }],
          error: null,
        });
      }),
    };
    const scope = await loadSkriptEmpfaengerScope(db, {
      dokumentId: 's1',
      anhang: { alle: false, kampagneId: 'k1', kampagneName: 'Sommer' },
    });
    expect(scope.creators.map((c) => c.id)).toEqual(['c-anna']);
    expect(scope.managements.map((m) => m.id)).toEqual(['m1']);
    expect(scope.managementCreators.m1).toEqual(['c-anna']);
    expect(scope.kampagne).toEqual({ id: 'k1', label: 'Sommer' });
    expect(db.from).not.toHaveBeenCalledWith('creator');
  });
});

describe('Skript-Pool', () => {
  it('laedt Skripte einmal fuer Scope, PDF und Versand, auch nach dem Umfang-Schalter', async () => {
    const prepared = await skriptAdapter.prepare({
      dokumentId: 's1',
      skript: {
        id: 's1',
        titel: 'Hook',
        unternehmen_id: 'u1',
        marke_id: 'm1',
        kampagne_id: 'k1',
        kampagne: { kampagnenname: 'Sommer' },
      },
    });
    const db = {
      from: vi.fn(() => chain({
        data: [
          { id: 's1', titel: 'Eins', strategie_item: null },
          { id: 's2', titel: 'Zwei', strategie_item: null },
        ],
        error: null,
      })),
    };

    await Promise.all([
      prepared.loadEmpfaengerScope(db),
      skriptAdapter.createPdf(prepared, db, {}),
    ]);
    prepared.anhang.alle = true;
    await Promise.all([
      prepared.loadEmpfaengerScope(db),
      skriptAdapter.createPdf(prepared, db, {}),
    ]);
    await skriptAdapter.buildAnhaenge(prepared, db, [
      { typ: 'ansprechpartner', id: 'ap1', email: 'a@b.de' },
    ]);

    const skriptLoads = db.from.mock.calls.filter((call) => call[0] === 'skripte');
    expect(skriptLoads).toHaveLength(1);
  });

  it('dropAnschreibenWarm laedt den Skript-Pool neu', async () => {
    const skript = {
      id: 's-warm',
      titel: 'Hook',
      unternehmen_id: 'u1',
      kampagne_id: 'k1',
      kampagne: { kampagnenname: 'Sommer' },
    };
    const db = {
      from: vi.fn(() => chain({
        data: [{ id: 's-warm', titel: 'Hook', strategie_item: null }],
        error: null,
      })),
    };
    const opts = { dokumentTyp: 'skript', dokumentId: 's-warm', skript, db };
    dropAnschreibenWarm('skript', 's-warm');
    await warmAnschreiben(opts);
    dropAnschreibenWarm('skript', 's-warm');
    await warmAnschreiben(opts);
    const skriptLoads = db.from.mock.calls.filter((call) => call[0] === 'skripte');
    expect(skriptLoads).toHaveLength(2);
  });
});
