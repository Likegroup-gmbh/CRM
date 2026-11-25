import { describe, expect, it } from 'vitest';
import { applyLinieWechsel, planLinieWechsel } from '../modules/kampagne/linieVerschieben.js';

const ziel = {
  briefingId: 'linie-ugc',
  produktionId: 'prod-ugc',
  kampagneId: 'kamp',
  konzeptId: 'konzept-ugc',
  castingId: 'casting-ugc',
  is_draft: false,
  budget: null
};

function basis(extra = {}) {
  return {
    kooperation: { id: 'koop-1', kampagne_id: 'kamp', briefing_id: 'linie-nano', produktion_id: 'prod-nano' },
    ziel,
    videos: [{ id: 'v1', strategie_item_id: 'idee-serum', skript_id: 'skript-hook', verkaufspreis_netto: 100 }],
    fremdeVideos: [],
    ideen: [{ id: 'idee-serum', strategie_id: 'konzept-nano', creator_auswahl_item_id: 'eintrag-lena' }],
    skripte: [{ id: 'skript-hook', strategie_item_id: 'idee-serum' }],
    eintraege: [{ id: 'eintrag-lena', creator_id: 'creator-lena', kategorie: 'Gesicht', nicht_umsetzen: false }],
    zielEintraege: [],
    zielKategorien: ['Gesicht'],
    vertraege: [{ id: 'vertrag-1', kooperation_id: 'koop-1', typ: 'Influencer Kooperation', produktion_id: 'prod-nano' }],
    verbrauch: 0,
    ...extra
  };
}

