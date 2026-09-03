// BriefingPersistence.test.js
// Draft -> Laden -> Final-Lifecycle des Briefing-Generators.
// Testet saveCurrentStepData (DOM -> formData), prepareDataForDB
// (formData -> campaign_briefings-Payload) und loadFromDB gegen
// gemocktes Supabase.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BriefingCreate } from '../modules/briefing/create/BriefingCreateCore.js';
import { starteBriefingAuswertung } from '../modules/briefing/create/BriefingAuswertung.js';
import '../modules/briefing/create/DataPersistence.js';

vi.mock('../modules/briefing/create/BriefingAuswertung.js', () => ({
  starteBriefingAuswertung: vi.fn().mockResolvedValue({ id: 'job-1' })
}));

function createInstance() {
  const instance = new BriefingCreate();
  instance.selectedBereich = 'influencer_marketing';
  return instance;
}

function mockSupabase({ row = null, produkte = [] } = {}) {
  const calls = { insert: [], update: [], junctionInsert: [], junctionDelete: 0 };
  const sb = {
    from: vi.fn((table) => {
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
        <input type="text" name="aktivierung_name" value="Summer Glow">
        <input type="radio" name="ansatz" value="kampagne" checked>
        <input type="checkbox" name="im_keine_benchmarks" checked>
        <input type="checkbox" name="im_funnel_stufen" value="upper" checked>
        <input type="checkbox" name="im_funnel_stufen" value="lower">
        <input type="checkbox" name="maerkte" value="deutschland" checked>
        <input type="text" name="maerkte__custom" value="USA, UK">
        <input type="text" name="im_creator_merkmale__alter" value="25-34">
        <input type="text" name="im_creator_merkmale__geschlecht" value="">
        <input type="text" name="im_creator_merkmale__standort" value="">
        <input type="text" name="im_creator_merkmale__expertise" value="">
        <input type="text" name="im_creator_merkmale__sonstiges" value="">
        <input type="checkbox" name="im_channels__instagram" value="reel" checked>
        <input type="checkbox" name="im_channels__instagram" value="story">
        <div data-repeatable="im_kpis">
          <div data-repeatable-row>
            <select data-kpi><option value="reichweite" selected>Reichweite</option></select>
            <input data-zielwert value="100k">
          </div>
          <div data-repeatable-row>
            <select data-kpi><option value="" selected>-</option></select>
            <input data-zielwert value="">
          </div>
        </div>
      </form>
    `;

    const instance = createInstance();
    instance.saveCurrentStepData();

    expect(instance.formData.aktivierung_name).toBe('Summer Glow');
    expect(instance.formData.ansatz).toBe('kampagne');
    expect(instance.formData.im_keine_benchmarks).toBe(true);
    expect(instance.formData.im_funnel_stufen).toEqual(['upper']);
    expect(instance.formData.maerkte).toEqual(['deutschland', 'USA', 'UK']);
    expect(instance.formData.im_creator_merkmale).toEqual({
      alter: '25-34', geschlecht: '', standort: '', expertise: '', sonstiges: ''
    });
    expect(instance.formData.im_channels).toEqual({ instagram: ['reel'] });
    expect(instance.formData.im_kpis).toEqual([{ kpi: 'reichweite', zielwert: '100k' }]);
    expect(instance.formData.bereich).toBe('influencer_marketing');
  });

  it('saveCurrentStepData sammelt produkt_ids aus der Multi-Auswahl', () => {
    document.body.innerHTML = `
      <form id="briefing-form">
        <div data-entity-multi="produkt_ids">
          <select id="produkt_ids" name="produkt_ids" multiple>
            <option value="p1" selected>Serum</option>
            <option value="p2">Creme</option>
            <option value="p3" selected>Toner</option>
          </select>
        </div>
      </form>
    `;

    const instance = createInstance();
    instance.saveCurrentStepData();
    expect(instance.formData.produkt_ids).toEqual(['p1', 'p3']);
  });

  it('saveCurrentStepData liest produkt_ids aus dem Hidden-Select des Tag-Widgets', () => {
    document.body.innerHTML = `
      <form id="briefing-form">
        <div data-entity-multi="produkt_ids">
          <input type="text" id="produkt_ids" name="produkt_ids">
          <select id="produkt_ids_hidden" name="produkt_ids[]" multiple>
            <option value="p1" selected>Serum</option>
            <option value="p3" selected>Toner</option>
          </select>
        </div>
      </form>
    `;

    const instance = createInstance();
    instance.saveCurrentStepData();
    expect(instance.formData.produkt_ids).toEqual(['p1', 'p3']);
  });

  it('prepareDataForDB leert Felder mit nicht erfuellter Condition', () => {
    const instance = createInstance();
    instance.formData = {
      bereich: 'influencer_marketing',
      unternehmen_id: 'u1',
      aktivierung_name: 'Test',
      ansatz: 'always_on',
      // gehoert zu ansatz=kampagne -> muss geleert werden
      kampagne_thema: 'Alt-Text',
      kampagnentypen: ['produktlaunch'],
      // gehoert zu ansatz=always_on -> darf bleiben
      always_on_thema: 'Dauerbrenner'
    };

    const data = instance.prepareDataForDB();

    expect(data.kampagne_thema).toBeNull();
    expect(data.kampagnentypen).toBeNull();
    expect(data.always_on_thema).toBe('Dauerbrenner');
    expect(data.bereich).toBe('influencer_marketing');
  });

  it('prepareDataForDB leert Modul-Felder der nicht gewaehlten Bereiche', () => {
    const instance = createInstance();
    instance.formData = {
      bereich: 'influencer_marketing',
      unternehmen_id: 'u1',
      aktivierung_name: 'Test',
      im_funnel_stufen: ['upper'],
      pa_objectives: ['sales'],
      pa_channels: { meta: ['instagram'] },
      os_content_ziele: ['reichweite']
    };

    const data = instance.prepareDataForDB();

    expect(data.im_funnel_stufen).toEqual(['upper']);
    expect(data.pa_objectives).toBeNull();
    expect(data.pa_channels).toBeNull();
    expect(data.os_content_ziele).toBeNull();
  });

  it('prepareDataForDB mappt leere Werte auf null und Checkboxen auf boolean', () => {
    const instance = createInstance();
    instance.formData = {
      bereich: 'influencer_marketing',
      unternehmen_id: 'u1',
      aktivierung_name: '',
      im_keine_benchmarks: undefined,
      im_funnel_stufen: []
    };

    const data = instance.prepareDataForDB();

    expect(data.aktivierung_name).toBeNull();
    expect(data.im_keine_benchmarks).toBe(false);
    expect(data.im_funnel_stufen).toBeNull();
    expect(data.marke_id).toBeNull();
  });

  it('prepareDataForDB koerziert Boolean-Radios auf false statt null (NOT-NULL-Spalten)', () => {
    const instance = createInstance();
    instance.formData = {
      bereich: 'influencer_marketing',
      unternehmen_id: 'u1',
      // zusaetzliche_sprachen: Boolean-Radio, unbeantwortet
      // im_learnings_vorhanden: Boolean-Radio, beantwortet
      im_learnings_vorhanden: true,
      // ansatz: Text-Radio, unbeantwortet -> darf null bleiben (nullable Spalte)
    };

    const data = instance.prepareDataForDB();

    expect(data.zusaetzliche_sprachen).toBe(false);
    expect(data.im_learnings_vorhanden).toBe(true);
    expect(data.pa_learnings_vorhanden).toBe(false); // anderer Bereich -> Default false, nicht null
    expect(data.os_learnings_vorhanden).toBe(false);
    expect(data.ansatz).toBeNull();
  });

  it('saveDraftToDB legt Entwurf an und setzt editId', async () => {
    vi.useFakeTimers();
    const { sb, calls } = mockSupabase();
    window.supabase = sb;

    const instance = createInstance();
    instance.formData = { unternehmen_id: 'u1', aktivierung_name: 'Draft', produkt_ids: ['p1', 'p2'] };

    await instance.saveDraftToDB();

    expect(calls.insert.length).toBe(1);
    expect(calls.insert[0].is_draft).toBe(true);
    expect(calls.insert[0].aktivierung_name).toBe('Draft');
    expect(calls.insert[0]).not.toHaveProperty('produkt_ids');
    expect(instance.editId).toBe('briefing-1');
    expect(calls.junctionDelete).toBe(1);
    expect(calls.junctionInsert[0]).toEqual([
      { briefing_id: 'briefing-1', produkt_id: 'p1' },
      { briefing_id: 'briefing-1', produkt_id: 'p2' }
    ]);
    vi.useRealTimers();
  });

  it('handleSubmit aktualisiert bestehendes Briefing als final', async () => {
    vi.useFakeTimers();
    const { sb, calls } = mockSupabase();
    window.supabase = sb;

    const instance = createInstance();
    instance.editId = 'briefing-1';
    instance.formData = { unternehmen_id: 'u1', aktivierung_name: 'Final' };

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
      ansatz: 'kampagne',
      kampagne_thema: 'Launch',
      pa_objectives: ['sales'],
      im_funnel_stufen: null
    };
    const { sb } = mockSupabase({ row, produkte: [{ id: 'p1', name: 'Serum' }] });
    window.supabase = sb;

    const instance = new BriefingCreate();
    await instance.loadFromDB('briefing-1');

    expect(instance.selectedBereich).toBe('paid_creator_ads');
    expect(instance.isGenerated).toBe(true);
    expect(instance.currentStep).toBe(2);
    expect(instance.formData.aktivierung_name).toBe('Paid Push');
    expect(instance.formData.pa_objectives).toEqual(['sales']);
    // null-Spalten landen nicht in formData
    expect(instance.formData).not.toHaveProperty('im_funnel_stufen');
    expect(instance.formData.marke_id).toBe('m1');
    expect(instance.formData.produkt_ids).toEqual(['p1']);
  });
});
