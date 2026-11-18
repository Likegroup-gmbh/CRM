// BriefingSpeichern.test.js
// Entwurf, Finalisieren und Laden des Briefing-Generators gegen gemocktes Supabase.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BriefingCreate } from '../modules/briefing/create/BriefingCreateCore.js';
import { starteBriefingAuswertung } from '../modules/briefing/create/BriefingAuswertung.js';
import { formDataAusBriefing } from '../modules/briefing/create/BriefingSpeichern.js';
import { createInstance, mockSupabase } from './briefingCreateTestKit.js';

vi.mock('../modules/briefing/create/BriefingAuswertung.js', () => ({
  starteBriefingAuswertung: vi.fn().mockResolvedValue({ id: 'job-1' })
}));

beforeEach(() => {
  window.toastSystem = { show: vi.fn() };
  window.navigateTo = vi.fn();
  document.body.innerHTML = '';
});

afterEach(() => {
  starteBriefingAuswertung.mockClear();
  delete window.supabase;
  vi.useRealTimers();
});

describe('Entwurf und Finalisieren', () => {
  it('saveDraftToDB legt einen Entwurf an und hängt verknüpfte Produkte ans Briefing', async () => {
    vi.useFakeTimers();
    const { sb, calls } = mockSupabase();
    window.supabase = sb;

    const instance = createInstance();
    instance.formData = { unternehmen_id: 'u1', aktivierung_name: 'Draft', produkte: [{ produkt_id: 'p1', name: 'Serum' }] };
    await instance.saveDraftToDB();

    expect(calls.insert).toHaveLength(1);
    expect(calls.insert[0]).toMatchObject({ is_draft: true, aktivierung_name: 'Draft' });
    expect(calls.insert[0]).not.toHaveProperty('produkte');
    expect(instance.editId).toBe('briefing-1');
    expect(calls.junctionInsert).toEqual([[{ briefing_id: 'briefing-1', produkt_id: 'p1' }]]);
  });

  it('handleSubmit aktualisiert ein bestehendes Briefing als final und startet die Auswertung', async () => {
    vi.useFakeTimers();
    const { sb, calls } = mockSupabase();
    window.supabase = sb;

    const instance = createInstance();
    instance.editId = 'briefing-1';
    instance.formData = { unternehmen_id: 'u1', aktivierung_name: 'Final', kampagne_id: 'k1', produktion_id: 'pn1', nutzung_paid_media: true };
    await instance.handleSubmit();

    expect(calls.update).toHaveLength(1);
    expect(calls.update[0].is_draft).toBe(false);
    expect(calls.insert).toHaveLength(0);
    expect(starteBriefingAuswertung).toHaveBeenCalledWith({ briefingId: 'briefing-1' });
    expect(window.toastSystem.show).toHaveBeenCalledWith('Briefing gespeichert – KI-Auswertung läuft im Hintergrund', 'success');
  });

  it('handleSubmit kehrt zur Herkunft zurück, aus der Produktion auf das Briefing-Tab', async () => {
    vi.useFakeTimers();
    const { sb } = mockSupabase();
    window.supabase = sb;
    const submit = async () => {
      const instance = createInstance();
      instance.editId = 'briefing-1';
      instance.formData = { unternehmen_id: 'u1', aktivierung_name: 'Final', kampagne_id: 'k1', produktion_id: 'pn1', nutzung_paid_media: true };
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

      window.history.replaceState({
        route: '/briefing/new',
        trail: [{ label: 'Serum', url: '/produktion/p1?tab=casting&linie=alt' }]
      }, '', '/briefing/new');
      await submit();
      expect(window.navigateTo).toHaveBeenLastCalledWith('/produktion/p1?tab=briefing&linie=briefing-1');
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('handleSubmit bricht ohne Zuordnung, Kampagnentitel oder Content-Verwendung ab', async () => {
    const { sb, calls } = mockSupabase();
    window.supabase = sb;

    const ohneUnternehmen = createInstance();
    ohneUnternehmen.formData = { aktivierung_name: 'X' };
    await ohneUnternehmen.handleSubmit();
    expect(window.toastSystem.show).toHaveBeenLastCalledWith(expect.stringContaining('Unternehmen'), 'warning');

    const ohneTitel = createInstance();
    ohneTitel.kampagnen = [{ id: 'k1', label: 'Anzeige', kampagnenname: '' }];
    ohneTitel.formData = { unternehmen_id: 'u1', kampagne_id: 'k1' };
    await ohneTitel.handleSubmit();
    expect(window.toastSystem.show).toHaveBeenLastCalledWith(expect.stringContaining('Kampagnentitel'), 'warning');

    const ohneNutzung = createInstance();
    ohneNutzung.formData = { unternehmen_id: 'u1', aktivierung_name: 'X', kampagne_id: 'k1', produktion_id: 'pn1' };
    await ohneNutzung.handleSubmit();
    expect(window.toastSystem.show).toHaveBeenLastCalledWith(expect.stringContaining('Content verwendet'), 'warning');

    expect(calls.insert).toHaveLength(0);
    expect(calls.update).toHaveLength(0);
    expect(starteBriefingAuswertung).not.toHaveBeenCalled();
  });
});

describe('Laden', () => {
  it('loadFromDB füllt formData, Produkte live aus dem Katalog, springt in den Wizard', async () => {
    const row = {
      id: 'briefing-1',
      bereich: 'paid_creator_ads',
      unternehmen_id: 'u1',
      marke_id: 'm1',
      aktivierung_name: 'Paid Push',
      kernbotschaft: 'Spart Zeit',
      videolaenge_von: 30,
      videolaenge_bis: null,
      persona_ids: ['pe1']
    };
    const { sb } = mockSupabase({ row, produkte: [{ id: 'p1', name: 'Serum', url: 'https://shop.example/serum' }] });
    window.supabase = sb;

    const instance = new BriefingCreate();
    await instance.loadFromDB('briefing-1');

    expect(instance.selectedBereich).toBe('paid_creator_ads');
    expect(instance.currentStep).toBe(1);
    expect(instance.formData.nutzung_paid_media).toBe(true);
    expect(instance.formData).toMatchObject({ aktivierung_name: 'Paid Push', kernbotschaft: 'Spart Zeit', marke_id: 'm1' });
    expect(instance.formData.videolaenge).toEqual({ von: 30, bis: null });
    expect(instance.formData.produkte).toEqual([
      { produkt_id: 'p1', name: 'Serum', url: 'https://shop.example/serum', kurzbeschreibung: '', usp: '', loesung: '' }
    ]);
    expect(instance.formData).not.toHaveProperty('persona_ids');
  });

  it('formDataAusBriefing: ältere Briefings über die Altspalten', () => {
    const formData = formDataAusBriefing({
      bereich: 'influencer_marketing',
      im_umsetzung: 'Routine filmen',
      im_situationen: 'Küche',
      im_channels: { tiktok: true },
      im_ideen_text: 'Unboxing',
      videolaengen: ['15s', '60s'],
      cta: 'Link in Bio'
    });
    expect(formData).toMatchObject({
      aufgabe: 'Routine filmen',
      setting: 'Küche',
      plattformen: ['tiktok'],
      videolaenge: { von: 15, bis: 60 },
      umsetzungsideen_eintraege: [{ text: 'Unboxing', verbindlich: false }]
    });
    expect(formData).not.toHaveProperty('cta');
  });
});