describe('planLinieWechsel', () => {
  it('zieht exklusive Idee, Skript und Erzeuger-Vertrag mit und den Eintrag selbst', () => {
    const plan = planLinieWechsel(basis());
    expect(plan.ok).toBe(true);
    expect(plan.kooperation).toEqual({ id: 'koop-1', briefing_id: 'linie-ugc', produktion_id: 'prod-ugc' });
    expect(plan.skripte).toEqual([{ id: 'skript-hook', briefing_id: 'linie-ugc', produktion_id: 'prod-ugc' }]);
    expect(plan.videoideen).toEqual([{ id: 'idee-serum', strategie_id: 'konzept-ugc' }]);
    expect(plan.casting.verschieben).toEqual([{
      eintragId: 'eintrag-lena',
      creator_auswahl_id: 'casting-ugc',
      kategorie: 'Gesicht',
      nicht_umsetzen: false
    }]);
    expect(plan.casting.kopieren).toEqual([]);
    expect(plan.vertraege).toEqual([{ id: 'vertrag-1', produktion_id: 'prod-ugc' }]);
  });

  it('lässt eine geteilte Idee und ihr Skript liegen', () => {
    const plan = planLinieWechsel(basis({
      fremdeVideos: [{ id: 'v-fremd', kooperation_id: 'koop-2', strategie_item_id: 'idee-serum', skript_id: null }],
      ideen: [
        { id: 'idee-serum', strategie_id: 'konzept-nano', creator_auswahl_item_id: 'eintrag-lena' },
        { id: 'idee-cleanser', strategie_id: 'konzept-nano', creator_auswahl_item_id: 'eintrag-lena' }
      ]
    }));
    expect(plan.ok).toBe(true);
    expect(plan.videoideen).toEqual([]);
    expect(plan.skripte).toEqual([]);
    expect(plan.casting.verschieben).toEqual([]);
    expect(plan.casting.kopieren).toEqual([]);
  });

  it('kopiert den Eintrag, wenn eine bleibende Idee ihn noch braucht', () => {
    const plan = planLinieWechsel(basis({
      videos: [
        { id: 'v1', strategie_item_id: 'idee-serum', skript_id: 'skript-hook', verkaufspreis_netto: 10 }
      ],
      ideen: [
        { id: 'idee-serum', strategie_id: 'konzept-nano', creator_auswahl_item_id: 'eintrag-lena' },
        { id: 'idee-cleanser', strategie_id: 'konzept-nano', creator_auswahl_item_id: 'eintrag-lena' }
      ]
    }));
    expect(plan.casting.kopieren).toEqual([{
      vonId: 'eintrag-lena',
      ideeIds: ['idee-serum'],
      creator_auswahl_id: 'casting-ugc',
      kategorie: 'Gesicht',
      nicht_umsetzen: false
    }]);
    expect(plan.casting.verschieben).toEqual([]);
    expect(plan.videoideen.map(idee => idee.id)).toEqual(['idee-serum']);
  });

  it('zeigt auf den vorhandenen Eintrag derselben Creator-ID und behält eine bekannte Kategorie', () => {
    const plan = planLinieWechsel(basis({
      zielEintraege: [{ id: 'eintrag-ziel', creator_id: 'creator-lena' }],
      zielKategorien: ['Gesicht']
    }));
    expect(plan.casting.wiederverwenden).toEqual([{ ideeId: 'idee-serum', eintragId: 'eintrag-ziel' }]);
    expect(plan.casting.verschieben).toEqual([]);
    expect(plan.casting.kopieren).toEqual([]);
  });

  it('behält Nicht umsetzen und lässt Contracting und mitgedeckte Verträge liegen', () => {
    const plan = planLinieWechsel(basis({
      eintraege: [{ id: 'eintrag-lena', creator_id: null, kategorie: 'Nicht umsetzen', nicht_umsetzen: true }],
      vertraege: [
        { id: 'vertrag-erzeuger', kooperation_id: 'koop-1', typ: 'UGC', produktion_id: 'prod-nano' },
        { id: 'vertrag-contracting', kooperation_id: 'koop-1', typ: 'Contracting', produktion_id: 'prod-nano' },
        { id: 'vertrag-andere', kooperation_id: 'koop-2', typ: 'UGC', produktion_id: 'prod-nano' }
      ]
    }));
    expect(plan.casting.verschieben[0]).toMatchObject({
      kategorie: 'Nicht umsetzen',
      nicht_umsetzen: true
    });
    expect(plan.vertraege).toEqual([{ id: 'vertrag-erzeuger', produktion_id: 'prod-ugc' }]);
  });

  it('sperrt das Überschreiten eines Produktionsbudgets, nicht denselben Topf ohne Budget', () => {
    const ueber = planLinieWechsel(basis({
      ziel: { ...ziel, budget: 150 },
      verbrauch: 80
    }));
    expect(ueber).toEqual({ ok: false, grund: 'budget' });

    const gleicherTopf = planLinieWechsel(basis({
      ziel: { ...ziel, budget: 150, produktionId: 'prod-nano' },
      verbrauch: 1000
    }));
    expect(gleicherTopf.ok).toBe(true);
  });

  it('lehnt andere Kampagne, Entwurf, dieselbe Linie und fehlendes Konzept ab', () => {
    expect(planLinieWechsel(basis({ ziel: { ...ziel, kampagneId: 'andere' } })).grund).toBe('andere_kampagne');
    expect(planLinieWechsel(basis({ ziel: { ...ziel, is_draft: true } })).grund).toBe('entwurf');
    expect(planLinieWechsel(basis({
      kooperation: { id: 'koop-1', kampagne_id: 'kamp', briefing_id: 'linie-ugc', produktion_id: 'prod-ugc' }
    })).grund).toBe('gleiche_linie');
    expect(planLinieWechsel(basis({ ziel: { ...ziel, konzeptId: null } })).grund).toBe('ziel_ohne_konzept');
  });

  it('eine Kooperation ohne Videos zieht weder Skript noch Idee mit', () => {
    const plan = planLinieWechsel(basis({ videos: [], skripte: [{ id: 'skript-hook', strategie_item_id: 'idee-serum' }] }));
    expect(plan.ok).toBe(true);
    expect(plan.skripte).toEqual([]);
    expect(plan.videoideen).toEqual([]);
  });
});

