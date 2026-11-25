// BriefingProduktSync.test.js
// Produkte aus dem Briefing (ADR 0074): Dublette verknüpfen, Eingabe gewinnt,
// Auslesen füllt nur Leeres, angelegt wird auch im Entwurf.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalisiereProduktUrl,
  findeDublette,
  eingabeAenderungen,
  auslesenAenderungen,
  platzhalterName,
  istPlatzhalter,
  syncEintrag
} from '../modules/briefing/create/briefingProduktSync.js';
import { createInstance } from './briefingCreateTestKit.js';

/** produkt / produkt_marke / campaign_briefing_produkt als Arrays, Filter über eq. */
function memoryDb(produkte = []) {
  const rows = { produkt: produkte.map(p => ({ ...p })), produkt_marke: [], campaign_briefing_produkt: [] };
  let seq = 0;
  const from = (table) => {
    const filter = [];
    let patch = null;
    const treffer = () => rows[table].filter(r => filter.every(([k, v]) => r[k] === v));
    const q = {
      select: () => q,
      eq: (k, v) => { filter.push([k, v]); return q; },
      update: (p) => { patch = p; return q; },
      insert: (r) => {
        const neu = (Array.isArray(r) ? r : [r]).map(x => ({ id: x.id || `neu-${++seq}`, ...x }));
        rows[table].push(...neu);
        return { select: () => ({ single: async () => ({ data: neu[0], error: null }) }), then: (res) => res({ error: null }) };
      },
      upsert: async (r) => { rows[table].push(r); return { error: null }; },
      maybeSingle: async () => ({ data: treffer()[0] || null, error: null }),
      then: (res, rej) => {
        if (patch) treffer().forEach(r => Object.assign(r, patch));
        return Promise.resolve({ data: treffer(), error: null }).then(res, rej);
      }
    };
    return q;
  };
  return { rows, from };
}

describe('Dubletten-Regel', () => {
  it('Link zählt nur mit Pfad, ohne www, Query und Schluss-Slash', () => {
    expect(normalisiereProduktUrl('https://www.Shop.de/serum/?ref=1#x')).toBe('shop.de/serum');
    expect(normalisiereProduktUrl('shop.de/serum/')).toBe('shop.de/serum');
    expect(normalisiereProduktUrl('https://shop.de/')).toBe('');
  });

  it('erst gleicher Link, dann gleicher Name; die Startseite ist kein Treffer', () => {
    const katalog = [
      { id: 'a', name: 'Serum', url: 'https://shop.de/serum' },
      { id: 'b', name: 'Crème Hydra', url: 'https://shop.de/' }
    ];
    expect(findeDublette(katalog, { name: 'Anders', url: 'https://www.shop.de/serum?utm=1' }).id).toBe('a');
    expect(findeDublette(katalog, { name: 'creme  hydra!' }).id).toBe('b');
    expect(findeDublette(katalog, { url: 'https://shop.de/' })).toBeNull();
    expect(findeDublette(katalog, { name: 'Neu' })).toBeNull();
  });
});

describe('Eingabe gewinnt, Auslesen füllt nur Leeres', () => {
  it('nur gefüllte, abweichende Eingaben werden geschrieben', () => {
    expect(eingabeAenderungen(
      { name: 'Serum', url: 'https://a.de/s', usp: 'Alt' },
      { name: 'Serum', url: '', usp: 'Neu', loesung: ' Hilft ' }
    )).toEqual({ usp: 'Neu', loesung: 'Hilft' });
  });

  it('andere Schreibweise desselben Namens benennt nicht um, ein Platzhalter schon', () => {
    expect(eingabeAenderungen({ name: 'Hydra Serum' }, { name: 'hydra-serum' })).toEqual({});
    expect(eingabeAenderungen({ name: 'Hydra Serum' }, { name: 'Hydra Serum Plus' })).toEqual({ name: 'Hydra Serum Plus' });
    expect(eingabeAenderungen({ name: 'Produkt von shop.de' }, { name: 'Hydra' })).toEqual({ name: 'Hydra' });
  });

  it('Auslesen überschreibt nichts, ein Platzhalter-Name gilt als leer', () => {
    const produkt = { name: platzhalterName('https://www.shop.de/serum'), kurzbeschreibung: 'Eigene', usp: null };
    expect(produkt.name).toBe('Produkt von shop.de');
    expect(istPlatzhalter(produkt.name)).toBe(true);
    expect(auslesenAenderungen(produkt, {
      name: { value: 'Hydra Serum' },
      kurzbeschreibung: { value: 'Vom Shop' },
      usp: { value: 'Zieht schnell ein' },
      preis_von: { value: '19,90' }
    })).toEqual({ name: 'Hydra Serum', usp: 'Zieht schnell ein', preis_von: 19.9 });
  });
});

