// BriefingPersistence.test.js
// Formular -> formData (saveCurrentStepData) -> campaign_briefings-Payload (prepareDataForDB).

import { describe, it, expect, beforeEach } from 'vitest';
import { createInstance, renderFormular } from './briefingCreateTestKit.js';
import { ideenFuerDB } from '../modules/briefing/create/DataPersistence.js';

describe('saveCurrentStepData', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('liest das gerenderte Formular verlustfrei zurück', () => {
    const formData = {
      aktivierung_name: 'Sommer-Launch',
      nutzung_markenkanal: true,
      plattformen: ['instagram', 'tiktok'],
      plattformen_weitere: 'Snapchat',
      seitenverhaeltnisse: ['9:16'],
      videolaenge: { von: 15, bis: 20 },
      nutzungsrechte: '6 Monate',
      content_deadline: '2026-12-01',
      content_deadline_bis: '2026-12-05',
      kernbotschaft: 'Spart Zeit',
      vorgabe_donts: 'Keine Konkurrenz',
      umsetzungsideen_eintraege: [{ text: 'Unboxing', verbindlich: true }, { text: 'Morgenroutine', verbindlich: false }]
    };
    renderFormular(formData, { bereich: 'influencer_marketing' });
    const instance = createInstance();
    instance.saveCurrentStepData();

    expect(instance.formData).toMatchObject({ ...formData, nutzung_creator_kanal: true, bereich: 'influencer_marketing' });
    expect(instance.formData.videolaenge_modus).toBe('bereich');
    expect(instance.formData.vorgabe_pflicht).toBe('');
  });

  it('Videolänge: Mindestlänge aus dem Zahlenfeld, keine Vorgabe ist null', () => {
    const form = renderFormular({ videolaenge: { von: 30, bis: null } });
    const instance = createInstance();
    instance.saveCurrentStepData();
    expect(instance.formData.videolaenge).toEqual({ von: 30, bis: null });
    expect(instance.formData.videolaenge_modus).toBe('minimum');

    form.querySelector('input[name="videolaenge__modus"][value="keine"]').checked = true;
    instance.saveCurrentStepData();
    expect(instance.formData.videolaenge).toBeNull();
    expect(instance.formData.videolaenge_modus).toBe('keine');
  });

  it('Produkte: leere Zeilen fallen weg, verknüpfte bleiben mit ID', () => {
    renderFormular({
      produkte: [{ produkt_id: 'p1', name: 'Serum' }, {}, { url: 'https://shop.example/creme' }]
    });
    const instance = createInstance();
    instance.saveCurrentStepData();
    expect(instance.formData.produkte).toEqual([
      { produkt_id: 'p1', name: 'Serum', url: '', kurzbeschreibung: '', usp: '', loesung: '' },
      { produkt_id: null, name: '', url: 'https://shop.example/creme', kurzbeschreibung: '', usp: '', loesung: '' }
    ]);
  });

  it('Ideen: leere Einträge fallen weg, der Schalter wird gelesen', () => {
    const form = renderFormular({ umsetzungsideen_eintraege: [{ text: 'A' }, { text: 'B' }] });
    const rows = form.querySelectorAll('[data-idee-row]');
    rows[0].querySelector('[data-idee-text]').value = '  ';
    rows[1].querySelector('[data-idee-verbindlich]').checked = true;
    const instance = createInstance();
    instance.saveCurrentStepData();
    expect(instance.formData.umsetzungsideen_eintraege).toEqual([{ text: 'B', verbindlich: true }]);
  });
});