function speicher() {
  const tabellen = {
    kooperationen: [{ id: 'koop-1', briefing_id: 'linie-nano', produktion_id: 'prod-nano' }],
    skripte: [{ id: 'skript-hook', briefing_id: 'linie-nano', produktion_id: 'prod-nano', strategie_item_id: 'idee-serum' }],
    strategie_items: [{ id: 'idee-serum', strategie_id: 'konzept-nano', creator_auswahl_item_id: 'eintrag-lena', persona_id: 'anna', produkt_id: 'serum' }],
    creator_auswahl_items: [{ id: 'eintrag-lena', creator_auswahl_id: 'casting-nano', creator_id: 'creator-lena', kategorie: 'Gesicht', nicht_umsetzen: false, name: 'Lena' }],
    vertraege: [{ id: 'vertrag-1', produktion_id: 'prod-nano', kooperation_id: 'koop-1' }]
  };
  let seq = 0;
  const db = {
    tabellen,
    from(table) {
      const zeilen = tabellen[table];
      const state = { patch: null, insert: null };
      const api = {
        select() { return api; },
        eq(spalte, wert) {
          api._zeile = zeilen.find(row => row[spalte] === wert) || null;
          api._spalte = spalte;
          api._wert = wert;
          return api;
        },
        maybeSingle() {
          return Promise.resolve({ data: api._zeile ? { ...api._zeile } : null, error: null });
        },
        single() {
          if (!api._zeile && !state.insert) return Promise.resolve({ data: null, error: { message: 'fehlt' } });
          return Promise.resolve({ data: { ...(state.insert || api._zeile) }, error: null });
        },
        update(patch) {
          state.patch = patch;
          return api;
        },
        insert(payload) {
          seq += 1;
          const row = { ...payload, id: `neu-${seq}` };
          zeilen.push(row);
          state.insert = row;
          api._zeile = row;
          return api;
        },
        delete() {
          return {
            eq(spalte, wert) {
              tabellen[table] = tabellen[table].filter(row => row[spalte] !== wert);
              return Promise.resolve({ error: null });
            }
          };
        },
        then(resolve, reject) {
          if (state.patch && api._zeile) Object.assign(api._zeile, state.patch);
          return Promise.resolve({ error: null }).then(resolve, reject);
        }
      };
      return api;
    }
  };
  return db;
}

describe('applyLinieWechsel', () => {
  it('schreibt Kooperation, Skript, Idee und Eintrag und lässt Persona stehen', async () => {
    const db = speicher();
    const plan = planLinieWechsel(basis());
    await applyLinieWechsel(db, plan);
    expect(db.tabellen.kooperationen[0]).toMatchObject({ briefing_id: 'linie-ugc', produktion_id: 'prod-ugc' });
    expect(db.tabellen.skripte[0]).toMatchObject({ briefing_id: 'linie-ugc', produktion_id: 'prod-ugc' });
    expect(db.tabellen.strategie_items[0]).toMatchObject({
      strategie_id: 'konzept-ugc',
      creator_auswahl_item_id: 'eintrag-lena',
      persona_id: 'anna',
      produkt_id: 'serum'
    });
    expect(db.tabellen.creator_auswahl_items[0]).toMatchObject({
      creator_auswahl_id: 'casting-ugc',
      kategorie: 'Gesicht',
      nicht_umsetzen: false
    });
    expect(db.tabellen.vertraege[0].produktion_id).toBe('prod-ugc');
  });

  it('setzt geschriebene Zeilen zurück, wenn ein späterer Schreibvorgang fehlschlägt', async () => {
    const db = speicher();
    const plan = planLinieWechsel(basis());
    const original = db.from.bind(db);
    db.from = (table) => {
      const api = original(table);
      if (table === 'vertraege') {
        api.update = () => ({
          eq: () => Promise.resolve({ error: { message: 'vertrag gesperrt' } })
        });
      }
      return api;
    };
    await expect(applyLinieWechsel(db, plan)).rejects.toThrow('vertrag gesperrt');
    expect(db.tabellen.kooperationen[0]).toMatchObject({ briefing_id: 'linie-nano', produktion_id: 'prod-nano' });
    expect(db.tabellen.strategie_items[0].strategie_id).toBe('konzept-nano');
    expect(db.tabellen.creator_auswahl_items[0].creator_auswahl_id).toBe('casting-nano');
  });
});
