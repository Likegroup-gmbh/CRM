// BriefingPersistence.test.js
// Draft -> Laden -> Final-Lifecycle des Briefing-Generators.
// Testet saveCurrentStepData (DOM -> formData), prepareDataForDB
// (formData -> campaign_briefings-Payload) und loadFromDB gegen
// gemocktes Supabase.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BriefingCreate } from '../modules/briefing/create/BriefingCreateCore.js';
import { starteBriefingAuswertung } from '../modules/briefing/create/BriefingAuswertung.js';
import { renderField } from '../modules/briefing/create/FieldRenderer.js';
import '../modules/briefing/create/DataPersistence.js';
import '../modules/briefing/create/FormEvents.js';

vi.mock('../modules/briefing/create/BriefingAuswertung.js', () => ({
  starteBriefingAuswertung: vi.fn().mockResolvedValue({ id: 'job-1' })
}));

function createInstance() {
  const instance = new BriefingCreate();
  instance.selectedBereich = 'influencer_marketing';
  return instance;
}

function looseChain() {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    not: vi.fn(() => query),
    is: vi.fn(() => query),
    neq: vi.fn(() => query),
    limit: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    single: vi.fn(async () => ({ data: { id: 'row-1' }, error: null })),
    then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject)
  };
  return query;
}

function mockSupabase({ row = null, produkte = [] } = {}) {
  const calls = { insert: [], update: [], junctionInsert: [], junctionDelete: 0 };
  const sb = {
    from: vi.fn((table) => {
      if (table === 'produktion') {
        const chain = looseChain();
        chain.maybeSingle = vi.fn(async () => ({
          data: { id: 'pn1', name: 'Serum Sommer', kampagne_id: 'k1' },
          error: null
        }));
        return chain;
      }
      if (table === 'creator_auswahl' || table === 'strategie') {
        return looseChain();
      }
      if (table === 'campaign_briefing_produkt') {
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(async () => {
              calls.junctionDelete += 1;
              return { error: null };
            })
          })),
          insert: vi.fn(async (rows) => {
            calls.junctionInsert.push(rows);
            return { error: null };
          }),
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: produkte.map(p => ({ produkt_id: p.id, produkt: p })),
              error: null
            }))
          }))
        };
      }
      if (table === 'personas') {
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          not: vi.fn(() => chain),
          order: vi.fn(() => chain),
          then: (resolve) => resolve({ data: [], error: null })
        };
        return chain;
      }
      if (table === 'produkt') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({ data: [], error: null }))
            }))
          }))
        };
      }
      expect(table).toBe('campaign_briefings');
      return {
        insert: vi.fn((rows) => {
          calls.insert.push(rows[0]);
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: 'briefing-1' }, error: null }))
            }))
          };
        }),
        update: vi.fn((data) => {
          calls.update.push(data);
          return { eq: vi.fn(async () => ({ error: null })) };
        }),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: row, error: null }))
          }))
        }))
      };
    })
  };
  return { sb, calls };
}