describe('syncEintrag', () => {
  afterEach(() => {
    delete window.supabase;
  });

  it('verknüpft eine Dublette, schreibt die Eingabe und setzt keine Marke', async () => {
    const db = memoryDb([{ id: 'p1', unternehmen_id: 'u1', name: 'Serum', url: 'https://shop.de/serum', usp: 'Alt' }]);
    window.supabase = { from: db.from };

    const ergebnis = await syncEintrag({ name: 'Anders', url: 'https://shop.de/serum/', usp: 'Neu' }, { unternehmenId: 'u1', markeId: 'm1' });
    expect(ergebnis).toMatchObject({ id: 'p1', art: 'verknuepft', urlNeu: true });
    expect(db.rows.produkt).toHaveLength(1);
    expect(db.rows.produkt[0]).toMatchObject({ name: 'Anders', usp: 'Neu' });
    expect(db.rows.produkt_marke).toEqual([]);
  });

  it('legt neu an, mit Platzhalter-Namen bei nur einem Link und der Marke', async () => {
    const db = memoryDb([]);
    window.supabase = { from: db.from };

    const ergebnis = await syncEintrag({ url: 'https://www.shop.de/creme' }, { unternehmenId: 'u1', markeId: 'm1' });
    expect(ergebnis.art).toBe('angelegt');
    expect(db.rows.produkt[0]).toMatchObject({ unternehmen_id: 'u1', name: 'Produkt von shop.de', url: 'https://www.shop.de/creme' });
    expect(db.rows.produkt_marke).toEqual([{ produkt_id: ergebnis.id, marke_id: 'm1' }]);
  });

  it('ohne Name und Link passiert nichts', async () => {
    const db = memoryDb([]);
    window.supabase = { from: db.from };
    expect(await syncEintrag({ usp: 'Nur Text' }, { unternehmenId: 'u1' })).toBeNull();
    expect(db.rows.produkt).toEqual([]);
  });
});

describe('Produkte im Entwurf', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.toastSystem = { show: vi.fn() };
  });

  afterEach(() => {
    delete window.supabase;
  });

  it('nach dem Speichern werden offene Einträge angelegt und alle ans Briefing gehängt', async () => {
    const db = memoryDb([{ id: 'p1', unternehmen_id: 'u1', name: 'Serum', url: null }]);
    window.supabase = { from: db.from };

    const instance = createInstance();
    instance.editId = 'b1';
    instance.formData = { unternehmen_id: 'u1', produkte: [{ name: 'serum' }, { name: 'Neue Creme' }] };
    await instance.produkteVerknuepfen();

    expect(db.rows.produkt.map(p => p.name)).toEqual(['Serum', 'Neue Creme']);
    expect(db.rows.campaign_briefing_produkt.map(r => [r.briefing_id, r.produkt_id]))
      .toEqual([['b1', 'p1'], ['b1', instance.formData.produkte[1].produkt_id]]);
  });

  it('in der Einladung wird nichts angelegt', async () => {
    const db = memoryDb([]);
    window.supabase = { from: db.from };
    const instance = createInstance();
    instance.editId = 'b1';
    instance.produktSyncAus = true;
    instance.formData = { unternehmen_id: 'u1', produkte: [{ name: 'Neu' }] };
    await instance.produkteVerknuepfen();
    expect(db.rows.produkt).toEqual([]);
  });
});