describe('prepareDataForDB', () => {
  it('schreibt nur Felder des Creator-Briefings, Altfelder bleiben unberührt', () => {
    const instance = createInstance('paid_creator_ads');
    instance.formData = {
      bereich: 'paid_creator_ads',
      unternehmen_id: 'u1',
      aktivierung_name: 'Ads',
      aufgabe: 'Produkt zeigen',
      setting: 'Küche',
      cta: 'Jetzt kaufen',
      funnel_stufen: ['upper'],
      tkp: 12,
      produkte: [{ produkt_id: 'p1', name: 'Serum' }]
    };
    const data = instance.prepareDataForDB();

    expect(data.aufgabe).toBe('Produkt zeigen');
    for (const alt of ['cta', 'funnel_stufen', 'tkp', 'produkte', 'produkt_ids', 'persona_ids', 'videolaenge']) {
      expect(data, alt).not.toHaveProperty(alt);
    }
    expect(data.pa_umsetzung).toBe('Produkt zeigen');
    expect(data.pa_situationen).toBe('Küche');
  });

  it('Häkchen sind boolean, der Typ folgt aus der Content-Verwendung', () => {
    const instance = createInstance(null);
    instance.formData = { nutzung_markenkanal: undefined, nutzung_creator_kanal: true };
    const data = instance.prepareDataForDB();
    expect(data.nutzung_creator_kanal).toBe(true);
    expect(data.nutzung_markenkanal).toBe(false);
    expect(data.nutzung_paid_media).toBe(false);
    expect(data.bereich).toBe('influencer_marketing');
  });

  it('der bisherige Typ bleibt, solange sein Häkchen gesetzt ist', () => {
    const instance = createInstance(null);
    instance.formData = { bereich: 'owned_social', nutzung_markenkanal: true, nutzung_paid_media: true };
    expect(instance.prepareDataForDB().bereich).toBe('owned_social');

    instance.formData = { bereich: 'owned_social', nutzung_paid_media: true };
    expect(instance.prepareDataForDB().bereich).toBe('paid_creator_ads');
  });

  it('leere Werte werden null', () => {
    const instance = createInstance();
    instance.formData = { unternehmen_id: 'u1', aktivierung_name: '', plattformen: [], kernbotschaft: '  ' };
    const data = instance.prepareDataForDB();
    expect(data.aktivierung_name).toBeNull();
    expect(data.plattformen).toBeNull();
    expect(data.kernbotschaft).toBeNull();
    expect(data.marke_id).toBeNull();
    expect(data.umsetzungsideen_eintraege).toBeNull();
  });

  it('Videolänge: Spanne und Mindestlänge in die zwei Spalten', () => {
    const instance = createInstance('paid_creator_ads');
    instance.formData = { videolaenge: { von: 8, bis: 17 } };
    expect(instance.prepareDataForDB()).toMatchObject({ videolaenge_von: 8, videolaenge_bis: 17 });
    instance.formData = { videolaenge: { von: 30, bis: null } };
    expect(instance.prepareDataForDB()).toMatchObject({ videolaenge_von: 30, videolaenge_bis: null });
    instance.formData = { videolaenge: null };
    expect(instance.prepareDataForDB()).toMatchObject({ videolaenge_von: null, videolaenge_bis: null });
  });

  it('Bis-Datum nur mit Startdatum davor', () => {
    const instance = createInstance();
    instance.formData = { content_deadline: '2026-12-05', content_deadline_bis: '2026-12-01', go_live_bis: '2026-12-10' };
    const data = instance.prepareDataForDB();
    expect(data.content_deadline).toBe('2026-12-05');
    expect(data.content_deadline_bis).toBeNull();
    expect(data.go_live_bis).toBeNull();

    instance.formData = { content_deadline: '2026-12-01', content_deadline_bis: '2026-12-05' };
    expect(instance.prepareDataForDB().content_deadline_bis).toBe('2026-12-05');
  });

  it('Umsetzungsideen als { text, verbindlich }', () => {
    expect(ideenFuerDB([{ text: ' A ', verbindlich: true }, 'B', { text: '' }, { text: 'C', verbindlich: 'ja' }])).toEqual([
      { text: 'A', verbindlich: true },
      { text: 'B', verbindlich: false },
      { text: 'C', verbindlich: false }
    ]);
    expect(ideenFuerDB([])).toBeNull();
    expect(ideenFuerDB(null)).toBeNull();
  });

  it('nimmt den Kampagnentitel aus formData, sonst den Kampagnennamen', () => {
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
});