describe('Briefing DataPersistence', () => {
  beforeEach(() => {
    window.toastSystem = { show: vi.fn() };
    window.navigateTo = vi.fn();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    starteBriefingAuswertung.mockClear();
    delete window.supabase;
  });

  it('saveCurrentStepData sammelt Felder typgerecht aus dem DOM', () => {
    document.body.innerHTML = `
      <form id="briefing-form">
        <input type="text" name="aktivierung_name" value="Fremdwert">
        <input type="checkbox" name="nischen" value="beauty" checked>
        <input type="checkbox" name="nischen" value="fashion">
        <input type="text" name="creator_merkmale__alter" value="25-34">
        <input type="text" name="creator_merkmale__geschlecht" value="">
        <input type="text" name="creator_merkmale__standort" value="">
        <input type="checkbox" name="publish_channels__instagram" value="reel" checked>
        <input type="checkbox" name="nutzung_markenkanal" value="true">
        <input type="hidden" name="nutzungsdauer" value="12 Monate">
      </form>
    `;

    const instance = createInstance();
    instance.saveCurrentStepData();

    expect(instance.formData).not.toHaveProperty('aktivierung_name');
    expect(instance.formData.nischen).toEqual(['beauty']);
    expect(instance.formData.creator_merkmale).toEqual({
      alter: '25-34', geschlecht: '', standort: ''
    });
    expect(instance.formData.publish_channels).toEqual({ instagram: ['reel'] });
    expect(instance.formData.nutzung_markenkanal).toBe(false);
    expect(instance.formData.nutzungsdauer).toBe('12 Monate');
    expect(instance.formData.bereich).toBe('influencer_marketing');
  });

  it('saveCurrentStepData liest die Videolänge aus dem Slider', () => {
    document.body.innerHTML = `
      <form id="briefing-form">
        <div data-sekunden-spanne="videolaenge" data-von="12" data-bis="14"></div>
      </form>
    `;
    const instance = createInstance();
    instance.saveCurrentStepData();
    expect(instance.formData.videolaenge).toEqual({ von: 12, bis: 14 });
  });

  it('Videolänge 15–20 zeigt beide Griffe und den Strich', () => {
    document.body.innerHTML = `<form id="briefing-form">${renderField({
      name: 'videolaenge', label: 'Videolänge in Sekunden', type: 'sekundenSpanne', min: 1, max: 180
    }, { videolaenge: { von: 15, bis: 20 } })}</form>`;

    const root = document.querySelector('[data-sekunden-spanne]');
    expect(root.querySelector('.sek-spanne').classList.contains('is-empty')).toBe(false);
    expect(document.querySelector('[data-sek="von"]').value).toBe('15');
    expect(document.querySelector('[data-sek="bis"]').value).toBe('20');
    expect(root.querySelector('[data-handle="von"]').style.left).not.toBe(root.querySelector('[data-handle="bis"]').style.left);
    expect(root.querySelector('[data-fill]').style.width).not.toBe('0%');
  });

  it('Blur auf einer leeren Seite setzt beide Sekunden, Leeren räumt ab', () => {
    document.body.innerHTML = `<form id="briefing-form">${renderField({
      name: 'videolaenge', label: 'Videolänge', type: 'sekundenSpanne', min: 1, max: 180
    }, {})}</form>`;
    const instance = new BriefingCreate();
    instance.bindSekundenSpanne();

    const von = document.querySelector('[data-sek="von"]');
    von.value = '8';
    von.dispatchEvent(new Event('blur'));

    const root = document.querySelector('[data-sekunden-spanne]');
    expect(root.dataset.von).toBe('8');
    expect(root.dataset.bis).toBe('8');
    expect(document.querySelector('[data-sek="bis"]').value).toBe('8');
    expect(root.querySelector('.sek-spanne').classList.contains('is-empty')).toBe(false);

    root.querySelector('[data-leeren]').click();
    expect(root.dataset.von).toBe('');
    expect(root.dataset.bis).toBe('');
    expect(root.querySelector('.sek-spanne').classList.contains('is-empty')).toBe(true);
  });

  it('prepareDataForDB leert Paid-Felder im Influencer-Briefing und spiegelt Prefix-Spalten', () => {
    const instance = createInstance();
    instance.formData = {
      bereich: 'influencer_marketing',
      unternehmen_id: 'u1',
      aktivierung_name: 'Test',
      nischen: ['beauty'],
      aufgabe: 'Routine filmen',
      cta: 'Shop now',
      funnel_stufen: ['upper']
    };

    const data = instance.prepareDataForDB();

    expect(data.nutzungsdauer).toBeNull();
    expect(data.nischen).toEqual(['beauty']);
    expect(data.aufgabe).toBe('Routine filmen');
    expect(data.cta).toBeNull();
    expect(data.funnel_stufen).toBeNull();
    expect(data.im_nischen).toEqual(['beauty']);
    expect(data.im_umsetzung).toBe('Routine filmen');
    expect(data).not.toHaveProperty('persona_ids');
    expect(data).not.toHaveProperty('produkt_ids');
  });

  it('prepareDataForDB speichert flache Voraussetzungen und Sonstige getrennt', () => {
    const instance = createInstance();
    instance.formData = {
      bereich: 'influencer_marketing',
      unternehmen_id: 'u1',
      aktivierung_name: 'Test',
      voraussetzungen: ['kind_familie', 'kueche'],
      voraussetzungen_sonstiges: 'Wohnung mit Balkon',
      produkt_erfahrung: 'kennt das Serum',
      nutzungsdauer: '90 Monate'
    };

    const data = instance.prepareDataForDB();

    expect(data.voraussetzungen).toEqual(['kind_familie', 'kueche']);
    expect(data.voraussetzungen_sonstiges).toBe('Wohnung mit Balkon');
    expect(data.produkt_erfahrung).toBe('kennt das Serum');
    expect(data.nutzungsdauer).toBe('90 Monate');
    expect(data.im_voraussetzungen).toEqual(['kind_familie', 'kueche']);
    expect(data.im_voraussetzungen_custom).toBe('kennt das Serum');
  });

  it('prepareDataForDB mappt leere Werte auf null und Checkboxen auf boolean', () => {
    const instance = createInstance();
    instance.formData = {
      bereich: 'influencer_marketing',
      unternehmen_id: 'u1',
      aktivierung_name: '',
      nutzung_markenkanal: undefined
    };

    const data = instance.prepareDataForDB();

    expect(data.aktivierung_name).toBeNull();
    expect(data.nutzung_markenkanal).toBe(false);
    expect(data.marke_id).toBeNull();
    expect(data.videolaenge_von).toBeNull();
    expect(data.videolaenge_bis).toBeNull();
    expect(data).not.toHaveProperty('videolaenge');
    expect(data).not.toHaveProperty('pa_videolaengen');
  });

  it('prepareDataForDB nimmt den Namen aus formData (Drawer, Bestand), sonst den Kampagnennamen', () => {
    const instance = createInstance();
    instance.kampagnen = [{ id: 'k1', label: 'Anzeige', kampagnenname: 'Projekt A' }];

    instance.formData = { kampagne_id: 'k1', aktivierung_name: 'Projekt A – Serum' };
    expect(instance.prepareDataForDB().aktivierung_name).toBe('Projekt A – Serum');

    instance.formData = { kampagne_id: 'k1' };
    expect(instance.prepareDataForDB().aktivierung_name).toBe('Projekt A');

    instance.formData = {};
    instance._produktionKontext = { kampagneId: 'k1' };
    expect(instance.prepareDataForDB().aktivierung_name).toBe('Projekt A');
  });

  it('handleSubmit bricht ab, wenn die Kampagne keinen Projektnamen liefert', async () => {
    const { sb, calls } = mockSupabase();
    window.supabase = sb;

    const instance = createInstance();
    instance.kampagnen = [{ id: 'k1', label: 'Anzeige', kampagnenname: '' }];
    instance.formData = { unternehmen_id: 'u1', kampagne_id: 'k1' };

    await instance.handleSubmit();

    expect(calls.insert.length).toBe(0);
    expect(window.toastSystem.show).toHaveBeenCalledWith(expect.stringContaining('Projektnamen'), 'warning');
  });

  it('prepareDataForDB schreibt das Sekundenintervall und lässt Altspalten weg', () => {
    const instance = createInstance();
    instance.selectedBereich = 'paid_creator_ads';
    instance.formData = {
      bereich: 'paid_creator_ads',
      unternehmen_id: 'u1',
      aktivierung_name: 'Ads',
      videolaenge: { von: 8, bis: 17 }
    };

    const data = instance.prepareDataForDB();

    expect(data.videolaenge_von).toBe(8);
    expect(data.videolaenge_bis).toBe(17);
    expect(data).not.toHaveProperty('videolaenge');
    expect(data).not.toHaveProperty('pa_videolaengen');
  });

  it('saveDraftToDB legt Entwurf an und setzt editId', async () => {
    vi.useFakeTimers();
    const { sb, calls } = mockSupabase();
    window.supabase = sb;

    const instance = createInstance();
    instance.formData = { unternehmen_id: 'u1', aktivierung_name: 'Draft' };

    await instance.saveDraftToDB();

    expect(calls.insert.length).toBe(1);
    expect(calls.insert[0].is_draft).toBe(true);
    expect(calls.insert[0].aktivierung_name).toBe('Draft');
    expect(calls.insert[0]).not.toHaveProperty('produkt_ids');
    expect(calls.insert[0]).not.toHaveProperty('persona_ids');
    expect(instance.editId).toBe('briefing-1');
    expect(calls.junctionDelete).toBe(0);
    expect(calls.junctionInsert).toEqual([]);
    vi.useRealTimers();
  });

  it('handleSubmit aktualisiert bestehendes Briefing als final', async () => {
    vi.useFakeTimers();
    const { sb, calls } = mockSupabase();
    window.supabase = sb;

    const instance = createInstance();
    instance.editId = 'briefing-1';
    instance.formData = {
      unternehmen_id: 'u1',
      aktivierung_name: 'Final',
      kampagne_id: 'k1',
      produktion_id: 'pn1',
      produkt_id: 'p1'
    };

    await instance.handleSubmit();

    expect(calls.update.length).toBe(1);
    expect(calls.update[0].is_draft).toBe(false);
    expect(calls.insert.length).toBe(0);
    expect(starteBriefingAuswertung).toHaveBeenCalledWith({ briefingId: 'briefing-1' });
    expect(window.toastSystem.show).toHaveBeenCalledWith(
      'Briefing gespeichert – KI-Auswertung läuft im Hintergrund',
      'success'
    );
    vi.useRealTimers();
  });

  it('handleSubmit kehrt zur Herkunft zurück, nicht in die Produktion', async () => {
    vi.useFakeTimers();
    const { sb } = mockSupabase();
    window.supabase = sb;
    const submit = async () => {
      const instance = createInstance();
      instance.editId = 'briefing-1';
      instance.formData = { unternehmen_id: 'u1', aktivierung_name: 'Final', kampagne_id: 'k1', produktion_id: 'pn1' };
      await instance.handleSubmit();
      vi.advanceTimersByTime(500);
    };

    try {
      window.history.replaceState({
        route: '/briefing/briefing-1/edit',
        trail: [{ label: 'Briefings', url: '/briefing?status=offen' }, { label: 'Final', url: '/briefing/briefing-1' }]
      }, '', '/briefing/briefing-1/edit');
      await submit();
      expect(window.navigateTo).toHaveBeenLastCalledWith('/briefing/briefing-1');

      window.history.replaceState({ route: '/briefing/new', trail: [] }, '', '/briefing/new');
      await submit();
      expect(window.navigateTo).toHaveBeenLastCalledWith('/briefing/briefing-1');

      window.history.replaceState({
        route: '/briefing/new',
        trail: [{ label: 'Serum', url: '/produktion/p1?tab=briefing' }]
      }, '', '/briefing/new');
      await submit();
      expect(window.navigateTo).toHaveBeenLastCalledWith('/produktion/p1?tab=briefing');
    } finally {
      window.history.replaceState(null, '', '/');
      vi.useRealTimers();
    }
  });

  it('handleSubmit bricht ohne Pflichtfelder ab', async () => {
    const { sb, calls } = mockSupabase();
    window.supabase = sb;

    const instance = createInstance();
    instance.formData = { aktivierung_name: 'Ohne Unternehmen' };

    await instance.handleSubmit();

    expect(calls.insert.length).toBe(0);
    expect(calls.update.length).toBe(0);
    expect(starteBriefingAuswertung).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith(expect.stringContaining('Unternehmen'), 'warning');
  });

  it('loadFromDB befuellt formData und springt in den Wizard', async () => {
    const row = {
      id: 'briefing-1',
      bereich: 'paid_creator_ads',
      unternehmen_id: 'u1',
      marke_id: 'm1',
      aktivierung_name: 'Paid Push',
      beschreibung: 'Launch',
      paid_objectives: ['sales'],
      persona_ids: ['pe1'],
      voraussetzungen: ['kind_familie', 'kueche']
    };
    const { sb } = mockSupabase({ row, produkte: [{ id: 'p1', name: 'Serum' }] });
    window.supabase = sb;

    const instance = new BriefingCreate();
    await instance.loadFromDB('briefing-1');

    expect(instance.selectedBereich).toBe('paid_creator_ads');
    expect(instance.isGenerated).toBe(true);
    expect(instance.currentStep).toBe(2);
    expect(instance.formData.aktivierung_name).toBe('Paid Push');
    expect(instance.formData.paid_objectives).toEqual(['sales']);
    expect(instance.formData.beschreibung).toBe('Launch');
    expect(instance.formData.voraussetzungen).toEqual(['kind_familie', 'kueche']);
    expect(instance.formData.voraussetzungen_weiter).toBeUndefined();
    expect(instance.formData.marke_id).toBe('m1');
    expect(instance.formData).not.toHaveProperty('produkt_ids');
    expect(instance.formData).not.toHaveProperty('persona_ids');
  });

  it('loadFromDB übersetzt alte Tokens in das Intervall', async () => {
    const row = {
      id: 'briefing-1',
      bereich: 'paid_creator_ads',
      unternehmen_id: 'u1',
      aktivierung_name: 'Paid Push',
      videolaengen: ['15s', '60s'],
      pa_videolaengen: ['6s']
    };
    const { sb } = mockSupabase({ row });
    window.supabase = sb;

    const instance = new BriefingCreate();
    await instance.loadFromDB('briefing-1');

    expect(instance.formData.videolaenge).toEqual({ von: 15, bis: 60 });
  });
});
